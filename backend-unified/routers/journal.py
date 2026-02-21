"""
Unified Backend — Journal Upload REST Endpoint
Lifted from backend2/app/routers/journal.py
"""
from fastapi import APIRouter, UploadFile, File, BackgroundTasks
from services.senses_service import process_journal_upload

router = APIRouter()

ALLOWED_TYPES = {
    "audio/webm", "audio/ogg", "audio/mpeg", "audio/wav",
    "video/webm", "video/mp4", "video/quicktime",
}


@router.post("/journal/upload/{user_id}")
async def upload_journal(
    user_id: str,
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Upload a journal video or audio file for Gemini multimodal analysis."""
    if file.content_type not in ALLOWED_TYPES:
        return {"error": f"Unsupported file type: {file.content_type}"}

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        return {"error": "Empty file"}

    background_tasks.add_task(
        process_journal_upload, user_id, file_bytes, file.content_type
    )

    return {
        "status": "processing",
        "message": "Your journal is being analyzed. Insights will be ready in your next session.",
        "file_size": len(file_bytes),
        "file_type": file.content_type,
    }
