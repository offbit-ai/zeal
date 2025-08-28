import { NextRequest, NextResponse } from 'next/server'
import { FlowTraceDatabase } from '@/services/flowTraceDatabase'
import { WorkflowDatabase } from '@/services/workflowDatabase'
import { ReplayData } from '@/types/zip'

// GET /api/zip/executions/[sessionId]/replay - Get replay data
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
    
    // Get workflow snapshot at execution time
    const { versions } = await WorkflowDatabase.getWorkflowVersions(session.workflowId, { limit: 1 })
    const workflowSnapshot = versions[0] || null
    
    // Get all events for the session
    const events = await FlowTraceDatabase.getSessionEvents(sessionId)
    
    // Calculate timeline data
    const startTime = new Date(session.startTime).getTime()
    const nodeTimings: Record<string, any> = {}
    
    events.forEach((event: any) => {
      const eventTime = new Date(event.timestamp).getTime()
      const relativeTime = eventTime - startTime
      
      if (!nodeTimings[event.nodeId]) {
        nodeTimings[event.nodeId] = {
          startTime: relativeTime,
          endTime: relativeTime,
          duration: 0,
        }
      } else {
        nodeTimings[event.nodeId].endTime = relativeTime
        nodeTimings[event.nodeId].duration = 
          nodeTimings[event.nodeId].endTime - nodeTimings[event.nodeId].startTime
      }
    })
    
    const totalDuration = session.endTime 
      ? new Date(session.endTime).getTime() - startTime
      : Date.now() - startTime
    
    const replayData: ReplayData = {
      sessionId,
      workflowSnapshot,
      events: events.map((event: any) => ({
        timestamp: new Date(event.timestamp).getTime(),
        relativeTime: new Date(event.timestamp).getTime() - startTime,
        nodeId: event.nodeId,
        eventType: event.eventType,
        data: event.data,
      })),
      timeline: {
        totalDuration,
        nodeTimings,
      },
    }
    
    return NextResponse.json(replayData)
  } catch (error) {
    console.error('Error getting replay data:', error)
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get replay data',
        traceId: `trace_${Date.now()}`,
      }
    }, { status: 500 })
  }
}