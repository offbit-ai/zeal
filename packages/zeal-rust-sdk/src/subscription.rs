//! Webhook subscription management

use crate::errors::{Result, ZealError};
use crate::events::*;
use crate::webhooks::WebhooksAPI;
use futures_util::stream::Stream;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::pin::Pin;
use std::sync::{Arc, Mutex};
use std::task::{Context, Poll};
use tokio::sync::broadcast;

/// Options for webhook subscriptions
#[derive(Debug, Clone)]
pub struct SubscriptionOptions {
    /// Port for webhook server
    pub port: Option<u16>,
    /// Host to bind to (default: '0.0.0.0')
    pub host: Option<String>,
    /// Path to listen on (default: '/webhooks')
    pub path: Option<String>,
    /// Whether to use HTTPS
    pub https: Option<bool>,
    /// SSL key for HTTPS
    pub key: Option<String>,
    /// SSL certificate for HTTPS
    pub cert: Option<String>,
    /// Whether to automatically register the webhook with Zeal
    pub auto_register: Option<bool>,
    /// Namespace for the webhook
    pub namespace: Option<String>,
    /// Event types to listen for
    pub events: Vec<String>,
    /// Buffer size for event processing
    pub buffer_size: usize,
    /// Custom headers to send with webhook registration
    pub headers: Option<HashMap<String, String>>,
    /// Whether to verify webhook signatures
    pub verify_signature: Option<bool>,
    /// Secret key for signature verification
    pub secret_key: Option<String>,
}

impl Default for SubscriptionOptions {
    fn default() -> Self {
        Self {
            port: Some(3001),
            host: Some("0.0.0.0".to_string()),
            path: Some("/webhooks".to_string()),
            https: Some(false),
            key: None,
            cert: None,
            auto_register: Some(true),
            namespace: Some("default".to_string()),
            events: vec!["*".to_string()],
            buffer_size: 1000,
            headers: None,
            verify_signature: Some(false),
            secret_key: None,
        }
    }
}

/// Webhook delivery structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookDelivery {
    pub webhook_id: String,
    pub events: Vec<ZipWebhookEvent>,
    pub metadata: WebhookMetadata,
}

/// Webhook delivery metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookMetadata {
    pub namespace: String,
    pub delivery_id: String,
    pub timestamp: String,
}

/// Event callback type
pub type WebhookEventCallback = Arc<
    dyn Fn(ZipWebhookEvent) -> Pin<Box<dyn std::future::Future<Output = ()> + Send>> + Send + Sync,
>;

/// Delivery callback type
pub type WebhookDeliveryCallback = Arc<
    dyn Fn(WebhookDelivery) -> Pin<Box<dyn std::future::Future<Output = ()> + Send>> + Send + Sync,
>;

/// Error callback type
pub type WebhookErrorCallback =
    Arc<dyn Fn(ZealError) -> Pin<Box<dyn std::future::Future<Output = ()> + Send>> + Send + Sync>;

/// Webhook observable stream
#[pin_project::pin_project]
pub struct WebhookObservable {
    #[pin]
    receiver: broadcast::Receiver<ZipWebhookEvent>,
}

impl Stream for WebhookObservable {
    type Item = ZipWebhookEvent;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let mut this = self.project();
        // Use the receiver's poll_recv method directly
        loop {
            match this.receiver.try_recv() {
                Ok(event) => return Poll::Ready(Some(event)),
                Err(broadcast::error::TryRecvError::Empty) => {
                    // Register waker and return Pending
                    cx.waker().wake_by_ref();
                    return Poll::Pending;
                }
                Err(broadcast::error::TryRecvError::Closed) => return Poll::Ready(None),
                Err(broadcast::error::TryRecvError::Lagged(_)) => {
                    // Skip lagged events and continue the loop
                    continue;
                }
            }
        }
    }
}

/// Webhook subscription for receiving events
pub struct WebhookSubscription {
    webhooks_api: WebhooksAPI,
    options: SubscriptionOptions,
    event_sender: broadcast::Sender<ZipWebhookEvent>,
    event_callbacks: Arc<Mutex<Vec<WebhookEventCallback>>>,
    delivery_callbacks: Arc<Mutex<Vec<WebhookDeliveryCallback>>>,
    error_callbacks: Arc<Mutex<Vec<WebhookErrorCallback>>>,
    webhook_id: Arc<Mutex<Option<String>>>,
    is_running: Arc<Mutex<bool>>,
    #[cfg(feature = "webhook-server")]
    server_handle: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
}

