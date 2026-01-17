import os
import time

# 1. Force a long timeout (120 seconds instead of 10)
# Set multiple timeout environment variables for different libraries
os.environ["HF_HUB_DOWNLOAD_TIMEOUT"] = "120"
os.environ["HTTPX_TIMEOUT"] = "120"
os.environ["REQUESTS_TIMEOUT"] = "120"

print("⏳ Starting robust model download (Timeout set to 120s)...")
print("   This may take 1-2 minutes. Please wait.")
print("   Common in hackathons with congested WiFi.")
print()

try:
    # Import and configure huggingface_hub before using embeddings
    from huggingface_hub import configure_http_backend
    import requests
    
    # Create a custom session with longer timeout
    def backend_factory() -> requests.Session:
        session = requests.Session()
        session.timeout = 120  # 120 seconds timeout
        return session
    
    # Configure the HTTP backend
    configure_http_backend(backend_factory=backend_factory)
    
    # Now import and use embeddings
    from langchain_huggingface import HuggingFaceEmbeddings
    
    # This line triggers the download and caches it locally
    print("[1/3] Downloading tokenizer files...")
    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2",
        model_kwargs={'device': 'cuda' if __import__('torch').cuda.is_available() else 'cpu'}
    )
    print("[2/3] Downloading model files...")
    # Force model initialization to complete download
    _ = embeddings.embed_query("test")
    print("[3/3] Verifying cache...")
    
    print("\n✅ SUCCESS: Model downloaded to local cache!")
    print("👉 You can now run 'python vectorstore.py' safely.")

except Exception as e:
    print(f"\n❌ Download failed again: {e}")
    print("\nTIPS:")
    print("- Try connecting to a mobile hotspot just for this step")
    print("- Ensure you have ~100MB free disk space")
    print("- Check your internet connection stability")
    print("- Try running again during off-peak hours")
