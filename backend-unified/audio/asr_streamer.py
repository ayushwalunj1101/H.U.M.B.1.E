"""
Unified Backend — Deepgram Nova-2 Live ASR Streamer
Lifted from backend2/app/audio/asr_streamer.py
"""
import asyncio
import json
import logging
import aiohttp
from config import DEEPGRAM_API_KEY, ASR_MODEL, ASR_LANGUAGE, ASR_SAMPLE_RATE

logger = logging.getLogger(__name__)

DG_ASR_WS_URL = (
    f"wss://api.deepgram.com/v1/listen"
    f"?model={ASR_MODEL}"
    f"&language={ASR_LANGUAGE}"
    f"&punctuate=true"
    f"&interim_results=true"
    f"&endpointing=300"
    f"&utterance_end_ms=1000"
    f"&vad_events=true"
)


class DeepgramASRStreamer:
    """Streams audio bytes to Deepgram Nova-2 and emits transcript payloads."""

    def __init__(self):
        self._session: aiohttp.ClientSession | None = None
        self._ws = None
        self._running = False

    async def start(self, audio_queue: asyncio.Queue, transcript_queue: asyncio.Queue):
        """Start the ASR pipeline."""
        self._running = True
        headers = {"Authorization": f"Token {DEEPGRAM_API_KEY}"}
        self._session = aiohttp.ClientSession()

        try:
            self._ws = await self._session.ws_connect(DG_ASR_WS_URL, headers=headers)
            logger.info("✓ Deepgram ASR WebSocket connected")
            await asyncio.gather(
                self._send_loop(audio_queue),
                self._receive_loop(transcript_queue),
            )
        except Exception as e:
            logger.error(f"ASR connection error: {e}")
        finally:
            self._running = False
            if self._ws and not self._ws.closed:
                await self._ws.close()
            if self._session and not self._session.closed:
                await self._session.close()

    async def _send_loop(self, audio_queue: asyncio.Queue):
        try:
            while self._running:
                chunk = await audio_queue.get()
                if chunk is None:
                    if self._ws and not self._ws.closed:
                        await self._ws.send_json({"type": "CloseStream"})
                    break
                if self._ws and not self._ws.closed:
                    await self._ws.send_bytes(chunk)
        except Exception as e:
            logger.error(f"ASR send loop error: {e}")

    async def _receive_loop(self, transcript_queue: asyncio.Queue):
        try:
            async for msg in self._ws:
                if msg.type == aiohttp.WSMsgType.TEXT:
                    data = json.loads(msg.data)
                    if data.get("type") == "Results":
                        channel = data.get("channel", {})
                        alternatives = channel.get("alternatives", [])
                        if alternatives:
                            text = alternatives[0].get("transcript", "").strip()
                            is_final = data.get("is_final", False)
                            if text:
                                await transcript_queue.put(
                                    {"text": text, "is_final": is_final}
                                )
                                log_level = "FINAL" if is_final else "interim"
                                logger.info(f"ASR [{log_level}]: {text}")
                elif msg.type in (aiohttp.WSMsgType.ERROR, aiohttp.WSMsgType.CLOSED):
                    logger.warning("ASR WebSocket closed")
                    break
        except Exception as e:
            logger.error(f"ASR receive loop error: {e}")
        finally:
            await transcript_queue.put(None)

    async def stop(self):
        self._running = False
