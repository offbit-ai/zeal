import { NextRequest, NextResponse } from 'next/server'
import { 
  createSuccessResponse, 
  withErrorHandling, 
  extractUserId,
  validateRequired,
  mockDelay
} from '@/lib/api-utils'
import { ApiError } from '@/types/api'
import { WorkflowDatabase } from '@/services/workflowDatabase'

// POST /api/workflows/[id]/rollback - Rollback to a specific published version
export const POST = withErrorHandling(async (req: NextRequest, context?: { params: { id: string } }) => {
  await mockDelay(250) // Rollback might take longer
  
  if (!context || !context.params || !context.params.id) {
    throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow ID is required', 400)
  }
  
  const { id } = context.params
  const userId = extractUserId(req)
  const { versionId } = await req.json()
  
  // Validate required fields
  validateRequired({ versionId }, ['versionId'])
  
  // Get workflow to verify ownership
  const workflow = await WorkflowDatabase.getWorkflow(id)
  
  if (!workflow) {
    throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow not found', 404)
  }
  
  if (workflow.userId !== userId) {
    throw new ApiError('FORBIDDEN', 'Not authorized to rollback this workflow', 403)
  }
  
  // Get the version to rollback to
  const targetVersion = await WorkflowDatabase.getWorkflowVersion(versionId)
  
  if (!targetVersion) {
    throw new ApiError('VERSION_NOT_FOUND', 'Target version not found', 404)
  }
  
  if (targetVersion.workflowId !== id) {
    throw new ApiError('VERSION_MISMATCH', 'Version does not belong to this workflow', 400)
  }
  
  // Can only rollback to published versions
  if (!targetVersion.isPublished) {
    throw new ApiError('INVALID_ROLLBACK_TARGET', 'Can only rollback to published versions', 400)
  }
  
  // Prevent rollback to current published version
  if (workflow.publishedVersionId === versionId) {
    throw new ApiError('ALREADY_CURRENT', 'Cannot rollback to the currently published version', 409)
  }
  
  // Create a new version based on the target version (rollback creates a new version)
  const { versions } = await WorkflowDatabase.getWorkflowVersions(id, { limit: 1 })
  const latestVersion = versions[0]
  const nextVersionNumber = latestVersion ? latestVersion.version + 1 : 1
  
  // Create new version with rollback data
  const rollbackVersion = await WorkflowDatabase.updateWorkflowDraft(id, {
    name: targetVersion.name,
    description: targetVersion.description,
    graphs: targetVersion.graphs,
    trigger: targetVersion.trigger,
    metadata: {
      ...targetVersion.metadata,
      rollbackFrom: workflow.publishedVersionId,
      rollbackTo: versionId,
      rollbackAt: new Date().toISOString()
    },
    userId
  })
  
  // Publish the rollback version
  const publishedVersion = await WorkflowDatabase.publishWorkflowVersion(id, rollbackVersion.id, userId)
  
  // Get updated workflow
  const updatedWorkflow = await WorkflowDatabase.getWorkflow(id)
  
  if (!updatedWorkflow) {
    throw new ApiError('ROLLBACK_FAILED', 'Failed to retrieve rolled back workflow')
  }
  
  // Transform to API response format
  const response = {
    id: updatedWorkflow.id,
    name: updatedWorkflow.name,
    description: updatedWorkflow.description || '',
    graphs: publishedVersion.graphs,
    triggerConfig: publishedVersion.trigger,
    metadata: {
      nodeCount: publishedVersion.graphs?.[0]?.nodes?.length || 0,
      connectionCount: publishedVersion.graphs?.[0]?.connections?.length || 0,
      ...publishedVersion.metadata
    },
    status: 'published',
    version: publishedVersion.version,
    createdAt: updatedWorkflow.createdAt,
    updatedAt: updatedWorkflow.updatedAt,
    publishedAt: publishedVersion.publishedAt,
    createdBy: updatedWorkflow.userId,
    lastModifiedBy: publishedVersion.userId,
    rollbackInfo: {
      rolledBackFrom: workflow.publishedVersionId,
      rolledBackTo: versionId,
      rolledBackAt: new Date().toISOString()
    }
  }
  
  // In real implementation, this would update the execution engine
  // console.log removed`)
  
  return NextResponse.json(createSuccessResponse(response))
})