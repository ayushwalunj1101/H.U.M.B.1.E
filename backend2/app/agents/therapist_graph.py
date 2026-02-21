"""
Solace — The Therapist Council (LangGraph State Machine)

A LangGraph state machine with nodes:
  1. context_node  → Fetch relevant memories from MongoDB
  2. empathy_node  → Generate empathetic Groq response (streaming)
  3. memory_node   → Write this turn to MongoDB + generate embedding
  
Includes latency-optimized flush logic for streaming LLM → TTS.
"""
import asyncio
import time
import logging
import os
from langgraph.graph import StateGraph, END
from typing import TypedDict, List, Optional
from app.services import memory_service
from app.audio.asr_streamer import DeepgramASRStreamer
from app.audio.tts_streamer import DeepgramTTSStreamer
from app.turn_manager import TurnManager
from app.config import (
    LLM_MODEL,
    LLM_TEMPERATURE,
    LLM_MAX_TOKENS,
    FIRST_FLUSH_WORDS,
    STEADY_FLUSH_WORDS,
    DEADLINE_FLUSH_MS,
    MAX_HISTORY_TURNS,
    HISTORY_TRIM_TO,
)

logger = logging.getLogger(__name__)

# Path to the therapist system prompt
PROMPT_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "prompts", "therapist_system.txt")


class CouncilState(TypedDict):
    user_id: str
    current_transcript: str
    is_final: bool
    retrieved_memories: List[dict]
    behavioral_summary: Optional[str]
    response_text: str
    history: List[dict]
    interrupted: bool
    latency_markers: dict
    context_block: Optional[str]
    system_prompt: Optional[str]


