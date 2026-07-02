# pyrefly: ignore [missing-import]
import fitz  # PyMuPDF
from typing import List, Dict, Any

def parse_legal_pdf(file_path: str) -> List[Dict[str, Any]]:
    """
    Parses a legal PDF (like the Income Tax Act) using PyMuPDF.
    Extracts text, pages, and attempts to preserve hierarchy based on font sizes or TOC.
    """
    doc = fitz.open(file_path)
    extracted_data = []

    # Simple heuristic to identify Chapters/Sections based on bold text or specific prefixes
    current_chapter = "Unknown"
    current_section = "Unknown"

    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        text_blocks = page.get_text("dict")["blocks"]

        for block in text_blocks:
            if "lines" in block:
                for line in block["lines"]:
                    for span in line["spans"]:
                        text = span["text"].strip()
                        if not text:
                            continue
                        
                        # Basic hierarchy detection heuristics
                        if text.upper().startswith("CHAPTER") and span["flags"] & 2**4: # Bold flag check
                            current_chapter = text
                        elif text.startswith("Section") or (text.split()[0].isdigit() and len(text.split()[0]) < 4):
                            current_section = text
                        
                        extracted_data.append({
                            "text": text,
                            "page_number": page_num + 1,
                            "chapter": current_chapter,
                            "section": current_section,
                            "font_size": span["size"],
                            "is_bold": bool(span["flags"] & 2**4)
                        })

    doc.close()
    return consolidate_paragraphs(extracted_data)

def consolidate_paragraphs(extracted_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Consolidates line-by-line spans into meaningful paragraphs while preserving metadata.
    """
    paragraphs = []
    current_para = []
    current_metadata = {}

    for item in extracted_data:
        if not current_para:
            current_metadata = {
                "chapter": item["chapter"],
                "section": item["section"],
                "page_number": item["page_number"]
            }
            current_para.append(item["text"])
        else:
            if item["chapter"] == current_metadata["chapter"] and item["section"] == current_metadata["section"]:
                current_para.append(item["text"])
            else:
                paragraphs.append({
                    "text": " ".join(current_para),
                    "metadata": current_metadata.copy()
                })
                current_metadata = {
                    "chapter": item["chapter"],
                    "section": item["section"],
                    "page_number": item["page_number"]
                }
                current_para = [item["text"]]
    
    if current_para:
        paragraphs.append({
            "text": " ".join(current_para),
            "metadata": current_metadata
        })
        
    return paragraphs
