"""Webhooks API implementation."""

from typing import TYPE_CHECKING

from .types import (
    CreateWebhookRequest, CreateWebhookResponse,
    ListWebhooksResponse,
    UpdateWebhookRequest, UpdateWebhookResponse,
    DeleteWebhookResponse,
    TestWebhookResponse,
)

if TYPE_CHECKING:
    from .client import ZealClient


class WebhooksAPI:
    """Webhooks API for webhook subscription management."""
    
    def __init__(self, client: "ZealClient"):
        self._client = client
    
    async def create(self, request: CreateWebhookRequest) -> CreateWebhookResponse:
        """Create a new webhook subscription."""
        response = await self._client._make_request(
            "POST",
            "/api/zip/webhooks",
            json_data=request.dict(by_alias=True, exclude_none=True)
        )
        response.raise_for_status()
        return CreateWebhookResponse(**response.json())
    
    async def list(self) -> ListWebhooksResponse:
        """List webhook subscriptions."""
        response = await self._client._make_request("GET", "/api/zip/webhooks")
        response.raise_for_status()
        return ListWebhooksResponse(**response.json())
    
    async def update(self, webhook_id: str, request: UpdateWebhookRequest) -> UpdateWebhookResponse:
        """Update a webhook subscription."""
        response = await self._client._make_request(
            "PATCH",
            f"/api/zip/webhooks/{webhook_id}",
            json_data=request.dict(by_alias=True, exclude_none=True)
        )
        response.raise_for_status()
        return UpdateWebhookResponse(**response.json())
    
    async def delete(self, webhook_id: str) -> DeleteWebhookResponse:
        """Delete a webhook subscription."""
        response = await self._client._make_request("DELETE", f"/api/zip/webhooks/{webhook_id}")
        response.raise_for_status()
        return DeleteWebhookResponse(**response.json())
    
    async def test(self, webhook_id: str) -> TestWebhookResponse:
        """Test a webhook subscription."""
        response = await self._client._make_request("POST", f"/api/zip/webhooks/{webhook_id}/test")
        response.raise_for_status()
        return TestWebhookResponse(**response.json())