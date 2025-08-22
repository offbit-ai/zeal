import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ServerCRDTOperations } from '../../../../../lib/crdt/server-operations'

// Zod schema for input validation
const UpdateNodePropertiesSchema = z.object({
  workflowId: z.string().min(1, 'Workflow ID is required'),
  graphId: z.string().default('main'),
  nodeId: z.string().min(1, 'Node ID is required'),
  propertyValues: z.record(z.any()).refine(
    (val) => Object.keys(val).length > 0,
    { message: 'Property values must not be empty' }
  ),
})

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input with Zod
    const validationResult = UpdateNodePropertiesSchema.safeParse(body)
    
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
    
    const { workflowId, graphId, nodeId, propertyValues } = validationResult.data

    console.log(`[API] Updating node properties: ${nodeId} in workflow ${workflowId}`)
    console.log(`[API] Property values:`, propertyValues)

    // Update node properties using ServerCRDTOperations for embed mode
    const updatedNode = await ServerCRDTOperations.updateNodeProperties(
      workflowId,
      graphId,
      nodeId,
      propertyValues
    )

    return NextResponse.json({
      success: true,
      data: {
        nodeId,
        message: 'Node properties updated successfully',
        node: updatedNode,
      }
    })
  } catch (error) {
    console.error('Error updating node properties:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update node properties',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}