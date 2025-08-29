import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { WorkflowDatabase } from '@/services/workflowDatabase'
import { CreateWorkflowRequest, CreateWorkflowResponse } from '@/types/zip'
import { v4 as uuidv4 } from 'uuid'
import { withZIPAuthorization, getAuthenticatedUserId, getOrganizationId } from '@/lib/auth/zip-middleware'
import { getTenantId, addTenantContext, buildTenantQuery } from '@/lib/auth/tenant-utils'

const createWorkflowSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
})

// POST /api/zip/orchestrator/workflows - Create workflow
export const POST = withZIPAuthorization(
  async (request: NextRequest) => {
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
      
      // Add tenant context to workflow data
      const workflowData = addTenantContext({
        name,
        description: description || '',
        userId: getAuthenticatedUserId(request), // Use authenticated user ID
        graphs:  [{
          id: 'main',
          name: 'Main Graph',
          isMain: true,
          namespace: '',
          nodes: [],
          connections: [],
          groups: []
        }]
      }, request)
      
      // Create workflow using existing service with tenant context
      const {workflow, version} = await WorkflowDatabase.createWorkflow(workflowData)
      
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
  },
  {
    resourceType: 'workflow',
    action: 'create'
  }
);

// GET /api/zip/orchestrator/workflows - List workflows
export const GET = withZIPAuthorization(
  async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url)
      const limit = parseInt(searchParams.get('limit') || '20')
      const offset = parseInt(searchParams.get('offset') || '0')
      
      // Build query with tenant context
      const tenantQuery = buildTenantQuery(request)
      
      const { workflows, total } = await WorkflowDatabase.listWorkflows({
        ...tenantQuery,
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
  },
  {
    resourceType: 'workflow', 
    action: 'read'
  }
);