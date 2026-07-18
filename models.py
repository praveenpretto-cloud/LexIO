"""
models.py — Pydantic request and response schemas for the compliance endpoint.
"""
from typing import Annotated, Literal
from pydantic import BaseModel, Field, field_validator


class ComplianceRequest(BaseModel):
    """Payload accepted by POST /api/v1/compliance/check."""

    amount: float = Field(
        ...,
        gt=0,
        description="Transfer amount in the relevant fiat/crypto denomination.",
        examples=[1500.0],
    )
    wallet_type: Literal["Hosted", "Unhosted"] = Field(
        ...,
        description="Whether the receiving wallet is hosted (custodial) or unhosted (self-custodial).",
        examples=["Unhosted"],
    )
    sender_kyc_complete: bool = Field(
        ...,
        description="True if the originator has passed full KYC verification.",
        examples=[False],
    )
    wallet_cryptographically_verified: bool = Field(
        ...,
        description="True if the unhosted wallet ownership has been cryptographically proven.",
        examples=[False],
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "amount": 2000.0,
                    "wallet_type": "Unhosted",
                    "sender_kyc_complete": False,
                    "wallet_cryptographically_verified": False,
                }
            ]
        },
        # Prevent Pydantic from silently coercing strings like "yes"/"1"/"true"
        # into booleans. Only JSON true/false (Python bool) are accepted.
        "strict": False,  # keep lax for float parsing, but see validators below
    }

    @field_validator("sender_kyc_complete", "wallet_cryptographically_verified", mode="before")
    @classmethod
    def must_be_strict_bool(cls, v: object) -> bool:
        """Reject any non-boolean value — strings, ints, None are all invalid."""
        if not isinstance(v, bool):
            raise ValueError(
                f"Expected a JSON boolean (true/false), got {type(v).__name__!r}: {v!r}. "
                "Strings like 'yes', '1', or 'true' are not accepted."
            )
        return v


class ComplianceResponse(BaseModel):
    """JSON response returned by the compliance check endpoint."""

    status: Literal["APPROVE", "REJECT"]
    reason: str
