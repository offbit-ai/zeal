//! Webhooks API for managing webhook subscriptions

use crate::types::*;
use crate::errors::{Result, ZealError};
use reqwest::Client;
use serde::{Deserialize, Serialize};

/// Webhooks API for managing webhook subscriptions
pub struct WebhooksAPI {
    base_url: String,
    client: Client,
}

impl WebhooksAPI {
    /// Create a new Webhooks API instance
    pub fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.to_string(),
            client: Client::new(),
        }
    }

    /// Create a new Webhooks API instance with custom HTTP client
    pub fn with_client(base_url: &str, client: Client) -> Self {
        Self {
            base_url: base_url.to_string(),
            client,
        }
    }

    /// Register a new webhook
    pub async fn register(&self, config: WebhookConfig) -> Result<WebhookRegistrationResponse> {
        let url = format!("{}/api/zip/webhooks/register", self.base_url.trim_end_matches('/'));
        
        let response = self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&config)
            .send()
            .await?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(ZealError::api_error(
                status.as_u16(),
                format!("Failed to register webhook: {}", status),
                Some(error_text),
            ));
        }

        let registration_response = response.json::<WebhookRegistrationResponse>().await?;
        Ok(registration_response)
    }

    /// List webhooks for a namespace
    pub async fn list(&self, namespace: &str) -> Result<Vec<WebhookRegistrationResponse>> {
        let url = format!(
            "{}/api/zip/webhooks?namespace={}", 
            self.base_url.trim_end_matches('/'), 
            namespace
        );
        
        let response = self.client.get(&url).send().await?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(ZealError::api_error(
                status.as_u16(),
                format!("Failed to list webhooks: {}", status),
                Some(error_text),
            ));
        }

        let webhooks = response.json::<Vec<WebhookRegistrationResponse>>().await?;
        Ok(webhooks)
    }

    /// Update a webhook
    pub async fn update(&self, webhook_id: &str, config: WebhookConfig) -> Result<WebhookRegistrationResponse> {
        let url = format!(
            "{}/api/zip/webhooks/{}", 
            self.base_url.trim_end_matches('/'), 
            webhook_id
        );
        
        let response = self.client
            .put(&url)
            .header("Content-Type", "application/json")
            .json(&config)
            .send()
            .await?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(ZealError::api_error(
                status.as_u16(),
                format!("Failed to update webhook: {}", status),
                Some(error_text),
            ));
        }

        let update_response = response.json::<WebhookRegistrationResponse>().await?;
        Ok(update_response)
    }

    /// Delete a webhook
    pub async fn delete(&self, webhook_id: &str) -> Result<()> {
        let url = format!(
            "{}/api/zip/webhooks/{}", 
            self.base_url.trim_end_matches('/'), 
            webhook_id
        );
        
        let response = self.client.delete(&url).send().await?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(ZealError::api_error(
                status.as_u16(),
                format!("Failed to delete webhook: {}", status),
                Some(error_text),
            ));
        }

        Ok(())
    }

    /// Get a specific webhook by ID
    pub async fn get(&self, webhook_id: &str) -> Result<WebhookRegistrationResponse> {
        let url = format!(
            "{}/api/zip/webhooks/{}", 
            self.base_url.trim_end_matches('/'), 
            webhook_id
        );
        
        let response = self.client.get(&url).send().await?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(ZealError::api_error(
                status.as_u16(),
                format!("Failed to get webhook: {}", status),
                Some(error_text),
            ));
        }

        let webhook = response.json::<WebhookRegistrationResponse>().await?;
        Ok(webhook)
    }

    /// Test a webhook endpoint
    pub async fn test(&self, webhook_id: &str) -> Result<TestWebhookResponse> {
        let url = format!(
            "{}/api/zip/webhooks/{}/test", 
            self.base_url.trim_end_matches('/'), 
            webhook_id
        );
        
        let response = self.client.post(&url).send().await?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(ZealError::api_error(
                status.as_u16(),
                format!("Failed to test webhook: {}", status),
                Some(error_text),
            ));
        }

        let test_response = response.json::<TestWebhookResponse>().await?;
        Ok(test_response)
    }
}

/// Test webhook response
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TestWebhookResponse {
    pub success: bool,
    pub status_code: u16,
    pub response_time_ms: u64,
    pub error: Option<String>,
}