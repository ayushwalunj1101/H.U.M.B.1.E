"""
Unified Backend — RAG Pipeline
Delegates to CoreTherapyEngine for unified reasoning.
Previously maintained a separate LangGraph state machine — now unified
to prevent behavioral drift between HTTP and WebSocket flows.
"""
from agents.core_engine import get_engine


def run_rag_pipeline(query: str, conversation_history: list = None) -> dict:
    """
    Run the full RAG pipeline via the shared CoreTherapyEngine.
    Returns: { spoken_answer: str, citations: list, council: dict }
    """
    engine = get_engine()
    result = engine.process(
        query=query,
        conversation_history=conversation_history,
    )

    return {
        "spoken_answer": result.spoken_answer,
        "citations": result.citations,
        "council": result.council.dict() if result.council else None,
    }

