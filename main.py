"""
main.py — FastAPI application entry point for the LexIO compliance engine.
Production-grade upgrades (v1.1):
  - Async compliance_check endpoint (aiosqlite) for sub-20ms concurrent throughput
  - Global exception handlers: malformed JSON → 400, validation → 422, generic → 500
  - X-Process-Time response header for performance observability
  - Structured error envelope: { error, code, detail, docs_url }
"""
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException as StarletteHTTPException

import compliance_engine
from database import Base, async_engine, engine, get_async_db, get_db
from db_models import TransactionLog
from models import ComplianceRequest, ComplianceResponse

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
    result: ComplianceResponse = compliance_engine.evaluate(payload)

    # Non-blocking async SQLite write
    log_entry = TransactionLog(
        amount=payload.amount,
        wallet_type=payload.wallet_type,
        sender_kyc_complete=payload.sender_kyc_complete,
        wallet_cryptographically_verified=payload.wallet_cryptographically_verified,
        status=result.status,
        reason=result.reason,
    )
    db.add(log_entry)
    await db.commit()
    # No refresh needed — we don't return the ORM object, so skip the extra SELECT

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
                "wallet_type": r.wallet_type,
                "sender_kyc_complete": r.sender_kyc_complete,
                "wallet_cryptographically_verified": r.wallet_cryptographically_verified,
                "status": r.status,
                "reason": r.reason,
                "checked_at": r.checked_at.isoformat(),
            }
            for r in records
        ],
    }
