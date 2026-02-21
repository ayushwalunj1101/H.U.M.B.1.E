"""
Solace — Deepgram Nova-2 Live ASR Streamer
Handles streaming WebSocket ASR with interim + final transcripts.
"""
import asyncio
import json
import logging
import os
import aiohttp
from app.config import DEEPGRAM_API_KEY, ASR_MODEL, ASR_LANGUAGE, ASR_SAMPLE_RATE

logger = logging.getLogger(__name__)

DG_ASR_WS_URL = (
    f"wss://api.deepgram.com/v1/listen"
    f"?model={ASR_MODEL}"
    f"&language={ASR_LANGUAGE}"
    f"&punctuate=true"
    f"&interim_results=true"
    f"&endpointing=300"  # 300ms silence to finalize
    f"&utterance_end_ms=1000"
    f"&vad_events=true"
)


class DeepgramASRStreamer:
    """
    Streams audio bytes to Deepgram Nova-2 and emits transcript payloads.
    Outputs: {"text": str, "is_final": bool}
    """

    def __init__(self):
        self._session: aiohttp.ClientSession | None = None
        self._ws = None
        self._running = False

    async def start(self, audio_queue: asyncio.Queue, transcript_queue: asyncio.Queue):
        """Start the ASR pipeline — reads from audio_queue, writes to transcript_queue."""
        self._running = True

        headers = {
            "Authorization": f"Token {DEEPGRAM_API_KEY}",
        }

        self._session = aiohttp.ClientSession()

        try:
            self._ws = await self._session.ws_connect(DG_ASR_WS_URL, headers=headers)
            logger.info("✓ Deepgram ASR WebSocket connected")

            # Run send and receive loops concurrently
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
        """Send audio chunks from the queue to Deepgram."""
        try:
            while self._running:
                chunk = await audio_queue.get()
                if chunk is None:  # Poison pill
                    # Send close frame to Deepgram
                    if self._ws and not self._ws.closed:
                        await self._ws.send_json({"type": "CloseStream"})
                    break
                if self._ws and not self._ws.closed:
                    await self._ws.send_bytes(chunk)
        except Exception as e:
            logger.error(f"ASR send loop error: {e}")

    async def _receive_loop(self, transcript_queue: asyncio.Queue):
        """Receive transcript results from Deepgram."""
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

                elif msg.type in (
                    aiohttp.WSMsgType.ERROR,
                    aiohttp.WSMsgType.CLOSED,
                ):
                    logger.warning("ASR WebSocket closed")
                    break

        except Exception as e:
            logger.error(f"ASR receive loop error: {e}")
        finally:
            await transcript_queue.put(None)  # Signal end

    async def stop(self):
        """Stop the ASR streamer."""
        self._running = False
