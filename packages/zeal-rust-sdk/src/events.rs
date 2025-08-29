//! ZIP Event types and WebSocket communication
//! 
//! These types are compatible with @types/zip-events.ts to ensure
//! consistency between the Rust SDK and TypeScript ecosystem.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

/// Base event structure for all ZIP events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZipEventBase {
    /// Unique event ID
    pub id: String,
    /// Event timestamp in ISO format
    pub timestamp: String,
    /// Workflow ID this event relates to
    #[serde(rename = "workflowId")]
    pub workflow_id: String,
    /// Graph ID (optional, defaults to 'main')
    #[serde(rename = "graphId", skip_serializing_if = "Option::is_none")]
    pub graph_id: Option<String>,
    /// Event metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Node execution events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeExecutingEvent {
    #[serde(flatten)]
    pub base: ZipEventBase,
    /// Event type
    #[serde(rename = "type")]
    pub event_type: String, // Always "node.executing"
    /// Node ID that's executing
    #[serde(rename = "nodeId")]
    pub node_id: String,
    /// IDs of connections bringing input data to this node
    #[serde(rename = "inputConnections")]
    pub input_connections: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeCompletedEvent {
    #[serde(flatten)]
    pub base: ZipEventBase,
    /// Event type
    #[serde(rename = "type")]
    pub event_type: String, // Always "node.completed"
    /// Node ID that completed
    #[serde(rename = "nodeId")]
    pub node_id: String,
    /// IDs of connections that can now carry output data
    #[serde(rename = "outputConnections")]
    pub output_connections: Vec<String>,
    /// Execution duration in ms
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<u64>,
    /// Output data size in bytes
    #[serde(rename = "outputSize", skip_serializing_if = "Option::is_none")]
    pub output_size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeFailedEvent {
    #[serde(flatten)]
    pub base: ZipEventBase,
    /// Event type
    #[serde(rename = "type")]
    pub event_type: String, // Always "node.failed"
    /// Node ID that failed
    #[serde(rename = "nodeId")]
    pub node_id: String,
    /// IDs of output connections that won't receive data
    #[serde(rename = "outputConnections")]
    pub output_connections: Vec<String>,
    /// Error information
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<NodeError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeWarningEvent {
    #[serde(flatten)]
    pub base: ZipEventBase,
    /// Event type
    #[serde(rename = "type")]
    pub event_type: String, // Always "node.warning"
    /// Node ID that completed with warnings
    #[serde(rename = "nodeId")]
    pub node_id: String,
    /// IDs of output connections (data available but with warnings)
    #[serde(rename = "outputConnections")]
    pub output_connections: Vec<String>,
    /// Warning information
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warning: Option<NodeWarning>,
}

/// Error information for failed nodes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeError {
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stack: Option<String>,
}

/// Warning information for nodes with warnings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeWarning {
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
}

/// Workflow execution events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionStartedEvent {
    #[serde(flatten)]
    pub base: ZipEventBase,
    /// Event type
    #[serde(rename = "type")]
    pub event_type: String, // Always "execution.started"
    /// Execution session ID
    #[serde(rename = "sessionId")]
    pub session_id: String,
    /// Workflow name
    #[serde(rename = "workflowName")]
    pub workflow_name: String,
    /// Trigger information
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trigger: Option<ExecutionTrigger>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionCompletedEvent {
    #[serde(flatten)]
    pub base: ZipEventBase,
    /// Event type
    #[serde(rename = "type")]
    pub event_type: String, // Always "execution.completed"
    /// Execution session ID
    #[serde(rename = "sessionId")]
    pub session_id: String,
    /// Total execution duration in ms
    pub duration: u64,
    /// Number of nodes executed
    #[serde(rename = "nodesExecuted")]
    pub nodes_executed: u32,
    /// Summary statistics
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<ExecutionSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionFailedEvent {
    #[serde(flatten)]
    pub base: ZipEventBase,
    /// Event type
    #[serde(rename = "type")]
    pub event_type: String, // Always "execution.failed"
    /// Execution session ID
    #[serde(rename = "sessionId")]
    pub session_id: String,
    /// Duration before failure in ms
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<u64>,
    /// Error information
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ExecutionError>,
}

/// Execution trigger information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionTrigger {
    #[serde(rename = "type")]
    pub trigger_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

/// Execution summary statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionSummary {
    #[serde(rename = "successCount")]
    pub success_count: u32,
    #[serde(rename = "errorCount")]
    pub error_count: u32,
    #[serde(rename = "warningCount")]
    pub warning_count: u32,
}

