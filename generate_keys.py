from stellar_sdk import Keypair
import requests

sender = Keypair.random()
receiver = Keypair.random()

print(f"SENDER_PUB={sender.public_key}")
print(f"SENDER_SECRET={sender.secret}")
print(f"RECEIVER_PUB={receiver.public_key}")
print(f"RECEIVER_SECRET={receiver.secret}")

# Fund sender
res = requests.get(f"https://friendbot.stellar.org/?addr={sender.public_key}")
print(f"Funded Sender: {res.status_code}")

# Fund receiver
res2 = requests.get(f"https://friendbot.stellar.org/?addr={receiver.public_key}")
print(f"Funded Receiver: {res2.status_code}")
