"""
Solace — Singleton Client Pool
Initialize all SDK clients ONCE at server startup.
Never recreate clients per-session.
"""
import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from groq import AsyncGroq
from app.config import DEEPGRAM_API_KEY, GROQ_API_KEY, MONGODB_URI

logger = logging.getLogger(__name__)

_groq_client: AsyncGroq | None = None
_mongo_client: AsyncIOMotorClient | None = None
_db = None


async def initialize_clients():
    """Call once at FastAPI lifespan startup."""
    global _groq_client, _mongo_client, _db

    # Groq (Llama-3)
    _groq_client = AsyncGroq(api_key=GROQ_API_KEY)
    logger.info("✓ Groq client initialized")

    # MongoDB Atlas (graceful — don't crash if not configured)
    try:
        if "user:pass" in MONGODB_URI or not MONGODB_URI:
            logger.warning("⚠ MongoDB URI is a placeholder — memory features disabled")
        else:
            _mongo_client = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
            _db = _mongo_client["solace"]
            # Quick ping to verify connection
            await _mongo_client.admin.command("ping")
            # Ensure indexes
            await _db["turns"].create_index([("user_id", 1), ("timestamp", -1)])
            await _db["journal_analyses"].create_index([("user_id", 1), ("analyzed_at", -1)])
            logger.info("✓ MongoDB client initialized")
    except Exception as e:
        logger.warning(f"⚠ MongoDB connection failed: {e} — memory features disabled")

    logger.info("✓ All clients ready")


async def shutdown_clients():
    """Call at FastAPI lifespan shutdown."""
    global _mongo_client
    if _mongo_client:
        _mongo_client.close()
        logger.info("MongoDB client closed")


def get_groq() -> AsyncGroq:
    if _groq_client is None:
        raise RuntimeError("Clients not initialized — call initialize_clients() first")
    return _groq_client


def get_db():
    return _db  # Returns None if not configured
