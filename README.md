# AI Interview Agent Platform

> A personalized AI-powered technical interview platform for the **31-Day AI Cohort** program.

---

## Features

- 🤖 **Adaptive interviews** — questions personalized to each candidate's completed missions
- 💬 **Multi-turn context** — Groq LLaMA-3.3-70b maintains conversation memory
- 📊 **8+ questions across 4+ curriculum days** — meets all minimum requirements
- 📋 **Structured feedback** — strengths, gaps, and next steps at the end
- ✅ **Full API contract** — matches the provided technical specification

---

## Prerequisites

- Python 3.10+
- A **Groq API key** — get one free at [console.groq.com](https://console.groq.com)

---

## Quick Start

### 1. Add your Groq API key

```bash
# In the backend/ folder, create a .env file:
cd backend
copy .env.example .env
```

Edit `backend/.env`:
```
GROQ_API_KEY=gsk_your_actual_key_here
```

### 2. Run the server (Windows)

Double-click **`start.bat`** or run:

```bash
start.bat
```

This will:
- Create a Python virtual environment
- Install all dependencies
- Start FastAPI on `http://localhost:8000`

### 3. Open the frontend

Open `frontend/index.html` in your browser.

> **Note**: Use a live server or browser directly — no build step needed.

---

## API Reference

### `POST /api/interview`

**Start interview** (first request):
```json
{
  "sessionId": "abc-123",
  "candidate": { ...candidate object... }
}
```

**Conversation turn** (subsequent requests):
```json
{
  "sessionId": "abc-123",
  "message": "Embeddings are dense vector representations..."
}
```

**Response** (in progress):
```json
{ "reply": "...", "done": false }
```

**Response** (completed):
```json
{
  "reply": "...",
  "done": true,
  "feedback": {
    "summary": "...",
    "strengths": ["..."],
    "gaps": ["..."],
    "next": ["..."]
  }
}
```

### `GET /api/candidates`

Returns all 20 candidate profiles for the frontend selector.

### `GET /health`

Health check — confirms server and data are loaded.

---

## Project Structure

```
project-02/
├── candidates.json          # 20 candidate profiles
├── curriculum.json          # 31-day AI Cohort curriculum
├── technical-spec.md        # API specification
├── start.bat                # Windows startup script
│
├── backend/
│   ├── main.py              # FastAPI app + endpoints
│   ├── agent.py             # Groq LLM interview agent
│   ├── session_store.py     # In-memory session management
│   ├── data_loader.py       # Curriculum + candidate data enrichment
│   ├── requirements.txt     # Python dependencies
│   └── .env.example         # API key template
│
└── frontend/
    ├── index.html           # Main UI
    ├── style.css            # Dark glassmorphism design system
    └── app.js               # State machine + API integration
```

---

## Tech Stack

| Layer     | Technology                      |
|-----------|---------------------------------|
| LLM       | Groq API · llama-3.3-70b-versatile |
| Backend   | FastAPI · Python 3.10+          |
| Sessions  | In-memory (dict)                |
| Frontend  | Vanilla HTML / CSS / JS         |
| Design    | Dark mode · Glassmorphism       |
| Fonts     | Inter · Outfit · JetBrains Mono |

---

## How the Interview Works

1. **Select a candidate** from the sidebar
2. The agent reads their completed missions, struggles, and skipped topics
3. A personalized system prompt is constructed from their profile
4. The agent conducts a **minimum of 8 questions** across **4+ curriculum days**
5. Follow-up questions adapt based on candidate responses
6. The interview ends with **structured feedback** covering strengths, gaps, and next steps
