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
//! ```rust,no_run
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
pub mod templates;
pub mod orchestrator;
pub mod traces;
pub mod events;
pub mod webhooks;
pub mod subscription;
pub mod observables;
pub mod types;
pub mod errors;

#[cfg(feature = "telemetry")]
pub mod telemetry;

#[cfg(feature = "webhook-server")]
pub mod webhook_server;

// Re-export main types
pub use client::ZealClient;
pub use config::{ClientConfig, PerformanceConfig};
pub use errors::{ZealError, Result};
pub use types::*;
pub use subscription::{WebhookSubscription, SubscriptionOptions};

// Re-export key traits and functions
pub use observables::{ZealObservable, ObservableExt};
pub use events::{
    ZipExecutionEvent, ZipWorkflowEvent, ZipControlEvent, ZipWebSocketEvent, ZipWebhookEvent,
    NodeExecutingEvent, NodeCompletedEvent, NodeFailedEvent, NodeWarningEvent,
    ExecutionStartedEvent, ExecutionCompletedEvent, ExecutionFailedEvent,
    WorkflowCreatedEvent, WorkflowUpdatedEvent, WorkflowDeletedEvent,
    VisualStateElement, VisualStateUpdate, ElementType, ElementState,
    ConnectionState, ConnectionStateEvent,
};
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