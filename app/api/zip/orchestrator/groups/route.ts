import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ServerCRDTOperations } from '@/lib/crdt/server-operations'
import { v4 as uuidv4 } from 'uuid'

const createGroupSchema = z.object({
  workflowId: z.string(),
  graphId: z.string().optional().default('main'),
  title: z.string(),
  nodeIds: z.array(z.string()),
  color: z.string().optional(),
  description: z.string().optional(),
})

// POST /api/zip/orchestrator/groups - Create node group
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request
    const validation = createGroupSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request format',
          details: validation.error.errors,
        }
      }, { status: 400 })
    }
    
    const { workflowId, graphId, title, nodeIds, color, description } = validation.data
    const groupId = uuidv4()
    
    // Use CRDT operations to add group
    const groupData = await ServerCRDTOperations.createNodeGroup(
      workflowId,
      graphId || 'main',
      {
        title,
        description: description || '',
        nodeIds,
        color: color || '#6B7280',
      }
    )
    
    return NextResponse.json({
      success: true,
      groupId,
      group: groupData,
    })
  } catch (error) {
    console.error('Error creating group:', error)
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create group',
        traceId: `trace_${Date.now()}`,
      }
    }, { status: 500 })
  }
}