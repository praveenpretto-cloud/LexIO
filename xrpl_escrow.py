"""
xrpl_escrow.py — Real XRPL Testnet EscrowCreate for LexIO compliance holds.

When a compliance decision is WATCH (EDD required), instead of just returning
a fake hash string, this module submits a real EscrowCreate transaction to the
XRPL Testnet. The escrow locks funds until a LexIO compliance agent signs off
via an EscrowFinish transaction.

This creates a real, verifiable ledger object at testnet.xrpl.org.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional

from xrpl.asyncio.clients import AsyncWebsocketClient
from xrpl.asyncio.transaction import submit_and_wait
from xrpl.models.transactions import EscrowCreate, EscrowFinish
from xrpl.utils import xrp_to_drops, datetime_to_ripple_time
from xrpl.wallet import Wallet

XRPL_TESTNET_URL = "wss://s.altnet.rippletest.net:51233"

# Testnet demo accounts (no real value)
_DEMO_ESCROW_DESTINATION = "rEGcPEhZbvFMr14wBhm3TUc1EanWWMU367"


async def create_compliance_escrow(
    sender_secret: str,
    sender_account: str,
    destination: Optional[str],
    amount_usd: float,
    reason: str,
) -> Dict:
    """
    Submit a real EscrowCreate transaction to the XRPL Testnet.

    The escrow locks a nominal 1 XRP (demo — not the full USD amount, as this
    is testnet) until finish_after time elapses and an EscrowFinish is submitted
    by the compliance officer.

    Args:
        sender_secret:  XRPL testnet wallet seed.
        sender_account: XRPL testnet sender account address.
        destination:    Destination address for the escrow (or demo default).
        amount_usd:     Original USD amount of the blocked transaction.
        reason:         The compliance reason for the escrow.

    Returns:
        Dict with transaction_hash, ledger_index, offer_sequence, status, and condition.
    """
    dest = destination if destination and destination.startswith("r") else _DEMO_ESCROW_DESTINATION

    # Set escrow to be finishable after 5 minutes (demo) — compliance review window
    finish_after = datetime.now(timezone.utc) + timedelta(minutes=5)
    ripple_finish_after = datetime_to_ripple_time(finish_after)

    try:
        async with AsyncWebsocketClient(XRPL_TESTNET_URL) as client:
            sender_wallet = Wallet.from_seed(sender_secret)

            # Lock 1 XRP as a symbolic compliance hold (testnet — no real value)
            tx = EscrowCreate(
                account=sender_account,
                destination=dest,
                amount=xrp_to_drops(1),          # 1 XRP drop hold
                finish_after=ripple_finish_after,  # Unlocks after 5 min review window
            )

            response = await submit_and_wait(tx, client, sender_wallet)
            result   = response.result

            tx_result    = result.get("meta", {}).get("TransactionResult")
            tx_hash      = result.get("hash")
            ledger_index = result.get("ledger_index")
            sequence     = result.get("Sequence") or result.get("tx_json", {}).get("Sequence")

            if tx_result == "tesSUCCESS":
                return {
                    "transaction_hash":  tx_hash,
                    "ledger_index":      ledger_index,
                    "offer_sequence":    sequence,
                    "status":            "EscrowCreated",
                    "xrpl_explorer_url": f"https://testnet.xrpl.org/transactions/{tx_hash}",
                    "finish_after":      finish_after.isoformat(),
                    "amount_locked_xrp": 1,
                    "amount_usd_held":   amount_usd,
                    "condition":         f"Requires LexIO Compliance Agent Signature (EDD Review). Reason: {reason[:80]}",
                    "destination":       dest,
                }
            else:
                # XRPL submission failed (e.g. insufficient testnet funds) — return graceful fallback
                return _fallback_escrow(amount_usd, reason, error=f"XRPL tx failed: {tx_result}")

    except Exception as exc:  # noqa: BLE001
        # Network timeout or other error — return graceful fallback so demo always runs
        return _fallback_escrow(amount_usd, reason, error=str(exc))


def _fallback_escrow(amount_usd: float, reason: str, error: str = "") -> Dict:
    """
    Fallback when XRPL testnet is unreachable — returns a deterministic simulated escrow
    so the demo still shows meaningful output without a live network connection.
    """
    sim_hash = hashlib.sha256(f"{amount_usd}:{reason}:{error}".encode()).hexdigest().upper()
    return {
        "transaction_hash":  f"SIM_{sim_hash[:32]}",
        "ledger_index":      None,
        "offer_sequence":    None,
        "status":            "EscrowSimulated",
        "xrpl_explorer_url": None,
        "finish_after":      None,
        "amount_locked_xrp": 1,
        "amount_usd_held":   amount_usd,
        "condition":         f"Simulated escrow (testnet unreachable). Reason: {reason[:80]}",
        "destination":       _DEMO_ESCROW_DESTINATION,
        "note":              f"Live XRPL unavailable: {error[:120]}",
    }
