"""
Unified Backend — The Therapist Council (RAG-Enhanced)
LangGraph state machine with RAG context injection.
Merged from backend2/app/agents/therapist_graph.py + RAG retrieval.
"""
import asyncio
import time
import logging
import os
from concurrent.futures import ThreadPoolExecutor
from langgraph.graph import StateGraph, END
from typing import TypedDict, List, Optional
from services import memory_service
from audio.asr_streamer import DeepgramASRStreamer
from audio.tts_streamer import DeepgramTTSStreamer
from audio.tts_chunker import TTSChunker
from turn_manager import TurnManager
from rag.retrieval import retrieve as rag_retrieve
from rag.citation_formatter import format_citations
from config import (
    VOICE_LLM_MODEL,
    VOICE_LLM_TEMPERATURE,
    VOICE_LLM_MAX_TOKENS,
    MAX_HISTORY_TURNS,
    HISTORY_TRIM_TO,
)

logger = logging.getLogger(__name__)

PROMPT_PATH = os.path.join(os.path.dirname(__file__), "..", "prompts", "therapist_system.txt")

# Dedicated thread pool for FAISS retrieval — sized to CPU count, not hardcoded
# Replaces the old Semaphore(4) + asyncio.to_thread pattern
_rag_executor = ThreadPoolExecutor(max_workers=os.cpu_count() or 4, thread_name_prefix="rag")
RAG_TIMEOUT_SECONDS = 5.0  # Prevent queue starvation under load


class CouncilState(TypedDict):
    user_id: str
    current_transcript: str
    is_final: bool
    retrieved_memories: List[dict]
    retrieved_docs: list          # RAG documents from FAISS
    behavioral_summary: Optional[str]
    response_text: str
    history: List[dict]
    interrupted: bool
    latency_markers: dict
    context_block: Optional[str]
    system_prompt: Optional[str]


