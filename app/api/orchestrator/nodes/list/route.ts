import { NextRequest, NextResponse } from 'next/server'
import { getDatabaseOperations } from '../../../../../lib/database'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'

export const POST = withAuth(async (request: AuthenticatedRequest, context?: { params: any }) => {
  try {
    const body = await request.json()
    const { workflowId, graphId = 'main' } = body

    if (!workflowId) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      )
    }

    console.log(`[API] Listing nodes for workflow ${workflowId}, graph ${graphId}`)

    const dbOps = await getDatabaseOperations()
    
    // Get the latest version which contains the graphs
    const { versions } = await dbOps.listWorkflowVersions(workflowId, { limit: 1 })
    const latestVersion = versions[0]
    
    if (!latestVersion || !latestVersion.graphs) {
      console.log('[API] No workflow version found or no graphs')
      return NextResponse.json({
        success: true,
        nodes: []
      })
    }
    
    // Parse graphs if it's a string
    const graphs = typeof latestVersion.graphs === 'string'
      ? JSON.parse(latestVersion.graphs)
      : latestVersion.graphs
    
    const graph = graphs.find((g: any) => g.id === graphId)
    
    if (!graph) {
      console.log(`[API] Graph ${graphId} not found`)
      return NextResponse.json({
        success: true,
        nodes: []
      })
    }
    
    console.log(`[API] Found ${graph.nodes?.length || 0} nodes in graph`)
    
    return NextResponse.json({
      success: true,
      nodes: graph.nodes || []
    })
  } catch (error) {
    console.error('Error listing workflow nodes:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list nodes',
      },
      { status: 500 }
    )
  }
}, {
  resource: 'node',
  action: 'read'
})