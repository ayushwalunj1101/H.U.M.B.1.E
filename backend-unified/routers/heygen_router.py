"""
Unified Backend — LiveAvatar Token Router
Proxies session token requests to HeyGen's LiveAvatar API.
Supports API key rotation for demo survivability with trial credits.
"""
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx
from config import HEYGEN_API_KEY

router = APIRouter()
logger = logging.getLogger(__name__)

# LiveAvatar API (NOT the old api.heygen.com)
LIVEAVATAR_TOKEN_URL = "https://api.liveavatar.com/v1/sessions/token"
LIVEAVATAR_START_URL = "https://api.liveavatar.com/v1/sessions/start"

# Default avatar ID
DEFAULT_AVATAR_ID = "513fd1b7-7ef9-466d-9af2-344e51eeb833"

# ── API Key Rotation ──
_all_keys = [k.strip() for k in HEYGEN_API_KEY.split(",") if k.strip()] if HEYGEN_API_KEY else []
_current_key_index = 0


def _get_current_key() -> str:
    if not _all_keys:
        return ""
    return _all_keys[_current_key_index % len(_all_keys)]


def _rotate_key() -> str:
    global _current_key_index
    if len(_all_keys) <= 1:
        return _get_current_key()
    old_index = _current_key_index
    _current_key_index = (_current_key_index + 1) % len(_all_keys)
    logger.warning(f"LiveAvatar API key rotated: slot {old_index} → {_current_key_index}")
    return _all_keys[_current_key_index]


class SessionTokenRequest(BaseModel):
    avatar_id: Optional[str] = None
    mode: Optional[str] = "LITE"


@router.post("/api/get-access-token")
async def get_access_token(req: SessionTokenRequest = SessionTokenRequest()):
    """
    Create a LiveAvatar session token.
    Automatically stops any orphaned active session first to avoid concurrency limit.
    """
    # 1. Force stop the previous orphaned session
    old_token = _active_session.get("session_token")
    if old_token:
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    "https://api.liveavatar.com/v1/sessions/stop",
                    headers={"Authorization": f"Bearer {old_token}"},
                    timeout=5.0
                )
            logger.info("Successfully stopped orphaned LiveAvatar session.")
        except Exception as e:
            logger.warning(f"Failed to stop old orphaned session (might be expired): {e}")
        
        # Clear it from tracking
        _active_session["session_id"] = None
        _active_session["session_token"] = None

    current_key = _get_current_key()
    if not current_key:
        raise HTTPException(
            status_code=500,
            detail="HEYGEN_API_KEY not configured. Set it in your .env file.",
        )

    avatar_id = req.avatar_id or DEFAULT_AVATAR_ID
    keys_tried = 0
    max_attempts = len(_all_keys)

    while keys_tried < max_attempts:
        try:
            async with httpx.AsyncClient() as client:
                # Step 1: Create session token
                response = await client.post(
                    LIVEAVATAR_TOKEN_URL,
                    headers={
                        "X-API-KEY": current_key,
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                    },
                    json={
                        "mode": req.mode or "CUSTOM",
                        "avatar_id": avatar_id,
                    },
                    timeout=15.0,
                )
                response.raise_for_status()
                data = response.json()

                # Debug: log full response to find the correct field
                logger.info(f"LiveAvatar API response: {data}")

                # Try multiple response formats
                session_token = (
                    data.get("session_token")
                    or data.get("data", {}).get("session_token")
                    or data.get("token")
                    or data.get("data", {}).get("token")
                )
                session_id = (
                    data.get("session_id")
                    or data.get("data", {}).get("session_id")
                )

                if not session_token:
                    raise HTTPException(
                        status_code=502,
                        detail=f"LiveAvatar API did not return a session token. Response: {data}",
                    )

                # Store active session for speak commands
                _active_session["session_id"] = session_id
                _active_session["session_token"] = session_token

                logger.info(f"LiveAvatar session created: {session_id}")
                return {
                    "token": session_token,
                    "session_id": session_id,
                    "session_token": session_token,
                }

        except httpx.HTTPStatusError as e:
            status_code = e.response.status_code

            if status_code in (402, 429) and len(_all_keys) > 1:
                logger.warning(f"LiveAvatar key exhausted (HTTP {status_code}), rotating...")
                current_key = _rotate_key()
                keys_tried += 1
                continue

            error_body = e.response.text
            logger.error(f"LiveAvatar API error: {status_code} — {error_body}")
            raise HTTPException(
                status_code=status_code,
                detail=f"LiveAvatar API error: {error_body}",
            )

        except httpx.RequestError as e:
            logger.error(f"LiveAvatar connection error: {e}")
            raise HTTPException(
                status_code=503,
                detail="Could not reach LiveAvatar API.",
            )

    raise HTTPException(
        status_code=402,
        detail="All LiveAvatar API keys exhausted. Please add more credits.",
    )


