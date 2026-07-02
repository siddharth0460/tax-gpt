"""
RAG-based tax rule extraction service.

Searches a local JSON Page Index (built from Income Tax Act PDFs) for relevant
chunks, uses Groq LLM to extract structured section rules, and caches results.

Architecture:
  - Global params (slabs, rebate, cess): Hardcoded known values (budget-announced, change once/year)
  - Section limits (80C, 80D, etc.): Extracted via keyword RAG (Page Index → Groq LLM)

Cache layers:
  1. In-memory dict (fastest, lives for process lifetime)
  2. Disk JSON files in data/cache/ (survives restarts)
  3. Full RAG extraction (Page Index → Groq → structured dict)
  4. Static fallback JSON files (if everything else fails)
"""

import os
import json
import threading
from typing import Optional

from dotenv import load_dotenv
from groq import Groq

load_dotenv(override=True)

# ─────────────────────────────────────────────
#  Constants
# ─────────────────────────────────────────────

_CACHE_DIR = os.path.join(os.path.dirname(__file__), "../../../data/cache")
_DATA_DIR = os.path.join(os.path.dirname(__file__), "../../../data")
_INDEX_DIR = os.path.join(os.path.dirname(__file__), "../../../data/index")

# Sections to extract for each regime
_OLD_REGIME_SECTIONS = [
    {"code": "80C", "query": "Section 80C deduction limit investments PPF ELSS EPF LIC NSC tuition fees"},
    {"code": "80D_self", "query": "Section 80D health insurance premium deduction limit self spouse children below 60"},
    {"code": "80D_self_senior", "query": "Section 80D health insurance premium deduction limit self senior citizen above 60"},
    {"code": "80D_parents", "query": "Section 80D health insurance premium deduction limit parents below 60"},
    {"code": "80D_parents_senior", "query": "Section 80D health insurance premium deduction limit parents senior citizen above 60"},
    {"code": "80CCD(1B)", "query": "Section 80CCD 1B additional NPS contribution deduction limit"},
    {"code": "24(b)", "query": "Section 24b home loan interest deduction limit self occupied property"},
    {"code": "80E", "query": "Section 80E education loan interest deduction"},
    {"code": "80TTA", "query": "Section 80TTA savings account interest deduction limit"},
    {"code": "80G", "query": "Section 80G donation charitable funds deduction limit"},
]

_NEW_REGIME_SECTIONS = [
    {"code": "80CCD(2)_private", "keyword": "124"},
    {"code": "80CCD(2)_govt", "keyword": "124"},
]

# ─────────────────────────────────────────────
#  In-memory cache + lock
# ─────────────────────────────────────────────

_cache: dict[str, dict] = {}
_cache_lock = threading.Lock()

# ─────────────────────────────────────────────
#  Page Index keyword search
# ─────────────────────────────────────────────

def query_page_index(keyword: str, regime: str, top_k: int = 5) -> list[str]:
    """
    Search the local JSON Page Index for chunks containing the base section identifier.
    Returns the text of the matching chunks.
    """
    index_path = os.path.join(_INDEX_DIR, f"{regime}_regime_index.json")
    if not os.path.exists(index_path):
        print(f"[RAG] Index not found at {index_path}")
        return []
        
    with open(index_path, "r", encoding="utf-8") as f:
        index_data = json.load(f)
        
    chunks = index_data.get("chunks", [])
    
    import re
    # Extract base section ID (e.g. 80D_parents -> 80D, 80CCD(2)_private -> 80CCD, 24(b) -> 24)
    base_section_raw = keyword.split('_')[0]
    base_section = re.sub(r'\(.*?\)', '', base_section_raw)
    
    matches = []
    # Match the base section ensuring it isn't immediately followed by another letter 
    # (e.g. '80C' shouldn't match '80CCD')
    pattern = r'\b' + re.escape(base_section) + r'(?![A-Za-z])'
    
    for chunk in chunks:
        text = chunk.get("chunk_text", "")
        meta_section = chunk.get("metadata", {}).get("section", "")
        
        if re.search(pattern, text):
            # Prioritize chunks where the section identifier is in the parsed metadata heading
            if base_section in meta_section:
                matches.insert(0, text)
            else:
                matches.append(text)
                
    return matches[:top_k]


# ─────────────────────────────────────────────
#  LLM extraction helpers
# ─────────────────────────────────────────────

def _get_groq_client() -> Groq:
    return Groq(api_key=os.environ.get("GROQ_API_KEY"))


