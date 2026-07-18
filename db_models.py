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
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    wallet_type: Mapped[str] = mapped_column(String(16), nullable=False)
    sender_kyc_complete: Mapped[bool] = mapped_column(Boolean, nullable=False)
    wallet_cryptographically_verified: Mapped[bool] = mapped_column(Boolean, nullable=False)
    status: Mapped[str] = mapped_column(String(8), nullable=False)   # "APPROVE" | "REJECT"
    reason: Mapped[str] = mapped_column(String(256), nullable=False)
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