/// Execution error information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionError {
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(rename = "nodeId", skip_serializing_if = "Option::is_none")]
    pub node_id: Option<String>,
}

/// Workflow lifecycle events (for webhooks)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowCreatedEvent {
    #[serde(flatten)]
    pub base: ZipEventBase,
    /// Event type
    #[serde(rename = "type")]
    pub event_type: String, // Always "workflow.created"
    /// Workflow name
    #[serde(rename = "workflowName")]
    pub workflow_name: String,
    /// User who created it
    #[serde(rename = "userId", skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowUpdatedEvent {
    #[serde(flatten)]
    pub base: ZipEventBase,
    /// Event type
    #[serde(rename = "type")]
    pub event_type: String, // Always "workflow.updated"
    /// What was updated
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<WorkflowUpdateData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowDeletedEvent {
    #[serde(flatten)]
    pub base: ZipEventBase,
    /// Event type
    #[serde(rename = "type")]
    pub event_type: String, // Always "workflow.deleted"
    /// Workflow name before deletion
    #[serde(rename = "workflowName", skip_serializing_if = "Option::is_none")]
    pub workflow_name: Option<String>,
}

/// Workflow update data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowUpdateData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub graphs: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub changes: Option<WorkflowChanges>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Workflow changes information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowChanges {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nodes: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub connections: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub properties: Option<bool>,
}

