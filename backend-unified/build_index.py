"""
FAISS Index Builder — Run this ONCE to chunk all PDFs and build the vector store.
Usage: python build_index.py
"""
import os
import sys

# Ensure we can import from project root
sys.path.insert(0, os.path.dirname(__file__))

from rag.retrieval import initialize_vector_store, DB_PATH, DATA_DIR


def main():
    print("=" * 55)
    print("  FAISS Index Builder")
    print("=" * 55)
    print()

    # Check data directory
    if not os.path.exists(DATA_DIR):
        print(f"ERROR: Data directory not found: {DATA_DIR}")
        print("Create it and add your clinical PDFs there.")
        sys.exit(1)

    pdfs = [f for f in os.listdir(DATA_DIR) if f.endswith(".pdf")]
    print(f"Found {len(pdfs)} PDFs in {DATA_DIR}")

    if not pdfs:
        print("No PDF files found! Add PDFs to data/books/ and re-run.")
        sys.exit(1)

    for f in pdfs:
        print(f"  - {f}")
    print()

    # Check if index already exists
    if os.path.exists(DB_PATH):
        print(f"WARNING: FAISS index already exists at {DB_PATH}")
        resp = input("Rebuild? (y/N): ").strip().lower()
        if resp != "y":
            print("Skipped. Existing index preserved.")
            return

    print()
    print("Chunking PDFs and building FAISS index...")
    print("(This may take a few minutes depending on the number of PDFs)")
    print()

    store = initialize_vector_store()

    if store:
        print()
        print(f"SUCCESS! FAISS index saved to: {DB_PATH}")
        print("You can now start the backend with: python main.py")
    else:
        print()
        print("FAILED: No chunks were generated. Check your PDFs.")
        sys.exit(1)


if __name__ == "__main__":
    main()
