"""
Solace — Memory Service
MongoDB CRUD + Atlas Vector Search for semantic memory retrieval.
Stores every conversation turn with embeddings for vector search.
"""
import time
import asyncio
import logging
from app.services.singletons import get_db
from app.services.embedding_service import get_embedding
from app.config import VECTOR_SEARCH_INDEX, MEMORY_RELEVANCE_THRESHOLD

logger = logging.getLogger(__name__)


async def save_turn(turn: dict):
    """Save a conversation turn with its embedding for vector search."""
    db = get_db()
    if db is None:
        return
    try:
        combined_text = f"{turn['user_message']} {turn['assistant_message']}"
        turn["embedding"] = await get_embedding(combined_text)
        turn["summary"] = _summarize_turn(turn)
        turn["timestamp"] = turn.get("timestamp", time.time())
        await db["turns"].insert_one(turn)
        logger.debug(f"Turn saved for user {turn.get('user_id')}")
    except Exception as e:
        logger.error(f"Failed to save turn: {e}")


async def fetch_relevant_context(query: str, user_id: str, top_k: int = 5) -> list:
    """
    Atlas Vector Search — finds semantically similar past turns.
    Uses pre-computed embeddings, sub-50ms retrieval.
    """
    db = get_db()
    if db is None:
        return []

    try:
        query_embedding = await get_embedding(query)

        pipeline = [
            {
                "$vectorSearch": {
                    "index": VECTOR_SEARCH_INDEX,
                    "path": "embedding",
                    "queryVector": query_embedding,
                    "numCandidates": 50,
                    "limit": top_k,
                    "filter": {"user_id": user_id},
                }
            },
            {
                "$project": {
                    "summary": 1,
                    "timestamp": 1,
                    "score": {"$meta": "vectorSearchScore"},
                    "_id": 0,
                }
            },
        ]

        results = []
        async for doc in db["turns"].aggregate(pipeline):
            if doc.get("score", 0) > MEMORY_RELEVANCE_THRESHOLD:
                results.append(doc)
        return results
    except Exception as e:
        logger.error(f"Vector search failed: {e}")
        return []


async def get_latest_behavioral_summary(user_id: str) -> str | None:
    """Fetch the most recent Gemini journal analysis for this user."""
    db = get_db()
    if db is None:
        return None
    try:
        doc = await db["journal_analyses"].find_one(
            {"user_id": user_id}, sort=[("analyzed_at", -1)]
        )
        return doc.get("behavioral_summary") if doc else None
    except Exception as e:
        logger.error(f"Failed to fetch behavioral summary: {e}")
        return None


async def save_journal_analysis(user_id: str, analysis: dict):
    """Save a Gemini journal analysis result."""
    db = get_db()
    if db is None:
        return
    try:
        analysis["user_id"] = user_id
        analysis["analyzed_at"] = time.time()
        await db["journal_analyses"].insert_one(analysis)
        logger.info(f"Journal analysis saved for user {user_id}")
    except Exception as e:
        logger.error(f"Failed to save journal analysis: {e}")


def _summarize_turn(turn: dict) -> str:
    return f"User said: '{turn['user_message'][:80]}...' | Agent: '{turn['assistant_message'][:80]}...'"
