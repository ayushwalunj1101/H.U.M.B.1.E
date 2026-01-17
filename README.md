# P.O.V - Mental Health Support Platform

A compassionate AI-powered mental health therapy platform that provides personalized support through conversational therapy, clinical assessments, and immersive voice interactions.

## 🌟 Features

### 💬 Interactive Chat
- Real-time conversational therapy with AI assistance
- Voice input/output support (Speech-to-Text & Text-to-Speech)
- Dynamic orb visualization responding to voice levels
- Message history with source citations
- Council analysis for depression, anxiety, and crisis detection

### 📋 Clinical Assessment (PHQ-9)
- Validated Patient Health Questionnaire-9 for depression screening
- Clinical severity scoring (0-27 scale)
- Risk level classification and suicidal ideation detection
- Personalized recommendations and crisis resources

### 🎙️ Immersive Mode
- Full-screen voice therapy experience
- Hands-free interaction with auto-pause detection
- Session time tracking
- Real-time audio visualization with animated orb

### 🛡️ Safety Features
- Crisis detection and immediate resource provision
- Hardcoded safety overrides for high-risk situations
- Tele-MANAS (14416) and Connecting Trust integration

## 🏗️ Architecture

### Frontend (React)
- **Framework**: React 18 with Hooks
- **Routing**: React Router
- **Animations**: Framer Motion
- **Voice**: Web Speech API (SpeechRecognition & SpeechSynthesis)
- **Audio**: Custom audio level visualization

### Backend (Python/FastAPI)
- **Framework**: FastAPI
- **LLM**: Llama 3.3 70B via Groq
- **RAG**: LangChain with FAISS vector store
- **Orchestration**: LangGraph for conversation flow
- **Clinical Analysis**: Multi-agent council system

## 🚀 Getting Started

### Prerequisites
- Python 3.9+
- Node.js 16+
- Groq API key

### Backend Setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
# Create .env file with:
GROQ_API_KEY=your_groq_api_key_here

# Download embedding model (first time only)
python download_model.py

# Build vector store from therapy documents
python vectorstore.py

# Start the server
python app.py
```

Backend runs on `http://localhost:8000`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

Frontend runs on `http://localhost:3000`

## 📁 Project Structure

```
doc-test/
├── backend/
│   ├── app.py              # FastAPI server
│   ├── graph.py            # LangGraph workflow
│   ├── council.py          # Multi-agent analysis
│   ├── rag.py              # RAG generation
│   ├── vectorstore.py      # FAISS vector store
│   ├── chunking.py         # Document processing
│   ├── requirements.txt    # Python dependencies
│   ├── prompts/            # System prompts
│   └── data/books/         # Therapy documents
│
└── frontend/
    ├── src/
    │   ├── App.jsx         # Main application
    │   ├── Chat.jsx        # Chat interface
    │   ├── ImmersiveMode.jsx    # Voice therapy
    │   ├── Assessment.jsx  # PHQ-9 assessment
    │   ├── Report.jsx      # Assessment results
    │   ├── components/     # Reusable components
    │   └── hooks/          # Custom React hooks
    └── public/
```

## 🔧 Configuration

### Backend Environment Variables
- `GROQ_API_KEY`: Your Groq API key for LLM access

### Vector Store
Place therapy documents in `backend/data/books/` and run:
```bash
python vectorstore.py
```

## 🎯 Key Components

### Council Analysis System
Multi-perspective mental health analysis:
- **Primary State**: Depression, anxiety, stress, neutral
- **Severity**: Mild, moderate, severe
- **Crisis Risk**: Low, medium, high
- **Recommended Modality**: CBT, mindfulness, crisis intervention

### RAG Pipeline
1. User input → Council analysis
2. Retrieve relevant therapy documents
3. Generate contextual response with LLM
4. Refine output (60-100 words)
5. Return with sources and council data

### Safety Override
High-risk inputs bypass normal flow and immediately provide crisis resources.

## 🔒 Privacy & Data

- Chat history stored locally (localStorage)
- No server-side persistence
- Assessment data stays on client
- Delete chat option available

## 🎨 UI/UX Features

- Glassmorphism design
- Smooth animations with Framer Motion
- Responsive mobile-first layout
- Dark theme optimized for focus
- Accessibility-friendly voice controls

## 📊 Clinical Validation

- PHQ-9: Validated depression screening tool
- Evidence-based therapy techniques (CBT, mindfulness)
- Structured response format for clinical safety

## ⚠️ Disclaimer

P.O.V is an AI-assisted mental health support tool. It is **NOT** a replacement for professional therapy. In crisis situations, always contact:
- **Tele-MANAS**: 14416 (24/7, Free)
- **Connecting Trust** (Pune): 9922001122
- Emergency services: 112

## 🛠️ Tech Stack

**Frontend:**
- React, React Router, Framer Motion
- Web Speech API
- Canvas API for visualizations

**Backend:**
- FastAPI, LangChain, LangGraph
- FAISS, HuggingFace Embeddings
- Groq (Llama 3.3 70B)

## 📝 License

This project is for educational and non-commercial use.

## 🤝 Contributing

This is a therapy application - contributions should prioritize clinical safety and user wellbeing.

---

**Built with care for mental health support** 💙
