# LexIO — Programmable Regulatory Compiler

LexIO is a production-grade, microservice-based compliance engine designed to instantly evaluate cross-border cryptocurrency transfers against major international regulatory frameworks. 

Built for institutional-grade reliability, LexIO leverages an asynchronous Python architecture to achieve sub-20ms latency and a beautifully orchestrated React frontend.

## 🏛 Supported Regulations
1. **MAS PSN02 (Singapore)**: Automatically flags transfers > 1,500 SGD/equivalent missing full originator KYC details.
2. **EU MiCA / Transfer of Funds Regulation**: Automatically intercepts unhosted wallet transfers > 1,000 EUR/equivalent lacking cryptographic proof.

## 🚀 Tech Stack
- **Backend**: FastAPI (Python 3.11), Uvicorn, Pydantic (Strict Validation)
- **Database**: SQLite via `aiosqlite` (Fully asynchronous I/O)
- **Frontend**: React (Vite), Tailwind CSS (Premium Dark Mode)
- **Orchestration**: Docker, Docker Compose, Nginx (Reverse Proxy)

## 🐳 Quick Start (Local Docker Deployment)

LexIO is fully containerized. To spin up the entire application stack locally:

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/lexio.git
   cd lexio
   ```

2. **Start the containers**
   ```bash
   docker compose up --build -d
   ```

3. **Access the Application**
   - **Compliance Dashboard (UI)**: [http://localhost](http://localhost)
   - **Enterprise OpenAPI Portal**: [http://localhost:8000/docs](http://localhost:8000/docs)

## 🧪 Testing and Development

To run the full suite of deterministic matrix tests locally:

```bash
# Set up virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Execute async test suite
python3 -m pytest test_compliance.py -v
```

## 🔐 Security & Persistence
- **State Persistence**: The local SQLite database is mounted to `./data` on the host, ensuring your audit logs persist across container restarts.
- **Environment Management**: Copy `.env.example` to `.env` to configure deployment-specific secrets without committing them to the repository.
