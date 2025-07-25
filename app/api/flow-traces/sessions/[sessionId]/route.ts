import { NextRequest, NextResponse } from 'next/server'
import { 
  createSuccessResponse, 
  withErrorHandling, 
  extractUserId,
  mockDelay
} from '@/lib/api-utils'
import { ApiError } from '@/types/api'

interface TraceSessionResponse {
  sessionId: string
  workflowId: string
  workflowName: string
  executionId: string
  startTime: string
  endTime?: string
  duration: number
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  totalTraces: number
  successfulTraces: number
  failedTraces: number
  traces: any[]
  metadata: {
    triggerType: 'manual' | 'scheduled' | 'webhook'
    triggeredBy: string
    environment: string
    version: string
  }
}

// Import mock stores
let flowTracesStore: any[] = []

// GET /api/flow-traces/sessions/[sessionId] - Get trace session with all traces
export const GET = withErrorHandling(async (req: NextRequest, { params }: { params: { sessionId: string } }) => {
  await mockDelay(125)
  
  const userId = extractUserId(req)
  const { sessionId } = params
  const { searchParams } = new URL(req.url)
  
  const includeTraceDetails = searchParams.get('include_details') === 'true'
  
  // Find all traces for this session
  const sessionTraces = flowTracesStore.filter(trace => 
    trace.traceSessionId === sessionId
  ).sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
  
  if (sessionTraces.length === 0) {
    throw new ApiError('TRACE_SESSION_NOT_FOUND', 'Trace session not found', 404)
  }
  
  // Build session summary
  const firstTrace = sessionTraces[0]
  const lastTrace = sessionTraces[sessionTraces.length - 1]
  
  const sessionData: TraceSessionResponse = {
    sessionId,
    workflowId: firstTrace.workflowId,
    workflowName: firstTrace.workflowName,
    executionId: firstTrace.executionId,
    startTime: firstTrace.timestamp,
    endTime: lastTrace.status !== 'pending' ? lastTrace.timestamp : undefined,
    duration: new Date(lastTrace.timestamp).getTime() - new Date(firstTrace.timestamp).getTime(),
    status: sessionTraces.some(t => t.status === 'error') ? 'failed' :
            sessionTraces.every(t => t.status === 'success') ? 'completed' :
            sessionTraces.some(t => t.status === 'pending') ? 'running' : 'completed',
    totalTraces: sessionTraces.length,
    successfulTraces: sessionTraces.filter(t => t.status === 'success').length,
    failedTraces: sessionTraces.filter(t => t.status === 'error').length,
    traces: includeTraceDetails ? sessionTraces : sessionTraces.map(trace => ({
      id: trace.id,
      sourceNodeId: trace.sourceNodeId,
      targetNodeId: trace.targetNodeId,
      status: trace.status,
      timestamp: trace.timestamp,
      duration: trace.duration
    })),
    metadata: {
      triggerType: 'manual',
      triggeredBy: userId,
      environment: 'production',
      version: '1.0.0'
    }
  }
  
  return NextResponse.json(createSuccessResponse(sessionData))
})

// POST /api/flow-traces/sessions/[sessionId]/replay - Replay trace session
export const POST = withErrorHandling(async (req: NextRequest, { params }: { params: { sessionId: string } }) => {
  await mockDelay(200)
  
  const userId = extractUserId(req)
  const { sessionId } = params
  const body = await req.json()
  
  // Find traces for this session
  const sessionTraces = flowTracesStore.filter(trace => 
    trace.traceSessionId === sessionId
  )
  
  if (sessionTraces.length === 0) {
    throw new ApiError('TRACE_SESSION_NOT_FOUND', 'Trace session not found', 404)
  }
  
  // Create new replay session
  const replaySessionId = `replay_${sessionId}_${Date.now()}`
  const replayExecutionId = `exec_replay_${Date.now()}`
  
  // In real implementation, this would:
  // 1. Validate that the workflow still exists and is executable
  // 2. Check that required environment variables are still configured
  // 3. Queue the workflow for re-execution with the same input data
  // 4. Return the new execution/session ID for tracking
  
  const replayConfig = {
    originalSessionId: sessionId,
    replaySessionId,
    replayExecutionId,
    replayOptions: {
      preserveTimestamps: body.preserveTimestamps || false,
      replaySpeed: body.replaySpeed || 1.0, // 1.0 = real-time, 2.0 = 2x speed
      skipFailedNodes: body.skipFailedNodes || false,
      stopOnError: body.stopOnError || true,
      replayFrom: body.replayFrom, // Optional: replay from specific trace ID
      replayTo: body.replayTo // Optional: replay until specific trace ID
    },
    status: 'queued',
    queuedAt: new Date().toISOString(),
    estimatedDuration: sessionTraces.reduce((sum, t) => sum + t.duration, 0)
  }
  
  // Simulate queuing the replay
  console.log(`Queuing replay for session ${sessionId} with config:`, replayConfig)
  
  return NextResponse.json(createSuccessResponse(replayConfig), { status: 202 })
})