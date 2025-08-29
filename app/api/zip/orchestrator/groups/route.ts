import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ServerCRDTOperations } from '@/lib/crdt/server-operations'
import { v4 as uuidv4 } from 'uuid'
import { withZIPAuthorization } from '@/lib/auth/zip-middleware'

const createGroupSchema = z.object({
  workflowId: z.string(),
  graphId: z.string().optional().default('main'),
  title: z.string(),
  nodeIds: z.array(z.string()),
  color: z.string().optional(),
  description: z.string().optional(),
})

const removeGroupSchema = z.object({
  workflowId: z.string(),
  graphId: z.string().optional().default('main'),
  groupId: z.string(),
})

const updateGroupSchema = z.object({
  workflowId: z.string(),
  graphId: z.string().optional().default('main'),
  groupId: z.string(),
  title: z.string().optional(),
  nodeIds: z.array(z.string()).optional(),
  color: z.string().optional(),
  description: z.string().optional(),
})

// DELETE /api/zip/orchestrator/groups - Remove group
export const DELETE = withZIPAuthorization(async (request: NextRequest, context?: { params: any }) => {
  try {
    const body = await request.json()

    // Validate request
    const validation = removeGroupSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request format',
          details: validation.error.errors,
        }
      }, { status: 400 })
    }

    const { workflowId, graphId, groupId } = validation.data

    // Use CRDT operations to remove group
    await ServerCRDTOperations.removeGroup(
      workflowId,
      graphId || 'main',
      groupId
    )

    return NextResponse.json({
      success: true,
      message: 'Group removed successfully',
    })
  } catch (error) {
    console.error('Error removing group:', error)
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to remove group',
        traceId: `trace_${Date.now()}`,
      }
    }, { status: 500 })
  }
}, {
  resourceType: 'workflow',
  action: 'delete'
})

// PATCH /api/zip/orchestrator/groups - Update group properties
export const PATCH = withZIPAuthorization(async (request: NextRequest, context?: { params: any }) => {
  try {
    const body = await request.json()

    // Validate request
    const validation = updateGroupSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request format',
          details: validation.error.errors,
        }
      }, { status: 400 })
    }

    const { workflowId, graphId, groupId, ...updates } = validation.data

    // Use CRDT operations to update group
    const updatedGroup = await ServerCRDTOperations.updateGroupProperties(
      workflowId,
      graphId || 'main',
      groupId,
      updates
    )

    return NextResponse.json({
      success: true,
      group: updatedGroup,
    })
  } catch (error) {
    console.error('Error updating group:', error)
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update group',
        traceId: `trace_${Date.now()}`,
      }
    }, { status: 500 })
  }
}, {
  resourceType: 'workflow',
  action: 'update'
})

// POST /api/zip/orchestrator/groups - Create node group
export const POST = withZIPAuthorization(async (request: NextRequest, context?: { params: any }) => {
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
}, {
  resourceType: 'workflow',
  action: 'create'
})