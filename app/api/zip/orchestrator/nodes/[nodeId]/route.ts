import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ServerCRDTOperations } from '@/lib/crdt/server-operations'
import { withZIPAuthorization } from '@/lib/auth/zip-middleware'

const updateNodeSchema = z.object({
  workflowId: z.string(),
  graphId: z.string().optional().default('main'),
  properties: z.record(z.any()).optional(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }).optional(),
})

// PATCH /api/zip/orchestrator/nodes/[nodeId] - Update node
export const PATCH = withZIPAuthorization(async (
  request: NextRequest,
  context?: { params: { nodeId: string } }
) => {
  try {
    if (!context || !context.params) {
      return NextResponse.json({
        error: 'Missing node ID parameter'
      }, { status: 400 })
    }
    const { nodeId } = context.params
    const body = await request.json()
    
    // Validate request
    const validation = updateNodeSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request format',
          details: validation.error.errors,
        }
      }, { status: 400 })
    }
    
    const { workflowId, graphId, properties, position } = validation.data
    
    // Use CRDT operations to update node
    if (properties) {
      await ServerCRDTOperations.updateNodeProperties(workflowId, graphId || 'main', nodeId, properties)
    }
    
    if (position) {
      await ServerCRDTOperations.updateNodePosition(workflowId, graphId || 'main', nodeId, position)
    }
    
    return NextResponse.json({
      success: true,
      nodeId,
      updated: {
        properties: !!properties,
        position: !!position,
      },
    })
  } catch (error) {
    console.error('Error updating node:', error)
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update node',
        traceId: `trace_${Date.now()}`,
      }
    }, { status: 500 })
  }
}, {
  resourceType: 'node',
  action: 'update'
})

// DELETE /api/zip/orchestrator/nodes/[nodeId] - Delete node
export const DELETE = withZIPAuthorization(async (
  request: NextRequest,
  context?: { params: { nodeId: string } }
) => {
  try {
    if (!context || !context.params) {
      return NextResponse.json({
        error: 'Missing node ID parameter'
      }, { status: 400 })
    }
    const { nodeId } = context.params
    const { searchParams } = new URL(request.url)
    const workflowId = searchParams.get('workflowId')
    const graphId = searchParams.get('graphId') || 'main'
    
    if (!workflowId) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'workflowId is required',
        }
      }, { status: 400 })
    }
    
    // Use CRDT operations to delete node
    await ServerCRDTOperations.removeNode(workflowId, graphId, nodeId)
    
    return NextResponse.json({
      success: true,
      message: `Node ${nodeId} deleted`,
    })
  } catch (error) {
    console.error('Error deleting node:', error)
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete node',
        traceId: `trace_${Date.now()}`,
      }
    }, { status: 500 })
  }
}, {
  resourceType: 'node',
  action: 'delete'
})