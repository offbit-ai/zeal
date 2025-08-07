// Runtime configuration for Zeal
// This file can be modified after build to set runtime values
// NOTE: In production/k8s deployments, this file is generated dynamically
// from environment variables by scripts/generate-config.sh

window.__ZEAL_CONFIG__ = {
  // WebSocket URL for CRDT server
  // In production, set this to your actual CRDT server URL
  // Examples:
  // - Same domain: "wss://yourdomain.com/ws"
  // - Subdomain: "wss://crdt.yourdomain.com"
  // - Local: "ws://localhost:8080"
  // Default to localhost:8080 for local development, or use the same host for production
  CRDT_SERVER_URL:
    window.location.hostname === 'localhost'
      ? 'ws://localhost:8080'  // Local CRDT server on different port
      : window.location.protocol === 'https:'
      ? `wss://${window.location.host}`
      : `ws://${window.location.host}`,

  // Enable real-time collaboration
  ENABLE_COLLABORATION: true,
}
