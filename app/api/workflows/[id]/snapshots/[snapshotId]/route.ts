import { NextRequest, NextResponse } from 'next/server'
import { 
  createSuccessResponse, 
  withErrorHandling, 
  extractUserId
} from '@/lib/api-utils'
import { ApiError } from '@/types/api'
import { WorkflowDatabase } from '@/services/workflowDatabase'

// GET /api/workflows/[id]/snapshots/[snapshotId] - Get specific snapshot
export const GET = withErrorHandling(async (
  req: NextRequest, 
  { params }: { params: { id: string; snapshotId: string } }
) => {
  const { id: workflowId, snapshotId } = params
  const userId = extractUserId(req)
  
  // Verify workflow ownership
  const workflow = await WorkflowDatabase.getWorkflow(workflowId)
  if (!workflow) {
    throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow not found', 404)
  }
  
  if (workflow.userId !== userId) {
    throw new ApiError('FORBIDDEN', 'Not authorized to access this workflow', 403)
  }
  
  // Get snapshot
  const snapshot = await WorkflowDatabase.getSnapshot(snapshotId)
  if (!snapshot) {
    throw new ApiError('SNAPSHOT_NOT_FOUND', 'Snapshot not found', 404)
  }
  
  return NextResponse.json(createSuccessResponse(snapshot))
})

// PUT /api/workflows/[id]/snapshots/[snapshotId] - Update snapshot
export const PUT = withErrorHandling(async (
  req: NextRequest, 
  { params }: { params: { id: string; snapshotId: string } }
) => {
  const { id: workflowId, snapshotId } = params
  const userId = extractUserId(req)
  const body = await req.json()
  
  // Verify workflow ownership
  const workflow = await WorkflowDatabase.getWorkflow(workflowId)
  if (!workflow) {
    throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow not found', 404)
  }
  
  if (workflow.userId !== userId) {
    throw new ApiError('FORBIDDEN', 'Not authorized to update this workflow', 403)
  }
  
  // Validate graphs if provided
  if (body.graphs) {
    if (!Array.isArray(body.graphs) || body.graphs.length === 0) {
      throw new ApiError('INVALID_GRAPHS', 'At least one graph is required', 400)
    }
  }
  
  // Update snapshot
  const updatedSnapshot = await WorkflowDatabase.updateSnapshot(snapshotId, {
    name: body.name,
    description: body.description,
    graphs: body.graphs,
    triggerConfig: body.triggerConfig,
    metadata: body.metadata
  })
  
  if (!updatedSnapshot) {
    throw new ApiError('SNAPSHOT_NOT_FOUND', 'Snapshot not found', 404)
  }
  
  return NextResponse.json(createSuccessResponse(updatedSnapshot))
})

// DELETE /api/workflows/[id]/snapshots/[snapshotId] - Delete snapshot
export const DELETE = withErrorHandling(async (
  req: NextRequest, 
  { params }: { params: { id: string; snapshotId: string } }
) => {
  const { id: workflowId, snapshotId } = params
  const userId = extractUserId(req)
  
  // Verify workflow ownership
  const workflow = await WorkflowDatabase.getWorkflow(workflowId)
  if (!workflow) {
    throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow not found', 404)
  }
  
  if (workflow.userId !== userId) {
    throw new ApiError('FORBIDDEN', 'Not authorized to delete from this workflow', 403)
  }
  
  // Delete snapshot
  const deleted = await WorkflowDatabase.deleteSnapshot(snapshotId)
  
  if (!deleted) {
    throw new ApiError('SNAPSHOT_NOT_FOUND', 'Snapshot not found', 404)
  }
  
  return NextResponse.json(createSuccessResponse({ deleted: true }))
})