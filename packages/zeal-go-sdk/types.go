package zeal

import (
	"time"
)

// Core configuration
type ClientConfig struct {
	BaseURL           string        `json:"baseUrl"`
	DefaultTimeout    time.Duration `json:"defaultTimeout"`
	VerifyTLS         bool          `json:"verifyTls"`
	UserAgent         string        `json:"userAgent"`
	MaxRetries        int           `json:"maxRetries"`
	RetryBackoffMs    int           `json:"retryBackoffMs"`
	EnableCompression bool          `json:"enableCompression"`
}

// Default configuration
func DefaultClientConfig() ClientConfig {
	return ClientConfig{
		BaseURL:           "http://localhost:3000",
		DefaultTimeout:    30 * time.Second,
		VerifyTLS:         true,
		UserAgent:         "zeal-go-sdk/1.0.0",
		MaxRetries:        3,
		RetryBackoffMs:    1000,
		EnableCompression: true,
	}
}

// Position represents x,y coordinates
type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// NodePort represents a node port connection
type NodePort struct {
	NodeID string `json:"nodeId"`
	PortID string `json:"portId"`
}

// Health check response
type HealthCheckResponse struct {
	Status   string            `json:"status"`
	Version  string            `json:"version"`
	Services map[string]string `json:"services"`
}

// === Orchestrator Types ===

