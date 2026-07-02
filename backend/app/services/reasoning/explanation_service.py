import os
import json
from groq import Groq
from dotenv import load_dotenv
from .grounding_retriever import get_grounding_chunks

load_dotenv(override=True)

SYSTEM_PROMPT = """You are an Indian tax advisor explaining a tax-saving analysis
to a salaried individual. You will be given:
1. A structured calculation result (regime comparison + section-wise room) — 
   these numbers are ALREADY COMPUTED AND CORRECT. Never recalculate, round 
   differently, or alter any figure.
2. Relevant excerpts from the Income Tax Act for grounding/citation.

Your task:
- State which regime is better and the exact rupee savings, in the first line.
- List all sections with unused room, ranked by potential_saving (highest first).
  For each: name the section, the room remaining, and the approximate additional tax saving.
- Use the Act excerpts only to add a short citation phrase (e.g. "as per Section 80D"), 
  never to introduce a number that contradicts the calculation result.
- If a section's room is "No limit", say so plainly — do not invent a number.
- Keep it under 150 words. Plain language, no jargon, no legal disclaimers.
- If the calculation result has no sections with room remaining, say the user has 
  fully utilised their available deductions and only the regime comparison matters.
"""

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

    # Filter calc_result to only show the winning regime's sections
    filtered_calc = {
        "regime_comparison": calc_result.get("regime_comparison"),
        "winning_regime_sections": calc_result.get(f"{regime_for_grounding}_regime_sections", [])
    }

    user_content = f"""
CALCULATION RESULT (do not alter any numbers):
{json.dumps(filtered_calc, indent=2)}

ACT EXCERPTS FOR CITATION (use only for phrasing, not numbers):
{json.dumps(grounding, indent=2) if grounding else "No excerpts available."}
"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
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
    """
    comparison = calc_result.get("regime_comparison", {})
    winner = comparison.get("winner", "old")
    savings = comparison.get("savings", 0)

    lines = [
        f"The {winner} regime saves you approximately ₹{savings:,.0f} compared to the other regime."
    ]

    sections = calc_result.get(f"{winner}_regime_sections", [])
    with_room = [s for s in sections if isinstance(s.get("room"), (int, float)) and s["room"] > 0]
    with_room.sort(key=lambda s: s.get("potential_saving") or 0, reverse=True)

    for s in with_room:
        lines.append(
            f"• {s['code']}: ₹{s['room']:,.0f} room remaining "
            f"(potential additional saving ≈ ₹{s.get('potential_saving', 0):,.0f})"
        )

    if not with_room:
        lines.append("All available deductions appear fully utilised.")

    return "\n".join(lines)
