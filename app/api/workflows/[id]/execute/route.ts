import { NextRequest, NextResponse } from 'next/server'
import { createSuccessResponse, withErrorHandling, extractUserId } from '@/lib/api-utils'
import { ApiError, WorkflowExecutionRequest, WorkflowExecutionResponse } from '@/types/api'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'
import { validateTenantAccess, createTenantViolationError } from '@/lib/auth/tenant-utils'
import { WorkflowDatabase } from '@/services/workflowDatabase'

// Mock execution store
let executionsStore: WorkflowExecutionResponse[] = []

// POST /api/workflows/[id]/execute - Execute workflow
export const POST = withAuth(
  withErrorHandling(
    async (req: AuthenticatedRequest, context?: { params: { id: string } }) => {

      if (!context?.params) {
        return NextResponse.json(createSuccessResponse({}), { status: 400 })
      }

      const userId = req.auth?.subject?.id || extractUserId(req)
      const { id: workflowId } = context.params
      const body: WorkflowExecutionRequest = await req.json()

      // Validate workflow exists and check tenant access
      const workflow = await WorkflowDatabase.getWorkflow(workflowId)
      if (!workflow) {
        throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow not found', 404)
      }
      
      // Check tenant access
      if (!validateTenantAccess(workflow, req as NextRequest)) {
        return createTenantViolationError()
      }
      
      // Check ownership for legacy workflows without tenantId
      if (!workflow.tenantId && workflow.userId !== userId) {
        throw new ApiError('FORBIDDEN', 'Not authorized to execute this workflow', 403)
      }

      // Create execution record with tenant context
      const execution: WorkflowExecutionResponse = {
        id: `exec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        workflowId: body.workflowId,
        status: 'queued',
        startTime: new Date().toISOString(),
        input: body.input,
        metadata: {
          triggeredBy: userId,
          configuration: body.configuration,
          executionMode: 'manual',
        },
        ...(req as any).authContext?.subject?.tenantId && { 
          tenantId: (req as any).authContext?.subject?.tenantId 
        }
      }

    executionsStore.push(execution)

    // In real implementation, this would:
    // 1. Validate workflow is published
    // 2. Check environment variables are configured
    // 3. Queue execution in execution engine
    // 4. Return execution ID for status tracking

    // Simulate async execution
    setTimeout(() => {
      const execIndex = executionsStore.findIndex(e => e.id === execution.id)
      if (execIndex !== -1) {
        executionsStore[execIndex] = {
          ...executionsStore[execIndex],
          status: 'running',
          traceSessionId: `trace_${Date.now()}`,
        }

        // Simulate completion after 5 seconds
        setTimeout(() => {
          const finalExecIndex = executionsStore.findIndex(e => e.id === execution.id)
          if (finalExecIndex !== -1) {
            executionsStore[finalExecIndex] = {
              ...executionsStore[finalExecIndex],
              status: 'completed',
              endTime: new Date().toISOString(),
              output: {
                result: 'success',
                processedRecords: 42,
                executionTime: '5.2s',
              },
            }
          }
        }, 5000)
      }
    }, 1000)

    return NextResponse.json(createSuccessResponse(execution), { status: 202 })
    }
  ),
  {
    resource: 'workflow',
    action: 'execute'
  }
)

// GET /api/workflows/[id]/execute - Get execution history
export const GET = withAuth(
  withErrorHandling(
    async (req: AuthenticatedRequest, context?: { params: { id: string } }) => {

      if (!context?.params) {
        return NextResponse.json(createSuccessResponse([]), { status: 400 })
      }

      const userId = req.auth?.subject?.id || extractUserId(req)
      const { id: workflowId } = context.params
      
      // Validate workflow exists and check tenant access
      const workflow = await WorkflowDatabase.getWorkflow(workflowId)
      if (!workflow) {
        throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow not found', 404)
      }
      
      // Check tenant access
      if (!validateTenantAccess(workflow, req as NextRequest)) {
        return createTenantViolationError()
      }
    const { searchParams } = new URL(req.url)

    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    // Filter executions for this workflow
    const workflowExecutions = executionsStore
      .filter(exec => exec.workflowId === workflowId)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(offset, offset + limit)

    return NextResponse.json(createSuccessResponse(workflowExecutions))
    }
  ),
  {
    resource: 'workflow',
    action: 'read'
  }
)
