//! Configuration types for the Zeal SDK

use std::time::Duration;

/// Main configuration for the Zeal client
#[derive(Debug, Clone)]
pub struct ClientConfig {
    /// Base URL of the Zeal server
    pub base_url: String,
    
    /// WebSocket path (defaults to "/ws/zip")
    pub websocket_path: Option<String>,
    
    /// Performance-related configuration
    pub performance: PerformanceConfig,
    
    /// Authentication configuration
    pub auth: Option<AuthConfig>,
    
    /// User agent string
    pub user_agent: String,
    
    /// Default timeout for API requests
    pub default_timeout: Duration,
    
    /// Enable TLS certificate verification
    pub verify_tls: bool,
}

impl Default for ClientConfig {
    fn default() -> Self {
        Self {
            base_url: "http://localhost:3000".to_string(),
            websocket_path: None,
            performance: PerformanceConfig::default(),
            auth: None,
            user_agent: format!("zeal-rust-sdk/{}", crate::VERSION),
            default_timeout: Duration::from_secs(30),
            verify_tls: true,
        }
    }
}

/// Performance-related configuration
#[derive(Debug, Clone)]
pub struct PerformanceConfig {
    /// Maximum number of connections per host
    pub max_connections_per_host: usize,
    
    /// Connection timeout
    pub connection_timeout: Duration,
    
    /// Request timeout
    pub request_timeout: Duration,
    
    /// TCP keepalive duration
    pub tcp_keepalive: Option<Duration>,
    
    /// Enable HTTP/2 prior knowledge
    pub http2_prior_knowledge: bool,
    
    /// Enable connection pooling
    pub connection_pooling: bool,
    
    /// Maximum number of idle connections
    pub max_idle_connections: usize,
    
    /// Idle connection timeout
    pub idle_timeout: Duration,
    
    /// Enable compression
    pub compression: bool,
    
    /// WebSocket ping interval
    pub ws_ping_interval: Duration,
    
    /// WebSocket pong timeout
    pub ws_pong_timeout: Duration,
    
    /// Maximum WebSocket message size
    pub ws_max_message_size: usize,
    
    /// Maximum frame size for WebSocket
    pub ws_max_frame_size: usize,
    
    /// Buffer size for streaming operations
    pub stream_buffer_size: usize,
    
    /// Batch size for trace events
    pub trace_batch_size: usize,
    
    /// Batch timeout for trace events
    pub trace_batch_timeout: Duration,
}

impl Default for PerformanceConfig {
    fn default() -> Self {
        Self {
            max_connections_per_host: 50,
            connection_timeout: Duration::from_secs(10),
            request_timeout: Duration::from_secs(30),
            tcp_keepalive: Some(Duration::from_secs(60)),
            http2_prior_knowledge: true,
            connection_pooling: true,
            max_idle_connections: 10,
            idle_timeout: Duration::from_secs(90),
            compression: true,
            ws_ping_interval: Duration::from_secs(30),
            ws_pong_timeout: Duration::from_secs(10),
            ws_max_message_size: 64 * 1024 * 1024, // 64MB
            ws_max_frame_size: 16 * 1024 * 1024,   // 16MB
            stream_buffer_size: 8192,
            trace_batch_size: 1000,
            trace_batch_timeout: Duration::from_millis(100),
        }
    }
}

/// Authentication configuration
#[derive(Debug, Clone)]
pub struct AuthConfig {
    /// Bearer token for authentication
    pub bearer_token: String,
}

impl AuthConfig {
    /// Create auth config with bearer token
    pub fn new(token: String) -> Self {
        Self {
            bearer_token: token,
        }
    }
    
    /// Create auth config with bearer token (alias for consistency)
    pub fn with_bearer_token(token: String) -> Self {
        Self::new(token)
    }
}

/// Retry configuration
#[derive(Debug, Clone)]
pub struct RetryConfig {
    /// Maximum number of retry attempts
    pub max_attempts: usize,
    
    /// Initial retry delay
    pub initial_delay: Duration,
    
    /// Maximum retry delay
    pub max_delay: Duration,
    
    /// Backoff multiplier
    pub backoff_multiplier: f64,
    
    /// Jitter factor (0.0 to 1.0)
    pub jitter_factor: f64,
    
    /// HTTP status codes that should trigger retries
    pub retryable_status_codes: Vec<u16>,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            initial_delay: Duration::from_millis(100),
            max_delay: Duration::from_secs(30),
            backoff_multiplier: 2.0,
            jitter_factor: 0.1,
            retryable_status_codes: vec![408, 429, 500, 502, 503, 504],
        }
    }
}

/// WebSocket configuration
#[derive(Debug, Clone)]
pub struct WebSocketConfig {
    /// Connection timeout
    pub connection_timeout: Duration,
    
    /// Ping interval
    pub ping_interval: Duration,
    
    /// Pong timeout
    pub pong_timeout: Duration,
    
    /// Maximum message size
    pub max_message_size: usize,
    
    /// Maximum frame size
    pub max_frame_size: usize,
    
    /// Reconnection attempts
    pub max_reconnect_attempts: usize,
    
    /// Initial reconnect delay
    pub reconnect_delay: Duration,
    
    /// Maximum reconnect delay
    pub max_reconnect_delay: Duration,
    
    /// Enable compression
    pub compression: bool,
}

impl Default for WebSocketConfig {
    fn default() -> Self {
        Self {
            connection_timeout: Duration::from_secs(10),
            ping_interval: Duration::from_secs(30),
            pong_timeout: Duration::from_secs(10),
            max_message_size: 64 * 1024 * 1024, // 64MB
            max_frame_size: 16 * 1024 * 1024,   // 16MB
            max_reconnect_attempts: 5,
            reconnect_delay: Duration::from_millis(500),
            max_reconnect_delay: Duration::from_secs(30),
            compression: true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_config_default() {
        let config = ClientConfig::default();
        assert_eq!(config.base_url, "http://localhost:3000");
        assert_eq!(config.default_timeout, Duration::from_secs(30));
        assert!(config.verify_tls);
    }

    #[test]
    fn test_performance_config_default() {
        let config = PerformanceConfig::default();
        assert_eq!(config.max_connections_per_host, 50);
        assert_eq!(config.connection_timeout, Duration::from_secs(10));
        assert!(config.http2_prior_knowledge);
    }

    #[test]
    fn test_auth_config_new() {
        let auth = AuthConfig::new("test-token".to_string());
        assert_eq!(auth.bearer_token, "test-token");
    }

    #[test]
    fn test_auth_config_with_bearer_token() {
        let auth = AuthConfig::with_bearer_token("test-token".to_string());
        assert_eq!(auth.bearer_token, "test-token");
    }
}