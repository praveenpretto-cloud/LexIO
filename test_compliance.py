"""
test_compliance.py — Automated test suite for the LexIO Agentic Compliance Engine.

Tests the new risk-tier policy engine directly (no HTTP round-trips) so results
are deterministic and independent of XRPL/Stellar testnet availability.

Run:
    pytest test_compliance.py -v
"""
import pytest
from datetime import datetime, timezone

from compliance_engine import check_agentic_finance_compliance, MOCK_WALLET_OWNERSHIP
from credentials import issue_wallet_credential, VerifiableCredential
from models import AgentTransferRequest, ComplianceDecision, RiskTier

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session", autouse=True)
def create_tables():
    """Ensure all SQLite tables exist before any test runs."""
    from database import Base, engine
    Base.metadata.create_all(bind=engine)
    yield
    # Intentionally NOT dropping tables — keep audit trail across test runs.


# ---------------------------------------------------------------------------
# Test 1 — Clean wallet pair → SCDD → APPROVE
# ---------------------------------------------------------------------------

async def test_clean_wallets_approve():
    """Two registered clean wallets (US / GB) should receive SCDD → APPROVE."""
    request = AgentTransferRequest(
        source_wallet_address="rN7n7otQDd6FczFgLdQqhkFGzPb7E4k7Ud",   # alice_clean / US
        destination_wallet_address="rAbCdEfGhIjKlMnOpQrStUvWxYzAbCdEfG",  # bob_clean / GB
    )
    decision = await check_agentic_finance_compliance(request)

    assert decision.decision == "APPROVE", (
        f"Expected APPROVE for clean wallet pair, got {decision.decision}. "
        f"Reasons: {decision.reasons}"
    )
    assert decision.risk_tier == RiskTier.SCDD, (
        f"Expected SCDD tier, got {decision.risk_tier}"
    )
    assert decision.flagged_by == [], (
        f"Expected no flags, got {decision.flagged_by}"
    )
    assert decision.confidence_score > 0.95, (
        f"Expected high confidence for clean pair, got {decision.confidence_score}"
    )


# ---------------------------------------------------------------------------
# Test 2 — PEP destination wallet → EDD → REJECT
# ---------------------------------------------------------------------------

async def test_pep_wallet_rejects():
    """Wallet owned by a PEP (vladimir_putin mock) must be REJECT."""
    request = AgentTransferRequest(
        source_wallet_address="rN7n7otQDd6FczFgLdQqhkFGzPb7E4k7Ud",   # alice_clean
        destination_wallet_address="rU6K7V8oST9vMN2pQr4sT5uV6wX7yZ8aA",  # vladimir_putin
    )
    decision = await check_agentic_finance_compliance(request)

    assert decision.decision == "REJECT", (
        f"Expected REJECT for PEP wallet, got {decision.decision}. "
        f"Reasons: {decision.reasons}"
    )
    assert "pep_hit" in decision.flagged_by, (
        f"Expected 'pep_hit' in flagged_by, got {decision.flagged_by}"
    )
    assert decision.risk_tier == RiskTier.EDD, (
        f"Expected EDD tier for PEP hit, got {decision.risk_tier}"
    )


# ---------------------------------------------------------------------------
# Test 3 — High-risk jurisdiction destination → EDD → WATCH
# ---------------------------------------------------------------------------

async def test_high_risk_jurisdiction_triggers_edd():
    """
    Wallet in a FATF high-risk jurisdiction (Myanmar / MM) with no PEP/sanctions hit
    should be EDD tier → WATCH, not an immediate REJECT.
    """
    request = AgentTransferRequest(
        source_wallet_address="rN7n7otQDd6FczFgLdQqhkFGzPb7E4k7Ud",   # alice_clean / US
        destination_wallet_address="rHighRiskCountryWalletXxXxXxXxXx",  # myanmar_entity / MM
    )
    decision = await check_agentic_finance_compliance(request)

    assert decision.risk_tier == RiskTier.EDD, (
        f"Expected EDD tier for high-risk jurisdiction, got {decision.risk_tier}"
    )
    assert decision.decision == "WATCH", (
        f"Expected WATCH for high-risk jurisdiction (no PEP/sanctions), got {decision.decision}"
    )
    assert "jurisdiction_risk" in decision.flagged_by, (
        f"Expected 'jurisdiction_risk' in flagged_by, got {decision.flagged_by}"
    )


