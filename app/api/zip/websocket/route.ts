import { NextRequest, NextResponse } from 'next/server'
import { initializeZipWebSocket, getZipWebSocketHandler } from '@/lib/zip/websocket-server'

// GET /api/zip/websocket - Check WebSocket status
export async function GET(_request: NextRequest) {
  const handler = getZipWebSocketHandler()
  
  if (!handler) {
    // Initialize WebSocket if not already done
    try {
      initializeZipWebSocket()
      return NextResponse.json({
        status: 'initialized',
        message: 'ZIP WebSocket server initialized',
        port: process.env.ZIP_WEBSOCKET_PORT || 3001,
      })
    } catch (error) {
      return NextResponse.json({
        status: 'error',
        message: 'Failed to initialize ZIP WebSocket',
        error: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 })
    }
  }
  
  return NextResponse.json({
    status: 'running',
    message: 'ZIP WebSocket server is running',
    port: process.env.ZIP_WEBSOCKET_PORT || 3001,
  })
}