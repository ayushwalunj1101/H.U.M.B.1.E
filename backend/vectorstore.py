import os
import torch

# ⚠️ CRITICAL: Set timeouts BEFORE any imports
os.environ["HF_HUB_DOWNLOAD_TIMEOUT"] = "120"
os.environ["HTTPX_TIMEOUT"] = "120"
os.environ["REQUESTS_TIMEOUT"] = "120"

# Configure HTTP backend for long timeout
try:
    from huggingface_hub import configure_http_backend
    import requests
    
    def backend_factory() -> requests.Session:
        session = requests.Session()
        session.timeout = 120  # 120 seconds
        return session
    
    configure_http_backend(backend_factory=backend_factory)
except Exception:
    pass  # If already configured, skip

from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from chunking import load_and_chunk_pdf
from tqdm import tqdm  # Progress bar

# 🚀 GPU CONFIGURATION 
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"⚙️  Vector Store utilizing: {DEVICE.upper()} (RTX 3050 Optimized)")

# Embeddings (Runs on GPU)
embeddings = HuggingFaceEmbeddings(
    model_name="all-MiniLM-L6-v2",
    model_kwargs={'device': DEVICE},
    encode_kwargs={'normalize_embeddings': True}
)

DB_PATH = "faiss_index"
DATA_DIR = "data/books"

def initialize_vector_store():
    """Ingests ALL PDF modules from data/books."""
    all_chunks = []
    
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR, exist_ok=True)
        return None

    files = [f for f in os.listdir(DATA_DIR) if f.endswith(".pdf")]
    
    if not files:
        print("⚠️ No PDFs found. Please add your module files.")
        return None

    print(f"📚 Found {len(files)} clinical modules. Starting ingestion...")
    
    # Progress Bar for user sanity
    for file in tqdm(files, desc="Processing Modules"):
        chunks = load_and_chunk_pdf(os.path.join(DATA_DIR, file))
        all_chunks.extend(chunks)

    if not all_chunks:
        return None
        
    print(f"💾 Embeddings generated for {len(all_chunks)} chunks. Saving index...")
    vectorstore = FAISS.from_documents(all_chunks, embeddings)
    vectorstore.save_local(DB_PATH)
    print("✅ Knowledge Base Ready.")
    return vectorstore

def get_retriever():
    """Returns the retriever, rebuilding if necessary."""
    if os.path.exists(DB_PATH):
        try:
            vectorstore = FAISS.load_local(
                DB_PATH, 
                embeddings, 
                allow_dangerous_deserialization=True
            )
            return vectorstore.as_retriever(search_kwargs={"k": 3}) # Top 3 chunks for precision
        except Exception:
            return initialize_vector_store().as_retriever(search_kwargs={"k": 3})
    else:
        store = initialize_vector_store()
        if store:
            return store.as_retriever(search_kwargs={"k": 3})
        return None

if __name__ == "__main__":
    print("🚀 Starting Manual Ingestion...")
    print("   This will process all PDFs and build the vector store.")
    print()
    initialize_vector_store()
    print()
    print("✅ Vector store build complete!")
    print("   You can now run: python app.py")
