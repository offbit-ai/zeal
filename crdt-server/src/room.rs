use crate::config::ServerConfig;
use crate::redis_manager::RedisManager;
use crate::sync_protocol::SyncProtocol;
use anyhow::Result;
use dashmap::DashMap;
use lib0::decoding::Cursor;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};
use yrs::{Doc, ReadTxn, Transact, Update};
use yrs::updates::decoder::Decode;

#[derive(Clone)]
pub struct CRDTRoom {
    pub name: String,
    pub doc: Arc<RwLock<Doc>>,
    pub clients: Arc<DashMap<String, Instant>>, // Just track client IDs and last seen
    pub awareness_states: Arc<DashMap<String, Vec<u8>>>, // Store latest awareness state for each client
    pub last_activity: Arc<RwLock<Instant>>,
    pub marked_for_removal: Arc<RwLock<Option<Instant>>>, // Track when room was marked for removal
    pub config: ServerConfig,
    pub redis: Option<Arc<RedisManager>>,
}

impl CRDTRoom {
    pub fn new(name: String, config: ServerConfig) -> Self {
        let doc = Doc::new();
        
        Self {
            name,
            doc: Arc::new(RwLock::new(doc)),
            clients: Arc::new(DashMap::new()),
            awareness_states: Arc::new(DashMap::new()),
            last_activity: Arc::new(RwLock::new(Instant::now())),
            marked_for_removal: Arc::new(RwLock::new(None)),
            config,
            redis: None,
        }
    }

    pub fn with_redis(name: String, config: ServerConfig, redis: Arc<RedisManager>) -> Self {
        let doc = Doc::new();
        
        Self {
            name,
            doc: Arc::new(RwLock::new(doc)),
            clients: Arc::new(DashMap::new()),
            awareness_states: Arc::new(DashMap::new()),
            last_activity: Arc::new(RwLock::new(Instant::now())),
            marked_for_removal: Arc::new(RwLock::new(None)),
            config,
            redis: Some(redis),
        }
    }

    pub async fn load_from_redis(&self) -> Result<bool> {
        if let Some(redis) = &self.redis {
            if let Some(state) = redis.get_room_state(&self.name).await? {
                info!("Loading room {} state from Redis, {} bytes", self.name, state.len());
                
                // Apply the stored state to the document
                let doc = self.doc.write().await;
                if let Ok(update) = Update::decode_v1(&state) {
                    doc.transact_mut().apply_update(update);
                    return Ok(true);
                }
            }
        }
        Ok(false)
    }

    pub async fn save_to_redis(&self) -> Result<()> {
        if let Some(redis) = &self.redis {
            if redis.is_enabled() {
                let doc = self.doc.read().await;
                let state = doc.transact().state_vector();
                let update = doc.transact().encode_state_as_update_v1(&state);
                
                redis.save_room_state(&self.name, &update).await?;
                debug!("Saved room {} state to Redis, {} bytes", self.name, update.len());
            } else {
                // Redis is disabled, return Ok to prevent room removal
                debug!("Redis disabled, keeping room {} in memory", self.name);
            }
        } else {
            // No Redis configured, keep room in memory
            debug!("No Redis configured, keeping room {} in memory", self.name);
        }
        Ok(())
    }

    pub async fn add_client(&self, client_id: String) -> Result<()> {
        // Check room capacity
        if self.clients.len() >= self.config.max_clients_per_room {
            return Err(anyhow::anyhow!("Room capacity reached"));
        }

        info!("Adding client {} to room {}", client_id, self.name);

        // Add client to room
        self.clients.insert(client_id.clone(), Instant::now());
        self.update_activity().await;

        Ok(())
    }

    pub async fn remove_client(&self, client_id: &str) {
        if let Some((_, _)) = self.clients.remove(client_id) {
            info!("Removing client {} from room {}", client_id, self.name);
            // Also remove their awareness state
            self.awareness_states.remove(client_id);
            self.update_activity().await;
        }
    }
    
    pub async fn mark_client_pending_removal(&self, client_id: &str) {
        // Just mark the client as inactive but don't remove yet
        info!("Marking client {} as pending removal in room {}", client_id, self.name);
        // We could add a pending_removal field if needed
    }
    
    pub async fn update_client_activity(&self, client_id: &str) {
        if let Some(mut entry) = self.clients.get_mut(client_id) {
            *entry = Instant::now();
        }
    }

