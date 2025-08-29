import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ServerCRDTOperations } from '../../../../../lib/crdt/server-operations'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'

// Zod schema for input validation
const UpdateNodePositionSchema = z.object({
  workflowId: z.string().min(1, 'Workflow ID is required'),
  graphId: z.string().default('main'),
  nodeId: z.string().min(1, 'Node ID is required'),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
})

export const PUT = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json()
    
    // Validate input with Zod
    const validationResult = UpdateNodePositionSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      )
    }
    
    const { workflowId, graphId, nodeId, position } = validationResult.data

    console.log(`[API] Updating node position: ${nodeId} in workflow ${workflowId}`)
    console.log(`[API] New position:`, position)

    // Update node position using ServerCRDTOperations for embed mode
    const updatedNode = await ServerCRDTOperations.updateNodePosition(
      workflowId,
      graphId,
      nodeId,
      position
    )

    return NextResponse.json({
      success: true,
      data: {
        nodeId,
        message: 'Node position updated successfully',
        node: updatedNode,
      }
    })
  } catch (error) {
    console.error('Error updating node position:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update node position',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}, {
  resource: 'orchestrator',
  action: 'update'
})