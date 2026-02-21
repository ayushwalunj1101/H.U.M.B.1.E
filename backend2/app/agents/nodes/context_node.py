"""
Solace — Context Node
Fetches memory and behavioral data to build enriched prompt context.
"""
import logging

logger = logging.getLogger(__name__)


async def context_node(state: dict) -> dict:
    """
    Build the enriched prompt context from memories + behavioral data.
    This runs before the empathy node to inject past context.
    """
    memory_block = ""
    if state.get("retrieved_memories"):
        memory_block = "## Relevant Past Sessions\n"
        for m in state["retrieved_memories"]:
            timestamp = m.get("timestamp", "unknown")
            summary = m.get("summary", "")
            memory_block += f"- [{timestamp}] {summary}\n"

    behavioral_block = ""
    if state.get("behavioral_summary"):
        behavioral_block = (
            f"\n## Recent Behavioral Observations (from journal)\n"
            f"{state['behavioral_summary']}"
        )

    state["context_block"] = memory_block + behavioral_block
    logger.debug(f"Context built: {len(memory_block)} chars memory, {len(behavioral_block)} chars behavioral")
    return state
