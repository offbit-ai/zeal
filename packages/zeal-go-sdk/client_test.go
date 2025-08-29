package zeal

import (
	"testing"
	"time"
)

func TestNewClient(t *testing.T) {
	config := DefaultClientConfig()
	config.BaseURL = "http://localhost:3000"

	client, err := NewClient(config)
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}

	if client.BaseURL() != "http://localhost:3000" {
		t.Errorf("Expected BaseURL to be 'http://localhost:3000', got '%s'", client.BaseURL())
	}

	// Test API access
	if client.Orchestrator() == nil {
		t.Error("Orchestrator API should not be nil")
	}
	if client.Templates() == nil {
		t.Error("Templates API should not be nil")
	}
	if client.Traces() == nil {
		t.Error("Traces API should not be nil")
	}
	if client.Webhooks() == nil {
		t.Error("Webhooks API should not be nil")
	}
}

func TestNewClientEmptyBaseURL(t *testing.T) {
	config := DefaultClientConfig()
	config.BaseURL = ""

	_, err := NewClient(config)
	if err == nil {
		t.Error("Expected error for empty BaseURL")
	}
}

func TestDefaultClientConfig(t *testing.T) {
	config := DefaultClientConfig()

	if config.BaseURL != "http://localhost:3000" {
		t.Errorf("Expected BaseURL to be 'http://localhost:3000', got '%s'", config.BaseURL)
	}

	if config.DefaultTimeout != 30*time.Second {
		t.Errorf("Expected DefaultTimeout to be 30s, got %v", config.DefaultTimeout)
	}

	if !config.VerifyTLS {
		t.Error("Expected VerifyTLS to be true")
	}

	if config.UserAgent != "zeal-go-sdk/1.0.0" {
		t.Errorf("Expected UserAgent to be 'zeal-go-sdk/1.0.0', got '%s'", config.UserAgent)
	}
}

func TestEventCreation(t *testing.T) {
	workflowID := "workflow-123"
	nodeID := "node-456"
	data := map[string]interface{}{
		"key": "value",
	}

	// Test node added event
	event := CreateNodeAddedEvent(workflowID, nodeID, data, nil)
	
	if event.GetEventType() != "node.added" {
		t.Errorf("Expected event type 'node.added', got '%s'", event.GetEventType())
	}
	
	if event.GetWorkflowID() != workflowID {
		t.Errorf("Expected workflow ID '%s', got '%s'", workflowID, event.GetWorkflowID())
	}
	
	if event.NodeID != nodeID {
		t.Errorf("Expected node ID '%s', got '%s'", nodeID, event.NodeID)
	}
	
	if !event.IsNodeEvent() {
		t.Error("Expected IsNodeEvent to return true")
	}
	
	if event.IsGroupEvent() {
		t.Error("Expected IsGroupEvent to return false")
	}

	// Test group created event
	groupEvent := CreateGroupCreatedEvent(workflowID, data, nil)
	
	if groupEvent.GetEventType() != "group.created" {
		t.Errorf("Expected event type 'group.created', got '%s'", groupEvent.GetEventType())
	}
	
	if !groupEvent.IsGroupEvent() {
		t.Error("Expected IsGroupEvent to return true")
	}
	
	if groupEvent.IsNodeEvent() {
		t.Error("Expected IsNodeEvent to return false")
	}
}

func TestEventTypeGuards(t *testing.T) {
	tests := []struct {
		eventType string
		isExecution bool
		isWorkflow  bool
		isCRDT     bool
		isControl  bool
		isNode     bool
		isGroup    bool
	}{
		{"node.executing", true, false, false, false, true, false},
		{"execution.started", true, false, false, false, false, false},
		{"workflow.created", false, true, false, false, false, false},
		{"node.added", false, false, true, false, true, false},
		{"group.created", false, false, true, false, false, true},
		{"connection.added", false, false, true, false, false, false},
		{"subscribe", false, false, false, true, false, false},
		{"ping", false, false, false, true, false, false},
	}

	for _, test := range tests {
		t.Run(test.eventType, func(t *testing.T) {
			if IsExecutionEvent(test.eventType) != test.isExecution {
				t.Errorf("IsExecutionEvent(%s) = %v, expected %v", 
					test.eventType, IsExecutionEvent(test.eventType), test.isExecution)
			}
			if IsWorkflowEvent(test.eventType) != test.isWorkflow {
				t.Errorf("IsWorkflowEvent(%s) = %v, expected %v", 
					test.eventType, IsWorkflowEvent(test.eventType), test.isWorkflow)
			}
			if IsCRDTEvent(test.eventType) != test.isCRDT {
				t.Errorf("IsCRDTEvent(%s) = %v, expected %v", 
					test.eventType, IsCRDTEvent(test.eventType), test.isCRDT)
			}
			if IsControlEvent(test.eventType) != test.isControl {
				t.Errorf("IsControlEvent(%s) = %v, expected %v", 
					test.eventType, IsControlEvent(test.eventType), test.isControl)
			}
			if IsNodeEvent(test.eventType) != test.isNode {
				t.Errorf("IsNodeEvent(%s) = %v, expected %v", 
					test.eventType, IsNodeEvent(test.eventType), test.isNode)
			}
			if IsGroupEvent(test.eventType) != test.isGroup {
				t.Errorf("IsGroupEvent(%s) = %v, expected %v", 
					test.eventType, IsGroupEvent(test.eventType), test.isGroup)
			}
		})
	}
}