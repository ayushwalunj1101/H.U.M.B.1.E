"""
Unified Backend — TTS Chunk Flusher
Extracted from TherapistCouncil._empathy_and_speak_node.
Buffers streaming LLM tokens and flushes at optimal points for TTS synthesis.
"""
import time
from typing import Optional
from config import FIRST_FLUSH_WORDS, STEADY_FLUSH_WORDS, DEADLINE_FLUSH_MS

# Characters that indicate a natural sentence boundary
SENTENCE_TERMINATORS = frozenset({".", "!", "?"})


class TTSChunker:
    """
    Buffers streaming LLM tokens and determines optimal flush points
    for text-to-speech synthesis.

    Flush heuristics:
    - First chunk: flush at FIRST_FLUSH_WORDS words on sentence boundary (or +4 words hard limit)
    - Subsequent chunks: flush on sentence boundary or at STEADY_FLUSH_WORDS words
    - Deadline: flush if DEADLINE_FLUSH_MS elapsed since last flush regardless of content
    """

    def __init__(
        self,
        first_flush_words: int = FIRST_FLUSH_WORDS,
        steady_flush_words: int = STEADY_FLUSH_WORDS,
        deadline_ms: float = DEADLINE_FLUSH_MS,
    ):
        self._first_flush_words = first_flush_words
        self._steady_flush_words = steady_flush_words
        self._deadline_ms = deadline_ms

        self._buffer: str = ""
        self._is_first_chunk: bool = True
        self._last_flush: float = time.monotonic()

    def feed(self, token: str) -> Optional[str]:
        """
        Feed a single token from the LLM stream.
        Returns the buffered text if a flush is triggered, otherwise None.
        """
        if not token:
            return None

        self._buffer += token
        elapsed_ms = (time.monotonic() - self._last_flush) * 1000
        word_count = len(self._buffer.split())
        is_sentence_end = any(c in token for c in SENTENCE_TERMINATORS)

        should_flush = (
            # First chunk: prefer sentence boundary, hard limit at +4 words
            (self._is_first_chunk and word_count >= self._first_flush_words and is_sentence_end)
            or (self._is_first_chunk and word_count >= self._first_flush_words + 4)
            # Subsequent chunks: flush on sentence boundary
            or (not self._is_first_chunk and is_sentence_end)
            # Subsequent chunks: hard word limit
            or (not self._is_first_chunk and word_count >= self._steady_flush_words)
            # Deadline: always flush if too much time has elapsed
            or elapsed_ms >= self._deadline_ms
        )

        if should_flush and self._buffer.strip():
            return self._flush()

        return None

    def flush(self) -> Optional[str]:
        """Force-flush the remaining buffer. Call at end of stream."""
        if self._buffer.strip():
            return self._flush()
        return None

    def _flush(self) -> str:
        text = self._buffer
        self._buffer = ""
        self._last_flush = time.monotonic()
        self._is_first_chunk = False
        return text

    def reset(self):
        """Reset chunker state for a new stream."""
        self._buffer = ""
        self._is_first_chunk = True
        self._last_flush = time.monotonic()
