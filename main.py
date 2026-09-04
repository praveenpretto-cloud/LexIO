"""
main.py — FastAPI application entry point for the LexIO Agentic Compliance Engine.
v2.0 additions:
  - Agentic compliance check endpoint (SCDD/CDD/EDD risk-tier scoring)
  - W3C Verifiable Credential issuance on APPROVE decisions
  - XRPL memo anchoring for tamper-evident credential storage
  - Full demo endpoint: /api/v1/demo/agent-payment
Preserved from v1.1:
  - Async SQLite audit logging via aiosqlite
  - Global exception handlers (400 / 422 / 500 structured envelopes)
  - X-Process-Time performance observability header
"""
import json
import os
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

# Load .env variables first — must happen before any module that reads os.environ
from dotenv import load_dotenv
load_dotenv()

from fastapi import BackgroundTasks, Depends, FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException as StarletteHTTPException

import compliance_engine
from compliance_engine import check_agentic_finance_compliance
from credentials import anchor_credential_on_xrpl, issue_wallet_credential
from database import AsyncSessionLocal, Base, async_engine, engine, get_async_db, get_db
from db_models import AgentTransactionLog, CredentialLog, TransactionLog
from models import (
    AgentTransferRequest,
    ComplianceDecision,
    ComplianceRequest,
    ComplianceResponse,
    RiskTier,
)
from stellar_client import execute_stellar_transfer
from xrpl_client import execute_xrpl_transfer
from xrpl_escrow import create_compliance_escrow
from ai_agent import generate_compliance_reasoning

# Blockchain wallet config — loaded from environment variables.
# Set these in Render dashboard (never commit real secrets to git).
# Fallback to testnet demo values for local development.
SENDER_SECRET      = os.environ.get("STELLAR_SENDER_SECRET", "SCENO33654ZLTKIKOST6P6GVQNEKGFMLYBVJQX4CLTUBM5QM6BK6URGR")
XRPL_SENDER_SEED   = os.environ.get("XRPL_SENDER_SEED",   "sEdSZHxNrgDqzymji6CQyp1cnJFBeaA")
XRPL_RECEIVER_ADDR = os.environ.get("XRPL_RECEIVER_ADDR", "rEGcPEhZbvFMr14wBhm3TUc1EanWWMU367")
# XRPL issuer account for credential anchoring — defaults to the existing testnet sender
XRPL_ISSUER_ACCOUNT = os.environ.get("XRPL_ISSUER_ACCOUNT", "rapGvMNARmA46HRNoGBiTy1nEwiKdVTfPw")
XRPL_ISSUER_SECRET  = os.environ.get("XRPL_ISSUER_SECRET",  os.environ.get("XRPL_SENDER_SEED", "sEdSZHxNrgDqzymji6CQyp1cnJFBeaA"))

