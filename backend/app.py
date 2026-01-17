from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from graph import app_graph
from rag import llm
from langchain_core.prompts import ChatPromptTemplate
import uvicorn

app = FastAPI(title="Therapy Layer 0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class MsgReq(BaseModel):
    message: str

class GreetingReq(BaseModel):
    userName: str = ""

@app.post("/api/greeting")
async def get_greeting(req: GreetingReq):
    """Generate a personalized, warm greeting using the LLM."""
    try:
        greeting_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a warm, compassionate therapy assistant starting a session.
Generate a brief, welcoming greeting (1-2 sentences max).
- Be warm but not overly effusive
- Invite them to speak when ready
- If a name is provided, use it naturally
- Do NOT ask questions yet
- Keep it under 25 words"""),
            ("human", "User name: {name}")
        ])
        
        chain = greeting_prompt | llm
        response = chain.invoke({"name": req.userName or "friend"})
        
        return {"greeting": response.content.strip()}
    except Exception as e:
        print(f"Greeting generation error: {e}")
        # Minimal fallback
        name_part = f" {req.userName}" if req.userName else ""
        return {"greeting": f"Hi{name_part}. I'm here with you. When you're ready, just start speaking."}

@app.post("/api/chat")
async def chat(req: MsgReq):
    try:
        print(f"\n📨 Received message: {req.message[:50]}...")
        state = app_graph.invoke({"user_input": req.message, "council_result": None, "retrieved_docs": []})
        
        # Debug: Show raw retrieved docs
        print(f"📄 Raw retrieved_docs count: {len(state.get('retrieved_docs', []))}")
        for i, doc in enumerate(state.get("retrieved_docs", [])[:3]):
            print(f"   Doc {i+1}: {doc.metadata.get('display_name', 'Unknown')} - {doc.page_content[:100]}...")
        
        # Polish sources for Frontend
        sources = []
        if state.get("retrieved_docs"):
            seen = set()
            for d in state["retrieved_docs"]:
                name = d.metadata.get("display_name", "Unknown Source")
                if name not in seen:
                    sources.append(name)
                    seen.add(name)
        
        print(f"✅ Response generated with {len(sources)} unique sources: {sources}")
        return {
            "response": state["final_response"],
            "council": state["council_result"].dict(),
            "sources": sources
        }
    except Exception as e:
        error_type = type(e).__name__
        print(f"\n❌ ERROR in /api/chat: {error_type}: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Return error details so frontend can handle appropriately
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500,
            detail={
                "error_type": error_type,
                "message": str(e)
            }
        )

if __name__ == "__main__":
    print("\n" + "="*50)
    print("🚀 Starting Therapy Layer 0 Backend")
    print("="*50)
    print("📡 Server: http://0.0.0.0:8000")
    print("🌐 Access via:")
    print("   - http://localhost:8000")
    print("   - http://127.0.0.1:8000")
    print("📚 API Docs: http://localhost:8000/docs")
    print("🔧 CORS: Enabled for all origins")
    print("="*50 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
