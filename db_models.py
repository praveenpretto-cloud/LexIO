"""
db_models.py — SQLAlchemy ORM model for the compliance transaction audit log.
"""
from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class TransactionLog(Base):
    """Persists every compliance check result for audit purposes."""

    __tablename__ = "transaction_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # Transaction Details
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    stablecoin_type: Mapped[str] = mapped_column(String(16), nullable=False)
    sender_address: Mapped[str] = mapped_column(String(64), nullable=False)
    receiver_address: Mapped[str] = mapped_column(String(64), nullable=False)
    sender_jurisdiction: Mapped[str] = mapped_column(String(8), nullable=False)
    receiver_jurisdiction: Mapped[str] = mapped_column(String(8), nullable=False)
    
    # Evaluation Outcome
    status: Mapped[str] = mapped_column(String(16), nullable=False)   # "Approve" | "Block" | "Flag"
    reason: Mapped[str] = mapped_column(String(512), nullable=False)
    policy_evaluated: Mapped[str] = mapped_column(String(256), nullable=False)
    authorization_hash: Mapped[str] = mapped_column(String(128), nullable=True)
    network: Mapped[str] = mapped_column(String(16), nullable=True)   # "Stellar" | "XRPL"

    checked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<TransactionLog id={self.id} amount={self.amount} "
            f"status={self.status} checked_at={self.checked_at}>"
        )


# ---------------------------------------------------------------------------
# Agentic Finance Compliance Tables
# ---------------------------------------------------------------------------

class AgentTransactionLog(Base):
    """Persists every agent-to-agent compliance check result for audit purposes."""

    __tablename__ = "agent_transaction_logs"

    id:                Mapped[int]   = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_wallet:     Mapped[str]   = mapped_column(String(128), nullable=False)
    destination_wallet: Mapped[str]  = mapped_column(String(128), nullable=False)
    amount_usd:        Mapped[float] = mapped_column(Float, nullable=True)
    decision:          Mapped[str]   = mapped_column(String(16), nullable=False)   # APPROVE|REJECT|WATCH
    risk_tier:         Mapped[str]   = mapped_column(String(8),  nullable=False)   # SCDD|CDD|EDD
    reasons_json:      Mapped[str]   = mapped_column(Text, nullable=True)          # JSON list
    confidence_score:  Mapped[float] = mapped_column(Float, nullable=True)
    flagged_by_json:   Mapped[str]   = mapped_column(Text, nullable=True)          # JSON list
    checked_at:        Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<AgentTransactionLog id={self.id} "
            f"decision={self.decision} tier={self.risk_tier}>"
        )


class CredentialLog(Base):
    """Stores issued W3C Verifiable Credentials for compliant wallets."""

    __tablename__ = "credential_logs"

    id:              Mapped[str]      = mapped_column(String(64),  primary_key=True)  # DID
    wallet_address:  Mapped[str]      = mapped_column(String(128), nullable=False)
    risk_tier:       Mapped[str]      = mapped_column(String(8),   nullable=False)
    issued_at:       Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at:      Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    credential_json: Mapped[str]      = mapped_column(Text, nullable=False)

    def __repr__(self) -> str:
        return (
            f"<CredentialLog id={self.id} "
            f"wallet={self.wallet_address[:12]}… tier={self.risk_tier}>"
        )


class CredentialAnchorLog(Base):
    """Tracks XRPL memo anchors for issued credentials."""

    __tablename__ = "credential_anchor_logs"

    id:               Mapped[int]      = mapped_column(Integer, primary_key=True, autoincrement=True)
    credential_id:    Mapped[str]      = mapped_column(
        String(64), ForeignKey("credential_logs.id"), unique=True, nullable=False
    )
    transaction_hash: Mapped[str]      = mapped_column(String(128), nullable=True)
    ledger_index:     Mapped[int]      = mapped_column(Integer, nullable=True)
    anchored_at:      Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<CredentialAnchorLog id={self.id} "
            f"credential_id={self.credential_id} tx={self.transaction_hash}>"
        )
