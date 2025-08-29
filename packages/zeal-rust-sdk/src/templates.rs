//! Templates API for managing node templates

use crate::types::*;
use crate::errors::{Result, ZealError};
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListTemplatesResponse {
    pub namespace: String,
    pub templates: Vec<NodeTemplate>,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTemplateResponse {
    pub success: bool,
    pub template: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteTemplateResponse {
    pub success: bool,
    pub message: String,
}

/// Templates API for managing node templates
pub struct TemplatesAPI {
    base_url: String,
    client: Client,
}

impl TemplatesAPI {
    /// Create a new Templates API instance
    pub fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.to_string(),
            client: Client::new(),
        }
    }

    /// Create a new Templates API instance with custom HTTP client
    pub fn with_client(base_url: &str, client: Client) -> Self {
        Self {
            base_url: base_url.to_string(),
            client,
        }
    }

    /// Register node templates
    pub async fn register(&self, request: RegisterTemplatesRequest) -> Result<RegisterTemplatesResponse> {
        let url = format!("{}/api/zip/templates/register", self.base_url.trim_end_matches('/'));
        
        let response = self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(ZealError::api_error(
                status.as_u16(),
                format!("Failed to register templates: {}", status),
                Some(error_text),
            ));
        }

        let registration_response = response.json::<RegisterTemplatesResponse>().await?;
        Ok(registration_response)
    }

    /// List templates for a namespace
    pub async fn list(&self, namespace: &str) -> Result<ListTemplatesResponse> {
        let url = format!(
            "{}/api/zip/templates/{}", 
            self.base_url.trim_end_matches('/'), 
            namespace
        );
        
        let response = self.client.get(&url).send().await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(ZealError::api_error(
                status.as_u16(),
                format!("Failed to list templates: {}", status),
                Some(error_text),
            ));
        }

        let templates_response = response.json::<ListTemplatesResponse>().await?;
        Ok(templates_response)
    }

    /// Update a template
    pub async fn update(
        &self, 
        namespace: &str, 
        template_id: &str, 
        updates: NodeTemplate
    ) -> Result<UpdateTemplateResponse> {
        let url = format!(
            "{}/api/zip/templates/{}/{}", 
            self.base_url.trim_end_matches('/'), 
            namespace, 
            template_id
        );
        
        let response = self.client
            .put(&url)
            .header("Content-Type", "application/json")
            .json(&updates)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(ZealError::api_error(
                status.as_u16(),
                format!("Failed to update template: {}", status),
                Some(error_text),
            ));
        }

        let update_response = response.json::<UpdateTemplateResponse>().await?;
        Ok(update_response)
    }

    /// Delete a template
    pub async fn delete(&self, namespace: &str, template_id: &str) -> Result<DeleteTemplateResponse> {
        let url = format!(
            "{}/api/zip/templates/{}/{}", 
            self.base_url.trim_end_matches('/'), 
            namespace, 
            template_id
        );
        
        let response = self.client.delete(&url).send().await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(ZealError::api_error(
                status.as_u16(),
                format!("Failed to delete template: {}", status),
                Some(error_text),
            ));
        }

        let delete_response = response.json::<DeleteTemplateResponse>().await?;
        Ok(delete_response)
    }

    /// Get a specific template (convenience method)
    pub async fn get(&self, namespace: &str, template_id: &str) -> Result<NodeTemplate> {
        let templates = self.list(namespace).await?;
        
        templates.templates
            .into_iter()
            .find(|t| t.id == template_id)
            .ok_or_else(|| ZealError::not_found("template", template_id))
    }
}