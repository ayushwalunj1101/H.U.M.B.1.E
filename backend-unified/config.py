"""
Unified Backend — Configuration
All environment variables and tunable parameters.
Merges backend/ (RAG) + backend2/ (Solace voice agent) configs.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ── API Keys ──
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
HEYGEN_API_KEY = os.getenv("HEYGEN_API_KEY", "")
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/solace")

# ── RAG ──
RAG_LLM_MODEL = "llama-3.3-70b-versatile"
RAG_LLM_TEMPERATURE = 0.1

# ── Voice LLM ──
VOICE_LLM_MODEL = "llama-3.1-8b-instant"
VOICE_LLM_TEMPERATURE = 0.65
VOICE_LLM_MAX_TOKENS = 150

# ── TTS (Deepgram Aura) ──
TTS_VOICE = os.getenv("TTS_VOICE", "aura-asteria-en")
TTS_SAMPLE_RATE = 16000
TTS_ENCODING = "linear16"

# ── ASR (Deepgram Nova-2) ──
ASR_MODEL = "nova-2"
ASR_LANGUAGE = "en"
ASR_SAMPLE_RATE = 16000

# ── Latency Thresholds (ms) ──
FIRST_FLUSH_WORDS = 4
STEADY_FLUSH_WORDS = 12
DEADLINE_FLUSH_MS = 300

# ── Memory (MongoDB) ──
VECTOR_SEARCH_INDEX = "emotional_embeddings"
VECTOR_DIMENSIONS = 768
MEMORY_RELEVANCE_THRESHOLD = 0.72
MAX_HISTORY_TURNS = 16
HISTORY_TRIM_TO = 14

# ── Server ──
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
