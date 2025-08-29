package zeal

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	// SDK version
	SDKVersion = "1.0.0"
	// Application ID
	ApplicationID = "zeal-go-sdk"
)

// Client represents the main Zeal SDK client
type Client struct {
	config     ClientConfig
	httpClient *http.Client
	orchestrator *OrchestratorAPI
	templates    *TemplatesAPI
	traces       *TracesAPI
	webhooks     *WebhooksAPI
}

// NewClient creates a new Zeal client with the given configuration
func NewClient(config ClientConfig) (*Client, error) {
	if config.BaseURL == "" {
		return nil, fmt.Errorf("BaseURL cannot be empty")
	}

	// Create HTTP client with configuration
	httpClient := &http.Client{
		Timeout: config.DefaultTimeout,
	}

	client := &Client{
		config:     config,
		httpClient: httpClient,
	}

	// Initialize API modules
	client.orchestrator = &OrchestratorAPI{client: client}
	client.templates = &TemplatesAPI{client: client}
	client.traces = &TracesAPI{client: client}
	client.webhooks = &WebhooksAPI{client: client}

	return client, nil
}

// CreateWebhookSubscription creates a new webhook subscription
func (c *Client) CreateWebhookSubscription(options *SubscriptionOptions) *WebhookSubscriptionManager {
	return NewWebhookSubscription(c.webhooks, options)
}

// Health checks the service health
func (c *Client) Health(ctx context.Context) (*HealthCheckResponse, error) {
	url := strings.TrimSuffix(c.config.BaseURL, "/") + "/api/zip/health"
	
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("health check failed: status %d", resp.StatusCode)
	}

	var health HealthCheckResponse
	if err := json.NewDecoder(resp.Body).Decode(&health); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &health, nil
}

// BaseURL returns the configured base URL
func (c *Client) BaseURL() string {
	return c.config.BaseURL
}

// Config returns the client configuration
func (c *Client) Config() ClientConfig {
	return c.config
}

// Orchestrator returns the orchestrator API
func (c *Client) Orchestrator() *OrchestratorAPI {
	return c.orchestrator
}

// Templates returns the templates API
func (c *Client) Templates() *TemplatesAPI {
	return c.templates
}

// Traces returns the traces API
func (c *Client) Traces() *TracesAPI {
	return c.traces
}

// Webhooks returns the webhooks API
func (c *Client) Webhooks() *WebhooksAPI {
	return c.webhooks
}

// makeRequest is a helper method for making HTTP requests
func (c *Client) makeRequest(ctx context.Context, method, path string, body interface{}, result interface{}) error {
	url := strings.TrimSuffix(c.config.BaseURL, "/") + path
	
	var reqBody io.Reader
	if body != nil {
		jsonData, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("failed to marshal request body: %w", err)
		}
		reqBody = bytes.NewBuffer(jsonData)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", c.config.UserAgent)
	
	// Add auth token if provided
	if c.config.AuthToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.config.AuthToken)
	}

	// Execute request with retries
	var resp *http.Response
	var lastErr error
	
	for attempt := 0; attempt <= c.config.MaxRetries; attempt++ {
		if attempt > 0 {
			// Wait before retry
			time.Sleep(time.Duration(c.config.RetryBackoffMs) * time.Millisecond)
		}

		resp, lastErr = c.httpClient.Do(req)
		if lastErr == nil && resp.StatusCode < 500 {
			// Success or client error (don't retry client errors)
			break
		}
		
		if resp != nil {
			resp.Body.Close()
		}
	}

	if lastErr != nil {
		return fmt.Errorf("request failed after %d retries: %w", c.config.MaxRetries, lastErr)
	}
	defer resp.Body.Close()

	// Check for HTTP errors
	if resp.StatusCode >= 400 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(bodyBytes))
	}

	// Decode response if result is provided
	if result != nil {
		if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
			return fmt.Errorf("failed to decode response: %w", err)
		}
	}

	return nil
}

// OrchestratorAPI handles workflow orchestration
type OrchestratorAPI struct {
	client *Client
}

// CreateWorkflow creates a new workflow
func (api *OrchestratorAPI) CreateWorkflow(ctx context.Context, req CreateWorkflowRequest) (*CreateWorkflowResponse, error) {
	var result CreateWorkflowResponse
	err := api.client.makeRequest(ctx, "POST", "/api/zip/orchestrator/workflows", req, &result)
	return &result, err
}

// ListWorkflows lists existing workflows
func (api *OrchestratorAPI) ListWorkflows(ctx context.Context, params *ListWorkflowsParams) (*ListWorkflowsResponse, error) {
	path := "/api/zip/orchestrator/workflows"
	if params != nil {
		query := make([]string, 0, 2)
		if params.Limit != nil {
			query = append(query, fmt.Sprintf("limit=%d", *params.Limit))
		}
		if params.Offset != nil {
			query = append(query, fmt.Sprintf("offset=%d", *params.Offset))
		}
		if len(query) > 0 {
			path += "?" + strings.Join(query, "&")
		}
	}
	
	var result ListWorkflowsResponse
	err := api.client.makeRequest(ctx, "GET", path, nil, &result)
	return &result, err
}

