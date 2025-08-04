// Runtime configuration for Zeal
// This file can be modified after build to set runtime values

window.__ZEAL_CONFIG__ = {
  // WebSocket URL for CRDT server
  // In production, set this to your actual CRDT server URL
  // Examples:
  // - Same domain: "wss://yourdomain.com/ws"
  // - Subdomain: "wss://crdt.yourdomain.com"
  // - Local: "ws://localhost:8080"
  CRDT_SERVER_URL:
    window.location.protocol === 'https:'
      ? `wss://${window.location.host}/ws`
      : `ws://${window.location.hostname}:8080`,

  // Enable real-time collaboration
  ENABLE_COLLABORATION: true,
}
