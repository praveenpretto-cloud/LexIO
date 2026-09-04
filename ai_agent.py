"""
ai_agent.py — Google Gemini-powered compliance reasoning agent for LexIO.

When the rule-based engine flags a transaction as WATCH or CDD, this module
calls a real LLM (Google Gemini) to generate a natural-language compliance
narrative explaining *why* the transaction is risky and *what* action should
be taken. This makes the "Agentic" part of LexIO genuinely agentic.

The AI agent reasons about:
  - Jurisdiction risk (FATF classifications)
  - Transaction amount relative to regulatory thresholds (MAS/MiCA/GENIUS)
  - Wallet type (hosted vs. unhosted)
  - FATF risk tier (SCDD / CDD / EDD)
"""
from __future__ import annotations

import os
from typing import Optional

# Google Gemini SDK (new unified SDK)
try:
    from google import genai
    from google.genai import types as genai_types
    _GEMINI_AVAILABLE = True
except ImportError:
    _GEMINI_AVAILABLE = False


GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

_SYSTEM_PROMPT = """You are a senior compliance officer at a global digital asset institution with 20 years of experience.
You have deep expertise in FATF AML/CFT standards, MiCA (EU Markets in Crypto-Assets), MAS PSN02 (Singapore), and the US GENIUS Act for stablecoins.

When given details about a proposed agent-to-agent blockchain payment, you must:
1. Identify the specific regulatory risk factors
2. Reference the exact compliance framework that applies (FATF, MiCA, MAS, GENIUS, OFAC)
3. Explain what due diligence action is required (SCDD / CDD / EDD)
4. Be concise — 3-4 sentences maximum. This is a real-time compliance alert.
5. Write in a professional, institutional tone.

Do NOT use bullet points. Write in plain prose. Do NOT mention that you are an AI."""


def _build_prompt(
    source_wallet: str,
    dest_wallet: str,
    src_jurisdiction: str,
    dst_jurisdiction: str,
    amount_usd: float,
    risk_tier: str,
    decision: str,
    flagged_by: list[str],
    reasons: list[str],
) -> str:
    """Build the compliance analysis prompt for the LLM."""
    flags_text = ", ".join(flagged_by) if flagged_by else "none"
    reasons_text = " | ".join(reasons[:3]) if reasons else "No specific flags."

    return f"""Analyze this proposed agent-to-agent blockchain payment and provide a compliance officer's assessment:

TRANSACTION DETAILS:
- Source Wallet: {source_wallet[:20]}...
- Destination Wallet: {dest_wallet[:20]}...
- Source Jurisdiction: {src_jurisdiction}
- Destination Jurisdiction: {dst_jurisdiction}
- Amount: ${amount_usd:,.2f} USD
- Risk Tier: {risk_tier.upper()}
- Decision: {decision}
- Triggered Rules: {flags_text}
- Rule Reasons: {reasons_text}

Provide a 3-4 sentence institutional compliance assessment explaining the risk and required action."""


async def generate_compliance_reasoning(
    source_wallet: str,
    dest_wallet: str,
    src_jurisdiction: str,
    dst_jurisdiction: str,
    amount_usd: float,
    risk_tier: str,
    decision: str,
    flagged_by: list[str],
    reasons: list[str],
) -> Optional[str]:
    """
    Call Google Gemini to generate a natural-language compliance narrative.

    Returns:
        A string with the AI reasoning text, or None if Gemini is unavailable.
    """
    if not _GEMINI_AVAILABLE or not GEMINI_API_KEY:
        # Graceful fallback — generate a deterministic rule-based narrative
        return _rule_based_narrative(
            src_jurisdiction=src_jurisdiction,
            dst_jurisdiction=dst_jurisdiction,
            amount_usd=amount_usd,
            risk_tier=risk_tier,
            decision=decision,
            flagged_by=flagged_by,
            reasons=reasons,
        )

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)

        prompt = _build_prompt(
            source_wallet=source_wallet,
            dest_wallet=dest_wallet,
            src_jurisdiction=src_jurisdiction,
            dst_jurisdiction=dst_jurisdiction,
            amount_usd=amount_usd,
            risk_tier=risk_tier,
            decision=decision,
            flagged_by=flagged_by,
            reasons=reasons,
        )

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=_SYSTEM_PROMPT + "\n\n" + prompt,
            config=genai_types.GenerateContentConfig(
                max_output_tokens=200,
                temperature=0.3,
            ),
        )
        return response.text.strip()

    except Exception as exc:  # noqa: BLE001
        # If Gemini API fails (rate limit, network, etc.), fall back to rule-based
        return _rule_based_narrative(
            src_jurisdiction=src_jurisdiction,
            dst_jurisdiction=dst_jurisdiction,
            amount_usd=amount_usd,
            risk_tier=risk_tier,
            decision=decision,
            flagged_by=flagged_by,
            reasons=reasons,
        )