class TherapistCouncil:
    """
    Orchestrates the full voice therapy session.
    Enhanced with RAG retrieval from FAISS alongside MongoDB memories.

    Refactored from monolithic God Object:
    - TTS chunking logic extracted to audio.tts_chunker.TTSChunker
    - FAISS retrieval uses dedicated ThreadPoolExecutor with timeout
    - String concatenation uses list + join pattern
    - Orphaned async tasks are properly cancelled
    """

    def __init__(self, session):
        self.session = session
        self.turn_manager = TurnManager()
        self.asr = DeepgramASRStreamer()
        self.tts = DeepgramTTSStreamer()
        self._current_generation_task = None
        self._system_prompt = self._load_system_prompt()
        self._background_tasks = set()

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
        asr_task = asyncio.create_task(
            self.asr.start(audio_queue, transcript_queue)
        )
        memory_prefetch_task = None

        try:
            while True:
                payload = await transcript_queue.get()
                if payload is None:
                    break

                text = payload["text"]
                is_final = payload["is_final"]

                # BARGE-IN HANDLING
                if (
                    self.session.is_speaking
                    and self.turn_manager.is_true_interruption(text)
                ):
                    logger.warning(f"BARGE-IN: '{text}'")
                    await self.session.trigger_interrupt()
                    if self._current_generation_task:
                        self._current_generation_task.cancel()
                    await self._flush_tts_queue(tts_audio_queue)
                    await asyncio.sleep(0)

                # MEMORY PREFETCH on interim
                if not is_final and memory_prefetch_task is None:
                    memory_prefetch_task = asyncio.create_task(
                        memory_service.fetch_relevant_context(
                            text, self.session.user_id, top_k=5
                        )
                    )

                # FINAL TRANSCRIPT → GENERATE RESPONSE
                if is_final:
                    await self.session.clear_interrupt()

                    memories = []
                    if memory_prefetch_task:
                        try:
                            memories = await asyncio.wait_for(
                                memory_prefetch_task, timeout=0.05
                            )
                        except asyncio.TimeoutError:
                            # Cancel the timed-out task to prevent it from leaking
                            memory_prefetch_task.cancel()
                            try:
                                await memory_prefetch_task
                            except (asyncio.CancelledError, Exception):
                                pass
                            memories = []
                        memory_prefetch_task = None

                    behavioral_ctx = (
                        await memory_service.get_latest_behavioral_summary(
                            self.session.user_id
                        )
                    )

                    # RAG retrieval from FAISS — dedicated executor with timeout
                    # TODO: Migrate to async-native vector DB (Qdrant/Milvus) for true non-blocking
                    loop = asyncio.get_running_loop()
                    try:
                        rag_docs = await asyncio.wait_for(
                            loop.run_in_executor(_rag_executor, rag_retrieve, text, 3),
                            timeout=RAG_TIMEOUT_SECONDS,
                        )
                    except asyncio.TimeoutError:
                        logger.warning("FAISS retrieval timed out, proceeding without RAG docs")
                        rag_docs = []

                    state = CouncilState(
                        user_id=self.session.user_id,
                        current_transcript=text,
                        is_final=True,
                        retrieved_memories=memories,
                        retrieved_docs=rag_docs,
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
            if self._current_generation_task:
                self._current_generation_task.cancel()
            if memory_prefetch_task:
                memory_prefetch_task.cancel()
            # Wait for all background tasks to complete
            if self._background_tasks:
                await asyncio.gather(*self._background_tasks, return_exceptions=True)

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
        """Build enriched prompt context from memories + RAG docs + behavioral data."""
        memory_block = ""
        if state["retrieved_memories"]:
            memory_block = "## Relevant Past Sessions\n"
            for m in state["retrieved_memories"]:
                memory_block += f"- [{m.get('timestamp', '')}] {m.get('summary', '')}\n"

        # RAG evidence block from FAISS
        rag_block = ""
        if state.get("retrieved_docs"):
            rag_block = "\n## Clinical Evidence\n"
            for i, d in enumerate(state["retrieved_docs"], 1):
                source = d.metadata.get("display_name", "Clinical Module")
                content = d.page_content.strip()[:200]
                rag_block += f"- [Evidence {i}] {source}: {content}\n"

        behavioral_block = ""
        if state["behavioral_summary"]:
            behavioral_block = (
                f"\n## Recent Behavioral Observations\n"
                f"{state['behavioral_summary']}"
            )

        state["context_block"] = memory_block + rag_block + behavioral_block
        return state

    async def _empathy_and_speak_node(
        self, state: CouncilState, tts_audio_queue
    ):
        """Stream LLM tokens → TTS audio with latency-optimized flushing."""
        from services.singletons import get_groq

        groq_client = get_groq()

        system_prompt = self._build_system_prompt(state)
        messages = self._build_messages(state, system_prompt)

        # Use TTSChunker for clean, testable flush logic
        chunker = TTSChunker()
        # Collect tokens in a list — avoids O(n²) string concatenation
        response_tokens: list[str] = []

        await self.session.set_speaking(True)

        try:
            completion = await groq_client.chat.completions.create(
                model=VOICE_LLM_MODEL,
                messages=messages,
                temperature=VOICE_LLM_TEMPERATURE,
                max_tokens=VOICE_LLM_MAX_TOKENS,
                stream=True,
            )

            async for chunk in completion:
                if self.session.is_interrupted:
                    break

                token = chunk.choices[0].delta.content or ""
                if not token:
                    continue

                response_tokens.append(token)
                flush_text = chunker.feed(token)

                if flush_text:
                    await self._speak_chunk(flush_text, tts_audio_queue)

            # Flush remaining buffer
            if not self.session.is_interrupted:
                remaining = chunker.flush()
                if remaining:
                    await self._speak_chunk(remaining, tts_audio_queue)

            state["response_text"] = "".join(response_tokens)

        finally:
            await self.session.set_speaking(False)

    async def _speak_chunk(self, text: str, tts_audio_queue: asyncio.Queue):
        async for audio_bytes in self.tts.stream(text, self.session):
            if self.session.is_interrupted:
                return
            await tts_audio_queue.put(audio_bytes)

    async def _memory_node(self, state: CouncilState):
        """Persist turn to MongoDB (non-blocking)."""
        if not state.get("response_text"):
            return

        turn = {
            "user_id": state["user_id"],
            "user_message": state["current_transcript"],
            "assistant_message": state["response_text"],
            "timestamp": time.time(),
            "behavioral_context": state.get("behavioral_summary"),
        }
        task = asyncio.create_task(memory_service.save_turn(turn))
        self._background_tasks.add(task)
        task.add_done_callback(self._background_tasks.discard)

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
        from services.singletons import get_groq
        groq_client = get_groq()

        system_prompt = self._build_system_prompt(state)
        messages = self._build_messages(state, system_prompt)

        completion = await groq_client.chat.completions.create(
            model=VOICE_LLM_MODEL,
            messages=messages,
            temperature=VOICE_LLM_TEMPERATURE,
            max_tokens=VOICE_LLM_MAX_TOKENS,
            stream=False,
        )

        state["response_text"] = completion.choices[0].message.content
        return state

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
        while not queue.empty():
            try:
                queue.get_nowait()
                queue.task_done()
            except asyncio.QueueEmpty:
                break

