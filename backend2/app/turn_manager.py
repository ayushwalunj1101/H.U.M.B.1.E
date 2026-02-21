"""
Solace — Turn Manager
Determines if user speech during bot output is a true interruption
vs. backchanneling ("uh-huh", "yeah", "mm").
"""
import logging

logger = logging.getLogger(__name__)

# Common backchannels — if the transcript is ONLY these, it's not an interrupt
BACKCHANNELS = {
    "uh-huh", "uh huh", "yeah", "yes", "mm", "mhm", "mm-hmm",
    "mmhmm", "okay", "ok", "right", "sure", "i see",
    "go on", "go ahead", "hmm", "hm", "yep", "yup",
}

# Minimum words for a transcript to be considered a true interruption
MIN_INTERRUPT_WORDS = 2


class TurnManager:
    """Manages turn-taking heuristics for barge-in detection."""

    def __init__(self):
        self._last_interrupt_time = 0

    def is_true_interruption(self, transcript: str) -> bool:
        """
        Determine if a user utterance during bot speech is a true interrupt.
        
        Returns True if the user is genuinely trying to interject,
        False if it's backchanneling or noise.
        """
        text = transcript.strip().lower()

        if not text:
            return False

        # Single-word backchannels are not interrupts
        if text in BACKCHANNELS:
            logger.debug(f"Backchannel detected (not interrupt): '{text}'")
            return False

        # Very short utterances are likely backchannels
        word_count = len(text.split())
        if word_count < MIN_INTERRUPT_WORDS:
            logger.debug(f"Too short for interrupt ({word_count} words): '{text}'")
            return False

        # If we get here, it's a real interruption
        logger.info(f"True interruption detected: '{text}'")
        return True
