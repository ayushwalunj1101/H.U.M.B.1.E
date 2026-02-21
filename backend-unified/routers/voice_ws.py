"""
Unified Backend — WebSocket Voice Endpoint
Full-duplex voice: audio in → ASR → LLM → TTS → audio out.
Lifted from backend2/app/routers/voice_ws.py
"""
import asyncio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from agents.therapist_graph import TherapistCouncil
from session import SessionContext

router = APIRouter()
logger = logging.getLogger(__name__)


@router.websocket("/ws/voice/{user_id}")
async def voice_endpoint(websocket: WebSocket, user_id: str):
    """Full-duplex voice WebSocket endpoint."""
    await websocket.accept()
    logger.info(f"Voice session connected: user={user_id}")

    session = SessionContext(user_id=user_id)
    council = TherapistCouncil(session)

    audio_queue = asyncio.Queue(maxsize=200)
    transcript_queue = asyncio.Queue()
    tts_audio_queue = asyncio.Queue()

    async def receive_loop():
        try:
            while True:
                data = await websocket.receive_bytes()
                await audio_queue.put(data)
        except WebSocketDisconnect:
            logger.info(f"Client disconnected: user={user_id}")
            await audio_queue.put(None)
        except Exception as e:
            logger.error(f"Receive loop error: {e}")
            await audio_queue.put(None)

    async def send_loop():
        try:
            while True:
                audio_chunk = await tts_audio_queue.get()
                if audio_chunk is None:
                    break
                try:
                    await websocket.send_bytes(audio_chunk)
                except Exception:
                    break
        except Exception as e:
            logger.error(f"Send loop error: {e}")

    tasks = [
        asyncio.create_task(receive_loop()),
        asyncio.create_task(send_loop()),
        asyncio.create_task(
            council.run(audio_queue, transcript_queue, tts_audio_queue)
        ),
    ]

    try:
        await asyncio.gather(*tasks, return_exceptions=True)
    except (Exception, asyncio.CancelledError) as e:
        if not isinstance(e, asyncio.CancelledError):
            logger.error(f"Voice session error: {e}")
    finally:
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        await session.cleanup()
        logger.info(f"Voice session ended: user={user_id}")
