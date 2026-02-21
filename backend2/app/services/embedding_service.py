"""
Solace — Embedding Service
Text → 768-dim embeddings via Google GenAI text-embedding-004.
"""
import asyncio
import logging
from google import genai
from app.config import GEMINI_API_KEY

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


async def get_embedding(text: str) -> list[float]:
    """
    Generate a 768-dim embedding for the given text.
    Uses Gemini text-embedding-004 model.
    """
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
        # Return zero vector as fallback — don't block the pipeline
        return [0.0] * 768