def _llm_extract_json(prompt: str) -> Optional[dict]:
    """Send prompt to Groq, parse JSON response."""
    client = _get_groq_client()
    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=1024,
        )
        content = response.choices[0].message.content.strip()
        # Strip markdown code fences if present
        if content.startswith("```json"):
            content = content[len("```json"):]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        return json.loads(content.strip())
    except Exception as e:
        print(f"[RAG] LLM extraction error: {e}")
        return None


# ─────────────────────────────────────────────
#  Global params (hardcoded — budget-announced)
# ─────────────────────────────────────────────

def _get_global_params(regime: str) -> dict:
    """
    Return the well-known global tax parameters for a regime.

    Tax slabs, standard deduction, rebate 87A, and cess are budget-announced values
    that are deterministic and well-defined. LLM extraction is unreliable for these
    (it frequently confuses old/new regime slabs or gets the rebate limit wrong by 10x).

    These values only change once a year when the Union Budget is presented.
    RAG is used only for section-level deduction limits, where the LLM excels.
    """
    if regime == "old":
        return {
            "standard_deduction": 50000,
            "rebate_87A": {"income_limit": 500000, "max_rebate": 12500},
            "cess_percentage": 0.04,
            "slabs": [
                {"min": 0, "max": 250000, "rate": 0.0},
                {"min": 250000, "max": 500000, "rate": 0.05},
                {"min": 500000, "max": 1000000, "rate": 0.20},
                {"min": 1000000, "max": None, "rate": 0.30},
            ],
        }
    else:
        return {
            "standard_deduction": 75000,
            "rebate_87A": {"income_limit": 1200000, "max_rebate": 60000},
            "cess_percentage": 0.04,
            "slabs": [
                {"min": 0, "max": 400000, "rate": 0.0},
                {"min": 400000, "max": 800000, "rate": 0.05},
                {"min": 800000, "max": 1200000, "rate": 0.10},
                {"min": 1200000, "max": 1600000, "rate": 0.15},
                {"min": 1600000, "max": 2000000, "rate": 0.20},
                {"min": 2000000, "max": 2400000, "rate": 0.25},
                {"min": 2400000, "max": None, "rate": 0.30},
            ],
        }


# ─────────────────────────────────────────────
#  Section extraction (RAG-based)
# ─────────────────────────────────────────────

# Known section metadata
_SECTION_META = {
    "80C": {
        "name": "PPF, ELSS, EPF, LIC, NSC, tuition fees, home loan principal",
        "applicable_regimes": ["old"], "condition": None,
        "expected_limit": 150000, "expected_type": "fixed",
    },
    "80D_self": {
        "name": "Health Insurance — self, spouse, children (below 60)",
        "applicable_regimes": ["old"], "condition": None,
        "expected_limit": 25000, "expected_type": "fixed",
    },
    "80D_self_senior": {
        "name": "Health Insurance — self, spouse, children (senior citizen)",
        "applicable_regimes": ["old"], "condition": "self_senior_citizen",
        "expected_limit": 50000, "expected_type": "fixed",
    },
    "80D_parents": {
        "name": "Health Insurance — parents (below 60)",
        "applicable_regimes": ["old"], "condition": None,
        "expected_limit": 25000, "expected_type": "fixed",
    },
    "80D_parents_senior": {
        "name": "Health Insurance — parents (senior citizen, 60+)",
        "applicable_regimes": ["old"], "condition": "parents_senior_citizen",
        "expected_limit": 50000, "expected_type": "fixed",
    },
    "80CCD(1B)": {
        "name": "NPS Additional Contribution (self, over and above 80C)",
        "applicable_regimes": ["old"], "condition": None,
        "expected_limit": 50000, "expected_type": "fixed",
    },
    "24(b)": {
        "name": "Home Loan Interest — self-occupied property",
        "applicable_regimes": ["old"], "condition": None,
        "expected_limit": 200000, "expected_type": "fixed",
    },
    "80E": {
        "name": "Education Loan Interest (no cap, up to 8 years)",
        "applicable_regimes": ["old"], "condition": None,
        "expected_limit": None, "expected_type": "no_cap",
    },
    "80TTA": {
        "name": "Savings Account Interest (non-senior citizens)",
        "applicable_regimes": ["old"], "condition": None,
        "expected_limit": 10000, "expected_type": "fixed",
    },
    "80G": {
        "name": "Donations to Charitable Funds",
        "applicable_regimes": ["old"], "condition": None,
        "expected_limit": None, "expected_type": "no_cap",
    },
    "80CCD(2)_private": {
        "name": "Employer NPS Contribution — private sector employees (10% of basic salary)",
        "applicable_regimes": ["new"], "condition": "private_sector",
        "expected_limit": None, "expected_type": "percentage_of_basic", "percentage": 0.10,
    },
    "80CCD(2)_govt": {
        "name": "Employer NPS Contribution — government employees (14% of basic salary)",
        "applicable_regimes": ["new"], "condition": "government_employee",
        "expected_limit": None, "expected_type": "percentage_of_basic", "percentage": 0.14,
    },
}


