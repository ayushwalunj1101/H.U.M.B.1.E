"""
Unified Backend — Rate Limiter Middleware
In-memory token bucket rate limiter per client IP.
For production with multiple workers, swap to Redis-based (e.g., slowapi + Redis).
"""
import asyncio
import logging
import time
from typing import Dict, Tuple
from fastapi import Request, HTTPException, status
from config import RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW_SECONDS

logger = logging.getLogger(__name__)


class TokenBucket:
    """Simple token bucket rate limiter."""

    def __init__(self, max_tokens: int, refill_seconds: float):
        self._buckets: Dict[str, Tuple[float, float]] = {}  # key -> (tokens, last_refill)
        self._max_tokens = max_tokens
        self._refill_rate = max_tokens / refill_seconds
        self._lock = asyncio.Lock()
        self._max_tokens_float = float(max_tokens)

    async def consume(self, key: str) -> bool:
        """Try to consume one token. Returns True if allowed, False if rate-limited."""
        async with self._lock:
            now = time.monotonic()

            if key not in self._buckets:
                self._buckets[key] = (self._max_tokens_float - 1.0, now)
                return True

            tokens, last_refill = self._buckets[key]
            elapsed = now - last_refill
            tokens = min(self._max_tokens_float, tokens + elapsed * self._refill_rate)

            if tokens < 1.0:
                self._buckets[key] = (tokens, now)
                return False

            self._buckets[key] = (tokens - 1.0, now)
            return True

    async def cleanup_stale(self, max_age_seconds: float = 3600.0):
        """Remove stale entries to prevent memory growth."""
        async with self._lock:
            now = time.monotonic()
            stale_keys = [
                k for k, (_, last) in self._buckets.items()
                if now - last > max_age_seconds
            ]
            for k in stale_keys:
                del self._buckets[k]


_limiter = TokenBucket(
    max_tokens=RATE_LIMIT_REQUESTS,
    refill_seconds=RATE_LIMIT_WINDOW_SECONDS,
)


def _get_client_ip(request: Request) -> str:
    """Extract client IP, respecting X-Forwarded-For behind a reverse proxy."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


async def check_rate_limit(request: Request) -> None:
    """
    FastAPI dependency — raises 429 if the client exceeds the rate limit.
    Usage: router.post("/endpoint", dependencies=[Depends(check_rate_limit)])
    """
    client_ip = _get_client_ip(request)
    allowed = await _limiter.consume(client_ip)

    if not allowed:
        logger.warning(f"Rate limit exceeded for {client_ip}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please slow down.",
            headers={"Retry-After": str(RATE_LIMIT_WINDOW_SECONDS)},
        )
