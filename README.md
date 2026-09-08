# LexIO — Agentic Compliance Execution Protocol

LexIO is an **active execution protocol** that bridges the gap between AI compliance and on-chain settlement. 

While competitors build passive dashboard software for compliance officers to manually review alerts, LexIO is **developer infrastructure**. Our Agentic Swarm automatically evaluates transactions, mints cryptographic W3C Verifiable Credentials as proof of compliance, and natively routes and escrows funds across 8 major blockchains in a single API call.

## 🌟 The "Active Execution" Pipeline

LexIO goes far beyond basic rule-checking by orchestrating a robust, defensible pipeline:

1. **Live Agent Swarm (Gemini 2.0 Flash)**
   Instead of basic `if/else` statements, LexIO utilizes a live LLM agent swarm interpreting FATF, MiCA, and US GENIUS Act regulations in real-time. It validates identities, cross-references sanctions, and generates institutional-grade compliance narratives.

2. **W3C Verifiable Credentials**
   Cleared wallets are issued W3C-standard JSON-LD Verifiable Credentials representing their risk tier (e.g., SCDD, CDD, EDD). This turns an AI decision into a portable cryptographic proof.

3. **Omni-Chain Routing (8 Networks)**
   LexIO natively integrates with 8 blockchains (**XRPL, Stellar, Ethereum, Base, Polygon, Arbitrum, Solana, and Aptos**). It automatically anchors credentials on-chain for tamper-evident storage.

4. **Native Smart Escrow**
   Transactions flagged for High-Risk (EDD / "WATCH" status) are actively intercepted. Instead of just sending an alert, LexIO executes a native API call to the destination blockchain (e.g. XRPL) to create a time-locked **Escrow Vault**. The funds are safely frozen on-chain until a human review occurs.

## 🏛 The Policy Compiler

LexIO's Policy Studio allows institutions to define human-readable policies derived from international frameworks, which are instantly compiled into machine-executable directives:
- **US GENIUS Act**: Automatically blocks unregulated stablecoins (like USDT) for US-based Licensed Payment Stablecoin Issuers (LPSI).
- **MAS PSN02 (Singapore)**: Automatically flags transfers > 1,500 SGD missing full originator KYC details.
- **EU MiCA / Transfer of Funds Regulation**: Automatically intercepts unhosted wallet transfers lacking cryptographic proof.

## 🚀 Tech Stack

- **Backend**: FastAPI (Python 3.11), Uvicorn, Pydantic
- **AI Integration**: Google GenAI SDK (Gemini 2.0 Flash)
- **Blockchain Adapters**: `xrpl-py`, `stellar-sdk`, `web3.py`, `solana`, `aptos-sdk`
- **Frontend**: React (Vite), Framer Motion, Tailwind CSS (Glassmorphism UI)
- **Database**: SQLite via `aiosqlite` (Fully asynchronous I/O)

## ⚡ Quick Start

LexIO is designed as a REST API backend with a beautifully animated visual demo dashboard.

### 1. Setup Environment
```bash
git clone https://github.com/praveenpretto-cloud/LexIO.git
cd LexIO
cp .env.example .env
```
*Add your `GEMINI_API_KEY` to `.env` to enable the Agent Swarm. Private keys for blockchain testnets are optional; the system gracefully falls back to simulated hashes if keys are omitted.*

### 2. Start the Backend (FastAPI)
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Start the Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```

### 4. Access the Platform
- **The "One-Click Magic" Demo UI**: [http://localhost:5173](http://localhost:5173)
- **Stripe-like Developer API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
