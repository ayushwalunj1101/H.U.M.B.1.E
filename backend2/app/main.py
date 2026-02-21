"""
Solace — FastAPI Application
Main entry point with lifespan management and CORS.
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.services.singletons import initialize_clients, shutdown_clients
from app.routers import voice_ws, journal
from app.config import CORS_ORIGINS

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
    logger.info("╔════════════════════════════════════════╗")
    logger.info("║   Solace — Therapist Council Starting  ║")
    logger.info("╚════════════════════════════════════════╝")
    await initialize_clients()
    yield
    await shutdown_clients()
    logger.info("Solace shutdown complete.")


app = FastAPI(
    title="Solace — Therapist Council",
    description="Empathetic real-time voice therapy agent with multimodal memory",
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
app.include_router(voice_ws.router)
app.include_router(journal.router, prefix="/api")


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "solace"}