/// CRDT events for real-time collaboration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeAddedEvent {
    #[serde(flatten)]
    pub base: ZipEventBase,
    /// Event type
    #[serde(rename = "type")]
    pub event_type: String, // Always "node.added"
    /// Node ID that was added
    #[serde(rename = "nodeId")]
    pub node_id: String,
    /// Node data
    pub data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeUpdatedEvent {
    #[serde(flatten)]
    pub base: ZipEventBase,
    /// Event type
    #[serde(rename = "type")]
    pub event_type: String, // Always "node.updated"
    /// Node ID that was updated
    #[serde(rename = "nodeId")]
    pub node_id: String,
    /// Node data
    pub data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeDeletedEvent {
    #[serde(flatten)]
    pub base: ZipEventBase,
    /// Event type
    #[serde(rename = "type")]
    pub event_type: String, // Always "node.deleted"
    /// Node ID that was deleted
    #[serde(rename = "nodeId")]
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionAddedEvent {
    #[serde(flatten)]
    pub base: ZipEventBase,
    /// Event type
    #[serde(rename = "type")]
    pub event_type: String, // Always "connection.added"
    /// Connection data
    pub data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionDeletedEvent {
    #[serde(flatten)]
    pub base: ZipEventBase,
    /// Event type
    #[serde(rename = "type")]
    pub event_type: String, // Always "connection.deleted"
    /// Connection data
    pub data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupCreatedEvent {
    #[serde(flatten)]
    pub base: ZipEventBase,
    /// Event type
    #[serde(rename = "type")]
    pub event_type: String, // Always "group.created"
    /// Group data
    pub data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupUpdatedEvent {
    #[serde(flatten)]
    pub base: ZipEventBase,
    /// Event type
    #[serde(rename = "type")]
    pub event_type: String, // Always "group.updated"
    /// Group data
    pub data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupDeletedEvent {
    #[serde(flatten)]
    pub base: ZipEventBase,
    /// Event type
    #[serde(rename = "type")]
    pub event_type: String, // Always "group.deleted"
    /// Group data
    pub data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateRegisteredEvent {
    #[serde(flatten)]
    pub base: ZipEventBase,
    /// Event type
    #[serde(rename = "type")]
    pub event_type: String, // Always "template.registered"
    /// Template data
    pub data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceEventData {
    #[serde(flatten)]
    pub base: ZipEventBase,
    /// Event type
    #[serde(rename = "type")]
    pub event_type: String, // Always "trace.event"
    /// Session ID
    #[serde(rename = "sessionId")]
    pub session_id: String,
    /// Node ID
    #[serde(rename = "nodeId")]
    pub node_id: String,
    /// Event data
    pub data: serde_json::Value,
}

/// WebSocket control events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscribeEvent {
    #[serde(rename = "type")]
    pub event_type: String, // Always "subscribe"
    #[serde(rename = "workflowId")]
    pub workflow_id: String,
    #[serde(rename = "graphId", skip_serializing_if = "Option::is_none")]
    pub graph_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnsubscribeEvent {
    #[serde(rename = "type")]
    pub event_type: String, // Always "unsubscribe"
    #[serde(rename = "workflowId", skip_serializing_if = "Option::is_none")]
    pub workflow_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PingEvent {
    #[serde(rename = "type")]
    pub event_type: String, // Always "ping"
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PongEvent {
    #[serde(rename = "type")]
    pub event_type: String, // Always "pong"
    pub timestamp: i64,
}

/// Connection state event for real-time visualization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionStateEvent {
    #[serde(flatten)]
    pub base: ZipEventBase,
    /// Event type
    #[serde(rename = "type")]
    pub event_type: String, // Always "connection.state"
    #[serde(rename = "connectionId")]
    pub connection_id: String,
    pub state: ConnectionState,
    #[serde(rename = "sourceNodeId")]
    pub source_node_id: String,
    #[serde(rename = "targetNodeId")]
    pub target_node_id: String,
}

/// Connection state for visualization
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionState {
    Idle,
    Active,
    Success,
    Error,
}

/// Visual state update element
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualStateElement {
    pub id: String,
    #[serde(rename = "elementType")]
    pub element_type: ElementType,
    pub state: ElementState,
    pub progress: Option<f64>,
    pub message: Option<String>,
}

/// Element type for visual updates
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ElementType {
    Node,
    Connection,
}

/// Element state for visual updates
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ElementState {
    Idle,
    Pending,
    Running,
    Success,
    Error,
    Warning,
}

/// Visual state update request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualStateUpdate {
    pub elements: Vec<VisualStateElement>,
}

/// Union types for all event categories
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ZipExecutionEvent {
    NodeExecuting(NodeExecutingEvent),
    NodeCompleted(NodeCompletedEvent),
    NodeFailed(NodeFailedEvent),
    NodeWarning(NodeWarningEvent),
    ExecutionStarted(ExecutionStartedEvent),
    ExecutionCompleted(ExecutionCompletedEvent),
    ExecutionFailed(ExecutionFailedEvent),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ZipWorkflowEvent {
    WorkflowCreated(WorkflowCreatedEvent),
    WorkflowUpdated(WorkflowUpdatedEvent),
    WorkflowDeleted(WorkflowDeletedEvent),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ZipCRDTEvent {
    NodeAdded(NodeAddedEvent),
    NodeUpdated(NodeUpdatedEvent),
    NodeDeleted(NodeDeletedEvent),
    ConnectionAdded(ConnectionAddedEvent),
    ConnectionDeleted(ConnectionDeletedEvent),
    GroupCreated(GroupCreatedEvent),
    GroupUpdated(GroupUpdatedEvent),
    GroupDeleted(GroupDeletedEvent),
    TemplateRegistered(TemplateRegisteredEvent),
    TraceEvent(TraceEventData),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ZipControlEvent {
    Subscribe(SubscribeEvent),
    Unsubscribe(UnsubscribeEvent),
    Ping(PingEvent),
    Pong(PongEvent),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ZipWebSocketEvent {
    Execution(ZipExecutionEvent),
    Control(ZipControlEvent),
    WorkflowUpdated(WorkflowUpdatedEvent),
    ConnectionState(ConnectionStateEvent),
    CRDT(ZipCRDTEvent),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ZipWebhookEvent {
    Execution(ZipExecutionEvent),
    Workflow(ZipWorkflowEvent),
    CRDT(ZipCRDTEvent),
}

/// Type guards
impl ZipExecutionEvent {
    pub fn event_type(&self) -> &str {
        match self {
            Self::NodeExecuting(e) => &e.event_type,
            Self::NodeCompleted(e) => &e.event_type,
            Self::NodeFailed(e) => &e.event_type,
            Self::NodeWarning(e) => &e.event_type,
            Self::ExecutionStarted(e) => &e.event_type,
            Self::ExecutionCompleted(e) => &e.event_type,
            Self::ExecutionFailed(e) => &e.event_type,
        }
    }

    pub fn workflow_id(&self) -> &str {
        match self {
            Self::NodeExecuting(e) => &e.base.workflow_id,
            Self::NodeCompleted(e) => &e.base.workflow_id,
            Self::NodeFailed(e) => &e.base.workflow_id,
            Self::NodeWarning(e) => &e.base.workflow_id,
            Self::ExecutionStarted(e) => &e.base.workflow_id,
            Self::ExecutionCompleted(e) => &e.base.workflow_id,
            Self::ExecutionFailed(e) => &e.base.workflow_id,
        }
    }

    pub fn is_node_event(&self) -> bool {
        self.event_type().starts_with("node.")
    }

    pub fn is_execution_event(&self) -> bool {
        self.event_type().starts_with("execution.")
    }
}

impl ZipWorkflowEvent {
    pub fn event_type(&self) -> &str {
        match self {
            Self::WorkflowCreated(e) => &e.event_type,
            Self::WorkflowUpdated(e) => &e.event_type,
            Self::WorkflowDeleted(e) => &e.event_type,
        }
    }

    pub fn workflow_id(&self) -> &str {
        match self {
            Self::WorkflowCreated(e) => &e.base.workflow_id,
            Self::WorkflowUpdated(e) => &e.base.workflow_id,
            Self::WorkflowDeleted(e) => &e.base.workflow_id,
        }
    }
}

impl ZipCRDTEvent {
    pub fn event_type(&self) -> &str {
        match self {
            Self::NodeAdded(e) => &e.event_type,
            Self::NodeUpdated(e) => &e.event_type,
            Self::NodeDeleted(e) => &e.event_type,
            Self::ConnectionAdded(e) => &e.event_type,
            Self::ConnectionDeleted(e) => &e.event_type,
            Self::GroupCreated(e) => &e.event_type,
            Self::GroupUpdated(e) => &e.event_type,
            Self::GroupDeleted(e) => &e.event_type,
            Self::TemplateRegistered(e) => &e.event_type,
            Self::TraceEvent(e) => &e.event_type,
        }
    }

    pub fn workflow_id(&self) -> &str {
        match self {
            Self::NodeAdded(e) => &e.base.workflow_id,
            Self::NodeUpdated(e) => &e.base.workflow_id,
            Self::NodeDeleted(e) => &e.base.workflow_id,
            Self::ConnectionAdded(e) => &e.base.workflow_id,
            Self::ConnectionDeleted(e) => &e.base.workflow_id,
            Self::GroupCreated(e) => &e.base.workflow_id,
            Self::GroupUpdated(e) => &e.base.workflow_id,
            Self::GroupDeleted(e) => &e.base.workflow_id,
            Self::TemplateRegistered(e) => &e.base.workflow_id,
            Self::TraceEvent(e) => &e.base.workflow_id,
        }
    }

    pub fn is_node_event(&self) -> bool {
        matches!(self, Self::NodeAdded(_) | Self::NodeUpdated(_) | Self::NodeDeleted(_))
    }

    pub fn is_connection_event(&self) -> bool {
        matches!(self, Self::ConnectionAdded(_) | Self::ConnectionDeleted(_))
    }

    pub fn is_group_event(&self) -> bool {
        matches!(self, Self::GroupCreated(_) | Self::GroupUpdated(_) | Self::GroupDeleted(_))
    }

    pub fn is_template_event(&self) -> bool {
        matches!(self, Self::TemplateRegistered(_))
    }

    pub fn is_trace_event(&self) -> bool {
        matches!(self, Self::TraceEvent(_))
    }
}

pub fn is_execution_event(event_type: &str) -> bool {
    event_type.starts_with("node.") || event_type.starts_with("execution.")
}

pub fn is_workflow_event(event_type: &str) -> bool {
    event_type.starts_with("workflow.")
}

pub fn is_control_event(event_type: &str) -> bool {
    matches!(event_type, "subscribe" | "unsubscribe" | "ping" | "pong")
}

pub fn is_node_event(event_type: &str) -> bool {
    event_type.starts_with("node.")
}

pub fn is_crdt_event(event_type: &str) -> bool {
    matches!(
        event_type,
        "node.added"
            | "node.updated"
            | "node.deleted"
            | "connection.added"
            | "connection.deleted"
            | "group.created"
            | "group.updated"
            | "group.deleted"
            | "template.registered"
            | "trace.event"
    )
}

pub fn is_group_event(event_type: &str) -> bool {
    event_type.starts_with("group.")
}

pub fn is_connection_crdt_event(event_type: &str) -> bool {
    matches!(event_type, "connection.added" | "connection.deleted")
}

pub fn is_template_event(event_type: &str) -> bool {
    event_type.starts_with("template.")
}

/// Event creation helpers with auto-generated IDs and timestamps
pub fn create_node_executing_event(
    workflow_id: &str,
    node_id: &str,
    input_connections: Vec<String>,
    graph_id: Option<String>,
) -> NodeExecutingEvent {
    NodeExecutingEvent {
        base: ZipEventBase {
            id: generate_event_id(),
            timestamp: current_timestamp(),
            workflow_id: workflow_id.to_string(),
            graph_id,
            metadata: None,
        },
        event_type: "node.executing".to_string(),
        node_id: node_id.to_string(),
        input_connections,
    }
}

pub fn create_node_completed_event(
    workflow_id: &str,
    node_id: &str,
    output_connections: Vec<String>,
    options: Option<NodeCompletedOptions>,
) -> NodeCompletedEvent {
    let options = options.unwrap_or_default();
    NodeCompletedEvent {
        base: ZipEventBase {
            id: generate_event_id(),
            timestamp: current_timestamp(),
            workflow_id: workflow_id.to_string(),
            graph_id: options.graph_id,
            metadata: options.metadata,
        },
        event_type: "node.completed".to_string(),
        node_id: node_id.to_string(),
        output_connections,
        duration: options.duration,
        output_size: options.output_size,
    }
}

pub fn create_node_failed_event(
    workflow_id: &str,
    node_id: &str,
    output_connections: Vec<String>,
    error: Option<NodeError>,
    graph_id: Option<String>,
) -> NodeFailedEvent {
    NodeFailedEvent {
        base: ZipEventBase {
            id: generate_event_id(),
            timestamp: current_timestamp(),
            workflow_id: workflow_id.to_string(),
            graph_id,
            metadata: None,
        },
        event_type: "node.failed".to_string(),
        node_id: node_id.to_string(),
        output_connections,
        error,
    }
}

pub fn create_execution_started_event(
    workflow_id: &str,
    session_id: &str,
    workflow_name: &str,
    options: Option<ExecutionStartedOptions>,
) -> ExecutionStartedEvent {
    let options = options.unwrap_or_default();
    ExecutionStartedEvent {
        base: ZipEventBase {
            id: generate_event_id(),
            timestamp: current_timestamp(),
            workflow_id: workflow_id.to_string(),
            graph_id: options.graph_id,
            metadata: options.metadata,
        },
        event_type: "execution.started".to_string(),
        session_id: session_id.to_string(),
        workflow_name: workflow_name.to_string(),
        trigger: options.trigger,
    }
}

pub fn create_execution_completed_event(
    workflow_id: &str,
    session_id: &str,
    duration: u64,
    nodes_executed: u32,
    options: Option<ExecutionCompletedOptions>,
) -> ExecutionCompletedEvent {
    let options = options.unwrap_or_default();
    ExecutionCompletedEvent {
        base: ZipEventBase {
            id: generate_event_id(),
            timestamp: current_timestamp(),
            workflow_id: workflow_id.to_string(),
            graph_id: options.graph_id,
            metadata: options.metadata,
        },
        event_type: "execution.completed".to_string(),
        session_id: session_id.to_string(),
        duration,
        nodes_executed,
        summary: options.summary,
    }
}

pub fn create_execution_failed_event(
    workflow_id: &str,
    session_id: &str,
    error: Option<ExecutionError>,
    options: Option<ExecutionFailedOptions>,
) -> ExecutionFailedEvent {
    let options = options.unwrap_or_default();
    ExecutionFailedEvent {
        base: ZipEventBase {
            id: generate_event_id(),
            timestamp: current_timestamp(),
            workflow_id: workflow_id.to_string(),
            graph_id: options.graph_id,
            metadata: options.metadata,
        },
        event_type: "execution.failed".to_string(),
        session_id: session_id.to_string(),
        duration: options.duration,
        error,
    }
}

/// CRDT Event creation helpers
pub fn create_node_added_event(
    workflow_id: &str,
    node_id: &str,
    data: serde_json::Value,
    graph_id: Option<String>,
) -> NodeAddedEvent {
    NodeAddedEvent {
        base: ZipEventBase {
            id: generate_event_id(),
            timestamp: current_timestamp(),
            workflow_id: workflow_id.to_string(),
            graph_id,
            metadata: None,
        },
        event_type: "node.added".to_string(),
        node_id: node_id.to_string(),
        data,
    }
}

pub fn create_node_updated_event(
    workflow_id: &str,
    node_id: &str,
    data: serde_json::Value,
    graph_id: Option<String>,
) -> NodeUpdatedEvent {
    NodeUpdatedEvent {
        base: ZipEventBase {
            id: generate_event_id(),
            timestamp: current_timestamp(),
            workflow_id: workflow_id.to_string(),
            graph_id,
            metadata: None,
        },
        event_type: "node.updated".to_string(),
        node_id: node_id.to_string(),
        data,
    }
}

pub fn create_node_deleted_event(
    workflow_id: &str,
    node_id: &str,
    graph_id: Option<String>,
) -> NodeDeletedEvent {
    NodeDeletedEvent {
        base: ZipEventBase {
            id: generate_event_id(),
            timestamp: current_timestamp(),
            workflow_id: workflow_id.to_string(),
            graph_id,
            metadata: None,
        },
        event_type: "node.deleted".to_string(),
        node_id: node_id.to_string(),
    }
}

pub fn create_connection_added_event(
    workflow_id: &str,
    data: serde_json::Value,
    graph_id: Option<String>,
) -> ConnectionAddedEvent {
    ConnectionAddedEvent {
        base: ZipEventBase {
            id: generate_event_id(),
            timestamp: current_timestamp(),
            workflow_id: workflow_id.to_string(),
            graph_id,
            metadata: None,
        },
        event_type: "connection.added".to_string(),
        data,
    }
}

pub fn create_connection_deleted_event(
    workflow_id: &str,
    data: serde_json::Value,
    graph_id: Option<String>,
) -> ConnectionDeletedEvent {
    ConnectionDeletedEvent {
        base: ZipEventBase {
            id: generate_event_id(),
            timestamp: current_timestamp(),
            workflow_id: workflow_id.to_string(),
            graph_id,
            metadata: None,
        },
        event_type: "connection.deleted".to_string(),
        data,
    }
}

pub fn create_group_created_event(
    workflow_id: &str,
    data: serde_json::Value,
    graph_id: Option<String>,
) -> GroupCreatedEvent {
    GroupCreatedEvent {
        base: ZipEventBase {
            id: generate_event_id(),
            timestamp: current_timestamp(),
            workflow_id: workflow_id.to_string(),
            graph_id,
            metadata: None,
        },
        event_type: "group.created".to_string(),
        data,
    }
}

pub fn create_group_updated_event(
    workflow_id: &str,
    data: serde_json::Value,
    graph_id: Option<String>,
) -> GroupUpdatedEvent {
    GroupUpdatedEvent {
        base: ZipEventBase {
            id: generate_event_id(),
            timestamp: current_timestamp(),
            workflow_id: workflow_id.to_string(),
            graph_id,
            metadata: None,
        },
        event_type: "group.updated".to_string(),
        data,
    }
}

pub fn create_group_deleted_event(
    workflow_id: &str,
    data: serde_json::Value,
    graph_id: Option<String>,
) -> GroupDeletedEvent {
    GroupDeletedEvent {
        base: ZipEventBase {
            id: generate_event_id(),
            timestamp: current_timestamp(),
            workflow_id: workflow_id.to_string(),
            graph_id,
            metadata: None,
        },
        event_type: "group.deleted".to_string(),
        data,
    }
}

pub fn create_template_registered_event(
    workflow_id: &str,
    data: serde_json::Value,
    graph_id: Option<String>,
) -> TemplateRegisteredEvent {
    TemplateRegisteredEvent {
        base: ZipEventBase {
            id: generate_event_id(),
            timestamp: current_timestamp(),
            workflow_id: workflow_id.to_string(),
            graph_id,
            metadata: None,
        },
        event_type: "template.registered".to_string(),
        data,
    }
}

pub fn create_trace_event_data(
    workflow_id: &str,
    session_id: &str,
    node_id: &str,
    data: serde_json::Value,
    graph_id: Option<String>,
) -> TraceEventData {
    TraceEventData {
        base: ZipEventBase {
            id: generate_event_id(),
            timestamp: current_timestamp(),
            workflow_id: workflow_id.to_string(),
            graph_id,
            metadata: None,
        },
        event_type: "trace.event".to_string(),
        session_id: session_id.to_string(),
        node_id: node_id.to_string(),
        data,
    }
}

/// Options for event creation
#[derive(Debug, Default)]
pub struct NodeCompletedOptions {
    pub graph_id: Option<String>,
    pub duration: Option<u64>,
    pub output_size: Option<u64>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Default)]
pub struct ExecutionStartedOptions {
    pub graph_id: Option<String>,
    pub trigger: Option<ExecutionTrigger>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Default)]
pub struct ExecutionCompletedOptions {
    pub graph_id: Option<String>,
    pub summary: Option<ExecutionSummary>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Default)]
pub struct ExecutionFailedOptions {
    pub graph_id: Option<String>,
    pub duration: Option<u64>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Utility functions
fn generate_event_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    let random_part = uuid::Uuid::new_v4()
        .to_string()
        .chars()
        .take(11)
        .collect::<String>();
    format!("evt_{}_{}", timestamp, random_part)
}

fn current_timestamp() -> String {
    chrono::Utc::now().to_rfc3339()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_node_executing_event() {
        let event = create_node_executing_event(
            "workflow-123",
            "node-456",
            vec!["conn-1".to_string(), "conn-2".to_string()],
            Some("main".to_string()),
        );

        assert_eq!(event.event_type, "node.executing");
        assert_eq!(event.base.workflow_id, "workflow-123");
        assert_eq!(event.node_id, "node-456");
        assert_eq!(event.input_connections, vec!["conn-1", "conn-2"]);
        assert_eq!(event.base.graph_id, Some("main".to_string()));
    }

    #[test]
    fn test_event_serialization() {
        let event = create_node_completed_event(
            "workflow-123",
            "node-456",
            vec!["conn-out".to_string()],
            Some(NodeCompletedOptions {
                duration: Some(150),
                output_size: Some(1024),
                ..Default::default()
            }),
        );

        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("node.completed"));
        assert!(json.contains("workflow-123"));

        let deserialized: NodeCompletedEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.event_type, "node.completed");
        assert_eq!(deserialized.duration, Some(150));
    }

    #[test]
    fn test_zip_execution_event_methods() {
        let event = ZipExecutionEvent::NodeExecuting(create_node_executing_event(
            "workflow-123",
            "node-456",
            vec![],
            None,
        ));

        assert_eq!(event.event_type(), "node.executing");
        assert_eq!(event.workflow_id(), "workflow-123");
        assert!(event.is_node_event());
        assert!(!event.is_execution_event());
    }

    #[test]
    fn test_type_guards() {
        assert!(is_execution_event("node.executing"));
        assert!(is_execution_event("execution.started"));
        assert!(!is_execution_event("workflow.created"));

        assert!(is_workflow_event("workflow.created"));
        assert!(!is_workflow_event("node.executing"));

        assert!(is_control_event("ping"));
        assert!(is_control_event("subscribe"));
        assert!(!is_control_event("node.executing"));

        assert!(is_node_event("node.executing"));
        assert!(!is_node_event("execution.started"));

        // Test CRDT event type guards
        assert!(is_crdt_event("node.added"));
        assert!(is_crdt_event("node.updated"));
        assert!(is_crdt_event("node.deleted"));
        assert!(is_crdt_event("connection.added"));
        assert!(is_crdt_event("connection.deleted"));
        assert!(is_crdt_event("group.created"));
        assert!(is_crdt_event("group.updated"));
        assert!(is_crdt_event("group.deleted"));
        assert!(is_crdt_event("template.registered"));
        assert!(is_crdt_event("trace.event"));
        assert!(!is_crdt_event("node.executing"));

        assert!(is_group_event("group.created"));
        assert!(is_group_event("group.updated"));
        assert!(!is_group_event("node.added"));

        assert!(is_connection_crdt_event("connection.added"));
        assert!(is_connection_crdt_event("connection.deleted"));
        assert!(!is_connection_crdt_event("connection.state"));

        assert!(is_template_event("template.registered"));
        assert!(!is_template_event("node.added"));
    }

    #[test]
    fn test_crdt_event_creation() {
        let data = serde_json::json!({"key": "value"});
        
        let node_added = create_node_added_event(
            "workflow-123",
            "node-456",
            data.clone(),
            Some("main".to_string()),
        );
        
        assert_eq!(node_added.event_type, "node.added");
        assert_eq!(node_added.base.workflow_id, "workflow-123");
        assert_eq!(node_added.node_id, "node-456");
        assert_eq!(node_added.base.graph_id, Some("main".to_string()));

        let group_created = create_group_created_event(
            "workflow-123",
            data.clone(),
            Some("main".to_string()),
        );
        
        assert_eq!(group_created.event_type, "group.created");
        assert_eq!(group_created.base.workflow_id, "workflow-123");
    }

    #[test]
    fn test_zip_crdt_event_methods() {
        let data = serde_json::json!({"test": "data"});
        let node_event = ZipCRDTEvent::NodeAdded(create_node_added_event(
            "workflow-123",
            "node-456",
            data.clone(),
            None,
        ));

        assert_eq!(node_event.event_type(), "node.added");
        assert_eq!(node_event.workflow_id(), "workflow-123");
        assert!(node_event.is_node_event());
        assert!(!node_event.is_group_event());

        let group_event = ZipCRDTEvent::GroupCreated(create_group_created_event(
            "workflow-123",
            data,
            None,
        ));

        assert!(group_event.is_group_event());
        assert!(!group_event.is_node_event());
    }

    #[test]
    fn test_event_id_generation() {
        let id1 = generate_event_id();
        let id2 = generate_event_id();
        
        assert_ne!(id1, id2);
        assert!(id1.starts_with("evt_"));
        assert!(id2.starts_with("evt_"));
    }
}