import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ServerCRDTOperations } from '../../../../lib/crdt/server-operations'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'

// Zod schema for creating a group
const CreateGroupSchema = z.object({
  workflowId: z.string().min(1, 'Workflow ID is required'),
  graphId: z.string().default('main'),
  group: z.object({
    title: z.string().min(1, 'Group title is required'),
    nodeIds: z.array(z.string()).min(1, 'At least one node ID is required'),
    color: z.string().optional(),
    description: z.string().optional(),
  }),
})

// Zod schema for updating a group
const UpdateGroupSchema = z.object({
  workflowId: z.string().min(1, 'Workflow ID is required'),
  graphId: z.string().default('main'),
  groupId: z.string().min(1, 'Group ID is required'),
  updates: z.object({
    title: z.string().optional(),
    nodeIds: z.array(z.string()).optional(),
    color: z.string().optional(),
    description: z.string().optional(),
    isCollapsed: z.boolean().optional(),
  }).refine(
    (val) => Object.keys(val).length > 0,
    { message: 'At least one update field is required' }
  ),
})

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json()
    
    // Validate input with Zod
    const validationResult = CreateGroupSchema.safeParse(body)
    
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
    
    const { workflowId, graphId, group } = validationResult.data

    console.log(`[API] Creating node group in workflow ${workflowId}`)
    console.log(`[API] Group details:`, group)

    // Create group using ServerCRDTOperations for embed mode
    const createdGroup = await ServerCRDTOperations.createNodeGroup(
      workflowId,
      graphId,
      group
    )

    return NextResponse.json({
      success: true,
      data: {
        groupId: createdGroup.id,
        message: 'Node group created successfully',
        group: createdGroup,
      }
    })
  } catch (error) {
    console.error('Error creating node group:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create node group',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}, {
  resource: 'orchestrator',
  action: 'create'
})

export const PUT = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json()
    
    // Validate input with Zod
    const validationResult = UpdateGroupSchema.safeParse(body)
    
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
    
    const { workflowId, graphId, groupId, updates } = validationResult.data

    console.log(`[API] Updating group ${groupId} in workflow ${workflowId}`)
    console.log(`[API] Updates:`, updates)

    // Update group using ServerCRDTOperations for embed mode
    const updatedGroup = await ServerCRDTOperations.updateGroupProperties(
      workflowId,
      graphId,
      groupId,
      updates
    )

    return NextResponse.json({
      success: true,
      data: {
        groupId,
        message: 'Group updated successfully',
        group: updatedGroup,
      }
    })
  } catch (error) {
    console.error('Error updating group:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update group',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}, {
  resource: 'orchestrator',
  action: 'update'
})