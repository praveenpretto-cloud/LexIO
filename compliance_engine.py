"""
compliance_engine.py — Agentic Finance Compliance Engine for LexIO.

Evaluates agent-to-agent crypto payments against risk-tier rules:
  SCDD (Simplified CDD) → APPROVE
  CDD  (Customer Due Diligence) → APPROVE (monitored)
  EDD  (Enhanced Due Diligence) → WATCH (flag for human review)
  REJECT → PEP/sanctions hit or linked-wallet inheritance

Legacy shim: `evaluate()` bridges the old ComplianceRequest/ComplianceResponse
format to the new agentic engine so the existing Policy Engine tab continues
to work without modification.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Dict, List, Tuple

from models import AgentTransferRequest, ComplianceDecision, RiskTier

# ---------------------------------------------------------------------------
# Hardcoded Reference Data (demo — swap for DB/API in production)
# ---------------------------------------------------------------------------

HIGH_RISK_JURISDICTIONS: List[str] = [
    "KP",  # North Korea (FATF black list)
    "IR",  # Iran (FATF black list)
    "SY",  # Syria (FATF black list)
    "MM",  # Myanmar (FATF grey list)
    "YE",  # Yemen (FATF grey list)
    "LY",  # Libya (FATF grey list)
    "HT",  # Haiti (FATF grey list)
    "PK",  # Pakistan (FATF grey list — historical)
    "VE",  # Venezuela (OFAC / US sanctions)
    "CU",  # Cuba (OFAC)
    "SD",  # Sudan (OFAC)
    "SS",  # South Sudan (FATF grey)
    "CF",  # Central African Republic (UN sanctions)
    "CD",  # DRC (UN sanctions)
    "AF",  # Afghanistan (FATF grey)
    "BI",  # Burundi
    "SO",  # Somalia (FATF grey)
]

MEDIUM_RISK_JURISDICTIONS: List[str] = [
    "VG",  # British Virgin Islands
    "KY",  # Cayman Islands
    "PA",  # Panama
    "SC",  # Seychelles
    "MU",  # Mauritius
    "MT",  # Malta
    "TN",  # Tunisia
    "PH",  # Philippines
    "NG",  # Nigeria
]

# Mock PEP list — key is the owner_name field in MOCK_WALLET_OWNERSHIP
PEP_LIST: Dict[str, Dict] = {
    "vladimir_putin":       {"country": "RU", "reason": "Head of State"},
    "ali_khamenei":         {"country": "IR", "reason": "Supreme Leader"},
    "bashar_al_assad":      {"country": "SY", "reason": "Head of State"},
    "kim_jong_un":          {"country": "KP", "reason": "Supreme Leader"},
    "lukashenko_alexander": {"country": "BY", "reason": "Head of State"},
    "nicolas_maduro":       {"country": "VE", "reason": "Head of State"},
    "miguel_diaz_canel":    {"country": "CU", "reason": "Head of State"},
    "omar_al_bashir":       {"country": "SD", "reason": "Former Head of State — ICC warrant"},
    "gurbanguly_berdimuhamedow": {"country": "TM", "reason": "Former Head of State"},
    "qasem_soleimani":      {"country": "IR", "reason": "IRGC Commander — OFAC SDN"},
    "semyon_mogilevich":    {"country": "RU", "reason": "Organised crime — FBI wanted"},
    "evgeny_prigozhin":     {"country": "RU", "reason": "Wagner Group — OFAC SDN"},
    "hunter_renfrew":       {"country": "KY", "reason": "Mock offshore PEP — demo only"},
    "dragon_zhang_wei":     {"country": "KP", "reason": "Mock DPRK sanctions evader — demo only"},
    "cayman_fund_admin":    {"country": "KY", "reason": "Mock opaque ownership structure — demo only"},
}

# Mock sanctions list — key is owner_name
SANCTIONS_LIST: Dict[str, Dict] = {
    "north_korea_bank":        {"country": "KP", "reason": "OFAC SDN — DPRK state bank"},
    "iran_petrochemical_co":   {"country": "IR", "reason": "OFAC SDN — IRGC linked"},
    "syria_central_bank":      {"country": "SY", "reason": "EU/US sanctions — Assad regime"},
    "wagner_group_finance":    {"country": "RU", "reason": "OFAC SDN — mercenary financing"},
    "tornado_cash_deployer":   {"country": "US", "reason": "OFAC SDN — DPRK mixer"},
    "lazarus_group_wallet":    {"country": "KP", "reason": "OFAC SDN — DPRK state hacker"},
    "hamas_charity_front":     {"country": "PS", "reason": "OFAC SDN — terrorist financing"},
    "cartago_exchange":        {"country": "VE", "reason": "OFAC SDN — Maduro regime exchange"},
}

# Maps wallet address → {owner_name, jurisdiction}
MOCK_WALLET_OWNERSHIP: Dict[str, Dict] = {
    # Clean wallets
    "rN7n7otQDd6FczFgLdQqhkFGzPb7E4k7Ud":         {"owner_name": "alice_clean",             "jurisdiction": "US"},
    "rAbCdEfGhIjKlMnOpQrStUvWxYzAbCdEfG":         {"owner_name": "bob_clean",               "jurisdiction": "GB"},
    "rapGvMNARmA46HRNoGBiTy1nEwiKdVTfPw":         {"owner_name": "carol_clean",             "jurisdiction": "SG"},
    "rEGcPEhZbvFMr14wBhm3TUc1EanWWMU367":         {"owner_name": "dave_clean",              "jurisdiction": "JP"},
    "GDHR3WJVS3IM5U7DFC3CBFMXPVLXA254MCLJRSJVHUR5BTHA2XJ7YHOZ": {"owner_name": "stellar_clean_sender", "jurisdiction": "US"},
    "GB3ST5WM4RBIOTBHS4GUUFH6VN5FEMVFZKAMVXRLL4D55DVQVKG7X66E": {"owner_name": "stellar_clean_rcv",    "jurisdiction": "AU"},
    # PEP wallets
    "rU6K7V8oST9vMN2pQr4sT5uV6wX7yZ8aA":         {"owner_name": "vladimir_putin",          "jurisdiction": "RU"},
    "rPqq3gQJ5M7nOpKlM9pQr2sT3uV4wXyZa":         {"owner_name": "evgeny_prigozhin",        "jurisdiction": "RU"},
    "rIranWalletMockXxXxXxXxXxXxXxXxXx":         {"owner_name": "ali_khamenei",            "jurisdiction": "IR"},
    # Sanctions wallets
    "rSanctionWalletNorthKoreaXxXxXxXx":         {"owner_name": "north_korea_bank",        "jurisdiction": "KP"},
    "rLazarusGroupWalletXxXxXxXxXxXxXx":         {"owner_name": "lazarus_group_wallet",    "jurisdiction": "KP"},
    # High-risk jurisdiction (not PEP/sanctioned, but EDD)
    "rHighRiskCountryWalletXxXxXxXxXx":          {"owner_name": "myanmar_entity",          "jurisdiction": "MM"},
    "rAfghanistanWalletXxXxXxXxXxXxXx":          {"owner_name": "afghan_merchant",         "jurisdiction": "AF"},
    # Medium-risk jurisdiction (CDD)
    "rCaymanFundWalletXxXxXxXxXxXxXx":           {"owner_name": "cayman_fund_xyz",         "jurisdiction": "KY"},
    "rBVIWalletMockXxXxXxXxXxXxXxXxXx":          {"owner_name": "bvi_holding_co",          "jurisdiction": "VG"},
}

# Maps wallet address → list of linked wallet addresses
# If a linked wallet is flagged, the primary wallet inherits its risk
LINKED_WALLETS: Dict[str, List[str]] = {
    # PEP wallet is linked to a second wallet (which should inherit the PEP risk)
    "rU6K7V8oST9vMN2pQr4sT5uV6wX7yZ8aA": ["rPqq3gQJ5M7nOpKlM9pQr2sT3uV4wXyZa"],
    # The second wallet also links back (bidirectional)
    "rPqq3gQJ5M7nOpKlM9pQr2sT3uV4wXyZa": ["rU6K7V8oST9vMN2pQr4sT5uV6wX7yZ8aA"],
    # Sanction wallet linked to a seemingly clean address
    "rSanctionWalletNorthKoreaXxXxXxXx": ["rLinkedToSanctionWalletXxXxXxXxXx"],
}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _lookup_wallet(
    wallet_address: str,
    wallet_db: Dict[str, Dict],
) -> Dict:
    """Return wallet metadata or a safe unknown default."""
    return wallet_db.get(
        wallet_address,
        {"owner_name": "unknown", "jurisdiction": "XX"},
    )


def _is_pep(owner_name: str) -> Tuple[bool, str]:
    """Check if an owner is a Politically Exposed Person. Returns (hit, reason)."""
    entry = PEP_LIST.get(owner_name)
    if entry:
        return True, f"PEP: {owner_name} — {entry['reason']} ({entry['country']})"
    return False, ""


def _is_sanctioned(owner_name: str) -> Tuple[bool, str]:
    """Check if an owner matches the sanctions list. Returns (hit, reason)."""
    entry = SANCTIONS_LIST.get(owner_name)
    if entry:
        return True, f"Sanctions: {owner_name} — {entry['reason']} ({entry['country']})"
    return False, ""


def _check_linked_wallet_risk(
    wallet_address: str,
    wallet_db: Dict[str, Dict],
) -> Tuple[bool, str]:
    """
    Traverse one level of linked wallets and check if any linked wallet is
    flagged (PEP or sanctioned). Returns (flagged, reason).
    """
    linked = LINKED_WALLETS.get(wallet_address, [])
    for linked_addr in linked:
        linked_meta = _lookup_wallet(linked_addr, wallet_db)
        pep_hit, pep_reason = _is_pep(linked_meta["owner_name"])
        if pep_hit:
            return True, f"Linked wallet {linked_addr[:12]}… inherits PEP risk: {pep_reason}"
        san_hit, san_reason = _is_sanctioned(linked_meta["owner_name"])
        if san_hit:
            return True, f"Linked wallet {linked_addr[:12]}… inherits sanctions risk: {san_reason}"
    return False, ""


# ---------------------------------------------------------------------------
# Core risk-tier computation
# ---------------------------------------------------------------------------

def compute_risk_tier(
    source_wallet: str,
    destination_wallet: str,
    wallet_db: Dict[str, Dict],
) -> Dict:
    """
    Evaluate source and destination wallets against jurisdiction, PEP,
    sanctions, and linked-wallet rules. Returns a risk-tier result dict.

    Args:
        source_wallet: blockchain address of the sending agent.
        destination_wallet: blockchain address of the receiving agent.
        wallet_db: in-memory wallet ownership registry.

    Returns:
        {
            "tier": "SCDD" | "CDD" | "EDD",
            "decision": "APPROVE" | "REJECT" | "WATCH",
            "reasons": List[str],
            "confidence": float,      # 0.0 – 1.0
            "flagged_by": List[str],  # rule identifiers
        }
    """
    reasons: List[str] = []
    flagged_by: List[str] = []

    src_meta  = _lookup_wallet(source_wallet, wallet_db)
    dst_meta  = _lookup_wallet(destination_wallet, wallet_db)
    src_owner = src_meta["owner_name"]
    dst_owner = dst_meta["owner_name"]
    src_jur   = src_meta["jurisdiction"].upper()
    dst_jur   = dst_meta["jurisdiction"].upper()

    # ── Rule 1: PEP check (REJECT immediately) ──────────────────────────────
    src_pep, src_pep_reason = _is_pep(src_owner)
    dst_pep, dst_pep_reason = _is_pep(dst_owner)
    if src_pep:
        reasons.append(f"Source wallet owner is a PEP. {src_pep_reason}")
        flagged_by.append("pep_hit")
    if dst_pep:
        reasons.append(f"Destination wallet owner is a PEP. {dst_pep_reason}")
        flagged_by.append("pep_hit")

    # ── Rule 2: Sanctions check (REJECT immediately) ─────────────────────────
    src_san, src_san_reason = _is_sanctioned(src_owner)
    dst_san, dst_san_reason = _is_sanctioned(dst_owner)
    if src_san:
        reasons.append(f"Source wallet owner is on the sanctions list. {src_san_reason}")
        flagged_by.append("sanctions_hit")
    if dst_san:
        reasons.append(f"Destination wallet owner is on the sanctions list. {dst_san_reason}")
        flagged_by.append("sanctions_hit")

    # Immediate REJECT for PEP or sanctions
    if "pep_hit" in flagged_by or "sanctions_hit" in flagged_by:
        return {
            "tier": RiskTier.EDD,
            "decision": "REJECT",
            "reasons": reasons,
            "confidence": 0.98,
            "flagged_by": flagged_by,
        }

    # ── Rule 3: Linked-wallet risk inheritance ────────────────────────────────
    src_linked, src_link_reason = _check_linked_wallet_risk(source_wallet, wallet_db)
    dst_linked, dst_link_reason = _check_linked_wallet_risk(destination_wallet, wallet_db)
    if src_linked:
        reasons.append(src_link_reason)
        flagged_by.append("linked_wallet_risk")
    if dst_linked:
        reasons.append(dst_link_reason)
        flagged_by.append("linked_wallet_risk")

    if "linked_wallet_risk" in flagged_by:
        return {
            "tier": RiskTier.EDD,
            "decision": "REJECT",
            "reasons": reasons,
            "confidence": 0.92,
            "flagged_by": flagged_by,
        }

    # ── Rule 4: High-risk jurisdiction → EDD → WATCH ─────────────────────────
    src_high_risk = src_jur in HIGH_RISK_JURISDICTIONS
    dst_high_risk = dst_jur in HIGH_RISK_JURISDICTIONS
    if src_high_risk:
        reasons.append(
            f"Source jurisdiction '{src_jur}' is on the FATF high-risk list. EDD required."
        )
        flagged_by.append("jurisdiction_risk")
    if dst_high_risk:
        reasons.append(
            f"Destination jurisdiction '{dst_jur}' is on the FATF high-risk list. EDD required."
        )
        flagged_by.append("jurisdiction_risk")

    if "jurisdiction_risk" in flagged_by:
        return {
            "tier": RiskTier.EDD,
            "decision": "WATCH",
            "reasons": reasons,
            "confidence": 0.85,
            "flagged_by": flagged_by,
        }

    # ── Rule 5: Medium-risk jurisdiction → CDD → APPROVE (monitored) ──────────
    src_med_risk = src_jur in MEDIUM_RISK_JURISDICTIONS
    dst_med_risk = dst_jur in MEDIUM_RISK_JURISDICTIONS
    if src_med_risk:
        reasons.append(
            f"Source jurisdiction '{src_jur}' is medium-risk. CDD monitoring applied."
        )
        flagged_by.append("medium_risk_jurisdiction")
    if dst_med_risk:
        reasons.append(
            f"Destination jurisdiction '{dst_jur}' is medium-risk. CDD monitoring applied."
        )
        flagged_by.append("medium_risk_jurisdiction")

    if "medium_risk_jurisdiction" in flagged_by:
        return {
            "tier": RiskTier.CDD,
            "decision": "APPROVE",
            "reasons": reasons,
            "confidence": 0.78,
            "flagged_by": flagged_by,
        }

    # ── Rule 6: Clean pair → SCDD → APPROVE ──────────────────────────────────
    reasons.append("Both wallets passed all jurisdiction, PEP, sanctions, and linked-wallet checks.")
    return {
        "tier": RiskTier.SCDD,
        "decision": "APPROVE",
        "reasons": reasons,
        "confidence": 0.99,
        "flagged_by": [],
    }


# ---------------------------------------------------------------------------
# Public async entry-point
# ---------------------------------------------------------------------------

async def check_agentic_finance_compliance(
    request: AgentTransferRequest,
    wallet_db: Dict[str, Dict] | None = None,
) -> ComplianceDecision:
    """
    Evaluate a proposed agent-to-agent payment against risk-tier rules.

    Args:
        request: AgentTransferRequest containing source/destination wallet addresses.
        wallet_db: optional override wallet registry (defaults to MOCK_WALLET_OWNERSHIP).

    Returns:
        ComplianceDecision with decision, risk_tier, reasons, confidence_score,
        flagged_by, and timestamp.
    """
    db = wallet_db if wallet_db is not None else MOCK_WALLET_OWNERSHIP

    result = compute_risk_tier(
        source_wallet=request.source_wallet_address,
        destination_wallet=request.destination_wallet_address,
        wallet_db=db,
    )

    return ComplianceDecision(
        decision=result["decision"],
        risk_tier=result["tier"],
        reasons=result["reasons"],
        confidence_score=result["confidence"],
        flagged_by=result["flagged_by"],
        timestamp=datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# Legacy compatibility shim — keeps the existing Policy Engine tab working
# ---------------------------------------------------------------------------

async def evaluate(payload) -> "ComplianceResponse":
    """
    Bridge the old ComplianceRequest/ComplianceResponse format to the new
    agentic risk-tier engine.

    The old form sends jurisdiction codes (sender_jurisdiction / receiver_jurisdiction),
    KYC flags, and amount. We map these directly to the agentic engine's
    jurisdiction checks. Wallet addresses from the form are used as-is —
    unknown wallets default to a clean SCDD evaluation, with jurisdiction
    overriding as needed via a synthetic wallet_db.

    Returns a ComplianceResponse (Approve / Block / Flag) for the UI.
    """
    import hashlib as _hashlib
    from models import ComplianceResponse as _CR

    # Build a synthetic wallet_db entry using the form's jurisdiction fields
    # so the agentic engine applies jurisdiction-based risk tiers correctly.
    synthetic_db: Dict[str, Dict] = {
        **MOCK_WALLET_OWNERSHIP,
        payload.sender_address: {
            "owner_name": f"form_sender_{payload.sender_address[-6:]}",
            "jurisdiction": payload.sender_jurisdiction.upper(),
        },
        payload.receiver_address: {
            "owner_name": f"form_receiver_{payload.receiver_address[-6:]}",
            "jurisdiction": payload.receiver_jurisdiction.upper(),
        },
    }

    result = compute_risk_tier(
        source_wallet=payload.sender_address,
        destination_wallet=payload.receiver_address,
        wallet_db=synthetic_db,
    )

    decision  = result["decision"]   # APPROVE | REJECT | WATCH
    reasons   = result["reasons"]
    risk_tier = result["tier"]

    # ── Institution / Jurisdiction Routing ──────────────────────────────────
    inst = getattr(payload, "institution_type", "") or ""
    is_sg = (payload.sender_jurisdiction.upper() == "SG" or payload.receiver_jurisdiction.upper() == "SG")
    is_eu = (payload.sender_jurisdiction.upper() == "EU" or payload.receiver_jurisdiction.upper() == "EU")
    is_us = (payload.sender_jurisdiction.upper() == "US" or payload.receiver_jurisdiction.upper() == "US")

    # ── MAS PSN02 gate (Singapore / MPI) ────────────────────────────────────
    if (is_sg or inst == "MPI") and payload.amount > 1500 and not getattr(payload, "sender_kyc_complete", True):
        decision = "REJECT"
        reasons  = [
            f"Transfer of {payload.amount} {payload.stablecoin_type} exceeds MAS PSN02 "
            f"threshold of 1,500. Full KYC required on originator."
        ] + reasons

    # ── US GENIUS Act gate (July 2025 - US / LPSI) ─────────────────────────
    # U.S. federal law mandates payment stablecoin issuers must be federally/state licensed.
    # For this demo, we treat USDC as compliant and USDT as non-compliant for US entities.
    if (is_us or inst == "LPSI") and payload.stablecoin_type == "USDT":
        decision = "REJECT"
        reasons  = [
            f"US GENIUS Act violation: {payload.stablecoin_type} is not a licensed payment stablecoin "
            f"under the Guiding and Establishing National Innovation for U.S. Stablecoins Act. "
            f"US jurisdictions require regulated assets (e.g., USDC)."
        ] + reasons

    # ── EU MiCA TFR gate (EU / CASP) ───────────────────────────────────────
    if (is_eu or inst == "CASP") and (
        getattr(payload, "wallet_type", "Hosted") == "Unhosted"
        and payload.amount > 1000
        and not getattr(payload, "wallet_cryptographically_verified", True)
    ):
        decision = "REJECT"
        reasons  = [
            f"Unhosted wallet receiving {payload.amount} {payload.stablecoin_type} "
            f"exceeds EU MiCA/TFR threshold of 1,000. Cryptographic proof required."
        ] + reasons

    # ── Map agentic decision → legacy ComplianceResponse status ──────────────
    if decision == "APPROVE":
        status = "Approve"
        # Generate a deterministic auth hash so the UI shows the green lock icon
        raw    = f"{payload.sender_address}:{payload.receiver_address}:{payload.amount}"
        auth_hash = _hashlib.sha256(raw.encode()).hexdigest()
        reason = reasons[0] if reasons else "All compliance checks passed."
        return _CR(status="Approve", reason=reason, authorization_hash=auth_hash)

    elif decision == "WATCH":
        reason = reasons[0] if reasons else "High-risk jurisdiction — flagged for review."
        return _CR(status="Flag", reason=reason, authorization_hash=None)

    else:  # REJECT
        reason = reasons[0] if reasons else "Compliance check failed."
        return _CR(status="Block", reason=reason, authorization_hash=None)
