"""
xrpl_client.py — XRPL Testnet execution pipeline for LexIO.
Builds, signs, and broadcasts a live XRP Testnet payment.
"""
from xrpl.asyncio.clients import AsyncWebsocketClient
from xrpl.asyncio.transaction import submit_and_wait
from xrpl.models.transactions import Payment
from xrpl.wallet import Wallet
from xrpl.utils import xrp_to_drops

# XRPL Testnet WebSocket node — AsyncWebsocketClient supports async context manager
XRPL_TESTNET_URL = "wss://s.altnet.rippletest.net:51233"


async def execute_xrpl_transfer(sender_seed: str, receiver_address: str, amount: float) -> str:
    """
    Builds, signs, and submits a live XRP Testnet payment transaction.
    Uses AsyncWebsocketClient which properly supports the async context manager protocol.
    Returns the real ledger tx_hash if successful, or None on failure.
    """
    try:
        async with AsyncWebsocketClient(XRPL_TESTNET_URL) as client:
            sender_wallet = Wallet.from_seed(sender_seed)

            # Cap test payments at 1 XRP to preserve testnet funds
            drops = xrp_to_drops(min(amount, 1.0))

            tx = Payment(
                account=sender_wallet.classic_address,
                destination=receiver_address,
                amount=drops,
            )

            # submit_and_wait: signs, submits, and waits for ledger validation
            response = await submit_and_wait(tx, client, sender_wallet)
            result = response.result

            tx_result = result.get("meta", {}).get("TransactionResult")
            if tx_result == "tesSUCCESS":
                return result.get("hash")
            else:
                print(f"XRPL Live Execution Failed: {tx_result}")
                return None

    except Exception as e:
        print(f"XRPL Live Execution Failed: {e}")
        return None
