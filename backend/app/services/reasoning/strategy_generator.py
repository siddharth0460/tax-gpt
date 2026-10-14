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
    code = section.get("code", "")
    age = float(form_data.get("age", 30) or 30)
    is_self_senior = bool(form_data.get("self_senior_citizen", False)) or age >= 60
    is_parents_senior = bool(form_data.get("parents_senior_citizen", False))
    employer_type = form_data.get("employer_type") or "private"

    # 80TTA is only for non-senior citizens (< 60)
    if code == "80TTA" and is_self_senior:
        return False
    # 80TTB is only for senior citizens (60+)
    if code == "80TTB" and not is_self_senior:
        return False

    if condition is None:
        # Base sections (non-senior) shouldn't apply if the user qualifies for the senior version
        if code == "80D_parents" and is_parents_senior:
            return False
        if code == "80D_self" and is_self_senior:
            return False
        return True

    if condition == "parents_senior_citizen":
        return is_parents_senior
    if condition == "self_senior_citizen":
        return is_self_senior
    if condition == "private_sector":
        return employer_type == "private"
    if condition == "government_employee":
        return employer_type == "government"

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
        employer_type = form_data.get("employer_type") or "private"
        if code == "80CCD(2)_govt":
            pct = 0.14
        elif code == "80CCD(2)_private":
            pct = 0.10
        elif code == "80CCD(2)":
            pct = 0.14 if employer_type == "government" else 0.10
        else:
            pct = section.get("percentage")
            if pct is None:
                raise ValueError(
                    f"Section {code} has limit_type '{limit_type}' but 'percentage' key is missing. "
                    "Fix the regime rules JSON."
                )
        basic = max(0.0, float(form_data.get("basic_salary", 0) or 0))
        return round(basic * pct, 2)

    raise ValueError(
        f"Section {code} has unknown limit_type '{limit_type}'. "
        "Supported types: fixed, no_cap, percentage_of_basic, percentage_of_income."
    )


# ─────────────────────────────────────────────
#  Used-amount resolver
# ─────────────────────────────────────────────

_USED_AMOUNT_MAP: dict[str, list[str]] = {
    "80C":                  ["sec80c_invested", "home_loan_principal"],
    "80CCD(1B)":            ["nps_self"],
    "80CCD(2)_private":     ["nps_employer"],
    "80CCD(2)_govt":        ["nps_employer"],
    "80CCD(2)":             ["nps_employer"],
    "80D_self":             ["health_self"],
    "80D_self_senior":      ["health_self"],
    "80D_parents":          ["health_parents"],
    "80D_parents_senior":   ["health_parents"],
    "24(b)":                ["home_loan_interest"],
    "80E":                  ["education_loan_interest"],
    "80TTA":                ["other_income_interest"],
    "80TTB":                ["other_income_interest"],
    "80G":                  ["donations"],
}

def _resolve_used(section: dict, form_data: dict) -> float:
    code = section.get("code", "")
    fields = _USED_AMOUNT_MAP.get(code, [])
    return max(0.0, sum(max(0.0, float(form_data.get(f, 0) or 0)) for f in fields))


# ─────────────────────────────────────────────
#  Marginal rate helper
# ─────────────────────────────────────────────

def get_marginal_rate(taxable_income: float, slabs: list[dict]) -> float:
    """
    Returns the tax rate of the highest slab the user's taxable income
    falls into — i.e. the rate at which their next rupee is taxed.
    This is the correct rate to estimate additional tax saving from
    a new deduction under this regime.

    Examples:
      taxable = ₹13,00,000, new regime slabs → falls in 12L-16L @ 15% → 0.15
      taxable = ₹14,16,000, old regime slabs → falls in 10L+ @ 30%    → 0.30
      taxable = ₹3,50,000,  new regime slabs → falls in 3L-7L @ 5%    → 0.05
    """
    marginal_rate = 0.0
    for slab in sorted(slabs, key=lambda s: s["min"]):
        if taxable_income > slab["min"]:
            marginal_rate = slab["rate"]
    return marginal_rate


# ─────────────────────────────────────────────
#  Main section-room computation
# ─────────────────────────────────────────────

