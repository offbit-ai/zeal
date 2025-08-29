"""Tests for webhook subscription functionality."""

import asyncio
import json
from unittest.mock import AsyncMock, Mock, patch

import pytest

from zeal import ZealClient, ClientConfig
from zeal.subscription import (
    WebhookSubscription, 
    SubscriptionOptions, 
    WebhookObservable,
    WebhookDelivery,
    WebhookMetadata,
    create_webhook_subscription,
    webhook_subscription
)
from zeal.events import NodeAddedEvent, create_node_added_event
from zeal.webhooks import WebhooksAPI


@pytest.fixture
def client_config():
    """Create a test client configuration."""
    return ClientConfig(base_url="http://localhost:3000")


@pytest.fixture
def zeal_client(client_config):
    """Create a test Zeal client."""
    return ZealClient(client_config)


@pytest.fixture
def subscription_options():
    """Create test subscription options."""
    return SubscriptionOptions(
        port=9999,
        host="127.0.0.1",
        path="/test-webhooks",
        auto_register=False,
        namespace="test",
        events=["node.*", "workflow.*"],
        buffer_size=500
    )


def test_default_subscription_options():
    """Test default subscription options."""
    options = SubscriptionOptions()
    
    assert options.port == 3001
    assert options.host == "0.0.0.0"
    assert options.path == "/webhooks"
    assert options.https is False
    assert options.auto_register is True
    assert options.namespace == "default"
    assert options.events == ["*"]
    assert options.buffer_size == 1000
    assert options.verify_signature is False


def test_custom_subscription_options(subscription_options):
    """Test custom subscription options."""
    assert subscription_options.port == 9999
    assert subscription_options.host == "127.0.0.1"
    assert subscription_options.path == "/test-webhooks"
    assert subscription_options.auto_register is False
    assert subscription_options.namespace == "test"
    assert subscription_options.events == ["node.*", "workflow.*"]
    assert subscription_options.buffer_size == 500


def test_webhook_observable():
    """Test WebhookObservable functionality."""
    observable = WebhookObservable(buffer_size=100)
    
    # Test initial state
    assert observable._buffer_size == 100
    assert not observable._completed
    assert len(observable._subscribers) == 0


def test_webhook_observable_subscription():
    """Test WebhookObservable subscription."""
    observable = WebhookObservable()
    
    events_received = []
    errors_received = []
    completed = False
    
    def event_handler(event):
        events_received.append(event)
    
    def error_handler(error):
        errors_received.append(error)
    
    def complete_handler():
        nonlocal completed
        completed = True
    
    # Subscribe
    unsubscribe = observable.subscribe(event_handler, error_handler, complete_handler)
    
    assert len(observable._subscribers) == 1
    
    # Test unsubscribe
    unsubscribe()
    assert len(observable._subscribers) == 0


@pytest.mark.asyncio
async def test_webhook_observable_emit():
    """Test WebhookObservable event emission."""
    observable = WebhookObservable()
    
    events_received = []
    
    async def async_event_handler(event):
        events_received.append(event)
    
    def sync_event_handler(event):
        events_received.append(event)
    
    # Subscribe with async handler
    observable.subscribe(async_event_handler)
    
    # Subscribe with sync handler  
    observable.subscribe(sync_event_handler)
    
    # Create test event
    test_event = create_node_added_event(
        workflow_id="test-workflow",
        node_id="test-node",
        data={"type": "processor", "name": "Test Node"}
    )
    
    # Emit event
    await observable.emit(test_event)
    
    # Both handlers should have received the event
    assert len(events_received) == 2
    assert all(event.node_id == "test-node" for event in events_received)


def test_webhook_observable_filter():
    """Test WebhookObservable filtering."""
    observable = WebhookObservable()
    
    # Create filtered observable for node events only
    filtered = observable.filter(lambda event: event.type.startswith("node."))
    
    assert filtered is not observable
    assert isinstance(filtered, WebhookObservable)


