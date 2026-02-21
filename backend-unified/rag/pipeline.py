"""
Unified Backend — RAG Pipeline
LangGraph state machine: council → retrieval → generation.
Simplified from backend/graph.py (removed refine step for voice brevity).
"""
from typing import TypedDict, List, Any, Optional
from langgraph.graph import StateGraph, END
from rag.council import analyze_user_input, CouncilOutput
from rag.retrieval import retrieve
from rag.generation import generate_voice_response, llm
from rag.citation_formatter import format_citations
from langchain_core.prompts import ChatPromptTemplate


class RAGState(TypedDict):
    user_input: str
    conversation_history: list
    council_result: Optional[CouncilOutput]
    retrieved_docs: List[Any]
    final_response: str
    citations: list


def council_node(state: RAGState):
    """Analyze user input for mental state classification."""
    return {"council_result": analyze_user_input(state["user_input"])}


def retrieval_node(state: RAGState):
    """Retrieve relevant documents from FAISS."""
    docs = retrieve(state["user_input"], top_k=3)
    return {"retrieved_docs": docs}


def generation_node(state: RAGState):
    """Generate voice-optimized response."""
    result = generate_voice_response(state)
    return {"final_response": result["final_response"]}


def citation_node(state: RAGState):
    """Format citations from retrieved documents."""
    citations = format_citations(state.get("retrieved_docs", []))
    return {"citations": citations}


def crisis_node(state: RAGState):
    """Hard-coded safety override for crisis situations."""
    msg = (
        "I hear how much pain you are in. Your safety is my top priority. "
        "I cannot provide therapy right now because I am an AI, but there are people ready to help you. "
        "Please call Tele-MANAS at 14416, they are available 24/7 and it's free."
    )
    return {"final_response": msg, "retrieved_docs": [], "citations": []}


def route_logic(state: RAGState):
    """Route based on crisis detection."""
    if state["council_result"].crisis_risk == "high":
        return "crisis_node"
    return "retrieval_node"


# Build the graph
workflow = StateGraph(RAGState)
workflow.add_node("council_node", council_node)
workflow.add_node("retrieval_node", retrieval_node)
workflow.add_node("generation_node", generation_node)
workflow.add_node("citation_node", citation_node)
workflow.add_node("crisis_node", crisis_node)

workflow.set_entry_point("council_node")
workflow.add_conditional_edges(
    "council_node",
    route_logic,
    {"crisis_node": "crisis_node", "retrieval_node": "retrieval_node"},
)
workflow.add_edge("retrieval_node", "generation_node")
workflow.add_edge("generation_node", "citation_node")
workflow.add_edge("citation_node", END)
workflow.add_edge("crisis_node", END)

rag_graph = workflow.compile()


def run_rag_pipeline(query: str, conversation_history: list = None) -> dict:
    """
    Run the full RAG pipeline.
    Returns: { spoken_answer: str, citations: list, council: dict }
    """
    state = rag_graph.invoke({
        "user_input": query,
        "conversation_history": conversation_history or [],
        "council_result": None,
        "retrieved_docs": [],
        "final_response": "",
        "citations": [],
    })

    return {
        "spoken_answer": state["final_response"],
        "citations": state["citations"],
        "council": state["council_result"].dict() if state.get("council_result") else None,
    }
