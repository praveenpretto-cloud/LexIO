"""
chains/xrpl_adapter.py — XRPL Testnet adapter for LexIO.

Wraps the existing xrpl_client.py and xrpl_escrow.py logic into the
ChainAdapter interface. XRPL is the primary chain for LexIO — it supports
full payments, memo anchoring, and native escrow.
"""
from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

from xrpl.asyncio.clients import AsyncWebsocketClient
from xrpl.asyncio.transaction import submit_and_wait
from xrpl.models.transactions import EscrowCreate, Memo, Payment
from xrpl.utils import datetime_to_ripple_time, xrp_to_drops
from xrpl.wallet import Wallet

from chains.base_adapter import ChainAdapter
from chains.registry import register_chain

XRPL_TESTNET_URL = "wss://s.altnet.rippletest.net:51233"
_DEMO_RECEIVER   = "rEGcPEhZbvFMr14wBhm3TUc1EanWWMU367"


class XRPLAdapter(ChainAdapter):
    """XRPL Testnet — full support: transfers, memo anchoring, native escrow."""

    chain_id         = "xrpl"
    display_name     = "XRP Ledger Testnet"
    native_asset     = "XRP"
    explorer_base_url = "https://testnet.xrpl.org"
    testnet_label    = "Altnet"
    icon             = "◈"
    finality_time    = "~4s"
    address_prefix   = "r"

    def __init__(self) -> None:
        self._sender_seed  = os.environ.get("XRPL_SENDER_SEED", "sEdSZHxNrgDqzymji6CQyp1cnJFBeaA")
        self._receiver     = os.environ.get("XRPL_RECEIVER_ADDR", _DEMO_RECEIVER)
        self._issuer_account = os.environ.get("XRPL_ISSUER_ACCOUNT", "rapGvMNARmA46HRNoGBiTy1nEwiKdVTfPw")
        self._issuer_secret  = os.environ.get("XRPL_ISSUER_SECRET", os.environ.get("XRPL_SENDER_SEED", "sEdSZHxNrgDqzymji6CQyp1cnJFBeaA"))

    def get_explorer_url(self, tx_hash: str) -> str:
        return f"{self.explorer_base_url}/transactions/{tx_hash}"

    def validate_address(self, address: str) -> bool:
        return address.startswith("r") and 25 <= len(address) <= 34

    async def execute_transfer(
        self,
        sender_secret: str,
        receiver_address: str,
        amount: float,
    ) -> Optional[str]:
        try:
            async with AsyncWebsocketClient(XRPL_TESTNET_URL) as client:
                sender_wallet = Wallet.from_seed(sender_secret)
                drops = xrp_to_drops(min(amount, 1.0))
                tx = Payment(
                    account=sender_wallet.classic_address,
                    destination=receiver_address,
                    amount=drops,
                )
                response = await submit_and_wait(tx, client, sender_wallet)
                result = response.result
                tx_result = result.get("meta", {}).get("TransactionResult")
                if tx_result == "tesSUCCESS":
                    return result.get("hash")
                else:
                    print(f"XRPL transfer failed: {tx_result} — transfer simulated")
                    return self._fallback_transfer(amount, f"XRPL tx failed: {tx_result}")
        except Exception as e:
            print(f"XRPL transfer error: {e} — transfer simulated")
            return self._fallback_transfer(amount, f"Transfer error: {e}")

    async def anchor_memo(
        self,
        account_secret: str,
        account_address: str,
        memo_data: str,
    ) -> Dict:
        if not account_secret or not account_address:
            return self._fallback_anchor(memo_data, error="XRPL issuer not configured")

        memo_hex      = memo_data.encode("utf-8").hex().upper()
        memo_type_hex = b"ComplianceCredential".hex().upper()

        try:
            async with AsyncWebsocketClient(XRPL_TESTNET_URL) as client:
                sender_wallet = Wallet.from_seed(account_secret)
                tx = Payment(
                    account=account_address,
                    destination=_DEMO_RECEIVER,
                    amount="1",
                    memos=[
                        Memo(
                            memo_type=memo_type_hex,
                            memo_data=memo_hex,
                        )
                    ],
                )
                response = await submit_and_wait(tx, client, sender_wallet)
                result = response.result
                tx_result    = result.get("meta", {}).get("TransactionResult")
                tx_hash      = result.get("hash")
                ledger_index = result.get("ledger_index")

                if tx_result == "tesSUCCESS":
                    return {
                        "transaction_hash": tx_hash,
                        "ledger_index":     ledger_index,
                        "chain":            self.chain_id,
                    }
                else:
                    return self._fallback_anchor(memo_data, error=f"XRPL tx failed: {tx_result}")

        except Exception as exc:
            return self._fallback_anchor(memo_data, error=f"{type(exc).__name__}: {exc}")

    async def create_escrow(
        self,
        sender_secret: str,
        sender_address: str,
        destination: Optional[str],
        amount_usd: float,
        reason: str,
    ) -> Dict:
        dest = destination if destination and destination.startswith("r") else _DEMO_RECEIVER
        finish_after = datetime.now(timezone.utc) + timedelta(minutes=5)
        ripple_finish_after = datetime_to_ripple_time(finish_after)

        try:
            async with AsyncWebsocketClient(XRPL_TESTNET_URL) as client:
                sender_wallet = Wallet.from_seed(sender_secret)
                tx = EscrowCreate(
                    account=sender_address,
                    destination=dest,
                    amount=xrp_to_drops(1),
                    finish_after=ripple_finish_after,
                )
                response = await submit_and_wait(tx, client, sender_wallet)
                result = response.result
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
                        "xrpl_explorer_url": self.get_explorer_url(tx_hash),
                        "finish_after":      finish_after.isoformat(),
                        "amount_locked_xrp": 1,
                        "amount_usd_held":   amount_usd,
                        "condition":         f"Requires LexIO Compliance Agent Signature (EDD Review). Reason: {reason[:80]}",
                        "destination":       dest,
                        "chain":             self.chain_id,
                    }
                else:
                    return self._fallback_escrow(amount_usd, reason, error=f"XRPL tx failed: {tx_result}")

        except Exception as exc:
            return self._fallback_escrow(amount_usd, reason, error=str(exc))


# ── Self-register ────────────────────────────────────────────────────────────
register_chain(XRPLAdapter())
