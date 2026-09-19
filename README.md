# LexIO

Policy engine for stablecoin transfers. A transfer is checked against a small set of MAS PSN02, EU MiCA/TFR, and US GENIUS Act gates. Optional Groth16 (Circom/snarkjs) over a Poseidon commitment of wallet hash, risk tier, timestamp, and salt — not a proof of sanctions or risk-tier correctness.

The proof is off by default (Transfer tab, Groth16 on). Screening today uses in-repo fixture lists, not OFAC/Chainalysis. Chains are testnets. SQLite is the audit log. Optional Gemini text explains a decision; the decision itself is the rule engine.

## What works

- Rule evaluation (SCDD / CDD / EDD) and audit log
- Optional Groth16 prove/verify via Circom + snarkjs (`circuits/compliance.circom`)
- Testnet adapters: XRPL, Stellar, Ethereum, Base, Polygon, Arbitrum, Solana, Aptos

## What does not

- Live SDN/PEP feeds
- A multi-agent swarm
- Production key management or a licensed-issuer deployment

## Run locally

```bash
cp .env.example .env
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
npm ci
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

```bash
cd frontend
npm install
npm run dev
```

`GEMINI_API_KEY` is optional. Without it, narratives are rule-based.

Verify a downloaded proof:

```bash
npx snarkjs groth16 verify vkey.json publicSignals.json proof.json
```
