/**
 * Socket.IO Compatible CRDT Server
 * 
 * This server implements the Socket.IO protocol to be fully compatible
 * with the existing JavaScript client.
 */

use crate::config::ServerConfig;
use crate::redis_manager::RedisManager;
use crate::room::CRDTRoom;
use anyhow::Result;
use chrono;
use dashmap::DashMap;
use serde_json::json;
use socketioxide::{
    extract::{Data, SocketRef},
    SocketIo,
};
use std::sync::Arc;
use tower::ServiceBuilder;
use tower_http::cors::CorsLayer;
use tower_http::timeout::TimeoutLayer;
use tracing::{debug, error, info, warn};

pub struct CRDTServer {
    config: ServerConfig,
    rooms: Arc<DashMap<String, CRDTRoom>>,
    redis: Arc<RedisManager>,
}

impl CRDTServer {
    pub fn new(config: ServerConfig) -> Self {
        let redis = RedisManager::new(config.redis_url.clone(), config.enable_redis_persistence)
            .expect("Failed to create Redis manager");
        
        Self {
            config,
            rooms: Arc::new(DashMap::new()),
            redis: Arc::new(redis),
        }
    }

    pub async fn start(self: Arc<Self>) -> Result<()> {
        // Connect to Redis if enabled
        if let Err(e) = self.redis.connect().await {
            warn!("Failed to connect to Redis: {}, continuing without persistence", e);
        }

        // Create Socket.IO layer with configuration
        let (layer, io) = SocketIo::builder()
            .ping_interval(std::time::Duration::from_secs(25))
            .ping_timeout(std::time::Duration::from_secs(60))
            // .ack_timeout(std::time::Duration::from_secs(300))
            .build_layer();

        // Set up Socket.IO event handlers
        io.ns("/", {
            let server = self.clone();
            move |socket: SocketRef| {
                let server = server.clone();
                async move {
                    info!("Client connected: {}", socket.id);
                    
                    // Store session in Redis
                    if let Err(e) = server.redis.save_client_session(&socket.id.to_string(), &json!({
                        "connected_at": chrono::Utc::now().to_rfc3339(),
                        "rooms": []
                    }).to_string()).await {
                        warn!("Failed to save client session: {}", e);
                    }

                    // Handle joining a room
                    socket.on("crdt:join", {
                        let server = server.clone();
                        move |socket: SocketRef, Data::<String>(room_name)| {
                            let server = server.clone();
                            async move {
                                if let Err(e) = server.handle_join(&socket, &room_name).await {
                                    error!("Error handling join: {}", e);
                                }
                            }
                        }
                    });

                    // Handle CRDT messages - using array of numbers as workaround
                    socket.on("crdt:message", {
                        let server = server.clone();
                        move |socket: SocketRef, data: Data<serde_json::Value>| {
                            let server = server.clone();
                            async move {
                                debug!("Raw crdt:message data: {:?}", data.0);
                                
                                // Try to extract room name and data array
                                match data.0 {
                                    serde_json::Value::Array(arr) if arr.len() >= 2 => {
                                        if let (Some(room_name), Some(data_arr)) = (arr[0].as_str(), arr[1].as_array()) {
                                            // Convert JSON array to Vec<u8>
                                            let mut bytes = Vec::new();
                                            for val in data_arr {
                                                if let Some(num) = val.as_u64() {
                                                    bytes.push(num as u8);
                                                }
                                            }
                                            
                                            let message_type = if bytes.len() > 0 { bytes[0] } else { 255 };
                                            let message_type_name = match message_type {
                                                0 => "SYNC",
                                                1 => "AWARENESS",
                                                2 => "AUTH",
                                                3 => "QUERY_AWARENESS",
                                                _ => "UNKNOWN",
                                            };
                                            info!("Parsed crdt:message from {} for room: {}, type: {} ({}), size: {} bytes", 
                                                socket.id, room_name, message_type, message_type_name, bytes.len());
                                            
                                            if let Err(e) = server.handle_message(&socket, room_name, &bytes).await {
                                                error!("Error handling message: {}", e);
                                            }
                                        } else {
                                            error!("Invalid message format in array");
                                        }
                                    }
                                    _ => {
                                        error!("Unexpected crdt:message format: {:?}", data.0);
                                    }
                                }
                            }
                        }
                    });

                    // Handle leaving a room
                    socket.on("crdt:leave", {
                        let server = server.clone();
                        move |socket: SocketRef, Data::<String>(room_name)| {
                            let server = server.clone();
                            async move {
                                server.handle_leave(&socket, &room_name).await;
                            }
                        }
                    });

                    // Handle disconnection
                    socket.on_disconnect({
                        let server = server.clone();
                        move |socket: SocketRef| {
                            let server = server.clone();
                            async move {
                                server.handle_disconnect(&socket).await;
                            }
                        }
                    });
                }
            }
        });

        // Create the app with CORS - Socket.IO compatible
        let cors = CorsLayer::new()
            .allow_origin([
                "http://localhost:3000".parse::<axum::http::HeaderValue>()?,
                "http://127.0.0.1:3000".parse::<axum::http::HeaderValue>()?,
                "http://localhost:3001".parse::<axum::http::HeaderValue>()?,
                "http://127.0.0.1:3001".parse::<axum::http::HeaderValue>()?,
            ])
            .allow_methods([
                axum::http::Method::GET,
                axum::http::Method::POST,
                axum::http::Method::OPTIONS,
                axum::http::Method::PUT,
                axum::http::Method::DELETE,
                axum::http::Method::PATCH,
                axum::http::Method::HEAD,
            ])
            .allow_headers([
                axum::http::header::CONTENT_TYPE,
                axum::http::header::AUTHORIZATION,
                axum::http::header::ACCEPT,
                axum::http::header::ORIGIN,
                axum::http::header::ACCESS_CONTROL_REQUEST_METHOD,
                axum::http::header::ACCESS_CONTROL_REQUEST_HEADERS,
                axum::http::header::USER_AGENT,
                axum::http::header::CACHE_CONTROL,
                axum::http::header::PRAGMA,
                axum::http::header::CONNECTION,
                axum::http::header::UPGRADE,
                "x-requested-with".parse::<axum::http::HeaderName>()?,
                "sec-websocket-key".parse::<axum::http::HeaderName>()?,
                "sec-websocket-version".parse::<axum::http::HeaderName>()?,
                "sec-websocket-protocol".parse::<axum::http::HeaderName>()?,
                "sec-websocket-extensions".parse::<axum::http::HeaderName>()?,
            ])
            .allow_credentials(true);

        let app = axum::Router::new()
            .route("/", axum::routing::get(|| async { "Zeal CRDT Server Running" }))
            .route("/health", axum::routing::get({
                let server = self.clone();
                move || {
                    let server = server.clone();
                    async move { server.health_check().await }
                }
            }))
            .route("/stats", axum::routing::get({
                let server = self.clone();
                move || {
                    let server = server.clone();
                    async move { server.get_stats().await }
                }
            }))
            .layer(
                ServiceBuilder::new()
                    .layer(TimeoutLayer::new(std::time::Duration::from_secs(5)))  // Add 5s timeout for HTTP requests
                    .layer(cors)
                    .layer(layer),
            );

        // Start the server with connection limit
        let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", self.config.port)).await?;
        info!("🚀 Socket.IO compatible CRDT server running on port {}", self.config.port);
        info!("🔗 Connect clients to: ws://localhost:{}/socket.io/", self.config.port);
        
        // Use axum's serve with a configured server
        axum::serve(listener, app.into_make_service_with_connect_info::<std::net::SocketAddr>())
            .await?;

        Ok(())
    }