    pub async fn handle_message(
        &self,
        client_id: &str,
        data: &[u8],
    ) -> Result<Vec<u8>> {
        if data.is_empty() {
            warn!("Received empty message from client {}", client_id);
            return Ok(Vec::new());
        }

        // Update client activity
        if let Some(mut client_entry) = self.clients.get_mut(client_id) {
            *client_entry = Instant::now();
        }

        // Parse and handle different message types
        if data.len() > 0 {
            let message_type = data[0];
            
            match message_type {
                0 => {
                    // SYNC message - handle with proper sync protocol
                    debug!("Processing SYNC message from client {}", client_id);
                    
                    if data.len() > 1 {
                        let sync_data = &data[1..];
                        
                        // Debug: log first few bytes of sync data
                        let preview_len = sync_data.len().min(20);
                        let preview = &sync_data[..preview_len];
                        info!("SYNC message preview (first {} bytes): {:?}, full length: {}", preview_len, preview, sync_data.len());
                        
                        // Create cursor and response buffer for sync protocol
                        let mut cursor = Cursor::new(sync_data);
                        let mut response_data_buffer = Vec::new();
                        
                        // Process sync message
                        let response_data = {
                            let doc = self.doc.write().await;
                            match SyncProtocol::read_sync_message(&mut cursor, &mut response_data_buffer, &doc) {
                                Ok(sync_type) => {
                                    debug!("Processed sync message type {:?} from client {}", sync_type, client_id);
                                    
                                    // Save to Redis if we received an update
                                    drop(doc); // Release lock before async operation
                                    if let Err(e) = self.save_to_redis().await {
                                        warn!("Failed to save room {} to Redis: {}", self.name, e);
                                    }
                                    
                                    // If we have a response, wrap it with message type
                                    if !response_data_buffer.is_empty() {
                                        let mut response = vec![0]; // SYNC message type
                                        response.extend_from_slice(&response_data_buffer);
                                        Some(response)
                                    } else {
                                        None
                                    }
                                }
                                Err(e) => {
                                    warn!("Failed to process sync message from client {}: {}", client_id, e);
                                    None
                                }
                            }
                        };
                        
                        // Return response if we have one
                        if let Some(response) = response_data {
                            return Ok(response);
                        }
                    }
                    
                    // Return empty response if no sync response needed
                    Ok(Vec::new())
                }
                1 => {
                    // AWARENESS message - store and broadcast to all other clients
                    debug!("Processing AWARENESS message from client {}, size: {} bytes", client_id, data.len());
                    
                    // Store the awareness state for this client (excluding the message type byte)
                    if data.len() > 1 {
                        let awareness_data = &data[1..];
                        
                        // Validate awareness data before storing
                        if Self::is_valid_awareness_data(awareness_data) {
                            self.awareness_states.insert(client_id.to_string(), awareness_data.to_vec());
                            debug!("Stored valid awareness state for client {}, data length: {}", client_id, awareness_data.len());
                        } else {
                            warn!("Rejecting invalid awareness data from client {}, data length: {}, first 20 bytes: {:?}", 
                                  client_id, awareness_data.len(), 
                                  &awareness_data[..std::cmp::min(20, awareness_data.len())]);
                        }
                    }
                    
                    // Return empty vec - broadcasting is handled by the server
                    Ok(Vec::new())
                }
                2 => {
                    // AUTH message - handle authentication
                    debug!("Processing AUTH message from client {}", client_id);
                    self.handle_auth_message(client_id, data).await?;
                    Ok(Vec::new())
                }
                3 => {
                    // QUERY_AWARENESS message - client is requesting awareness states
                    info!("Processing QUERY_AWARENESS message from client {} - will be handled by server", client_id);
                    Ok(Vec::new()) // This message type doesn't need broadcasting, handled specially
                }
                _ => {
                    // Other messages - broadcast to all other clients
                    debug!("Processing message type {} from client {}", message_type, client_id);
                    Ok(Vec::new())
                }
            }
        } else {
            Ok(Vec::new())
        }
    }


    async fn handle_auth_message(&self, client_id: &str, _data: &[u8]) -> Result<()> {
        // Simple auth handling - in a full implementation we would parse the auth data
        info!("Client {} sent auth message", client_id);
        
        // For now, just acknowledge the auth - Socket.IO handles user management
        Ok(())
    }

