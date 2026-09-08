"""
chains/base_adapter.py — Abstract base class for all LexIO chain adapters.

Every supported blockchain implements this interface. The compliance engine
and API endpoints interact with chains exclusively through this contract,
making it trivial to add new chains without touching business logic.
"""
from __future__ import annotations

import hashlib
from abc import ABC, abstractmethod
from typing import Dict, Optional


class ChainAdapter(ABC):
    """
    Abstract base class that all chain adapters must implement.

    Subclasses provide chain-specific logic for transfers, memo anchoring,
    escrow creation, address validation, and block explorer URL generation.
    """

    # ── Identity (must be set by subclass) ───────────────────────────────────
    chain_id: str              # Unique lowercase key, e.g. "solana"
    display_name: str          # Human-readable name, e.g. "Solana Devnet"
    native_asset: str          # Native token symbol, e.g. "SOL"
    explorer_base_url: str     # Block explorer root, e.g. "https://explorer.solana.com"
    testnet_label: str         # Testnet name shown in UI, e.g. "Devnet"
    icon: str                  # Emoji or short icon for the UI, e.g. "◎"
    finality_time: str         # Approximate finality, e.g. "~400ms"
    address_prefix: str        # Address format hint, e.g. "base58" or "0x"

    # ── Core operations ──────────────────────────────────────────────────────

    @abstractmethod
    async def execute_transfer(
        self,
        sender_secret: str,
        receiver_address: str,
        amount: float,
    ) -> Optional[str]:
        """
        Sign and broadcast a real transfer on the chain's testnet.

        Args:
            sender_secret:   Private key / seed / secret for the sender wallet.
            receiver_address: Destination wallet address.
            amount:          Amount in the chain's native asset.

        Returns:
            The transaction hash as a string, or None if the transaction failed.
        """

    @abstractmethod
    async def anchor_memo(
        self,
        account_secret: str,
        account_address: str,
        memo_data: str,
    ) -> Dict:
        """
        Anchor compliance data on-chain as a memo / transaction payload.

        Used to stamp credential hashes on-ledger for tamper-evident storage.

        Args:
            account_secret:  Private key / seed for the issuer account.
            account_address: Public address of the issuer account.
            memo_data:       The compliance payload to anchor (JSON string).

        Returns:
            {
                "transaction_hash": str | None,
                "ledger_index":     int | None,
                "note":             str | None,
            }
        """

    @abstractmethod
    async def create_escrow(
        self,
        sender_secret: str,
        sender_address: str,
        destination: Optional[str],
        amount_usd: float,
        reason: str,
    ) -> Dict:
        """
        Create an on-chain escrow / hold for WATCH decisions.

        Locks funds until a compliance officer signs off. Not all chains
        support native escrow — those that don't should return a simulated
        result using ``_fallback_escrow()``.

        Args:
            sender_secret:  Sender private key.
            sender_address: Sender public address.
            destination:    Destination address (optional).
            amount_usd:     Original USD amount of the blocked transaction.
            reason:         The compliance reason for the escrow.

        Returns:
            Dict with transaction_hash, status, explorer URL, etc.
        """

    @abstractmethod
    def validate_address(self, address: str) -> bool:
        """
        Check whether an address string is a plausible address for this chain.

        This is a fast, local validation (format only — not on-chain lookup).
        """

    # ── Concrete helpers (shared by all adapters) ────────────────────────────

    def get_explorer_url(self, tx_hash: str) -> str:
        """Build a full block explorer URL for a given transaction hash."""
        return f"{self.explorer_base_url}/tx/{tx_hash}"

    def to_dict(self) -> Dict:
        """Serialize adapter metadata for the /api/v1/chains API response."""
        return {
            "chain_id":         self.chain_id,
            "display_name":     self.display_name,
            "native_asset":     self.native_asset,
            "explorer_base_url": self.explorer_base_url,
            "testnet_label":    self.testnet_label,
            "icon":             self.icon,
            "finality_time":    self.finality_time,
            "address_prefix":   self.address_prefix,
        }

    def _fallback_escrow(
        self,
        amount_usd: float,
        reason: str,
        error: str = "",
    ) -> Dict:
        """
        Fallback when the chain's testnet is unreachable or escrow is not
        natively supported — returns a deterministic simulated escrow hash
        so the demo always shows meaningful output.
        """
        sim_hash = hashlib.sha256(
            f"{self.chain_id}:{amount_usd}:{reason}:{error}".encode()
        ).hexdigest().upper()
        return {
            "transaction_hash":  f"SIM_{sim_hash[:32]}",
            "ledger_index":      None,
            "offer_sequence":    None,
            "status":            "EscrowSimulated",
            "xrpl_explorer_url": None,
            "finish_after":      None,
            "amount_locked":     amount_usd,
            "amount_usd_held":   amount_usd,
            "condition":         f"Simulated escrow on {self.display_name}. Reason: {reason[:80]}",
            "destination":       None,
            "chain":             self.chain_id,
            "note":              f"{self.display_name} escrow simulated: {error[:120]}" if error else f"{self.display_name} does not support native escrow — simulated.",
        }

    def _fallback_anchor(self, memo_data: str, error: str = "") -> Dict:
        """
        Fallback when anchoring fails — returns a deterministic simulated hash.
        """
        sim_hash = hashlib.sha256(
            f"{self.chain_id}:anchor:{memo_data[:64]}:{error}".encode()
        ).hexdigest().upper()
        return {
            "transaction_hash": f"SIM_{sim_hash[:32]}",
            "ledger_index":     None,
            "chain":            self.chain_id,
            "note":             f"{self.display_name} anchor simulated: {error[:120]}" if error else f"{self.display_name} anchor simulated.",
        }

    def _fallback_transfer(self, amount: float, error: str = "") -> str:
        """
        Fallback when execution fails — returns a deterministic simulated transaction hash.
        """
        sim_hash = hashlib.sha256(
            f"{self.chain_id}:transfer:{amount}:{error}".encode()
        ).hexdigest().upper()
        return f"SIM_{sim_hash[:32]}"
