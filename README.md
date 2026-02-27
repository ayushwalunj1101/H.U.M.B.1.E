# H.U.M.B.1.E — Voice-First Mental Health AI Platform

An AI-powered mental health therapy platform delivering support through a HeyGen streaming avatar, full-duplex voice therapy, clinical assessments, and a RAG-augmented clinical knowledge base.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        H.U.M.B.1.E                          │
├─────────────────┬───────────────────┬───────────────────────┤
│  avatar-frontend│    frontend/      │   backend-unified/    │
│  (Next.js 14)   │  (React / CRA)    │   (FastAPI)           │
│  HeyGen Avatar  │  Chat + PHQ-9 +   │   RAG · Voice WS ·   │
│  + RAG voice    │  Immersive Mode   │   HeyGen token ·      │
│  Port 3000      │  Port 3001        │   Journal · Memory    │
└─────────────────┴───────────────────┴───────────────────────┘
                              │
        ┌─────────────────────┼──────────────────────┐
        ▼                     ▼                      ▼
   Groq (Llama-3)      Google Gemini          HeyGen API
   RAG + Voice LLM     Embeddings + Senses    Streaming Avatar
        │                                           │
        ▼                                           ▼
   Deepgram API                             MongoDB Atlas
   ASR (Nova-2) + TTS (Aura)               Conversation Memory
```

---

## Features

### HeyGen Streaming Avatar (`avatar-frontend/`)
- Photo-realistic AI avatar driven by HeyGen's WebRTC streaming SDK
- Voice-activated — user speaks, avatar responds via RAG backend
- Real-time citations panel showing clinical source documents
- Multi-agent council badge (primary state · recommended modality)
- Production-grade error handling: auth failures, network drops, browser autoplay blocks

### Chat + Clinical Tools (`frontend/`)
- Conversational therapy with RAG-backed responses
- PHQ-9 clinical depression screening with severity scoring
- Crisis detection with hardcoded safety overrides (Tele-MANAS / Connecting Trust)
- Immersive full-screen voice mode with animated orb visualisation
- Assessment report generation

### Unified Backend (`backend-unified/`)
- **RAG pipeline** — FAISS retrieval → multi-agent council → Llama-3.3-70B generation
- **WebSocket voice** — full-duplex audio: Deepgram ASR → Llama-3.1-8B → Deepgram TTS
- **HeyGen token proxy** — keeps `HEYGEN_API_KEY` server-side
- **Journal upload** — PDF ingestion and analysis per user
- **MongoDB memory** — persistent vector-searched emotional memory (768-dim, Motor async)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Avatar frontend | Next.js 14, TypeScript, `@heygen/streaming-avatar` v2 |
| Chat frontend | React 18, React Router 6, Framer Motion, Web Speech API |
| Backend framework | FastAPI 0.115, Uvicorn, Pydantic v2 |
| RAG LLM | Groq · Llama-3.3-70B-Versatile |
| Voice LLM | Groq · Llama-3.1-8B-Instant |
| Embeddings | Google Gemini (`google-genai`) |
| Senses / affect | Google Gemini (`senses_service`) |
| Vector store | FAISS (CPU) |
| ASR | Deepgram Nova-2 |
| TTS | Deepgram Aura (`aura-asteria-en`) |
| Avatar streaming | HeyGen Streaming API v1 |
| Memory / persistence | MongoDB Atlas (Motor async driver) |
| Conversation graph | LangGraph 0.2+ |

---

## Prerequisites

- Python **3.10+**
- Node.js **18+**
- API keys for: **Groq**, **Google Gemini**, **HeyGen**, **Deepgram**
- MongoDB Atlas URI (optional — memory features degrade gracefully when absent)

---

## Environment Variables

Create `backend-unified/.env`:

```env
# Required
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIza...
HEYGEN_API_KEY=...
DEEPGRAM_API_KEY=...

# Optional (memory features)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/solace

# Optional (defaults shown)
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
TTS_VOICE=aura-asteria-en
```

---

## Setup & Running

### 1. Backend

```bash
cd backend-unified

# Create virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Add your .env (see section above)

# Place therapy PDFs in data/books/ — the RAG pipeline indexes them at startup

# Start the server
python main.py
# or: uvicorn main:app --reload --port 8000
```

Backend runs on `http://localhost:8000`
Interactive docs: `http://localhost:8000/docs`

### 2. Avatar Frontend (Next.js)

```bash
cd avatar-frontend

npm install
npm run dev
```

Runs on `http://localhost:3000`

### 3. Chat / Clinical Frontend (React CRA)

