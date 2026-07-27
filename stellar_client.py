import os
import asyncio
from stellar_sdk import ServerAsync, AiohttpClient, Keypair, TransactionBuilder, Network, Asset
from stellar_sdk.exceptions import NotFoundError

# Use a persistent async client to enable HTTP Keep-Alive
# This completely eliminates TLS/TCP handshake overhead on subsequent requests
persistent_client = AiohttpClient()
server = ServerAsync("https://horizon-testnet.stellar.org", client=persistent_client)

async def simulate_stellar_transfer(sender: str, receiver: str, amount: float) -> bool:
    """
    Simulate a Stellar transfer asynchronously.
    Fetches both sender and receiver accounts in parallel to drastically reduce latency.
    """
    try:
        # Basic Stellar Public Key Validation
        if not sender.startswith("G") or not receiver.startswith("G") or len(sender) != 56 or len(receiver) != 56:
            print("Stellar Simulation Reverted: Invalid Address Format")
            return False

        # Fetch both accounts concurrently!
        sender_task = asyncio.create_task(server.accounts().account_id(sender).call())
        receiver_task = asyncio.create_task(server.accounts().account_id(receiver).call())

        try:
            sender_acc, receiver_acc = await asyncio.gather(sender_task, receiver_task)
        except NotFoundError:
            print("Stellar Simulation Reverted: One of the accounts does not exist on the ledger.")
            return False

        # For this demo, we check if the sender has enough native XLM balance 
        sender_balances = sender_acc.get('balances', [])
        has_balance = False
        for b in sender_balances:
            if b.get('asset_type') == 'native':
                if float(b.get('balance', 0)) >= amount:
                    has_balance = True
                break
        
        if not has_balance:
            print("Stellar Simulation Reverted: Insufficient funds.")
            return False

        return True

    except Exception as e:
        print(f"Stellar Simulation Reverted: {e}")
        return False

async def execute_stellar_transfer(sender_secret: str, receiver_pub: str, amount: float) -> str:
    """
    Builds, signs, and broadcasts a live transaction to the Stellar Testnet.
    Returns the real ledger hash if successful.
    """
    try:
        sender_keypair = Keypair.from_secret(sender_secret)
        # Fetch the latest sequence number for the sender account
        source_account = await server.load_account(sender_keypair.public_key)
        
        tx = (
            TransactionBuilder(
                source_account=source_account,
                network_passphrase=Network.TESTNET_NETWORK_PASSPHRASE,
                base_fee=100
            )
            .append_payment_op(
                destination=receiver_pub,
                asset=Asset.native(),
                amount=str(amount)
            )
            .set_timeout(30)
            .build()
        )
        
        tx.sign(sender_keypair)
        
        # Broadcast the signed transaction to the network
        response = await server.submit_transaction(tx)
        return response.get('hash')
        
    except Exception as e:
        print(f"Stellar Live Execution Failed: {e}")
        return None
