"""
database.py — SQLite engine + async session factory for LexIO compliance log.

Dual-engine setup:
  - `engine`        (sync)  → used by SQLAlchemy migrations (create_all) and tests
  - `async_engine`  (async) → used by the live FastAPI async endpoints
"""
import asyncio

from sqlalchemy import create_engine, func, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

import os

# ── URLs ────────────────────────────────────────────────────────────────────
SYNC_DB_URL  = os.environ.get("SYNC_DB_URL", "sqlite:///./compliance_log.db")
ASYNC_DB_URL = os.environ.get("ASYNC_DB_URL", "sqlite+aiosqlite:///./compliance_log.db")

# ── Sync engine (migrations + tests) ────────────────────────────────────────
engine = create_engine(
    SYNC_DB_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ── Async engine (live API endpoints) ───────────────────────────────────────
async_engine = create_async_engine(
    ASYNC_DB_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)
AsyncSessionLocal = sessionmaker(
    async_engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


# ── Sync dependency (tests / history endpoint) ───────────────────────────────
def get_db():
    """Sync session — used by tests and the history endpoint."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Async dependency (compliance check endpoint) ─────────────────────────────
async def get_async_db():
    """Async session — used by async compliance_check endpoint."""
    async with AsyncSessionLocal() as session:
        yield session
