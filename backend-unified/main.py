"""
Unified Backend — FastAPI Application
Merges RAG pipeline + Solace voice agent + HeyGen token service.
"""
import logging
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from services.singletons import initialize_clients, shutdown_clients, get_db, get_groq
from routers import rag_router, heygen_router, voice_ws, journal
from config import CORS_ORIGINS

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ── Request ID Middleware ──
class RequestIDMiddleware(BaseHTTPMiddleware):
    """Injects a unique request ID into every request for distributed tracing."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id
        logger.info(f"[{request_id}] {request.method} {request.url.path}")

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


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

# Middleware (order matters — outermost first)
app.add_middleware(RequestIDMiddleware)
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
    """
    Enhanced health endpoint — checks DB and LLM connectivity.
    Returns degraded status if any dependency is unreachable.
    """
    checks = {"service": "unified-backend"}
    overall_status = "ok"

    # Check MongoDB
    db = get_db()
    if db is not None:
        try:
            await db.command("ping")
            checks["mongodb"] = "connected"
        except Exception as e:
            checks["mongodb"] = f"error: {e}"
            overall_status = "degraded"
    else:
        checks["mongodb"] = "not configured"
        overall_status = "degraded"

    # Check Groq/LLM client
    try:
        groq = get_groq()
        checks["llm"] = "initialized"
    except RuntimeError:
        checks["llm"] = "not initialized"
        overall_status = "degraded"

    checks["status"] = overall_status
    return checks


# NOTE: Production deployments should use:
#   gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
# The uvicorn.run() below is for local development only.
if __name__ == "__main__":
    import uvicorn

    print("\n" + "=" * 50)
    print("🚀 Starting Unified Backend (DEV MODE)")
    print("=" * 50)
    print("📡 Server: http://0.0.0.0:8000")
    print("📚 API Docs: http://localhost:8000/docs")
    print("🔗 Endpoints:")
    print("   POST /api/rag              — RAG query (HeyGen flow)")
    print("   POST /api/get-access-token — HeyGen streaming token")
    print("   WS   /ws/voice/{user_id}   — Full-duplex voice")
    print("   POST /api/journal/upload   — Journal upload")
    print("   GET  /health               — Health check (DB + LLM)")
    print("=" * 50 + "\n")

    uvicorn.run(app, host="0.0.0.0", port=8000)

