import { NextRequest, NextResponse } from 'next/server'
import { 
  createSuccessResponse, 
  withErrorHandling, 
  extractUserId
} from '@/lib/api-utils'
import { ApiError } from '@/types/api'
import { FlowTraceDatabase } from '@/services/flowTraceDatabase'

// GET /api/flow-traces/sessions/[sessionId]/replay - Get traces for replay with timing info
export const GET = withErrorHandling(async (req: NextRequest, { params }: { params: { sessionId: string } }) => {
  const userId = extractUserId(req)
  const { sessionId } = params
  const { searchParams } = new URL(req.url)
  
  // Get optional filters
  const search = searchParams.get('search') || undefined
  const status = searchParams.get('status') || undefined
  
  const session = await FlowTraceDatabase.getSession(sessionId)
  
  if (!session) {
    throw new ApiError('TRACE_SESSION_NOT_FOUND', 'Trace session not found', 404)
  }
  
  // Filter traces if needed
  let traces = session.traces
  
  if (status && status !== 'all') {
    traces = traces.filter(trace => trace.status === status)
  }
  
  if (search) {
    const query = search.toLowerCase()
    traces = traces.filter(trace => 
      trace.source.nodeName.toLowerCase().includes(query) ||
      trace.target.nodeName.toLowerCase().includes(query) ||
      trace.source.portName.toLowerCase().includes(query) ||
      trace.target.portName.toLowerCase().includes(query)
    )
  }
  
  // Calculate relative timestamps for replay
  const replayData = {
    sessionId: session.id,
    workflowName: session.workflowName,
    startTime: session.startTime,
    endTime: session.endTime,
    status: session.status,
    traces: traces.map((trace, index) => {
      const baseTime = new Date(session.startTime).getTime()
      const traceTime = new Date(trace.timestamp).getTime()
      const relativeTime = traceTime - baseTime
      
      return {
        ...trace,
        relativeTime, // milliseconds from session start
        sequenceIndex: index
      }
    }),
    summary: {
      totalTraces: traces.length,
      successCount: traces.filter(t => t.status === 'success').length,
      errorCount: traces.filter(t => t.status === 'error').length,
      warningCount: traces.filter(t => t.status === 'warning').length,
      totalDuration: session.endTime 
        ? new Date(session.endTime).getTime() - new Date(session.startTime).getTime()
        : traces.length > 0 
          ? new Date(traces[traces.length - 1].timestamp).getTime() - new Date(session.startTime).getTime()
          : 0
    }
  }
  
  return NextResponse.json(createSuccessResponse(replayData))
})