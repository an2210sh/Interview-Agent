"""
session_store.py — In-memory session management keyed by sessionId.
"""

from typing import Any
from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class InterviewSession:
    session_id: str
    candidate_context: dict
    messages: list[dict]  = field(default_factory=list)
    question_count: int   = 0
    days_covered: set     = field(default_factory=set)
    is_complete: bool     = False
    feedback: dict | None = None
    started_at: datetime  = field(default_factory=lambda: datetime.now(timezone.utc))


# Global in-memory store
_sessions: dict[str, InterviewSession] = {}


def create_session(session_id: str, candidate_context: dict) -> InterviewSession:
    session = InterviewSession(
        session_id=session_id,
        candidate_context=candidate_context,
    )
    _sessions[session_id] = session
    return session


def get_session(session_id: str) -> InterviewSession | None:
    return _sessions.get(session_id)


def delete_session(session_id: str) -> None:
    _sessions.pop(session_id, None)


def get_active_count() -> int:
    """Return number of sessions that are started but not yet completed."""
    return sum(1 for s in _sessions.values() if not s.is_complete)