// Workflow types
type CreateWorkflowRequest struct {
	Name        string                 `json:"name"`
	Description *string                `json:"description,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

type CreateWorkflowResponse struct {
	WorkflowID string                 `json:"workflowId"`
	Name       string                 `json:"name"`
	Version    int                    `json:"version"`
	GraphID    string                 `json:"graphId"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

type ListWorkflowsParams struct {
	Limit  *int `json:"limit,omitempty"`
	Offset *int `json:"offset,omitempty"`
}

type ListWorkflowsResponse struct {
	Workflows []interface{} `json:"workflows"`
	Total     int           `json:"total"`
	Limit     int           `json:"limit"`
	Offset    int           `json:"offset"`
}

type WorkflowState struct {
	WorkflowID  string      `json:"workflowId"`
	GraphID     string      `json:"graphId"`
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Version     int         `json:"version"`
	State       interface{} `json:"state"`
	Metadata    interface{} `json:"metadata"`
}

// Node types
type AddNodeRequest struct {
	WorkflowID   string                 `json:"workflowId"`
	GraphID      *string                `json:"graphId,omitempty"`
	TemplateID   string                 `json:"templateId"`
	Position     Position               `json:"position"`
	Properties   map[string]interface{} `json:"properties,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
	InstanceName *string                `json:"instanceName,omitempty"`
}

type AddNodeResponse struct {
	NodeID string      `json:"nodeId"`
	Node   interface{} `json:"node"`
}

type UpdateNodeRequest struct {
	WorkflowID string                 `json:"workflowId"`
	GraphID    *string                `json:"graphId,omitempty"`
	Properties map[string]interface{} `json:"properties,omitempty"`
	Position   *Position              `json:"position,omitempty"`
}

type UpdateNodeResponse struct {
	Success bool `json:"success"`
}

type DeleteNodeResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// Connection types
type ConnectNodesRequest struct {
	WorkflowID string   `json:"workflowId"`
	GraphID    *string  `json:"graphId,omitempty"`
	Source     NodePort `json:"source"`
	Target     NodePort `json:"target"`
}

type ConnectionResponse struct {
	ConnectionID string      `json:"connectionId"`
	Connection   interface{} `json:"connection"`
}

type RemoveConnectionRequest struct {
	WorkflowID   string  `json:"workflowId"`
	GraphID      *string `json:"graphId,omitempty"`
	ConnectionID string  `json:"connectionId"`
}

type RemoveConnectionResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// Group types
type CreateGroupRequest struct {
	WorkflowID  string   `json:"workflowId"`
	GraphID     *string  `json:"graphId,omitempty"`
	Title       string   `json:"title"`
	NodeIDs     []string `json:"nodeIds"`
	Color       *string  `json:"color,omitempty"`
	Description *string  `json:"description,omitempty"`
}

type CreateGroupResponse struct {
	Success bool        `json:"success"`
	GroupID string      `json:"groupId"`
	Group   interface{} `json:"group"`
}

type UpdateGroupRequest struct {
	WorkflowID  string   `json:"workflowId"`
	GraphID     *string  `json:"graphId,omitempty"`
	GroupID     string   `json:"groupId"`
	Title       *string  `json:"title,omitempty"`
	NodeIDs     []string `json:"nodeIds,omitempty"`
	Color       *string  `json:"color,omitempty"`
	Description *string  `json:"description,omitempty"`
}

type UpdateGroupResponse struct {
	Success bool        `json:"success"`
	Group   interface{} `json:"group"`
}

type RemoveGroupRequest struct {
	WorkflowID string  `json:"workflowId"`
	GraphID    *string `json:"graphId,omitempty"`
	GroupID    string  `json:"groupId"`
}

type RemoveGroupResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// === Template Types ===

type NodeTemplate struct {
	ID           string                        `json:"id"`
	Type         string                        `json:"type"`
	Title        string                        `json:"title"`
	Subtitle     *string                       `json:"subtitle,omitempty"`
	Category     string                        `json:"category"`
	Subcategory  *string                       `json:"subcategory,omitempty"`
	Description  string                        `json:"description"`
	Icon         string                        `json:"icon"`
	Variant      *string                       `json:"variant,omitempty"`
	Shape        *string                       `json:"shape,omitempty"`
	Size         *string                       `json:"size,omitempty"`
	Ports        []Port                        `json:"ports"`
	Properties   map[string]PropertyDefinition `json:"properties,omitempty"`
	Runtime      *RuntimeRequirements          `json:"runtime,omitempty"`
}

type Port struct {
	ID       string  `json:"id"`
	Label    string  `json:"label"`
	Type     string  `json:"type"`
	Position string  `json:"position"`
	DataType *string `json:"dataType,omitempty"`
	Required *bool   `json:"required,omitempty"`
	Multiple *bool   `json:"multiple,omitempty"`
}

type PropertyDefinition struct {
	Type         string                 `json:"type"`
	Label        *string                `json:"label,omitempty"`
	Description  *string                `json:"description,omitempty"`
	DefaultValue interface{}            `json:"defaultValue,omitempty"`
	Options      []interface{}          `json:"options,omitempty"`
	Validation   *PropertyValidation    `json:"validation,omitempty"`
}

type PropertyValidation struct {
	Required   *bool    `json:"required,omitempty"`
	Min        *float64 `json:"min,omitempty"`
	Max        *float64 `json:"max,omitempty"`
	MinLength  *int     `json:"minLength,omitempty"`
	MaxLength  *int     `json:"maxLength,omitempty"`
	Pattern    *string  `json:"pattern,omitempty"`
	CustomRule *string  `json:"customRule,omitempty"`
}

type RuntimeRequirements struct {
	Memory       *string           `json:"memory,omitempty"`
	CPU          *string           `json:"cpu,omitempty"`
	GPU          *bool             `json:"gpu,omitempty"`
	Dependencies []string          `json:"dependencies,omitempty"`
	Environment  map[string]string `json:"environment,omitempty"`
	Timeout      *int              `json:"timeout,omitempty"`
}

type RegisterTemplatesRequest struct {
	Namespace string         `json:"namespace"`
	Templates []NodeTemplate `json:"templates"`
}

type RegisterTemplatesResponse struct {
	Success           bool     `json:"success"`
	RegisteredCount   int      `json:"registeredCount"`
	UpdatedCount      int      `json:"updatedCount"`
	RegisteredIDs     []string `json:"registeredIds"`
	UpdatedIDs        []string `json:"updatedIds"`
}

type ListTemplatesResponse struct {
	Templates []NodeTemplate `json:"templates"`
	Total     int            `json:"total"`
}

type UpdateTemplateResponse struct {
	Success  bool         `json:"success"`
	Template NodeTemplate `json:"template"`
}

type DeleteTemplateResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// === Trace Types ===

type CreateTraceSessionRequest struct {
	WorkflowID        string                 `json:"workflowId"`
	WorkflowVersionID *string                `json:"workflowVersionId,omitempty"`
	ExecutionID       string                 `json:"executionId"`
	Metadata          map[string]interface{} `json:"metadata,omitempty"`
}

type CreateTraceSessionResponse struct {
	SessionID   string    `json:"sessionId"`
	WorkflowID  string    `json:"workflowId"`
	ExecutionID string    `json:"executionId"`
	CreatedAt   time.Time `json:"createdAt"`
}

type TraceEvent struct {
	Timestamp int64                  `json:"timestamp"`
	NodeID    string                 `json:"nodeId"`
	PortID    *string                `json:"portId,omitempty"`
	EventType string                 `json:"eventType"`
	Data      TraceData              `json:"data"`
	Duration  *int64                 `json:"duration,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
	Error     *TraceError            `json:"error,omitempty"`
}

type TraceData struct {
	Size     int         `json:"size"`
	DataType string      `json:"dataType"`
	Preview  interface{} `json:"preview,omitempty"`
	FullData interface{} `json:"fullData,omitempty"`
}

type TraceError struct {
	Message string  `json:"message"`
	Code    *string `json:"code,omitempty"`
	Stack   *string `json:"stack,omitempty"`
}

type SubmitEventsResponse struct {
	Success          bool `json:"success"`
	EventsProcessed  int  `json:"eventsProcessed"`
}

type CompleteSessionRequest struct {
	Status  string          `json:"status"`
	Summary *SessionSummary `json:"summary,omitempty"`
	Error   *SessionError   `json:"error,omitempty"`
}

type SessionSummary struct {
	TotalNodes        int   `json:"totalNodes"`
	SuccessfulNodes   int   `json:"successfulNodes"`
	FailedNodes       int   `json:"failedNodes"`
	TotalDuration     int64 `json:"totalDuration"`
	TotalDataProcessed int64 `json:"totalDataProcessed"`
}

type SessionError struct {
	Message string  `json:"message"`
	NodeID  *string `json:"nodeId,omitempty"`
	Stack   *string `json:"stack,omitempty"`
}

type CompleteSessionResponse struct {
	Success   bool   `json:"success"`
	SessionID string `json:"sessionId"`
	Status    string `json:"status"`
}

// === Webhook Types ===

type WebhookSubscription struct {
	ID            string            `json:"id"`
	URL           string            `json:"url"`
	Events        []string          `json:"events"`
	Headers       map[string]string `json:"headers,omitempty"`
	Secret        *string           `json:"secret,omitempty"`
	MaxRetries    int               `json:"maxRetries"`
	RetryInterval int               `json:"retryInterval"`
	IsActive      bool              `json:"isActive"`
	CreatedAt     time.Time         `json:"createdAt"`
}

type CreateWebhookRequest struct {
	URL           string            `json:"url"`
	Events        []string          `json:"events"`
	Headers       map[string]string `json:"headers,omitempty"`
	Secret        *string           `json:"secret,omitempty"`
	MaxRetries    *int              `json:"maxRetries,omitempty"`
	RetryInterval *int              `json:"retryInterval,omitempty"`
}

type CreateWebhookResponse struct {
	Success      bool                `json:"success"`
	Subscription WebhookSubscription `json:"subscription"`
}

type ListWebhooksResponse struct {
	Subscriptions []WebhookSubscription `json:"subscriptions"`
	Total         int                   `json:"total"`
}

type UpdateWebhookRequest struct {
	URL           *string            `json:"url,omitempty"`
	Events        []string           `json:"events,omitempty"`
	Headers       *map[string]string `json:"headers,omitempty"`
	Secret        *string            `json:"secret,omitempty"`
	MaxRetries    *int               `json:"maxRetries,omitempty"`
	RetryInterval *int               `json:"retryInterval,omitempty"`
	IsActive      *bool              `json:"isActive,omitempty"`
}

type UpdateWebhookResponse struct {
	Success      bool                `json:"success"`
	Subscription WebhookSubscription `json:"subscription"`
}

type DeleteWebhookResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type TestWebhookResponse struct {
	Success        bool    `json:"success"`
	StatusCode     int     `json:"statusCode"`
	ResponseTimeMs int64   `json:"responseTimeMs"`
	Error          *string `json:"error,omitempty"`
}