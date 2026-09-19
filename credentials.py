"""
credentials.py — W3C Verifiable Credential issuance and XRPL anchoring layer.

Issues minimal W3C VC structures for compliant wallets and anchors their
content hash as a Payment memo on the XRP Ledger testnet.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional
from pathlib import Path

from xrpl.asyncio.clients import AsyncWebsocketClient
from xrpl.asyncio.transaction import submit_and_wait
from xrpl.models.transactions import Memo, Payment
from xrpl.utils import xrp_to_drops
from xrpl.wallet import Wallet

from database import AsyncSessionLocal
from db_models import CredentialLog, CredentialAnchorLog

XRPL_TESTNET_URL = "wss://s.altnet.rippletest.net:51233"

# A deterministic private salt for the ZK commitment scheme.
# In production this would be a per-institution key stored in an HSM.
# For the demo, we derive it from a fixed seed so commitments are reproducible.
_ZK_DOMAIN_SECRET = hashlib.sha256(b"LexIO-ZK-Compliance-Domain-v1.0").digest()


import subprocess

# BN128 curve field prime used by snarkjs/circom
_FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617

def _build_zk_commitment(wallet_address: str, risk_tier: str, issued_at: datetime) -> Dict:
    """
    Generate a mathematically real, cryptographically verifiable Groth16 proof using Circom and SnarkJS.
    """
    # Map risk tier to integer for the circuit
    tier_map = {"SCDD": 0, "CDD": 1, "EDD": 2}
    
    # Generate cryptographically secure random salt
    secret_salt = secrets.randbelow(2**128)
    
    # Poseidon-compatible input: hash wallet address to a field element
    wallet_hash = int(hashlib.sha256(wallet_address.encode()).hexdigest(), 16) % _FIELD_PRIME
    
    timestamp_int = int(issued_at.timestamp())
    
    witness = {
        "wallet_hash":  str(wallet_hash),
        "risk_tier":    str(tier_map.get(risk_tier.upper(), 1)),
        "timestamp":    str(timestamp_int),
        "secret_salt":  str(secret_salt),
    }
    
    # Call the snarkjs prover as a subprocess
    script_path = __file__.replace("credentials.py", "scripts/generate_proof.js")
    result = subprocess.run(
        ["node", script_path],
        input=json.dumps(witness),
        capture_output=True, text=True, timeout=30
    )
    
    if result.returncode != 0:
        # Fallback to error or return empty proof
        print("ZK Proof Generation Error:", result.stderr)
        raise RuntimeError(f"ZK Proof generation failed: {result.stderr or result.stdout}")
        
    proof_data = json.loads(result.stdout)
    
    # Save to static/zk for frontend download
    zk_dir = Path(__file__).parent / "static" / "zk"
    zk_dir.mkdir(parents=True, exist_ok=True)
    with open(zk_dir / "proof.json", "w") as f:
        json.dump(proof_data["proof"], f, indent=2)
    with open(zk_dir / "public.json", "w") as f:
        json.dump(proof_data["publicSignals"], f, indent=2)
    
    return {
        "id":               "did:zk:hidden",
        "complianceStatus": "cleared",
        "proofType":        "Groth16",
        "proofScheme":      "LexIO-ZK-v2 (Real Groth16/bn128 via Circom + snarkjs)",
        "zkProof": {
            "pi_a":          proof_data["proof"]["pi_a"],
            "pi_b":          proof_data["proof"]["pi_b"],
            "pi_c":          proof_data["proof"]["pi_c"],
            "publicSignals": proof_data["publicSignals"],
            "protocol":      "groth16",
            "curve":         "bn128",
        },
        "verification": {
            "algorithm":     "Groth16 (Circom + snarkjs)",
            "vkey_url":      "https://lexio.io/zk/vkey.json",
            "note":          "Verify with: snarkjs groth16 verify vkey.json publicSignals.json proof.json",
        },
        "issuedBy": "LexIO ZK-Compliance Engine v2.0",
    }



# ---------------------------------------------------------------------------
# Verifiable Credential
# ---------------------------------------------------------------------------

class VerifiableCredential:
    """
    Minimal W3C Verifiable Credential structure for the LexIO compliance engine.

    Produces a JSON-LD compatible credential that can be stored on-ledger
    as a memo hash. Real production deployments would sign this with a
    controlled DID key and use a proper VC SDK.
    """

    def __init__(
        self,
        wallet_address: str,
        risk_tier: str,
        issued_at: datetime,
        expires_at: datetime,
        issuer: str = "did:lexio:compliance-engine",
        use_zk: bool = False,
    ) -> None:
        self.id             = self._generate_did(wallet_address, issued_at)
        self.wallet_address = wallet_address
        self.risk_tier      = risk_tier
        self.issued_at      = issued_at
        self.expires_at     = expires_at
        self.issuer         = issuer
        self.use_zk         = use_zk

    def _generate_did(self, wallet_address: str, issued_at: datetime) -> str:
        """
        Generate a unique, deterministic DID for this credential.

        Args:
            wallet_address: the wallet being credentialed.
            issued_at: issuance timestamp for uniqueness.

        Returns:
            A DID string of the form ``did:lexio:<16-char-sha256>``.
        """
        hash_input  = f"{wallet_address}:{issued_at.isoformat()}"
        hash_digest = hashlib.sha256(hash_input.encode()).hexdigest()[:16]
        return f"did:lexio:{hash_digest}"

    def to_dict(self) -> Dict:
        """
        Serialize the credential to a JSON-serializable W3C VC dict.

        Returns:
            A dict conforming to the W3C Verifiable Credentials Data Model v1.
        """
        return {
            "@context": [
                "https://www.w3.org/2018/credentials/v1",
                "https://lexio.io/contexts/compliance/v1",
            ],
            "type":           ["VerifiableCredential", "ComplianceClearance"],
            "id":             self.id,
            "issuer":         self.issuer,
            "issuanceDate":   self.issued_at.isoformat(),
            "expirationDate": self.expires_at.isoformat(),
            "credentialSubject": self._build_credential_subject(),
        }

    def _build_credential_subject(self) -> Dict:
        if self.use_zk:
            return _build_zk_commitment(self.wallet_address, self.risk_tier, self.issued_at)
        
        return {
            "id":               f"xrpl:{self.wallet_address}",
            "riskTier":         self.risk_tier.upper(),
            "complianceStatus": "cleared",
            "issuedBy":         "LexIO Agentic Compliance Engine v2.0",
        }

    def to_json_string(self) -> str:
        """
        Serialize to a compact JSON string suitable for on-ledger memo storage.

        Returns:
            Compact JSON string of the W3C VC dict.
        """
        return json.dumps(self.to_dict(), separators=(",", ":"))


# ---------------------------------------------------------------------------
# Issuance
# ---------------------------------------------------------------------------

async def issue_wallet_credential(
    wallet_address: str,
    risk_tier: str,
    timestamp: datetime,
    valid_for_days: int = 30,
    use_zk: bool = False,
) -> VerifiableCredential:
    """
    Issue a W3C Verifiable Credential for a compliant wallet.

    Args:
        wallet_address:  XRPL or Stellar wallet address.
        risk_tier:       "SCDD", "CDD", or "EDD".
        timestamp:       when the compliance check was performed.
        valid_for_days:  validity period in days (default: 30).

    Returns:
        A populated VerifiableCredential instance.
    """
    # Ensure timestamp is timezone-aware
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)

    expires_at = timestamp + timedelta(days=valid_for_days)
    credential = VerifiableCredential(
        wallet_address=wallet_address,
        risk_tier=risk_tier,
        issued_at=timestamp,
        expires_at=expires_at,
        use_zk=use_zk,
    )
    await store_credential_to_db(credential)
    return credential


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

async def store_credential_to_db(credential: VerifiableCredential) -> None:
    """
    Persist a VerifiableCredential to the SQLite credential_logs table.

    Uses the existing AsyncSessionLocal pattern from database.py.

    Args:
        credential: the VC to store.
    """
    async with AsyncSessionLocal() as session:
        log = CredentialLog(
            id=credential.id,
            wallet_address=credential.wallet_address,
            risk_tier=credential.risk_tier,
            issued_at=credential.issued_at,
            expires_at=credential.expires_at,
            credential_json=credential.to_json_string(),
        )
        session.add(log)
        await session.commit()


# ---------------------------------------------------------------------------
# XRPL anchoring
# ---------------------------------------------------------------------------

async def anchor_credential_on_xrpl(
    credential: VerifiableCredential,
    xrpl_account: Optional[str],
    xrpl_secret: Optional[str],
) -> Dict:
    """
    Anchor a credential's DID and content hash on the XRP Ledger testnet.

    Submits a minimal Payment transaction (1 drop of XRP) carrying the
    credential ID and SHA-256 hash as a hex-encoded memo. This makes the
    credential tamper-evident and queryable on-ledger.

    Args:
        credential:   the VC to anchor.
        xrpl_account: the issuer XRPL account address.
        xrpl_secret:  the issuer XRPL seed/secret.

    Returns:
        {
            "transaction_hash": str | None,
            "ledger_index":     int | None,
            "credential_id":    str,
        }
    """
    if not xrpl_secret or not xrpl_account:
        # Graceful degradation for demo environments with no issuer configured
        return {
            "transaction_hash": None,
            "ledger_index":     None,
            "credential_id":    credential.id,
            "note":             "XRPL_SENDER_SEED not configured — anchoring skipped.",
        }

    credential_hash = hashlib.sha256(credential.to_json_string().encode()).hexdigest()

    memo_payload = json.dumps(
        {
            "credential_id":   credential.id,
            "credential_hash": credential_hash,
            "wallet_address":  credential.wallet_address,
            "risk_tier":       credential.risk_tier,
            "issued_at":       credential.issued_at.isoformat(),
        },
        separators=(",", ":"),
    )

    # XRPL memos must be hex-encoded strings
    memo_hex = memo_payload.encode("utf-8").hex().upper()
    memo_type_hex = b"ComplianceCredential".hex().upper()

    try:
        async with AsyncWebsocketClient(XRPL_TESTNET_URL) as client:
            sender_wallet = Wallet.from_seed(xrpl_secret)

            # The memo destination just needs to be a valid XRPL testnet account.
            # The credential subject is identified by the DID in the memo data itself,
            # so routing to a known testnet receiver is fine for all demo scenarios.
            _TESTNET_MEMO_DEST = "rEGcPEhZbvFMr14wBhm3TUc1EanWWMU367"

            tx = Payment(
                account=xrpl_account,
                destination=_TESTNET_MEMO_DEST,
                amount="1",          # 1 drop — minimal cost just to carry the memo
                memos=[
                    Memo(
                        memo_type=memo_type_hex,
                        memo_data=memo_hex,
                    )
                ],
            )


            response = await submit_and_wait(tx, client, sender_wallet)
            result   = response.result

            tx_result    = result.get("meta", {}).get("TransactionResult")
            tx_hash      = result.get("hash")
            ledger_index = result.get("ledger_index")

            if tx_result == "tesSUCCESS":
                # Persist the anchor record
                await _store_anchor_to_db(credential.id, tx_hash, ledger_index)
                return {
                    "transaction_hash": tx_hash,
                    "ledger_index":     ledger_index,
                    "credential_id":    credential.id,
                }
            else:
                return {
                    "transaction_hash": None,
                    "ledger_index":     None,
                    "credential_id":    credential.id,
                    "note":             f"XRPL tx failed: {tx_result}",
                }

    except Exception as exc:  # noqa: BLE001
        return {
            "transaction_hash": None,
            "ledger_index":     None,
            "credential_id":    credential.id,
            "note":             f"XRPL anchoring error: {type(exc).__name__}: {exc}",
        }


def _is_valid_xrpl_address(address: str) -> bool:
    """Basic heuristic — XRPL addresses start with 'r' and are 25–34 chars."""
    return address.startswith("r") and 25 <= len(address) <= 34


async def _store_anchor_to_db(
    credential_id: str,
    transaction_hash: Optional[str],
    ledger_index: Optional[int],
) -> None:
    """
    Persist a credential anchor record to the SQLite credential_anchor_logs table.

    Args:
        credential_id:    DID of the anchored credential.
        transaction_hash: XRPL transaction hash.
        ledger_index:     ledger sequence number of the anchoring tx.
    """
    async with AsyncSessionLocal() as session:
        anchor = CredentialAnchorLog(
            credential_id=credential_id,
            transaction_hash=transaction_hash,
            ledger_index=ledger_index,
        )
        session.add(anchor)
        await session.commit()
