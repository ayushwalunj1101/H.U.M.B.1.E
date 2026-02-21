"""
Solace — Deepgram Aura TTS via WebSocket (async, low-latency)
Replaces the blocking .stream() REST call from the base code.
Yields raw PCM bytes as they arrive — no buffering.
"""
import aiohttp
import asyncio
import json
import logging
import os
from app.config import DEEPGRAM_API_KEY, TTS_VOICE, TTS_SAMPLE_RATE

logger = logging.getLogger(__name__)

DG_TTS_WS_URL = f"wss://api.deepgram.com/v1/speak?encoding=linear16&sample_rate={TTS_SAMPLE_RATE}"


class DeepgramTTSStreamer:
    """
    Streams text → audio via Deepgram Aura WebSocket TTS.
    Each call to stream() opens a short-lived WS, sends text, yields PCM bytes.
    """

    def __init__(self):
        self.api_key = DEEPGRAM_API_KEY
        self.voice = TTS_VOICE
        self._session: aiohttp.ClientSession | None = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session

    async def stream(self, text: str, session):
        """
        Streams audio bytes for a text chunk via Deepgram WebSocket TTS.
        Yields raw PCM Int16 bytes as they arrive — no buffering.
        """
        if not text.strip():
            return

        headers = {
            "Authorization": f"Token {self.api_key}",
            "Content-Type": "application/json",
        }

        url = f"{DG_TTS_WS_URL}&model={self.voice}"
        http_session = await self._get_session()

        try:
            async with http_session.ws_connect(url, headers=headers) as ws:
                # Send text to speak
                await ws.send_json({"type": "Speak", "text": text})
                await ws.send_json({"type": "Flush"})  # Signal end of input

                async for msg in ws:
                    if session.is_interrupted:
                        await ws.close()
                        return

                    if msg.type == aiohttp.WSMsgType.BINARY:
                        yield msg.data  # Raw PCM audio chunk
                    elif msg.type == aiohttp.WSMsgType.TEXT:
                        data = json.loads(msg.data)
                        if data.get("type") == "Flushed":
                            break  # All audio for this chunk delivered
                    elif msg.type in (
                        aiohttp.WSMsgType.ERROR,
                        aiohttp.WSMsgType.CLOSED,
                    ):
                        break

        except Exception as e:
            logger.error(f"[TTS] WebSocket error for text '{text[:30]}': {e}")

    async def close(self):
        """Close the HTTP session."""
        if self._session and not self._session.closed:
            await self._session.close()