// GetWorkflowState gets the current state of a workflow
func (api *OrchestratorAPI) GetWorkflowState(ctx context.Context, workflowID string, graphID *string) (*WorkflowState, error) {
	gid := "main"
	if graphID != nil {
		gid = *graphID
	}
	
	path := fmt.Sprintf("/api/zip/orchestrator/workflows/%s/state?graphId=%s", workflowID, gid)
	var result WorkflowState
	err := api.client.makeRequest(ctx, "GET", path, nil, &result)
	return &result, err
}

// AddNode adds a node to a workflow
func (api *OrchestratorAPI) AddNode(ctx context.Context, req AddNodeRequest) (*AddNodeResponse, error) {
	var result AddNodeResponse
	err := api.client.makeRequest(ctx, "POST", "/api/zip/orchestrator/nodes", req, &result)
	return &result, err
}

// UpdateNode updates node properties
func (api *OrchestratorAPI) UpdateNode(ctx context.Context, nodeID string, req UpdateNodeRequest) (*UpdateNodeResponse, error) {
	path := fmt.Sprintf("/api/zip/orchestrator/nodes/%s", nodeID)
	var result UpdateNodeResponse
	err := api.client.makeRequest(ctx, "PATCH", path, req, &result)
	return &result, err
}

// DeleteNode deletes a node
func (api *OrchestratorAPI) DeleteNode(ctx context.Context, nodeID, workflowID string, graphID *string) (*DeleteNodeResponse, error) {
	gid := "main"
	if graphID != nil {
		gid = *graphID
	}
	
	path := fmt.Sprintf("/api/zip/orchestrator/nodes/%s?workflowId=%s&graphId=%s", nodeID, workflowID, gid)
	var result DeleteNodeResponse
	err := api.client.makeRequest(ctx, "DELETE", path, nil, &result)
	return &result, err
}

// ConnectNodes connects two nodes
func (api *OrchestratorAPI) ConnectNodes(ctx context.Context, req ConnectNodesRequest) (*ConnectionResponse, error) {
	var result ConnectionResponse
	err := api.client.makeRequest(ctx, "POST", "/api/zip/orchestrator/connections", req, &result)
	return &result, err
}

// RemoveConnection removes a connection between nodes
func (api *OrchestratorAPI) RemoveConnection(ctx context.Context, req RemoveConnectionRequest) (*RemoveConnectionResponse, error) {
	var result RemoveConnectionResponse
	err := api.client.makeRequest(ctx, "DELETE", "/api/zip/orchestrator/connections", req, &result)
	return &result, err
}

// CreateGroup creates a node group
func (api *OrchestratorAPI) CreateGroup(ctx context.Context, req CreateGroupRequest) (*CreateGroupResponse, error) {
	var result CreateGroupResponse
	err := api.client.makeRequest(ctx, "POST", "/api/zip/orchestrator/groups", req, &result)
	return &result, err
}

// UpdateGroup updates group properties
func (api *OrchestratorAPI) UpdateGroup(ctx context.Context, req UpdateGroupRequest) (*UpdateGroupResponse, error) {
	var result UpdateGroupResponse
	err := api.client.makeRequest(ctx, "PATCH", "/api/zip/orchestrator/groups", req, &result)
	return &result, err
}

// RemoveGroup removes a group
func (api *OrchestratorAPI) RemoveGroup(ctx context.Context, req RemoveGroupRequest) (*RemoveGroupResponse, error) {
	var result RemoveGroupResponse
	err := api.client.makeRequest(ctx, "DELETE", "/api/zip/orchestrator/groups", req, &result)
	return &result, err
}

// TemplatesAPI handles node template management
type TemplatesAPI struct {
	client *Client
}

// Register registers node templates
func (api *TemplatesAPI) Register(ctx context.Context, req RegisterTemplatesRequest) (*RegisterTemplatesResponse, error) {
	var result RegisterTemplatesResponse
	err := api.client.makeRequest(ctx, "POST", "/api/zip/templates/register", req, &result)
	return &result, err
}

// List lists available templates in a namespace
func (api *TemplatesAPI) List(ctx context.Context, namespace string) (*ListTemplatesResponse, error) {
	path := fmt.Sprintf("/api/zip/templates/list?namespace=%s", namespace)
	var result ListTemplatesResponse
	err := api.client.makeRequest(ctx, "GET", path, nil, &result)
	return &result, err
}

// Update updates a template
func (api *TemplatesAPI) Update(ctx context.Context, namespace, templateID string, template NodeTemplate) (*UpdateTemplateResponse, error) {
	path := fmt.Sprintf("/api/zip/templates/update?namespace=%s&templateId=%s", namespace, templateID)
	var result UpdateTemplateResponse
	err := api.client.makeRequest(ctx, "PATCH", path, template, &result)
	return &result, err
}