def test_webhook_subscription_creation(zeal_client):
    """Test WebhookSubscription creation."""
    subscription = WebhookSubscription(zeal_client.webhooks)
    
    assert subscription.webhooks_api is zeal_client.webhooks
    assert isinstance(subscription.options, SubscriptionOptions)
    assert not subscription.is_running()
    assert subscription.webhook_id() is None
    assert isinstance(subscription.as_observable(), WebhookObservable)


def test_webhook_subscription_with_options(zeal_client, subscription_options):
    """Test WebhookSubscription creation with custom options."""
    subscription = WebhookSubscription(zeal_client.webhooks, subscription_options)
    
    assert subscription.options.port == 9999
    assert subscription.options.host == "127.0.0.1"
    assert subscription.options.namespace == "test"


def test_webhook_subscription_callbacks(zeal_client):
    """Test WebhookSubscription callback management."""
    subscription = WebhookSubscription(zeal_client.webhooks)
    
    # Test event callback
    event_callback_called = False
    
    def event_callback(event):
        nonlocal event_callback_called
        event_callback_called = True
    
    unsubscribe_event = subscription.on_event(event_callback)
    assert len(subscription._event_callbacks) == 1
    
    # Test delivery callback
    def delivery_callback(delivery):
        pass
    
    unsubscribe_delivery = subscription.on_delivery(delivery_callback)
    assert len(subscription._delivery_callbacks) == 1
    
    # Test error callback
    def error_callback(error):
        pass
    
    unsubscribe_error = subscription.on_error(error_callback)
    assert len(subscription._error_callbacks) == 1
    
    # Test unsubscribe
    unsubscribe_event()
    assert len(subscription._event_callbacks) == 0
    
    unsubscribe_delivery()
    assert len(subscription._delivery_callbacks) == 0
    
    unsubscribe_error()
    assert len(subscription._error_callbacks) == 0


def test_webhook_subscription_event_type_filtering(zeal_client):
    """Test WebhookSubscription event type filtering."""
    subscription = WebhookSubscription(zeal_client.webhooks)
    
    received_events = []
    
    def callback(event):
        received_events.append(event)
    
    # Subscribe to specific event types
    unsubscribe = subscription.on_event_type(["node.added", "node.updated"], callback)
    
    # Should have added one filtered callback
    assert len(subscription._event_callbacks) == 1
    
    unsubscribe()
    assert len(subscription._event_callbacks) == 0


def test_webhook_subscription_source_filtering(zeal_client):
    """Test WebhookSubscription source filtering."""
    subscription = WebhookSubscription(zeal_client.webhooks)
    
    received_events = []
    
    def callback(event):
        received_events.append(event)
    
    # Subscribe to specific sources
    unsubscribe = subscription.on_event_source(["workflow-123", "workflow-456"], callback)
    
    # Should have added one filtered callback
    assert len(subscription._event_callbacks) == 1
    
    unsubscribe()
    assert len(subscription._event_callbacks) == 0


def test_create_webhook_subscription_helper(zeal_client):
    """Test create_webhook_subscription helper function."""
    subscription = create_webhook_subscription(zeal_client.webhooks)
    
    assert isinstance(subscription, WebhookSubscription)
    assert subscription.webhooks_api is zeal_client.webhooks


@pytest.mark.asyncio
async def test_webhook_subscription_context_manager():
    """Test webhook_subscription async context manager."""
    mock_webhooks_api = Mock(spec=WebhooksAPI)
    
    with patch.object(WebhookSubscription, 'start') as mock_start, \
         patch.object(WebhookSubscription, 'stop') as mock_stop:
        
        mock_start.return_value = None
        mock_stop.return_value = None
        
        async with webhook_subscription(mock_webhooks_api) as subscription:
            assert isinstance(subscription, WebhookSubscription)
            mock_start.assert_called_once()
        
        mock_stop.assert_called_once()


def test_client_create_webhook_subscription(zeal_client):
    """Test client's create_webhook_subscription method."""
    subscription = zeal_client.create_webhook_subscription()
    
    assert isinstance(subscription, WebhookSubscription)
    assert subscription.webhooks_api is zeal_client.webhooks


