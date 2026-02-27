"""
Unified Backend — JWT Authentication Middleware
Provides FastAPI dependencies for protecting HTTP and WebSocket endpoints.
"""
import logging
import time
from typing import Optional
from fastapi import Depends, HTTPException, WebSocket, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import JWT_SECRET, JWT_ALGORITHM

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

# ── Lightweight JWT Implementation (no external deps) ──
# Uses HMAC-SHA256 for signing. For production, swap to python-jose or PyJWT.

import hashlib
import hmac
import base64
import json


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(s: str) -> bytes:
    padding = 4 - len(s) % 4
    if padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s)


def create_jwt(payload: dict, expires_in: int = 86400) -> str:
    """Create a simple HMAC-SHA256 JWT token."""
    header = {"alg": JWT_ALGORITHM, "typ": "JWT"}
    payload = {**payload, "exp": int(time.time()) + expires_in, "iat": int(time.time())}

    segments = [
        _b64url_encode(json.dumps(header).encode()),
        _b64url_encode(json.dumps(payload).encode()),
    ]
    signing_input = ".".join(segments).encode()
    signature = hmac.new(JWT_SECRET.encode(), signing_input, hashlib.sha256).digest()
    segments.append(_b64url_encode(signature))

    return ".".join(segments)


def verify_jwt(token: str) -> Optional[dict]:
    """Verify and decode a HMAC-SHA256 JWT token. Returns payload or None."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None

        signing_input = f"{parts[0]}.{parts[1]}".encode()
        expected_sig = hmac.new(JWT_SECRET.encode(), signing_input, hashlib.sha256).digest()
        actual_sig = _b64url_decode(parts[2])

        if not hmac.compare_digest(expected_sig, actual_sig):
            logger.warning("JWT signature verification failed")
            return None

        payload = json.loads(_b64url_decode(parts[1]))

        if payload.get("exp", 0) < time.time():
            logger.warning("JWT token expired")
            return None

        return payload
    except Exception as e:
        logger.warning(f"JWT decode error: {e}")
        return None


# ── FastAPI Dependencies ──

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """FastAPI dependency — extracts and validates JWT from Authorization header."""
    if not JWT_SECRET or JWT_SECRET == "change-me-in-production":
        # Auth disabled in dev mode — return anonymous user
        return {"user_id": "anonymous", "role": "user"}

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = verify_jwt(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload


async def ws_auth(websocket: WebSocket, token: Optional[str] = None) -> Optional[dict]:
    """
    WebSocket auth helper.
    Returns user payload if valid, or closes the WebSocket and returns None.
    """
    if not JWT_SECRET or JWT_SECRET == "change-me-in-production":
        return {"user_id": "anonymous", "role": "user"}

    if not token:
        logger.warning("WebSocket connection rejected: no token provided")
        await websocket.close(code=1008, reason="Missing authentication token")
        return None

    payload = verify_jwt(token)
    if payload is None:
        logger.warning("WebSocket connection rejected: invalid token")
        await websocket.close(code=1008, reason="Invalid or expired token")
        return None

    return payload