impl WebhookSubscription {
    /// Create a new webhook subscription
    pub fn new(webhooks_api: WebhooksAPI, options: Option<SubscriptionOptions>) -> Self {
        let options = options.unwrap_or_default();
        let (event_sender, _) = broadcast::channel(options.buffer_size);

        Self {
            webhooks_api,
            options,
            event_sender,
            event_callbacks: Arc::new(Mutex::new(Vec::new())),
            delivery_callbacks: Arc::new(Mutex::new(Vec::new())),
            error_callbacks: Arc::new(Mutex::new(Vec::new())),
            webhook_id: Arc::new(Mutex::new(None)),
            is_running: Arc::new(Mutex::new(false)),
            #[cfg(feature = "webhook-server")]
            server_handle: Arc::new(Mutex::new(None)),
        }
    }

    /// Subscribe with a callback function
    pub fn on_event<F, Fut>(&self, callback: F) -> impl Fn() + Send + Sync
    where
        F: Fn(ZipWebhookEvent) -> Fut + Send + Sync + 'static,
        Fut: std::future::Future<Output = ()> + Send + 'static,
    {
        let wrapped_callback: WebhookEventCallback =
            Arc::new(move |event| Box::pin(callback(event)));

        self.event_callbacks.lock().unwrap().push(wrapped_callback);
        let callbacks = Arc::clone(&self.event_callbacks);
        let index = callbacks.lock().unwrap().len() - 1;

        move || {
            callbacks.lock().unwrap().remove(index);
        }
    }

    /// Subscribe to full webhook deliveries (multiple events at once)
    pub fn on_delivery<F, Fut>(&self, callback: F) -> impl Fn() + Send + Sync
    where
        F: Fn(WebhookDelivery) -> Fut + Send + Sync + 'static,
        Fut: std::future::Future<Output = ()> + Send + 'static,
    {
        let wrapped_callback: WebhookDeliveryCallback =
            Arc::new(move |delivery| Box::pin(callback(delivery)));

        self.delivery_callbacks
            .lock()
            .unwrap()
            .push(wrapped_callback);
        let callbacks = Arc::clone(&self.delivery_callbacks);
        let index = callbacks.lock().unwrap().len() - 1;

        move || {
            callbacks.lock().unwrap().remove(index);
        }
    }

    /// Subscribe to errors
    pub fn on_error<F, Fut>(&self, callback: F) -> impl Fn() + Send + Sync
    where
        F: Fn(ZealError) -> Fut + Send + Sync + 'static,
        Fut: std::future::Future<Output = ()> + Send + 'static,
    {
        let wrapped_callback: WebhookErrorCallback =
            Arc::new(move |error| Box::pin(callback(error)));

        self.error_callbacks.lock().unwrap().push(wrapped_callback);
        let callbacks = Arc::clone(&self.error_callbacks);
        let index = callbacks.lock().unwrap().len() - 1;

        move || {
            callbacks.lock().unwrap().remove(index);
        }
    }

    /// Get an observable for webhook events
    pub fn as_observable(&self) -> WebhookObservable {
        WebhookObservable {
            receiver: self.event_sender.subscribe(),
        }
    }

    /// Start the webhook server
    pub async fn start(&self) -> Result<()> {
        {
            let mut is_running = self.is_running.lock().unwrap();
            if *is_running {
                return Err(ZealError::other("Webhook subscription is already running"));
            }
            *is_running = true;
        }

        #[cfg(feature = "webhook-server")]
        {
            self.start_webhook_server().await?;

            // Auto-register webhook if enabled
            if self.options.auto_register.unwrap_or(true) {
                self.register().await?;
            }
            Ok(())
        }

        #[cfg(not(feature = "webhook-server"))]
        Err(ZealError::other("Webhook server feature not enabled. Enable 'webhook-server' feature to use this functionality"))
    }

