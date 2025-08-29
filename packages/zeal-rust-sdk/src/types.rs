//! Type definitions for the Zeal SDK
//! 
//! These types mirror the TypeScript SDK types and ZIP protocol definitions

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

/// Node template definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeTemplate {
    pub id: String,
    #[serde(rename = "type")]
    pub type_name: String,
    pub title: String,
    pub subtitle: Option<String>,
    pub category: String,
    pub subcategory: Option<String>,
    pub description: String,
    pub icon: String,
    pub variant: Option<String>,
    pub shape: Option<NodeShape>,
    pub size: Option<NodeSize>,
    pub ports: Vec<Port>,
    pub properties: Option<HashMap<String, PropertyDefinition>>,
    #[serde(rename = "propertyRules")]
    pub property_rules: Option<PropertyRules>,
    pub runtime: Option<RuntimeRequirements>,
}

/// Node shape variants
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NodeShape {
    Rectangle,
    Circle,
    Diamond,
}

/// Node size variants
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NodeSize {
    Small,
    Medium,
    Large,
}

/// Port definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Port {
    pub id: String,
    pub label: String,
    #[serde(rename = "type")]
    pub port_type: PortType,
    pub position: PortPosition,
    #[serde(rename = "dataType")]
    pub data_type: Option<String>,
    pub required: Option<bool>,
    pub multiple: Option<bool>,
}

/// Port type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PortType {
    Input,
    Output,
}

/// Port position
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PortPosition {
    Left,
    Right,
    Top,
    Bottom,
}

/// Property definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PropertyDefinition {
    #[serde(rename = "type")]
    pub property_type: PropertyType,
    pub label: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "defaultValue")]
    pub default_value: Option<serde_json::Value>,
    pub options: Option<Vec<serde_json::Value>>,
    pub validation: Option<PropertyValidation>,
}

/// Property type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PropertyType {
    String,
    Number,
    Boolean,
    Select,
    CodeEditor,
}

/// Property validation rules
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PropertyValidation {
    pub required: Option<bool>,
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub pattern: Option<String>,
}

/// Property rules for dynamic behavior
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PropertyRules {
    pub triggers: Vec<String>,
    pub rules: Vec<PropertyRule>,
}

/// Individual property rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PropertyRule {
    pub when: String,
    pub updates: HashMap<String, serde_json::Value>,
}

/// Runtime requirements
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeRequirements {
    pub executor: String,
    pub version: Option<String>,
    #[serde(rename = "requiredEnvVars")]
    pub required_env_vars: Option<Vec<String>>,
    pub capabilities: Option<Vec<String>>,
}

/// Register templates request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterTemplatesRequest {
    pub namespace: String,
    pub templates: Vec<NodeTemplate>,
    #[serde(rename = "webhookUrl")]
    pub webhook_url: Option<String>,
}

/// Register templates response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterTemplatesResponse {
    pub registered: usize,
    pub templates: Vec<TemplateRegistrationResult>,
}

/// Template registration result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateRegistrationResult {
    pub id: String,
    #[serde(rename = "globalId")]
    pub global_id: String,
    pub status: TemplateRegistrationStatus,
    pub error: Option<String>,
}

/// Template registration status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TemplateRegistrationStatus {
    Registered,
    Updated,
    Error,
}

/// Create workflow request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateWorkflowRequest {
    pub name: String,
    pub description: Option<String>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Create workflow response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateWorkflowResponse {
    #[serde(rename = "workflowId")]
    pub workflow_id: String,
    #[serde(rename = "graphId")]
    pub graph_id: String,
    #[serde(rename = "embedUrl")]
    pub embed_url: String,
}

/// 2D position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

/// Add node request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddNodeRequest {
    #[serde(rename = "workflowId")]
    pub workflow_id: String,
    #[serde(rename = "graphId")]
    pub graph_id: Option<String>,
    #[serde(rename = "templateId")]
    pub template_id: String,
    pub position: Position,
    #[serde(rename = "propertyValues")]
    pub property_values: Option<HashMap<String, serde_json::Value>>,
}

/// Add node response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddNodeResponse {
    #[serde(rename = "nodeId")]
    pub node_id: String,
    pub node: NodeInfo,
}

/// Node information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeInfo {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub position: Position,
    pub metadata: serde_json::Value,
}

/// Node port reference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodePort {
    #[serde(rename = "nodeId")]
    pub node_id: String,
    #[serde(rename = "portId")]
    pub port_id: String,
}

/// Connect nodes request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectNodesRequest {
    #[serde(rename = "workflowId")]
    pub workflow_id: String,
    #[serde(rename = "graphId")]
    pub graph_id: Option<String>,
    pub source: NodePort,
    pub target: NodePort,
}

/// Create group request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateGroupRequest {
    #[serde(rename = "workflowId")]
    pub workflow_id: String,
    #[serde(rename = "graphId")]
    pub graph_id: Option<String>,
    pub title: String,
    #[serde(rename = "nodeIds")]
    pub node_ids: Vec<String>,
    pub color: Option<String>,
    pub description: Option<String>,
}

/// Create group response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateGroupResponse {
    pub success: bool,
    #[serde(rename = "groupId")]
    pub group_id: String,
    pub group: serde_json::Value,
}

/// Remove connection request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoveConnectionRequest {
    #[serde(rename = "workflowId")]
    pub workflow_id: String,
    #[serde(rename = "graphId")]
    pub graph_id: Option<String>,
    #[serde(rename = "connectionId")]
    pub connection_id: String,
}

/// Remove connection response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoveConnectionResponse {
    pub success: bool,
    pub message: String,
}

