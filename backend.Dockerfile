FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy only source code — never .venv, .env, *.db, __pycache__
COPY compliance_engine.py credentials.py database.py db_models.py ai_agent.py ./
COPY main.py models.py stellar_client.py web3_client.py xrpl_client.py xrpl_escrow.py ./
COPY chains/ ./chains/
COPY static/ ./static/

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
