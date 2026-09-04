# LexIO — Agentic Compliance Engine

LexIO is a production-grade, AI-driven compliance oracle designed to instantly evaluate cross-border cryptocurrency transfers against major international regulatory frameworks. Built for the **Ripple Swell Hackathon**, LexIO demonstrates how institutions can safely adopt public blockchains like the XRPL without compromising regulatory requirements or broadcasting sensitive compliance data in the clear.

## 🌟 The "Pro Max" Agentic Pipeline

LexIO goes far beyond basic rule-checking by orchestrating a robust, defensible pipeline:

1. **Live AI Agentic Logic (Gemini 2.0 Flash)**
   Instead of basic `if/else` statements, LexIO utilizes a live Gemini 2.0 Flash agent interpreting FATF, MiCA, and US GENIUS Act regulations in real-time. It generates institutional-grade compliance narratives that explain *exactly why* a transaction was flagged and *what regulation applies*.

2. **Real ZK-Privacy (Hash Commitments)**
   Financial institutions cannot broadcast sensitive compliance data (risk tiers, PEP status) in the clear. LexIO generates real HMAC-SHA256 Hash Commitments—the exact same cryptographic primitive used in production ZK applications (like Tornado Cash or Semaphore)—to prove compliance without revealing identity.

3. **Real XRPL Testnet Escrow**
   LexIO doesn't just read data; the backend actively signs and broadcasts real `EscrowCreate` transactions to the Ripple Testnet. Transactions flagged for "WATCH" status have their funds locked via `finish_after` for a mandatory compliance review window.

4. **Verifiable Credentials (W3C)**
   Cleared wallets are issued W3C-standard Verifiable Credentials representing their risk tier (e.g., SCDD, CDD, EDD), which can be anchored on-chain.

## 🏛 Supported Regulations

LexIO's Policy Engine currently supports machine-executable rules derived from:

1. **US GENIUS Act**: Automatically blocks unregulated stablecoins (like USDT) for US-based Licensed Payment Stablecoin Issuers (LPSI), requiring regulated assets like USDC.
2. **MAS PSN02 (Singapore)**: Automatically flags transfers > 1,500 SGD/equivalent missing full originator KYC details.
3. **EU MiCA / Transfer of Funds Regulation**: Automatically intercepts unhosted wallet transfers > 1,000 EUR/equivalent lacking cryptographic proof.
4. **FATF Recommendations**: Identifies Politically Exposed Persons (PEPs) and cross-border high-risk jurisdiction transfers, mandating Enhanced Due Diligence (EDD).

## 🚀 Tech Stack

- **Backend**: FastAPI (Python 3.11), Uvicorn, Pydantic (Strict Validation)
- **AI Integration**: Google Gemini 2.0 Flash SDK
- **Blockchain**: `xrpl-py` (for live Escrow/Anchor), Web3.py, Stellar SDK
- **Database**: SQLite via `aiosqlite` (Fully asynchronous I/O)
- **Frontend**: React (Vite), Tailwind CSS (Premium Dark Mode)
- **Orchestration**: Docker, Docker Compose, Nginx (Reverse Proxy)

## 🐳 Quick Start (Local Docker Deployment)

LexIO is fully containerized and cloud-ready for instant deployment to Render or AWS.

1. **Clone the repository**
   ```bash
   git clone https://github.com/praveenpretto-cloud/LexIO.git
   cd LexIO
   ```

2. **Configure Environment Variables**
   ```bash
   cp .env.example .env
   ```
   *Make sure to add your `GEMINI_API_KEY` for live AI narratives and a `TESTNET_PRIVATE_KEY` with Sepolia ETH if testing Web3 anchors.*

3. **Start the containers**
   ```bash
   docker compose up --build -d
   ```

4. **Access the Application**
   - **Agent Demo & Policy Dashboard (UI)**: [http://localhost](http://localhost)
   - **Enterprise OpenAPI Portal**: [http://localhost:8000/docs](http://localhost:8000/docs)

## 🔐 Security & Persistence
- **Zero Secrets in Git**: Sensitive keys (`.env`) are strictly ignored.
- **State Persistence**: The local SQLite database is mounted to `./data` on the host, ensuring your audit logs persist across container restarts.
- **Lean Cloud Builds**: Optimized Dockerfiles and hardened `.gitignore` ensure ultra-fast, lightweight deployments.
