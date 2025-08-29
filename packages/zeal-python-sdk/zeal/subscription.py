"""Webhook subscription functionality for Zeal Python SDK."""

import asyncio
import hashlib
import hmac
import json
import signal
import ssl
from asyncio import AbstractEventLoop
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import Any, AsyncGenerator, Callable, Dict, List, Optional, Set, Union

from aiohttp import web, ClientSession
from aiohttp.web import Request, Response
from pydantic import BaseModel, Field

from .events import ZipWebhookEvent, parse_zip_webhook_event
from .webhooks import WebhooksAPI


@dataclass
class SubscriptionOptions:
    """Options for configuring webhook subscriptions."""
    port: int = 3001
    host: str = "0.0.0.0"
    path: str = "/webhooks"
    https: bool = False
    ssl_context: Optional[ssl.SSLContext] = None
    auto_register: bool = True
    namespace: str = "default"
    events: List[str] = field(default_factory=lambda: ["*"])
    buffer_size: int = 1000
    headers: Optional[Dict[str, str]] = None
    verify_signature: bool = False
    secret_key: Optional[str] = None


class WebhookMetadata(BaseModel):
    """Webhook delivery metadata."""
    namespace: str
    delivery_id: str = Field(alias="deliveryId")
    timestamp: str
    
    class Config:
        populate_by_name = True


class WebhookDelivery(BaseModel):
    """Webhook delivery containing multiple events."""
    webhook_id: str = Field(alias="webhookId")
    events: List[Dict[str, Any]]
    metadata: WebhookMetadata
    
    class Config:
        populate_by_name = True


# Type aliases for callbacks
WebhookEventCallback = Callable[[ZipWebhookEvent], None]
AsyncWebhookEventCallback = Callable[[ZipWebhookEvent], Any]  # Can be sync or async
WebhookDeliveryCallback = Callable[[WebhookDelivery], None]
AsyncWebhookDeliveryCallback = Callable[[WebhookDelivery], Any]  # Can be sync or async
WebhookErrorCallback = Callable[[Exception], None]
AsyncWebhookErrorCallback = Callable[[Exception], Any]  # Can be sync or async


class WebhookObservable:
    """Observable implementation for webhook events."""
    
    def __init__(self, buffer_size: int = 1000):
        self._subscribers: List[Dict[str, Any]] = []
        self._buffer_size = buffer_size
        self._event_queue: asyncio.Queue = asyncio.Queue(maxsize=buffer_size)
        self._error_queue: asyncio.Queue = asyncio.Queue(maxsize=10)
        self._completed = False
    
    def subscribe(
        self,
        next_handler: AsyncWebhookEventCallback,
        error_handler: Optional[AsyncWebhookErrorCallback] = None,
        complete_handler: Optional[Callable[[], Any]] = None
    ) -> Callable[[], None]:
        """Subscribe to webhook events."""
        subscriber = {
            'next': next_handler,
            'error': error_handler,
            'complete': complete_handler
        }
        self._subscribers.append(subscriber)
        
        def unsubscribe():
            if subscriber in self._subscribers:
                self._subscribers.remove(subscriber)
        
        return unsubscribe
    
    def filter(self, predicate: Callable[[ZipWebhookEvent], bool]) -> 'WebhookObservable':
        """Create a filtered observable."""
        filtered = WebhookObservable(self._buffer_size)
        
        async def filter_handler(event: ZipWebhookEvent):
            if predicate(event):
                await filtered.emit(event)
        
        self.subscribe(
            filter_handler,
            lambda err: filtered.error(err),
            lambda: filtered.complete()
        )
        
        return filtered
    
    async def emit(self, event: ZipWebhookEvent):
        """Emit an event to all subscribers."""
        if self._completed:
            return
        
        # Send to subscribers
        for subscriber in self._subscribers.copy():
            try:
                handler = subscriber['next']
                if asyncio.iscoroutinefunction(handler):
                    await handler(event)
                else:
                    handler(event)
            except Exception as e:
                if subscriber.get('error'):
                    try:
                        error_handler = subscriber['error']
                        if asyncio.iscoroutinefunction(error_handler):
                            await error_handler(e)
                        else:
                            error_handler(e)
                    except Exception:
                        pass  # Ignore errors in error handlers
    
    def error(self, err: Exception):
        """Emit an error to all subscribers."""
        if self._completed:
            return
        
        for subscriber in self._subscribers.copy():
            if subscriber.get('error'):
                try:
                    error_handler = subscriber['error']
                    if asyncio.iscoroutinefunction(error_handler):
                        asyncio.create_task(error_handler(err))
                    else:
                        error_handler(err)
                except Exception:
                    pass  # Ignore errors in error handlers
    
    def complete(self):
        """Complete the observable."""
        if self._completed:
            return
        
        self._completed = True
        for subscriber in self._subscribers.copy():
            if subscriber.get('complete'):
                try:
                    complete_handler = subscriber['complete']
                    if asyncio.iscoroutinefunction(complete_handler):
                        asyncio.create_task(complete_handler())
                    else:
                        complete_handler()
                except Exception:
                    pass  # Ignore errors in complete handlers
        
        self._subscribers.clear()


