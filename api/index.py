"""
api/index.py — Entry point for Vercel Serverless Functions.
"""

import sys
from pathlib import Path

# Add project root and backend folder to Python module search path
ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from backend.main import app
