import { NextRequest, NextResponse } from 'next/server'
import { 
  createSuccessResponse, 
  withErrorHandling, 
  extractUserId,
  validateRequired
} from '@/lib/api-utils'
import { ApiError } from '@/types/api'
import { WorkflowDatabase } from '@/services/workflowDatabase'

// GET /api/workflows/[id]/snapshots - Get workflow snapshots
export const GET = withErrorHandling(async (req: NextRequest, context?: { params: { id: string } }) => {
  if (!context || !context.params || !context.params.id) {
    throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow ID is required', 400)
  }
  
  const { id: workflowId } = context.params
  const userId = extractUserId(req)
  
  // Verify workflow ownership
  const workflow = await WorkflowDatabase.getWorkflow(workflowId)
  if (!workflow) {
    throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow not found', 404)
  }
  
  if (workflow.userId !== userId) {
    throw new ApiError('FORBIDDEN', 'Not authorized to access this workflow', 403)
  }
  
  // Get snapshots
  const snapshots = await WorkflowDatabase.getWorkflowSnapshots(workflowId)
  
  return NextResponse.json(createSuccessResponse(snapshots))
})

// POST /api/workflows/[id]/snapshots - Create workflow snapshot
export const POST = withErrorHandling(async (req: NextRequest, context?: { params: { id: string } }) => {
  if (!context || !context.params || !context.params.id) {
    throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow ID is required', 400)
  }
  
  const { id: workflowId } = context.params
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
  
  // Validate required fields
  validateRequired(body, ['name', 'graphs'])
  
  // Validate graphs structure
  if (!Array.isArray(body.graphs) || body.graphs.length === 0) {
    throw new ApiError('INVALID_GRAPHS', 'At least one graph is required', 400)
  }
  
  // Create snapshot
  const snapshotId = await WorkflowDatabase.createSnapshot({
    id: workflowId,
    name: body.name,
    description: body.description,
    graphs: body.graphs,
    trigger: body.triggerConfig,
    metadata: body.metadata,
    activeGraphId: body.activeGraphId || 'main',
    isDraft: body.isDraft !== false,
    isPublished: body.isPublished || false,
    saveCount: body.saveCount || 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastSavedAt: new Date().toISOString()
  })
  
  const snapshot = await WorkflowDatabase.getSnapshot(snapshotId)
  
  return NextResponse.json(createSuccessResponse(snapshot), { status: 201 })
})