STATIC_DIR = Path(__file__).parent / "static"


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create all SQLAlchemy tables on startup (sync engine for DDL)."""
    Base.metadata.create_all(bind=engine)
    yield
    await async_engine.dispose()


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="LexIO Regulatory Compiler API",
    description=(
        "Evaluates cryptocurrency transfers against **MAS PSN02** (Singapore) "
        "and **EU MiCA / Transfer of Funds Regulation** rules. "
        "Every decision is persisted to a local SQLite audit log."
    ),
    version="1.0.0",
    contact={"name": "LexIO Compliance Team", "email": "compliance@lexio.io"},
    license_info={"name": "MIT"},
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Process-Time"],
)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


# ---------------------------------------------------------------------------
# Middleware — X-Process-Time header on every response
# ---------------------------------------------------------------------------
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Process-Time"] = f"{elapsed_ms:.3f}ms"
    return response


# ---------------------------------------------------------------------------
# Global exception handlers
# ---------------------------------------------------------------------------
def _error_envelope(code: str, message: str, detail=None, status: int = 400) -> JSONResponse:
    """Uniform structured error body for all failure modes."""
    body = {
        "error": True,
        "code": code,
        "message": message,
        "docs_url": "http://127.0.0.1:8000/docs",
    }
    if detail is not None:
        body["detail"] = detail
    return JSONResponse(status_code=status, content=body)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    """
    Pydantic / FastAPI validation failures → 422 with a human-readable breakdown.
    JSON decode errors (malformed body) → 400 MALFORMED_REQUEST.
    Covers: wrong types, missing fields, failed field_validators, gt=0 violations.
    """
    # Detect malformed JSON — Pydantic surfaces these as 'JSON decode error'
    raw_errors = exc.errors()
    is_json_error = any(
        "JSON decode error" in str(e.get("msg", "")) or e.get("type") == "json_invalid"
        for e in raw_errors
    )
    if is_json_error:
        return _error_envelope(
            code="MALFORMED_REQUEST",
            message=(
                "The request body could not be parsed as valid JSON. "
                "Verify the Content-Type is 'application/json' and the body is well-formed."
            ),
            status=400,
        )

    errors = []
    for err in raw_errors:
        field = " → ".join(str(loc) for loc in err["loc"] if loc != "body")
        errors.append({
            "field":   field or "(root)",
            "issue":   err["msg"],
            "input":   err.get("input"),
        })
    return _error_envelope(
        code="VALIDATION_ERROR",
        message=(
            f"{len(errors)} field(s) failed validation. "
            "Ensure all values match the API schema."
        ),
        detail=errors,
        status=422,
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle Starlette HTTP exceptions — including malformed/unparseable JSON bodies (400)."""
    if exc.status_code == 400:
        return _error_envelope(
            code="MALFORMED_REQUEST",
            message=(
                "The request body could not be parsed as valid JSON. "
                "Verify the Content-Type is 'application/json' and the body is well-formed."
            ),
            status=400,
        )
    return _error_envelope(
        code=f"HTTP_{exc.status_code}",
        message=str(exc.detail),
        status=exc.status_code,
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Catch-all for unexpected server errors — never expose raw tracebacks."""
    return _error_envelope(
        code="INTERNAL_ERROR",
        message="An unexpected error occurred. The incident has been logged.",
        detail=type(exc).__name__,
        status=500,
    )


# ---------------------------------------------------------------------------
# Background Tasks
# ---------------------------------------------------------------------------
async def _execute_and_update_db(
    log_id: int,
    network: str,
    sender_secret: str,
    receiver_pub: str,
    amount: float,
):
    """Background task: execute tx on the chosen chain and update the DB with the real hash."""
    if network == "XRPL":
        ledger_hash = await execute_xrpl_transfer(sender_secret, receiver_pub, amount)
    else:
        ledger_hash = await execute_stellar_transfer(sender_secret, receiver_pub, amount)

    async with AsyncSessionLocal() as session:
        log_entry = await session.get(TransactionLog, log_id)
        if log_entry:
            if ledger_hash:
                log_entry.authorization_hash = ledger_hash
            else:
                log_entry.status = "Block"
                log_entry.reason = f"{network} Live Execution Failed"
            await session.commit()

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/", tags=["Dashboard"], include_in_schema=False)
def root():
    """Serve the LexIO compliance dashboard UI (if not running behind Nginx)."""
    return FileResponse(str(STATIC_DIR / "index.html"))


@app.get("/api/health", tags=["System Health"], summary="Check API health status")
async def health_check():
    """Returns the operational status of the LexIO API."""
    return {"status": "ok", "version": "1.0.0"}


@app.post(
    "/api/v1/compliance/check",
    response_model=ComplianceResponse,
    tags=["Compliance Engine"],
    summary="Run a compliance check on a crypto transfer",
    response_description="APPROVE or REJECT with the applicable regulatory reason.",
)
async def compliance_check(
    payload: ComplianceRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_async_db),
) -> ComplianceResponse:
    """
    **Async** endpoint — evaluates a cross-border crypto transfer and writes the
    audit record to SQLite via aiosqlite without blocking the event loop.

    Rules evaluated (in priority order):
    - **MAS PSN02**: transfers > 1,500 require full KYC on the originator.
    - **EU MiCA / TFR**: unhosted wallets receiving > 1,000 require cryptographic proof.
    """
    # Pure in-memory rule evaluation — O(1), no I/O
    result: ComplianceResponse = await compliance_engine.evaluate(payload)

    # Non-blocking async SQLite write
    log_entry = TransactionLog(
        amount=payload.amount,
        stablecoin_type=payload.stablecoin_type,
        sender_address=payload.sender_address,
        receiver_address=payload.receiver_address,
        sender_jurisdiction=payload.sender_jurisdiction,
        receiver_jurisdiction=payload.receiver_jurisdiction,
        status=result.status,
        reason=result.reason,
        policy_evaluated="MAS/MiCA Ruleset",
        authorization_hash=result.authorization_hash,
        network=payload.network,
    )
    db.add(log_entry)
    await db.commit()
    await db.refresh(log_entry)
    log_id = log_entry.id

    # If the firewall clears the transaction, dispatch it to execute silently
    # in the background so the UI doesn't have to wait for blockchain consensus!
    if result.status == "Approve":
        # Route to the correct chain based on the network field
        if payload.network == "XRPL":
            bg_sender_seed = XRPL_SENDER_SEED
            bg_receiver   = XRPL_RECEIVER_ADDR  # Always use our funded XRPL receiver for testnet
        else:
            bg_sender_seed = SENDER_SECRET
            bg_receiver   = payload.receiver_address

        background_tasks.add_task(
            _execute_and_update_db,
            log_id,
            payload.network,
            bg_sender_seed,
            bg_receiver,
            payload.amount,
        )

    return result


@app.get(
    "/api/v1/compliance/history",
    tags=["Compliance Engine"],
    summary="Retrieve the compliance audit log",
)
async def compliance_history(
    limit: int = Query(default=50, ge=1, le=500, description="Max records to return"),
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
    db: AsyncSession = Depends(get_async_db),
):
    """Returns paginated compliance check history, ordered by most recent first."""
    count_query = await db.execute(select(func.count()).select_from(TransactionLog))
    total = count_query.scalar_one()

    records_query = await db.execute(
        select(TransactionLog)
        .order_by(TransactionLog.checked_at.desc())
        .offset(offset)
        .limit(limit)
    )
    records = records_query.scalars().all()

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "records": [
            {
                "id": r.id,
                "amount": r.amount,
                "stablecoin_type": r.stablecoin_type,
                "sender_address": r.sender_address,
                "receiver_address": r.receiver_address,
                "sender_jurisdiction": r.sender_jurisdiction,
                "receiver_jurisdiction": r.receiver_jurisdiction,
                "status": r.status,
                "reason": r.reason,
                "authorization_hash": r.authorization_hash,
                "network": r.network,
                "checked_at": r.checked_at.isoformat(),
            }
            for r in records
        ],
    }


# ---------------------------------------------------------------------------
# Agentic Finance Compliance Endpoints
# ---------------------------------------------------------------------------

@app.post(
    "/api/v1/agent/compliance-check",
    response_model=ComplianceDecision,
    tags=["Agentic Compliance"],
    summary="Run a risk-tier compliance check on an agent-to-agent payment",
    response_description="APPROVE / REJECT / WATCH with risk tier and reasons.",
)
async def agent_compliance_check(request: AgentTransferRequest) -> ComplianceDecision:
    """
    Evaluate source and destination wallets against FATF jurisdiction risk,
    PEP lists, sanctions lists, and linked-wallet inheritance rules.

    Returns one of:
    - **APPROVE** (SCDD or CDD tier) — payment may proceed.
    - **REJECT** (EDD tier) — PEP/sanctions hit or inherited risk.
    - **WATCH** (EDD tier) — high-risk jurisdiction; flag for human review.
    """
    decision: ComplianceDecision = await check_agentic_finance_compliance(request)

    # Async audit log write
    async with AsyncSessionLocal() as session:
        log = AgentTransactionLog(
            source_wallet=request.source_wallet_address,
            destination_wallet=request.destination_wallet_address,
            amount_usd=request.amount_usd,
            decision=decision.decision,
            risk_tier=decision.risk_tier.value,
            reasons_json=json.dumps(decision.reasons),
            confidence_score=decision.confidence_score,
            flagged_by_json=json.dumps(decision.flagged_by),
        )
        session.add(log)
        await session.commit()

    return decision


@app.post(
    "/api/v1/demo/agent-payment",
    tags=["Agentic Compliance"],
    summary="Full agent-to-agent payment demo flow",
    response_description="Compliance decision, issued VC, and XRPL anchor result.",
)
async def demo_agent_payment(
    source_wallet: str,
    destination_wallet: str,
    amount: float = 100.0,
    use_zk: bool = False,
):
    """
    Simulated end-to-end agent-to-agent payment flow for demonstration.

    Executes:
    1. Compliance check (risk-tier evaluation)
    2. W3C Verifiable Credential issuance (if APPROVE)
    3. XRPL memo anchoring (if APPROVE)

    Returns the full pipeline result including timestamps for each stage.
    """
    request = AgentTransferRequest(
        source_wallet_address=source_wallet,
        destination_wallet_address=destination_wallet,
        amount_usd=amount,
    )
    decision: ComplianceDecision = await agent_compliance_check(request)
    now = datetime.now(timezone.utc)

    # ── AI Agent Reasoning ───────────────────────────────────────────────────
    # Look up jurisdiction for both wallets from the mock DB for better AI context
    import compliance_engine as _ce
    src_meta = _ce.MOCK_WALLET_OWNERSHIP.get(source_wallet, {"jurisdiction": "UNKNOWN"})
    dst_meta = _ce.MOCK_WALLET_OWNERSHIP.get(destination_wallet, {"jurisdiction": "UNKNOWN"})

    ai_reasoning = await generate_compliance_reasoning(
        source_wallet=source_wallet,
        dest_wallet=destination_wallet,
        src_jurisdiction=src_meta.get("jurisdiction", "UNKNOWN"),
        dst_jurisdiction=dst_meta.get("jurisdiction", "UNKNOWN"),
        amount_usd=amount,
        risk_tier=decision.risk_tier.value,
        decision=decision.decision,
        flagged_by=decision.flagged_by,
        reasons=decision.reasons,
    )
    # Attach the AI reasoning to the decision object
    decision = decision.model_copy(update={"ai_reasoning": ai_reasoning})

    if decision.decision == "APPROVE":
        credential = await issue_wallet_credential(
            wallet_address=destination_wallet,
            risk_tier=decision.risk_tier.value,
            timestamp=now,
            use_zk=use_zk,
        )
        anchor_result = await anchor_credential_on_xrpl(
            credential=credential,
            xrpl_account=XRPL_ISSUER_ACCOUNT,
            xrpl_secret=XRPL_ISSUER_SECRET,
        )
        return {
            "payment_id":          str(uuid.uuid4()),
            "source_wallet":       source_wallet,
            "destination_wallet":  destination_wallet,
            "compliance_decision": decision.model_dump(mode="json"),
            "credential":          credential.to_dict(),
            "anchor_result":       anchor_result,
            "payment_status":      "APPROVED",
            "timestamp":           now.isoformat(),
        }
    elif decision.decision == "WATCH":
        # Submit a REAL EscrowCreate transaction to the XRPL Testnet
        reason_text = decision.reasons[0] if decision.reasons else "EDD required."
        escrow_result = await create_compliance_escrow(
            sender_secret=XRPL_ISSUER_SECRET,
            sender_account=XRPL_ISSUER_ACCOUNT,
            destination=destination_wallet if destination_wallet.startswith("r") else None,
            amount_usd=amount,
            reason=reason_text,
        )
        return {
            "payment_id":          str(uuid.uuid4()),
            "source_wallet":       source_wallet,
            "destination_wallet":  destination_wallet,
            "compliance_decision": decision.model_dump(mode="json"),
            "credential":          None,
            "anchor_result":       escrow_result,
            "payment_status":      "ESCROW_LOCKED",
            "timestamp":           now.isoformat(),
        }
    else:
        return {
            "payment_id":          str(uuid.uuid4()),
            "source_wallet":       source_wallet,
            "destination_wallet":  destination_wallet,
            "compliance_decision": decision.model_dump(mode="json"),
            "credential":          None,
            "anchor_result":       None,
            "payment_status":      decision.decision,
            "timestamp":           now.isoformat(),
        }


@app.get(
    "/api/v1/agent/history",
    tags=["Agentic Compliance"],
    summary="Retrieve the agentic compliance audit log",
)
async def agent_compliance_history(
    limit:  int = Query(default=50, ge=1, le=500, description="Max records to return"),
    offset: int = Query(default=0,  ge=0,          description="Pagination offset"),
):
    """Returns paginated agentic compliance check history, ordered by most recent first."""
    from sqlalchemy import func as sa_func
    from db_models import AgentTransactionLog as ATL

    async with AsyncSessionLocal() as session:
        count_q = await session.execute(
            select(sa_func.count()).select_from(ATL)
        )
        total = count_q.scalar_one()

        records_q = await session.execute(
            select(ATL)
            .order_by(ATL.checked_at.desc())
            .offset(offset)
            .limit(limit)
        )
        records = records_q.scalars().all()

    return {
        "total":   total,
        "offset":  offset,
        "limit":   limit,
        "records": [
            {
                "id":                  r.id,
                "source_wallet":       r.source_wallet,
                "destination_wallet":  r.destination_wallet,
                "amount_usd":          r.amount_usd,
                "decision":            r.decision,
                "risk_tier":           r.risk_tier,
                "reasons":             json.loads(r.reasons_json or "[]"),
                "confidence_score":    r.confidence_score,
                "flagged_by":          json.loads(r.flagged_by_json or "[]"),
                "checked_at":          r.checked_at.isoformat(),
            }
            for r in records
        ],
    }