class WebhookSubscription:
    """Webhook subscription manager for receiving webhook events."""
    
    def __init__(self, webhooks_api: WebhooksAPI, options: Optional[SubscriptionOptions] = None):
        self.webhooks_api = webhooks_api
        self.options = options or SubscriptionOptions()
        self._server: Optional[web.Application] = None
        self._server_runner: Optional[web.AppRunner] = None
        self._site: Optional[web.TCPSite] = None
        
        self._event_callbacks: List[AsyncWebhookEventCallback] = []
        self._delivery_callbacks: List[AsyncWebhookDeliveryCallback] = []
        self._error_callbacks: List[AsyncWebhookErrorCallback] = []
        
        self._webhook_id: Optional[str] = None
        self._is_running = False
        self._observable = WebhookObservable(self.options.buffer_size)
        
        # Graceful shutdown handling
        self._shutdown_event = asyncio.Event()
        self._setup_signal_handlers()
    
    def _setup_signal_handlers(self):
        """Setup signal handlers for graceful shutdown."""
        try:
            for sig in (signal.SIGTERM, signal.SIGINT):
                signal.signal(sig, lambda s, f: asyncio.create_task(self.stop()))
        except (OSError, RuntimeError):
            # Signal handling might not work in all environments
            pass
    
    def on_event(self, callback: AsyncWebhookEventCallback) -> Callable[[], None]:
        """Subscribe to webhook events with a callback."""
        self._event_callbacks.append(callback)
        
        def unsubscribe():
            if callback in self._event_callbacks:
                self._event_callbacks.remove(callback)
        
        return unsubscribe
    
    def on_delivery(self, callback: AsyncWebhookDeliveryCallback) -> Callable[[], None]:
        """Subscribe to webhook deliveries with a callback."""
        self._delivery_callbacks.append(callback)
        
        def unsubscribe():
            if callback in self._delivery_callbacks:
                self._delivery_callbacks.remove(callback)
        
        return unsubscribe
    
    def on_error(self, callback: AsyncWebhookErrorCallback) -> Callable[[], None]:
        """Subscribe to errors with a callback."""
        self._error_callbacks.append(callback)
        
        def unsubscribe():
            if callback in self._error_callbacks:
                self._error_callbacks.remove(callback)
        
        return unsubscribe
    
    def as_observable(self) -> WebhookObservable:
        """Get the observable interface."""
        return self._observable
    
    async def start(self) -> None:
        """Start the webhook server."""
        if self._is_running:
            raise RuntimeError("Webhook subscription is already running")
        
        # Create the web application
        self._server = web.Application()
        self._server.router.add_post(self.options.path, self._webhook_handler)
        
        # Setup and start the server
        self._server_runner = web.AppRunner(self._server)
        await self._server_runner.setup()
        
        self._site = web.TCPSite(
            self._server_runner,
            host=self.options.host,
            port=self.options.port,
            ssl_context=self.options.ssl_context if self.options.https else None
        )
        
        await self._site.start()
        
        protocol = "https" if self.options.https else "http"
        print(f"Webhook server listening on {protocol}://{self.options.host}:{self.options.port}{self.options.path}")
        
        self._is_running = True
        
        # Auto-register webhook if enabled
        if self.options.auto_register:
            await asyncio.sleep(0.1)  # Small delay to ensure server is ready
            await self.register()
    
    async def stop(self) -> None:
        """Stop the webhook server."""
        if not self._is_running:
            return
        
        # Unregister webhook if it was registered
        if self._webhook_id:
            try:
                await self.webhooks_api.delete(self._webhook_id)
                print(f"Unregistered webhook {self._webhook_id}")
            except Exception as e:
                print(f"Failed to unregister webhook {self._webhook_id}: {e}")
            finally:
                self._webhook_id = None
        
        # Stop the server
        if self._site:
            await self._site.stop()
            self._site = None
        
        if self._server_runner:
            await self._server_runner.cleanup()
            self._server_runner = None
        
        self._server = None
        self._is_running = False
        
        # Complete the observable
        self._observable.complete()
        
        print("Webhook server stopped")
    
    async def register(self) -> None:
        """Register the webhook with Zeal."""
        if not self._is_running:
            raise RuntimeError("Webhook server must be running before registration")
        
        # Determine the public URL for the webhook
        protocol = "https" if self.options.https else "http"
        host = "localhost" if self.options.host == "0.0.0.0" else self.options.host
        webhook_url = f"{protocol}://{host}:{self.options.port}{self.options.path}"
        
        # Register with Zeal
        from .types import CreateWebhookRequest
        
        request = CreateWebhookRequest(
            url=webhook_url,
            events=self.options.events,
            headers=self.options.headers or {}
        )
        
        result = await self.webhooks_api.create(request)
        self._webhook_id = result.subscription.id
        print(f"Registered webhook {self._webhook_id} at {webhook_url}")
    
    def is_running(self) -> bool:
        """Check if the subscription is running."""
        return self._is_running
    
    def webhook_id(self) -> Optional[str]:
        """Get the current webhook ID if registered."""
        return self._webhook_id
    
    def on_event_type(
        self,
        event_types: Union[str, List[str]],
        callback: AsyncWebhookEventCallback
    ) -> Callable[[], None]:
        """Subscribe to specific event types."""
        types_set = set(event_types if isinstance(event_types, list) else [event_types])
        
        async def filtered_callback(event: ZipWebhookEvent):
            if event.type in types_set:
                if asyncio.iscoroutinefunction(callback):
                    await callback(event)
                else:
                    callback(event)
        
        return self.on_event(filtered_callback)
    
    def on_event_source(
        self,
        sources: Union[str, List[str]],
        callback: AsyncWebhookEventCallback
    ) -> Callable[[], None]:
        """Subscribe to events from specific sources."""
        sources_set = set(sources if isinstance(sources, list) else [sources])
        
        async def filtered_callback(event: ZipWebhookEvent):
            if hasattr(event, 'workflow_id') and event.workflow_id in sources_set:
                if asyncio.iscoroutinefunction(callback):
                    await callback(event)
                else:
                    callback(event)
        
        return self.on_event(filtered_callback)
    
    def filter_events(self, predicate: Callable[[ZipWebhookEvent], bool]) -> WebhookObservable:
        """Create a filtered observable."""
        return self._observable.filter(predicate)
    
    async def _webhook_handler(self, request: Request) -> Response:
        """Handle incoming webhook requests."""
        try:
            # Read request body
            body = await request.read()
            body_text = body.decode('utf-8')
            
            # Verify signature if enabled
            if self.options.verify_signature and self.options.secret_key:
                signature = request.headers.get('X-Zeal-Signature', '')
                if not self._verify_signature(body, signature):
                    await self._emit_error(Exception("Invalid webhook signature"))
                    return Response(status=401, text="Invalid signature")
            
            # Parse the delivery
            delivery_data = json.loads(body_text)
            delivery = WebhookDelivery(**delivery_data)
            
            # Process the delivery in background
            asyncio.create_task(self._process_delivery(delivery))
            
            return Response(status=200, text="OK")
        
        except Exception as e:
            await self._emit_error(e)
            return Response(status=500, text="Internal server error")
    
    async def _process_delivery(self, delivery: WebhookDelivery):
        """Process a webhook delivery."""
        try:
            # Call delivery callbacks
            for callback in self._delivery_callbacks.copy():
                try:
                    if asyncio.iscoroutinefunction(callback):
                        await callback(delivery)
                    else:
                        callback(delivery)
                except Exception as e:
                    await self._emit_error(e)
            
            # Process individual events
            for event_data in delivery.events:
                try:
                    # Parse the event
                    event = parse_zip_webhook_event(event_data)
                    
                    # Emit to observable
                    await self._observable.emit(event)
                    
                    # Call event callbacks
                    for callback in self._event_callbacks.copy():
                        try:
                            if asyncio.iscoroutinefunction(callback):
                                await callback(event)
                            else:
                                callback(event)
                        except Exception as e:
                            await self._emit_error(e)
                
                except Exception as e:
                    await self._emit_error(Exception(f"Failed to parse event: {e}"))
        
        except Exception as e:
            await self._emit_error(e)
    
    async def _emit_error(self, error: Exception):
        """Emit an error to all error callbacks and the observable."""
        # Call error callbacks
        for callback in self._error_callbacks.copy():
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(error)
                else:
                    callback(error)
            except Exception:
                pass  # Ignore errors in error callbacks
        
        # Emit to observable
        self._observable.error(error)
    
    def _verify_signature(self, body: bytes, signature: str) -> bool:
        """Verify webhook signature."""
        if not self.options.secret_key:
            return False
        
        # Parse the signature (format: "sha256=...")
        if not signature.startswith("sha256="):
            return False
        
        expected_sig = signature[7:]  # Remove "sha256=" prefix
        
        # Calculate HMAC
        calculated_sig = hmac.new(
            self.options.secret_key.encode('utf-8'),
            body,
            hashlib.sha256
        ).hexdigest()
        
        # Compare signatures
        return hmac.compare_digest(expected_sig, calculated_sig)
    
    async def __aenter__(self):
        """Async context manager entry."""
        await self.start()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.stop()


# Convenience function for creating subscriptions
def create_webhook_subscription(
    webhooks_api: WebhooksAPI,
    options: Optional[SubscriptionOptions] = None
) -> WebhookSubscription:
    """Create a new webhook subscription."""
    return WebhookSubscription(webhooks_api, options)


# Async context manager for webhook subscriptions
@asynccontextmanager
async def webhook_subscription(
    webhooks_api: WebhooksAPI,
    options: Optional[SubscriptionOptions] = None
) -> AsyncGenerator[WebhookSubscription, None]:
    """Async context manager for webhook subscriptions."""
    subscription = WebhookSubscription(webhooks_api, options)
    try:
        await subscription.start()
        yield subscription
    finally:
        await subscription.stop()