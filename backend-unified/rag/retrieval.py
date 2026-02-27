"""
Unified Backend — RAG Retrieval Module
FAISS vector store search + PDF chunking.
Lifted from backend/vectorstore.py + backend/chunking.py
"""
import os
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from tqdm import tqdm

# Local embeddings (runs on GPU — RTX 3050)
embeddings = HuggingFaceEmbeddings(
    model_name="all-MiniLM-L6-v2",
    model_kwargs={"device": "cuda"},
)

# Paths — local to backend-unified
BASE_DIR = os.path.join(os.path.dirname(__file__), "..")
DB_PATH = os.path.join(BASE_DIR, "faiss_index")
DATA_DIR = os.path.join(BASE_DIR, "data", "books")


def load_and_chunk_pdf(file_path: str):
    """Load PDF and chunk by section (~600 chars)."""
    try:
        loader = PyPDFLoader(file_path)
        raw_docs = loader.load()

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=600,
            chunk_overlap=60,
            separators=["\n\n###", "\n\n", "\n", " ", ""],
            is_separator_regex=False,
        )

        chunks = text_splitter.split_documents(raw_docs)

        filename = os.path.basename(file_path)
        clean_name = filename.replace(".pdf", "").replace("_", " ").title()

        for i, chunk in enumerate(chunks):
            chunk.metadata["chunk_id"] = f"{filename}_{i}"
            chunk.metadata["source"] = filename
            chunk.metadata["display_name"] = clean_name

        return chunks
    except Exception as e:
        print(f"Error loading {file_path}: {e}")
        return []


def initialize_vector_store():
    """Ingests all PDFs from data/books and builds FAISS index."""
    all_chunks = []

    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR, exist_ok=True)
        return None

    files = [f for f in os.listdir(DATA_DIR) if f.endswith(".pdf")]
    if not files:
        print("No PDFs found in data/books.")
        return None

    print(f"Found {len(files)} clinical modules. Starting ingestion...")
    for file in tqdm(files, desc="Processing Modules"):
        chunks = load_and_chunk_pdf(os.path.join(DATA_DIR, file))
        all_chunks.extend(chunks)

    if not all_chunks:
        return None

    vectorstore = FAISS.from_documents(all_chunks, embeddings)
    vectorstore.save_local(DB_PATH)
    print("Knowledge Base Ready.")
    return vectorstore


def get_retriever(top_k: int = 3):
    """Returns the FAISS retriever, rebuilding if necessary."""
    if os.path.exists(DB_PATH):
        try:
            vectorstore = FAISS.load_local(
                DB_PATH, embeddings, allow_dangerous_deserialization=True
            )
            return vectorstore.as_retriever(search_kwargs={"k": top_k})
        except Exception:
            store = initialize_vector_store()
            if store:
                return store.as_retriever(search_kwargs={"k": top_k})
    else:
        store = initialize_vector_store()
        if store:
            return store.as_retriever(search_kwargs={"k": top_k})
    return None


def retrieve(query: str, top_k: int = 3):
    """Retrieve top-k documents for a query."""
    retriever = get_retriever(top_k)
    if retriever:
        return retriever.invoke(query)
    return []
