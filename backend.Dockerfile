FROM python:3.11-slim

WORKDIR /app

# Install Node.js and npm (required for SnarkJS ZK proofs)
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Node dependencies (for snarkjs)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY compliance_engine.py credentials.py database.py db_models.py ai_agent.py ./
COPY main.py models.py stellar_client.py xrpl_escrow.py ./
COPY chains/ ./chains/
COPY static/ ./static/
COPY circuits/ ./circuits/
COPY scripts/ ./scripts/

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
