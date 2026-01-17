from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
import os

def load_and_chunk_pdf(file_path: str):
    """
    Loads PDF and chunks strictly by section.
    """
    try:
        loader = PyPDFLoader(file_path)
        raw_docs = loader.load()
        
        # Clinical Chunking: ~600 chars with overlap for precision retrieval
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=600,  
            chunk_overlap=60, 
            separators=["\n\n###", "\n\n", "\n", " ", ""],
            is_separator_regex=False
        )
        
        chunks = text_splitter.split_documents(raw_docs)
        
        # Clean Filename for Metadata (e.g., "cci_depression_01.pdf" -> "Depression Mod 1")
        filename = os.path.basename(file_path)
        clean_name = filename.replace(".pdf", "").replace("_", " ").title()
        
        for i, chunk in enumerate(chunks):
            chunk.metadata["chunk_id"] = f"{filename}_{i}"
            chunk.metadata["source"] = filename # Keep raw filename for system, clean for display later
            chunk.metadata["display_name"] = clean_name
            
        return chunks
    except Exception as e:
        print(f"❌ Error loading {file_path}: {e}")
        return []
