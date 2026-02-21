"""
Solace — Memory Node
Persists conversation turns to MongoDB (non-blocking).
"""
import asyncio
import time
import logging
from app.services import memory_service

logger = logging.getLogger(__name__)


async def memory_node(state: dict) -> dict:
    """
    Persist this turn to MongoDB.
    Runs in background — fire and forget.
    """
    if not state.get("response_text"):
        return state

    turn = {
        "user_id": state["user_id"],
        "user_message": state["current_transcript"],
        "assistant_message": state["response_text"],
        "timestamp": time.time(),
        "behavioral_context": state.get("behavioral_summary"),
    }

    # Fire and forget — don't block the voice pipeline
    asyncio.create_task(memory_service.save_turn(turn))
    logger.debug(f"Memory node: turn queued for persistence")

    return state