def compute_section_room(
    sections: list[dict],
    form_data: dict,
    taxable_income: float = 0.0,
    regime_slabs: list[dict] = None,
    cess_pct: float = 0.04,
    current_tax: float = None,
) -> list[dict]:
    """
    For each section in the rules JSON:
    1. Skip if the condition doesn't match this user
    2. Resolve the computed limit (fixed, uncapped, or % of basic)
    3. Resolve the amount the user has already invested/paid
    4. Compute room remaining and accurate tax saving at the user's
       actual marginal rate (capped at actual tax payable)

    Returns a list of dicts ready for the API response.
    """
    marginal_rate = get_marginal_rate(taxable_income, regime_slabs) if regime_slabs else 0.20
    results = []

    for section in sections:
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
            # Cap used at limit (can't over-claim or be negative)
            used  = max(0.0, min(used, limit))
            room  = max(0.0, limit - used)

            # If the user already owes ₹0 in tax under this regime, extra deductions cannot save tax
            if current_tax is not None and current_tax <= 0:
                potential_saving = 0.0
            else:
                calculated_saving = round(room * marginal_rate * (1 + cess_pct), 2)
                # You cannot save more than the total tax actually payable
                if current_tax is not None:
                    potential_saving = round(min(calculated_saving, current_tax), 2)
                else:
                    potential_saving = calculated_saving

        results.append({
            "code":               code,
            "name":               name,
            "used":               round(used, 2),
            "limit":              limit if limit is not None else "No limit",
            "room":               room if room is not None else "No limit",
            "potential_saving":   potential_saving,
            "marginal_rate_used": marginal_rate,   # included for transparency/debugging
            "applicable_regimes": regimes,
            "condition":          section.get("condition"),
        })

    return results


# ─────────────────────────────────────────────
#  Tax computation helpers (Surcharge & Senior slabs)
# ─────────────────────────────────────────────

def _compute_base_tax(income: float, slabs: list[dict]) -> float:
    t = 0.0
    for s in sorted(slabs, key=lambda x: x["min"]):
        if income > s["min"]:
            in_slab = income - s["min"]
            if s.get("max") is not None:
                in_slab = min(in_slab, s["max"] - s["min"])
            t += in_slab * s["rate"]
    return t


def _compute_surcharge(tax: float, taxable_income: float, regime_name: str, slabs: list[dict]) -> float:
    """
    Computes Indian income tax surcharge with statutory marginal relief.
    Surcharge is calculated on slab tax (after Section 87A rebate).
    """
    if tax <= 0 or taxable_income <= 5_000_000:
        return 0.0

    if taxable_income <= 10_000_000:
        rate = 0.10
        thresh = 5_000_000
        prev_surcharge_rate = 0.0
    elif taxable_income <= 20_000_000:
        rate = 0.15
        thresh = 10_000_000
        prev_surcharge_rate = 0.10
    elif taxable_income <= 50_000_000:
        rate = 0.25
        thresh = 20_000_000
        prev_surcharge_rate = 0.15
    else:
        # Over 5 Crore: New regime capped at 25%, Old regime up to 37%
        rate = 0.25 if regime_name == "new" else 0.37
        thresh = 50_000_000
        prev_surcharge_rate = 0.25

    raw_surcharge = tax * rate

    # Marginal relief: Total (tax + surcharge) cannot exceed:
    # (Tax + Surcharge at threshold) + (taxable_income - threshold)
    tax_at_thresh = _compute_base_tax(thresh, slabs)
    surcharge_at_thresh = tax_at_thresh * prev_surcharge_rate
    max_allowed = tax_at_thresh + surcharge_at_thresh + (taxable_income - thresh)

    if (tax + raw_surcharge) > max_allowed:
        raw_surcharge = max(0.0, max_allowed - tax)

    return raw_surcharge


def compute_tax(taxable_income: float, regime: dict, age: float = 30.0) -> float:
    """
    Slab-wise tax + 87A rebate + Surcharge (with marginal relief) + 4% cess.
    Supports senior citizen (60+) and super senior citizen (80+) exemption slabs in Old Regime.
    """
    return compute_tax_detailed(taxable_income, regime, age)["total_tax"]


