"""
chains/registry.py — Chain adapter registry for LexIO.

Auto-discovers and registers all chain adapters on import. The rest of the
application interacts with chains exclusively through ``get_chain()`` and
``list_chains()``, never importing adapter modules directly.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from chains.base_adapter import ChainAdapter

# ── Global registry ──────────────────────────────────────────────────────────
CHAIN_REGISTRY: Dict[str, ChainAdapter] = {}


def register_chain(adapter: ChainAdapter) -> None:
    """Register a chain adapter instance in the global registry."""
    CHAIN_REGISTRY[adapter.chain_id] = adapter


def get_chain(chain_id: str) -> Optional[ChainAdapter]:
    """
    Look up a chain adapter by its ID.

    Args:
        chain_id: lowercase chain identifier, e.g. "solana", "xrpl"

    Returns:
        The ChainAdapter instance, or None if not found.
    """
    return CHAIN_REGISTRY.get(chain_id.lower())


def list_chains() -> List[Dict]:
    """
    Return metadata for all registered chains.

    Used by the ``GET /api/v1/chains`` endpoint.
    """
    return [adapter.to_dict() for adapter in CHAIN_REGISTRY.values()]


# ── Auto-discovery: import all adapter modules to trigger registration ───────
# Each adapter module calls ``register_chain()`` at module level.
def _discover_adapters() -> None:
    """Import all adapter modules so they self-register."""
    # These imports are intentionally inside a function so that any import
    # errors in optional adapters (missing SDK) are caught gracefully.
    try:
        import chains.xrpl_adapter     # noqa: F401
    except ImportError as e:
        print(f"[LexIO] XRPL adapter unavailable: {e}")

    try:
        import chains.stellar_adapter  # noqa: F401
    except ImportError as e:
        print(f"[LexIO] Stellar adapter unavailable: {e}")

    try:
        import chains.evm_adapter      # noqa: F401
    except ImportError as e:
        print(f"[LexIO] EVM adapter unavailable: {e}")

    try:
        import chains.solana_adapter   # noqa: F401
    except ImportError as e:
        print(f"[LexIO] Solana adapter unavailable: {e}")

    try:
        import chains.aptos_adapter    # noqa: F401
    except ImportError as e:
        print(f"[LexIO] Aptos adapter unavailable: {e}")


_discover_adapters()
