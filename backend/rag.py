import os
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from dotenv import load_dotenv

load_dotenv()

# Llama 3.3 70B is the latest flagship model (3.1 was decommissioned)
# 70B is recommended for clinical safety and reasoning
llm = ChatGroq(
    temperature=0.1,  # Slightly higher for natural variation
    model_name="llama-3.3-70b-versatile",
    api_key=os.environ.get("GROQ_API_KEY")
)

with open("prompts/therapy_prompt.txt", "r", encoding="utf-8") as f:
    SYSTEM_PROMPT_TEXT = f.read()

def format_docs(docs):
    if not docs:
        return "No relevant clinical documents found. Use established CBT grounding techniques."
    formatted = []
    for i, d in enumerate(docs, 1):
        source = d.metadata.get('display_name', 'Clinical Module')
        page = d.metadata.get('page', 'N/A')
        content = d.page_content.strip()
        formatted.append(f"[EVIDENCE {i}]\nSource: {source} (Page {page})\nContent: {content}")
    return "\n\n".join(formatted)

def generate_therapy_response(state):
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT_TEXT),
        ("human", "USER: {user_input}\n\nCOUNCIL: {council_json}\n\nEVIDENCE:\n{docs}")
    ])
    
    chain = prompt | llm
    
    response = chain.invoke({
        "user_input": state["user_input"],
        "council_json": state["council_result"].json(),
        "docs": format_docs(state["retrieved_docs"])
    })
    
    return {"final_response": response.content}
