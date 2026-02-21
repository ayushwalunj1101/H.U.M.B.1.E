"""
Unified Backend — Citation Formatter
Structures raw retrieval metadata into frontend-ready JSON.
"""


def format_citations(docs) -> list:
    """
    Convert retrieved document objects into clean citation dicts.
    Returns deduplicated citations ordered by relevance rank.
    """
    if not docs:
        return []

    citations = []
    seen = set()

    for i, doc in enumerate(docs):
        source_name = doc.metadata.get("display_name", "Unknown Source")
        chunk_id = doc.metadata.get("chunk_id", "")
        page = doc.metadata.get("page", None)

        # Deduplicate by source name
        if source_name in seen:
            continue
        seen.add(source_name)

        citation = {
            "source_name": source_name,
            "chunk_id": chunk_id,
            "relevance_rank": i + 1,
        }

        if page is not None:
            citation["page"] = page

        citations.append(citation)

    return citations
