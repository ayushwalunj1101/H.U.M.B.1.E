"""
Unified Backend — Embedding Service
Text → 768-dim embeddings via Google GenAI text-embedding-004.
Lifted from backend2/app/services/embedding_service.py
"""
import asyncio
import logging
from google import genai
from config import GEMINI_API_KEY

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


async def get_embedding(text: str) -> list[float]:
    """Generate a 768-dim embedding using Gemini text-embedding-004."""
    try:
        client = _get_client()
        result = await asyncio.to_thread(
            client.models.embed_content,
            model="text-embedding-004",
            contents=text,
        )
        return result.embeddings[0].values
    except Exception as e:
        logger.error(f"Embedding generation failed: {e}")
        return [0.0] * 768
