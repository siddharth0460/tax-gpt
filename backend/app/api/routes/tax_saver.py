from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any

from ...services.reasoning import strategy_generator
from ...services.reasoning import explanation_service
from ...services.retrieval.rag_tax_rules import invalidate_cache, get_regime_rules, warm_cache

router = APIRouter(prefix="/api/tax-strategy", tags=["Tax Strategy"])

class TaxFormInput(BaseModel):
    basic_salary: float = 0
    hra_received: float = 0
    other_allowances: float = 0
    other_income_interest: float = 0
    age: int = 30
    rent_paid: float = 0
    is_metro: bool = False
    home_loan_interest: float = 0
    home_loan_principal: float = 0
    sec80c_invested: float = 0
    nps_self: float = 0
    nps_employer: float = 0
    employer_type: str = "private"
    health_self: float = 0
    health_parents: float = 0
    parents_senior_citizen: bool = False
    self_senior_citizen: bool = False
    education_loan_interest: float = 0
    donations: float = 0

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
