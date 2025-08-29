package zeal

import (
	"encoding/json"
	"fmt"
	"time"
)

// Base event structure for all ZIP events
type ZipEventBase struct {
	ID         string                 `json:"id"`
	Timestamp  string                 `json:"timestamp"`
	WorkflowID string                 `json:"workflowId"`
	GraphID    *string                `json:"graphId,omitempty"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

// Node execution events
type NodeExecutingEvent struct {
	ZipEventBase
	Type             string   `json:"type"` // Always "node.executing"
	NodeID           string   `json:"nodeId"`
	InputConnections []string `json:"inputConnections"`
}

type NodeCompletedEvent struct {
	ZipEventBase
	Type              string   `json:"type"` // Always "node.completed"
	NodeID            string   `json:"nodeId"`
	OutputConnections []string `json:"outputConnections"`
	Duration          *int64   `json:"duration,omitempty"`
	OutputSize        *int64   `json:"outputSize,omitempty"`
}

type NodeFailedEvent struct {
	ZipEventBase
	Type              string     `json:"type"` // Always "node.failed"
	NodeID            string     `json:"nodeId"`
	OutputConnections []string   `json:"outputConnections"`
	Error             *NodeError `json:"error,omitempty"`
}

type NodeWarningEvent struct {
	ZipEventBase
	Type              string       `json:"type"` // Always "node.warning"
	NodeID            string       `json:"nodeId"`
	OutputConnections []string     `json:"outputConnections"`
	Warning           *NodeWarning `json:"warning,omitempty"`
}

type NodeError struct {
	Message string  `json:"message"`
	Code    *string `json:"code,omitempty"`
	Stack   *string `json:"stack,omitempty"`
}

type NodeWarning struct {
	Message string  `json:"message"`
	Code    *string `json:"code,omitempty"`
}

// Workflow execution events
type ExecutionStartedEvent struct {
	ZipEventBase
	Type         string             `json:"type"` // Always "execution.started"
	SessionID    string             `json:"sessionId"`
	WorkflowName string             `json:"workflowName"`
	Trigger      *ExecutionTrigger  `json:"trigger,omitempty"`
}

type ExecutionCompletedEvent struct {
	ZipEventBase
	Type           string             `json:"type"` // Always "execution.completed"
	SessionID      string             `json:"sessionId"`
	Duration       int64              `json:"duration"`
	NodesExecuted  int                `json:"nodesExecuted"`
	Summary        *ExecutionSummary  `json:"summary,omitempty"`
}

type ExecutionFailedEvent struct {
	ZipEventBase
	Type      string           `json:"type"` // Always "execution.failed"
	SessionID string           `json:"sessionId"`
	Duration  *int64           `json:"duration,omitempty"`
	Error     *ExecutionError  `json:"error,omitempty"`
}

type ExecutionTrigger struct {
	Type   string  `json:"type"`
	Source *string `json:"source,omitempty"`
}

type ExecutionSummary struct {
	SuccessCount int `json:"successCount"`
	ErrorCount   int `json:"errorCount"`
	WarningCount int `json:"warningCount"`
}

type ExecutionError struct {
	Message string  `json:"message"`
	Code    *string `json:"code,omitempty"`
	NodeID  *string `json:"nodeId,omitempty"`
}

// Workflow lifecycle events
type WorkflowCreatedEvent struct {
	ZipEventBase
	Type         string  `json:"type"` // Always "workflow.created"
	WorkflowName string  `json:"workflowName"`
	UserID       *string `json:"userId,omitempty"`
}

type WorkflowUpdatedEvent struct {
	ZipEventBase
	Type string                 `json:"type"` // Always "workflow.updated"
	Data map[string]interface{} `json:"data,omitempty"`
}

type WorkflowDeletedEvent struct {
	ZipEventBase
	Type         string  `json:"type"` // Always "workflow.deleted"
	WorkflowName *string `json:"workflowName,omitempty"`
}

// CRDT events for real-time collaboration
type NodeAddedEvent struct {
	ZipEventBase
	Type   string                 `json:"type"` // Always "node.added"
	NodeID string                 `json:"nodeId"`
	Data   map[string]interface{} `json:"data"`
}

type NodeUpdatedEvent struct {
	ZipEventBase
	Type   string                 `json:"type"` // Always "node.updated"
	NodeID string                 `json:"nodeId"`
	Data   map[string]interface{} `json:"data"`
}

type NodeDeletedEvent struct {
	ZipEventBase
	Type   string `json:"type"` // Always "node.deleted"
	NodeID string `json:"nodeId"`
}

type ConnectionAddedEvent struct {
	ZipEventBase
	Type string                 `json:"type"` // Always "connection.added"
	Data map[string]interface{} `json:"data"`
}

type ConnectionDeletedEvent struct {
	ZipEventBase
	Type string                 `json:"type"` // Always "connection.deleted"
	Data map[string]interface{} `json:"data"`
}

type GroupCreatedEvent struct {
	ZipEventBase
	Type string                 `json:"type"` // Always "group.created"
	Data map[string]interface{} `json:"data"`
}

type GroupUpdatedEvent struct {
	ZipEventBase
	Type string                 `json:"type"` // Always "group.updated"
	Data map[string]interface{} `json:"data"`
}

type GroupDeletedEvent struct {
	ZipEventBase
	Type string                 `json:"type"` // Always "group.deleted"
	Data map[string]interface{} `json:"data"`
}

type TemplateRegisteredEvent struct {
	ZipEventBase
	Type string                 `json:"type"` // Always "template.registered"
	Data map[string]interface{} `json:"data"`
}

type TraceEventData struct {
	ZipEventBase
	Type      string                 `json:"type"` // Always "trace.event"
	SessionID string                 `json:"sessionId"`
	NodeID    string                 `json:"nodeId"`
	Data      map[string]interface{} `json:"data"`
}

// WebSocket control events
type SubscribeEvent struct {
	Type       string  `json:"type"` // Always "subscribe"
	WorkflowID string  `json:"workflowId"`
	GraphID    *string `json:"graphId,omitempty"`
}

type UnsubscribeEvent struct {
	Type       string  `json:"type"` // Always "unsubscribe"
	WorkflowID *string `json:"workflowId,omitempty"`
}

type PingEvent struct {
	Type      string `json:"type"` // Always "ping"
	Timestamp int64  `json:"timestamp"`
}

type PongEvent struct {
	Type      string `json:"type"` // Always "pong"
	Timestamp int64  `json:"timestamp"`
}

// Connection state event for real-time visualization
type ConnectionStateEvent struct {
	ZipEventBase
	Type           string `json:"type"` // Always "connection.state"
	ConnectionID   string `json:"connectionId"`
	State          string `json:"state"` // idle, active, success, error
	SourceNodeID   string `json:"sourceNodeId"`
	TargetNodeID   string `json:"targetNodeId"`
}

// Union types using interfaces
type ZipExecutionEvent interface {
	GetEventType() string
	GetWorkflowID() string
	IsNodeEvent() bool
	IsExecutionEvent() bool
}

type ZipWorkflowEvent interface {
	GetEventType() string
	GetWorkflowID() string
}

type ZipCRDTEvent interface {
	GetEventType() string
	GetWorkflowID() string
	IsNodeEvent() bool
	IsConnectionEvent() bool
	IsGroupEvent() bool
	IsTemplateEvent() bool
	IsTraceEvent() bool
}

type ZipControlEvent interface {
	GetEventType() string
}

type ZipWebSocketEvent interface {
	GetEventType() string
}

type ZipWebhookEvent interface {
	GetEventType() string
	GetWorkflowID() string
}

// Implement interfaces for execution events
func (e *NodeExecutingEvent) GetEventType() string     { return e.Type }
func (e *NodeExecutingEvent) GetWorkflowID() string    { return e.WorkflowID }
func (e *NodeExecutingEvent) IsNodeEvent() bool        { return true }
func (e *NodeExecutingEvent) IsExecutionEvent() bool   { return false }

func (e *NodeCompletedEvent) GetEventType() string     { return e.Type }
func (e *NodeCompletedEvent) GetWorkflowID() string    { return e.WorkflowID }
func (e *NodeCompletedEvent) IsNodeEvent() bool        { return true }
func (e *NodeCompletedEvent) IsExecutionEvent() bool   { return false }

func (e *NodeFailedEvent) GetEventType() string        { return e.Type }
func (e *NodeFailedEvent) GetWorkflowID() string       { return e.WorkflowID }
func (e *NodeFailedEvent) IsNodeEvent() bool           { return true }
func (e *NodeFailedEvent) IsExecutionEvent() bool      { return false }

func (e *NodeWarningEvent) GetEventType() string       { return e.Type }
func (e *NodeWarningEvent) GetWorkflowID() string      { return e.WorkflowID }
func (e *NodeWarningEvent) IsNodeEvent() bool          { return true }
func (e *NodeWarningEvent) IsExecutionEvent() bool     { return false }

func (e *ExecutionStartedEvent) GetEventType() string   { return e.Type }
func (e *ExecutionStartedEvent) GetWorkflowID() string  { return e.WorkflowID }
func (e *ExecutionStartedEvent) IsNodeEvent() bool      { return false }
func (e *ExecutionStartedEvent) IsExecutionEvent() bool { return true }

func (e *ExecutionCompletedEvent) GetEventType() string   { return e.Type }
func (e *ExecutionCompletedEvent) GetWorkflowID() string  { return e.WorkflowID }
func (e *ExecutionCompletedEvent) IsNodeEvent() bool      { return false }
func (e *ExecutionCompletedEvent) IsExecutionEvent() bool { return true }

func (e *ExecutionFailedEvent) GetEventType() string   { return e.Type }
func (e *ExecutionFailedEvent) GetWorkflowID() string  { return e.WorkflowID }
func (e *ExecutionFailedEvent) IsNodeEvent() bool      { return false }
func (e *ExecutionFailedEvent) IsExecutionEvent() bool { return true }

// Implement interfaces for workflow events
func (e *WorkflowCreatedEvent) GetEventType() string  { return e.Type }
func (e *WorkflowCreatedEvent) GetWorkflowID() string { return e.WorkflowID }

func (e *WorkflowUpdatedEvent) GetEventType() string  { return e.Type }
func (e *WorkflowUpdatedEvent) GetWorkflowID() string { return e.WorkflowID }

func (e *WorkflowDeletedEvent) GetEventType() string  { return e.Type }
func (e *WorkflowDeletedEvent) GetWorkflowID() string { return e.WorkflowID }

// Implement interfaces for CRDT events
func (e *NodeAddedEvent) GetEventType() string      { return e.Type }
func (e *NodeAddedEvent) GetWorkflowID() string     { return e.WorkflowID }
func (e *NodeAddedEvent) IsNodeEvent() bool         { return true }
func (e *NodeAddedEvent) IsConnectionEvent() bool   { return false }
func (e *NodeAddedEvent) IsGroupEvent() bool        { return false }
func (e *NodeAddedEvent) IsTemplateEvent() bool     { return false }
func (e *NodeAddedEvent) IsTraceEvent() bool        { return false }

func (e *NodeUpdatedEvent) GetEventType() string    { return e.Type }
func (e *NodeUpdatedEvent) GetWorkflowID() string   { return e.WorkflowID }
func (e *NodeUpdatedEvent) IsNodeEvent() bool       { return true }
func (e *NodeUpdatedEvent) IsConnectionEvent() bool { return false }
func (e *NodeUpdatedEvent) IsGroupEvent() bool      { return false }
func (e *NodeUpdatedEvent) IsTemplateEvent() bool   { return false }
func (e *NodeUpdatedEvent) IsTraceEvent() bool      { return false }

func (e *NodeDeletedEvent) GetEventType() string    { return e.Type }
func (e *NodeDeletedEvent) GetWorkflowID() string   { return e.WorkflowID }
func (e *NodeDeletedEvent) IsNodeEvent() bool       { return true }
func (e *NodeDeletedEvent) IsConnectionEvent() bool { return false }
func (e *NodeDeletedEvent) IsGroupEvent() bool      { return false }
func (e *NodeDeletedEvent) IsTemplateEvent() bool   { return false }
func (e *NodeDeletedEvent) IsTraceEvent() bool      { return false }

func (e *ConnectionAddedEvent) GetEventType() string    { return e.Type }
func (e *ConnectionAddedEvent) GetWorkflowID() string   { return e.WorkflowID }
func (e *ConnectionAddedEvent) IsNodeEvent() bool       { return false }
func (e *ConnectionAddedEvent) IsConnectionEvent() bool { return true }
func (e *ConnectionAddedEvent) IsGroupEvent() bool      { return false }
func (e *ConnectionAddedEvent) IsTemplateEvent() bool   { return false }
func (e *ConnectionAddedEvent) IsTraceEvent() bool      { return false }

func (e *ConnectionDeletedEvent) GetEventType() string    { return e.Type }
func (e *ConnectionDeletedEvent) GetWorkflowID() string   { return e.WorkflowID }
func (e *ConnectionDeletedEvent) IsNodeEvent() bool       { return false }
func (e *ConnectionDeletedEvent) IsConnectionEvent() bool { return true }
func (e *ConnectionDeletedEvent) IsGroupEvent() bool      { return false }
func (e *ConnectionDeletedEvent) IsTemplateEvent() bool   { return false }
func (e *ConnectionDeletedEvent) IsTraceEvent() bool      { return false }

func (e *GroupCreatedEvent) GetEventType() string    { return e.Type }
func (e *GroupCreatedEvent) GetWorkflowID() string   { return e.WorkflowID }
func (e *GroupCreatedEvent) IsNodeEvent() bool       { return false }
func (e *GroupCreatedEvent) IsConnectionEvent() bool { return false }
func (e *GroupCreatedEvent) IsGroupEvent() bool      { return true }
func (e *GroupCreatedEvent) IsTemplateEvent() bool   { return false }
func (e *GroupCreatedEvent) IsTraceEvent() bool      { return false }

func (e *GroupUpdatedEvent) GetEventType() string    { return e.Type }
func (e *GroupUpdatedEvent) GetWorkflowID() string   { return e.WorkflowID }
func (e *GroupUpdatedEvent) IsNodeEvent() bool       { return false }
func (e *GroupUpdatedEvent) IsConnectionEvent() bool { return false }
func (e *GroupUpdatedEvent) IsGroupEvent() bool      { return true }
func (e *GroupUpdatedEvent) IsTemplateEvent() bool   { return false }
func (e *GroupUpdatedEvent) IsTraceEvent() bool      { return false }

func (e *GroupDeletedEvent) GetEventType() string    { return e.Type }
func (e *GroupDeletedEvent) GetWorkflowID() string   { return e.WorkflowID }
func (e *GroupDeletedEvent) IsNodeEvent() bool       { return false }
func (e *GroupDeletedEvent) IsConnectionEvent() bool { return false }
func (e *GroupDeletedEvent) IsGroupEvent() bool      { return true }
func (e *GroupDeletedEvent) IsTemplateEvent() bool   { return false }
func (e *GroupDeletedEvent) IsTraceEvent() bool      { return false }

func (e *TemplateRegisteredEvent) GetEventType() string    { return e.Type }
func (e *TemplateRegisteredEvent) GetWorkflowID() string   { return e.WorkflowID }
func (e *TemplateRegisteredEvent) IsNodeEvent() bool       { return false }
func (e *TemplateRegisteredEvent) IsConnectionEvent() bool { return false }
func (e *TemplateRegisteredEvent) IsGroupEvent() bool      { return false }
func (e *TemplateRegisteredEvent) IsTemplateEvent() bool   { return true }
func (e *TemplateRegisteredEvent) IsTraceEvent() bool      { return false }

func (e *TraceEventData) GetEventType() string    { return e.Type }
func (e *TraceEventData) GetWorkflowID() string   { return e.WorkflowID }
func (e *TraceEventData) IsNodeEvent() bool       { return false }
func (e *TraceEventData) IsConnectionEvent() bool { return false }
func (e *TraceEventData) IsGroupEvent() bool      { return false }
func (e *TraceEventData) IsTemplateEvent() bool   { return false }
func (e *TraceEventData) IsTraceEvent() bool      { return true }

// Implement interfaces for control events
func (e *SubscribeEvent) GetEventType() string   { return e.Type }
func (e *UnsubscribeEvent) GetEventType() string { return e.Type }
func (e *PingEvent) GetEventType() string        { return e.Type }
func (e *PongEvent) GetEventType() string        { return e.Type }

// Connection state event
func (e *ConnectionStateEvent) GetEventType() string { return e.Type }

// Type guards
func IsExecutionEvent(eventType string) bool {
	switch eventType {
	case "node.executing", "node.completed", "node.failed", "node.warning",
		 "execution.started", "execution.completed", "execution.failed":
		return true
	}
	return false
}

func IsWorkflowEvent(eventType string) bool {
	switch eventType {
	case "workflow.created", "workflow.updated", "workflow.deleted":
		return true
	}
	return false
}

func IsCRDTEvent(eventType string) bool {
	switch eventType {
	case "node.added", "node.updated", "node.deleted",
		 "connection.added", "connection.deleted",
		 "group.created", "group.updated", "group.deleted",
		 "template.registered", "trace.event":
		return true
	}
	return false
}

func IsControlEvent(eventType string) bool {
	switch eventType {
	case "subscribe", "unsubscribe", "ping", "pong":
		return true
	}
	return false
}

func IsNodeEvent(eventType string) bool {
	switch eventType {
	case "node.executing", "node.completed", "node.failed", "node.warning",
		 "node.added", "node.updated", "node.deleted":
		return true
	}
	return false
}

func IsGroupEvent(eventType string) bool {
	switch eventType {
	case "group.created", "group.updated", "group.deleted":
		return true
	}
	return false
}

func IsConnectionCRDTEvent(eventType string) bool {
	switch eventType {
	case "connection.added", "connection.deleted":
		return true
	}
	return false
}

func IsTemplateEvent(eventType string) bool {
	switch eventType {
	case "template.registered":
		return true
	}
	return false
}

// Event creation helpers
func generateEventID() string {
	timestamp := time.Now().UnixMilli()
	// Simple UUID-like generation for demo purposes
	return fmt.Sprintf("evt_%d_%s", timestamp, generateRandomString(11))
}

func generateRandomString(length int) string {
	// Simple random string generation
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	result := make([]byte, length)
	for i := range result {
		result[i] = charset[time.Now().UnixNano()%int64(len(charset))]
	}
	return string(result)
}

func currentTimestamp() string {
	return time.Now().UTC().Format(time.RFC3339)
}

// CRDT Event creation helpers
func CreateNodeAddedEvent(workflowID, nodeID string, data map[string]interface{}, graphID *string) *NodeAddedEvent {
	return &NodeAddedEvent{
		ZipEventBase: ZipEventBase{
			ID:         generateEventID(),
			Timestamp:  currentTimestamp(),
			WorkflowID: workflowID,
			GraphID:    graphID,
		},
		Type:   "node.added",
		NodeID: nodeID,
		Data:   data,
	}
}

func CreateNodeUpdatedEvent(workflowID, nodeID string, data map[string]interface{}, graphID *string) *NodeUpdatedEvent {
	return &NodeUpdatedEvent{
		ZipEventBase: ZipEventBase{
			ID:         generateEventID(),
			Timestamp:  currentTimestamp(),
			WorkflowID: workflowID,
			GraphID:    graphID,
		},
		Type:   "node.updated",
		NodeID: nodeID,
		Data:   data,
	}
}

func CreateNodeDeletedEvent(workflowID, nodeID string, graphID *string) *NodeDeletedEvent {
	return &NodeDeletedEvent{
		ZipEventBase: ZipEventBase{
			ID:         generateEventID(),
			Timestamp:  currentTimestamp(),
			WorkflowID: workflowID,
			GraphID:    graphID,
		},
		Type:   "node.deleted",
		NodeID: nodeID,
	}
}

func CreateGroupCreatedEvent(workflowID string, data map[string]interface{}, graphID *string) *GroupCreatedEvent {
	return &GroupCreatedEvent{
		ZipEventBase: ZipEventBase{
			ID:         generateEventID(),
			Timestamp:  currentTimestamp(),
			WorkflowID: workflowID,
			GraphID:    graphID,
		},
		Type: "group.created",
		Data: data,
	}
}

func CreateGroupUpdatedEvent(workflowID string, data map[string]interface{}, graphID *string) *GroupUpdatedEvent {
	return &GroupUpdatedEvent{
		ZipEventBase: ZipEventBase{
			ID:         generateEventID(),
			Timestamp:  currentTimestamp(),
			WorkflowID: workflowID,
			GraphID:    graphID,
		},
		Type: "group.updated",
		Data: data,
	}
}

func CreateGroupDeletedEvent(workflowID string, data map[string]interface{}, graphID *string) *GroupDeletedEvent {
	return &GroupDeletedEvent{
		ZipEventBase: ZipEventBase{
			ID:         generateEventID(),
			Timestamp:  currentTimestamp(),
			WorkflowID: workflowID,
			GraphID:    graphID,
		},
		Type: "group.deleted",
		Data: data,
	}
}

func CreateConnectionAddedEvent(workflowID string, data map[string]interface{}, graphID *string) *ConnectionAddedEvent {
	return &ConnectionAddedEvent{
		ZipEventBase: ZipEventBase{
			ID:         generateEventID(),
			Timestamp:  currentTimestamp(),
			WorkflowID: workflowID,
			GraphID:    graphID,
		},
		Type: "connection.added",
		Data: data,
	}
}

func CreateConnectionDeletedEvent(workflowID string, data map[string]interface{}, graphID *string) *ConnectionDeletedEvent {
	return &ConnectionDeletedEvent{
		ZipEventBase: ZipEventBase{
			ID:         generateEventID(),
			Timestamp:  currentTimestamp(),
			WorkflowID: workflowID,
			GraphID:    graphID,
		},
		Type: "connection.deleted",
		Data: data,
	}
}

// Event parsing from JSON
func ParseZipWebhookEvent(data []byte) (ZipWebhookEvent, error) {
	var eventType struct {
		Type string `json:"type"`
	}
	
	if err := json.Unmarshal(data, &eventType); err != nil {
		return nil, fmt.Errorf("failed to parse event type: %w", err)
	}
	
	switch eventType.Type {
	// Execution events
	case "node.executing":
		var event NodeExecutingEvent
		err := json.Unmarshal(data, &event)
		return &event, err
	case "node.completed":
		var event NodeCompletedEvent
		err := json.Unmarshal(data, &event)
		return &event, err
	case "node.failed":
		var event NodeFailedEvent
		err := json.Unmarshal(data, &event)
		return &event, err
	case "node.warning":
		var event NodeWarningEvent
		err := json.Unmarshal(data, &event)
		return &event, err
	case "execution.started":
		var event ExecutionStartedEvent
		err := json.Unmarshal(data, &event)
		return &event, err
	case "execution.completed":
		var event ExecutionCompletedEvent
		err := json.Unmarshal(data, &event)
		return &event, err
	case "execution.failed":
		var event ExecutionFailedEvent
		err := json.Unmarshal(data, &event)
		return &event, err
	// Workflow events
	case "workflow.created":
		var event WorkflowCreatedEvent
		err := json.Unmarshal(data, &event)
		return &event, err
	case "workflow.updated":
		var event WorkflowUpdatedEvent
		err := json.Unmarshal(data, &event)
		return &event, err
	case "workflow.deleted":
		var event WorkflowDeletedEvent
		err := json.Unmarshal(data, &event)
		return &event, err
	// CRDT events
	case "node.added":
		var event NodeAddedEvent
		err := json.Unmarshal(data, &event)
		return &event, err
	case "node.updated":
		var event NodeUpdatedEvent
		err := json.Unmarshal(data, &event)
		return &event, err
	case "node.deleted":
		var event NodeDeletedEvent
		err := json.Unmarshal(data, &event)
		return &event, err
	case "connection.added":
		var event ConnectionAddedEvent
		err := json.Unmarshal(data, &event)
		return &event, err
	case "connection.deleted":
		var event ConnectionDeletedEvent
		err := json.Unmarshal(data, &event)
		return &event, err
	case "group.created":
		var event GroupCreatedEvent
		err := json.Unmarshal(data, &event)
		return &event, err
	case "group.updated":
		var event GroupUpdatedEvent
		err := json.Unmarshal(data, &event)
		return &event, err
	case "group.deleted":
		var event GroupDeletedEvent
		err := json.Unmarshal(data, &event)
		return &event, err
	case "template.registered":
		var event TemplateRegisteredEvent
		err := json.Unmarshal(data, &event)
		return &event, err
	case "trace.event":
		var event TraceEventData
		err := json.Unmarshal(data, &event)
		return &event, err
	default:
		return nil, fmt.Errorf("unknown event type: %s", eventType.Type)
	}
}