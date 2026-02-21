"""
Solace — Empathy Node
Generates empathetic response via Groq Llama-3 with streaming.
"""
import logging

logger = logging.getLogger(__name__)


async def empathy_node(state: dict) -> dict:
    """
    Generates the empathetic response using Groq.
    Note: The actual streaming + TTS is handled in TherapistCouncil._empathy_and_speak_node
    because it needs direct access to the TTS audio queue.
    This node is used when running the graph in non-streaming mode.
    """
    from app.services.singletons import get_groq
    from app.config import LLM_MODEL, LLM_TEMPERATURE, LLM_MAX_TOKENS

    groq_client = get_groq()

    system_prompt = state.get("system_prompt", "You are a helpful therapist.")
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(state.get("history", [])[-10:])
    messages.append({"role": "user", "content": state["current_transcript"]})

    try:
        completion = await groq_client.chat.completions.create(
            model=LLM_MODEL,
            messages=messages,
            temperature=LLM_TEMPERATURE,
            max_tokens=LLM_MAX_TOKENS,
            stream=False,
        )

        state["response_text"] = completion.choices[0].message.content or ""
        logger.info(f"Empathy response generated: {len(state['response_text'])} chars")
    except Exception as e:
        logger.error(f"Empathy node error: {e}")
        state["response_text"] = "I'm here with you. Take your time."

    return state