    async fn handle_join(&self, socket: &SocketRef, room_name: &str) -> Result<()> {
        info!("Client {} joining room: {}", socket.id, room_name);

        // Check room capacity
        if let Some(room) = self.rooms.get(room_name) {
            if room.client_count() >= self.config.max_clients_per_room {
                socket.emit("crdt:error", json!({
                    "error": "Room capacity reached"
                })).ok();
                return Ok(());
            }
        }

        // Get or create room
        let room = if let Some(existing_room) = self.rooms.get(room_name) {
            existing_room.value().clone()
        } else {
            let new_room = CRDTRoom::with_redis(
                room_name.to_string(), 
                self.config.clone(), 
                self.redis.clone()
            );
            
            // Always try to load existing state from Redis
            match new_room.load_from_redis().await {
                Ok(loaded) => {
                    if loaded {
                        info!("Restored room {} from Redis persistence", room_name);
                    } else {
                        info!("Created new room: {} (no existing state in Redis)", room_name);
                    }
                }
                Err(e) => {
                    warn!("Failed to load room {} from Redis: {}", room_name, e);
                }
            }
            
            self.rooms.insert(room_name.to_string(), new_room.clone());
            new_room
        };

        // Join the socket.io room
        socket.join(room_name.to_string()).ok();

        // Add client to CRDT room
        room.add_client(socket.id.to_string()).await?;

        // Send joined confirmation
        socket.emit("crdt:joined", json!({
            "roomName": room_name,
            "clientId": socket.id.to_string()
        })).ok();

        // Update client session in Redis with joined room
        if let Ok(Some(session_str)) = self.redis.get_client_session(&socket.id.to_string()).await {
            if let Ok(mut session) = serde_json::from_str::<serde_json::Value>(&session_str) {
                // Check if this is a reconnection
                let was_disconnected = session.get("disconnected_at").is_some() || 
                                     session.get("is_connected").and_then(|v| v.as_bool()) == Some(false);
                
                // Clear disconnection flags
                session["is_connected"] = json!(true);
                session.as_object_mut().map(|obj| {
                    obj.remove("disconnected_at");
                    obj.remove("pending_removal");
                });
                
                if let Some(rooms) = session.get_mut("rooms").and_then(|r| r.as_array_mut()) {
                    if !rooms.iter().any(|r| r.as_str() == Some(room_name)) {
                        rooms.push(json!(room_name));
                    }
                } else {
                    session["rooms"] = json!([room_name]);
                }
                
                if let Ok(updated_session) = serde_json::to_string(&session) {
                    let _ = self.redis.save_client_session(&socket.id.to_string(), &updated_session).await;
                }
                
                if was_disconnected {
                    info!("Client {} reconnected within grace period", socket.id);
                }
            }
        }

        info!("Client {} successfully joined room: {}", socket.id, room_name);
        Ok(())
    }

