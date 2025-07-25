import { NextRequest, NextResponse } from 'next/server'
import { 
  createSuccessResponse, 
  withErrorHandling, 
  extractUserId,
  validateRequired,
  validateWorkflowNodes,
  validateWorkflowConnections,
  mockDelay
} from '@/lib/api-utils'
import { ApiError, WorkflowUpdateRequest } from '@/types/api'
import { WorkflowDatabase } from '@/services/workflowDatabase'

// GET /api/workflows/[id] - Get specific workflow
export const GET = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  await mockDelay(100)
  
  const { id } = params
  const userId = extractUserId(req)
  
  // Get workflow
  const workflow = await WorkflowDatabase.getWorkflow(id)
  
  if (!workflow) {
    throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow not found', 404)
  }
  
  // Check ownership
  if (workflow.userId !== userId) {
    throw new ApiError('FORBIDDEN', 'Not authorized to access this workflow', 403)
  }
  
  // Get latest version
  const { versions } = await WorkflowDatabase.getWorkflowVersions(id, { limit: 1 })
  const latestVersion = versions[0]
  
  // Get published version if it exists
  let publishedVersion = null
  if (workflow.publishedVersionId) {
    publishedVersion = await WorkflowDatabase.getWorkflowVersion(workflow.publishedVersionId)
  }
  
  if (!latestVersion) {
    throw new ApiError('WORKFLOW_CORRUPTED', 'Workflow has no versions', 500)
  }
  
  // Transform to API response format
  const response = {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description || '',
    nodes: latestVersion.nodes,
    connections: latestVersion.connections,
    metadata: {
      nodeCount: latestVersion.nodes.length,
      connectionCount: latestVersion.connections.length,
      ...latestVersion.metadata
    },
    status: publishedVersion ? 'published' : 'draft',
    version: latestVersion.version,
    createdAt: workflow.createdAt,
    updatedAt: workflow.updatedAt,
    publishedAt: publishedVersion?.publishedAt,
    createdBy: workflow.userId,
    lastModifiedBy: latestVersion.userId
  }
  
  return NextResponse.json(createSuccessResponse(response))
})

// PUT /api/workflows/[id] - Update workflow (creates new version)
export const PUT = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  await mockDelay(200)
  
  const { id } = params
  const userId = extractUserId(req)
  const body: WorkflowUpdateRequest = await req.json()
  
  // Get workflow to verify ownership
  const workflow = await WorkflowDatabase.getWorkflow(id)
  
  if (!workflow) {
    throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow not found', 404)
  }
  
  if (workflow.userId !== userId) {
    throw new ApiError('FORBIDDEN', 'Not authorized to update this workflow', 403)
  }
  
  // Validate required fields
  validateRequired(body, ['nodes', 'connections'])
  
  // Validate nodes and connections
  validateWorkflowNodes(body.nodes)
  const nodeIds = new Set(body.nodes.map(node => node.id))
  validateWorkflowConnections(body.connections, nodeIds)
  
  // Check for duplicate name if name is being changed
  if (body.name && body.name !== workflow.name) {
    const { workflows } = await WorkflowDatabase.getWorkflows(userId, { search: body.name })
    const existingWorkflow = workflows.find(w => 
      w.name.toLowerCase() === body.name.toLowerCase() && w.id !== id
    )
    
    if (existingWorkflow) {
      throw new ApiError(
        'DUPLICATE_WORKFLOW_NAME',
        `Workflow with name '${body.name}' already exists`,
        409
      )
    }
  }
  
  // Create new version
  const newVersion = await WorkflowDatabase.updateWorkflow(id, {
    name: body.name,
    description: body.description,
    nodes: body.nodes,
    connections: body.connections,
    metadata: body.metadata,
    userId
  })
  
  // Get updated workflow
  const updatedWorkflow = await WorkflowDatabase.getWorkflow(id)
  
  if (!updatedWorkflow) {
    throw new ApiError('UPDATE_FAILED', 'Failed to retrieve updated workflow')
  }
  
  // Get published version if it exists
  let publishedVersion = null
  if (updatedWorkflow.publishedVersionId) {
    publishedVersion = await WorkflowDatabase.getWorkflowVersion(updatedWorkflow.publishedVersionId)
  }
  
  // Transform to API response format
  const response = {
    id: updatedWorkflow.id,
    name: updatedWorkflow.name,
    description: updatedWorkflow.description || '',
    nodes: newVersion.nodes,
    connections: newVersion.connections,
    metadata: {
      nodeCount: newVersion.nodes.length,
      connectionCount: newVersion.connections.length,
      ...newVersion.metadata
    },
    status: publishedVersion ? 'published' : 'draft',
    version: newVersion.version,
    createdAt: updatedWorkflow.createdAt,
    updatedAt: updatedWorkflow.updatedAt,
    publishedAt: publishedVersion?.publishedAt,
    createdBy: updatedWorkflow.userId,
    lastModifiedBy: newVersion.userId
  }
  
  return NextResponse.json(createSuccessResponse(response))
})

// DELETE /api/workflows/[id] - Delete workflow
export const DELETE = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  await mockDelay(150)
  
  const { id } = params
  const userId = extractUserId(req)
  
  // Delete workflow (includes authorization check)
  await WorkflowDatabase.deleteWorkflow(id, userId)
  
  return NextResponse.json(createSuccessResponse({ 
    message: `Workflow '${id}' has been deleted` 
  }))
})