"""Client configuration for Zeal SDK."""

from datetime import timedelta
from typing import Optional
from pydantic import BaseModel, Field


class ClientConfig(BaseModel):
    """Configuration for Zeal client."""
    
    base_url: str = Field(default="http://localhost:3000", description="Base URL for the Zeal API")
    default_timeout: timedelta = Field(default=timedelta(seconds=30), description="Default request timeout")
    verify_tls: bool = Field(default=True, description="Whether to verify TLS certificates")
    user_agent: str = Field(default="zeal-python-sdk/1.0.0", description="User agent string")
    max_retries: int = Field(default=3, description="Maximum number of retries for requests")
    retry_backoff_ms: int = Field(default=1000, description="Backoff time in milliseconds between retries")
    enable_compression: bool = Field(default=True, description="Whether to enable compression")
    
    class Config:
        arbitrary_types_allowed = True