import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ServerCRDTOperations } from '../../../../lib/crdt/server-operations'
import { getDatabaseOperations } from '../../../../lib/database'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'

const AddNodeSchema = z.object({
  workflowId: z.string().min(1, 'Workflow ID is required'),
  graphId: z.string().default('main'),
  nodeData: z.object({
    metadata: z.object({
      id: z.string().optional(), // ID is auto-generated
      templateId: z.string().optional(),
      type: z.string(),
      title: z.string(),
      subtitle: z.string().optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
      variant: z.string().optional(),
      shape: z.string().optional(),
      size: z.enum(['small', 'medium', 'large']).optional(),
      category: z.string().optional(),
      subcategory: z.string().optional(),
      inputs: z.array(z.any()).optional(),
      outputs: z.array(z.any()).optional(),
      properties: z.record(z.any()).optional(),
      requiredEnvVars: z.array(z.string()).optional(),
      propertyRules: z
        .object({
          triggers: z.array(z.string()),
          rules: z.array(
            z.object({
              when: z.string(),
              updates: z.record(z.any()),
            })
          ),
        })
        .optional(),
      propertyValues: z.record(z.any()).optional(),
      tags: z.array(z.string()).optional(),
      version: z.string().optional(),
    }),
    position: z.object({
      x: z.number(),
      y: z.number(),
    }),
  }),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workflowId = searchParams.get('workflowId')
    const graphId = searchParams.get('graphId') || 'main'
    
    if (!workflowId) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      )
    }

    console.log(`[API] Listing nodes for workflow ${workflowId}, graph ${graphId}`)

    // Get nodes from database
    const db = await getDatabaseOperations()
    const { versions } = await db.listWorkflowVersions(workflowId, { limit: 1 })
    const latestVersion = versions[0]
    
    if (!latestVersion) {
      return NextResponse.json({
        success: true,
        nodes: []
      })
    }

    // Parse graphs if stored as JSON string
    const graphs = typeof latestVersion.graphs === 'string'
      ? JSON.parse(latestVersion.graphs)
      : latestVersion.graphs || []
    
    // Find the target graph
    const graph = graphs.find((g: any) => g.id === graphId)
    
    if (!graph) {
      return NextResponse.json({
        success: true,
        nodes: []
      })
    }

    return NextResponse.json({
      success: true,
      nodes: graph.nodes || []
    })
  } catch (error) {
    console.error('Error listing nodes:', error)
    return NextResponse.json(
      { 
        error: 'Failed to list nodes',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json()
    
    console.log('[API] Raw request body received:', JSON.stringify(body, null, 2))
    
    // Validate input with Zod
    const validationResult = AddNodeSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      )
    }
    
    const params = validationResult.data

    console.log(`[API] Adding node directly: ${params.nodeData.metadata.title}`)
    console.log(`[API] Node position:`, params.nodeData.position)
    console.log(`[API] Complete nodeData being passed to ServerCRDTOperations:`, JSON.stringify(params.nodeData, null, 2))

    // Always use ServerCRDTOperations for embed mode
    const node = await ServerCRDTOperations.addNode(
      params.workflowId,
      params.graphId,
      params.nodeData
    )

    return NextResponse.json({
      success: true,
      data: {
        node,
        message: 'Node added successfully',
      }
    })
  } catch (error) {
    console.error('Error adding node:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add node',
      },
      { status: 500 }
    )
  }
}, {
  resource: 'orchestrator',
  action: 'create'
})