def _rule_based_narrative(
    src_jurisdiction: str,
    dst_jurisdiction: str,
    amount_usd: float,
    risk_tier: str,
    decision: str,
    flagged_by: list[str],
    reasons: list[str],
) -> str:
    """
    Deterministic fallback narrative when Gemini API is unavailable.
    Uses the rule engine's output to craft a professional-sounding assessment.
    """
    fatf_context = {
        "KP": "North Korea is a FATF-blacklisted jurisdiction under active OFAC and UN Security Council sanctions.",
        "IR": "Iran is a FATF-blacklisted jurisdiction subject to OFAC, EU, and UN sanctions.",
        "SY": "Syria is subject to EU, US, and UN comprehensive sanctions under the Assad regime designation.",
        "VG": "The British Virgin Islands is a medium-risk offshore financial centre with elevated shell company risk.",
        "KY": "The Cayman Islands is a medium-risk offshore jurisdiction under FATF monitoring for opaque ownership structures.",
        "PA": "Panama has a history of opacity in beneficial ownership and is classified medium-risk by FATF.",
    }

    jur_note = fatf_context.get(src_jurisdiction, "") or fatf_context.get(dst_jurisdiction, "")

    if "pep_hit" in flagged_by:
        return (
            f"This transaction involves a wallet associated with a Politically Exposed Person (PEP), "
            f"triggering mandatory Enhanced Due Diligence under FATF Recommendation 12. "
            f"PEP transactions require senior management approval and must be subject to ongoing monitoring. "
            f"This payment has been REJECTED pending full beneficial ownership verification."
        )
    elif "sanctions_hit" in flagged_by:
        return (
            f"A wallet in this transaction has been identified on an active sanctions list (OFAC SDN or equivalent). "
            f"Under FATF Recommendation 6 and applicable national law, this transaction must be blocked immediately. "
            f"Processing a sanctioned entity transaction constitutes a criminal offence in most jurisdictions. "
            f"This payment has been REJECTED and flagged for SAR (Suspicious Activity Report) filing."
        )
    elif "jurisdiction_risk" in flagged_by:
        return (
            f"{''.join([jur_note, ' ' if jur_note else ''])}This transaction crosses a FATF high-risk jurisdiction boundary, "
            f"triggering Enhanced Due Diligence (EDD) under FATF Recommendation 10. "
            f"The ${amount_usd:,.2f} USD transfer has been placed into an XRPL compliance escrow pending "
            f"a compliance officer review and supplementary KYC documentation from the originator."
        )
    elif "medium_risk_jurisdiction" in flagged_by:
        return (
            f"{''.join([jur_note, ' ' if jur_note else ''])}This jurisdiction pair presents elevated beneficial ownership risk. "
            f"Standard Customer Due Diligence (CDD) has been applied under FATF Recommendation 10. "
            f"The ${amount_usd:,.2f} USD transaction is approved under enhanced monitoring, "
            f"with transaction records retained for 5 years per AML/CFT regulatory requirements."
        )
    else:
        return (
            f"Both wallets have passed all FATF jurisdiction checks, PEP screening, and sanctions list verification. "
            f"Simplified Customer Due Diligence (SCDD) applies to this low-risk pair under FATF Recommendation 10. "
            f"The ${amount_usd:,.2f} USD transfer is cleared for execution with a W3C Verifiable Credential issued "
            f"and anchored to the XRP Ledger as a tamper-proof compliance record."
        )