    async fn handle_message(&self, socket: &SocketRef, room_name: &str, data: &[u8]) -> Result<()> {
        if data.is_empty() {
            warn!("Received empty message from client {}", socket.id);
            return Ok(());
        }

        // Get message type for logging (don't log awareness spam)
        let message_type = data[0];
        if message_type != 1 { // Not awareness
            debug!("Received message type {} from client {} in room {}", message_type, socket.id, room_name);
        }

        if let Some(room) = self.rooms.get(room_name) {
            // Handle QUERY_AWARENESS messages specially
            if message_type == 3 { // QUERY_AWARENESS
                info!("Handling QUERY_AWARENESS from client {} in room {}", socket.id, room_name);
                
                // Get all awareness states for this client
                let awareness_messages = room.get_awareness_states_for_client(&socket.id.to_string());
                
                info!("Found {} awareness states to send to client {}", awareness_messages.len(), socket.id);
                
                // Send each awareness state back to the requesting client
                for (i, awareness_data) in awareness_messages.iter().enumerate() {
                    let data_array = serde_json::Value::Array(
                        awareness_data.iter().map(|&b| serde_json::Value::Number(b.into())).collect()
                    );
                    
                    // Wrap in the same format as regular messages: [roomName, dataArray]
                    let message_payload = serde_json::Value::Array(vec![
                        serde_json::Value::String(room_name.to_string()),
                        data_array
                    ]);
                    
                    socket.emit("crdt:message", message_payload).ok();
                    info!("Sent awareness state {} to client {}", i + 1, socket.id);
                }
                
                info!("Completed QUERY_AWARENESS response to client {} in room {}", socket.id, room_name);
                return Ok(());
            }
            
            // Process the message in the room and get any response
            let response = room.handle_message(&socket.id.to_string(), data).await?;

            // If there's a response (e.g., sync step 2), send it back to the sender
            if !response.is_empty() {
                debug!("Sending sync response to client {}, size: {} bytes", socket.id, response.len());
                
                let response_array = serde_json::Value::Array(
                    response.iter().map(|&b| serde_json::Value::Number(b.into())).collect()
                );
                
                let response_payload = serde_json::Value::Array(vec![
                    serde_json::Value::String(room_name.to_string()),
                    response_array
                ]);
                
                socket.emit("crdt:message", response_payload).ok();
            }

            // Check if this is a SYNC message type
            let message_type = if !data.is_empty() { data[0] } else { 255 };
            
            // Only broadcast SYNC Update messages (type 0) and AWARENESS messages (type 1)
            // Don't broadcast AUTH (2), QUERY_AWARENESS (3), or other message types
            if message_type == 0 || message_type == 1 {
                let data_vec: Vec<u8> = data.to_vec();
                info!("Broadcasting {} message to room {} (excluding sender {}), data size: {} bytes", 
                     if message_type == 0 { "SYNC" } else { "AWARENESS" },
                     room_name, socket.id, data_vec.len());
                
                // Convert Vec<u8> to a JSON array for socketioxide
                let data_array = serde_json::Value::Array(
                    data_vec.iter().map(|&b| serde_json::Value::Number(b.into())).collect()
                );
                
                // Use consistent format: [roomName, dataArray] for all messages
                let message_payload = serde_json::Value::Array(vec![
                    serde_json::Value::String(room_name.to_string()),
                    data_array
                ]);
                
                socket.to(room_name.to_string()).emit("crdt:message", message_payload).ok();
            } else {
                debug!("Not broadcasting message type {} to room {}", message_type, room_name);
            }
        } else {
            warn!("Client {} sent message to non-existent room: {}", socket.id, room_name);
        }

        Ok(())
    }