def _extract_section(code: str, keyword: str, regime: str) -> Optional[dict]:
    """Extract a single section's limits from the vector DB via RAG."""
    chunks = query_page_index(keyword, regime, top_k=3)
    if not chunks:
        print(f"[RAG] No chunks found for {code} in {regime}")
        return None

    combined_text = "\n\n".join(chunks)
    meta = _SECTION_META.get(code, {})

    prompt = f"""You are extracting structured data from the Indian Income Tax Act.

Extract the deduction limit for Section {code} from the text below.

Respond ONLY with valid JSON:
{{
  "limit_amount": <integer or null if no fixed cap>,
  "limit_type": "fixed" | "no_cap" | "percentage_of_basic",
  "percentage": <float like 0.10, only if limit_type is percentage_of_basic, otherwise omit>
}}

Known reference (verify against text): limit is approximately {meta.get('expected_limit', 'unknown')}, type is "{meta.get('expected_type', 'fixed')}".

Text:
{combined_text}

Respond ONLY with valid JSON, nothing else.
"""

    result = _llm_extract_json(prompt)
    if result:
        section = {
            "code": code,
            "name": meta.get("name", code),
            "limit_amount": result.get("limit_amount", meta.get("expected_limit")),
            "limit_type": result.get("limit_type", meta.get("expected_type", "fixed")),
            "applicable_regimes": meta.get("applicable_regimes", [regime]),
            "condition": meta.get("condition"),
        }
        if result.get("percentage"):
            section["percentage"] = result["percentage"]
        elif meta.get("percentage"):
            section["percentage"] = meta["percentage"]
        return section

    # Fallback: use known metadata
    print(f"[RAG] LLM extraction failed for {code}, using known defaults")
    section = {
        "code": code,
        "name": meta.get("name", code),
        "limit_amount": meta.get("expected_limit"),
        "limit_type": meta.get("expected_type", "fixed"),
        "applicable_regimes": meta.get("applicable_regimes", [regime]),
        "condition": meta.get("condition"),
    }
    if meta.get("percentage"):
        section["percentage"] = meta["percentage"]
    return section


# ─────────────────────────────────────────────
#  Full regime extraction
# ─────────────────────────────────────────────

def extract_structured_rules(regime: str) -> dict:
    """
    Run the full RAG extraction pipeline for a regime.
    Returns a structured dict with slabs, global params, and sections.
    """
    print(f"[RAG] Extracting structured rules for '{regime}' regime from Page Index...", flush=True)

    # 1. Get global params (hardcoded, no LLM needed)
    global_params = _get_global_params(regime)

    rules = {
        "regime": regime,
        "financial_year": "2025-26" if regime == "new" else "2024-25",
        "standard_deduction": global_params["standard_deduction"],
        "rebate_87A": global_params["rebate_87A"],
        "cess_percentage": global_params["cess_percentage"],
        "slabs": global_params["slabs"],
        "sections": [],
        "_source": "rag",
    }

    # 2. Extract individual sections via RAG
    section_defs = _OLD_REGIME_SECTIONS if regime == "old" else _NEW_REGIME_SECTIONS
    for sec_def in section_defs:
        print(f"[RAG]   Extracting {sec_def['code']}...", flush=True)
        keyword = sec_def.get("keyword", sec_def["code"])
        section = _extract_section(sec_def["code"], keyword, regime)
        if section:
            rules["sections"].append(section)

    # 3. Add deductions_not_available for new regime
    if regime == "new":
        rules["deductions_not_available"] = [
            {"code": "80C", "name": "PPF, ELSS, EPF, LIC, NSC, tuition fees, home loan principal",
             "reason": "Chapter VI-A deductions not available under new regime"},
            {"code": "80CCD(1B)", "name": "NPS additional self contribution",
             "reason": "Chapter VI-A deductions not available under new regime"},
            {"code": "80D", "name": "Health insurance premium",
             "reason": "Chapter VI-A deductions not available under new regime"},
            {"code": "24(b)", "name": "Home loan interest (self-occupied)",
             "reason": "Not available under new regime for self-occupied property"},
            {"code": "80E", "name": "Education loan interest",
             "reason": "Chapter VI-A deductions not available under new regime"},
            {"code": "80TTA", "name": "Savings account interest",
             "reason": "Chapter VI-A deductions not available under new regime"},
            {"code": "80G", "name": "Donations to charitable funds",
             "reason": "Chapter VI-A deductions not available under new regime"},
            {"code": "HRA", "name": "House Rent Allowance exemption u/s 10(13A)",
             "reason": "HRA exemption not available under new regime"},
            {"code": "LTA", "name": "Leave Travel Allowance u/s 10(5)",
             "reason": "LTA exemption not available under new regime"},
        ]

    print(f"[RAG] ✓ Extracted {len(rules['sections'])} sections for '{regime}' regime", flush=True)
    return rules


