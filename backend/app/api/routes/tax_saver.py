from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, Union

from ...services.reasoning import strategy_generator
from ...services.reasoning import explanation_service
from ...services.retrieval.rag_tax_rules import invalidate_cache, get_regime_rules, warm_cache

router = APIRouter(prefix="/api/tax-strategy", tags=["Tax Strategy"])

class TaxFormInput(BaseModel):
    basic_salary: float = Field(default=0, ge=0)
    hra_received: float = Field(default=0, ge=0)
    other_allowances: float = Field(default=0, ge=0)
    other_income_interest: float = Field(default=0, ge=0)
    age: Optional[Union[int, float, str]] = 30
    rent_paid: float = Field(default=0, ge=0)
    is_metro: bool = False
    home_loan_interest: float = Field(default=0, ge=0)
    home_loan_principal: float = Field(default=0, ge=0)
    sec80c_invested: float = Field(default=0, ge=0)
    nps_self: float = Field(default=0, ge=0)
    nps_employer: float = Field(default=0, ge=0)
    employer_type: Optional[str] = "private"
    health_self: float = Field(default=0, ge=0)
    health_parents: float = Field(default=0, ge=0)
    parents_senior_citizen: bool = False
    self_senior_citizen: bool = False
    education_loan_interest: float = Field(default=0, ge=0)
    donations: float = Field(default=0, ge=0)

@router.post("/")
async def get_tax_strategy(form_data: TaxFormInput):
    """
    Generates a personalized tax saving strategy directly for an end user, 
    based on their submitted form data.
    """
    try:
        calc_result = strategy_generator.generate_strategy(form_data.model_dump())
        winner = calc_result["regime_comparison"]["winner"]
        explanation, source = explanation_service.explain(calc_result, regime_for_grounding=winner)
        
        return {
            **calc_result, 
            "explanation": explanation,
            "explanation_source": source
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate strategy: {str(e)}")

@router.post("/refresh-rules")
async def refresh_rules():
    """
    Invalidate the RAG cache and re-extract rules from the Page Index.
    Call this after re-ingesting PDFs to pick up new data.
    """
    try:
        invalidate_cache()
        # Re-warm the cache so the next user request is fast
        old_rules = get_regime_rules("old")
        new_rules = get_regime_rules("new")
        return {
            "status": "ok",
            "message": "Rules refreshed from local Page Index",
            "old_sections_count": len(old_rules.get("sections", [])),
            "new_sections_count": len(new_rules.get("sections", [])),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to refresh rules: {str(e)}")

@router.get("/cache-status")
async def cache_status():
    """
    Check whether the RAG cache is populated or if rules are coming from fallback.
    """
    import os
    cache_dir = os.path.join(os.path.dirname(__file__), "../../../data/cache")
    old_cache = os.path.exists(os.path.join(cache_dir, "old_regime_cache.json"))
    new_cache = os.path.exists(os.path.join(cache_dir, "new_regime_cache.json"))
    
    return {
        "old_regime_cached": old_cache,
        "new_regime_cached": new_cache,
        "source": "rag_cache" if (old_cache and new_cache) else "fallback_or_live",
    }

# ─── History Storage ──────────────────────────────────────────
import json
import time
import secrets
from pathlib import Path
from fastapi import Header, Query

HISTORY_FILE = Path(__file__).resolve().parent.parent.parent.parent / "data" / "history.json"

def _ensure_history_store() -> Dict[str, Any]:
    HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not HISTORY_FILE.exists():
        initial = {"items": []}
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(initial, f, indent=2)
        return initial
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"items": []}

def _save_history_store(data: Dict[str, Any]):
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

class HistorySaveRequest(BaseModel):
    user_id: Optional[str] = "anonymous"
    user_email: Optional[str] = None
    form_data: Dict[str, Any]
    result: Dict[str, Any]
    title: Optional[str] = None

@router.get("/history")
async def get_history(
    user_id: Optional[str] = Query(None),
    user_email: Optional[str] = Query(None),
):
    """
    Fetch vertical history list of past tax calculations for a user.
    """
    store = _ensure_history_store()
    items = store.get("items", [])
    if user_email:
        items = [i for i in items if i.get("user_email") == user_email]
    elif user_id:
        items = [i for i in items if i.get("user_id") == user_id]
    
    # Sort descending by timestamp
    items.sort(key=lambda x: x.get("timestamp", 0), reverse=True)
    return {"items": items}

@router.post("/history")
async def save_history_item(req: HistorySaveRequest):
    """
    Save a new strategy calculation to the user's vertical history.
    """
    store = _ensure_history_store()
    item_id = f"hist_{secrets.token_hex(6)}"
    
    # Extract summary metrics for fast card preview
    winner = req.result.get("regime_comparison", {}).get("winner", "optimal")
    savings = req.result.get("regime_comparison", {}).get("savings", 0)
    old_tax = req.result.get("regime_comparison", {}).get("old_tax", 0)
    new_tax = req.result.get("regime_comparison", {}).get("new_tax", 0)
    basic_salary = req.form_data.get("basic_salary", 0)

    title = req.title or f"Tax Plan ₹{basic_salary:,.0f} • {winner.title()} Regime"

    new_item = {
        "id": item_id,
        "user_id": req.user_id or "anonymous",
        "user_email": req.user_email,
        "timestamp": int(time.time()),
        "title": title,
        "winner": winner,
        "savings": savings,
        "old_tax": old_tax,
        "new_tax": new_tax,
        "basic_salary": basic_salary,
        "form_data": req.form_data,
        "result": req.result,
    }

    store["items"].append(new_item)
    _save_history_store(store)

    return {"status": "ok", "item": new_item}

@router.delete("/history/{item_id}")
async def delete_history_item(item_id: str):
    store = _ensure_history_store()
    initial_len = len(store.get("items", []))
    store["items"] = [i for i in store.get("items", []) if i.get("id") != item_id]
    _save_history_store(store)
    return {"status": "ok", "deleted": initial_len - len(store["items"])}

@router.delete("/history")
async def clear_history(
    user_id: Optional[str] = Query(None),
    user_email: Optional[str] = Query(None),
):
    store = _ensure_history_store()
    if user_email:
        store["items"] = [i for i in store.get("items", []) if i.get("user_email") != user_email]
    elif user_id:
        store["items"] = [i for i in store.get("items", []) if i.get("user_id") != user_id]
    else:
        store["items"] = []
    _save_history_store(store)
    return {"status": "ok", "message": "History cleared"}

