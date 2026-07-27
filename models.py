"""
models.py — Pydantic request and response schemas for the compliance endpoint.
"""
from typing import Annotated, Literal, Optional
from pydantic import BaseModel, Field, field_validator


class ComplianceRequest(BaseModel):
    """Payload accepted by POST /api/v1/evaluate."""

    sender_address: str = Field(..., description="The blockchain address of the sender.")
    receiver_address: str = Field(..., description="The blockchain address of the receiver.")
    
    amount: float = Field(
        ...,
        gt=0,
        description="Transfer amount in stablecoin denomination.",
        examples=[3500.0],
    )
    stablecoin_type: Literal["USDC", "USDT", "DAI", "EURC"] = Field(
        ...,
        description="The type of stablecoin being transferred.",
        examples=["USDC"],
    )

    network: Literal["Stellar", "XRPL"] = Field(
        default="Stellar",
        description="The blockchain network to execute the transfer on.",
    )
    
    sender_jurisdiction: str = Field(
        ...,
        description="The ISO 3166-1 alpha-2 country code of the sender (e.g. US, SG).",
        examples=["US"],
    )
    receiver_jurisdiction: str = Field(
        ...,
        description="The ISO 3166-1 alpha-2 country code of the receiver (e.g. EU, UK).",
        examples=["EU"],
    )

    # Legacy fields that we keep for backward compatibility or extra rules
    wallet_type: Literal["Hosted", "Unhosted"] = Field(
        default="Hosted",
        description="Whether the receiving wallet is hosted or unhosted.",
    )
    sender_kyc_complete: bool = Field(
        default=True,
        description="True if the originator has passed full KYC verification.",
    )
    wallet_cryptographically_verified: bool = Field(
        default=True,
        description="True if the unhosted wallet ownership has been cryptographically proven.",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "sender_address": "0x123...",
                    "receiver_address": "0x456...",
                    "amount": 3500.0,
                    "stablecoin_type": "USDC",
                    "sender_jurisdiction": "US",
                    "receiver_jurisdiction": "EU",
                    "wallet_type": "Unhosted",
                    "sender_kyc_complete": True,
                    "wallet_cryptographically_verified": False,
                }
            ]
        },
        "strict": False, 
    }

    @field_validator("sender_kyc_complete", "wallet_cryptographically_verified", mode="before")
    @classmethod
    def must_be_strict_bool(cls, v: object) -> bool:
        if not isinstance(v, bool):
            raise ValueError(
                f"Expected a JSON boolean (true/false), got {type(v).__name__!r}: {v!r}. "
            )
        return v


class ComplianceResponse(BaseModel):
    """JSON response returned by the compliance check endpoint."""

    status: Literal["Approve", "Block", "Flag"]
    reason: str
    authorization_hash: Optional[str] = Field(
        None, description="Cryptographic hash of the transaction if Approved."
    )

