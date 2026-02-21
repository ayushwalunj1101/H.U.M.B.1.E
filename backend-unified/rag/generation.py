"""
Unified Backend — RAG Generation
Voice-optimized response generation using Groq LLM.
Adapted from backend/rag.py with voice-first prompt.
"""
import os
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from config import GROQ_API_KEY, RAG_LLM_MODEL, RAG_LLM_TEMPERATURE

llm = ChatGroq(
    temperature=RAG_LLM_TEMPERATURE,
    model_name=RAG_LLM_MODEL,
    api_key=GROQ_API_KEY,
)

# Load voice-optimized prompt
PROMPT_PATH = os.path.join(os.path.dirname(__file__), "..", "prompts", "voice_therapy_prompt.txt")

try:
    with open(PROMPT_PATH, "r", encoding="utf-8") as f:
        SYSTEM_PROMPT_TEXT = f.read()
except FileNotFoundError:
    SYSTEM_PROMPT_TEXT = (
        "You are a warm, empathetic voice therapist. "
        "Respond in 2-3 natural sentences. No bullet points, no markdown. "
        "Speak conversationally as if talking to someone in a quiet room."
    )


def format_docs(docs):
    """Format retrieved documents for the prompt context."""
    if not docs:
        return "No relevant clinical documents found. Use established CBT grounding techniques."
    formatted = []
    for i, d in enumerate(docs, 1):
        source = d.metadata.get("display_name", "Clinical Module")
        page = d.metadata.get("page", "N/A")
        content = d.page_content.strip()
        formatted.append(f"[EVIDENCE {i}]\nSource: {source} (Page {page})\nContent: {content}")
    return "\n\n".join(formatted)


def generate_voice_response(state):
    """Generate a concise, voice-optimized therapy response."""
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT_TEXT),
        ("human", "USER: {user_input}\n\nCOUNCIL: {council_json}\n\nEVIDENCE:\n{docs}\n\nCONVERSATION HISTORY:\n{history}"),
    ])

    chain = prompt | llm

    # Format conversation history
    history_text = ""
    if state.get("conversation_history"):
        for msg in state["conversation_history"][-6:]:  # Last 6 messages
            role = msg.get("role", "user")
            content = msg.get("content", "")
            history_text += f"{role}: {content}\n"

    response = chain.invoke({
        "user_input": state["user_input"],
        "council_json": state["council_result"].json(),
        "docs": format_docs(state["retrieved_docs"]),
        "history": history_text or "No prior conversation.",
    })

    return {"final_response": response.content}
