"""
db_models.py — SQLAlchemy ORM model for the compliance transaction audit log.
"""
from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, Float, Integer, String
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
