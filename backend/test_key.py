# test_key.py -- Quick test to verify your Groq API key works.
# Run from the backend/ folder:
#   C:\Users\Naitik\anaconda3\python.exe test_key.py

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load .env from this same directory
load_dotenv(Path(__file__).parent / ".env", override=True)

api_key = os.getenv("GROQ_API_KEY", "").strip()

print("=" * 55)
print("  Groq API Key Diagnostic")
print("=" * 55)

if not api_key:
    print("[FAIL] GROQ_API_KEY is not set in .env")
    sys.exit(1)
elif api_key == "your_groq_api_key_here":
    print("[FAIL] GROQ_API_KEY is still the placeholder value.")
    print("       Edit backend/.env and replace it with your real key.")
    print("       Get one free at: https://console.groq.com")
    sys.exit(1)
elif not api_key.startswith("gsk_"):
    print(f"[WARN] Key found but unexpected format: {api_key[:12]}...")
    print("       Groq keys usually start with 'gsk_'")
else:
    print(f"[ OK] Key found: {api_key[:8]}...{api_key[-4:]}")

print()
print("Testing live connection to Groq API...")

try:
    from groq import Groq
    client = Groq(api_key=api_key)
    resp = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": "Reply with exactly: API key works!"}],
        max_tokens=20,
    )
    reply = resp.choices[0].message.content.strip()
    print(f"[ OK] API Response: {reply}")
    print()
    print("[DONE] Everything is working!")
    print("       Now RESTART the backend server for the key to take effect.")
    print("       Press Ctrl+C in the backend terminal, then run start.bat again.")
except Exception as e:
    print(f"[FAIL] API call failed: {e}")
    print()
    print("  Common fixes:")
    print("  - Double-check key is correct at https://console.groq.com")
    print("  - Make sure internet is accessible")
    sys.exit(1)
