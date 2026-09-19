# LexIO — ZK-Attested Compliance Engine

LexIO is **institutional-grade compliance infrastructure** initially designed for Licensed Payment Stablecoin Issuers (LPSIs), with a roadmap to support the entire Web3 ecosystem.

As global frameworks like the **EU MiCA Regulation**, the **US GENIUS Act**, and **Singapore's MAS PSN02** force stablecoin issuers to monitor cross-border transfers and unhosted wallets, issuers face a massive privacy dilemma: *How do you comply with global AML/KYC laws without exposing your users' private data on public blockchains?*

LexIO solves this. By combining autonomous AI reasoning with decentralized Zero-Knowledge (ZK) cryptography, LexIO allows protocols to automatically evaluate transactions, generate cryptographic proofs of compliance, and route those proofs across 8 major blockchains (EVM, Solana, XRPL, Aptos)—all while keeping user identities 100% private.

---

## 🎯 Roadmap & Ecosystem Vision

While our current MVP focuses on the immediate regulatory pain points of Stablecoin Issuers, our architecture is built to be the decentralized compliance middleware for all of Web3:

- **Phase 1: Stablecoins (Current MVP)**: Assisting LPSIs in complying with the US GENIUS Act and MiCA regulations for cross-border fiat-backed token transfers.
- **Phase 2: Real World Assets (RWAs)**: Proving that buyers are accredited investors and meet jurisdictional requirements without revealing their identities on-chain.
- **Phase 3: Institutional DeFi Pools**: Providing `Verifier.sol` smart contracts that allow decentralized liquidity pools to mathematically guarantee that no sanctioned funds can enter the pool.

---

## 🌟 The Compliance Pipeline

LexIO replaces passive compliance dashboards with an **active execution protocol**:

### 1. Programmable Policy Engine
LexIO ships with built-in regulatory frameworks. Issuers can enforce rules like:
- **US GENIUS Act**: Automatically flag unregulated stablecoin transfers.
- **MAS PSN02 (Singapore)**: Automatically flag transfers > 1,500 SGD missing full originator details.
- **EU MiCA**: Automatically intercept transfers to unhosted wallets lacking cryptographic proof.

### 2. Live Agent Swarm
Instead of static rulesets, LexIO utilizes a proprietary, multi-agent LLM swarm interpreting these regulations in real-time. It validates identities, cross-references sanctions, and generates institutional-grade compliance narratives for every single transaction.

### 3. Zero-Knowledge Proof Generation (SnarkJS)
Cleared transfers are passed into our Circom circuit (`compliance.wasm`). The backend computes the elliptic curve pairings (bn128), generating a `proof.json` and `publicSignals.json`. This turns the AI's approval into a mathematically verifiable, privacy-preserving cryptographic proof.

### 4. W3C Verifiable Credentials & Smart Contracts
The ZK matrices are embedded into W3C-standard JSON-LD Verifiable Credentials. LexIO ships with a generated `Verifier.sol` contract so that DeFi protocols can natively verify a user's compliance status *on-chain*.

---

## 🏛 The B2B Issuer Dashboard

The LexIO frontend features a sleek, monochromatic B2B dashboard built for compliance officers and regulators:
- **Real-Time Ecosystem Pulse**: Monitor live cross-chain flows with animated network topology.
- **Secure Audit Log**: Regulators can directly download the exact `proof.json`, `publicSignals.json`, and `vkey.json` files from the dashboard to cryptographically verify the AI's decision offline.
- **AI Rejection Flow**: High-Risk transactions (like sanctioned entities attempting to move assets) are autonomously blocked and logged with the exact AI reasoning that triggered the block.

---

## 🚀 Tech Stack

- **Backend**: FastAPI (Python 3.11), Uvicorn, Pydantic
- **AI Integration**: Proprietary Agentic LLM Engine
- **Zero-Knowledge**: SnarkJS, Circom (Groth16 over bn128)
- **Blockchain Adapters**: `xrpl-py`, `stellar-sdk`, `web3.py`, `solana`, `aptos-sdk`
- **Frontend**: React (Vite), Framer Motion, Tailwind CSS
- **Database**: SQLite via `aiosqlite` (Fully asynchronous I/O)
- **Infrastructure**: Docker, Vercel (Frontend), Render (Backend)

---

## ⚡ Deployment & Local Development

### 1. Start the Backend (FastAPI + Node.js)
The backend requires both Python and Node.js (for SnarkJS) to run locally.
```bash
git clone https://github.com/praveenpretto-cloud/LexIO.git
cd LexIO
cp .env.example .env

# Install Python requirements
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Install Node requirements for ZK
npm ci

# Start the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
*(Ensure your LLM API keys are added to `.env` to enable the Agent Swarm).*

### 2. Start the Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```

### 3. Production Deployment (Vercel & Render)
LexIO is pre-configured for instant CI/CD deployment:
- **Backend (Render)**: Deploy as a Docker Web Service using the provided `backend.Dockerfile`. This automatically installs Python, Node.js, and all ZK dependencies.
- **Frontend (Vercel)**: Import the repository, set the Root Directory to `frontend`, and deploy. The `vercel.json` file is pre-configured to proxy API and ZK-download requests to the Render backend.

---

## 🔐 Off-Chain Verification
To independently verify a LexIO transaction using the downloaded files from the Compliance Hub, run:
```bash
npx snarkjs groth16 verify vkey.json publicSignals.json proof.json
```
*Expected output: `[INFO] snarkJS: OK`*