class TherapistCouncil:
    """
    The Therapist Council — orchestrates the full voice therapy session.
    Manages ASR → LLM → TTS pipeline with barge-in support.
    """

    def __init__(self, session):
        self.session = session
        self.turn_manager = TurnManager()
        self.asr = DeepgramASRStreamer()
        self.tts = DeepgramTTSStreamer()
        self._current_generation_task = None

        # Load system prompt
        self._system_prompt = self._load_system_prompt()

        # Build LangGraph
        builder = StateGraph(CouncilState)
        builder.add_node("context", self._context_node)
        builder.add_node("empathy", self._empathy_node_graph)
        builder.add_node("memory", self._memory_node)
        builder.set_entry_point("context")
        builder.add_edge("context", "empathy")
        builder.add_edge("empathy", "memory")
        builder.add_edge("memory", END)
        self.graph = builder.compile()

    def _load_system_prompt(self) -> str:
        try:
            with open(PROMPT_PATH, "r", encoding="utf-8") as f:
                return f.read()
        except FileNotFoundError:
            logger.warning(f"System prompt not found at {PROMPT_PATH}, using default")
            return (
                "You are Solace — a warm, empathetic voice therapist. "
                "Keep responses to 1-2 sentences. Reflect emotions before offering insight."
            )

    async def run(self, audio_queue, transcript_queue, tts_audio_queue):
        """Main orchestration loop."""
        # Start ASR in the background
        asr_task = asyncio.create_task(
            self.asr.start(audio_queue, transcript_queue)
        )

        # Pre-fetch memory in parallel as user starts speaking
        memory_prefetch_task = None

        try:
            while True:
                payload = await transcript_queue.get()
                if payload is None:
                    break

                text = payload["text"]
                is_final = payload["is_final"]

                # ── BARGE-IN HANDLING ──
                if (
                    self.session.is_speaking
                    and self.turn_manager.is_true_interruption(text)
                ):
                    logger.warning(f"BARGE-IN: '{text}'")
                    await self.session.trigger_interrupt()
                    if self._current_generation_task:
                        self._current_generation_task.cancel()
                    await self._flush_tts_queue(tts_audio_queue)
                    await asyncio.sleep(0)  # Yield to cancel tasks

                # ── MEMORY PREFETCH on interim ──
                if not is_final and memory_prefetch_task is None:
                    memory_prefetch_task = asyncio.create_task(
                        memory_service.fetch_relevant_context(
                            text, self.session.user_id, top_k=5
                        )
                    )

                # ── FINAL TRANSCRIPT → GENERATE RESPONSE ──
                if is_final:
                    await self.session.clear_interrupt()

                    # Collect prefetched memory (likely already done)
                    memories = []
                    if memory_prefetch_task:
                        try:
                            memories = await asyncio.wait_for(
                                memory_prefetch_task, timeout=0.05
                            )
                        except asyncio.TimeoutError:
                            memories = []  # Proceed without memory — don't block
                        memory_prefetch_task = None

                    behavioral_ctx = (
                        await memory_service.get_latest_behavioral_summary(
                            self.session.user_id
                        )
                    )

                    state = CouncilState(
                        user_id=self.session.user_id,
                        current_transcript=text,
                        is_final=True,
                        retrieved_memories=memories,
                        behavioral_summary=behavioral_ctx,
                        response_text="",
                        history=self.session.history,
                        interrupted=False,
                        latency_markers={
                            "transcript_received": time.monotonic()
                        },
                        context_block=None,
                        system_prompt=None,
                    )

                    self._current_generation_task = asyncio.create_task(
                        self._run_generation(state, tts_audio_queue)
                    )
        finally:
            asr_task.cancel()

    async def _run_generation(self, state: CouncilState, tts_audio_queue):
        """Run the full generation pipeline: context → empathy+TTS → memory."""
        try:
            enriched_state = await self._context_node(state)
            await self._empathy_and_speak_node(enriched_state, tts_audio_queue)
            await self._memory_node(enriched_state)
        except asyncio.CancelledError:
            logger.info("Generation cancelled by interrupt.")
        except Exception as e:
            logger.error(f"Generation error: {e}")

    async def _context_node(self, state: CouncilState) -> CouncilState:
        """Build the enriched prompt context from memories + behavioral data."""
        memory_block = ""
        if state["retrieved_memories"]:
            memory_block = "## Relevant Past Sessions\n"
            for m in state["retrieved_memories"]:
                memory_block += f"- [{m.get('timestamp', '')}] {m.get('summary', '')}\n"

        behavioral_block = ""
        if state["behavioral_summary"]:
            behavioral_block = (
                f"\n## Recent Behavioral Observations (from journal)\n"
                f"{state['behavioral_summary']}"
            )

        state["context_block"] = memory_block + behavioral_block
        return state

    async def _empathy_and_speak_node(
        self, state: CouncilState, tts_audio_queue
    ):
        """
        Stream LLM tokens → TTS audio, with latency-optimized flushing.
        Dual-threshold flush: fast first chunk, stable subsequent chunks.
        """
        from app.services.singletons import get_groq

        groq_client = get_groq()

        system_prompt = self._build_system_prompt(state)
        messages = self._build_messages(state, system_prompt)

        chunk_buffer = ""
        full_response = ""
        is_first_chunk = True
        last_flush = time.monotonic()

        await self.session.set_speaking(True)

        try:
            completion = await groq_client.chat.completions.create(
                model=LLM_MODEL,
                messages=messages,
                temperature=LLM_TEMPERATURE,
                max_tokens=LLM_MAX_TOKENS,
                stream=True,
            )

            async for chunk in completion:
                if self.session.is_interrupted:
                    break

                token = chunk.choices[0].delta.content or ""
                if not token:
                    continue

                full_response += token
                chunk_buffer += token
                elapsed_ms = (time.monotonic() - last_flush) * 1000
                word_count = len(chunk_buffer.split())

                # Flush on sentence boundaries for smooth, natural speech
                is_sentence_end = any(p in token for p in {".", "!", "?"})
                flush = (
                    (is_first_chunk and word_count >= FIRST_FLUSH_WORDS and is_sentence_end)
                    or (is_first_chunk and word_count >= FIRST_FLUSH_WORDS + 4)  # Fallback
                    or is_sentence_end  # Always flush on sentence end
                    or (not is_first_chunk and word_count >= STEADY_FLUSH_WORDS)
                    or elapsed_ms >= DEADLINE_FLUSH_MS
                )

                if flush and chunk_buffer.strip():
                    # Await sequentially so chunks play in order — no overlap
                    await self._speak_chunk(chunk_buffer, tts_audio_queue)
                    chunk_buffer = ""
                    last_flush = time.monotonic()
                    is_first_chunk = False

            # Flush remainder
            if chunk_buffer.strip() and not self.session.is_interrupted:
                await self._speak_chunk(chunk_buffer, tts_audio_queue)

            state["response_text"] = full_response

        finally:
            await self.session.set_speaking(False)

    async def _speak_chunk(self, text: str, tts_audio_queue: asyncio.Queue):
        """Convert one text chunk to audio and put in queue."""
        async for audio_bytes in self.tts.stream(text, self.session):
            if self.session.is_interrupted:
                return
            await tts_audio_queue.put(audio_bytes)

    async def _memory_node(self, state: CouncilState):
        """Persist this turn to MongoDB (non-blocking — runs in background)."""
        if not state.get("response_text"):
            return

        turn = {
            "user_id": state["user_id"],
            "user_message": state["current_transcript"],
            "assistant_message": state["response_text"],
            "timestamp": time.time(),
            "behavioral_context": state.get("behavioral_summary"),
        }
        asyncio.create_task(memory_service.save_turn(turn))  # Fire and forget

        self.session.history.append(
            {"role": "user", "content": state["current_transcript"]}
        )
        self.session.history.append(
            {"role": "assistant", "content": state["response_text"]}
        )

        if len(self.session.history) > MAX_HISTORY_TURNS:
            self.session.history = self.session.history[-HISTORY_TRIM_TO:]

    async def _empathy_node_graph(self, state: CouncilState) -> CouncilState:
        """Empathy node for graph-only mode (non-streaming)."""
        from app.agents.nodes.empathy_node import empathy_node
        return await empathy_node(state)

    def _build_system_prompt(self, state: CouncilState) -> str:
        base = self._system_prompt
        if state.get("context_block"):
            base += f"\n\n{state['context_block']}"
        return base

    def _build_messages(self, state, system_prompt):
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(state["history"][-10:])
        messages.append(
            {"role": "user", "content": state["current_transcript"]}
        )
        return messages

    async def _flush_tts_queue(self, queue: asyncio.Queue):
        """Clear any pending TTS audio on interrupt."""
        while not queue.empty():
            try:
                queue.get_nowait()
                queue.task_done()
            except asyncio.QueueEmpty:
                break
