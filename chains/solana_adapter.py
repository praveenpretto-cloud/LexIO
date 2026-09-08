"""
chains/solana_adapter.py — Solana Devnet adapter for LexIO.

Executes real SOL transfers and memo anchoring on Solana Devnet.
Uses the solana-py / solders SDK. Escrow is simulated (Solana requires
a program for native escrow).
"""
from __future__ import annotations

import os
from typing import Dict, Optional

try:
    from solders.keypair import Keypair as SolKeypair
    from solders.pubkey import Pubkey
    from solders.system_program import TransferParams, transfer
    from solders.transaction import Transaction
    from solders.message import Message
    from solders.hash import Hash as SolHash
    from solders.instruction import AccountMeta, Instruction
    from solana.rpc.async_api import AsyncClient
    from solana.rpc.commitment import Confirmed
    _SOLANA_AVAILABLE = True
except ImportError:
    _SOLANA_AVAILABLE = False

from chains.base_adapter import ChainAdapter
from chains.registry import register_chain

SOLANA_DEVNET_URL = "https://api.devnet.solana.com"
# Memo Program v2 on Solana
MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"


class SolanaAdapter(ChainAdapter):
    """Solana Devnet — real SOL transfers + Memo Program anchoring."""

    chain_id         = "solana"
    display_name     = "Solana Devnet"
    native_asset     = "SOL"
    explorer_base_url = "https://explorer.solana.com"
    testnet_label    = "Devnet"
    icon             = "◎"
    finality_time    = "~400ms"
    address_prefix   = "base58"

    def __init__(self) -> None:
        self._rpc_url = os.environ.get("SOLANA_RPC_URL", SOLANA_DEVNET_URL)
        # Solana private key as base58 string or JSON byte array
        self._private_key_str = os.environ.get("SOLANA_PRIVATE_KEY", "")

    def get_explorer_url(self, tx_hash: str) -> str:
        return f"{self.explorer_base_url}/tx/{tx_hash}?cluster=devnet"

    def validate_address(self, address: str) -> bool:
        if not _SOLANA_AVAILABLE:
            # Basic heuristic: base58, 32-44 chars
            return 32 <= len(address) <= 44 and address.isalnum()
        try:
            Pubkey.from_string(address)
            return True
        except Exception:
            return False

    def _get_keypair(self, secret: str = "") -> Optional["SolKeypair"]:
        """Derive a Solana keypair from a secret string or env var."""
        raw = secret or self._private_key_str
        if not raw:
            return None
        try:
            # Try base58 secret key first
            return SolKeypair.from_base58_string(raw)
        except Exception:
            pass
        try:
            # Try JSON byte array format [1,2,3,...]
            import json
            key_bytes = bytes(json.loads(raw))
            return SolKeypair.from_bytes(key_bytes)
        except Exception:
            return None

    async def execute_transfer(
        self,
        sender_secret: str,
        receiver_address: str,
        amount: float,
    ) -> Optional[str]:
        if not _SOLANA_AVAILABLE:
            print("[solana] solana-py not installed — transfer simulated")
            return self._fallback_transfer(amount, "solana-py not installed")

        keypair = self._get_keypair(sender_secret)
        if not keypair:
            print("[solana] No private key configured — transfer simulated")
            return self._fallback_transfer(amount, "No private key configured")

        try:
            async with AsyncClient(self._rpc_url) as client:
                receiver = Pubkey.from_string(receiver_address)
                # Convert SOL to lamports (1 SOL = 1e9 lamports), cap at 0.001 SOL for testnet
                lamports = int(min(amount, 0.001) * 1_000_000_000)

                ix = transfer(TransferParams(
                    from_pubkey=keypair.pubkey(),
                    to_pubkey=receiver,
                    lamports=lamports,
                ))

                # Get recent blockhash
                resp = await client.get_latest_blockhash(commitment=Confirmed)
                blockhash = resp.value.blockhash

                msg = Message.new_with_blockhash(
                    [ix],
                    keypair.pubkey(),
                    blockhash,
                )
                tx = Transaction.new_unsigned(msg)
                tx.sign([keypair], blockhash)

                result = await client.send_transaction(tx)
                sig = str(result.value)

                # Confirm the transaction
                await client.confirm_transaction(result.value, commitment=Confirmed)

                return sig

        except Exception as e:
            print(f"[solana] Transfer error: {e} — transfer simulated")
            return self._fallback_transfer(amount, f"Transfer error: {e}")

    async def anchor_memo(
        self,
        account_secret: str,
        account_address: str,
        memo_data: str,
    ) -> Dict:
        if not _SOLANA_AVAILABLE:
            return self._fallback_anchor(memo_data, error="solana-py not installed")

        keypair = self._get_keypair(account_secret)
        if not keypair:
            return self._fallback_anchor(memo_data, error="Solana private key not configured")

        try:
            async with AsyncClient(self._rpc_url) as client:
                # Create a Memo instruction
                memo_program = Pubkey.from_string(MEMO_PROGRAM_ID)
                # Truncate memo to 566 bytes (Memo program limit)
                memo_bytes = memo_data.encode("utf-8")[:566]

                memo_ix = Instruction(
                    program_id=memo_program,
                    accounts=[AccountMeta(keypair.pubkey(), is_signer=True, is_writable=True)],
                    data=memo_bytes,
                )

                resp = await client.get_latest_blockhash(commitment=Confirmed)
                blockhash = resp.value.blockhash

                msg = Message.new_with_blockhash(
                    [memo_ix],
                    keypair.pubkey(),
                    blockhash,
                )
                tx = Transaction.new_unsigned(msg)
                tx.sign([keypair], blockhash)

                result = await client.send_transaction(tx)
                sig = str(result.value)
                await client.confirm_transaction(result.value, commitment=Confirmed)

                return {
                    "transaction_hash": sig,
                    "ledger_index":     None,
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
        # Solana requires a deployed program for escrow — simulate
        return self._fallback_escrow(amount_usd, reason)


# ── Self-register ────────────────────────────────────────────────────────────
if _SOLANA_AVAILABLE:
    register_chain(SolanaAdapter())
else:
    # Register a placeholder so the chain still appears in the UI
    # but operations will return fallback hashes
    register_chain(SolanaAdapter())
