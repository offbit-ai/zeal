import { NextRequest, NextResponse } from 'next/server'
import { ServerCRDTOperations } from '@/lib/crdt/server-operations'
import { WorkflowDatabase } from '@/services/workflowDatabase'
import { withZIPAuthorization } from '@/lib/auth/zip-middleware'

// GET /api/zip/orchestrator/workflows/[workflowId]/state - Get workflow state
export const GET = withZIPAuthorization(async (request: NextRequest, context?: { params: any }) => {
  try {
    const { workflowId } = context?.params || {}
    if (!workflowId) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing workflowId parameter',
        }
      }, { status: 400 })
    }
    const { searchParams } = new URL(request.url)
    const graphId = searchParams.get('graphId') || 'main'
    
    // Get workflow details
    const workflow = await WorkflowDatabase.getWorkflow(workflowId)
    if (!workflow) {
      return NextResponse.json({
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: `Workflow ${workflowId} not found`,
        }
      }, { status: 404 })
    }
    
    // Get latest version
    const { versions } = await WorkflowDatabase.getWorkflowVersions(workflowId, { limit: 1 })
    const latestVersion = versions[0]
    
    if (!latestVersion) {
      return NextResponse.json({
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'No workflow version found',
        }
      }, { status: 404 })
    }
    
    // Find the specific graph
    const graph = latestVersion.graphs.find((g: any) => g.id === graphId)
    if (!graph) {
      return NextResponse.json({
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: `Graph ${graphId} not found in workflow`,
        }
      }, { status: 404 })
    }
    
    // Return workflow state
    return NextResponse.json({
      workflowId,
      graphId,
      name: workflow.name,
      description: workflow.description,
      version: latestVersion.version,
      state: {
        nodes: graph.nodes || [],
        connections: graph.connections || [],
        groups: graph.groups || [],
      },
      metadata: {
        ...latestVersion.metadata,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
        versionCreatedAt: latestVersion.createdAt,
      },
    })
  } catch (error) {
    console.error('Error getting workflow state:', error)
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get workflow state',
        traceId: `trace_${Date.now()}`,
      }
    }, { status: 500 })
  }
}, {
  resourceType: 'workflow',
  action: 'read'
})