def compute_tax_detailed(taxable_income: float, regime: dict, age: float = 30.0) -> dict:
    """
    Same calculation as compute_tax, but returns a dict with intermediate values:
    slab_tax, rebate, marginal_relief, tax_after_rebate, surcharge, cess, total_tax.
    """
    if taxable_income <= 0:
        return {"slab_tax": 0.0, "rebate": 0.0, "marginal_relief": 0.0, "tax_after_rebate": 0.0,
                "surcharge": 0.0, "cess": 0.0, "total_tax": 0.0}

    regime_name = regime.get("regime", "new")
    slabs = regime.get("slabs")
    if not slabs:
        raise ValueError("Regime rules missing 'slabs'. Re-run extract_rule_limits.py.")

    # Under Old Regime, basic exemption depends on age
    if regime_name == "old":
        if age >= 80:
            slabs = [
                {"min": 0, "max": 500000, "rate": 0.0},
                {"min": 500000, "max": 1000000, "rate": 0.20},
                {"min": 1000000, "max": None, "rate": 0.30},
            ]
        elif age >= 60:
            slabs = [
                {"min": 0, "max": 300000, "rate": 0.0},
                {"min": 300000, "max": 500000, "rate": 0.05},
                {"min": 500000, "max": 1000000, "rate": 0.20},
                {"min": 1000000, "max": None, "rate": 0.30},
            ]

    slab_tax = _compute_base_tax(taxable_income, slabs)

    # 87A rebate
    rebate_cfg = regime.get("rebate_87A")
    if rebate_cfg is None:
        raise ValueError("Regime rules missing 'rebate_87A'. Re-run extract_rule_limits.py.")

    rebate = 0.0
    tax_after_rebate = slab_tax
    marginal_relief = 0.0

    if taxable_income <= rebate_cfg["income_limit"]:
        rebate = min(slab_tax, rebate_cfg["max_rebate"])
        tax_after_rebate = max(0.0, slab_tax - rebate)
    elif regime_name == "new":
        # Marginal relief for Section 87A under new tax regime (proviso)
        excess_income = taxable_income - rebate_cfg["income_limit"]
        if slab_tax > excess_income:
            marginal_relief = slab_tax - excess_income
            tax_after_rebate = excess_income

    # Surcharge with marginal relief (> 50 Lakhs)
    surcharge = _compute_surcharge(tax_after_rebate, taxable_income, regime_name, slabs)

    # Health & education cess (4% on tax + surcharge)
    cess_pct = regime.get("cess_percentage", 0.04)
    if cess_pct is None:
        raise ValueError("Regime rules missing 'cess_percentage'. Re-run extract_rule_limits.py.")

    cess = round((tax_after_rebate + surcharge) * cess_pct, 2)
    # Total tax payable rounded to nearest integer rupee per standard tax practice
    total_tax = float(round(tax_after_rebate + surcharge + cess))

    return {
        "slab_tax": round(slab_tax, 2),
        "rebate": round(rebate, 2),
        "marginal_relief": round(marginal_relief, 2),
        "tax_after_rebate": round(tax_after_rebate, 2),
        "surcharge": round(surcharge, 2),
        "cess": cess,
        "total_tax": total_tax,
    }


# ─────────────────────────────────────────────
#  Regime comparison
# ─────────────────────────────────────────────

