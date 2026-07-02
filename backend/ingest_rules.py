import os
import sys
import argparse
import time
import json

# Ensure backend root is in sys path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.ingestion.parser import parse_legal_pdf
from app.services.ingestion.chunker import semantic_chunk_legal_text

REGIME_CONFIG = {
    "old": {
        "pdf_path": "data/source_pdfs/income-tax-Act-1961.pdf",
        "index_path": "data/index/old_regime_index.json",
        "regime_label": "old"
    },
    "new": {
        "pdf_path": "data/source_pdfs/income-tax-Act-2025.pdf",
        "index_path": "data/index/new_regime_index.json",
        "regime_label": "new"
    }
}

def main():
    parser = argparse.ArgumentParser(description="Ingest tax rules into local JSON Page Index")
    parser.add_argument("--regime", choices=["old", "new"], required=True, help="Tax regime to ingest")
    args = parser.parse_args()

    config = REGIME_CONFIG[args.regime]
    base_dir = os.path.dirname(os.path.abspath(__file__))
    pdf_path = os.path.join(base_dir, config["pdf_path"])
    index_path = os.path.join(base_dir, config["index_path"])
    regime_label = config["regime_label"]
    source_pdf = os.path.basename(pdf_path)

    if not os.path.exists(pdf_path):
        print(f"Error: Source PDF not found at {pdf_path}")
        return

    os.makedirs(os.path.dirname(index_path), exist_ok=True)

    start_time = time.time()
    print(f"Processing {source_pdf} for {regime_label} regime...")
    
    print("1. Parsing PDF...")
    paragraphs = parse_legal_pdf(pdf_path)
    print(f"   Extracted {len(paragraphs)} logical paragraphs.")
    
    print("2. Chunking text...")
    chunks = semantic_chunk_legal_text(paragraphs)
    print(f"   Created {len(chunks)} semantic chunks.")
    
    print("3. Saving to Page Index (JSON)...")
    
    index_data = {
        "regime": regime_label,
        "source_pdf": source_pdf,
        "chunks": chunks
    }
    
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(index_data, f, ensure_ascii=False, indent=2)
    
    elapsed = time.time() - start_time
    print(f"Successfully created Page Index with {len(chunks)} chunks at '{index_path}' in {elapsed:.2f} seconds.")

    # Invalidate the RAG cache for this regime so next request triggers fresh extraction
    try:
        from app.services.retrieval.rag_tax_rules import invalidate_cache
        invalidate_cache(regime_label)
        print(f"RAG cache invalidated for '{regime_label}' regime.")
    except Exception as e:
        print(f"Warning: Could not invalidate RAG cache: {e}")

if __name__ == "__main__":
    main()