def test_client_create_webhook_subscription_with_options(zeal_client, subscription_options):
    """Test client's create_webhook_subscription method with custom options."""
    subscription = zeal_client.create_webhook_subscription(subscription_options)
    
    assert isinstance(subscription, WebhookSubscription)
    assert subscription.options.port == 9999
    assert subscription.options.namespace == "test"


def test_webhook_delivery_parsing():
    """Test WebhookDelivery parsing."""
    delivery_data = {
        "webhookId": "webhook-123",
        "events": [
            {
                "type": "node.added",
                "workflowId": "workflow-456",
                "nodeId": "node-789",
                "data": {"type": "processor"}
            }
        ],
        "metadata": {
            "namespace": "test",
            "deliveryId": "delivery-123",
            "timestamp": "2023-01-01T00:00:00Z"
        }
    }
    
    delivery = WebhookDelivery(**delivery_data)
    
    assert delivery.webhook_id == "webhook-123"
    assert len(delivery.events) == 1
    assert delivery.metadata.namespace == "test"
    assert delivery.metadata.delivery_id == "delivery-123"


def test_webhook_metadata_parsing():
    """Test WebhookMetadata parsing."""
    metadata_data = {
        "namespace": "production",
        "deliveryId": "del_123456789",
        "timestamp": "2023-06-15T10:30:00Z"
    }
    
    metadata = WebhookMetadata(**metadata_data)
    
    assert metadata.namespace == "production"
    assert metadata.delivery_id == "del_123456789"
    assert metadata.timestamp == "2023-06-15T10:30:00Z"


@pytest.mark.asyncio  
async def test_webhook_subscription_signature_verification():
    """Test webhook signature verification."""
    options = SubscriptionOptions(
        verify_signature=True,
        secret_key="test-secret",
        auto_register=False
    )
    
    mock_webhooks_api = Mock(spec=WebhooksAPI)
    subscription = WebhookSubscription(mock_webhooks_api, options)
    
    # Test signature verification method directly
    body = b'{"test": "data"}'
    
    # Calculate expected signature
    import hmac
    import hashlib
    expected_sig = hmac.new(
        b"test-secret",
        body,
        hashlib.sha256
    ).hexdigest()
    
    # Test valid signature
    valid_signature = f"sha256={expected_sig}"
    assert subscription._verify_signature(body, valid_signature) is True
    
    # Test invalid signature
    invalid_signature = "sha256=invalid"
    assert subscription._verify_signature(body, invalid_signature) is False
    
    # Test malformed signature
    malformed_signature = "invalid-format"
    assert subscription._verify_signature(body, malformed_signature) is False


@pytest.mark.asyncio
async def test_process_delivery(zeal_client):
    """Test webhook delivery processing."""
    subscription = WebhookSubscription(zeal_client.webhooks)
    
    events_received = []
    deliveries_received = []
    
    def event_callback(event):
        events_received.append(event)
    
    def delivery_callback(delivery):
        deliveries_received.append(delivery)
    
    subscription.on_event(event_callback)
    subscription.on_delivery(delivery_callback)
    
    # Create test delivery
    delivery = WebhookDelivery(
        webhook_id="webhook-123",
        events=[
            {
                "type": "node.added",
                "id": "evt_123",
                "timestamp": "2023-01-01T00:00:00Z",
                "workflowId": "workflow-456",
                "nodeId": "node-789",
                "data": {"type": "processor", "name": "Test Node"}
            }
        ],
        metadata=WebhookMetadata(
            namespace="test",
            delivery_id="delivery-123",
            timestamp="2023-01-01T00:00:00Z"
        )
    )
    
    # Process the delivery
    await subscription._process_delivery(delivery)
    
    # Check that callbacks were called
    assert len(deliveries_received) == 1
    assert len(events_received) == 1
    
    # Check the received event
    event = events_received[0]
    assert event.type == "node.added"
    assert event.workflow_id == "workflow-456"
    assert hasattr(event, 'node_id') and event.node_id == "node-789"