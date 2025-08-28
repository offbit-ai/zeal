/**
 * ZIP WebSocket Server Initialization
 * Sets up the WebSocket server for ZIP protocol communication
 */

import { createServer } from 'http'
import { Server as HTTPServer } from 'http'
import { ZipWebSocketHandler } from './websocket-handler'

let websocketHandler: ZipWebSocketHandler | null = null

/**
 * Initialize the ZIP WebSocket server
 * This should be called when the Next.js server starts
 */
export function initializeZipWebSocket(httpServer?: HTTPServer): ZipWebSocketHandler {
  if (websocketHandler) {
    console.log('ZIP WebSocket handler already initialized')
    return websocketHandler
  }

  // If no server provided, create one
  const server = httpServer || createServer()
  
  // Create the WebSocket handler
  websocketHandler = new ZipWebSocketHandler(server)
  
  // If we created our own server, start listening
  if (!httpServer) {
    const port = process.env.ZIP_WEBSOCKET_PORT || 3001
    server.listen(port, () => {
      console.log(`ZIP WebSocket server listening on port ${port}`)
    })
  }
  
  console.log('ZIP WebSocket handler initialized')
  
  // Handle cleanup on process exit
  process.on('SIGTERM', cleanup)
  process.on('SIGINT', cleanup)
  
  return websocketHandler
}

/**
 * Get the current WebSocket handler instance
 */
export function getZipWebSocketHandler(): ZipWebSocketHandler | null {
  return websocketHandler
}

/**
 * Cleanup function
 */
function cleanup() {
  if (websocketHandler) {
    console.log('Shutting down ZIP WebSocket handler...')
    // Close all connections
    // Note: Socket.IO handles this internally
  }
  process.exit(0)
}

/**
 * Helper function to emit events from server-side code
 */
export function emitZipEvent(workflowId: string, event: any) {
  if (!websocketHandler) {
    console.warn('ZIP WebSocket handler not initialized')
    return
  }
  
  websocketHandler.emitZipEvent(workflowId, event)
}

/**
 * Helper function to broadcast execution control events
 */
export function broadcastExecutionControl(workflowId: string, type: any, data: any) {
  if (!websocketHandler) {
    console.warn('ZIP WebSocket handler not initialized')
    return
  }
  
  websocketHandler.broadcastExecutionControl(workflowId, type, data)
}

// Auto-initialize if running in Next.js development mode
if (process.env.NODE_ENV === 'development' && typeof window === 'undefined') {
  // This runs on the server side only
  setTimeout(() => {
    // Delay initialization to ensure server is ready
    if (!websocketHandler) {
      console.log('Auto-initializing ZIP WebSocket for development...')
      initializeZipWebSocket()
    }
  }, 1000)
}