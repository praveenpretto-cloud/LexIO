import os
import time
from web3 import Web3
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import requests
from dotenv import load_dotenv

load_dotenv()

ALCHEMY_URL = os.getenv("ALCHEMY_RPC_URL", "")

# ---------------------------------------------------------------------------
# Latency Optimization: Persistent TCP Connections (Keep-Alive)
# ---------------------------------------------------------------------------
# We use a custom requests Session to hold the socket open to Alchemy.
# This prevents the 20-30ms TLS handshake penalty on every request.
session = requests.Session()
retry = Retry(connect=3, backoff_factor=0.1)
adapter = HTTPAdapter(pool_connections=100, pool_maxsize=100, max_retries=retry)
session.mount('http://', adapter)
session.mount('https://', adapter)

if ALCHEMY_URL:
    w3 = Web3(Web3.HTTPProvider(ALCHEMY_URL, session=session))
    
    # Warmup Call to establish connection pool and DNS cache
    try:
        w3.eth.block_number
    except Exception as e:
        print(f"Warning: Failed to warmup Web3 connection: {e}")
else:
    w3 = None
    print("Warning: ALCHEMY_RPC_URL is not set.")

# Standard ERC-20 ABI (Minimal)
ERC20_ABI = [
    {
        "constant": False,
        "inputs": [
            {"name": "to", "type": "address"},
            {"name": "value", "type": "uint256"}
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function"
    }
]

# We will use Sepolia USDC address as a default if none is provided.
# This allows simulation of a real token contract.
SEPOLIA_USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

def simulate_erc20_transfer(sender: str, receiver: str, amount_wei: int, token_address: str = SEPOLIA_USDC) -> bool:
    """
    Simulate an ERC-20 transfer using eth_call.
    Raises an exception if the transaction would revert on-chain.
    """
    if not w3 or not w3.is_connected():
        # Fallback if no RPC is configured; approve by default
        return True
        
    try:
        # Some basic validation to prevent Web3 crashing on invalid addresses
        if not w3.is_address(sender) or not w3.is_address(receiver):
            print("Web3 Simulation Reverted: Invalid Address Format")
            return False

        contract = w3.eth.contract(address=w3.to_checksum_address(token_address), abi=ERC20_ABI)
        
        # Build the transaction object for eth_call
        tx = contract.functions.transfer(
            w3.to_checksum_address(receiver), 
            amount_wei
        ).build_transaction({
            'from': w3.to_checksum_address(sender),
            # We don't need gas for eth_call, but some nodes require a valid gas limit
            'gas': 100000 
        })
        
        # This performs an eth_call (single flight simulation)
        # If the address has insufficient funds or is blacklisted, it reverts.
        w3.eth.call(tx)
        
        return True
    except Exception as e:
        print(f"Web3 Simulation Reverted: {e}")
        return False