```bash
cd frontend

npm install
npm start
```

Runs on `http://localhost:3001`
*(If both frontends run simultaneously, configure `PORT=3001` for the CRA app or adjust your dev proxy.)*

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/rag` | RAG query — returns `spoken_answer`, `citations`, `council` |
| `POST` | `/api/get-access-token` | HeyGen streaming token (proxied, API key stays server-side) |
| `WS` | `/ws/voice/{user_id}` | Full-duplex voice: PCM audio in → TTS audio out |
| `POST` | `/api/journal/upload/{user_id}` | Upload and analyse a journal PDF |
| `GET` | `/health` | Health check |

### WebSocket Voice Auth
Pass `?token=<jwt>` as a query parameter when connecting to `/ws/voice/{user_id}`.
Replace the placeholder token check in `routers/voice_ws.py` with real JWT verification before deploying to production.

---

## Project Structure

```
doc-test/
├── backend-unified/
│   ├── main.py                  # FastAPI app + lifespan startup
│   ├── config.py                # All env vars and tunable parameters
│   ├── session.py               # Per-user session context
│   ├── turn_manager.py          # Turn-based conversation management
│   ├── requirements.txt
│   ├── agents/
│   │   └── therapist_graph.py   # LangGraph multi-agent council
│   ├── audio/
│   │   ├── asr_streamer.py      # Deepgram Nova-2 streaming ASR
│   │   └── tts_streamer.py      # Deepgram Aura streaming TTS
│   ├── rag/
│   │   ├── pipeline.py          # End-to-end RAG orchestration
│   │   ├── retrieval.py         # FAISS retrieval
│   │   ├── generation.py        # LLM response generation
│   │   ├── council.py           # Multi-perspective clinical analysis
│   │   └── citation_formatter.py
│   ├── routers/
│   │   ├── rag_router.py        # POST /api/rag
│   │   ├── heygen_router.py     # POST /api/get-access-token
│   │   ├── voice_ws.py          # WS  /ws/voice/{user_id}
│   │   └── journal.py           # POST /api/journal/upload
│   ├── services/
│   │   ├── singletons.py        # Groq + MongoDB client pool
│   │   ├── embedding_service.py # Gemini embeddings
│   │   ├── memory_service.py    # MongoDB vector memory
│   │   └── senses_service.py    # Gemini affect / senses
│   ├── prompts/
│   │   ├── therapist_system.txt
│   │   └── voice_therapy_prompt.txt
│   └── data/books/              # Therapy PDFs for RAG indexing
│
├── avatar-frontend/             # Next.js 14 + TypeScript
│   └── src/
│       ├── app/                 # Next.js app router
│       ├── components/
│       │   ├── AvatarSession.tsx    # HeyGen avatar lifecycle + error handling
│       │   ├── CitationsPanel.tsx   # RAG source citations
│       │   └── VoiceStatus.tsx      # Voice state indicator
│       ├── hooks/
│       │   └── useConversation.ts   # Conversation state + error handling
│       └── lib/
│           └── rag-client.ts        # Backend API client
│
└── frontend/                    # React 18 CRA
    └── src/
        ├── App.jsx
        ├── Chat.jsx             # RAG chat interface
        ├── Assessment.jsx       # PHQ-9 questionnaire
        ├── Report.jsx           # Assessment results
        ├── ImmersiveMode.jsx    # Full-screen voice mode
        ├── OnboardingFlow.jsx
        ├── WelcomePage.jsx
        ├── components/
        │   ├── Iridescence.jsx
        │   └── JarvisOrb.jsx
        └── hooks/
            ├── useAudioLevel.js
            ├── useAudioVisualizer.js
            ├── useSpeechRecognition.js
            └── useSpeechSynthesis.js
```

---

## Council Analysis System

Every RAG query passes through a multi-agent council that returns:

| Field | Values |
|---|---|
| `primary_state` | `depression`, `anxiety`, `stress`, `neutral` |
| `severity` | `mild`, `moderate`, `severe` |
| `crisis_risk` | `low`, `medium`, `high` |
| `recommended_modality` | `CBT`, `mindfulness`, `crisis_intervention` |

High-risk inputs bypass the RAG pipeline entirely and return hardcoded crisis resources.

---

## Safety & Crisis Resources

H.U.M.B.1.E is **not** a replacement for professional therapy.
In crisis situations the platform surfaces:

- **Tele-MANAS**: 14416 (24/7 · Free · India)
- **Connecting Trust** (Pune): 9922001122
- **Emergency services**: 112

---

## License

Educational and non-commercial use only.

---

**Built with care for mental health support** 💙