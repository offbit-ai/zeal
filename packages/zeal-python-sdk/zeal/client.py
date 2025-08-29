"""Main Zeal client implementation."""

import httpx
from typing import Optional

from .config import ClientConfig
from .orchestrator import OrchestratorAPI
from .templates import TemplatesAPI
from .traces import TracesAPI
from .webhooks import WebhooksAPI
from .subscription import WebhookSubscription, SubscriptionOptions
from .types import HealthCheckResponse


class ZealClient:
    """Main client for interacting with the Zeal Integration Protocol."""
    
    def __init__(self, config: Optional[ClientConfig] = None):
        """Initialize the Zeal client.
        
        Args:
            config: Client configuration. If None, uses default configuration.
        """
        self.config = config or ClientConfig()
        
        # Validate configuration
        if not self.config.base_url:
            raise ValueError("Base URL cannot be empty")
        
        # Create HTTP client
        timeout = httpx.Timeout(self.config.default_timeout.total_seconds())
        self._http_client = httpx.AsyncClient(
            timeout=timeout,
            verify=self.config.verify_tls,
            headers={
                "User-Agent": self.config.user_agent,
                "Content-Type": "application/json"
            }
        )
        
        # Initialize API modules
        self.orchestrator = OrchestratorAPI(self)
        self.templates = TemplatesAPI(self)
        self.traces = TracesAPI(self)
        self.webhooks = WebhooksAPI(self)
    
    def create_webhook_subscription(self, options: Optional[SubscriptionOptions] = None) -> WebhookSubscription:
        """Create a new webhook subscription.
        
        Args:
            options: Subscription configuration options.
            
        Returns:
            A WebhookSubscription instance.
        """
        return WebhookSubscription(self.webhooks, options)
    
    async def __aenter__(self):
        """Async context manager entry."""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()
    
    async def close(self):
        """Close the HTTP client."""
        await self._http_client.aclose()
    
    @property
    def base_url(self) -> str:
        """Get the base URL."""
        return self.config.base_url
    
    async def health(self) -> HealthCheckResponse:
        """Check service health."""
        url = f"{self.config.base_url.rstrip('/')}/api/zip/health"
        
        response = await self._http_client.get(url)
        response.raise_for_status()
        
        return HealthCheckResponse(**response.json())
    
    async def _make_request(
        self,
        method: str,
        path: str,
        json_data: Optional[dict] = None,
        params: Optional[dict] = None
    ) -> httpx.Response:
        """Make an HTTP request with retries.
        
        Args:
            method: HTTP method
            path: API path (without base URL)
            json_data: JSON data to send in request body
            params: Query parameters
            
        Returns:
            HTTP response
            
        Raises:
            httpx.HTTPError: If request fails after retries
        """
        url = f"{self.config.base_url.rstrip('/')}{path}"
        
        last_exception = None
        for attempt in range(self.config.max_retries + 1):
            try:
                response = await self._http_client.request(
                    method=method,
                    url=url,
                    json=json_data,
                    params=params
                )
                
                # Don't retry client errors (4xx)
                if 400 <= response.status_code < 500:
                    response.raise_for_status()
                    return response
                
                # Success or will retry server errors (5xx)
                if response.status_code < 500:
                    return response
                
                response.raise_for_status()  # Will raise for 5xx
                
            except httpx.HTTPError as e:
                last_exception = e
                if attempt < self.config.max_retries:
                    # Wait before retry
                    await asyncio.sleep(self.config.retry_backoff_ms / 1000.0)
                    continue
                break
        
        # All retries failed
        raise last_exception or httpx.RequestError("Request failed")


# Import asyncio for sleep function
import asyncio