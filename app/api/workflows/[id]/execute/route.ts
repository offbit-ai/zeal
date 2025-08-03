import { NextRequest, NextResponse } from 'next/server'
import { 
  createSuccessResponse, 
  withErrorHandling, 
  extractUserId,
  mockDelay
} from '@/lib/api-utils'
import { ApiError, WorkflowExecutionRequest, WorkflowExecutionResponse } from '@/types/api'

// Mock execution store
let executionsStore: WorkflowExecutionResponse[] = []

// POST /api/workflows/[id]/execute - Execute workflow
export const POST = withErrorHandling(async (req: NextRequest, context?: { params: { id: string } }) => {
  await mockDelay(100)

  if (!context?.params) {
    return NextResponse.json(createSuccessResponse({}), { status: 400 })
  }
  
  const userId = extractUserId(req)
  const { id: workflowId } = context.params
  const body: WorkflowExecutionRequest = await req.json()
  
  // Validate workflow exists and is published
  // In real implementation, this would query the database
  // console.log removed
  
  // Create execution record
  const execution: WorkflowExecutionResponse = {
    id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    workflowId: body.workflowId,
    status: 'queued',
    startTime: new Date().toISOString(),
    input: body.input,
    metadata: {
      triggeredBy: userId,
      configuration: body.configuration,
      executionMode: 'manual'
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
        traceSessionId: `trace_${Date.now()}`
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
              executionTime: '5.2s'
            }
          }
        }
      }, 5000)
    }
  }, 1000)
  
  return NextResponse.json(createSuccessResponse(execution), { status: 202 })
})

// GET /api/workflows/[id]/execute - Get execution history
export const GET = withErrorHandling(async (req: NextRequest, context?: { params: { id: string } }) => {
  await mockDelay(75)
  
  if (!context?.params) {
    return NextResponse.json(createSuccessResponse([]), { status: 400 })
  }
  

  const userId = extractUserId(req)
  const { id: workflowId } = context.params
  const { searchParams } = new URL(req.url)
  
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
  const offset = parseInt(searchParams.get('offset') || '0')
  
  // Filter executions for this workflow
  const workflowExecutions = executionsStore
    .filter(exec => exec.workflowId === workflowId)
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .slice(offset, offset + limit)
  
  return NextResponse.json(createSuccessResponse(workflowExecutions))
})