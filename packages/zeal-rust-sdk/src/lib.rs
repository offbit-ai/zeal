//! # Zeal Rust SDK
//!
//! High-performance Rust SDK for the Zeal Integration Protocol (ZIP), enabling efficient
//! third-party workflow runtime integration with the Zeal workflow editor.
//!
//! ## Features
//!
//! - **Zero-copy JSON parsing** with `serde_json` and optional `simd-json`
//! - **Async/await support** with `tokio` and `futures`
//! - **WebSocket real-time communication** with `tokio-tungstenite`
//! - **HTTP/2 client** with `reqwest` and connection pooling
//! - **Observable streams** with `futures-util` and custom stream combinators
//! - **Built-in retry logic** with exponential backoff
//! - **Thread-safe concurrent operations**
//!
//! ## Quick Start
//!
//! ```ignore
//! use zeal_sdk::{ZealClient, ClientConfig};
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     let client = ZealClient::new(ClientConfig {
//!         base_url: "http://localhost:3000".to_string(),
//!         ..Default::default()
//!     })?;
//!
//!     // Register node templates
//!     client.templates().register(
//!         "my-runtime",
//!         vec![/* templates */],
//!         None
//!     ).await?;
//!
//!     Ok(())
//! }
//! ```

pub mod auth;
pub mod client;
pub mod config;
pub mod errors;
pub mod events;
pub mod observables;
pub mod orchestrator;
pub mod subscription;
pub mod templates;
pub mod traces;
pub mod types;
pub mod webhooks;

// #[cfg(feature = "telemetry")]
// pub mod telemetry;

#[cfg(feature = "webhook-server")]
pub use subscription::start_webhook_server;

// Re-export main types
pub use client::ZealClient;
pub use config::{ClientConfig, PerformanceConfig};
pub use errors::{Result, ZealError};
pub use subscription::{SubscriptionOptions, WebhookSubscription};
pub use types::*;

// Re-export key traits and functions
pub use events::{
    ConnectionState, ConnectionStateEvent, ElementState, ElementType, ExecutionCompletedEvent,
    ExecutionFailedEvent, ExecutionStartedEvent, NodeCompletedEvent, NodeExecutingEvent,
    NodeFailedEvent, NodeWarningEvent, VisualStateElement, VisualStateUpdate, WorkflowCreatedEvent,
    WorkflowDeletedEvent, WorkflowUpdatedEvent, ZipControlEvent, ZipExecutionEvent,
    ZipWebSocketEvent, ZipWebhookEvent, ZipWorkflowEvent,
};
pub use observables::{ObservableExt, ZealObservable};
pub use traces::{TraceEvent, TraceEventType, TraceStatus};

/// SDK version
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Default API path prefix
pub const API_PREFIX: &str = "/api/zip";

/// Default WebSocket path
pub const WS_PATH: &str = "/ws/zip";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version() {
        assert!(!VERSION.is_empty());
    }

    #[test]
    fn test_constants() {
        assert_eq!(API_PREFIX, "/api/zip");
        assert_eq!(WS_PATH, "/ws/zip");
    }
}
