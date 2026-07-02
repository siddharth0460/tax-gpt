import json
import os
from typing import Any

from app.services.retrieval.rag_tax_rules import get_regime_rules

# ─────────────────────────────────────────────
#  Rule loading (via RAG service with caching)
# ─────────────────────────────────────────────

def load_regime_rules() -> tuple[dict, dict]:
    """
    Load tax rules for both regimes via the RAG service.
    The service checks: memory cache → disk cache → Page Index RAG → static fallback.
    """
    old_rules = get_regime_rules("old")
    new_rules = get_regime_rules("new")
    return old_rules, new_rules


# ─────────────────────────────────────────────
#  HRA exemption (three-way minimum)
# ─────────────────────────────────────────────

def compute_hra_exemption(
    hra_received: float,
    rent_paid: float,
    basic: float,
    is_metro: bool,
) -> float:
    if rent_paid <= 0 or hra_received <= 0:
        return 0.0
    rent_minus_10pct = max(0.0, rent_paid - 0.10 * basic)
    city_pct = 0.50 if is_metro else 0.40
    return min(hra_received, rent_minus_10pct, city_pct * basic)


# ─────────────────────────────────────────────
#  Condition evaluator
# ─────────────────────────────────────────────

def _section_applies(section: dict, form_data: dict) -> bool:
    """
    Returns True if this section row is relevant for the given user.
    Conditions are stored on the section row; form_data supplies user answers.
    """
    condition = section.get("condition")

    if condition is None:
        # Base sections (non-senior) shouldn't apply if the user qualifies for the senior version
        code = section.get("code")
        if code == "80D_parents" and bool(form_data.get("parents_senior_citizen", False)):
            return False
        if code == "80D_self" and bool(form_data.get("self_senior_citizen", False)):
            return False
        return True
    if condition == "parents_senior_citizen":
        return bool(form_data.get("parents_senior_citizen", False))
    if condition == "self_senior_citizen":
        return bool(form_data.get("self_senior_citizen", False))
    if condition == "private_sector":
        return form_data.get("employer_type", "private") == "private"
    if condition == "government_employee":
        return form_data.get("employer_type", "private") == "government"

    # Unknown condition — include the section but log a warning
    print(f"[WARN] Unknown condition '{condition}' on section {section.get('code')} — including by default")
    return True


# ─────────────────────────────────────────────
#  Limit resolver
# ─────────────────────────────────────────────

def _resolve_limit(section: dict, form_data: dict) -> float | None:
    """
    Returns the computed numeric limit for this section, or None if uncapped.
    Never silently defaults — raises if a required field is missing.
    """
    limit_type = section.get("limit_type")
    code = section.get("code")

    if limit_type == "fixed":
        limit = section.get("limit_amount")
        if limit is None:
            raise ValueError(
                f"Section {code} has limit_type 'fixed' but limit_amount is null. "
                "Fix old_regime_rules.json."
            )
        return float(limit)

    if limit_type == "no_cap":
        return None  # no upper bound — room = None, shown as "unlimited"

    if limit_type in ("percentage_of_basic", "percentage_of_income"):
        pct = section.get("percentage")
        if pct is None:
            if code == "80CCD(2)":
                employer_type = form_data.get("employer_type", "private")
                pct = 0.14 if employer_type == "government" else 0.10
            else:
                raise ValueError(
                    f"Section {code} has limit_type '{limit_type}' but 'percentage' key is missing. "
                    "Fix the regime rules JSON."
                )
        basic = form_data.get("basic_salary", 0)
        return round(basic * pct, 2)

    raise ValueError(
        f"Section {code} has unknown limit_type '{limit_type}'. "
        "Supported types: fixed, no_cap, percentage_of_basic, percentage_of_income."
    )


# ─────────────────────────────────────────────
#  Used-amount resolver
# ─────────────────────────────────────────────

