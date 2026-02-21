"""
Unified Backend — RAG Router
HTTP endpoint for HeyGen avatar flow.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from rag.pipeline import run_rag_pipeline

router = APIRouter()


class Message(BaseModel):
    role: str
    content: str


class RAGRequest(BaseModel):
    query: str
    conversation_history: Optional[List[Message]] = []


class Citation(BaseModel):
    source_name: str
    chunk_id: str = ""
    relevance_rank: int = 1
    page: Optional[int] = None


class RAGResponse(BaseModel):
    spoken_answer: str
    citations: List[dict]
    council: Optional[dict] = None


@router.post("/api/rag", response_model=RAGResponse)
async def rag_query(req: RAGRequest):
    """
    RAG endpoint for HeyGen avatar voice flow.
    Accepts query + conversation history, returns spoken answer + citations.
    """
    history = [msg.dict() for msg in req.conversation_history] if req.conversation_history else []

    result = run_rag_pipeline(
        query=req.query,
        conversation_history=history,
    )

    return RAGResponse(
        spoken_answer=result["spoken_answer"],
        citations=result["citations"],
        council=result.get("council"),
    )
