import os
from typing import Dict
from app.services.retrieval.rag_tax_rules import query_page_index

def get_grounding_chunks(calc_result: dict, regime: str) -> Dict[str, str]:
    """
    Returns {section_code: chunk_text} for every section in calc_result
    that has room > 0, fetched from the local Page Index JSON.
    """
    chunk_map = {}
    sections = calc_result.get(f"{regime}_regime_sections", [])

    for section in sections:
        if isinstance(section.get("room"), (int, float)) and section["room"] > 0:
            code = section["code"]
            try:
                # We use query_page_index directly with the section code
                # It will automatically extract the base section (e.g., 80D_parents -> 80D)
                # and fetch the relevant chunk from the local JSON index.
                chunks = query_page_index(keyword=code, regime=regime, top_k=1)
                if chunks:
                    chunk_map[code] = chunks[0]
            except Exception as e:
                print(f"[WARN] Could not fetch grounding chunk for {code}: {e}")

    return chunk_map
