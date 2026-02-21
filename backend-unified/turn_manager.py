"""
Unified Backend — Turn Manager
Barge-in vs backchannel detection.
Lifted from backend2/app/turn_manager.py
"""
import logging

logger = logging.getLogger(__name__)

BACKCHANNELS = {
    "uh-huh", "uh huh", "yeah", "yes", "mm", "mhm", "mm-hmm",
    "mmhmm", "okay", "ok", "right", "sure", "i see",
    "go on", "go ahead", "hmm", "hm", "yep", "yup",
}

MIN_INTERRUPT_WORDS = 2


class TurnManager:
    """Manages turn-taking heuristics for barge-in detection."""

    def __init__(self):
        self._last_interrupt_time = 0

    def is_true_interruption(self, transcript: str) -> bool:
        text = transcript.strip().lower()

        if not text:
            return False

        if text in BACKCHANNELS:
            logger.debug(f"Backchannel detected (not interrupt): '{text}'")
            return False

        word_count = len(text.split())
        if word_count < MIN_INTERRUPT_WORDS:
            logger.debug(f"Too short for interrupt ({word_count} words): '{text}'")
            return False

        logger.info(f"True interruption detected: '{text}'")
        return True