    /// Stop the webhook server
    pub async fn stop(&self) -> Result<()> {
        {
            let mut is_running = self.is_running.lock().unwrap();
            if !*is_running {
                return Ok(());
            }
            *is_running = false;
        }

        // Unregister webhook if it was registered
        let webhook_id = self.webhook_id.lock().unwrap().take();
        if let Some(webhook_id) = webhook_id {
            if let Err(err) = self.webhooks_api.delete(&webhook_id).await {
                tracing::error!("Failed to unregister webhook {}: {}", webhook_id, err);
            } else {
                tracing::info!("Unregistered webhook {}", webhook_id);
            }
        }

        #[cfg(feature = "webhook-server")]
        {
            if let Some(handle) = self.server_handle.lock().unwrap().take() {
                handle.abort();
                let _ = handle.await;
                tracing::info!("Webhook server stopped");
            }
        }

        Ok(())
    }

    /// Register the webhook with Zeal
    pub async fn register(&self) -> Result<()> {
        if !*self.is_running.lock().unwrap() {
            return Err(ZealError::other(
                "Webhook server must be running before registration",
            ));
        }

        // Determine the public URL for the webhook
        let protocol = if self.options.https.unwrap_or(false) {
            "https"
        } else {
            "http"
        };
        let host = self.options.host.as_deref().unwrap_or("localhost");
        let host = if host == "0.0.0.0" { "localhost" } else { host };
        let port = self.options.port.unwrap_or(3001);
        let path = self.options.path.as_deref().unwrap_or("/webhooks");
        let url = format!("{}://{}:{}{}", protocol, host, port, path);

        // Register with Zeal
        let config = crate::types::WebhookConfig {
            namespace: self
                .options
                .namespace
                .as_deref()
                .unwrap_or("default")
                .to_string(),
            url,
            events: Some(self.options.events.clone()),
            headers: self.options.headers.clone(),
            metadata: None,
        };

        let result = self.webhooks_api.register(config).await?;
        *self.webhook_id.lock().unwrap() = Some(result.webhook_id.clone());

        tracing::info!("Registered webhook {} at {}", result.webhook_id, result.url);
        Ok(())
    }

    #[cfg(feature = "webhook-server")]
    /// Process a webhook delivery
    async fn process_delivery(&self, delivery: WebhookDelivery) {
        // Call delivery callbacks
        let delivery_callbacks = self.delivery_callbacks.lock().unwrap().clone();
        for callback in delivery_callbacks {
            if let Err(err) = tokio::time::timeout(
                std::time::Duration::from_secs(30),
                callback(delivery.clone()),
            )
            .await
            {
                tracing::error!("Delivery callback timeout: {}", err);
            }
        }

        // Process individual events
        for event in delivery.events {
            // Send to broadcast channel
            if let Err(err) = self.event_sender.send(event.clone()) {
                tracing::error!("Failed to send event to broadcast channel: {}", err);
            }

            // Call event callbacks
            let event_callbacks = self.event_callbacks.lock().unwrap().clone();
            for callback in event_callbacks {
                if let Err(err) = tokio::time::timeout(
                    std::time::Duration::from_secs(30),
                    callback(event.clone()),
                )
                .await
                {
                    tracing::error!("Event callback timeout: {}", err);
                }
            }
        }
    }

    #[cfg(feature = "webhook-server")]
    /// Emit an error to all error callbacks
    async fn emit_error(&self, error: ZealError) {
        let error_callbacks = self.error_callbacks.lock().unwrap().clone();
        for callback in error_callbacks {
            if let Err(err) =
                tokio::time::timeout(std::time::Duration::from_secs(30), callback(error.clone()))
                    .await
            {
                tracing::error!("Error callback timeout: {}", err);
            }
        }
    }

    /// Convenience method to create a filtered subscription
    pub fn filter_events<F>(&self, predicate: F) -> impl Stream<Item = ZipWebhookEvent>
    where
        F: Fn(&ZipWebhookEvent) -> bool + Send + Sync + 'static,
    {
        use futures_util::StreamExt;
        StreamExt::filter(self.as_observable(), move |event| {
            futures_util::future::ready(predicate(event))
        })
    }