# Maps section codes to the form field(s) that contribute to the used amount.
# For multi-field sections (e.g. 80D_self covers health_self only),
# keep each row scoped tightly so the mapping stays unambiguous.
_USED_AMOUNT_MAP: dict[str, list[str]] = {
    "80C":                  ["sec80c_invested", "home_loan_principal"],
    "80CCD(1B)":            ["nps_self"],
    "80CCD(2)_private":     ["nps_employer"],
    "80CCD(2)_govt":        ["nps_employer"],
    "80CCD(2)":             ["nps_employer"], # fallback for unmodified json
    "80D_self":             ["health_self"],
    "80D_self_senior":      ["health_self"],
    "80D_parents":          ["health_parents"],
    "80D_parents_senior":   ["health_parents"],
    "24(b)":                ["home_loan_interest"],
    "80E":                  ["education_loan_interest"],
    "80TTA":                ["other_income_interest"],
    "80G":                  ["donations"],
}

def _resolve_used(section: dict, form_data: dict) -> float:
    code = section.get("code", "")
    fields = _USED_AMOUNT_MAP.get(code, [])
    return sum(float(form_data.get(f, 0) or 0) for f in fields)


# ─────────────────────────────────────────────
#  Main section-room computation
# ─────────────────────────────────────────────

def compute_section_room(sections: list[dict], form_data: dict) -> list[dict]:
    """
    For each section in the rules JSON:
    1. Skip if the condition doesn't match this user
    2. Resolve the computed limit (fixed, uncapped, or % of basic)
    3. Resolve the amount the user has already invested/paid
    4. Compute room remaining and approximate tax saving at 20% marginal rate

    Returns a list of dicts ready for the API response.
    """
    results = []

    for section in sections:
        # Skip rows that don't apply to this user
        if not _section_applies(section, form_data):
            continue

        code    = section.get("code", "")
        name    = section.get("name", "")
        regimes = section.get("applicable_regimes", ["old"])

        used  = _resolve_used(section, form_data)
        limit = _resolve_limit(section, form_data)  # None = no cap

        if limit is None:
            # Uncapped sections: show used amount, room displayed as "No limit"
            room             = None
            potential_saving = None
        else:
            # Cap used at limit (can't over-claim)
            used  = min(used, limit)
            room  = max(0.0, limit - used)
            # Approximate saving at 20% (safe middle-of-road assumption;
            # actual rate depends on the user's slab, which we compute separately)
            potential_saving = round(room * 0.20, 2)

        results.append({
            "code":              code,
            "name":              name,
            "used":              round(used, 2),
            "limit":             limit if limit is not None else "No limit",
            "room":              room if room is not None else "No limit",
            "potential_saving":  potential_saving,
            "applicable_regimes": regimes,
            "condition":         section.get("condition"),
        })

    return results


# ─────────────────────────────────────────────
#  Tax computation (pure arithmetic)
# ─────────────────────────────────────────────

def compute_tax(taxable_income: float, regime: dict) -> float:
    """
    Slab-wise tax + 87A rebate + cess.
    Raises if any required key is missing — never silently defaults.
    """
    if taxable_income <= 0:
        return 0.0

    slabs = regime.get("slabs")
    if not slabs:
        raise ValueError("Regime rules missing 'slabs'. Re-run extract_rule_limits.py.")

    tax = 0.0
    for slab in sorted(slabs, key=lambda s: s["min"]):
        min_val = slab["min"]
        max_val = slab.get("max")   # None = no upper bound
        rate    = slab["rate"]

        if taxable_income > min_val:
            taxable_in_slab = taxable_income - min_val
            if max_val is not None:
                taxable_in_slab = min(taxable_in_slab, max_val - min_val)
            tax += taxable_in_slab * rate

    # 87A rebate
    rebate_cfg = regime.get("rebate_87A")
    if rebate_cfg is None:
        raise ValueError("Regime rules missing 'rebate_87A'. Re-run extract_rule_limits.py.")

    if taxable_income <= rebate_cfg["income_limit"]:
        tax = max(0.0, tax - rebate_cfg["max_rebate"])
    elif regime.get("regime") == "new":
        # Marginal relief for Section 87A is specifically available under the new tax regime.
        # It ensures that tax payable does not exceed the income exceeding the rebate limit.
        excess_income = taxable_income - rebate_cfg["income_limit"]
        if tax > excess_income:
            tax = excess_income

    # Health & education cess
    cess_pct = regime.get("cess_percentage")
    if cess_pct is None:
        raise ValueError("Regime rules missing 'cess_percentage'. Re-run extract_rule_limits.py.")

    return round(tax * (1 + cess_pct), 2)