// Delete deletes a template
func (api *TemplatesAPI) Delete(ctx context.Context, namespace, templateID string) (*DeleteTemplateResponse, error) {
	path := fmt.Sprintf("/api/zip/templates/delete?namespace=%s&templateId=%s", namespace, templateID)
	var result DeleteTemplateResponse
	err := api.client.makeRequest(ctx, "DELETE", path, nil, &result)
	return &result, err
}

// TracesAPI handles execution tracing
type TracesAPI struct {
	client    *Client
	sessionID *string
}

// CreateSession creates a new trace session
func (api *TracesAPI) CreateSession(ctx context.Context, req CreateTraceSessionRequest) (*CreateTraceSessionResponse, error) {
	var result CreateTraceSessionResponse
	err := api.client.makeRequest(ctx, "POST", "/api/zip/traces/sessions", req, &result)
	if err == nil {
		api.sessionID = &result.SessionID
	}
	return &result, err
}

// SubmitEvents submits trace events
func (api *TracesAPI) SubmitEvents(ctx context.Context, sessionID string, events []TraceEvent) (*SubmitEventsResponse, error) {
	path := fmt.Sprintf("/api/zip/traces/%s/events", sessionID)
	requestBody := map[string]interface{}{
		"events": events,
	}
	
	var result SubmitEventsResponse
	err := api.client.makeRequest(ctx, "POST", path, requestBody, &result)
	return &result, err
}

// SubmitEvent submits a single trace event
func (api *TracesAPI) SubmitEvent(ctx context.Context, sessionID string, event TraceEvent) (*SubmitEventsResponse, error) {
	return api.SubmitEvents(ctx, sessionID, []TraceEvent{event})
}

// CompleteSession completes a trace session
func (api *TracesAPI) CompleteSession(ctx context.Context, sessionID string, req CompleteSessionRequest) (*CompleteSessionResponse, error) {
	path := fmt.Sprintf("/api/zip/traces/%s/complete", sessionID)
	var result CompleteSessionResponse
	err := api.client.makeRequest(ctx, "POST", path, req, &result)
	if err == nil && api.sessionID != nil && *api.sessionID == sessionID {
		api.sessionID = nil
	}
	return &result, err
}

// CurrentSessionID returns the current session ID
func (api *TracesAPI) CurrentSessionID() *string {
	return api.sessionID
}

// TraceNodeExecution is a helper method to trace node execution
func (api *TracesAPI) TraceNodeExecution(ctx context.Context, sessionID, nodeID, eventType string, data interface{}, duration *time.Duration) error {
	dataJSON, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal data: %w", err)
	}

	traceData := TraceData{
		Size:     len(dataJSON),
		DataType: "application/json",
		Preview:  data,
		FullData: data,
	}

	event := TraceEvent{
		Timestamp: time.Now().UnixMilli(),
		NodeID:    nodeID,
		EventType: eventType,
		Data:      traceData,
	}

	if duration != nil {
		durationMs := duration.Milliseconds()
		event.Duration = &durationMs
	}

	_, err = api.SubmitEvent(ctx, sessionID, event)
	return err
}

// WebhooksAPI handles webhook subscriptions
type WebhooksAPI struct {
	client *Client
}

// Create creates a new webhook subscription
func (api *WebhooksAPI) Create(ctx context.Context, req CreateWebhookRequest) (*CreateWebhookResponse, error) {
	var result CreateWebhookResponse
	err := api.client.makeRequest(ctx, "POST", "/api/zip/webhooks", req, &result)
	return &result, err
}

// List lists webhook subscriptions
func (api *WebhooksAPI) List(ctx context.Context) (*ListWebhooksResponse, error) {
	var result ListWebhooksResponse
	err := api.client.makeRequest(ctx, "GET", "/api/zip/webhooks", nil, &result)
	return &result, err
}

// Update updates a webhook subscription
func (api *WebhooksAPI) Update(ctx context.Context, webhookID string, req UpdateWebhookRequest) (*UpdateWebhookResponse, error) {
	path := fmt.Sprintf("/api/zip/webhooks/%s", webhookID)
	var result UpdateWebhookResponse
	err := api.client.makeRequest(ctx, "PATCH", path, req, &result)
	return &result, err
}

// Delete deletes a webhook subscription
func (api *WebhooksAPI) Delete(ctx context.Context, webhookID string) (*DeleteWebhookResponse, error) {
	path := fmt.Sprintf("/api/zip/webhooks/%s", webhookID)
	var result DeleteWebhookResponse
	err := api.client.makeRequest(ctx, "DELETE", path, nil, &result)
	return &result, err
}

// Test tests a webhook subscription
func (api *WebhooksAPI) Test(ctx context.Context, webhookID string) (*TestWebhookResponse, error) {
	path := fmt.Sprintf("/api/zip/webhooks/%s/test", webhookID)
	var result TestWebhookResponse
	err := api.client.makeRequest(ctx, "POST", path, nil, &result)
	return &result, err
}