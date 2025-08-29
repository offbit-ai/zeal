"""Type definitions for Zeal SDK."""

from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field


class Position(BaseModel):
    """2D position coordinates."""
    x: float
    y: float


class NodePort(BaseModel):
    """Node port specification."""
    node_id: str = Field(alias="nodeId")
    port_id: str = Field(alias="portId")
    
    class Config:
        populate_by_name = True


class HealthCheckResponse(BaseModel):
    """Health check response."""
    status: str
    version: str
    services: Dict[str, str]


# === Orchestrator Types ===

class CreateWorkflowRequest(BaseModel):
    """Request to create a new workflow."""
    name: str
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class CreateWorkflowResponse(BaseModel):
    """Response from creating a workflow."""
    workflow_id: str = Field(alias="workflowId")
    name: str
    version: int
    graph_id: str = Field(alias="graphId")
    metadata: Optional[Dict[str, Any]] = None
    
    class Config:
        populate_by_name = True


class ListWorkflowsParams(BaseModel):
    """Parameters for listing workflows."""
    limit: Optional[int] = None
    offset: Optional[int] = None


class ListWorkflowsResponse(BaseModel):
    """Response from listing workflows."""
    workflows: List[Any]
    total: int
    limit: int
    offset: int


class WorkflowState(BaseModel):
    """Current state of a workflow."""
    workflow_id: str = Field(alias="workflowId")
    graph_id: str = Field(alias="graphId")
    name: str
    description: str
    version: int
    state: Any
    metadata: Any
    
    class Config:
        populate_by_name = True


class AddNodeRequest(BaseModel):
    """Request to add a node to a workflow."""
    workflow_id: str = Field(alias="workflowId")
    graph_id: Optional[str] = Field(default=None, alias="graphId")
    template_id: str = Field(alias="templateId")
    position: Position
    properties: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None
    instance_name: Optional[str] = Field(default=None, alias="instanceName")
    
    class Config:
        populate_by_name = True


class AddNodeResponse(BaseModel):
    """Response from adding a node."""
    node_id: str = Field(alias="nodeId")
    node: Any
    
    class Config:
        populate_by_name = True


class UpdateNodeRequest(BaseModel):
    """Request to update node properties."""
    workflow_id: str = Field(alias="workflowId")
    graph_id: Optional[str] = Field(default=None, alias="graphId")
    properties: Optional[Dict[str, Any]] = None
    position: Optional[Position] = None
    
    class Config:
        populate_by_name = True


class UpdateNodeResponse(BaseModel):
    """Response from updating a node."""
    success: bool


class DeleteNodeResponse(BaseModel):
    """Response from deleting a node."""
    success: bool
    message: str


class ConnectNodesRequest(BaseModel):
    """Request to connect two nodes."""
    workflow_id: str = Field(alias="workflowId")
    graph_id: Optional[str] = Field(default=None, alias="graphId")
    source: NodePort
    target: NodePort
    
    class Config:
        populate_by_name = True


class ConnectionResponse(BaseModel):
    """Response from connecting nodes."""
    connection_id: str = Field(alias="connectionId")
    connection: Any
    
    class Config:
        populate_by_name = True


class RemoveConnectionRequest(BaseModel):
    """Request to remove a connection."""
    workflow_id: str = Field(alias="workflowId")
    graph_id: Optional[str] = Field(default=None, alias="graphId")
    connection_id: str = Field(alias="connectionId")
    
    class Config:
        populate_by_name = True


class RemoveConnectionResponse(BaseModel):
    """Response from removing a connection."""
    success: bool
    message: str


class CreateGroupRequest(BaseModel):
    """Request to create a node group."""
    workflow_id: str = Field(alias="workflowId")
    graph_id: Optional[str] = Field(default=None, alias="graphId")
    title: str
    node_ids: List[str] = Field(alias="nodeIds")
    color: Optional[str] = None
    description: Optional[str] = None
    
    class Config:
        populate_by_name = True


class CreateGroupResponse(BaseModel):
    """Response from creating a group."""
    success: bool
    group_id: str = Field(alias="groupId")
    group: Any
    
    class Config:
        populate_by_name = True


