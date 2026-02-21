"""
Solace — Session Context
Uses asyncio.Event for cross-coroutine interrupt signaling (not plain booleans).
"""
import asyncio
import logging
import time

logger = logging.getLogger(__name__)


class SessionContext:
    """
    Holds per-connection state for a voice session.
    Uses asyncio.Event for reliable cross-coroutine signaling.
    """

    def __init__(self, user_id: str):
        self.user_id = user_id
        self.session_id = f"{user_id}_{int(time.time())}"
        self.history: list[dict] = []

        # -- Async events for interrupt signaling --
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
        """Signal a barge-in interrupt — stop all output pipelines."""
        self._interrupt_event.set()
        self._speaking_event.clear()
        logger.warning(f"INTERRUPT — session {self.session_id}")

    async def clear_interrupt(self):
        """Clear the interrupt flag for a new turn."""
        self._interrupt_event.clear()

    async def set_speaking(self, value: bool):
        """Set whether the bot is currently speaking."""
        if value:
            self._speaking_event.set()
        else:
            self._speaking_event.clear()

    async def cleanup(self):
        """Clean up session resources on disconnect."""
        self._connected = False
        self._speaking_event.clear()
        self._interrupt_event.clear()
        logger.info(f"Session cleaned up: {self.session_id}")
