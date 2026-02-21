"""
Solace — Voice Activity Detection
WebRTCVAD with energy-based fallback.
"""
import logging
import struct
import numpy as np

logger = logging.getLogger(__name__)

# Try to import webrtcvad — fall back to energy-based if unavailable
try:
    import webrtcvad

    _HAS_WEBRTCVAD = True
except ImportError:
    _HAS_WEBRTCVAD = False
    logger.warning("webrtcvad not available — using energy-based VAD fallback")


class VoiceActivityDetector:
    """
    Detects voice activity in audio frames.
    Uses WebRTCVAD when available, falls back to energy-based detection.
    """

    def __init__(self, aggressiveness: int = 2, sample_rate: int = 16000):
        self.sample_rate = sample_rate
        self.aggressiveness = aggressiveness

        if _HAS_WEBRTCVAD:
            self._vad = webrtcvad.Vad(aggressiveness)
            logger.info(f"WebRTCVAD initialized (aggressiveness={aggressiveness})")
        else:
            self._vad = None

        # Energy-based fallback parameters
        self._energy_threshold = 500  # RMS threshold
        self._speech_frames = 0
        self._silence_frames = 0
        self._min_speech_frames = 3  # Min consecutive speech frames
        self._min_silence_frames = 15  # Min consecutive silence frames
        self._is_speaking = False

    def is_speech(self, audio_bytes: bytes, frame_duration_ms: int = 30) -> bool:
        """
        Check if audio frame contains speech.
        
        Args:
            audio_bytes: Raw PCM Int16 audio bytes
            frame_duration_ms: Frame duration (10, 20, or 30 ms)
        
        Returns:
            True if speech detected
        """
        if self._vad is not None:
            try:
                return self._vad.is_speech(audio_bytes, self.sample_rate)
            except Exception:
                pass  # Fall through to energy-based

        return self._energy_based_vad(audio_bytes)

    def _energy_based_vad(self, audio_bytes: bytes) -> bool:
        """Energy-based voice activity detection fallback."""
        try:
            # Convert bytes to int16 samples
            num_samples = len(audio_bytes) // 2
            if num_samples == 0:
                return False

            samples = np.frombuffer(audio_bytes, dtype=np.int16)
            rms = np.sqrt(np.mean(samples.astype(np.float64) ** 2))

            if rms > self._energy_threshold:
                self._speech_frames += 1
                self._silence_frames = 0
                if self._speech_frames >= self._min_speech_frames:
                    self._is_speaking = True
            else:
                self._silence_frames += 1
                self._speech_frames = 0
                if self._silence_frames >= self._min_silence_frames:
                    self._is_speaking = False

            return self._is_speaking

        except Exception as e:
            logger.error(f"Energy VAD error: {e}")
            return False

    def reset(self):
        """Reset VAD state."""
        self._speech_frames = 0
        self._silence_frames = 0
        self._is_speaking = False
