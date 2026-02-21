"""
Solace — Configuration
All environment variables and tunable parameters.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ── API Keys ──
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/solace")

# ── TTS ──
TTS_VOICE = os.getenv("TTS_VOICE", "aura-asteria-en")
TTS_SAMPLE_RATE = 16000
TTS_ENCODING = "linear16"

# ── ASR ──
ASR_MODEL = "nova-2"
ASR_LANGUAGE = "en"
ASR_SAMPLE_RATE = 16000

# ── LLM ──
LLM_MODEL = "llama-3.1-8b-instant"
LLM_TEMPERATURE = 0.65
LLM_MAX_TOKENS = 150  # Allow slightly longer, more complete responses

# ── Latency Thresholds (ms) ──
FIRST_FLUSH_WORDS = 4       # Slightly larger first chunk for smoother start
STEADY_FLUSH_WORDS = 12     # Bigger stable chunks — smoother, less choppy
DEADLINE_FLUSH_MS = 300     # Relaxed deadline — smoother delivery over raw speed

# ── Memory ──
VECTOR_SEARCH_INDEX = "emotional_embeddings"
VECTOR_DIMENSIONS = 768
MEMORY_RELEVANCE_THRESHOLD = 0.72
MAX_HISTORY_TURNS = 16
HISTORY_TRIM_TO = 14

# ── VAD ──
VAD_AGGRESSIVENESS = 2       # 0-3, higher = more aggressive filtering
VAD_FRAME_MS = 30            # Frame duration for VAD (10, 20, or 30 ms)

# ── Server ──
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
