"""
Unified Backend — Core Therapy Engine
Shared reasoning engine used by BOTH the HTTP/RAG pipeline and WebSocket/Voice flow.
Eliminates behavioral drift between the two paths.
"""
import logging
from typing import List, Optional
from dataclasses import dataclass, field
from rag.council import analyze_user_input, CouncilOutput
from rag.retrieval import retrieve
from rag.generation import generate_voice_response
from rag.citation_formatter import format_citations

logger = logging.getLogger(__name__)


@dataclass
class TherapyResponse:
    """Unified response from the core therapy engine."""
    spoken_answer: str
    citations: list
    council: Optional[CouncilOutput] = None
    retrieved_docs: list = field(default_factory=list)


CRISIS_MESSAGE = (
    "I hear how much pain you are in. Your safety is my top priority. "
    "I cannot provide therapy right now because I am an AI, but there are people ready to help you. "
    "Please call Tele-MANAS at 14416, they are available 24/7 and it's free."
)


class CoreTherapyEngine:
    """
    Unified therapy reasoning pipeline.
    Encapsulates: council analysis → crisis check → RAG retrieval → LLM generation → citations.

    Used by:
    - rag/pipeline.py (HTTP flow for HeyGen avatar)
    - agents/therapist_graph.py (WebSocket voice flow — context enrichment)
    """

    def process(
        self,
        query: str,
        conversation_history: Optional[List[dict]] = None,
    ) -> TherapyResponse:
        """
        Run the full therapy reasoning pipeline synchronously.

        Args:
            query: User's message text
            conversation_history: Previous conversation messages

        Returns:
            TherapyResponse with spoken answer, citations, and council analysis
        """
        history = conversation_history or []

        # Step 1: Analyze mental state
        council_result = analyze_user_input(query)

        # Step 2: Crisis check — short-circuit with safety message
        if council_result.crisis_risk == "high":
            logger.warning(f"Crisis detected for query: '{query[:50]}...'")
            return TherapyResponse(
                spoken_answer=CRISIS_MESSAGE,
                citations=[],
                council=council_result,
                retrieved_docs=[],
            )

        # Step 3: Retrieve relevant documents from FAISS
        docs = retrieve(query, top_k=3)

        # Step 4: Generate voice-optimized response
        state = {
            "user_input": query,
            "conversation_history": history,
            "council_result": council_result,
            "retrieved_docs": docs,
        }
        generation_result = generate_voice_response(state)

        # Step 5: Format citations
        citations = format_citations(docs)

        return TherapyResponse(
            spoken_answer=generation_result["final_response"],
            citations=citations,
            council=council_result,
            retrieved_docs=docs,
        )


# Module-level singleton
_engine = CoreTherapyEngine()


def get_engine() -> CoreTherapyEngine:
    """Get the shared CoreTherapyEngine instance."""
    return _engine
