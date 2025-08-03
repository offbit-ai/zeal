/**
 * Rust CRDT Server with Socket.IO Compatibility
 * 
 * This server provides Socket.IO compatibility for the existing
 * JavaScript client while using Rust for better performance.
 */

use clap::Parser;
use std::sync::Arc;
use tracing::{info, Level};

mod config;
mod message;
mod redis_manager;
mod room;
mod server;

use config::ServerConfig;
use server::CRDTServer;

#[derive(Parser, Debug)]
#[command(name = "zeal-crdt-server")]
#[command(about = "High-performance CRDT server for Zeal")]
struct Args {
    /// Port to listen on
    #[arg(short, long, default_value = "8080")]
    port: u16,

    /// Enable verbose logging
    #[arg(short, long)]
    verbose: bool,

    /// Maximum clients per room
    #[arg(long, default_value = "100")]
    max_clients_per_room: usize,

    /// Client timeout in minutes
    #[arg(long, default_value = "30")]
    client_timeout_minutes: u64,

    /// CORS origin (for Next.js dev server)
    #[arg(long, default_value = "http://localhost:3000")]
    cors_origin: String,

    /// Redis URL for persistence
    #[arg(long, default_value = "redis://redis:6379")]
    redis_url: String,

    /// Disable Redis persistence
    #[arg(long)]
    disable_redis_persistence: bool,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let mut args = Args::parse();
    
    // Override with environment variables if present
    if let Ok(redis_url) = std::env::var("REDIS_URL") {
        args.redis_url = redis_url;
    }
    if let Ok(disable) = std::env::var("DISABLE_REDIS_PERSISTENCE") {
        args.disable_redis_persistence = disable.to_lowercase() == "true" || disable == "1";
    }

    // Initialize tracing
    let level = if args.verbose { Level::DEBUG } else { Level::INFO };
    tracing_subscriber::fmt()
        .with_max_level(level)
        .with_target(false)
        .init();

    info!("🦀 Starting Zeal CRDT Server");
    info!("📡 Port: {}", args.port);
    info!("🔧 Max clients per room: {}", args.max_clients_per_room);
    info!("⏰ Client timeout: {} minutes", args.client_timeout_minutes);
    info!("🌐 CORS origin: {}", args.cors_origin);
    info!("🗄️  Redis persistence: {}", if args.disable_redis_persistence { "disabled" } else { "enabled" });

    // Create server config
    let config = ServerConfig {
        port: args.port,
        max_clients_per_room: args.max_clients_per_room,
        client_timeout_minutes: args.client_timeout_minutes,
        cors_origin: args.cors_origin,
        redis_url: args.redis_url,
        enable_redis_persistence: !args.disable_redis_persistence,
    };

    // Create and start the server
    let server = Arc::new(CRDTServer::new(config));
    server.start().await?;

    Ok(())
}