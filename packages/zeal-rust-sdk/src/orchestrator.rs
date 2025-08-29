//! Orchestrator API for workflow management

use crate::types::*;
use crate::errors::{Result, ZealError};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListWorkflowsParams {
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListWorkflowsResponse {
    pub workflows: Vec<serde_json::Value>,
    pub total: u32,
    pub limit: u32,
    pub offset: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowState {
    #[serde(rename = "workflowId")]
    pub workflow_id: String,
    #[serde(rename = "graphId")]
    pub graph_id: String,
    pub name: String,
    pub description: String,
    pub version: u32,
    pub state: WorkflowStateData,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStateData {
    pub nodes: Vec<serde_json::Value>,
    pub connections: Vec<serde_json::Value>,
    pub groups: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateNodeRequest {
    #[serde(rename = "workflowId")]
    pub workflow_id: String,
    #[serde(rename = "graphId")]
    pub graph_id: Option<String>,
    pub properties: Option<HashMap<String, serde_json::Value>>,
    pub position: Option<Position>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateNodeResponse {
    pub success: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteNodeResponse {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionResponse {
    #[serde(rename = "connectionId")]
    pub connection_id: String,
    pub connection: serde_json::Value,
}

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateGroupResponse {
    pub success: bool,
    #[serde(rename = "groupId")]
    pub group_id: String,
    pub group: serde_json::Value,
}

/// Orchestrator API for creating and managing workflows
pub struct OrchestratorAPI {
    base_url: String,
    client: Client,
}

impl OrchestratorAPI {
    /// Create a new Orchestrator API instance
    pub fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.to_string(),
            client: Client::new(),
        }
    }

    /// Create a new Orchestrator API instance with custom HTTP client
    pub fn with_client(base_url: &str, client: Client) -> Self {
        Self {
            base_url: base_url.to_string(),
            client,
        }
    }

    /// Create a new workflow
    pub async fn create_workflow(&self, request: CreateWorkflowRequest) -> Result<CreateWorkflowResponse> {
        let url = format!("{}/api/zip/orchestrator/workflows", self.base_url.trim_end_matches('/'));
        
        let response = self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(ZealError::api_error(
                status.as_u16(),
                format!("Failed to create workflow: {}", status),
                Some(error_text),
            ));
        }

        let workflow_response = response.json::<CreateWorkflowResponse>().await?;
        Ok(workflow_response)
    }

    /// List workflows
    pub async fn list_workflows(&self, params: Option<ListWorkflowsParams>) -> Result<ListWorkflowsResponse> {
        let mut url = format!("{}/api/zip/orchestrator/workflows", self.base_url.trim_end_matches('/'));
        
        if let Some(params) = params {
            let mut query_params = Vec::new();
            if let Some(limit) = params.limit {
                query_params.push(format!("limit={}", limit));
            }
            if let Some(offset) = params.offset {
                query_params.push(format!("offset={}", offset));
            }
            if !query_params.is_empty() {
                url.push('?');
                url.push_str(&query_params.join("&"));
            }
        }

        let response = self.client.get(&url).send().await?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(ZealError::api_error(
                status.as_u16(),
                format!("Failed to list workflows: {}", status),
                Some(error_text),
            ));
        }

        let workflows_response = response.json::<ListWorkflowsResponse>().await?;
        Ok(workflows_response)
    }

    /// Get workflow state
    pub async fn get_workflow_state(&self, workflow_id: &str, graph_id: Option<&str>) -> Result<WorkflowState> {
        let graph_id = graph_id.unwrap_or("main");
        let url = format!(
            "{}/api/zip/orchestrator/workflows/{}/state?graphId={}",
            self.base_url.trim_end_matches('/'),
            workflow_id,
            graph_id
        );

        let response = self.client.get(&url).send().await?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(ZealError::api_error(
                status.as_u16(),
                format!("Failed to get workflow state: {}", status),
                Some(error_text),
            ));
        }

        let state = response.json::<WorkflowState>().await?;
        Ok(state)
    }

    /// Add a node to a workflow
    pub async fn add_node(&self, request: AddNodeRequest) -> Result<AddNodeResponse> {
        let url = format!("{}/api/zip/orchestrator/nodes", self.base_url.trim_end_matches('/'));
        
        let response = self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(ZealError::api_error(
                status.as_u16(),
                format!("Failed to add node: {}", status),
                Some(error_text),
            ));
        }

        let node_response = response.json::<AddNodeResponse>().await?;
        Ok(node_response)
    }

    /// Update node properties
    pub async fn update_node(&self, node_id: &str, updates: UpdateNodeRequest) -> Result<UpdateNodeResponse> {
        let url = format!("{}/api/zip/orchestrator/nodes/{}", self.base_url.trim_end_matches('/'), node_id);
        
        let response = self.client
            .patch(&url)
            .header("Content-Type", "application/json")
            .json(&updates)
            .send()
            .await?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(ZealError::api_error(
                status.as_u16(),
                format!("Failed to update node: {}", status),
                Some(error_text),
            ));
        }

        let update_response = response.json::<UpdateNodeResponse>().await?;
        Ok(update_response)
    }

    /// Delete a node
    pub async fn delete_node(&self, node_id: &str, workflow_id: &str, graph_id: Option<&str>) -> Result<DeleteNodeResponse> {
        let graph_id = graph_id.unwrap_or("main");
        let url = format!(
            "{}/api/zip/orchestrator/nodes/{}?workflowId={}&graphId={}",
            self.base_url.trim_end_matches('/'),
            node_id,
            workflow_id,
            graph_id
        );

        let response = self.client.delete(&url).send().await?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(ZealError::api_error(
                status.as_u16(),
                format!("Failed to delete node: {}", status),
                Some(error_text),
            ));
        }

        let delete_response = response.json::<DeleteNodeResponse>().await?;
        Ok(delete_response)
    }

    /// Connect two nodes
    pub async fn connect_nodes(&self, request: ConnectNodesRequest) -> Result<ConnectionResponse> {
        let url = format!("{}/api/zip/orchestrator/connections", self.base_url.trim_end_matches('/'));
        
        let response = self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(ZealError::api_error(
                status.as_u16(),
                format!("Failed to connect nodes: {}", status),
                Some(error_text),
            ));
        }

        let connection_response = response.json::<ConnectionResponse>().await?;
        Ok(connection_response)
    }

    /// Create a node group
    pub async fn create_group(&self, request: CreateGroupRequest) -> Result<CreateGroupResponse> {
        let url = format!("{}/api/zip/orchestrator/groups", self.base_url.trim_end_matches('/'));
        
        let response = self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(ZealError::api_error(
                status.as_u16(),
                format!("Failed to create group: {}", status),
                Some(error_text),
            ));
        }

        let group_response = response.json::<CreateGroupResponse>().await?;
        Ok(group_response)
    }
    
    /// Remove a connection between nodes
    pub async fn remove_connection(&self, request: RemoveConnectionRequest) -> Result<RemoveConnectionResponse> {
        let url = format!("{}/api/zip/orchestrator/connections", self.base_url.trim_end_matches('/'));
        
        let response = self.client
            .delete(&url)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(ZealError::api_error(
                status.as_u16(),
                format!("Failed to remove connection: {}", status),
                Some(error_text),
            ));
        }

        let remove_response = response.json::<RemoveConnectionResponse>().await?;
        Ok(remove_response)
    }
    
    /// Update group properties
    pub async fn update_group(&self, request: UpdateGroupRequest) -> Result<UpdateGroupResponse> {
        let url = format!("{}/api/zip/orchestrator/groups", self.base_url.trim_end_matches('/'));
        
        let response = self.client
            .patch(&url)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(ZealError::api_error(
                status.as_u16(),
                format!("Failed to update group: {}", status),
                Some(error_text),
            ));
        }

        let update_response = response.json::<UpdateGroupResponse>().await?;
        Ok(update_response)
    }
    
    /// Remove a group
    pub async fn remove_group(&self, request: RemoveGroupRequest) -> Result<RemoveGroupResponse> {
        let url = format!("{}/api/zip/orchestrator/groups", self.base_url.trim_end_matches('/'));
        
        let response = self.client
            .delete(&url)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(ZealError::api_error(
                status.as_u16(),
                format!("Failed to remove group: {}", status),
                Some(error_text),
            ));
        }

        let remove_response = response.json::<RemoveGroupResponse>().await?;
        Ok(remove_response)
    }
}