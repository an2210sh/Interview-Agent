"""
report_store.py — Persistent interview report storage.

Saves completed interview reports as:
  - JSON file: backend/reports/<candidateId>_<timestamp>.json
  - Appends to: backend/reports/prompt.md  (full chat log of all sessions)

Sorting: reports listed by score DESC, then time_taken_seconds ASC.
"""

import os
import json
from datetime import datetime, timezone

_REPORTS_DIR = os.path.join(os.path.dirname(__file__), "reports")
_PROMPT_MD   = os.path.join(_REPORTS_DIR, "prompt.md")


def _ensure_dir():
    os.makedirs(_REPORTS_DIR, exist_ok=True)


def save_report(session, feedback: dict) -> str:
    """
    Persist a completed interview session.
    Returns the filename of the saved JSON report.
    """
    _ensure_dir()

    member  = session.candidate_context["member"]
    cand_id = member.get("id", "unknown")
    name    = member.get("name", "Unknown")
    role    = member.get("jobRole", "")

    now = datetime.now(timezone.utc)
    ts  = now.strftime("%Y%m%dT%H%M%SZ")
    filename = f"{cand_id}_{ts}.json"
    filepath = os.path.join(_REPORTS_DIR, filename)

    # Compute time taken
    started_at = getattr(session, "started_at", now)
    time_taken_seconds = max(0, int((now - started_at).total_seconds()))

    # Build transcript (exclude system messages)
    transcript = [
        {"role": m["role"], "content": m["content"]}
        for m in session.messages
        if m["role"] in ("user", "assistant")
    ]

    report = {
        "session_id":         session.session_id,
        "candidate_id":       cand_id,
        "candidate_name":     name,
        "job_role":           role,
        "completed_at":       now.isoformat(),
        "started_at":         started_at.isoformat(),
        "time_taken_seconds": time_taken_seconds,
        "score":              feedback.get("score", 0),
        "feedback":           feedback,
        "transcript":         transcript,
    }

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    _append_to_prompt_md(report, transcript, name, role, now, time_taken_seconds)
    return filename


def _append_to_prompt_md(report: dict, transcript: list, name: str, role: str,
                          now: datetime, time_taken_seconds: int):
    date_str = now.strftime("%Y-%m-%d %H:%M UTC")
    score    = report.get("score", 0)
    summary  = report.get("feedback", {}).get("summary", "")
    minutes  = time_taken_seconds // 60
    seconds  = time_taken_seconds % 60
    time_str = f"{minutes}m {seconds}s"

    lines = [
        f"\n\n---\n",
        f"# Interview: {name} — {date_str}\n",
        f"**Role:** {role}  ",
        f"**Score: {score} / 100**  ",
        f"**Time Taken: {time_str}**  ",
        f"**Session:** `{report['session_id']}`\n",
        f"\n## Summary\n{summary}\n",
        f"\n## Full Transcript\n",
    ]

    for msg in transcript:
        if msg["role"] == "assistant":
            lines.append(f"\n**Interviewer (AI):** {msg['content']}\n")
        else:
            lines.append(f"\n**{name}:** {msg['content']}\n")

    lines.append(f"\n---\n")

    if not os.path.exists(_PROMPT_MD):
        with open(_PROMPT_MD, "w", encoding="utf-8") as f:
            f.write("# Interview Prompt Log\n")
            f.write("All interview conversations stored here chronologically.\n")

    with open(_PROMPT_MD, "a", encoding="utf-8") as f:
        f.writelines(lines)


def list_reports() -> list[dict]:
    """
    Return all report summaries sorted by:
      1. score DESC
      2. time_taken_seconds ASC (faster interview wins on equal score)
    """
    _ensure_dir()
    summaries = []

    for fname in os.listdir(_REPORTS_DIR):
        if not fname.endswith(".json"):
            continue
        fpath = os.path.join(_REPORTS_DIR, fname)
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                data = json.load(f)
            summaries.append({
                "filename":           fname,
                "candidate_name":     data.get("candidate_name", ""),
                "candidate_id":       data.get("candidate_id", ""),
                "job_role":           data.get("job_role", ""),
                "score":              data.get("score", 0),
                "time_taken_seconds": data.get("time_taken_seconds", 0),
                "completed_at":       data.get("completed_at", ""),
            })
        except Exception:
            pass

    # Sort: score DESC, then time_taken_seconds ASC
    summaries.sort(key=lambda r: (-r["score"], r["time_taken_seconds"]))
    return summaries


def get_report(filename: str) -> dict | None:
    _ensure_dir()
    safe_name = os.path.basename(filename)
    fpath = os.path.join(_REPORTS_DIR, safe_name)
    if not os.path.exists(fpath) or not safe_name.endswith(".json"):
        return None
    with open(fpath, "r", encoding="utf-8") as f:
        return json.load(f)
