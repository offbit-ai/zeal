use anyhow::Result;
use redis::{aio::ConnectionManager, Client};
use std::sync::Arc;
use tracing::{info, error};

#[derive(Clone)]
pub struct RedisManager {
    client: Arc<Client>,
    connection: Arc<tokio::sync::Mutex<Option<ConnectionManager>>>,
    redis_url: String,
    enabled: bool,
}

impl RedisManager {
    pub fn new(redis_url: String, enabled: bool) -> Result<Self> {
        if !enabled {
            info!("Redis persistence disabled");
            return Ok(Self {
                client: Arc::new(Client::open("redis://localhost")?),
                connection: Arc::new(tokio::sync::Mutex::new(None)),
                redis_url,
                enabled: false,
            });
        }

        let client = Client::open(redis_url.clone())?;
        Ok(Self {
            client: Arc::new(client),
            connection: Arc::new(tokio::sync::Mutex::new(None)),
            redis_url,
            enabled,
        })
    }

    pub async fn connect(&self) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }

        let mut conn_guard = self.connection.lock().await;
        if conn_guard.is_some() {
            return Ok(());
        }

        info!("Connecting to Redis at {}", self.redis_url);
        match self.client.get_connection_manager().await {
            Ok(conn) => {
                info!("Successfully connected to Redis");
                *conn_guard = Some(conn);
                Ok(())
            }
            Err(e) => {
                error!("Failed to connect to Redis: {}", e);
                Err(anyhow::anyhow!("Redis connection failed: {}", e))
            }
        }
    }

    pub async fn get_connection(&self) -> Result<ConnectionManager> {
        if !self.enabled {
            return Err(anyhow::anyhow!("Redis persistence is disabled"));
        }

        let conn_guard = self.connection.lock().await;
        if let Some(conn) = conn_guard.as_ref() {
            Ok(conn.clone())
        } else {
            drop(conn_guard);
            self.connect().await?;
            let conn_guard = self.connection.lock().await;
            conn_guard
                .as_ref()
                .cloned()
                .ok_or_else(|| anyhow::anyhow!("Failed to establish Redis connection"))
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    pub async fn save_room_state(&self, room_id: &str, state: &[u8]) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }

        let mut conn = self.get_connection().await?;
        let key = format!("room:{}:state", room_id);
        
        redis::cmd("SET")
            .arg(&key)
            .arg(state)
            .arg("EX")
            .arg(86400) // 24 hours TTL
            .query_async::<_, ()>(&mut conn)
            .await?;
        
        Ok(())
    }

    pub async fn get_room_state(&self, room_id: &str) -> Result<Option<Vec<u8>>> {
        if !self.enabled {
            return Ok(None);
        }

        let mut conn = self.get_connection().await?;
        let key = format!("room:{}:state", room_id);
        
        let state: Option<Vec<u8>> = redis::cmd("GET")
            .arg(&key)
            .query_async(&mut conn)
            .await?;
        
        Ok(state)
    }

    pub async fn delete_room_state(&self, room_id: &str) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }

        let mut conn = self.get_connection().await?;
        let key = format!("room:{}:state", room_id);
        
        redis::cmd("DEL")
            .arg(&key)
            .query_async::<_, ()>(&mut conn)
            .await?;
        
        Ok(())
    }

    pub async fn save_client_session(&self, client_id: &str, session_data: &str) -> Result<()> {
        self.save_client_session_with_ttl(client_id, session_data, 3600).await
    }
    
    pub async fn save_client_session_with_ttl(&self, client_id: &str, session_data: &str, ttl_seconds: u64) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }

        let mut conn = self.get_connection().await?;
        let key = format!("session:{}", client_id);
        
        redis::cmd("SET")
            .arg(&key)
            .arg(session_data)
            .arg("EX")
            .arg(ttl_seconds)
            .query_async::<_, ()>(&mut conn)
            .await?;
        
        Ok(())
    }

    pub async fn get_client_session(&self, client_id: &str) -> Result<Option<String>> {
        if !self.enabled {
            return Ok(None);
        }

        let mut conn = self.get_connection().await?;
        let key = format!("session:{}", client_id);
        
        let session: Option<String> = redis::cmd("GET")
            .arg(&key)
            .query_async(&mut conn)
            .await?;
        
        Ok(session)
    }

    pub async fn extend_client_session(&self, client_id: &str) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }

        let mut conn = self.get_connection().await?;
        let key = format!("session:{}", client_id);
        
        redis::cmd("EXPIRE")
            .arg(&key)
            .arg(3600) // Reset to 1 hour
            .query_async::<_, ()>(&mut conn)
            .await?;
        
        Ok(())
    }

    pub async fn delete_client_session(&self, client_id: &str) -> Result<()> {
        if !self.enabled {
            return Ok(());
        }

        let mut conn = self.get_connection().await?;
        let key = format!("session:{}", client_id);
        
        redis::cmd("DEL")
            .arg(&key)
            .query_async::<_, ()>(&mut conn)
            .await?;
        
        Ok(())
    }

    pub async fn health_check(&self) -> Result<bool> {
        if !self.enabled {
            return Ok(true);
        }

        match self.get_connection().await {
            Ok(mut conn) => {
                let pong: String = redis::cmd("PING")
                    .query_async(&mut conn)
                    .await?;
                Ok(pong == "PONG")
            }
            Err(_) => Ok(false),
        }
    }
}