    async fn handle_leave(&self, socket: &SocketRef, room_name: &str) {
        info!("Client {} leaving room: {}", socket.id, room_name);

        // First leave the socket.io room to prevent further events
        socket.leave(room_name.to_string()).ok();
        
        if let Some(room) = self.rooms.get(room_name) {
            // Only remove if client is actually in the room
            if room.has_client(&socket.id.to_string()).await {
                room.remove_client(&socket.id.to_string()).await;

                // Don't remove rooms immediately - keep them alive for reconnections
                if room.client_count() == 0 {
                    // Try to save state
                    if let Err(e) = room.save_to_redis().await {
                        warn!("Failed to save room {} to Redis: {}. Keeping room in memory.", room_name, e);
                        // Don't remove the room if we can't save state - keep it in memory
                    } else {
                        // Only remove if we successfully saved state
                        self.rooms.remove(room_name);
                        info!("Removed empty room: {} (state saved to Redis)", room_name);
                    }
                }
            }
        }
    }

    async fn handle_disconnect(&self, socket: &SocketRef) {
        info!("Client disconnected: {}", socket.id);
        let socket_id = socket.id.to_string();
        
        // Get client's rooms from Redis session
        let mut client_rooms = Vec::new();
        if let Ok(Some(session_str)) = self.redis.get_client_session(&socket_id).await {
            if let Ok(mut session) = serde_json::from_str::<serde_json::Value>(&session_str) {
                // Mark as disconnected but keep session alive for reconnection
                session["disconnected_at"] = json!(chrono::Utc::now().timestamp());
                session["is_connected"] = json!(false);
                
                // Get rooms list
                if let Some(rooms) = session.get("rooms").and_then(|r| r.as_array()) {
                    for room in rooms {
                        if let Some(room_name) = room.as_str() {
                            client_rooms.push(room_name.to_string());
                        }
                    }
                }
                
                // Keep session alive for 30 seconds to allow reconnection
                if let Ok(updated_session) = serde_json::to_string(&session) {
                    let _ = self.redis.save_client_session_with_ttl(&socket_id, &updated_session, 30).await;
                }
            }
        }
        
        // Mark client as disconnected in rooms but don't remove them yet
        for room_name in &client_rooms {
            if let Some(room) = self.rooms.get(room_name) {
                // Just update the last seen time, don't remove
                room.update_client_activity(&socket_id).await;
            }
        }
        
        info!("Client {} disconnected but keeping in rooms for 30s grace period", socket_id);
    }
    
