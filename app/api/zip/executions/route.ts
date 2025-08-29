import { NextRequest, NextResponse } from 'next/server'
import { FlowTraceDatabase } from '@/services/flowTraceDatabase'
import { ListExecutionsRequest, ExecutionSummary } from '@/types/zip'
import { withZIPAuthorization } from '@/lib/auth/zip-middleware'

// GET /api/zip/executions - List execution sessions
export const GET = withZIPAuthorization(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const workflowId = searchParams.get('workflowId')
    const status = searchParams.get('status') as 'running' | 'completed' | 'failed' | undefined
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    // Get sessions from flow trace database
    // Filter by workflowId in application logic since it's not supported by getSessions
    const { sessions: allSessions, total } = await FlowTraceDatabase.getSessions('zip-integration', {
      limit: workflowId ? 1000 : limit, // Get more if we need to filter
      offset,
      status,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    })
    
    // Filter by workflowId if provided
    const sessions = workflowId 
      ? allSessions.filter((s: any) => s.workflowId === workflowId).slice(0, limit)
      : allSessions
    
    // Transform to ZIP format
    const executions: ExecutionSummary[] = sessions.map((session: any) => ({
      sessionId: session.id,
      workflowId: session.workflowId,
      workflowName: session.workflowName,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      summary: session.summary || {
        totalNodes: 0,
        successfulNodes: 0,
        failedNodes: 0,
        totalDuration: 0,
      },
    }))
    
    return NextResponse.json({
      executions,
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Error listing executions:', error)
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list executions',
        traceId: `trace_${Date.now()}`,
      }
    }, { status: 500 })
  }
}, {
  resourceType: 'executions',
  action: 'read'
})