# ---------------------------------------------------------------------------
# Test 4 — W3C Verifiable Credential issuance
# ---------------------------------------------------------------------------

async def test_credential_issuance():
    """Approved payment should issue a W3C VC with correct DID and structure."""
    now = datetime.now(timezone.utc)
    credential = await issue_wallet_credential(
        wallet_address="rN7n7otQDd6FczFgLdQqhkFGzPb7E4k7Ud",
        risk_tier="scdd",
        timestamp=now,
    )

    # DID format check
    assert credential.id.startswith("did:lexio:"), (
        f"Expected DID to start with 'did:lexio:', got {credential.id}"
    )
    assert len(credential.id) == len("did:lexio:") + 16, (
        f"Expected 16-char hash suffix in DID, got {credential.id}"
    )

    # Risk tier preserved
    assert credential.risk_tier == "scdd", (
        f"Expected risk_tier='scdd', got {credential.risk_tier}"
    )

    # W3C VC structure
    vc_dict = credential.to_dict()
    assert "@context" in vc_dict, "Missing @context in W3C VC"
    assert "https://www.w3.org/2018/credentials/v1" in vc_dict["@context"]
    assert "VerifiableCredential" in vc_dict["type"]
    assert "ComplianceClearance" in vc_dict["type"]
    assert vc_dict["credentialSubject"]["riskTier"] == "SCDD"
    assert vc_dict["credentialSubject"]["complianceStatus"] == "cleared"

    # JSON serialization works
    json_str = credential.to_json_string()
    assert isinstance(json_str, str)
    assert "did:lexio:" in json_str


# ---------------------------------------------------------------------------
# Test 5 — Linked-wallet risk inheritance
# ---------------------------------------------------------------------------

async def test_linked_wallet_inheritance():
    """
    rPqq3gQJ5M7nOpKlM9pQr2sT3uV4wXyZa is owned by evgeny_prigozhin (PEP).
    rU6K7V8oST9vMN2pQr4sT5uV6wX7yZ8aA (putin) links to it.
    But this test checks the direct PEP on rPqq3... as the destination.
    Indirect path: a wallet linked to rU6... (PEP wallet) should inherit risk.
    """
    # rPqq... is directly owned by a PEP (Prigozhin) — direct REJECT
    request = AgentTransferRequest(
        source_wallet_address="rN7n7otQDd6FczFgLdQqhkFGzPb7E4k7Ud",     # alice_clean
        destination_wallet_address="rPqq3gQJ5M7nOpKlM9pQr2sT3uV4wXyZa",  # prigozhin — PEP
    )
    decision = await check_agentic_finance_compliance(request)

    assert decision.decision == "REJECT", (
        f"Expected REJECT for PEP-linked wallet, got {decision.decision}. "
        f"Reasons: {decision.reasons}"
    )
    assert "pep_hit" in decision.flagged_by, (
        f"Expected 'pep_hit' in flagged_by, got {decision.flagged_by}"
    )

    # Now verify linked-wallet inheritance: create a wallet that is NOT a PEP itself
    # but is linked to the PEP wallet. Use a custom wallet_db for this sub-case.
    linked_only_db = {
        "rCleanWalletLinkedToPEP": {"owner_name": "clean_but_linked", "jurisdiction": "US"},
        "rU6K7V8oST9vMN2pQr4sT5uV6wX7yZ8aA": {"owner_name": "vladimir_putin", "jurisdiction": "RU"},
        **MOCK_WALLET_OWNERSHIP,
    }
    from compliance_engine import LINKED_WALLETS
    # Temporarily inject the link (non-destructive — only affects this call)
    original_links = LINKED_WALLETS.copy()
    LINKED_WALLETS["rCleanWalletLinkedToPEP"] = ["rU6K7V8oST9vMN2pQr4sT5uV6wX7yZ8aA"]

    try:
        request2 = AgentTransferRequest(
            source_wallet_address="rN7n7otQDd6FczFgLdQqhkFGzPb7E4k7Ud",
            destination_wallet_address="rCleanWalletLinkedToPEP",
        )
        decision2 = await check_agentic_finance_compliance(request2, wallet_db=linked_only_db)
    finally:
        # Restore original LINKED_WALLETS
        LINKED_WALLETS.clear()
        LINKED_WALLETS.update(original_links)

    assert decision2.decision == "REJECT", (
        f"Expected REJECT for wallet linked to PEP, got {decision2.decision}. "
        f"Reasons: {decision2.reasons}"
    )
    assert "linked_wallet_risk" in decision2.flagged_by, (
        f"Expected 'linked_wallet_risk' in flagged_by, got {decision2.flagged_by}"
    )


