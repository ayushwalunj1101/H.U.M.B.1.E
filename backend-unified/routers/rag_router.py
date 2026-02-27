"""
Unified Backend — RAG Router
HTTP endpoint for HeyGen avatar flow.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
from rag.pipeline import run_rag_pipeline
from middleware.auth import get_current_user
from middleware.rate_limiter import check_rate_limit

router = APIRouter()


class Message(BaseModel):
    role: str
    content: str


class RAGRequest(BaseModel):
    query: str
    conversation_history: Optional[List[Message]] = None  # Fixed: was `= []` (mutable default)


class Citation(BaseModel):
    source_name: str
    chunk_id: str = ""
    relevance_rank: int = 1
    page: Optional[int] = None


class RAGResponse(BaseModel):
    spoken_answer: str
    citations: List[dict]
    council: Optional[dict] = None


@router.post(
    "/api/rag",
    response_model=RAGResponse,
    dependencies=[Depends(check_rate_limit)],
)
async def rag_query(req: RAGRequest, user: dict = Depends(get_current_user)):
    """
    RAG endpoint for HeyGen avatar voice flow.
    Accepts query + conversation history, returns spoken answer + citations.
    Requires valid JWT token (bypassed in dev mode when JWT_SECRET is default).
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
