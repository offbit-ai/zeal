import { NextRequest, NextResponse } from 'next/server'
import { FlowTraceDatabase } from '@/services/flowTraceDatabase'

// GET /api/zip/executions/[sessionId] - Get execution details
export async function GET(
  _request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params
    
    // Get session details
    const sessions = await FlowTraceDatabase.getSessions('zip-integration', {
      limit: 1,
      offset: 0,
    })
    
    const session = sessions.sessions.find((s: any) => s.id === sessionId)
    
    if (!session) {
      return NextResponse.json({
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: `Execution session ${sessionId} not found`,
        }
      }, { status: 404 })
    }
    
    // Get all events for the session
    const events = await FlowTraceDatabase.getSessionEvents(sessionId)
    
    return NextResponse.json({
      sessionId: session.id,
      workflowId: session.workflowId,
      workflowName: session.workflowName,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      summary: session.summary,
      metadata: {},
      events: events.map((event: any) => ({
        id: event.id,
        timestamp: event.timestamp,
        nodeId: event.nodeId,
        portId: event.portId,
        eventType: event.eventType,
        data: event.data,
        duration: event.duration,
        metadata: event.metadata,
      })),
      totalEvents: events.length,
    })
  } catch (error) {
    console.error('Error getting execution details:', error)
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get execution details',
        traceId: `trace_${Date.now()}`,
      }
    }, { status: 500 })
  }
}