    /// Subscribe to specific event types
    pub fn on_event_type<F, Fut>(
        &self,
        event_types: Vec<String>,
        callback: F,
    ) -> impl Fn() + Send + Sync
    where
        F: Fn(ZipWebhookEvent) -> Fut + Send + Sync + 'static,
        Fut: std::future::Future<Output = ()> + Send + 'static,
    {
        let callback = std::sync::Arc::new(callback);
        self.on_event(move |event| {
            let event_types = event_types.clone();
            let callback = callback.clone();
            async move {
                let event_type = match &event {
                    ZipWebhookEvent::Execution(e) => e.event_type(),
                    ZipWebhookEvent::Workflow(e) => e.event_type(),
                    ZipWebhookEvent::CRDT(e) => e.event_type(),
                };
                if event_types.contains(&event_type.to_string()) {
                    callback(event).await
                }
            }
        })
    }

    /// Subscribe to events from a specific source
    pub fn on_event_source<F, Fut>(
        &self,
        sources: Vec<String>,
        callback: F,
    ) -> impl Fn() + Send + Sync
    where
        F: Fn(ZipWebhookEvent) -> Fut + Send + Sync + 'static,
        Fut: std::future::Future<Output = ()> + Send + 'static,
    {
        let callback = std::sync::Arc::new(callback);
        self.on_event(move |event| {
            let sources = sources.clone();
            let callback = callback.clone();
            async move {
                let workflow_id = match &event {
                    ZipWebhookEvent::Execution(e) => e.workflow_id(),
                    ZipWebhookEvent::Workflow(e) => e.workflow_id(),
                    ZipWebhookEvent::CRDT(e) => e.workflow_id(),
                };
                if sources.contains(&workflow_id.to_string()) {
                    callback(event).await
                }
            }
        })
    }

    /// Get the current webhook ID if registered
    pub fn webhook_id(&self) -> Option<String> {
        self.webhook_id.lock().unwrap().clone()
    }

    /// Check if the subscription is running
    pub fn is_running(&self) -> bool {
        *self.is_running.lock().unwrap()
    }

    #[cfg(feature = "webhook-server")]
    async fn start_webhook_server(&self) -> Result<()> {
        use axum::{extract::State, http::StatusCode, response::Json, routing::post, Router};
        use tower::ServiceBuilder;

        let app_state = WebhookServerState {
            subscription: self as *const WebhookSubscription,
        };

        let app = Router::new()
            .route(
                self.options.path.as_deref().unwrap_or("/webhooks"),
                post(webhook_handler),
            )
            .layer(ServiceBuilder::new())
            .with_state(app_state);

        let addr = format!(
            "{}:{}",
            self.options.host.as_deref().unwrap_or("0.0.0.0"),
            self.options.port.unwrap_or(3001)
        );

        let listener = tokio::net::TcpListener::bind(&addr).await.map_err(|e| {
            ZealError::other(format!("Failed to bind webhook server to {}: {}", addr, e))
        })?;

        tracing::info!("Webhook server listening on {}", addr);

        let server_handle = tokio::spawn(async move {
            if let Err(err) = axum::serve(listener, app).await {
                tracing::error!("Webhook server error: {}", err);
            }
        });

        *self.server_handle.lock().unwrap() = Some(server_handle);
        Ok(())
    }
}

#[cfg(feature = "webhook-server")]
#[derive(Clone)]
struct WebhookServerState {
    subscription: *const WebhookSubscription,
}

#[cfg(feature = "webhook-server")]
unsafe impl Send for WebhookServerState {}
#[cfg(feature = "webhook-server")]
unsafe impl Sync for WebhookServerState {}

#[cfg(feature = "webhook-server")]
async fn webhook_handler(
    State(state): State<WebhookServerState>,
    Json(delivery): Json<WebhookDelivery>,
) -> Result<StatusCode, StatusCode> {
    let subscription = unsafe { &*state.subscription };

    // TODO: Verify signature if enabled
    if subscription.options.verify_signature.unwrap_or(false) {
        // Signature verification would be implemented here
    }

    subscription.process_delivery(delivery).await;
    Ok(StatusCode::OK)
}

impl Drop for WebhookSubscription {
    fn drop(&mut self) {
        if *self.is_running.lock().unwrap() {
            tracing::warn!("WebhookSubscription dropped while still running. Consider calling stop() explicitly.");
        }
    }
}
