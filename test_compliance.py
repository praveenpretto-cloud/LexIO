"""
test_compliance.py — Automated test suite for the LexIO compliance engine.

Covers every decision branch with deterministic, isolated test cases.
Refactored to use httpx.AsyncClient and anyio to test the async database integration.

Run:
    pytest test_compliance.py -v
"""
import pytest
from httpx import AsyncClient, ASGITransport

from database import Base, engine
from main import app

pytestmark = pytest.mark.anyio

@pytest.fixture(scope="session", autouse=True)
def create_tables():
    """Ensure all SQLite tables exist before any test runs."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def anyio_backend():
    return "asyncio"

@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------
async def post_check(client: AsyncClient, payload: dict) -> dict:
    response = await client.post("/api/v1/compliance/check", json=payload)
    assert response.status_code == 200, (
        f"Expected HTTP 200 but got {response.status_code}: {response.text}"
    )
    return response.json()


# ---------------------------------------------------------------------------
# Rule 1 — MAS PSN02
# ---------------------------------------------------------------------------
class TestMASPSN02:
    async def test_reject_when_amount_exceeds_threshold_and_kyc_missing(self, async_client):
        """amount > 1500 AND sender_kyc_complete=False → MAS PSN02 REJECT"""
        result = await post_check(async_client, {
            "amount": 2000.0,
            "wallet_type": "Hosted",
            "sender_kyc_complete": False,
            "wallet_cryptographically_verified": True,
        })
        assert result["status"] == "REJECT"
        assert "MAS PSN02" in result["reason"]
        assert "1500" in result["reason"]

    async def test_approve_when_amount_exceeds_threshold_but_kyc_complete(self, async_client):
        """amount > 1500 AND sender_kyc_complete=True → KYC present, no violation"""
        result = await post_check(async_client, {
            "amount": 2000.0,
            "wallet_type": "Hosted",
            "sender_kyc_complete": True,
            "wallet_cryptographically_verified": True,
        })
        assert result["status"] == "APPROVE"

    async def test_approve_when_amount_at_threshold(self, async_client):
        """amount == 1500 (not strictly greater) → no MAS PSN02 violation"""
        result = await post_check(async_client, {
            "amount": 1500.0,
            "wallet_type": "Hosted",
            "sender_kyc_complete": False,
            "wallet_cryptographically_verified": True,
        })
        assert result["status"] == "APPROVE"

    async def test_approve_when_amount_below_threshold_kyc_missing(self, async_client):
        """amount < 1500 AND sender_kyc_complete=False → below MAS threshold"""
        result = await post_check(async_client, {
            "amount": 500.0,
            "wallet_type": "Hosted",
            "sender_kyc_complete": False,
            "wallet_cryptographically_verified": True,
        })
        assert result["status"] == "APPROVE"


# ---------------------------------------------------------------------------
# Rule 2 — EU MiCA / Transfer of Funds Regulation
# ---------------------------------------------------------------------------
class TestEUTFR:
    async def test_reject_unhosted_above_threshold_not_verified(self, async_client):
        """Unhosted + amount > 1000 + not verified → EU TFR REJECT"""
        result = await post_check(async_client, {
            "amount": 1500.0,
            "wallet_type": "Unhosted",
            "sender_kyc_complete": True,
            "wallet_cryptographically_verified": False,
        })
        assert result["status"] == "REJECT"
        assert "EU TFR" in result["reason"]
        assert "1,000" in result["reason"]

    async def test_approve_unhosted_above_threshold_but_verified(self, async_client):
        """Unhosted + amount > 1000 + verified → cryptographic proof satisfies TFR"""
        result = await post_check(async_client, {
            "amount": 1500.0,
            "wallet_type": "Unhosted",
            "sender_kyc_complete": True,
            "wallet_cryptographically_verified": True,
        })
        assert result["status"] == "APPROVE"

    async def test_approve_hosted_above_threshold_not_verified(self, async_client):
        """Hosted wallet — EU TFR only applies to Unhosted wallets"""
        result = await post_check(async_client, {
            "amount": 1500.0,
            "wallet_type": "Hosted",
            "sender_kyc_complete": True,
            "wallet_cryptographically_verified": False,
        })
        assert result["status"] == "APPROVE"

    async def test_approve_unhosted_at_threshold_not_verified(self, async_client):
        """amount == 1000 (not strictly greater) → TFR does not trigger"""
        result = await post_check(async_client, {
            "amount": 1000.0,
            "wallet_type": "Unhosted",
            "sender_kyc_complete": True,
            "wallet_cryptographically_verified": False,
        })
        assert result["status"] == "APPROVE"


# ---------------------------------------------------------------------------
# Combined / edge cases
# ---------------------------------------------------------------------------
class TestCombinedRules:
    async def test_mas_wins_when_both_rules_violated(self, async_client):
        """Both MAS PSN02 and EU TFR are violated — MAS is evaluated first."""
        result = await post_check(async_client, {
            "amount": 2000.0,
            "wallet_type": "Unhosted",
            "sender_kyc_complete": False,
            "wallet_cryptographically_verified": False,
        })
        assert result["status"] == "REJECT"
        assert "MAS PSN02" in result["reason"]

    async def test_full_clearance_low_amount(self, async_client):
        """Small amount with no KYC or crypto verification → full APPROVE"""
        result = await post_check(async_client, {
            "amount": 100.0,
            "wallet_type": "Hosted",
            "sender_kyc_complete": False,
            "wallet_cryptographically_verified": False,
        })
        assert result["status"] == "APPROVE"
        assert "MAS" in result["reason"] and "MiCA" in result["reason"]

    async def test_full_clearance_all_checks_pass(self, async_client):
        """High amount, unhosted, fully verified — APPROVE"""
        result = await post_check(async_client, {
            "amount": 5000.0,
            "wallet_type": "Unhosted",
            "sender_kyc_complete": True,
            "wallet_cryptographically_verified": True,
        })
        assert result["status"] == "APPROVE"


# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------
class TestInputValidation:
    async def test_reject_invalid_wallet_type(self, async_client):
        """wallet_type must be 'Hosted' or 'Unhosted' — anything else is a 422"""
        response = await async_client.post("/api/v1/compliance/check", json={
            "amount": 500.0,
            "wallet_type": "Unknown",
            "sender_kyc_complete": True,
            "wallet_cryptographically_verified": True,
        })
        assert response.status_code == 422

    async def test_reject_negative_amount(self, async_client):
        """amount must be > 0 — negative values should return 422"""
        response = await async_client.post("/api/v1/compliance/check", json={
            "amount": -100.0,
            "wallet_type": "Hosted",
            "sender_kyc_complete": True,
            "wallet_cryptographically_verified": True,
        })
        assert response.status_code == 422

    async def test_reject_missing_required_fields(self, async_client):
        """Incomplete payload must return 422 Unprocessable Entity"""
        response = await async_client.post("/api/v1/compliance/check", json={
            "amount": 500.0,
        })
        assert response.status_code == 422

    async def test_reject_zero_amount(self, async_client):
        """amount=0 violates gt=0 constraint — must be 422"""
        response = await async_client.post("/api/v1/compliance/check", json={
            "amount": 0.0,
            "wallet_type": "Hosted",
            "sender_kyc_complete": True,
            "wallet_cryptographically_verified": True,
        })
        assert response.status_code == 422

    async def test_reject_string_bool_kyc_coercion(self, async_client):
        """SECURITY: string 'yes' must NOT be coerced to bool True for sender_kyc_complete"""
        response = await async_client.post("/api/v1/compliance/check", json={
            "amount": 500.0,
            "wallet_type": "Hosted",
            "sender_kyc_complete": "yes",
            "wallet_cryptographically_verified": True,
        })
        assert response.status_code == 422

    async def test_reject_string_bool_verified_coercion(self, async_client):
        """SECURITY: string 'true' must NOT be coerced to bool True for wallet_cryptographically_verified"""
        response = await async_client.post("/api/v1/compliance/check", json={
            "amount": 500.0,
            "wallet_type": "Hosted",
            "sender_kyc_complete": True,
            "wallet_cryptographically_verified": "true",
        })
        assert response.status_code == 422

    async def test_reject_integer_bool_coercion(self, async_client):
        """SECURITY: integer 1 must NOT be silently coerced to boolean True"""
        response = await async_client.post("/api/v1/compliance/check", json={
            "amount": 500.0,
            "wallet_type": "Hosted",
            "sender_kyc_complete": 1,
            "wallet_cryptographically_verified": True,
        })
        assert response.status_code == 422

    async def test_reject_sql_injection_in_wallet_type(self, async_client):
        """SECURITY: SQL-like strings in wallet_type must be rejected by Literal constraint"""
        response = await async_client.post("/api/v1/compliance/check", json={
            "amount": 500.0,
            "wallet_type": "Hosted; DROP TABLE transaction_log;--",
            "sender_kyc_complete": True,
            "wallet_cryptographically_verified": True,
        })
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# QA Audit Matrix — the four explicit scenarios from the audit brief
# ---------------------------------------------------------------------------
class TestAuditMatrix:
    """Explicit 4-scenario matrix requested in the QA audit."""

    async def test_matrix_1_pass_hosted_kyc_true(self, async_client):
        """Matrix #1: Amount=500, Wallet=Hosted, KYC=True, Verified=False → APPROVE"""
        result = await post_check(async_client, {
            "amount": 500,
            "wallet_type": "Hosted",
            "sender_kyc_complete": True,
            "wallet_cryptographically_verified": False,
        })
        assert result["status"] == "APPROVE", f"Expected APPROVE, got: {result}"

    async def test_matrix_2_fail_mas_psn02(self, async_client):
        """Matrix #2: Amount=2000, Wallet=Hosted, KYC=False, Verified=False → REJECT MAS PSN02"""
        result = await post_check(async_client, {
            "amount": 2000,
            "wallet_type": "Hosted",
            "sender_kyc_complete": False,
            "wallet_cryptographically_verified": False,
        })
        assert result["status"] == "REJECT"
        assert "MAS PSN02" in result["reason"], f"Expected MAS PSN02 reason, got: {result['reason']}"

    async def test_matrix_3_fail_eu_tfr(self, async_client):
        """Matrix #3: Amount=1200, Wallet=Unhosted, KYC=True, Verified=False → REJECT EU TFR"""
        result = await post_check(async_client, {
            "amount": 1200,
            "wallet_type": "Unhosted",
            "sender_kyc_complete": True,
            "wallet_cryptographically_verified": False,
        })
        assert result["status"] == "REJECT"
        assert "EU TFR" in result["reason"], f"Expected EU TFR reason, got: {result['reason']}"

    async def test_matrix_4_pass_unhosted_fully_verified(self, async_client):
        """Matrix #4: Amount=5000, Wallet=Unhosted, KYC=True, Verified=True → APPROVE"""
        result = await post_check(async_client, {
            "amount": 5000,
            "wallet_type": "Unhosted",
            "sender_kyc_complete": True,
            "wallet_cryptographically_verified": True,
        })
        assert result["status"] == "APPROVE", f"Expected APPROVE, got: {result}"


# ---------------------------------------------------------------------------
# History endpoint
# ---------------------------------------------------------------------------
class TestHistoryEndpoint:
    async def test_history_returns_list(self, async_client):
        """GET /api/v1/compliance/history must return a valid paginated response."""
        response = await async_client.get("/api/v1/compliance/history")
        assert response.status_code == 200
        data = response.json()
        assert "records" in data
        assert "total" in data
        assert isinstance(data["records"], list)
