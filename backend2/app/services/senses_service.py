"""
Solace — The Senses (Gemini 2.5 Flash Multimodal Pipeline)
Processes uploaded journal videos/audio asynchronously.
Extracts: tone, pace, emotional indicators, behavioral patterns.
Runs ASYNC — never blocks the voice loop.
"""
import asyncio
import base64
import json
import logging
import os
import tempfile
from google import genai
from google.genai import types
from app.services import memory_service
from app.config import GEMINI_API_KEY

logger = logging.getLogger(__name__)

ANALYSIS_PROMPT = """
You are a compassionate clinical psychologist analyzing a user's journal entry.
Analyze the provided audio/video and return a JSON object with:

{
  "emotional_state": "calm|anxious|sad|agitated|neutral|elevated",
  "speech_rate": "slow|normal|fast|very_fast",
  "vocal_energy": "low|moderate|high",
  "behavioral_observations": ["list", "of", "specific", "observations"],
  "themes": ["recurring", "topics", "or", "concerns"],
  "risk_indicators": [],
  "behavioral_summary": "2-3 sentence plain English summary for a therapist",
  "recommended_focus": "What the therapy session should gently explore"
}

Be precise, clinically grounded, and compassionate. Never assume.
Return ONLY valid JSON, no markdown.
"""

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


async def process_journal_upload(
    user_id: str, file_bytes: bytes, mime_type: str
) -> dict:
    """
    Process a journal video or audio file with Gemini 2.5 Flash.
    This runs in the background — the user doesn't wait for this.
    """
    logger.info(f"[Senses] Processing journal for user {user_id} ({mime_type})...")

    try:
        client = _get_client()

        # For large files, use File API; for small, inline
        if len(file_bytes) > 5 * 1024 * 1024:  # > 5MB
            analysis = await _process_large_file(client, file_bytes, mime_type)
        else:
            analysis = await _process_inline(client, file_bytes, mime_type)

        # Save to MongoDB
        await memory_service.save_journal_analysis(user_id, analysis)
        logger.info(
            f"[Senses] Analysis complete for user {user_id}: {analysis.get('emotional_state', 'unknown')}"
        )
        return analysis

    except Exception as e:
        logger.error(f"[Senses] Analysis failed for user {user_id}: {e}")
        return {"error": str(e)}


async def _process_inline(client, file_bytes: bytes, mime_type: str) -> dict:
    """Process small files inline (< 5MB)."""
    b64 = base64.b64encode(file_bytes).decode()

    response = await asyncio.to_thread(
        client.models.generate_content,
        model="gemini-2.5-flash",
        contents=[
            types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
            ANALYSIS_PROMPT,
        ],
    )

    raw = response.text.strip()
    # Handle potential markdown wrapping
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return json.loads(raw)


async def _process_large_file(client, file_bytes: bytes, mime_type: str) -> dict:
    """Process large files via Gemini File API (> 5MB)."""
    ext_map = {
        "video/webm": ".webm",
        "video/mp4": ".mp4",
        "video/quicktime": ".mov",
        "audio/webm": ".webm",
        "audio/ogg": ".ogg",
        "audio/mpeg": ".mp3",
        "audio/wav": ".wav",
    }
    ext = ext_map.get(mime_type, ".webm")

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
        f.write(file_bytes)
        tmp_path = f.name

    try:
        uploaded_file = await asyncio.to_thread(
            client.files.upload, file=tmp_path, config={"mime_type": mime_type}
        )

        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-2.5-flash",
            contents=[uploaded_file, ANALYSIS_PROMPT],
        )

        raw = response.text.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        return json.loads(raw)
    finally:
        os.unlink(tmp_path)
