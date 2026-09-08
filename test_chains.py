import pytest
from chains import get_chain, list_chains
from chains.registry import _discover_adapters

def test_list_chains():
    # Make sure discovery ran
    _discover_adapters()
    chains = list_chains()
    # Should at least have xrpl and stellar, and likely evm chains
    assert len(chains) >= 2
    
    chain_ids = [c["chain_id"] for c in chains]
    assert "xrpl" in chain_ids
    assert "stellar" in chain_ids
    assert "ethereum" in chain_ids
    assert "base" in chain_ids

def test_get_chain():
    xrpl = get_chain("xrpl")
    assert xrpl is not None
    assert xrpl.chain_id == "xrpl"
    
    base = get_chain("base")
    assert base is not None
    assert base.chain_id == "base"
    assert base.native_asset == "ETH"
    assert base.validate_address("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18") is True
    assert base.validate_address("invalid") is False

def test_evm_fallback():
    base = get_chain("base")
    # Simulate an escrow which should drop to fallback
    res = base._fallback_escrow(100.0, "Test reason")
    assert res["status"] == "EscrowSimulated"
    assert res["amount_locked"] == 100.0
    assert "SIM_" in res["transaction_hash"]