# ─────────────────────────────────────────────
#  Cache management
# ─────────────────────────────────────────────

def _cache_path(regime: str) -> str:
    return os.path.join(_CACHE_DIR, f"{regime}_regime_cache.json")


def _fallback_path(regime: str) -> str:
    return os.path.join(_DATA_DIR, f"{regime}_regime_rules.json")


def _save_to_disk_cache(regime: str, rules: dict) -> None:
    os.makedirs(_CACHE_DIR, exist_ok=True)
    path = _cache_path(regime)
    try:
        with open(path, "w") as f:
            json.dump(rules, f, indent=2)
        print(f"[RAG] Saved cache to {path}", flush=True)
    except Exception as e:
        print(f"[RAG] Failed to save cache: {e}", flush=True)


def _load_from_disk_cache(regime: str) -> Optional[dict]:
    path = _cache_path(regime)
    if os.path.exists(path):
        try:
            with open(path) as f:
                data = json.load(f)
            print(f"[RAG] Loaded from disk cache: {path}", flush=True)
            return data
        except Exception as e:
            print(f"[RAG] Disk cache corrupted: {e}", flush=True)
    return None


def _load_fallback(regime: str) -> Optional[dict]:
    path = _fallback_path(regime)
    if os.path.exists(path):
        try:
            with open(path) as f:
                data = json.load(f)
            print(f"[RAG] Loaded fallback from {path}", flush=True)
            return data
        except Exception as e:
            print(f"[RAG] Fallback file corrupted: {e}", flush=True)
    return None


# ─────────────────────────────────────────────
#  Public API
# ─────────────────────────────────────────────

def get_regime_rules(regime: str) -> dict:
    """
    Get structured tax rules for a regime.
    Check order: memory cache → disk cache → full RAG extraction → static fallback.
    Thread-safe.
    """
    if regime not in ("old", "new"):
        raise ValueError(f"Invalid regime: {regime}. Must be 'old' or 'new'.")

    # 1. Memory cache
    with _cache_lock:
        if regime in _cache:
            return _cache[regime]

    # 2. Disk cache
    rules = _load_from_disk_cache(regime)
    if rules:
        with _cache_lock:
            _cache[regime] = rules
        return rules

    # 3. Full RAG extraction
    try:
        rules = extract_structured_rules(regime)
        _save_to_disk_cache(regime, rules)
        with _cache_lock:
            _cache[regime] = rules
        return rules
    except Exception as e:
        print(f"[RAG] RAG extraction failed for {regime}: {e}", flush=True)

    # 4. Static fallback
    rules = _load_fallback(regime)
    if rules:
        with _cache_lock:
            _cache[regime] = rules
        return rules

    raise RuntimeError(
        f"Cannot load tax rules for '{regime}' regime. "
        "No cache, RAG extraction failed, and no fallback JSON file found."
    )


def invalidate_cache(regime: Optional[str] = None) -> None:
    """
    Clear cache for a specific regime or all regimes.
    Call this after re-ingesting PDFs.
    """
    with _cache_lock:
        if regime:
            _cache.pop(regime, None)
            path = _cache_path(regime)
            if os.path.exists(path):
                os.remove(path)
                print(f"[RAG] Removed cache file: {path}", flush=True)
        else:
            _cache.clear()
            os.makedirs(_CACHE_DIR, exist_ok=True)
            for r in ("old", "new"):
                path = _cache_path(r)
                if os.path.exists(path):
                    os.remove(path)
                    print(f"[RAG] Removed cache file: {path}", flush=True)
    print(f"[RAG] Cache invalidated for: {regime or 'all regimes'}", flush=True)


def warm_cache() -> None:
    """
    Pre-load rules for both regimes into memory.
    Call at server startup for instant first requests.
    """
    print("[RAG] Warming cache...", flush=True)
    for regime in ("old", "new"):
        get_regime_rules(regime)
    print("[RAG] Cache warm complete ✓", flush=True)
