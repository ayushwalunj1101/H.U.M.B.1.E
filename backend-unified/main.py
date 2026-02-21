"""
Unified Backend — FastAPI Application
Merges RAG pipeline + Solace voice agent + HeyGen token service.
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from services.singletons import initialize_clients, shutdown_clients
from routers import rag_router, heygen_router, voice_ws, journal
from config import CORS_ORIGINS

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Pre-warm all API clients before accepting requests."""
    logger.info("╔══════════════════════════════════════════════╗")
    logger.info("║  Unified Backend — RAG + Voice + Avatar      ║")
    logger.info("╚══════════════════════════════════════════════╝")
    await initialize_clients()
    yield
    await shutdown_clients()
    logger.info("Shutdown complete.")


app = FastAPI(
    title="Unified Backend — RAG + Voice + Avatar",
    description="Voice-first therapy agent with RAG, HeyGen avatar, Deepgram voice, and MongoDB memory",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(rag_router.router)           # POST /api/rag
app.include_router(heygen_router.router)         # POST /api/get-access-token
app.include_router(voice_ws.router)              # WS   /ws/voice/{user_id}
app.include_router(journal.router, prefix="/api")  # POST /api/journal/upload/{user_id}


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "unified-backend"}


if __name__ == "__main__":
    import uvicorn

    print("\n" + "=" * 50)
    print("🚀 Starting Unified Backend")
    print("=" * 50)
    print("📡 Server: http://0.0.0.0:8000")
    print("📚 API Docs: http://localhost:8000/docs")
    print("🔗 Endpoints:")
    print("   POST /api/rag              — RAG query (HeyGen flow)")
    print("   POST /api/get-access-token — HeyGen streaming token")
    print("   WS   /ws/voice/{user_id}   — Full-duplex voice")
    print("   POST /api/journal/upload   — Journal upload")
    print("   GET  /health               — Health check")
    print("=" * 50 + "\n")

    uvicorn.run(app, host="0.0.0.0", port=8000)
