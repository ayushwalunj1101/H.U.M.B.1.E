from typing import TypedDict, List, Any
from langgraph.graph import StateGraph, END
from council import analyze_user_input, CouncilOutput
from vectorstore import get_retriever
from rag import generate_therapy_response, llm
from langchain_core.prompts import ChatPromptTemplate

class State(TypedDict):
    user_input: str
    council_result: CouncilOutput
    retrieved_docs: List[Any]
    final_response: str

def council_node(state: State):
    return {"council_result": analyze_user_input(state["user_input"])}

def retrieval_node(state: State):
    retriever = get_retriever()
    if retriever:
        docs = retriever.invoke(state["user_input"])
        return {"retrieved_docs": docs}
    return {"retrieved_docs": []}

def crisis_node(state: State):
    # Hard-coded Safety Override
    msg = (
        "I hear how much pain you are in. Your safety is my top priority.\n\n"
        "I cannot provide therapy right now because I am an AI, but there are people ready to help you.\n"
        "Please call **Tele-MANAS** at **14416** (24/7, Free).\n"
        "Or reach out to **Connecting Trust** (Pune) at **9922001122**."
    )
    return {"final_response": msg, "retrieved_docs": []}

def refine_output_node(state: State):
    """Final polish: enforces word count, removes forbidden patterns, ensures structure."""
    current_response = state["final_response"]
    
    refine_prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a response editor. Your ONLY job is to refine the given response.

STRICT RULES:
1. Output must be 60-100 words. Count carefully.
2. Remove ANY phrase starting with: "Based on", "According to", "I understand", "It sounds like"
3. Ensure structure: Insight (observation) → Action (technique) → Check-in (question)
4. Keep the same meaning and warmth.
5. Output ONLY the refined response, nothing else."""),
        ("human", "Refine this response:\n\n{response}")
    ])
    
    chain = refine_prompt | llm
    refined = chain.invoke({"response": current_response})
    
    return {"final_response": refined.content}

def route_logic(state: State):
    if state["council_result"].crisis_risk == "high":
        return "crisis_node"
    return "retrieval_node"

workflow = StateGraph(State)
workflow.add_node("council_node", council_node)
workflow.add_node("retrieval_node", retrieval_node)
workflow.add_node("generation_node", generate_therapy_response)
workflow.add_node("refine_output_node", refine_output_node)
workflow.add_node("crisis_node", crisis_node)

workflow.set_entry_point("council_node")
workflow.add_conditional_edges("council_node", route_logic, {"crisis_node": "crisis_node", "retrieval_node": "retrieval_node"})
workflow.add_edge("retrieval_node", "generation_node")
workflow.add_edge("generation_node", "refine_output_node")
workflow.add_edge("refine_output_node", END)
workflow.add_edge("crisis_node", END)

app_graph = workflow.compile()
