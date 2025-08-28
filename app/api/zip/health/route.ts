import { NextRequest, NextResponse } from 'next/server'
import { getDatabaseOperations } from '@/lib/database'
import { HealthCheckResponse } from '@/types/zip'

// GET /api/zip/health - Health check
export async function GET(_request: NextRequest) {
  const response: HealthCheckResponse = {
    status: 'healthy',
    version: '1.0.0',
    services: {
      api: 'healthy',
      crdt: 'healthy',
      database: 'healthy',
      websocket: 'healthy',
    },
  }
  
  try {
    // Check database connection
    try {
      const db = await getDatabaseOperations()
      // Simple query to check database
      await db.listWorkflows({ userId: 'health-check', limit: 1, offset: 0 })
      response.services.database = 'healthy'
    } catch (dbError) {
      response.services.database = 'unhealthy'
      response.status = 'unhealthy'
    }
    
    // Check CRDT server (if available)
    try {
      // Check if CRDT server is running
      if (process.env.CRDT_SERVER_URL) {
        const crdtResponse = await fetch(`${process.env.CRDT_SERVER_URL}/health`)
        response.services.crdt = crdtResponse.ok ? 'healthy' : 'unhealthy'
        if (!crdtResponse.ok) {
          response.status = 'unhealthy'
        }
      }
    } catch (crdtError) {
      response.services.crdt = 'unhealthy'
      // CRDT being down doesn't make the entire service unhealthy
    }
    
    // WebSocket health is assumed healthy if the server is running
    // In production, you might want to check actual WebSocket connections
    
    return NextResponse.json(response, { 
      status: response.status === 'healthy' ? 200 : 503 
    })
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json({
      ...response,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 503 })
  }
}