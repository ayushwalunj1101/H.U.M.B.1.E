"""
Unified Backend — Session Context
Per-connection state with asyncio.Event for interrupt signaling.
Lifted from backend2/app/session.py
"""
import asyncio
import logging
import time

logger = logging.getLogger(__name__)


class SessionContext:
    """Holds per-connection state for a voice session."""

    def __init__(self, user_id: str):
        self.user_id = user_id
        self.session_id = f"{user_id}_{int(time.time())}"
        self.history: list[dict] = []

        self._speaking_event = asyncio.Event()
        self._interrupt_event = asyncio.Event()
        self._connected = True

        self.created_at = time.time()
        logger.info(f"Session created: {self.session_id}")

    @property
    def is_speaking(self) -> bool:
        return self._speaking_event.is_set()

    @property
    def is_interrupted(self) -> bool:
        return self._interrupt_event.is_set()

    async def trigger_interrupt(self):
        self._interrupt_event.set()
        self._speaking_event.clear()
        logger.warning(f"INTERRUPT — session {self.session_id}")

    async def clear_interrupt(self):
        self._interrupt_event.clear()

    async def set_speaking(self, value: bool):
        if value:
            self._speaking_event.set()
        else:
            self._speaking_event.clear()

    async def cleanup(self):
        self._connected = False
        self._speaking_event.clear()
        self._interrupt_event.clear()
        logger.info(f"Session cleaned up: {self.session_id}")
