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
    mode: Optional[str] = "CUSTOM"


@router.post("/api/get-access-token")
async def get_access_token(req: SessionTokenRequest = SessionTokenRequest()):
    """
    Create a LiveAvatar session token.
    Uses CUSTOM mode — you bring your own STT, LLM, TTS.
    """
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


