"""
chains — Multi-chain adapter package for LexIO.

Provides a unified interface for executing transfers, anchoring compliance
credentials, and creating escrows across multiple blockchain networks.

Usage:
    from chains import get_chain, list_chains

    adapter = get_chain("solana")
    tx_hash = await adapter.execute_transfer(secret, receiver, amount)
"""
from chains.registry import get_chain, list_chains, CHAIN_REGISTRY  # noqa: F401
