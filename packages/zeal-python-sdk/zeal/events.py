"""ZIP event types and utilities for Zeal SDK."""

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Type, Union
from pydantic import BaseModel, Field


class ZipEventBase(BaseModel):
    """Base event structure for all ZIP events."""
    id: str
    timestamp: str
    workflow_id: str = Field(alias="workflowId")
    graph_id: Optional[str] = Field(default=None, alias="graphId")
    metadata: Optional[Dict[str, Any]] = None
    
    class Config:
        populate_by_name = True


# === Execution Events ===

class NodeExecutingEvent(ZipEventBase):
    """Node execution started event."""
    type: str = "node.executing"
    node_id: str = Field(alias="nodeId")
    input_connections: List[str] = Field(alias="inputConnections")
    
    class Config:
        populate_by_name = True


class NodeCompletedEvent(ZipEventBase):
    """Node execution completed event."""
    type: str = "node.completed"
    node_id: str = Field(alias="nodeId")
    output_connections: List[str] = Field(alias="outputConnections")
    duration: Optional[int] = None
    output_size: Optional[int] = Field(default=None, alias="outputSize")
    
    class Config:
        populate_by_name = True


class NodeFailedEvent(ZipEventBase):
    """Node execution failed event."""
    type: str = "node.failed"
    node_id: str = Field(alias="nodeId")
    output_connections: List[str] = Field(alias="outputConnections")
    error: Optional["NodeError"] = None
    
    class Config:
        populate_by_name = True


class NodeWarningEvent(ZipEventBase):
    """Node execution completed with warnings event."""
    type: str = "node.warning"
    node_id: str = Field(alias="nodeId")
    output_connections: List[str] = Field(alias="outputConnections")
    warning: Optional["NodeWarning"] = None
    
    class Config:
        populate_by_name = True


class NodeError(BaseModel):
    """Error information for failed nodes."""
    message: str
    code: Optional[str] = None
    stack: Optional[str] = None


class NodeWarning(BaseModel):
    """Warning information for nodes with warnings."""
    message: str
    code: Optional[str] = None


class ExecutionStartedEvent(ZipEventBase):
    """Workflow execution started event."""
    type: str = "execution.started"
    session_id: str = Field(alias="sessionId")
    workflow_name: str = Field(alias="workflowName")
    trigger: Optional["ExecutionTrigger"] = None
    
    class Config:
        populate_by_name = True


class ExecutionCompletedEvent(ZipEventBase):
    """Workflow execution completed event."""
    type: str = "execution.completed"
    session_id: str = Field(alias="sessionId")
    duration: int
    nodes_executed: int = Field(alias="nodesExecuted")
    summary: Optional["ExecutionSummary"] = None
    
    class Config:
        populate_by_name = True


class ExecutionFailedEvent(ZipEventBase):
    """Workflow execution failed event."""
    type: str = "execution.failed"
    session_id: str = Field(alias="sessionId")
    duration: Optional[int] = None
    error: Optional["ExecutionError"] = None
    
    class Config:
        populate_by_name = True


class ExecutionTrigger(BaseModel):
    """Execution trigger information."""
    type: str
    source: Optional[str] = None


class ExecutionSummary(BaseModel):
    """Execution summary statistics."""
    success_count: int = Field(alias="successCount")
    error_count: int = Field(alias="errorCount")
    warning_count: int = Field(alias="warningCount")
    
    class Config:
        populate_by_name = True


class ExecutionError(BaseModel):
    """Execution error information."""
    message: str
    code: Optional[str] = None
    node_id: Optional[str] = Field(default=None, alias="nodeId")
    
    class Config:
        populate_by_name = True


# === Workflow Events ===

class WorkflowCreatedEvent(ZipEventBase):
    """Workflow created event."""
    type: str = "workflow.created"
    workflow_name: str = Field(alias="workflowName")
    user_id: Optional[str] = Field(default=None, alias="userId")
    
    class Config:
        populate_by_name = True


class WorkflowUpdatedEvent(ZipEventBase):
    """Workflow updated event."""
    type: str = "workflow.updated"
    data: Optional[Dict[str, Any]] = None


class WorkflowDeletedEvent(ZipEventBase):
    """Workflow deleted event."""
    type: str = "workflow.deleted"
    workflow_name: Optional[str] = Field(default=None, alias="workflowName")
    
    class Config:
        populate_by_name = True


# === CRDT Events ===

class NodeAddedEvent(ZipEventBase):
    """Node added to workflow event."""
    type: str = "node.added"
    node_id: str = Field(alias="nodeId")
    data: Dict[str, Any]
    
    class Config:
        populate_by_name = True


class NodeUpdatedEvent(ZipEventBase):
    """Node updated event."""
    type: str = "node.updated"
    node_id: str = Field(alias="nodeId")
    data: Dict[str, Any]
    
    class Config:
        populate_by_name = True


class NodeDeletedEvent(ZipEventBase):
    """Node deleted event."""
    type: str = "node.deleted"
    node_id: str = Field(alias="nodeId")
    
    class Config:
        populate_by_name = True


