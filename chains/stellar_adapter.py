"""Stellar Testnet adapter — wraps stellar_client.py."""
from __future__ import annotations

from typing import Dict, Optional

from chains.base_adapter import ChainAdapter
from chains.registry import register_chain
from stellar_client import execute_stellar_transfer


class StellarAdapter(ChainAdapter):
    chain_id = "stellar"
    display_name = "Stellar Testnet"
    native_asset = "XLM"
    explorer_base_url = "https://stellar.expert/explorer/testnet"
    testnet_label = "Testnet"
    icon = "S"
    finality_time = "~5s"
    address_prefix = "G"

    def validate_address(self, address: str) -> bool:
        return address.startswith("G") and len(address) == 56

    async def execute_transfer(
        self,
        sender_secret: str,
        receiver_address: str,
        amount: float,
    ) -> Optional[str]:
        try:
            return await execute_stellar_transfer(sender_secret, receiver_address, amount)
        except Exception as exc:
            return self._fallback_transfer(amount, error=str(exc))

    async def anchor_memo(
        self,
        account_secret: str,
        account_address: str,
        memo_data: str,
    ) -> Dict:
        return self._fallback_anchor(memo_data, error="Stellar memo anchoring not implemented")

    async def create_escrow(
        self,
        sender_secret: str,
        sender_address: str,
        destination: Optional[str],
        amount_usd: float,
        reason: str,
    ) -> Dict:
        return self._fallback_escrow(amount_usd, reason)


register_chain(StellarAdapter())
