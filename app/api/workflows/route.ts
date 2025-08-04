import { NextRequest, NextResponse } from 'next/server'
import {
  createSuccessResponse,
  withErrorHandling,
  validateRequired,
  parsePaginationParams,
  parseFilterParams,
  extractUserId,
  validateWorkflowNodes,
  validateWorkflowConnections,
  mockDelay,
} from '@/lib/api-utils'
import { ApiError, WorkflowCreateRequest } from '@/types/api'
import { WorkflowDatabase } from '@/services/workflowDatabase'

// GET /api/workflows - List workflows
export const GET = withErrorHandling(async (req: NextRequest) => {
  await mockDelay(150)

  const { searchParams } = new URL(req.url)
  const userId = extractUserId(req)
  const pagination = parsePaginationParams(searchParams)
  const filters = parseFilterParams(searchParams)

  // Get workflows from database
  const { workflows, total } = await WorkflowDatabase.listWorkflows({
    userId: userId,
    limit: pagination.limit,
    offset: (pagination.page - 1) * pagination.limit,
    searchTerm: filters.search,
  })

  // Transform to API response format
  const workflowResponses = await Promise.all(
    workflows.map(async (workflow: any) => {
      // Get latest version for each workflow
      const { versions } = await WorkflowDatabase.getWorkflowVersions(workflow.id, { limit: 1 })
      const latestVersion = versions[0]

      // Get published version if it exists
      let publishedVersion = null
      if (workflow.publishedVersionId) {
        publishedVersion = await WorkflowDatabase.getWorkflowVersion(workflow.publishedVersionId)
      }

      return {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description || '',
        graphs: latestVersion?.graphs || [],
        activeGraphId: latestVersion?.metadata?.activeGraphId || 'main',
        triggerConfig: latestVersion?.triggerConfig,
        metadata: {
          ...latestVersion?.metadata,
        },
        status: publishedVersion ? 'published' : 'draft',
        version: latestVersion?.version || 1,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
        publishedAt: publishedVersion?.publishedAt,
        createdBy: workflow.userId,
        lastModifiedBy: latestVersion?.userId || workflow.userId,
      }
    })
  )

  // Apply status filter if specified
  let filteredWorkflows = workflowResponses
  if (filters.status) {
    filteredWorkflows = filteredWorkflows.filter(
      (workflow: any) => workflow.status === filters.status
    )
  }

  // Apply date filters
  if (filters.dateFrom) {
    const fromDate = new Date(filters.dateFrom)
    filteredWorkflows = filteredWorkflows.filter(
      (workflow: any) => new Date(workflow.createdAt) >= fromDate
    )
  }

  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo)
    filteredWorkflows = filteredWorkflows.filter(
      (workflow: any) => new Date(workflow.createdAt) <= toDate
    )
  }

  // Sort workflows
  filteredWorkflows.sort((a: any, b: any) => {
    let aValue: any = a[pagination.sortBy as keyof typeof a]
    let bValue: any = b[pagination.sortBy as keyof typeof b]

    // Handle date sorting
    if (pagination.sortBy === 'createdAt' || pagination.sortBy === 'updatedAt') {
      aValue = new Date(aValue).getTime()
      bValue = new Date(bValue).getTime()
    }

    if (pagination.sortOrder === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
    }
    return bValue < aValue ? -1 : bValue > aValue ? 1 : 0
  })

  const totalPages = Math.ceil(filteredWorkflows.length / pagination.limit)

  return NextResponse.json(
    createSuccessResponse(filteredWorkflows, {
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: filteredWorkflows.length,
        totalPages,
      },
      timestamp: new Date().toISOString(),
      requestId: `req_${Date.now()}`,
    })
  )
})

// POST /api/workflows - Create workflow
export const POST = withErrorHandling(async (req: NextRequest) => {
  await mockDelay(200)

  const userId = extractUserId(req)
  const body: WorkflowCreateRequest = await req.json()

  // Validate required fields
  validateRequired(body, ['name', 'graphs'])

  // Validate graphs structure
  if (!Array.isArray(body.graphs) || body.graphs.length === 0) {
    throw new ApiError('INVALID_GRAPHS', 'At least one graph is required', 400)
  }

  // Validate each graph
  body.graphs.forEach((graph, index) => {
    if (!graph.nodes || !Array.isArray(graph.nodes)) {
      throw new ApiError('INVALID_GRAPH_NODES', `Graph ${index} must have nodes array`, 400)
    }
    if (!graph.connections || !Array.isArray(graph.connections)) {
      throw new ApiError(
        'INVALID_GRAPH_CONNECTIONS',
        `Graph ${index} must have connections array`,
        400
      )
    }

    validateWorkflowNodes(graph.nodes)
    const nodeIds = new Set(graph.nodes.map(node => node.id))
    validateWorkflowConnections(graph.connections, nodeIds)
  })

  // Create new workflow with initial version
  const { workflow, version } = await WorkflowDatabase.createWorkflow({
    name: body.name,
    description: body.description,
    userId,
    graphs: body.graphs as any,
    triggerConfig: body.triggerConfig,
    metadata: {
      ...body.metadata,
      activeGraphId: body.activeGraphId || 'main',
    },
  })

  // Transform to API response format
  const response = {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description || '',
    graphs: version.graphs || [],
    activeGraphId: version.metadata?.activeGraphId || 'main',
    triggerConfig: version.triggerConfig,
    metadata: {
      ...version.metadata,
    },
    status: 'draft',
    version: version.version,
    createdAt: workflow.createdAt,
    updatedAt: workflow.updatedAt,
    createdBy: workflow.userId,
    lastModifiedBy: version.userId,
  }

  return NextResponse.json(createSuccessResponse(response), { status: 201 })
})