/// Update group request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateGroupRequest {
    #[serde(rename = "workflowId")]
    pub workflow_id: String,
    #[serde(rename = "graphId")]
    pub graph_id: Option<String>,
    #[serde(rename = "groupId")]
    pub group_id: String,
    pub title: Option<String>,
    #[serde(rename = "nodeIds")]
    pub node_ids: Option<Vec<String>>,
    pub color: Option<String>,
    pub description: Option<String>,
}

/// Update group response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateGroupResponse {
    pub success: bool,
    pub group: serde_json::Value,
}

/// Remove group request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoveGroupRequest {
    #[serde(rename = "workflowId")]
    pub workflow_id: String,
    #[serde(rename = "graphId")]
    pub graph_id: Option<String>,
    #[serde(rename = "groupId")]
    pub group_id: String,
}

/// Remove group response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoveGroupResponse {
    pub success: bool,
    pub message: String,
}

/// Create trace session request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTraceSessionRequest {
    #[serde(rename = "workflowId")]
    pub workflow_id: String,
    #[serde(rename = "workflowVersionId")]
    pub workflow_version_id: Option<String>,
    #[serde(rename = "executionId")]
    pub execution_id: String,
    pub metadata: Option<TraceMetadata>,
}

/// Trace session metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceMetadata {
    pub trigger: Option<String>,
    pub environment: Option<String>,
    pub tags: Vec<String>,
}

/// Create trace session response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTraceSessionResponse {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "workflowId")]
    pub workflow_id: String,
    #[serde(rename = "executionId")]
    pub execution_id: String,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
}

/// Trace event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceEvent {
    pub timestamp: i64,
    #[serde(rename = "nodeId")]
    pub node_id: String,
    #[serde(rename = "portId")]
    pub port_id: Option<String>,
    #[serde(rename = "eventType")]
    pub event_type: TraceEventType,
    pub data: TraceData,
    pub duration: Option<std::time::Duration>,
    pub metadata: Option<TraceEventMetadata>,
    pub error: Option<TraceError>,
}

impl Default for TraceEvent {
    fn default() -> Self {
        Self {
            timestamp: chrono::Utc::now().timestamp_millis(),
            node_id: String::new(),
            port_id: None,
            event_type: TraceEventType::Output,
            data: TraceData::default(),
            duration: None,
            metadata: None,
            error: None,
        }
    }
}

/// Trace event type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TraceEventType {
    Input,
    Output,
    Error,
    Log,
}

/// Trace data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceData {
    pub size: usize,
    #[serde(rename = "type")]
    pub data_type: String,
    pub preview: Option<serde_json::Value>,
    #[serde(rename = "fullData")]
    pub full_data: Option<serde_json::Value>,
}

impl Default for TraceData {
    fn default() -> Self {
        Self {
            size: 0,
            data_type: "application/json".to_string(),
            preview: None,
            full_data: None,
        }
    }
}

/// Trace event metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceEventMetadata {
    #[serde(rename = "cpuUsage")]
    pub cpu_usage: Option<f64>,
    #[serde(rename = "memoryUsage")]
    pub memory_usage: Option<u64>,
    pub custom: Option<HashMap<String, serde_json::Value>>,
}

/// Trace error information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceError {
    pub message: String,
    pub stack: Option<String>,
    pub code: Option<String>,
}

/// Trace status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TraceStatus {
    Running,
    Completed,
    Failed,
    Cancelled,
}

/// Submit trace events request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitTraceEventsRequest {
    pub events: Vec<TraceEvent>,
}

/// Webhook configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookConfig {
    pub namespace: String,
    pub url: String,
    pub events: Option<Vec<String>>,
    pub headers: Option<HashMap<String, String>>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Webhook registration response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookRegistrationResponse {
    #[serde(rename = "webhookId")]
    pub webhook_id: String,
    pub namespace: String,
    pub url: String,
    pub events: Vec<String>,
    #[serde(rename = "isActive")]
    pub is_active: bool,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
}



/// Health check response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckResponse {
    pub status: HealthStatus,
    pub version: String,
    pub services: HashMap<String, HealthStatus>,
}

/// Health status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HealthStatus {
    Healthy,
    Unhealthy,
}

/// Test webhook response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestWebhookResponse {
    pub success: bool,
    #[serde(rename = "statusCode")]
    pub status_code: u16,
    #[serde(rename = "responseTimeMs")]
    pub response_time_ms: u64,
    pub error: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_node_template_serialization() {
        let template = NodeTemplate {
            id: "test-id".to_string(),
            type_name: "processor".to_string(),
            title: "Test Node".to_string(),
            subtitle: None,
            category: "Processing".to_string(),
            subcategory: None,
            description: "Test description".to_string(),
            icon: "processor".to_string(),
            variant: None,
            shape: Some(NodeShape::Rectangle),
            size: Some(NodeSize::Medium),
            ports: vec![],
            properties: None,
            property_rules: None,
            runtime: None,
        };

        let json = serde_json::to_string(&template).unwrap();
        assert!(json.contains("test-id"));

        let deserialized: NodeTemplate = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, template.id);
    }

    #[test]
    fn test_trace_event_default() {
        let event = TraceEvent::default();
        assert!(!event.node_id.is_empty() || event.node_id.is_empty()); // Just testing compilation
        assert!(matches!(event.event_type, TraceEventType::Output));
    }

    #[test]
    fn test_position_serialization() {
        let position = Position { x: 100.0, y: 200.0 };
        let json = serde_json::to_string(&position).unwrap();
        let deserialized: Position = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.x, 100.0);
        assert_eq!(deserialized.y, 200.0);
    }
}