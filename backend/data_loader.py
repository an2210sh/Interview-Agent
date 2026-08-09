"""
data_loader.py — Loads and indexes curriculum.json and candidates.json at startup.
"""

import json
import os
from pathlib import Path

_BASE = Path(__file__).parent.parent  # project-02/

def load_curriculum() -> dict:
    with open(_BASE / "curriculum.json", "r", encoding="utf-8") as f:
        return json.load(f)

def load_candidates() -> list[dict]:
    with open(_BASE / "candidates.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    return data["candidates"]

def get_curriculum_day(curriculum: dict, day_num: int) -> dict | None:
    for d in curriculum["days"]:
        if d["day"] == day_num:
            return d
    return None

def get_module_for_day(curriculum: dict, day_num: int) -> dict | None:
    for m in curriculum["modules"]:
        start, end = m["days"]
        if start <= day_num <= end:
            return m
    return None

def build_candidate_context(candidate: dict, curriculum: dict) -> dict:
    """
    Returns a structured summary of what the candidate has done,
    enriched with curriculum metadata for each mission.

    Supports two input formats:
    1. Raw format (from candidates.json):  {"member": {...}, "missions": [...], "signals": {...}}
    2. Flat format (from /api/candidates): {"id": ..., "name": ..., "raw": {...}}
    """
    # Normalize: if the candidate has a nested 'raw' key, unwrap it
    if "raw" in candidate and isinstance(candidate["raw"], dict):
        candidate = candidate["raw"]

    # If still no 'member' key, reconstruct it from flat fields
    if "member" not in candidate:
        candidate = {
            "member": {
                "id":              candidate.get("id", "UNKNOWN"),
                "name":            candidate.get("name", "Candidate"),
                "jobRole":         candidate.get("jobRole", "Unknown Role"),
                "yearsExperience": candidate.get("yearsExperience", 0),
                "education":       candidate.get("education", ""),
                "status":          candidate.get("status", "COMPLETED"),
            },
            "missions": candidate.get("missions", []),
            "signals":  candidate.get("signals", {}),
        }

    missions = candidate.get("missions", [])
    signals = candidate.get("signals", {})

    completed = []
    struggled = []   # passed but high attempts (>= 3)
    skipped = []
    failed = []

    for m in missions:
        day_num = m["day"]
        day_info = get_curriculum_day(curriculum, day_num)
        module = get_module_for_day(curriculum, day_num)

        entry = {
            "day": day_num,
            "title": m["title"],
            "objectives": day_info["objectives"] if day_info else [],
            "tools": day_info.get("tools", []) if day_info else [],
            "module": module["title"] if module else "Unknown",
            "type": day_info.get("type", "") if day_info else "",
        }

        if m.get("skipped"):
            skipped.append(entry)
        elif not m.get("passed", True):
            entry["attempts"] = m.get("attempts", 0)
            failed.append(entry)
        else:
            entry["attempts"] = m.get("attempts", 1)
            completed.append(entry)
            if m.get("attempts", 1) >= 3:
                struggled.append(entry)

    return {
        "member": candidate["member"],
        "completed": completed,
        "struggled": struggled,
        "skipped": skipped,
        "failed": failed,
        "signals": signals,
        "completed_days": [m["day"] for m in completed],
        "all_days": [m["day"] for m in missions],
    }
