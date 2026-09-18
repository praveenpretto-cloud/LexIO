import os
from dotenv import load_dotenv
from web3 import Web3
load_dotenv(".env")
rpc = os.getenv("ALCHEMY_RPC_URL")
pk = os.getenv("TESTNET_PRIVATE_KEY")
print(f"RPC: {rpc[:30]}...")
print(f"PK Length: {len(pk) if pk else 0}")
w3 = Web3(Web3.HTTPProvider(rpc))
print(f"Connected: {w3.is_connected()}")
if w3.is_connected():
    try:
        account = w3.eth.account.from_key(pk)
        print(f"Address: {account.address}")
        balance = w3.eth.get_balance(account.address)
        print(f"Balance: {w3.from_wei(balance, 'ether')} ETH")
    except Exception as e:
        print(f"Error parsing key: {e}")
