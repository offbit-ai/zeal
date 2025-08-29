//! Traces API for workflow execution tracing

use crate::types::*;
use crate::errors::{Result, ZealError};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitEventsResponse {
    pub success: bool,
    #[serde(rename = "eventsProcessed")]
    pub events_processed: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompleteSessionRequest {
    pub status: SessionCompletionStatus,
    pub summary: Option<SessionSummary>,
    pub error: Option<SessionError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SessionCompletionStatus {
    Success,
    Error,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSummary {
    #[serde(rename = "totalNodes")]
    pub total_nodes: u32,
    #[serde(rename = "successfulNodes")]
    pub successful_nodes: u32,
    #[serde(rename = "failedNodes")]
    pub failed_nodes: u32,
    #[serde(rename = "totalDuration")]
    pub total_duration: u64,
    #[serde(rename = "totalDataProcessed")]
    pub total_data_processed: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionError {
    pub message: String,
    #[serde(rename = "nodeId")]
    pub node_id: Option<String>,
    pub stack: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompleteSessionResponse {
    pub success: bool,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchTraceRequest {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub events: Vec<TraceEvent>,
    #[serde(rename = "isComplete")]
    pub is_complete: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchTraceResponse {
    pub success: bool,
}

/// Traces API for managing execution traces
pub struct TracesAPI {
    base_url: String,
    client: Client,
    session_id: Option<String>,
}

impl TracesAPI {
    /// Create a new Traces API instance
    pub fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.to_string(),
            client: Client::new(),
            session_id: None,
        }
    }

    /// Create a new Traces API instance with custom HTTP client
    pub fn with_client(base_url: &str, client: Client) -> Self {
        Self {
            base_url: base_url.to_string(),
            client,
            session_id: None,
        }
    }

    /// Create a new trace session
    pub async fn create_session(&mut self, request: CreateTraceSessionRequest) -> Result<CreateTraceSessionResponse> {
        let url = format!("{}/api/zip/traces/sessions", self.base_url.trim_end_matches('/'));
        
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
                format!("Failed to create trace session: {}", status),
                Some(error_text),
            ));
        }

        let session_response = response.json::<CreateTraceSessionResponse>().await?;
        self.session_id = Some(session_response.session_id.clone());
        Ok(session_response)
    }

    /// Submit trace events
    pub async fn submit_events(&self, session_id: &str, events: Vec<TraceEvent>) -> Result<SubmitEventsResponse> {
        let url = format!(
            "{}/api/zip/traces/{}/events", 
            self.base_url.trim_end_matches('/'), 
            session_id
        );
        
        let request_body = serde_json::json!({
            "events": events
        });
        
        let response = self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(ZealError::api_error(
                status.as_u16(),
                format!("Failed to submit trace events: {}", status),
                Some(error_text),
            ));
        }

        let submit_response = response.json::<SubmitEventsResponse>().await?;
        Ok(submit_response)
    }

    /// Submit a single trace event
    pub async fn submit_event(&self, session_id: &str, event: TraceEvent) -> Result<SubmitEventsResponse> {
        self.submit_events(session_id, vec![event]).await
    }

    /// Complete a trace session
    pub async fn complete_session(&mut self, session_id: &str, request: CompleteSessionRequest) -> Result<CompleteSessionResponse> {
        let url = format!(
            "{}/api/zip/traces/{}/complete", 
            self.base_url.trim_end_matches('/'), 
            session_id
        );
        
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
                format!("Failed to complete trace session: {}", status),
                Some(error_text),
            ));
        }

        let complete_response = response.json::<CompleteSessionResponse>().await?;
        
        if self.session_id.as_deref() == Some(session_id) {
            self.session_id = None;
        }
        
        Ok(complete_response)
    }

    /// Helper method to trace node execution
    pub async fn trace_node_execution(
        &self,
        session_id: &str,
        node_id: &str,
        event_type: TraceEventType,
        data: serde_json::Value,
        duration: Option<std::time::Duration>,
    ) -> Result<()> {
        let data_str = serde_json::to_string(&data)?;
        let trace_data = TraceData {
            size: data_str.len(),
            data_type: "application/json".to_string(),
            preview: Some(data.clone()),
            full_data: Some(data),
        };

        let event = TraceEvent {
            timestamp: chrono::Utc::now().timestamp_millis(),
            node_id: node_id.to_string(),
            port_id: None,
            event_type,
            data: trace_data,
            duration,
            metadata: None,
            error: None,
        };

        self.submit_event(session_id, event).await?;
        Ok(())
    }

    /// Batch trace submission
    pub async fn submit_batch(&self, request: BatchTraceRequest) -> Result<BatchTraceResponse> {
        let url = format!("{}/api/zip/traces/batch", self.base_url.trim_end_matches('/'));
        
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
                format!("Failed to submit batch trace: {}", status),
                Some(error_text),
            ));
        }

        let batch_response = response.json::<BatchTraceResponse>().await?;
        Ok(batch_response)
    }

    /// Get the current session ID
    pub fn current_session_id(&self) -> Option<&str> {
        self.session_id.as_deref()
    }
}

/// Re-export trace types from types.rs for convenience
pub use crate::types::{TraceEvent, TraceEventType, TraceStatus};