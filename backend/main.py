"""
main.py — FastAPI application entry point.

Endpoints:
  POST /api/interview        — Start or continue an interview session
  GET  /api/candidates       — List all candidate profiles for the frontend
  GET  /api/reports          — List all saved interview reports
  GET  /api/reports/{fname}  — Get a specific full report
"""

import os
import sys
from pathlib import Path

# Ensure backend directory and project root are in sys.path
_HERE = Path(__file__).resolve().parent
_ROOT = _HERE.parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

# Load .env from backend/ directory explicitly
_ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path=_ENV_PATH, override=True)

from data_loader import load_curriculum, load_candidates, build_candidate_context
from session_store import create_session, get_session, get_active_count
import agent as interview_agent
import report_store

# ─── Startup: load data once ──────────────────────────────────────────────────
try:
    curriculum = load_curriculum()
    candidates = load_candidates()
    print(f"[startup] Pre-loaded {len(candidates)} candidates and {len(curriculum.get('days', []))} curriculum days.")
except Exception as _e:
    print(f"[startup error] Could not pre-load data: {_e}")
    curriculum = {"days": [], "modules": []}
    candidates = []

@asynccontextmanager
async def lifespan(app: FastAPI):
    global curriculum, candidates
    load_dotenv(dotenv_path=_ENV_PATH, override=True)
    if not curriculum.get("days"):
        try:
            curriculum = load_curriculum()
        except Exception:
            pass
    if not candidates:
        try:
            candidates = load_candidates()
        except Exception:
            pass
    print(f"[lifespan] Loaded {len(candidates)} candidates.")

    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key or api_key == "your_groq_api_key_here":
        print("")
        print("╔══════════════════════════════════════════════════════════════╗")
        print("║  ⚠️  GROQ_API_KEY is not set!                                ║")
        print("║                                                              ║")
        print("║  1. Go to: https://console.groq.com                         ║")
        print("║  2. Sign up for free and create an API key                  ║")
        print("║  3. Edit: backend\\.env                                      ║")
        print("║  4. Replace 'your_groq_api_key_here' with your key          ║")
        print("║  5. Restart this server                                     ║")
        print("║                                                              ║")
        print("║  The server will run but interviews will fail until          ║")
        print("║  a valid API key is provided.                               ║")
        print("╚══════════════════════════════════════════════════════════════╝")
        print("")
    else:
        print(f"[startup] Groq API key loaded (starts with: {api_key[:8]}...)")
    yield

app = FastAPI(
    title="AI Interview Agent",
    description="Conducts personalized technical interviews for the AI Cohort program.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Request / Response models ─────────────────────────────────────────────────

class InterviewRequest(BaseModel):
    sessionId: str
    candidate: Optional[dict] = None   # provided only on first request
    message: Optional[str] = None      # provided only on subsequent turns


class FeedbackModel(BaseModel):
    summary: str
    strengths: list[str]
    gaps: list[str]
    next: list[str]
    score: int = 0


class InterviewResponse(BaseModel):
    reply: str
    done: bool
    feedback: Optional[FeedbackModel] = None
    report_filename: Optional[str] = None


# ─── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/api/interview", response_model=InterviewResponse)
async def interview(req: InterviewRequest):
    session_id = req.sessionId

    # ── START: first request has a candidate object ──────────────────────────
    if req.candidate is not None:
        try:
            ctx = build_candidate_context(req.candidate, curriculum)
            session = create_session(session_id, ctx)
            opening = interview_agent.start_interview(session)
            return InterviewResponse(reply=opening, done=False)
        except Exception as e:
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Failed to start interview: {str(e)}")

    # ── TURN: subsequent request has a message ───────────────────────────────
    session = get_session(session_id)
    if session is None:
        raise HTTPException(
            status_code=404,
            detail=f"Session '{session_id}' not found. Please start a new interview."
        )

    if session.is_complete:
        raise HTTPException(
            status_code=400,
            detail="This interview session has already been completed."
        )

    if not req.message or not req.message.strip():
        raise HTTPException(status_code=422, detail="Message cannot be empty.")

    reply, is_done, feedback = interview_agent.get_next_response(session, req.message.strip())

    if is_done and feedback:
        # Save the completed report persistently
        try:
            filename = report_store.save_report(session, feedback)
        except Exception as e:
            import traceback
            traceback.print_exc()
            filename = None

        return InterviewResponse(
            reply=reply,
            done=True,
            feedback=FeedbackModel(**feedback),
            report_filename=filename,
        )

    return InterviewResponse(reply=reply, done=False)


@app.get("/api/candidates")
async def get_candidates():
    """Return all candidate profiles for the frontend selector."""
    # Get all reports to cross-reference which candidates have been interviewed
    all_reports = []
    try:
        all_reports = report_store.list_reports()
    except Exception:
        pass

    # Build a map: candidate_id -> best report info
    report_map = {}
    for r in all_reports:
        cid = r.get("candidate_id", "")
        if cid not in report_map or r.get("score", 0) > report_map[cid].get("score", 0):
            report_map[cid] = r

    result = []
    for c in candidates:
        m = c["member"]
        missions = c.get("missions", [])
        signals = c.get("signals", {})

        completed_count = sum(1 for ms in missions if ms.get("passed"))
        skipped_count   = sum(1 for ms in missions if ms.get("skipped"))

        cand_id = m["id"]
        has_report = cand_id in report_map
        last_score = report_map[cand_id].get("score", 0) if has_report else None
        last_time  = report_map[cand_id].get("time_taken_seconds", 0) if has_report else None

        result.append({
            "id": cand_id,
            "name": m["name"],
            "jobRole": m["jobRole"],
            "yearsExperience": m["yearsExperience"],
            "education": m["education"],
            "status": m["status"],
            "missionsCompleted": signals.get("missionsCompleted", completed_count),
            "commitDays": signals.get("commitDays", 0),
            "missionsFirstTry": signals.get("missionsFirstTry", 0),
            "skippedCount": skipped_count,
            "has_report": has_report,
            "last_score": last_score,
            "last_time_seconds": last_time,
            "raw": c,
        })

    return {"candidates": result}


@app.get("/api/stats")
async def get_stats():
    """Return live stats for the dashboard."""
    active = get_active_count()
    try:
        reports = report_store.list_reports()
    except Exception:
        reports = []
    return {
        "active_interviews": active,
        "total_reports": len(reports),
        "reports": reports,
    }


@app.get("/api/reports")
async def list_reports():
    """Return a list of all completed interview report summaries."""
    try:
        reports = report_store.list_reports()
        return {"reports": reports}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/reports/{filename}")
async def get_report(filename: str):
    """Return the full report JSON for a given filename."""
    data = report_store.get_report(filename)
    if data is None:
        raise HTTPException(status_code=404, detail="Report not found.")
    return data


@app.get("/health")
async def health():
    api_key = os.getenv("GROQ_API_KEY", "")
    key_set = bool(api_key) and api_key != "your_groq_api_key_here"
    return {
        "status": "ok",
        "candidates_loaded": len(candidates),
        "model": interview_agent.MODEL,
        "api_key_configured": key_set,
    }

@app.get("/api/status")
async def status():
    """Returns configuration status for the frontend setup screen."""
    api_key = os.getenv("GROQ_API_KEY", "")
    key_set = bool(api_key) and api_key != "your_groq_api_key_here"
    return {
        "ready": key_set,
        "api_key_configured": key_set,
        "candidates_loaded": len(candidates),
        "model": interview_agent.MODEL,
        "setup_url": "https://console.groq.com" if not key_set else None,
    }
