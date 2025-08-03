#[derive(Clone, Debug)]
pub struct ServerConfig {
    pub port: u16,
    pub max_clients_per_room: usize,
    pub client_timeout_minutes: u64,
    pub cors_origin: String,
    pub redis_url: String,
    pub enable_redis_persistence: bool,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            port: 8080,
            max_clients_per_room: 100,
            client_timeout_minutes: 30,
            cors_origin: "http://localhost:3000".to_string(),
            redis_url: "redis://redis:6379".to_string(),
            enable_redis_persistence: true,
        }
    }
}