    async fn cleanup_disconnected_client(&self, client_id: &str) {
        // Check if client reconnected during grace period
        if let Ok(Some(session_str)) = self.redis.get_client_session(client_id).await {
            if let Ok(session) = serde_json::from_str::<serde_json::Value>(&session_str) {
                if session.get("pending_removal").and_then(|v| v.as_bool()).unwrap_or(false) {
                    info!("Cleaning up disconnected client after grace period: {}", client_id);
                    
                    // Get client's rooms
                    let mut client_rooms = Vec::new();
                    if let Some(rooms) = session.get("rooms").and_then(|r| r.as_array()) {
                        for room in rooms {
                            if let Some(room_name) = room.as_str() {
                                client_rooms.push(room_name.to_string());
                            }
                        }
                    }

                    
                    // Remove client from their rooms
                    let mut rooms_to_remove = Vec::new();
                    for room_name in client_rooms {
                        if let Some(room) = self.rooms.get(&room_name) {
                            room.remove_client(client_id).await;
                            if room.client_count() == 0 {
                                rooms_to_remove.push(room_name);
                            }
                        }
                    }

                    // Clean up empty rooms after saving state
                    for room_name in rooms_to_remove {
                        if let Some(room) = self.rooms.get(&room_name) {
                            // Save state to Redis before removal
                            if let Err(e) = room.save_to_redis().await {
                                warn!("Failed to save room {} to Redis before removal: {}", room_name, e);
                            }
                        }
                        self.rooms.remove(&room_name);
                        info!("Removed empty room: {} (state saved to Redis)", room_name);
                    }

                    // Delete client session from Redis
                    if let Err(e) = self.redis.delete_client_session(client_id).await {
                        warn!("Failed to delete client session from Redis: {}", e);
                    }
                } else {
                    info!("Client {} reconnected during grace period, skipping cleanup", client_id);
                }
            }
        }
    }

    pub async fn get_stats(&self) -> axum::Json<serde_json::Value> {
        let total_clients: usize = self.rooms.iter()
            .map(|entry| entry.value().client_count())
            .sum();

        axum::Json(json!({
            "status": "running",
            "rooms": self.rooms.len(),
            "totalClients": total_clients,
            "roomDetails": self.rooms.iter()
                .map(|entry| {
                    let (name, room) = entry.pair();
                    json!({
                        "name": name,
                        "clients": room.client_count()
                    })
                })
                .collect::<Vec<_>>()
        }))
    }

    pub async fn health_check(&self) -> axum::Json<serde_json::Value> {
        let redis_healthy = if self.redis.is_enabled() {
            self.redis.health_check().await.unwrap_or(false)
        } else {
            true // If Redis is disabled, consider it "healthy"
        };

        let status = if redis_healthy { "healthy" } else { "degraded" };

        axum::Json(json!({
            "status": status,
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "service": "zeal-crdt-server",
            "checks": {
                "server": "healthy",
                "redis": if self.redis.is_enabled() {
                    if redis_healthy { "healthy" } else { "unhealthy" }
                } else {
                    "disabled"
                }
            }
        }))
    }
}