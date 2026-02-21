"""
Unified Backend — HeyGen Token Router
Proxies access token requests to HeyGen API.
"""
import logging
from fastapi import APIRouter, HTTPException
import httpx
from config import HEYGEN_API_KEY

router = APIRouter()
logger = logging.getLogger(__name__)

HEYGEN_TOKEN_URL = "https://api.heygen.com/v1/streaming.create_token"


@router.post("/api/get-access-token")
async def get_access_token():
    """
    Fetch a streaming access token from HeyGen.
    Keeps HEYGEN_API_KEY server-side.
    """
    if not HEYGEN_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="HEYGEN_API_KEY not configured. Set it in your .env file.",
        )

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                HEYGEN_TOKEN_URL,
                headers={"x-api-key": HEYGEN_API_KEY},
                timeout=10.0,
            )
            response.raise_for_status()
            data = response.json()

            token = data.get("data", {}).get("token")
            if not token:
                raise HTTPException(
                    status_code=502,
                    detail="HeyGen API did not return a valid token.",
                )

            return {"token": token}

    except httpx.HTTPStatusError as e:
        logger.error(f"HeyGen API error: {e.response.status_code} — {e.response.text}")
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"HeyGen API error: {e.response.text}",
        )
    except httpx.RequestError as e:
        logger.error(f"HeyGen connection error: {e}")
        raise HTTPException(
            status_code=503,
            detail="Could not reach HeyGen API.",
        )