# ---------------------------------------------------------------------------
# Additional edge-case tests
# ---------------------------------------------------------------------------

async def test_sanctions_hit_rejects():
    """Wallet owned by a sanctioned entity (north_korea_bank) must be REJECT."""
    request = AgentTransferRequest(
        source_wallet_address="rSanctionWalletNorthKoreaXxXxXxXx",      # north_korea_bank
        destination_wallet_address="rN7n7otQDd6FczFgLdQqhkFGzPb7E4k7Ud", # alice_clean
    )
    decision = await check_agentic_finance_compliance(request)

    assert decision.decision == "REJECT"
    assert "sanctions_hit" in decision.flagged_by


async def test_medium_risk_jurisdiction_is_cdd_approve():
    """Cayman Islands (KY) wallet should be CDD → APPROVE (monitored, not blocked)."""
    request = AgentTransferRequest(
        source_wallet_address="rN7n7otQDd6FczFgLdQqhkFGzPb7E4k7Ud",   # alice_clean / US
        destination_wallet_address="rCaymanFundWalletXxXxXxXxXxXxXx",  # cayman_fund_xyz / KY
    )
    decision = await check_agentic_finance_compliance(request)

    assert decision.decision == "APPROVE", (
        f"Expected APPROVE (CDD) for medium-risk jurisdiction, got {decision.decision}"
    )
    assert decision.risk_tier == RiskTier.CDD, (
        f"Expected CDD tier for Cayman wallet, got {decision.risk_tier}"
    )
    assert "medium_risk_jurisdiction" in decision.flagged_by


async def test_unknown_wallet_defaults_to_clean():
    """Wallet not in the registry should default to jurisdiction 'XX' → SCDD → APPROVE."""
    request = AgentTransferRequest(
        source_wallet_address="rN7n7otQDd6FczFgLdQqhkFGzPb7E4k7Ud",
        destination_wallet_address="rCompletelyUnknownWalletAddress123",
    )
    decision = await check_agentic_finance_compliance(request)

    # Unknown wallets get "XX" jurisdiction — not in high/medium risk lists
    assert decision.decision == "APPROVE"
    assert decision.risk_tier == RiskTier.SCDD


async def test_credential_valid_for_correct_duration():
    """Issued credential expiry should match the valid_for_days parameter."""
    now = datetime.now(timezone.utc)
    credential = await issue_wallet_credential(
        wallet_address="rAbCdEfGhIjKlMnOpQrStUvWxYzAbCdEfG",
        risk_tier="cdd",
        timestamp=now,
        valid_for_days=7,
    )
    delta = credential.expires_at - credential.issued_at
    assert delta.days == 7, f"Expected 7-day validity, got {delta.days} days"
