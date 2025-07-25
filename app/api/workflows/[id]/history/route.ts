import { NextRequest, NextResponse } from 'next/server'
import { 
  createSuccessResponse, 
  withErrorHandling, 
  extractUserId,
  parsePaginationParams,
  mockDelay
} from '@/lib/api-utils'
import { ApiError } from '@/types/api'
import { WorkflowDatabase } from '@/services/workflowDatabase'

// GET /api/workflows/[id]/history - Get workflow version history
export const GET = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  await mockDelay(100)
  
  const { id } = params
  const { searchParams } = new URL(req.url)
  const userId = extractUserId(req)
  const pagination = parsePaginationParams(searchParams)
  const publishedOnly = searchParams.get('published_only') === 'true'
  
  // Get workflow to verify ownership
  const workflow = await WorkflowDatabase.getWorkflow(id)
  
  if (!workflow) {
    throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow not found', 404)
  }
  
  if (workflow.userId !== userId) {
    throw new ApiError('FORBIDDEN', 'Not authorized to access this workflow history', 403)
  }
  
  // Get workflow versions
  const { versions, total } = await WorkflowDatabase.getWorkflowVersions(id, {
    limit: pagination.limit,
    offset: (pagination.page - 1) * pagination.limit,
    includePublishedOnly: publishedOnly
  })
  
  // Transform versions to API response format
  const historyEntries = versions.map(version => ({
    id: version.id,
    workflowId: version.workflowId,
    name: version.name,
    description: version.description || '',
    version: version.version,
    isDraft: version.isDraft,
    isPublished: version.isPublished,
    nodes: version.nodes,
    connections: version.connections,
    metadata: {
      nodeCount: version.nodes.length,
      connectionCount: version.connections.length,
      ...version.metadata
    },
    createdAt: version.createdAt,
    publishedAt: version.publishedAt,
    createdBy: version.userId,
    canRollback: version.isPublished && !version.isDraft // Only published versions can be rolled back to
  }))
  
  const totalPages = Math.ceil(total / pagination.limit)
  
  return NextResponse.json(createSuccessResponse(historyEntries, {
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages
    },
    workflowInfo: {
      id: workflow.id,
      name: workflow.name,
      currentPublishedVersionId: workflow.publishedVersionId
    },
    timestamp: new Date().toISOString(),
    requestId: `req_${Date.now()}`
  }))
})