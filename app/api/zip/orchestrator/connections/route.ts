import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ServerCRDTOperations } from '@/lib/crdt/server-operations'
import { ConnectNodesResponse } from '@/types/zip'
import { v4 as uuidv4 } from 'uuid'

const connectNodesSchema = z.object({
  workflowId: z.string(),
  graphId: z.string().optional().default('main'),
  source: z.object({
    nodeId: z.string(),
    portId: z.string(),
  }),
  target: z.object({
    nodeId: z.string(),
    portId: z.string(),
  }),
})

const removeConnectionSchema = z.object({
  workflowId: z.string(),
  graphId: z.string().optional().default('main'),
  connectionId: z.string(),
})

// DELETE /api/zip/orchestrator/connections - Remove connection
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request
    const validation = removeConnectionSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request format',
          details: validation.error.errors,
        }
      }, { status: 400 })
    }
    
    const { workflowId, graphId, connectionId } = validation.data
    
    // Use CRDT operations to remove connection
    await ServerCRDTOperations.removeConnection(
      workflowId,
      graphId || 'main',
      connectionId
    )
    
    return NextResponse.json({
      success: true,
      message: 'Connection removed successfully',
    })
  } catch (error) {
    console.error('Error removing connection:', error)
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to remove connection',
        traceId: `trace_${Date.now()}`,
      }
    }, { status: 500 })
  }
}

// POST /api/zip/orchestrator/connections - Connect nodes
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request
    const validation = connectNodesSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request format',
          details: validation.error.errors,
        }
      }, { status: 400 })
    }
    
    const { workflowId, graphId, source, target } = validation.data
    const connectionId = uuidv4()
    
    // Use CRDT operations to add connection
    const connectionData = await ServerCRDTOperations.connectNodes(
      workflowId,
      graphId || 'main',
      {
        sourceNodeId: source.nodeId,
        sourcePortId: source.portId,
        targetNodeId: target.nodeId,
        targetPortId: target.portId,
      }
    )
    
    const response: ConnectNodesResponse = {
      connectionId,
      connection: connectionData,
    }
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error connecting nodes:', error)
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to connect nodes',
        traceId: `trace_${Date.now()}`,
      }
    }, { status: 500 })
  }
}