import os
import json
from groq import Groq
from dotenv import load_dotenv
from pathlib import Path
from .grounding_retriever import get_grounding_chunks

load_dotenv(
    dotenv_path=Path(__file__).resolve().parents[3] / ".env",
    override=True
)

# ─── Friendly display names for section codes ───
_SECTION_DISPLAY_NAMES: dict[str, str] = {
    "80C":                "Tax-saving investments (Sec 80C)",
    "80CCD(1B)":          "NPS self contribution (Sec 80CCD(1B))",
    "80CCD(2)_private":   "Employer NPS contribution (Sec 80CCD(2))",
    "80CCD(2)_govt":      "Employer NPS contribution (Sec 80CCD(2))",
    "80D_self":           "Health insurance — self & family (Sec 80D)",
    "80D_self_senior":    "Health insurance — self & family, senior (Sec 80D)",
    "80D_parents":        "Health insurance — parents (Sec 80D)",
    "80D_parents_senior": "Health insurance — parents, senior citizen (Sec 80D)",
    "24(b)":              "Home loan interest (Sec 24b)",
    "80E":                "Education loan interest (Sec 80E)",
    "80TTA":              "Savings account interest (Sec 80TTA)",
    "80TTB":              "Interest income — senior citizen (Sec 80TTB)",
    "80G":                "Donations to charity (Sec 80G)",
}

def format_inr(val: float | int | None) -> str:
    """Formats numbers with Indian comma separation (e.g. 1,00,000 or 65,001)."""
    if val is None:
        return "0"
    is_neg = val < 0
    val = abs(val)
    if isinstance(val, int) or val == int(val):
        int_part = str(int(val))
        dec_part = ""
    else:
        int_part = str(int(val))
        dec_part = f"{val - int(val):.2f}"[1:]  # e.g. .25

    if len(int_part) <= 3:
        formatted = int_part
    else:
        last3 = int_part[-3:]
        rest = int_part[:-3]
        groups = []
        while len(rest) > 2:
            groups.insert(0, rest[-2:])
            rest = rest[:-2]
        if rest:
            groups.insert(0, rest)
        formatted = ",".join(groups) + "," + last3

    res = f"{formatted}{dec_part}"
    return f"-{res}" if is_neg else res

SYSTEM_PROMPT = """You are a friendly Indian tax advisor.
The user has been shown their tax calculation. Explain it clearly in 3 short parts:

PART 1 — REGIME RECOMMENDATION (1 sentence):
State which regime is recommended and the exact rupee saving.
Use ONLY the EXACT REGIME SAVING figure provided in the user prompt (including its comma formatting) —
do not read it from the calculation result yourself, do not recalculate,
round, or approximate it in any way. If the saving is ₹0, say so verbatim.
Example: "The new regime saves you ₹92,196 — this is your recommended regime."

PART 2 — TOP ACTIONS IN THE RECOMMENDED REGIME (2-3 bullet points):
List only sections that apply to their recommended regime AND have room remaining.
For each, give: section name, room left, and approximate tax saving formatted with commas.
Sort by potential_saving descending (highest saving first).
If recommended regime is "new" and only 80CCD(2) has room, say so clearly and
explain what it means (ask employer to contribute to NPS on their behalf).
If recommended regime is "old", list the top 3 unused sections from old_regime_sections.

PART 3 — ONE THING TO DO NOW (1 sentence):
The single highest-impact action the user can take before March 31.

Rules:
- Never recalculate or change any number from the calculation result.
- Never mention sections from the non-recommended regime as actionable.
- Never use the internal section codes like "80CCD(2)_private" in the output —
  use friendly names: "Employer NPS (Section 80CCD(2))", "NPS (Section 80CCD(1B))",
  "Health Insurance (Section 80D)", "Tax-saving investments (Section 80C)", etc.
- Under 120 words total.
- No markdown headers, no asterisks, plain text only.
- The potential_saving field in each section is already computed correctly using the user's actual marginal tax rate including cess — use that exact figure when quoting a saving amount. Never recalculate or round it differently.
- IMPORTANT: If a section shows potential_saving = 0 and the regime's total tax (old_tax or new_tax) is already ₹0, the correct reason is that the user qualifies for the full Section 87A rebate, making their net tax ₹0. Do NOT say the saving is ₹0 because of a low marginal rate. Instead say: "the potential saving is ₹0 because your tax is already ₹0 after the Section 87A rebate."
"""