class UpdateGroupRequest(BaseModel):
    """Request to update group properties."""
    workflow_id: str = Field(alias="workflowId")
    graph_id: Optional[str] = Field(default=None, alias="graphId")
    group_id: str = Field(alias="groupId")
    title: Optional[str] = None
    node_ids: Optional[List[str]] = Field(default=None, alias="nodeIds")
    color: Optional[str] = None
    description: Optional[str] = None
    
    class Config:
        populate_by_name = True


class UpdateGroupResponse(BaseModel):
    """Response from updating a group."""
    success: bool
    group: Any


class RemoveGroupRequest(BaseModel):
    """Request to remove a group."""
    workflow_id: str = Field(alias="workflowId")
    graph_id: Optional[str] = Field(default=None, alias="graphId")
    group_id: str = Field(alias="groupId")
    
    class Config:
        populate_by_name = True


class RemoveGroupResponse(BaseModel):
    """Response from removing a group."""
    success: bool
    message: str


# === Template Types ===

class Port(BaseModel):
    """Node port definition."""
    id: str
    label: str
    type: str
    position: str
    data_type: Optional[str] = Field(default=None, alias="dataType")
    required: Optional[bool] = None
    multiple: Optional[bool] = None
    
    class Config:
        populate_by_name = True


class PropertyValidation(BaseModel):
    """Property validation rules."""
    required: Optional[bool] = None
    min: Optional[float] = None
    max: Optional[float] = None
    min_length: Optional[int] = Field(default=None, alias="minLength")
    max_length: Optional[int] = Field(default=None, alias="maxLength")
    pattern: Optional[str] = None
    custom_rule: Optional[str] = Field(default=None, alias="customRule")
    
    class Config:
        populate_by_name = True


class PropertyDefinition(BaseModel):
    """Property definition."""
    type: str
    label: Optional[str] = None
    description: Optional[str] = None
    default_value: Optional[Any] = Field(default=None, alias="defaultValue")
    options: Optional[List[Any]] = None
    validation: Optional[PropertyValidation] = None
    
    class Config:
        populate_by_name = True


class RuntimeRequirements(BaseModel):
    """Runtime requirements for a template."""
    memory: Optional[str] = None
    cpu: Optional[str] = None
    gpu: Optional[bool] = None
    dependencies: Optional[List[str]] = None
    environment: Optional[Dict[str, str]] = None
    timeout: Optional[int] = None


class NodeTemplate(BaseModel):
    """Node template definition."""
    id: str
    type: str
    title: str
    subtitle: Optional[str] = None
    category: str
    subcategory: Optional[str] = None
    description: str
    icon: str
    variant: Optional[str] = None
    shape: Optional[str] = None
    size: Optional[str] = None
    ports: List[Port]
    properties: Optional[Dict[str, PropertyDefinition]] = None
    runtime: Optional[RuntimeRequirements] = None


class RegisterTemplatesRequest(BaseModel):
    """Request to register templates."""
    namespace: str
    templates: List[NodeTemplate]


class RegisterTemplatesResponse(BaseModel):
    """Response from registering templates."""
    success: bool
    registered_count: int = Field(alias="registeredCount")
    updated_count: int = Field(alias="updatedCount")
    registered_ids: List[str] = Field(alias="registeredIds")
    updated_ids: List[str] = Field(alias="updatedIds")
    
    class Config:
        populate_by_name = True


class ListTemplatesResponse(BaseModel):
    """Response from listing templates."""
    templates: List[NodeTemplate]
    total: int


class UpdateTemplateResponse(BaseModel):
    """Response from updating a template."""
    success: bool
    template: NodeTemplate


class DeleteTemplateResponse(BaseModel):
    """Response from deleting a template."""
    success: bool
    message: str


# === Trace Types ===

class CreateTraceSessionRequest(BaseModel):
    """Request to create a trace session."""
    workflow_id: str = Field(alias="workflowId")
    workflow_version_id: Optional[str] = Field(default=None, alias="workflowVersionId")
    execution_id: str = Field(alias="executionId")
    metadata: Optional[Dict[str, Any]] = None
    
    class Config:
        populate_by_name = True


class CreateTraceSessionResponse(BaseModel):
    """Response from creating a trace session."""
    session_id: str = Field(alias="sessionId")
    workflow_id: str = Field(alias="workflowId")
    execution_id: str = Field(alias="executionId")
    created_at: datetime = Field(alias="createdAt")
    
    class Config:
        populate_by_name = True


