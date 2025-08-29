package zeal

import (
	"testing"
)

func TestDefaultSubscriptionOptions(t *testing.T) {
	opts := DefaultSubscriptionOptions()
	
	if opts.Port != 3001 {
		t.Errorf("Expected port 3001, got %d", opts.Port)
	}
	
	if opts.Host != "0.0.0.0" {
		t.Errorf("Expected host '0.0.0.0', got %s", opts.Host)
	}
	
	if opts.Path != "/webhooks" {
		t.Errorf("Expected path '/webhooks', got %s", opts.Path)
	}
	
	if opts.AutoRegister != true {
		t.Errorf("Expected AutoRegister to be true, got %v", opts.AutoRegister)
	}
}

func TestNewWebhookSubscription(t *testing.T) {
	// Create a mock webhooks API
	mockClient := &Client{}
	mockWebhooksAPI := &WebhooksAPI{client: mockClient}
	
	// Test with default options
	subscription := NewWebhookSubscription(mockWebhooksAPI, nil)
	
	if subscription.options.Port != 3001 {
		t.Errorf("Expected default port 3001, got %d", subscription.options.Port)
	}
	
	if subscription.webhooksAPI != mockWebhooksAPI {
		t.Error("WebhooksAPI not set correctly")
	}
	
	if subscription.observable == nil {
		t.Error("Observable not initialized")
	}
}

func TestWebhookSubscriptionCallbacks(t *testing.T) {
	mockClient := &Client{}
	mockWebhooksAPI := &WebhooksAPI{client: mockClient}
	subscription := NewWebhookSubscription(mockWebhooksAPI, nil)
	
	// Test event callback
	unsubscribe := subscription.OnEvent(func(event map[string]interface{}) error {
		return nil
	})
	
	if len(subscription.eventCallbacks) != 1 {
		t.Errorf("Expected 1 event callback, got %d", len(subscription.eventCallbacks))
	}
	
	// Test unsubscribe
	unsubscribe()
	if len(subscription.eventCallbacks) != 0 {
		t.Errorf("Expected 0 event callbacks after unsubscribe, got %d", len(subscription.eventCallbacks))
	}
	
	// Test delivery callback
	subscription.OnDelivery(func(delivery WebhookDelivery) error {
		return nil
	})
	
	if len(subscription.deliveryCallbacks) != 1 {
		t.Errorf("Expected 1 delivery callback, got %d", len(subscription.deliveryCallbacks))
	}
	
	// Test error callback
	subscription.OnError(func(err error) error {
		return nil
	})
	
	if len(subscription.errorCallbacks) != 1 {
		t.Errorf("Expected 1 error callback, got %d", len(subscription.errorCallbacks))
	}
}

func TestWebhookSubscriptionState(t *testing.T) {
	mockClient := &Client{}
	mockWebhooksAPI := &WebhooksAPI{client: mockClient}
	subscription := NewWebhookSubscription(mockWebhooksAPI, nil)
	
	// Test initial state
	if subscription.IsRunning() {
		t.Error("Expected subscription to not be running initially")
	}
	
	if subscription.WebhookID() != "" {
		t.Error("Expected webhook ID to be empty initially")
	}
}

func TestWebhookObservable(t *testing.T) {
	mockClient := &Client{}
	mockWebhooksAPI := &WebhooksAPI{client: mockClient}
	subscription := NewWebhookSubscription(mockWebhooksAPI, nil)
	
	observable := subscription.AsObservable()
	if observable == nil {
		t.Error("Observable should not be nil")
	}
	
	if observable.subscription != subscription {
		t.Error("Observable should have reference to subscription")
	}
}