# Model to use for Groq API calls
_GROQ_MODEL = "qwen/qwen3.8-27b"


def explain(calc_result: dict, regime_for_grounding: str = "old") -> tuple[str, str]:
    """
    Takes the deterministic calculation result and produces a prioritized,
    grounded explanation. Never raises to the caller — always returns a tuple
    (explanation_string, explanation_source), falling back to a calculation-only 
    summary if the LLM call fails.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        print("[ERROR] GROQ_API_KEY not set")
        return _fallback_summary(calc_result), "fallback"

    client = Groq(api_key=api_key)

    try:
        grounding = get_grounding_chunks(calc_result, regime_for_grounding)
    except Exception as e:
        print(f"[WARN] Grounding retrieval failed: {e}")
        grounding = {}

    comparison = calc_result.get("regime_comparison", {})
    winner = comparison.get("winner", "old")
    savings = comparison.get("savings", 0)
    winner_tax = comparison.get(f"{winner}_tax", 0)

    # Filter calc_result to only show the winning regime's sections
    filtered_calc = {
        "regime_comparison": comparison,
        "winning_regime_sections": calc_result.get(f"{regime_for_grounding}_regime_sections", [])
    }

    user_content = f"""
CALCULATION RESULT (do not alter any numbers):
{json.dumps(filtered_calc, indent=2)}

EXACT REGIME SAVING (use this exact figure in PART 1, do not recalculate):
The {winner} regime saves exactly ₹{format_inr(savings)} compared to the other regime.

WINNER REGIME TAX: ₹{format_inr(winner_tax)}
(If this is ₹0, the user gets the full Section 87A rebate. Any section with potential_saving=0 is because the tax is already zero, NOT because of a low marginal rate.)

ACT EXCERPTS FOR CITATION (use only for phrasing, not numbers):
{json.dumps(grounding, indent=2) if grounding else "No excerpts available."}
"""

    try:
        response = client.chat.completions.create(
            model=_GROQ_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0.0,
            max_tokens=500,
        )
        text = response.choices[0].message.content.strip()
        if not text:
            raise ValueError("Empty response from Groq")
        return text, "ai"

    except Exception as e:
        print(f"[ERROR] Explanation generation failed: {e}")
        return _fallback_summary(calc_result), "fallback"


def _fallback_summary(calc_result: dict) -> str:
    """
    Deterministic, code-generated summary used when the LLM call fails.
    Never blank — always shows at least the regime comparison from real numbers.
    Uses friendly display names instead of raw section codes.
    """
    comparison = calc_result.get("regime_comparison", {})
    winner = comparison.get("winner", "old")
    savings = comparison.get("savings", 0)
    winner_tax = comparison.get(f"{winner}_tax", None)

    if savings == 0:
        lines = [
            "Under both Old and New regimes, your net tax payable is ₹0. No tax is due."
        ]
    else:
        lines = [
            f"The {winner} regime saves you approximately ₹{format_inr(savings)} compared to the other regime."
        ]

    # If Old regime won and HRA was claimed, mention it
    if winner == "old" and comparison.get("hra_exemption", 0) > 0:
        lines.append(f"• HRA Exemption (Sec 10(13A)): ₹{format_inr(comparison['hra_exemption'])} claimed")

    sections = calc_result.get(f"{winner}_regime_sections", [])
    with_room = [s for s in sections if isinstance(s.get("room"), (int, float)) and s["room"] > 0]
    with_room.sort(key=lambda s: s.get("potential_saving") or 0, reverse=True)

    for s in with_room:
        display_name = _SECTION_DISPLAY_NAMES.get(s["code"], s.get("name", s["code"]))
        pot_saving = s.get('potential_saving', 0)
        if pot_saving == 0 and winner_tax is not None and winner_tax <= 0:
            lines.append(
                f"• {display_name}: ₹{format_inr(s['room'])} room remaining "
                f"(potential saving ₹0 — your tax is already ₹0 after Section 87A rebate)"
            )
        else:
            lines.append(
                f"• {display_name}: ₹{format_inr(s['room'])} room remaining "
                f"(potential additional saving ≈ ₹{format_inr(pot_saving)})"
            )

    if not with_room and winner != "old":
        lines.append("All available deductions appear fully utilised.")

    return "\n".join(lines)