class TraceData(BaseModel):
    """Trace event data."""
    size: int
    data_type: str = Field(alias="dataType")
    preview: Optional[Any] = None
    full_data: Optional[Any] = Field(default=None, alias="fullData")
    
    class Config:
        populate_by_name = True


class TraceError(BaseModel):
    """Trace error information."""
    message: str
    code: Optional[str] = None
    stack: Optional[str] = None


class TraceEvent(BaseModel):
    """Trace event."""
    timestamp: int
    node_id: str = Field(alias="nodeId")
    port_id: Optional[str] = Field(default=None, alias="portId")
    event_type: str = Field(alias="eventType")
    data: TraceData
    duration: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None
    error: Optional[TraceError] = None
    
    class Config:
        populate_by_name = True


class SubmitEventsResponse(BaseModel):
    """Response from submitting events."""
    success: bool
    events_processed: int = Field(alias="eventsProcessed")
    
    class Config:
        populate_by_name = True


class SessionSummary(BaseModel):
    """Session summary statistics."""
    total_nodes: int = Field(alias="totalNodes")
    successful_nodes: int = Field(alias="successfulNodes")
    failed_nodes: int = Field(alias="failedNodes")
    total_duration: int = Field(alias="totalDuration")
    total_data_processed: int = Field(alias="totalDataProcessed")
    
    class Config:
        populate_by_name = True


class SessionError(BaseModel):
    """Session error information."""
    message: str
    node_id: Optional[str] = Field(default=None, alias="nodeId")
    stack: Optional[str] = None
    
    class Config:
        populate_by_name = True


class CompleteSessionRequest(BaseModel):
    """Request to complete a session."""
    status: str
    summary: Optional[SessionSummary] = None
    error: Optional[SessionError] = None


class CompleteSessionResponse(BaseModel):
    """Response from completing a session."""
    success: bool
    session_id: str = Field(alias="sessionId")
    status: str
    
    class Config:
        populate_by_name = True


# === Webhook Types ===

class WebhookSubscription(BaseModel):
    """Webhook subscription definition."""
    id: str
    url: str
    events: List[str]
    headers: Optional[Dict[str, str]] = None
    secret: Optional[str] = None
    max_retries: int = Field(alias="maxRetries")
    retry_interval: int = Field(alias="retryInterval")
    is_active: bool = Field(alias="isActive")
    created_at: datetime = Field(alias="createdAt")
    
    class Config:
        populate_by_name = True


class CreateWebhookRequest(BaseModel):
    """Request to create a webhook."""
    url: str
    events: List[str]
    headers: Optional[Dict[str, str]] = None
    secret: Optional[str] = None
    max_retries: Optional[int] = Field(default=None, alias="maxRetries")
    retry_interval: Optional[int] = Field(default=None, alias="retryInterval")
    
    class Config:
        populate_by_name = True


class CreateWebhookResponse(BaseModel):
    """Response from creating a webhook."""
    success: bool
    subscription: WebhookSubscription


class ListWebhooksResponse(BaseModel):
    """Response from listing webhooks."""
    subscriptions: List[WebhookSubscription]
    total: int


class UpdateWebhookRequest(BaseModel):
    """Request to update a webhook."""
    url: Optional[str] = None
    events: Optional[List[str]] = None
    headers: Optional[Dict[str, str]] = None
    secret: Optional[str] = None
    max_retries: Optional[int] = Field(default=None, alias="maxRetries")
    retry_interval: Optional[int] = Field(default=None, alias="retryInterval")
    is_active: Optional[bool] = Field(default=None, alias="isActive")
    
    class Config:
        populate_by_name = True


class UpdateWebhookResponse(BaseModel):
    """Response from updating a webhook."""
    success: bool
    subscription: WebhookSubscription


class DeleteWebhookResponse(BaseModel):
    """Response from deleting a webhook."""
    success: bool
    message: str


class TestWebhookResponse(BaseModel):
    """Response from testing a webhook."""
    success: bool
    status_code: int = Field(alias="statusCode")
    response_time_ms: int = Field(alias="responseTimeMs")
    error: Optional[str] = None
    
    class Config:
        populate_by_name = True