    // Broadcast is now handled by Socket.IO in the server

    pub async fn cleanup_inactive_clients(&self, timeout_minutes: u64) -> usize {
        let timeout_duration = std::time::Duration::from_secs(timeout_minutes * 60);
        let now = Instant::now();
        let mut removed_count = 0;
        
        let mut to_remove = Vec::new();
        
        for entry in self.clients.iter() {
            let (client_id, last_seen) = entry.pair();
            
            if now.duration_since(*last_seen) > timeout_duration {
                to_remove.push(client_id.clone());
            }
        }
        
        for client_id in to_remove {
            self.clients.remove(&client_id);
            removed_count += 1;
        }
        
        if removed_count > 0 {
            info!("Cleaned up {} inactive clients from room {}", removed_count, self.name);
        }
        
        removed_count
    }

    pub fn client_count(&self) -> usize {
        self.clients.len()
    }

    pub fn is_empty(&self) -> bool {
        self.clients.is_empty()
    }
    
    pub async fn has_client(&self, client_id: &str) -> bool {
        self.clients.contains_key(client_id)
    }

    pub async fn mark_for_removal(&self) {
        let mut marked = self.marked_for_removal.write().await;
        *marked = Some(Instant::now());
    }

    pub async fn unmark_for_removal(&self) {
        let mut marked = self.marked_for_removal.write().await;
        *marked = None;
    }

    pub async fn should_be_removed(&self, grace_period_secs: u64) -> bool {
        let marked = self.marked_for_removal.read().await;
        if let Some(marked_time) = *marked {
            return marked_time.elapsed().as_secs() >= grace_period_secs;
        }
        false
    }

    pub async fn last_activity(&self) -> Instant {
        *self.last_activity.read().await
    }

    async fn update_activity(&self) {
        *self.last_activity.write().await = Instant::now();
    }

    /// Validate awareness data to prevent corruption
    fn is_valid_awareness_data(data: &[u8]) -> bool {
        // Basic validation - awareness data should not be empty and should have reasonable size
        if data.is_empty() || data.len() > 50000 {
            debug!("Awareness data invalid: empty={}, len={}", data.is_empty(), data.len());
            return false;
        }
        
        // Y.js awareness protocol data is valid by default
        // Only reject if we have specific known issues
        true
    }
    
    /// Try to read a variable-length integer from bytes
    fn try_read_varint(data: &[u8]) -> Option<(u64, usize)> {
        if data.is_empty() {
            return None;
        }
        
        let mut value = 0u64;
        let mut shift = 0;
        let mut pos = 0;
        
        for &byte in data.iter().take(10) { // Limit to 10 bytes to prevent infinite loop
            value |= ((byte & 0x7F) as u64) << shift;
            pos += 1;
            
            if byte & 0x80 == 0 {
                return Some((value, pos));
            }
            
            shift += 7;
            if shift >= 64 {
                return None; // Overflow
            }
        }
        
        None // Incomplete varint
    }

    /// Get all awareness states as individual messages for a requesting client
    pub fn get_awareness_states_for_client(&self, requesting_client_id: &str) -> Vec<Vec<u8>> {
        let mut messages = Vec::new();
        let mut corrupted_clients = Vec::new();
        
        for entry in self.awareness_states.iter() {
            let (client_id, awareness_data) = entry.pair();
            
            // Double-check the stored data is still valid before sending
            if Self::is_valid_awareness_data(awareness_data) {
                // Include ALL awareness states - the client will handle distinguishing local vs remote
                // Recreate the full message with message type prefix
                let mut message = vec![1u8]; // AWARENESS message type
                message.extend_from_slice(awareness_data);
                messages.push(message);
                
                debug!("Prepared valid awareness state for client {} (from {})", requesting_client_id, client_id);
            } else {
                warn!("Found corrupted awareness state from client {} when responding to {}", client_id, requesting_client_id);
                corrupted_clients.push(client_id.clone());
            }
        }
        
        // Clear corrupted awareness states after iteration (but keep clients connected)
        for client_id in corrupted_clients {
            warn!("Clearing corrupted awareness state for client {} (client remains connected)", client_id);
            self.awareness_states.remove(&client_id);
        }
        
        debug!("Prepared {} valid awareness states for client {} (including sender)", messages.len(), requesting_client_id);
        messages
    }
}