func TestEventTypeFiltering(t *testing.T) {
	mockClient := &Client{}
	mockWebhooksAPI := &WebhooksAPI{client: mockClient}
	subscription := NewWebhookSubscription(mockWebhooksAPI, nil)
	
	eventReceived := false
	eventTypes := []string{"node.completed", "workflow.started"}
	
	unsubscribe := subscription.OnEventType(eventTypes, func(event map[string]interface{}) error {
		eventReceived = true
		return nil
	})
	defer unsubscribe()
	
	// Simulate processing an event that matches
	matchingEvent := map[string]interface{}{
		"type": "node.completed",
		"data": "test",
	}
	
	// This would normally be called by the webhook handler
	for _, callback := range subscription.eventCallbacks {
		callback(matchingEvent)
	}
	
	if !eventReceived {
		t.Error("Expected matching event to be received")
	}
	
	// Reset and test non-matching event
	eventReceived = false
	nonMatchingEvent := map[string]interface{}{
		"type": "other.event",
		"data": "test",
	}
	
	for _, callback := range subscription.eventCallbacks {
		callback(nonMatchingEvent)
	}
	
	if eventReceived {
		t.Error("Expected non-matching event to be filtered out")
	}
}

func TestEventSourceFiltering(t *testing.T) {
	mockClient := &Client{}
	mockWebhooksAPI := &WebhooksAPI{client: mockClient}
	subscription := NewWebhookSubscription(mockWebhooksAPI, nil)
	
	eventReceived := false
	sources := []string{"workflow-123", "workflow-456"}
	
	unsubscribe := subscription.OnEventSource(sources, func(event map[string]interface{}) error {
		eventReceived = true
		return nil
	})
	defer unsubscribe()
	
	// Simulate processing an event that matches
	matchingEvent := map[string]interface{}{
		"workflowId": "workflow-123",
		"type":       "node.completed",
	}
	
	for _, callback := range subscription.eventCallbacks {
		callback(matchingEvent)
	}
	
	if !eventReceived {
		t.Error("Expected matching source event to be received")
	}
	
	// Reset and test non-matching source
	eventReceived = false
	nonMatchingEvent := map[string]interface{}{
		"workflowId": "workflow-999",
		"type":       "node.completed",
	}
	
	for _, callback := range subscription.eventCallbacks {
		callback(nonMatchingEvent)
	}
	
	if eventReceived {
		t.Error("Expected non-matching source event to be filtered out")
	}
}

func TestCustomSubscriptionOptions(t *testing.T) {
	customOptions := &SubscriptionOptions{
		Port:            8080,
		Host:            "127.0.0.1",
		Path:            "/custom",
		HTTPS:           true,
		AutoRegister:    false,
		Namespace:       "custom-namespace",
		Events:          []string{"workflow.*", "node.*"},
		BufferSize:      2000,
		VerifySignature: true,
		SecretKey:       "my-secret",
	}
	
	mockClient := &Client{}
	mockWebhooksAPI := &WebhooksAPI{client: mockClient}
	subscription := NewWebhookSubscription(mockWebhooksAPI, customOptions)
	
	if subscription.options.Port != 8080 {
		t.Errorf("Expected custom port 8080, got %d", subscription.options.Port)
	}
	
	if subscription.options.Host != "127.0.0.1" {
		t.Errorf("Expected custom host '127.0.0.1', got %s", subscription.options.Host)
	}
	
	if subscription.options.Path != "/custom" {
		t.Errorf("Expected custom path '/custom', got %s", subscription.options.Path)
	}
	
	if !subscription.options.HTTPS {
		t.Error("Expected HTTPS to be enabled")
	}
	
	if subscription.options.AutoRegister {
		t.Error("Expected AutoRegister to be disabled")
	}
	
	if subscription.options.Namespace != "custom-namespace" {
		t.Errorf("Expected custom namespace, got %s", subscription.options.Namespace)
	}
	
	if len(subscription.options.Events) != 2 {
		t.Errorf("Expected 2 custom events, got %d", len(subscription.options.Events))
	}
	
	if subscription.options.BufferSize != 2000 {
		t.Errorf("Expected custom buffer size 2000, got %d", subscription.options.BufferSize)
	}
	
	if !subscription.options.VerifySignature {
		t.Error("Expected signature verification to be enabled")
	}
	
	if subscription.options.SecretKey != "my-secret" {
		t.Errorf("Expected custom secret key, got %s", subscription.options.SecretKey)
	}
}