@router.post("/api/cleanup-sessions")
async def cleanup_sessions():
    """
    Forcefully close all active sessions for the current API key.
    Useful when the 'concurrent session limit' is reached due to unclosed tabs.
    """
    current_key = _get_current_key()
    if not current_key:
        raise HTTPException(status_code=500, detail="API key missing")

    try:
        async with httpx.AsyncClient() as client:
            # 1. Fetch active sessions (HeyGen API undocumented route, but standard REST pattern)
            # If there's no list endpoint, we can't easily fetch them. 
            # We will return instructions to the user on how to handle this.
            return {"status": "Manual cleanup required via HeyGen dashboard or wait 5 minutes for auto-timeout."}
    except Exception as e:
        logger.error(f"Cleanup error: {e}")
        return {"status": "error", "message": str(e)}

# ── Active Session Tracking ──
_active_session: dict = {"session_id": None, "session_token": None}


class SpeakRequest(BaseModel):
    text: str
    session_id: Optional[str] = None


@router.post("/api/speak")
async def speak_to_avatar(req: SpeakRequest):
    """
    Send text to the LiveAvatar — the avatar will speak it with lip sync.
    Uses the active session from the last get-access-token call.
    """
    session_token = _active_session.get("session_token")
    session_id = req.session_id or _active_session.get("session_id")

    if not session_token or not session_id:
        raise HTTPException(status_code=400, detail="No active session. Start a session first.")

    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    try:
        async with httpx.AsyncClient() as client:
            # Try the LiveAvatar text input endpoint
            response = await client.post(
                f"https://api.liveavatar.com/v1/sessions/{session_id}/text",
                headers={
                    "Authorization": f"Bearer {session_token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                json={"text": req.text},
                timeout=15.0,
            )

            logger.info(f"LiveAvatar speak response ({response.status_code}): {response.text}")

            if response.status_code == 404:
                # Try alternative endpoint
                response = await client.post(
                    f"https://api.liveavatar.com/v1/sessions/{session_id}/speak",
                    headers={
                        "Authorization": f"Bearer {session_token}",
                        "Content-Type": "application/json",
                    },
                    json={"text": req.text},
                    timeout=15.0,
                )
                logger.info(f"LiveAvatar speak alt response ({response.status_code}): {response.text}")

            response.raise_for_status()
            return {"status": "ok", "session_id": session_id}

    except httpx.HTTPStatusError as e:
        logger.error(f"LiveAvatar speak error: {e.response.status_code} — {e.response.text}")
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"LiveAvatar speak error: {e.response.text}",
        )
    except httpx.RequestError as e:
        logger.error(f"LiveAvatar speak connection error: {e}")
        raise HTTPException(status_code=503, detail="Could not reach LiveAvatar API.")


class RagSpeakRequest(BaseModel):
    query: str
    conversation_history: list = []


@router.post("/api/rag-speak")
async def rag_speak(req: RagSpeakRequest):
    """
    Combined endpoint: Query RAG → Make avatar speak the response.
    Single call from frontend — no round-trips.
    """
    from rag.pipeline import run_pipeline

    try:
        # 1. Run RAG pipeline
        result = run_pipeline(req.query, req.conversation_history)
        spoken_answer = result.get("spoken_answer", "")

        if not spoken_answer:
            spoken_answer = "I'm not sure how to help with that. Could you tell me more?"

        # 2. Make avatar speak the RAG response
        session_token = _active_session.get("session_token")
        session_id = _active_session.get("session_id")

        if session_token and session_id:
            try:
                async with httpx.AsyncClient() as client:
                    # Try sending text to the avatar
                    for endpoint in [
                        f"https://api.liveavatar.com/v1/sessions/{session_id}/text",
                        f"https://api.liveavatar.com/v1/sessions/{session_id}/speak",
                    ]:
                        response = await client.post(
                            endpoint,
                            headers={
                                "Authorization": f"Bearer {session_token}",
                                "Content-Type": "application/json",
                            },
                            json={"text": spoken_answer},
                            timeout=15.0,
                        )
                        if response.status_code != 404:
                            logger.info(f"Avatar speak via {endpoint}: {response.status_code}")
                            break
            except Exception as e:
                logger.warning(f"Avatar speak failed (response still returned): {e}")

        return {
            "spoken_answer": spoken_answer,
            "citations": result.get("citations", []),
            "council": result.get("council"),
            "avatar_spoke": bool(session_token and session_id),
        }

    except Exception as e:
        logger.error(f"RAG-speak error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