class ConnectionAddedEvent(ZipEventBase):
    """Connection added event."""
    type: str = "connection.added"
    data: Dict[str, Any]


class ConnectionDeletedEvent(ZipEventBase):
    """Connection deleted event."""
    type: str = "connection.deleted"
    data: Dict[str, Any]


class GroupCreatedEvent(ZipEventBase):
    """Group created event."""
    type: str = "group.created"
    data: Dict[str, Any]


class GroupUpdatedEvent(ZipEventBase):
    """Group updated event."""
    type: str = "group.updated"
    data: Dict[str, Any]


class GroupDeletedEvent(ZipEventBase):
    """Group deleted event."""
    type: str = "group.deleted"
    data: Dict[str, Any]


class TemplateRegisteredEvent(ZipEventBase):
    """Template registered event."""
    type: str = "template.registered"
    data: Dict[str, Any]


class TraceEventData(ZipEventBase):
    """Trace event."""
    type: str = "trace.event"
    session_id: str = Field(alias="sessionId")
    node_id: str = Field(alias="nodeId")
    data: Dict[str, Any]
    
    class Config:
        populate_by_name = True


# === Control Events ===

class SubscribeEvent(BaseModel):
    """WebSocket subscribe event."""
    type: str = "subscribe"
    workflow_id: str = Field(alias="workflowId")
    graph_id: Optional[str] = Field(default=None, alias="graphId")
    
    class Config:
        populate_by_name = True


class UnsubscribeEvent(BaseModel):
    """WebSocket unsubscribe event."""
    type: str = "unsubscribe"
    workflow_id: Optional[str] = Field(default=None, alias="workflowId")
    
    class Config:
        populate_by_name = True


class PingEvent(BaseModel):
    """WebSocket ping event."""
    type: str = "ping"
    timestamp: int


class PongEvent(BaseModel):
    """WebSocket pong event."""
    type: str = "pong"
    timestamp: int


class ConnectionStateEvent(ZipEventBase):
    """Connection state change event."""
    type: str = "connection.state"
    connection_id: str = Field(alias="connectionId")
    state: str  # idle, active, success, error
    source_node_id: str = Field(alias="sourceNodeId")
    target_node_id: str = Field(alias="targetNodeId")
    
    class Config:
        populate_by_name = True


# Union types
ZipExecutionEvent = Union[
    NodeExecutingEvent,
    NodeCompletedEvent,
    NodeFailedEvent,
    NodeWarningEvent,
    ExecutionStartedEvent,
    ExecutionCompletedEvent,
    ExecutionFailedEvent
]

ZipWorkflowEvent = Union[
    WorkflowCreatedEvent,
    WorkflowUpdatedEvent,
    WorkflowDeletedEvent
]

ZipCRDTEvent = Union[
    NodeAddedEvent,
    NodeUpdatedEvent,
    NodeDeletedEvent,
    ConnectionAddedEvent,
    ConnectionDeletedEvent,
    GroupCreatedEvent,
    GroupUpdatedEvent,
    GroupDeletedEvent,
    TemplateRegisteredEvent,
    TraceEventData
]

ZipControlEvent = Union[
    SubscribeEvent,
    UnsubscribeEvent,
    PingEvent,
    PongEvent
]

ZipWebSocketEvent = Union[
    ZipExecutionEvent,
    ZipControlEvent,
    WorkflowUpdatedEvent,
    ConnectionStateEvent,
    ZipCRDTEvent
]

ZipWebhookEvent = Union[
    ZipExecutionEvent,
    ZipWorkflowEvent,
    ZipCRDTEvent
]


# Type guards
def is_execution_event(event_type: str) -> bool:
    """Check if event type is an execution event."""
    execution_types = {
        "node.executing", "node.completed", "node.failed", "node.warning",
        "execution.started", "execution.completed", "execution.failed"
    }
    return event_type in execution_types


def is_workflow_event(event_type: str) -> bool:
    """Check if event type is a workflow event."""
    return event_type.startswith("workflow.")


def is_crdt_event(event_type: str) -> bool:
    """Check if event type is a CRDT event."""
    crdt_types = {
        "node.added", "node.updated", "node.deleted",
        "connection.added", "connection.deleted",
        "group.created", "group.updated", "group.deleted",
        "template.registered", "trace.event"
    }
    return event_type in crdt_types


def is_control_event(event_type: str) -> bool:
    """Check if event type is a control event."""
    return event_type in {"subscribe", "unsubscribe", "ping", "pong"}


def is_node_event(event_type: str) -> bool:
    """Check if event type is a node-related event."""
    node_types = {
        "node.executing", "node.completed", "node.failed", "node.warning",
        "node.added", "node.updated", "node.deleted"
    }
    return event_type in node_types


def is_group_event(event_type: str) -> bool:
    """Check if event type is a group-related event."""
    return event_type.startswith("group.")


def is_connection_crdt_event(event_type: str) -> bool:
    """Check if event type is a connection CRDT event."""
    return event_type in {"connection.added", "connection.deleted"}


def is_template_event(event_type: str) -> bool:
    """Check if event type is a template-related event."""
    return event_type.startswith("template.")


