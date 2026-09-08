"""
chains/evm_adapter.py — Generic EVM chain adapter for LexIO.

A single adapter class that handles Ethereum, Base, Polygon, and Arbitrum
by swapping the RPC URL and chain metadata. All four chains share the same
Web3 transfer / anchoring logic.

Each chain instance signs and broadcasts real testnet transactions. If no
private key is configured, falls back to deterministic simulation hashes.
"""
from __future__ import annotations

import hashlib
import json
import os
from typing import Dict, Optional

from web3 import Web3
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import requests

from chains.base_adapter import ChainAdapter
from chains.registry import register_chain


def _create_web3(rpc_url: str) -> Optional[Web3]:
    """Create a Web3 instance with persistent connection pooling."""
    if not rpc_url:
        return None

    session = requests.Session()
    retry = Retry(connect=3, backoff_factor=0.1)
    adapter = HTTPAdapter(pool_connections=10, pool_maxsize=10, max_retries=retry)
    session.mount("http://", adapter)
    session.mount("https://", adapter)

    w3 = Web3(Web3.HTTPProvider(rpc_url, session=session))

    # Warmup to establish connection pool
    try:
        w3.eth.block_number
    except Exception:
        pass

    return w3


class EVMAdapter(ChainAdapter):
    """
    Generic EVM adapter — reusable across Ethereum, Base, Polygon, Arbitrum.

    Supports:
    - Real signed native-token transfers on testnet
    - Memo anchoring via transaction input data
    - Simulated escrow (EVM doesn't have native escrow without a contract)
    """

    def __init__(
        self,
        chain_id: str,
        display_name: str,
        native_asset: str,
        explorer_base_url: str,
        testnet_label: str,
        icon: str,
        finality_time: str,
        rpc_url_env_key: str,
        chain_int_id: int,
        default_rpc_url: str = "",
    ) -> None:
        self.chain_id         = chain_id
        self.display_name     = display_name
        self.native_asset     = native_asset
        self.explorer_base_url = explorer_base_url
        self.testnet_label    = testnet_label
        self.icon             = icon
        self.finality_time    = finality_time
        self.address_prefix   = "0x"
        self._chain_int_id    = chain_int_id

        rpc_url = os.environ.get(rpc_url_env_key, default_rpc_url)
        self._w3 = _create_web3(rpc_url) if rpc_url else None
        self._private_key = os.environ.get("EVM_PRIVATE_KEY", os.environ.get("TESTNET_PRIVATE_KEY", ""))

    def get_explorer_url(self, tx_hash: str) -> str:
        return f"{self.explorer_base_url}/tx/{tx_hash}"

    def validate_address(self, address: str) -> bool:
        if not address.startswith("0x") or len(address) != 42:
            return False
        try:
            int(address, 16)
            return True
        except ValueError:
            return False

    async def execute_transfer(
        self,
        sender_secret: str,
        receiver_address: str,
        amount: float,
    ) -> Optional[str]:
        w3 = self._w3
        pk = sender_secret or self._private_key

        if not w3 or not w3.is_connected():
            print(f"[{self.chain_id}] Web3 not connected — transfer simulated")
            return self._fallback_transfer(amount, "Web3 not connected")
        if not pk or pk == "your_testnet_private_key_here":
            print(f"[{self.chain_id}] No private key configured — transfer simulated")
            return self._fallback_transfer(amount, "No private key configured")

        try:
            account = w3.eth.account.from_key(pk)
            nonce = w3.eth.get_transaction_count(account.address)

            # Send a minimal amount of native token (0.0001)
            value_wei = w3.to_wei(min(amount, 0.0001), "ether")

            tx = {
                "nonce":    nonce,
                "to":       w3.to_checksum_address(receiver_address),
                "value":    value_wei,
                "gas":      21000,
                "gasPrice": w3.eth.gas_price,
                "chainId":  self._chain_int_id,
            }

            signed = w3.eth.account.sign_transaction(tx, pk)
            tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)

            if receipt.status == 1:
                return receipt.transactionHash.hex()
            else:
                print(f"[{self.chain_id}] Transfer reverted — transfer simulated")
                return self._fallback_transfer(amount, "Transfer reverted")

        except Exception as e:
            print(f"[{self.chain_id}] Transfer error: {e} — transfer simulated")
            return self._fallback_transfer(amount, f"Transfer error: {e}")

    async def anchor_memo(
        self,
        account_secret: str,
        account_address: str,
        memo_data: str,
    ) -> Dict:
        w3 = self._w3
        pk = account_secret or self._private_key

        if not w3 or not w3.is_connected() or not pk or pk == "your_testnet_private_key_here":
            return self._fallback_anchor(memo_data, error=f"{self.display_name} not configured")

        try:
            account = w3.eth.account.from_key(pk)
            nonce = w3.eth.get_transaction_count(account.address)

            # Encode memo as hex in the transaction input data
            memo_hex = memo_data.encode("utf-8").hex()

            tx = {
                "nonce":    nonce,
                "to":       account.address,   # self-send (0 value, data only)
                "value":    0,
                "gas":      50000,
                "gasPrice": w3.eth.gas_price,
                "chainId":  self._chain_int_id,
                "data":     f"0x{memo_hex}",
            }

            signed = w3.eth.account.sign_transaction(tx, pk)
            tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)

            if receipt.status == 1:
                return {
                    "transaction_hash": receipt.transactionHash.hex(),
                    "ledger_index":     receipt.blockNumber,
                    "chain":            self.chain_id,
                }
            else:
                return self._fallback_anchor(memo_data, error=f"{self.display_name} anchor tx reverted")

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
        # EVM chains don't have native escrow without a smart contract
        return self._fallback_escrow(amount_usd, reason)


# ── Register EVM chain instances ─────────────────────────────────────────────

# Ethereum Sepolia
register_chain(EVMAdapter(
    chain_id="ethereum",
    display_name="Ethereum Sepolia",
    native_asset="ETH",
    explorer_base_url="https://sepolia.etherscan.io",
    testnet_label="Sepolia",
    icon="⟠",
    finality_time="~12s",
    rpc_url_env_key="ALCHEMY_RPC_URL",
    chain_int_id=11155111,
))

# Base Sepolia
register_chain(EVMAdapter(
    chain_id="base",
    display_name="Base Sepolia",
    native_asset="ETH",
    explorer_base_url="https://sepolia.basescan.org",
    testnet_label="Sepolia",
    icon="🔵",
    finality_time="~2s",
    rpc_url_env_key="BASE_RPC_URL",
    chain_int_id=84532,
    default_rpc_url="https://sepolia.base.org",
))

# Polygon Amoy
register_chain(EVMAdapter(
    chain_id="polygon",
    display_name="Polygon Amoy",
    native_asset="POL",
    explorer_base_url="https://amoy.polygonscan.com",
    testnet_label="Amoy",
    icon="⬡",
    finality_time="~2s",
    rpc_url_env_key="POLYGON_RPC_URL",
    chain_int_id=80002,
    default_rpc_url="https://rpc-amoy.polygon.technology",
))

# Arbitrum Sepolia
register_chain(EVMAdapter(
    chain_id="arbitrum",
    display_name="Arbitrum Sepolia",
    native_asset="ETH",
    explorer_base_url="https://sepolia.arbiscan.io",
    testnet_label="Sepolia",
    icon="🔷",
    finality_time="~250ms",
    rpc_url_env_key="ARBITRUM_RPC_URL",
    chain_int_id=421614,
    default_rpc_url="https://sepolia-rollup.arbitrum.io/rpc",
))
