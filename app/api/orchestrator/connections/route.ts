import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ServerCRDTOperations } from '../../../../lib/crdt/server-operations'

const ConnectNodesSchema = z.object({
  workflowId: z.string().min(1, 'Workflow ID is required'),
  graphId: z.string().default('main'),
  sourceNodeId: z.string().min(1, 'Source node ID is required'),
  sourcePortId: z.string().min(1, 'Source port ID is required'),
  targetNodeId: z.string().min(1, 'Target node ID is required'),
  targetPortId: z.string().min(1, 'Target port ID is required'),
  useCRDT: z.boolean().optional().default(true), // Default to true for real-time sync
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input with Zod
    const validationResult = ConnectNodesSchema.safeParse(body)
    
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
    
    const params = validationResult.data

    console.log(`[API] Creating connection in workflow ${params.workflowId}`)
    console.log(`[API] Connection: ${params.sourceNodeId}:${params.sourcePortId} -> ${params.targetNodeId}:${params.targetPortId}`)

    // Always use ServerCRDTOperations for embed mode
    const connection = await ServerCRDTOperations.connectNodes(
      params.workflowId,
      params.graphId,
      {
        sourceNodeId: params.sourceNodeId,
        sourcePortId: params.sourcePortId,
        targetNodeId: params.targetNodeId,
        targetPortId: params.targetPortId,
      }
    )

    return NextResponse.json({
      success: true,
      data: {
        connection,
        message: 'Connection created successfully',
        requiresRefresh: true, // Signal to client to refresh CRDT state
      }
    })
  } catch (error) {
    console.error('Error creating connection:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create connection',
      },
      { status: 500 }
    )
  }
}