# Event creation helpers
def generate_event_id() -> str:
    """Generate a unique event ID."""
    timestamp = int(datetime.now(timezone.utc).timestamp() * 1000)
    random_part = str(uuid.uuid4()).replace('-', '')[:11]
    return f"evt_{timestamp}_{random_part}"


def current_timestamp() -> str:
    """Get current timestamp in ISO format."""
    return datetime.now(timezone.utc).isoformat()


def create_node_added_event(
    workflow_id: str,
    node_id: str,
    data: Dict[str, Any],
    graph_id: Optional[str] = None
) -> NodeAddedEvent:
    """Create a node added event."""
    return NodeAddedEvent(
        id=generate_event_id(),
        timestamp=current_timestamp(),
        workflow_id=workflow_id,
        graph_id=graph_id,
        node_id=node_id,
        data=data
    )


def create_node_updated_event(
    workflow_id: str,
    node_id: str,
    data: Dict[str, Any],
    graph_id: Optional[str] = None
) -> NodeUpdatedEvent:
    """Create a node updated event."""
    return NodeUpdatedEvent(
        id=generate_event_id(),
        timestamp=current_timestamp(),
        workflow_id=workflow_id,
        graph_id=graph_id,
        node_id=node_id,
        data=data
    )


def create_node_deleted_event(
    workflow_id: str,
    node_id: str,
    graph_id: Optional[str] = None
) -> NodeDeletedEvent:
    """Create a node deleted event."""
    return NodeDeletedEvent(
        id=generate_event_id(),
        timestamp=current_timestamp(),
        workflow_id=workflow_id,
        graph_id=graph_id,
        node_id=node_id
    )


def create_group_created_event(
    workflow_id: str,
    data: Dict[str, Any],
    graph_id: Optional[str] = None
) -> GroupCreatedEvent:
    """Create a group created event."""
    return GroupCreatedEvent(
        id=generate_event_id(),
        timestamp=current_timestamp(),
        workflow_id=workflow_id,
        graph_id=graph_id,
        data=data
    )


def create_group_updated_event(
    workflow_id: str,
    data: Dict[str, Any],
    graph_id: Optional[str] = None
) -> GroupUpdatedEvent:
    """Create a group updated event."""
    return GroupUpdatedEvent(
        id=generate_event_id(),
        timestamp=current_timestamp(),
        workflow_id=workflow_id,
        graph_id=graph_id,
        data=data
    )


def create_group_deleted_event(
    workflow_id: str,
    data: Dict[str, Any],
    graph_id: Optional[str] = None
) -> GroupDeletedEvent:
    """Create a group deleted event."""
    return GroupDeletedEvent(
        id=generate_event_id(),
        timestamp=current_timestamp(),
        workflow_id=workflow_id,
        graph_id=graph_id,
        data=data
    )


def create_connection_added_event(
    workflow_id: str,
    data: Dict[str, Any],
    graph_id: Optional[str] = None
) -> ConnectionAddedEvent:
    """Create a connection added event."""
    return ConnectionAddedEvent(
        id=generate_event_id(),
        timestamp=current_timestamp(),
        workflow_id=workflow_id,
        graph_id=graph_id,
        data=data
    )


def create_connection_deleted_event(
    workflow_id: str,
    data: Dict[str, Any],
    graph_id: Optional[str] = None
) -> ConnectionDeletedEvent:
    """Create a connection deleted event."""
    return ConnectionDeletedEvent(
        id=generate_event_id(),
        timestamp=current_timestamp(),
        workflow_id=workflow_id,
        graph_id=graph_id,
        data=data
    )


# Event parsing
EVENT_TYPE_MAP: Dict[str, Type[ZipWebhookEvent]] = {
    # Execution events
    "node.executing": NodeExecutingEvent,
    "node.completed": NodeCompletedEvent,
    "node.failed": NodeFailedEvent,
    "node.warning": NodeWarningEvent,
    "execution.started": ExecutionStartedEvent,
    "execution.completed": ExecutionCompletedEvent,
    "execution.failed": ExecutionFailedEvent,
    # Workflow events
    "workflow.created": WorkflowCreatedEvent,
    "workflow.updated": WorkflowUpdatedEvent,
    "workflow.deleted": WorkflowDeletedEvent,
    # CRDT events
    "node.added": NodeAddedEvent,
    "node.updated": NodeUpdatedEvent,
    "node.deleted": NodeDeletedEvent,
    "connection.added": ConnectionAddedEvent,
    "connection.deleted": ConnectionDeletedEvent,
    "group.created": GroupCreatedEvent,
    "group.updated": GroupUpdatedEvent,
    "group.deleted": GroupDeletedEvent,
    "template.registered": TemplateRegisteredEvent,
    "trace.event": TraceEventData,
}


def parse_zip_webhook_event(data: Dict[str, Any]) -> ZipWebhookEvent:
    """Parse a ZIP webhook event from raw data."""
    event_type = data.get("type")
    if not event_type:
        raise ValueError("Event data missing 'type' field")
    
    event_class = EVENT_TYPE_MAP.get(event_type)
    if not event_class:
        raise ValueError(f"Unknown event type: {event_type}")
    
    return event_class(**data)