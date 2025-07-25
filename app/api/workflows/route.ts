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
  mockDelay
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
  const { workflows, total } = await WorkflowDatabase.getWorkflows(userId, {
    limit: pagination.limit,
    offset: (pagination.page - 1) * pagination.limit,
    search: filters.search
  })
  
  // Transform to API response format
  const workflowResponses = await Promise.all(workflows.map(async (workflow) => {
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
      nodes: latestVersion?.nodes || [],
      connections: latestVersion?.connections || [],
      metadata: {
        nodeCount: latestVersion?.nodes?.length || 0,
        connectionCount: latestVersion?.connections?.length || 0,
        ...latestVersion?.metadata
      },
      status: publishedVersion ? 'published' : 'draft',
      version: latestVersion?.version || 1,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      publishedAt: publishedVersion?.publishedAt,
      createdBy: workflow.userId,
      lastModifiedBy: latestVersion?.userId || workflow.userId
    }
  }))
  
  // Apply status filter if specified
  let filteredWorkflows = workflowResponses
  if (filters.status) {
    filteredWorkflows = filteredWorkflows.filter(workflow => 
      workflow.status === filters.status
    )
  }
  
  // Apply date filters
  if (filters.dateFrom) {
    const fromDate = new Date(filters.dateFrom)
    filteredWorkflows = filteredWorkflows.filter(workflow => 
      new Date(workflow.createdAt) >= fromDate
    )
  }
  
  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo)
    filteredWorkflows = filteredWorkflows.filter(workflow => 
      new Date(workflow.createdAt) <= toDate
    )
  }
  
  // Sort workflows
  filteredWorkflows.sort((a, b) => {
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
  
  return NextResponse.json(createSuccessResponse(filteredWorkflows, {
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: filteredWorkflows.length,
      totalPages
    },
    timestamp: new Date().toISOString(),
    requestId: `req_${Date.now()}`
  }))
})

// POST /api/workflows - Create workflow
export const POST = withErrorHandling(async (req: NextRequest) => {
  await mockDelay(200)
  
  const userId = extractUserId(req)
  const body: WorkflowCreateRequest = await req.json()
  
  // Validate required fields
  validateRequired(body, ['name', 'nodes', 'connections'])
  
  // Validate nodes
  validateWorkflowNodes(body.nodes)
  
  // Validate connections
  const nodeIds = new Set(body.nodes.map(node => node.id))
  validateWorkflowConnections(body.connections, nodeIds)
  
  // Check for duplicate workflow name for this user
  const { workflows } = await WorkflowDatabase.getWorkflows(userId, { search: body.name })
  const existingWorkflow = workflows.find(workflow => 
    workflow.name.toLowerCase() === body.name.toLowerCase()
  )
  
  if (existingWorkflow) {
    throw new ApiError(
      'DUPLICATE_WORKFLOW_NAME',
      `Workflow with name '${body.name}' already exists`,
      409
    )
  }
  
  // Create new workflow with initial version
  const { workflow, version } = await WorkflowDatabase.createWorkflow({
    name: body.name,
    description: body.description,
    userId,
    nodes: body.nodes,
    connections: body.connections,
    metadata: body.metadata
  })
  
  // Transform to API response format
  const response = {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description || '',
    nodes: version.nodes,
    connections: version.connections,
    metadata: {
      nodeCount: version.nodes.length,
      connectionCount: version.connections.length,
      ...version.metadata
    },
    status: 'draft',
    version: version.version,
    createdAt: workflow.createdAt,
    updatedAt: workflow.updatedAt,
    createdBy: workflow.userId,
    lastModifiedBy: version.userId
  }
  
  return NextResponse.json(createSuccessResponse(response), { status: 201 })
})