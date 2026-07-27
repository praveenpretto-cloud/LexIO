"""
compliance_engine.py — Core modular policy engine for cross-border crypto compliance.
"""
from models import ComplianceRequest, ComplianceResponse
import hashlib

# ---------------------------------------------------------------------------
# Global Rule Config (Dynamic Toggles)
# ---------------------------------------------------------------------------
active_policies = {
    "OFAC_SANCTIONS": True,
    "TRAVEL_RULE": True,
    "MAS_PSN02": True,
    "EU_MICA_TFR": True,
}

# Mock OFAC Sanctioned Addresses
OFAC_LIST = {
    "0x1f9090aae28b8a3dceadf281b0f12828e676c326",
    "0x8576acc5c05d6ce88f4e49bf65bdf0c62f91353c"
}

def _hash_transaction(request: ComplianceRequest) -> str:
    """Generate a cryptographic hash for the approved transaction."""
    payload = f"{request.sender_address}:{request.receiver_address}:{request.amount}:{request.stablecoin_type}"
    return hashlib.sha256(payload.encode()).hexdigest()

async def evaluate(request: ComplianceRequest) -> ComplianceResponse:
    """
    Evaluate a compliance request against active regulations.
    Returns: ComplianceResponse with Approve, Block, or Flag.
    """

    
    # ── Rule 1: OFAC Sanctions ──────────────────────────────────────────────
    if active_policies.get("OFAC_SANCTIONS"):
        if request.sender_address.lower() in OFAC_LIST or request.receiver_address.lower() in OFAC_LIST:
            return ComplianceResponse(
                status="Block",
                reason="OFAC Violation: Sender or Receiver is on the sanctioned list."
            )
            
    # ── Rule 2: Travel Rule (US vs EU Thresholds) ───────────────────────────
    if active_policies.get("TRAVEL_RULE"):
        # US requires Travel Rule data > $3,000. EU requires it for > $0.
        threshold = 0.0
        if request.sender_jurisdiction == "US" or request.receiver_jurisdiction == "US":
            threshold = 3000.0
        
        # EU rules apply if either side is EU
        if request.sender_jurisdiction == "EU" or request.receiver_jurisdiction == "EU":
            threshold = 0.0
            
        if request.amount > threshold and not request.sender_kyc_complete:
            return ComplianceResponse(
                status="Block",
                reason=f"Travel Rule Violation: Missing KYC for amount > {threshold}."
            )
            
    # ── Rule 3: MAS PSN02 (Singapore) ───────────────────────────────────────
    if active_policies.get("MAS_PSN02"):
        if (request.sender_jurisdiction == "SG" or request.receiver_jurisdiction == "SG") and request.amount > 1500.0 and not request.sender_kyc_complete:
            return ComplianceResponse(
                status="Block",
                reason="MAS PSN02 Violation: Missing full originator details for transfer > 1500 SGD limit."
            )

    # ── Rule 4: EU MiCA / TFR ───────────────────────────────────────────────
    if active_policies.get("EU_MICA_TFR"):
        if request.receiver_jurisdiction == "EU" and request.wallet_type == "Unhosted" and request.amount > 1000.0 and not request.wallet_cryptographically_verified:
            return ComplianceResponse(
                status="Block",
                reason="EU TFR Violation: Unhosted wallets receiving > 1,000 require cryptographic proof."
            )

    # ── Default: Full clearance ─────────────────────────────────────────────
    return ComplianceResponse(
        status="Approve",
        reason="Transaction meets all compliance requirements.",
        authorization_hash=_hash_transaction(request)
    )