# ─────────────────────────────────────────────
#  Regime comparison
# ─────────────────────────────────────────────

def compute_regime_comparison(
    form_data: dict,
    old_sections: list[dict],
    old_rules: dict,
    new_rules: dict,
) -> dict:
    gross_income = (
        float(form_data.get("basic_salary",           0) or 0) +
        float(form_data.get("hra_received",           0) or 0) +
        float(form_data.get("other_allowances",       0) or 0) +
        float(form_data.get("other_income_interest",  0) or 0)
    )

    # ── Old regime ──────────────────────────────
    old_std = old_rules.get("standard_deduction")
    if old_std is None:
        raise ValueError("old_regime_rules.json missing 'standard_deduction'.")

    hra_exemption = compute_hra_exemption(
        float(form_data.get("hra_received", 0) or 0),
        float(form_data.get("rent_paid",    0) or 0),
        float(form_data.get("basic_salary", 0) or 0),
        bool(form_data.get("is_metro", False)),
    )

    # Sum all section deductions the user has actually used (old regime only)
    old_section_deductions = sum(
        sec["used"]
        for sec in old_sections
        if "old" in sec.get("applicable_regimes", [])
        and isinstance(sec["used"], (int, float))
    )

    old_taxable = max(0.0, gross_income - old_std - hra_exemption - old_section_deductions)
    old_tax     = compute_tax(old_taxable, old_rules)

    # ── New regime ──────────────────────────────
    new_std = new_rules.get("standard_deduction")
    if new_std is None:
        raise ValueError("new_regime_rules.json missing 'standard_deduction'.")

    # Only 80CCD(2) is deductible under the new regime
    nps_employer_used = float(form_data.get("nps_employer", 0) or 0)
    basic             = float(form_data.get("basic_salary", 0) or 0)
    employer_type     = form_data.get("employer_type", "private")
    nps_employer_pct  = 0.14 if employer_type == "government" else 0.10
    nps_employer_limit = basic * nps_employer_pct
    nps_employer_deduction = min(nps_employer_used, nps_employer_limit)

    new_taxable = max(0.0, gross_income - new_std - nps_employer_deduction)
    new_tax     = compute_tax(new_taxable, new_rules)

    winner  = "old" if old_tax < new_tax else "new"
    savings = round(abs(old_tax - new_tax), 2)

    return {
        "old_tax":      old_tax,
        "new_tax":      new_tax,
        "old_taxable":  round(old_taxable, 2),
        "new_taxable":  round(new_taxable, 2),
        "hra_exemption": round(hra_exemption, 2),
        "winner":       winner,
        "savings":      savings,
    }


# ─────────────────────────────────────────────
#  Main entrypoint
# ─────────────────────────────────────────────

def generate_strategy(form_data: dict) -> dict:
    """
    Loads both regime rule files, runs all calculations deterministically,
    returns a single structured result. Zero LLM calls here.
    """
    old_rules, new_rules = load_regime_rules()

    # Section room — old regime sections only
    old_sections = compute_section_room(
        old_rules.get("sections", []),
        form_data,
    )

    # New regime sections (currently only 80CCD(2))
    new_sections = compute_section_room(
        new_rules.get("sections", []),
        form_data,
    )

    comparison = compute_regime_comparison(
        form_data,
        old_sections,
        old_rules,
        new_rules,
    )

    return {
        "old_regime_sections": old_sections,
        "new_regime_sections": new_sections,
        "regime_comparison":   comparison,
    }