def compute_regime_comparison(
    form_data: dict,
    old_sections: list[dict],
    old_rules: dict,
    new_rules: dict,
) -> dict:
    salary_income = (
        max(0.0, float(form_data.get("basic_salary",           0) or 0)) +
        max(0.0, float(form_data.get("hra_received",           0) or 0)) +
        max(0.0, float(form_data.get("other_allowances",       0) or 0))
    )
    gross_income = salary_income + max(0.0, float(form_data.get("other_income_interest", 0) or 0))
    age = float(form_data.get("age", 30) or 30)

    # ── Old regime ──────────────────────────────
    old_std_limit = float(old_rules.get("standard_deduction", 50000))
    # Standard deduction u/s 16(ia) is strictly against salary income
    old_std = min(salary_income, old_std_limit)

    hra_exemption = compute_hra_exemption(
        max(0.0, float(form_data.get("hra_received", 0) or 0)),
        max(0.0, float(form_data.get("rent_paid",    0) or 0)),
        max(0.0, float(form_data.get("basic_salary", 0) or 0)),
        bool(form_data.get("is_metro", False)),
    )

    # Sum all section deductions the user has actually used (old regime)
    old_section_deductions = sum(
        sec["used"]
        for sec in old_sections
        if "old" in sec.get("applicable_regimes", [])
        and isinstance(sec["used"], (int, float))
    )

    old_taxable = max(0.0, gross_income - old_std - hra_exemption - old_section_deductions)
    old_detail  = compute_tax_detailed(old_taxable, old_rules, age=age)

    # ── New regime ──────────────────────────────
    new_std_limit = float(new_rules.get("standard_deduction", 75000))
    new_std = min(salary_income, new_std_limit)

    # 80CCD(2) is deductible under new regime
    nps_employer_used = max(0.0, float(form_data.get("nps_employer", 0) or 0))
    basic             = max(0.0, float(form_data.get("basic_salary", 0) or 0))
    employer_type     = form_data.get("employer_type") or "private"
    nps_employer_pct  = 0.14 if employer_type == "government" else 0.10
    nps_employer_limit = basic * nps_employer_pct
    nps_employer_deduction = min(nps_employer_used, nps_employer_limit)

    new_taxable = max(0.0, gross_income - new_std - nps_employer_deduction)
    new_detail  = compute_tax_detailed(new_taxable, new_rules, age=30)  # age irrelevant in new regime

    old_tax = old_detail["total_tax"]
    new_tax = new_detail["total_tax"]
    winner  = "old" if old_tax < new_tax else "new"
    savings = float(round(abs(old_tax - new_tax), 2))

    return {
        "old_tax":             old_tax,
        "new_tax":             new_tax,
        "old_taxable":         round(old_taxable, 2),
        "new_taxable":         round(new_taxable, 2),
        "old_std":             round(old_std, 2),
        "new_std":             round(new_std, 2),
        "hra_exemption":       round(hra_exemption, 2),
        "old_slab_tax":        old_detail["slab_tax"],
        "new_slab_tax":        new_detail["slab_tax"],
        "old_rebate":          old_detail["rebate"],
        "new_rebate":          new_detail["rebate"],
        "old_marginal_relief": old_detail["marginal_relief"],
        "new_marginal_relief": new_detail["marginal_relief"],
        "old_surcharge":       old_detail["surcharge"],
        "new_surcharge":       new_detail["surcharge"],
        "old_cess":            old_detail["cess"],
        "new_cess":            new_detail["cess"],
        "winner":              winner,
        "savings":             savings,
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
    age = float(form_data.get("age", 30) or 30)

    # Pass 1: Resolve used amounts for all applicable sections
    # so we know the user's actual post-deduction taxable income and tax liabilities
    prelim_old_sections = compute_section_room(
        sections=old_rules.get("sections", []),
        form_data=form_data,
        taxable_income=0.0,
        regime_slabs=None,
    )

    initial_comparison = compute_regime_comparison(
        form_data,
        old_sections=prelim_old_sections,
        old_rules=old_rules,
        new_rules=new_rules,
    )

    old_taxable = initial_comparison["old_taxable"]
    new_taxable = initial_comparison["new_taxable"]
    old_tax     = initial_comparison["old_tax"]
    new_tax     = initial_comparison["new_tax"]

    # Select appropriate slabs for marginal rate computation
    if age >= 80:
        old_slabs = [
            {"min": 0, "max": 500000, "rate": 0.0},
            {"min": 500000, "max": 1000000, "rate": 0.20},
            {"min": 1000000, "max": None, "rate": 0.30},
        ]
    elif age >= 60:
        old_slabs = [
            {"min": 0, "max": 300000, "rate": 0.0},
            {"min": 300000, "max": 500000, "rate": 0.05},
            {"min": 500000, "max": 1000000, "rate": 0.20},
            {"min": 1000000, "max": None, "rate": 0.30},
        ]
    else:
        old_slabs = old_rules["slabs"]

    # Pass 2: Compute accurate section room and potential savings
    # using post-deduction marginal rates, capped to actual tax liability
    old_sections = compute_section_room(
        sections=old_rules.get("sections", []),
        form_data=form_data,
        taxable_income=old_taxable,
        regime_slabs=old_slabs,
        cess_pct=old_rules.get("cess_percentage", 0.04),
        current_tax=old_tax,
    )

    new_sections = compute_section_room(
        sections=new_rules.get("sections", []),
        form_data=form_data,
        taxable_income=new_taxable,
        regime_slabs=new_rules["slabs"],
        cess_pct=new_rules.get("cess_percentage", 0.04),
        current_tax=new_tax,
    )

    # Final comparison with verified sections
    comparison = compute_regime_comparison(
        form_data,
        old_sections=old_sections,
        old_rules=old_rules,
        new_rules=new_rules,
    )

    return {
        "old_regime_sections": old_sections,
        "new_regime_sections": new_sections,
        "regime_comparison":   comparison,
    }
