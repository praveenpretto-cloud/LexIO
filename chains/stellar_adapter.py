"""
chains/stellar_adapter.py — Stellar Testnet adapter for LexIO.

Wraps the existing stellar_client.py logic into the ChainAdapter interface.
Supports real Horizon Testnet payments. Memo anchoring uses the transaction
memo field. Escrow is simulated (Stellar doesn't have native escrow).
"""
from __future__ import annotations

import os
from typing import Dict, Optional

from stellar_sdk import (
    AiohttpClient,
    Asset,
    Keypair,
    Memo as StellarMemo,
    Network,
    ServerAsync,
    TransactionBuilder,
)

from chains.base_adapter import ChainAdapter
from chains.registry import register_chain

# Persistent async client for HTTP Keep-Alive
_persistent_client = AiohttpClient()
_server = ServerAsync("https://horizon-testnet.stellar.org", client=_persistent_client)


class StellarAdapter(ChainAdapter):
    """Stellar Testnet — real payments + memo anchoring, simulated escrow."""

    chain_id         = "stellar"
    display_name     = "Stellar Testnet"
    native_asset     = "XLM"
    explorer_base_url = "https://stellar.expert/explorer/testnet"
    testnet_label    = "Horizon Testnet"
    icon             = "✦"
    finality_time    = "~5s"
    address_prefix   = "G"

    def __init__(self) -> None:
        self._sender_secret = os.environ.get(
            "STELLAR_SENDER_SECRET",
            "SCENO33654ZLTKIKOST6P6GVQNEKGFMLYBVJQX4CLTUBM5QM6BK6URGR",
        )

    def get_explorer_url(self, tx_hash: str) -> str:
        return f"{self.explorer_base_url}/tx/{tx_hash}"

    def validate_address(self, address: str) -> bool:
        return address.startswith("G") and len(address) == 56

    async def execute_transfer(
        self,
        sender_secret: str,
        receiver_address: str,
        amount: float,
    ) -> Optional[str]:
        try:
            sender_keypair = Keypair.from_secret(sender_secret)
            source_account = await _server.load_account(sender_keypair.public_key)

            tx = (
                TransactionBuilder(
                    source_account=source_account,
                    network_passphrase=Network.TESTNET_NETWORK_PASSPHRASE,
                    base_fee=100,
                )
                .append_payment_op(
                    destination=receiver_address,
                    asset=Asset.native(),
                    amount=str(min(amount, 1.0)),
                )
                .set_timeout(30)
                .build()
            )
            tx.sign(sender_keypair)
            response = await _server.submit_transaction(tx)
            return response.get("hash")

        except Exception as e:
            print(f"Stellar transfer error: {e} — transfer simulated")
            return self._fallback_transfer(amount, f"Transfer error: {e}")

    async def anchor_memo(
        self,
        account_secret: str,
        account_address: str,
        memo_data: str,
    ) -> Dict:
        if not account_secret:
            return self._fallback_anchor(memo_data, error="Stellar sender not configured")

        try:
            sender_keypair = Keypair.from_secret(account_secret)
            source_account = await _server.load_account(sender_keypair.public_key)

            # Stellar memos are limited to 28 bytes for hash type, so we hash the data
            import hashlib
            memo_hash = hashlib.sha256(memo_data.encode()).digest()

            tx = (
                TransactionBuilder(
                    source_account=source_account,
                    network_passphrase=Network.TESTNET_NETWORK_PASSPHRASE,
                    base_fee=100,
                )
                .append_payment_op(
                    destination=sender_keypair.public_key,  # self-payment (1 stroop)
                    asset=Asset.native(),
                    amount="0.0000001",
                )
                .add_hash_memo(memo_hash)
                .set_timeout(30)
                .build()
            )
            tx.sign(sender_keypair)
            response = await _server.submit_transaction(tx)
            tx_hash = response.get("hash")
            ledger = response.get("ledger")

            return {
                "transaction_hash": tx_hash,
                "ledger_index":     ledger,
                "chain":            self.chain_id,
            }

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
        # Stellar does not have native escrow — return simulated
        return self._fallback_escrow(amount_usd, reason)


# ── Self-register ────────────────────────────────────────────────────────────
register_chain(StellarAdapter())
