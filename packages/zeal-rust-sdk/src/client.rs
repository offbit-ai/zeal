//! Main ZealClient for the Rust SDK

use crate::config::ClientConfig;
use crate::errors::{Result, ZealError};
use crate::types::HealthCheckResponse;
use crate::templates::TemplatesAPI;
use crate::orchestrator::OrchestratorAPI;
use crate::traces::TracesAPI;
use crate::webhooks::WebhooksAPI;
use crate::subscription::{WebhookSubscription, SubscriptionOptions};
use std::sync::Arc;

/// Main client for interacting with the Zeal Integration Protocol
pub struct ZealClient {
    config: ClientConfig,
    http_client: reqwest::Client,
    templates_api: TemplatesAPI,
    orchestrator_api: OrchestratorAPI,
    traces_api: TracesAPI,
    webhooks_api: WebhooksAPI,
}

impl ZealClient {
    /// Create a new ZealClient with the given configuration
    pub fn new(config: ClientConfig) -> Result<Self> {
        // Validate configuration
        if config.base_url.is_empty() {
            return Err(ZealError::configuration_error("Base URL cannot be empty"));
        }

        // Build HTTP client with performance optimizations
        let mut client_builder = reqwest::Client::builder()
            .timeout(config.default_timeout)
            .pool_idle_timeout(config.performance.idle_timeout)
            .pool_max_idle_per_host(config.performance.max_idle_connections)
            .tcp_keepalive(config.performance.tcp_keepalive)
            .user_agent(&config.user_agent);

        // Configure TLS
        if !config.verify_tls {
            client_builder = client_builder.danger_accept_invalid_certs(true);
        }

        // Enable HTTP/2 if configured
        if config.performance.http2_prior_knowledge {
            client_builder = client_builder.http2_prior_knowledge();
        }

        // Enable compression if configured
        if config.performance.compression {
            // Note: reqwest enables gzip by default when json feature is enabled
            // client_builder = client_builder.gzip(true);
        }

        let http_client = client_builder.build()?;

        // Initialize API modules with shared HTTP client
        let base_url = &config.base_url;
        let templates_api = TemplatesAPI::with_client(base_url, http_client.clone());
        let orchestrator_api = OrchestratorAPI::with_client(base_url, http_client.clone());
        let traces_api = TracesAPI::with_client(base_url, http_client.clone());
        let webhooks_api = WebhooksAPI::with_client(base_url, http_client.clone());

        Ok(Self {
            config,
            http_client,
            templates_api,
            orchestrator_api,
            traces_api,
            webhooks_api,
        })
    }

    /// Health check endpoint
    pub async fn health(&self) -> Result<HealthCheckResponse> {
        let url = format!("{}/api/zip/health", self.config.base_url.trim_end_matches('/'));
        
        let response = self.http_client
            .get(&url)
            .send()
            .await?;

        let status = response.status();
        if !status.is_success() {
            return Err(ZealError::api_error(
                status.as_u16(),
                format!("Health check failed: {}", status),
                None,
            ));
        }

        let health_response = response.json::<HealthCheckResponse>().await?;
        Ok(health_response)
    }

    /// Get the base URL
    pub fn base_url(&self) -> &str {
        &self.config.base_url
    }

    /// Get the HTTP client for internal use
    pub(crate) fn http_client(&self) -> &reqwest::Client {
        &self.http_client
    }

    /// Get the client configuration
    pub fn config(&self) -> &ClientConfig {
        &self.config
    }

    /// Access the Templates API
    pub fn templates(&self) -> &TemplatesAPI {
        &self.templates_api
    }

    /// Access the Orchestrator API
    pub fn orchestrator(&self) -> &OrchestratorAPI {
        &self.orchestrator_api
    }

    /// Access the Traces API
    pub fn traces(&self) -> &TracesAPI {
        &self.traces_api
    }

    /// Access the Webhooks API
    pub fn webhooks(&self) -> &WebhooksAPI {
        &self.webhooks_api
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::ClientConfig;

    #[test]
    fn test_client_creation() {
        let config = ClientConfig {
            base_url: "http://localhost:3000".to_string(),
            ..Default::default()
        };

        let client = ZealClient::new(config);
        assert!(client.is_ok());
    }

    #[test]
    fn test_client_creation_empty_url() {
        let config = ClientConfig {
            base_url: "".to_string(),
            ..Default::default()
        };

        let client = ZealClient::new(config);
        assert!(client.is_err());
    }

    #[test]
    fn test_base_url() {
        let config = ClientConfig {
            base_url: "http://localhost:3000".to_string(),
            ..Default::default()
        };

        let client = ZealClient::new(config).unwrap();
        assert_eq!(client.base_url(), "http://localhost:3000");
    }
}