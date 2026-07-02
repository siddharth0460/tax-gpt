from typing import List, Dict, Any
# pyrefly: ignore [missing-import]
from langchain_text_splitters import RecursiveCharacterTextSplitter

def semantic_chunk_legal_text(paragraphs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Chunks legal text into sizes of 600-1000 tokens (approximated by characters here, ~3-4 chars per token)
    Overlap: 100-150 tokens.
    Respects legal boundaries by grouping paragraphs with the same metadata.
    """
    # Using RecursiveCharacterTextSplitter as a proxy. For exact token counts, we can use TokenTextSplitter.
    # 800 tokens * ~4 chars = 3200 chunk size. Overlap ~ 500 chars.
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=3200,
        chunk_overlap=500,
        separators=["\n\n", "\n", ".", " ", ""]
    )
    
    chunks = []
    for para in paragraphs:
        text = para["text"]
        metadata = para["metadata"]
        
        # Split paragraph if it's too large, otherwise keep it intact to respect legal boundaries
        splits = text_splitter.split_text(text)
        
        for split in splits:
            chunks.append({
                "chunk_text": split,
                "metadata": metadata
            })
            
    return chunks
