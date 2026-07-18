"""
compliance_engine.py — Core rule engine for cross-border crypto compliance.

Rules are evaluated in priority order; the first violation short-circuits
evaluation and returns a REJECT. If all rules pass, APPROVE is returned.

Implemented regulations:
  1. MAS PSN02  — Monetary Authority of Singapore Payment Services Notice 02
  2. EU MiCA / TFR — EU Markets in Crypto-Assets / Transfer of Funds Regulation
"""
from models import ComplianceRequest, ComplianceResponse

# ---------------------------------------------------------------------------
# Rule constants
# ---------------------------------------------------------------------------
MAS_PSN02_THRESHOLD = 1500.0   # SGD / equivalent — full originator details required above this
EU_TFR_THRESHOLD = 1000.0      # EUR / equivalent — cryptographic proof required above this


def evaluate(request: ComplianceRequest) -> ComplianceResponse:
    """
    Evaluate a compliance request against all active regulations.

    Parameters
    ----------
    request : ComplianceRequest
        The validated incoming payload.

    Returns
    -------
    ComplianceResponse
        status = "REJECT" with the applicable reason if any rule is violated,
        otherwise status = "APPROVE".
    """

    # ── Rule 1: MAS PSN02 ───────────────────────────────────────────────────
    # Singapore MAS PSN02 mandates full originator details for transfers
    # exceeding SGD 1,500. A missing KYC on the sender violates this notice.
    if request.amount > MAS_PSN02_THRESHOLD and not request.sender_kyc_complete:
        return ComplianceResponse(
            status="REJECT",
            reason=(
                "MAS PSN02 Violation: Missing full originator details "
                "for transfer > 1500 limit."
            ),
        )

    # ── Rule 2: EU MiCA / Transfer of Funds Regulation ─────────────────────
    # EU TFR Article 14 requires cryptographic proof of ownership for
    # unhosted wallets receiving transfers above EUR 1,000.
    if (
        request.wallet_type == "Unhosted"
        and request.amount > EU_TFR_THRESHOLD
        and not request.wallet_cryptographically_verified
    ):
        return ComplianceResponse(
            status="REJECT",
            reason=(
                "EU TFR Violation: Unhosted wallets receiving > 1,000 limit "
                "require cryptographic proof."
            ),
        )

    # ── Default: Full clearance ─────────────────────────────────────────────
    return ComplianceResponse(
        status="APPROVE",
        reason="Transaction meets all MAS and MiCA compliance requirements.",
    )
