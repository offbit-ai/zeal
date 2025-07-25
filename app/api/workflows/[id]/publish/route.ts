import { NextRequest, NextResponse } from 'next/server'
import { 
  createSuccessResponse, 
  withErrorHandling, 
  extractUserId,
  mockDelay
} from '@/lib/api-utils'
import { ApiError } from '@/types/api'
import { WorkflowDatabase } from '@/services/workflowDatabase'

// POST /api/workflows/[id]/publish - Publish workflow
export const POST = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  await mockDelay(200) // Publishing might take longer
  
  const { id } = params
  const userId = extractUserId(req)
  const { versionId } = await req.json() // Optionally specify which version to publish
  
  // Get workflow to verify ownership
  const workflow = await WorkflowDatabase.getWorkflow(id)
  
  if (!workflow) {
    throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow not found', 404)
  }
  
  if (workflow.userId !== userId) {
    throw new ApiError('FORBIDDEN', 'Not authorized to publish this workflow', 403)
  }
  
  // Determine which version to publish
  let targetVersionId = versionId
  if (!targetVersionId) {
    // Get latest version if no specific version specified
    const { versions } = await WorkflowDatabase.getWorkflowVersions(id, { limit: 1 })
    if (versions.length === 0) {
      throw new ApiError('NO_VERSIONS', 'Workflow has no versions to publish', 400)
    }
    targetVersionId = versions[0].id
  }
  
  // Get the version to publish
  const versionToPublish = await WorkflowDatabase.getWorkflowVersion(targetVersionId)
  
  if (!versionToPublish) {
    throw new ApiError('VERSION_NOT_FOUND', 'Specified version not found', 404)
  }
  
  if (versionToPublish.workflowId !== id) {
    throw new ApiError('VERSION_MISMATCH', 'Version does not belong to this workflow', 400)
  }
  
  // Validate workflow can be published
  if (versionToPublish.nodes.length === 0) {
    throw new ApiError('EMPTY_WORKFLOW', 'Cannot publish empty workflow', 400)
  }
  
  // Check for required environment variables
  const requiredEnvVars = new Set<string>()
  versionToPublish.nodes.forEach(node => {
    if (node.requiredEnvVars) {
      node.requiredEnvVars.forEach(varName => requiredEnvVars.add(varName))
    }
  })
  
  // In real implementation, validate that all required env vars are configured
  // For now, just log them
  if (requiredEnvVars.size > 0) {
    console.log(`Publishing workflow ${id} requires env vars:`, Array.from(requiredEnvVars))
  }
  
  // Publish the version
  const publishedVersion = await WorkflowDatabase.publishWorkflow(id, targetVersionId, userId)
  
  // Get updated workflow
  const updatedWorkflow = await WorkflowDatabase.getWorkflow(id)
  
  if (!updatedWorkflow) {
    throw new ApiError('PUBLISH_FAILED', 'Failed to retrieve published workflow')
  }
  
  // Transform to API response format
  const response = {
    id: updatedWorkflow.id,
    name: updatedWorkflow.name,
    description: updatedWorkflow.description || '',
    nodes: publishedVersion.nodes,
    connections: publishedVersion.connections,
    metadata: {
      nodeCount: publishedVersion.nodes.length,
      connectionCount: publishedVersion.connections.length,
      ...publishedVersion.metadata
    },
    status: 'published',
    version: publishedVersion.version,
    createdAt: updatedWorkflow.createdAt,
    updatedAt: updatedWorkflow.updatedAt,
    publishedAt: publishedVersion.publishedAt,
    createdBy: updatedWorkflow.userId,
    lastModifiedBy: publishedVersion.userId
  }
  
  // In real implementation, this would trigger deployment to execution engine
  console.log(`Workflow ${id} version ${publishedVersion.version} published successfully`)
  
  return NextResponse.json(createSuccessResponse(response))
})

// DELETE /api/workflows/[id]/publish - Unpublish workflow
export const DELETE = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  await mockDelay(150)
  
  const { id } = params
  const userId = extractUserId(req)
  
  // Get workflow to verify ownership and current status
  const workflow = await WorkflowDatabase.getWorkflow(id)
  
  if (!workflow) {
    throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow not found', 404)
  }
  
  if (workflow.userId !== userId) {
    throw new ApiError('FORBIDDEN', 'Not authorized to unpublish this workflow', 403)
  }
  
  if (!workflow.publishedVersionId) {
    throw new ApiError('WORKFLOW_NOT_PUBLISHED', 'Workflow is not published', 409)
  }
  
  // Get current published version
  const publishedVersion = await WorkflowDatabase.getWorkflowVersion(workflow.publishedVersionId)
  
  if (!publishedVersion) {
    throw new ApiError('PUBLISHED_VERSION_NOT_FOUND', 'Published version not found', 500)
  }
  
  // Unpublish by removing published version reference and updating version status
  const db = await import('@/lib/database').then(m => m.getDatabase())
  
  await (await db).run('BEGIN TRANSACTION')
  
  try {
    // Update the published version to mark as unpublished
    await (await db).run(`
      UPDATE workflow_versions 
      SET isPublished = 0, publishedAt = NULL 
      WHERE id = ?
    `, [workflow.publishedVersionId])
    
    // Remove published version reference from workflow
    await (await db).run(`
      UPDATE workflows 
      SET publishedVersionId = NULL, updatedAt = ?
      WHERE id = ?
    `, [new Date().toISOString(), id])
    
    await (await db).run('COMMIT')
  } catch (error) {
    await (await db).run('ROLLBACK')
    throw error
  }
  
  // Get latest version for response
  const { versions } = await WorkflowDatabase.getWorkflowVersions(id, { limit: 1 })
  const latestVersion = versions[0]
  
  // Get updated workflow
  const updatedWorkflow = await WorkflowDatabase.getWorkflow(id)
  
  if (!updatedWorkflow || !latestVersion) {
    throw new ApiError('UNPUBLISH_FAILED', 'Failed to retrieve unpublished workflow')
  }
  
  // Transform to API response format
  const response = {
    id: updatedWorkflow.id,
    name: updatedWorkflow.name,
    description: updatedWorkflow.description || '',
    nodes: latestVersion.nodes,
    connections: latestVersion.connections,
    metadata: {
      nodeCount: latestVersion.nodes.length,
      connectionCount: latestVersion.connections.length,
      ...latestVersion.metadata
    },
    status: 'draft',
    version: latestVersion.version,
    createdAt: updatedWorkflow.createdAt,
    updatedAt: updatedWorkflow.updatedAt,
    createdBy: updatedWorkflow.userId,
    lastModifiedBy: latestVersion.userId
  }
  
  // In real implementation, this would remove from execution engine
  console.log(`Workflow ${id} unpublished successfully`)
  
  return NextResponse.json(createSuccessResponse(response))
})