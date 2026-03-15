import { NextRequest, NextResponse } from 'next/server'
import { createSuccessResponse, withErrorHandling, extractUserId } from '@/lib/api-utils'
import { ApiError, WorkflowExecutionRequest, WorkflowExecutionResponse } from '@/types/api'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'
import { validateTenantAccess, createTenantViolationError } from '@/lib/auth/tenant-utils'
import { WorkflowDatabase } from '@/services/workflowDatabase'
import { emitZipEvent, broadcastExecutionControl } from '@/lib/zip/websocket-server'
import {
  createExecutionStartedEvent,
  createNodeExecutingEvent,
} from '@/types/zip-events'

// Execution store (in-memory for now — will be backed by DB)
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

      // Create execution record
      const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      const sessionId = `trace_${Date.now()}`

      const execution: WorkflowExecutionResponse = {
        id: executionId,
        workflowId,
        status: 'queued',
        startTime: new Date().toISOString(),
        input: body.input,
        traceSessionId: sessionId,
        metadata: {
          triggeredBy: userId,
          configuration: body.configuration,
          executionMode: 'manual',
        },
        ...((req as any).authContext?.subject?.tenantId && {
          tenantId: (req as any).authContext?.subject?.tenantId,
        }),
      }

      executionsStore.push(execution)

      // --- Emit ZIP execution.started event ---
      // This signals all connected SDK clients and browser editors
      // that an execution has begun. External runtimes listening via
      // WebSocket will receive this and can begin executing nodes.
      const startedEvent = createExecutionStartedEvent(
        workflowId,
        sessionId,
        workflow.name || `Workflow ${workflowId}`,
        {
          graphId: 'main',
          trigger: { type: 'manual', source: userId },
          metadata: {
            executionId,
            input: body.input,
            configuration: body.configuration,
          },
        }
      )

      emitZipEvent(workflowId, startedEvent)

      // Broadcast execution control event for UI state
      broadcastExecutionControl(workflowId, 'execution.start', {
        executionId,
        sessionId,
        workflowId,
        triggeredBy: userId,
      })

      // Update status to running
      const execIndex = executionsStore.findIndex(e => e.id === executionId)
      if (execIndex !== -1) {
        executionsStore[execIndex] = {
          ...executionsStore[execIndex],
          status: 'running',
        }
      }

      // Get workflow nodes to emit per-node execution events
      try {
        const { versions } = await WorkflowDatabase.getWorkflowVersions(workflowId, { limit: 1 })
        const latestVersion = versions[0]
        if (latestVersion?.graphs) {
          const graphs = latestVersion.graphs as any
          const mainGraph = graphs?.main || graphs?.[Object.keys(graphs)[0]]
          const nodes = mainGraph?.nodes
          if (nodes && typeof nodes === 'object') {
            // Emit node.executing for each node so connected runtimes
            // know which nodes need to be executed
            const nodeEntries = Array.isArray(nodes) ? nodes : Object.values(nodes)
            for (const node of nodeEntries) {
              const nodeId = (node as any)?.id || (node as any)?.metadata?.id
              if (nodeId) {
                const nodeEvent = createNodeExecutingEvent(
                  workflowId,
                  nodeId,
                  [], // input connections resolved by runtime
                  'main'
                )
                emitZipEvent(workflowId, nodeEvent)
              }
            }
          }
        }
      } catch {
        // Non-fatal — execution still proceeds, just no per-node events
      }

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

      const { searchParams } = new URL((req as any).url)
      const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
      const offset = parseInt(searchParams.get('offset') || '0')

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
