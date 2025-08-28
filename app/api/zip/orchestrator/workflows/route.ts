import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { WorkflowDatabase } from '@/services/workflowDatabase'
import { CreateWorkflowRequest, CreateWorkflowResponse } from '@/types/zip'
import { v4 as uuidv4 } from 'uuid'

const createWorkflowSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
})

// POST /api/zip/orchestrator/workflows - Create workflow
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request
    const validation = createWorkflowSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request format',
          details: validation.error.errors,
        }
      }, { status: 400 })
    }
    
    const { name, description, metadata } = validation.data
    
    // Create workflow using existing service

    const {workflow, version} = await WorkflowDatabase.createWorkflow({
      name,
      description: description || '',
      userId: 'zip-integration', // ZIP integrations use special user
      graphs:  [{
        id: 'main',
        name: 'Main Graph',
        isMain: true,
        namespace: '',
        nodes: [],
        connections: [],
        groups: []
      }]
    })
    
    const workflowId = workflow.id;
    // Create initial version with main graph
    const mainGraphId = 'main'
   
    
    const response: CreateWorkflowResponse = {
      workflowId,
      graphId: mainGraphId,
      version: version.version,
      embedUrl: `${process.env.NEXT_PUBLIC_APP_URL}/embed/${workflowId}`,
      // Note: We're not using API keys since it's self-hosted
    }
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error creating workflow:', error)
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create workflow',
        traceId: `trace_${Date.now()}`,
      }
    }, { status: 500 })
  }
}

// GET /api/zip/orchestrator/workflows - List workflows
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    const { workflows, total } = await WorkflowDatabase.listWorkflows({
      userId: 'zip-integration',
      limit,
      offset,
    })
    
    const zipWorkflows = await Promise.all(
      workflows.map(async (workflow: any) => {
        const { versions } = await WorkflowDatabase.getWorkflowVersions(workflow.id, { limit: 1 })
        const latestVersion = versions[0]
        
        return {
          workflowId: workflow.id,
          name: workflow.name,
          description: workflow.description,
          graphId: latestVersion?.metadata?.activeGraphId || 'main',
          metadata: latestVersion?.metadata,
          createdAt: workflow.createdAt,
          updatedAt: workflow.updatedAt,
        }
      })
    )
    
    return NextResponse.json({
      workflows: zipWorkflows,
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Error listing workflows:', error)
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list workflows',
        traceId: `trace_${Date.now()}`,
      }
    }, { status: 500 })
  }
}