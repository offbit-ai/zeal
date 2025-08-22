import { NextRequest, NextResponse } from 'next/server'
import {
  createSuccessResponse,
  withErrorHandling,
  extractUserId,
  validateRequired,
  validateWorkflowNodes,
  validateWorkflowConnections,
  mockDelay,
} from '@/lib/api-utils'
import { ApiError, WorkflowUpdateRequest } from '@/types/api'
import { WorkflowDatabase } from '@/services/workflowDatabase'

// GET /api/workflows/[id] - Get specific workflow
export const GET = withErrorHandling(
  async (req: NextRequest, context?: { params: { id: string } }) => {
    await mockDelay(100)

    if (!context || !context.params || !context.params.id) {
      throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow ID is required', 400)
    }

    const { id } = context.params
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
      graphs: latestVersion.graphs || [],
      activeGraphId: latestVersion.metadata?.activeGraphId || 'main',
      triggerConfig: latestVersion.triggerConfig,
      metadata: {
        ...latestVersion.metadata,
      },
      status: publishedVersion ? 'published' : 'draft',
      version: latestVersion.version,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      publishedAt: publishedVersion?.publishedAt,
      createdBy: workflow.userId,
      lastModifiedBy: latestVersion.userId,
    }

    console.log(
      '[WorkflowRoute] Returning workflow with graphs:',
      JSON.stringify(response.graphs, null, 2)
    )

    return NextResponse.json(createSuccessResponse(response))
  }
)

// PUT /api/workflows/[id] - Update workflow (creates new version)
export const PUT = withErrorHandling(
  async (req: NextRequest, context?: { params: { id: string } }) => {
    await mockDelay(200)

    if (!context || !context.params || !context.params.id) {
      throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow ID is required', 400)
    }

    const { id } = context.params
    const userId = extractUserId(req)

    // Handle empty request body
    let body: WorkflowUpdateRequest
    try {
      const text = await req.text()
      if (!text || text.trim() === '') {
        throw new ApiError('EMPTY_REQUEST', 'Request body is empty', 400)
      }
      body = JSON.parse(text)
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError('INVALID_JSON', 'Invalid JSON in request body', 400)
    }

    // Get workflow to verify ownership
    let workflow = await WorkflowDatabase.getWorkflow(id)

    if (!workflow) {
      // Create the workflow if it doesn't exist (upsert behavior)
      // Workflow not found, creating new workflow

      // Extract name from body or use a default
      const workflowName = body.name || 'Untitled Workflow'

      // Create the workflow with the specific ID
      await WorkflowDatabase.createWorkflowWithId(id, {
        name: workflowName,
        description: body.description || '',
        userId,
      })

      // Fetch the newly created workflow
      workflow = await WorkflowDatabase.getWorkflow(id)

      if (!workflow) {
        throw new ApiError('CREATE_FAILED', 'Failed to create workflow', 500)
      }
    } else if (workflow.userId !== userId) {
      throw new ApiError('FORBIDDEN', 'Not authorized to update this workflow', 403)
    }

    // Validate required fields
    validateRequired(body, ['graphs'])

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

    // Create new version
    const newVersion = await WorkflowDatabase.updateWorkflowDraft(id, {
      name: body.name,
      description: body.description,
      graphs: body.graphs as any,
      triggerConfig: body.triggerConfig,
      metadata: {
        ...body.metadata,
        activeGraphId: body.activeGraphId || 'main',
      },
      userId,
    })

    // Get updated workflow
    const updatedWorkflow = await WorkflowDatabase.getWorkflow(id)

    if (!updatedWorkflow) {
      throw new ApiError('UPDATE_FAILED', 'Failed to retrieve updated workflow')
    }

    // Get published version if it exists
    let publishedVersion = null
    if (updatedWorkflow.publishedVersionId) {
      publishedVersion = await WorkflowDatabase.getWorkflowVersion(
        updatedWorkflow.publishedVersionId
      )
    }

    // Transform to API response format
    const response = {
      id: updatedWorkflow.id,
      name: updatedWorkflow.name,
      description: updatedWorkflow.description || '',
      graphs: newVersion.graphs || [],
      activeGraphId: newVersion.metadata?.activeGraphId || 'main',
      triggerConfig: newVersion.triggerConfig,
      metadata: {
        ...newVersion.metadata,
      },
      status: publishedVersion ? 'published' : 'draft',
      version: newVersion.version,
      createdAt: updatedWorkflow.createdAt,
      updatedAt: updatedWorkflow.updatedAt,
      publishedAt: publishedVersion?.publishedAt,
      createdBy: updatedWorkflow.userId,
      lastModifiedBy: newVersion.userId,
    }

    return NextResponse.json(createSuccessResponse(response))
  }
)

// DELETE /api/workflows/[id] - Delete workflow
export const DELETE = withErrorHandling(
  async (req: NextRequest, context?: { params: { id: string } }) => {
    await mockDelay(150)

    if (!context || !context.params || !context.params.id) {
      throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow ID is required', 400)
    }

    const { id } = context.params
    const userId = extractUserId(req)

    // Delete workflow (includes authorization check)
    // Delete workflow (cascades to versions and executions)
    await WorkflowDatabase.deleteWorkflow(id, userId)

    return NextResponse.json(
      createSuccessResponse({
        message: `Workflow '${id}' has been deleted`,
      })
    )
  }
)
