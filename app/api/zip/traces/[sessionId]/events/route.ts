import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { FlowTraceDatabase } from '@/services/flowTraceDatabase'
import { TraceEvent } from '@/types/zip'
import { v4 as uuidv4 } from 'uuid'

const traceEventSchema = z.object({
  timestamp: z.number(),
  nodeId: z.string(),
  portId: z.string().optional(),
  eventType: z.enum(['input', 'output', 'error', 'log']),
  data: z.object({
    size: z.number(),
    type: z.string(),
    preview: z.any().optional(),
    fullData: z.any().optional(),
  }),
  duration: z.number().optional(),
  metadata: z.object({
    cpuUsage: z.number().optional(),
    memoryUsage: z.number().optional(),
    custom: z.record(z.any()).optional(),
  }).optional(),
  error: z.object({
    message: z.string(),
    stack: z.string().optional(),
    code: z.string().optional(),
  }).optional(),
})

const submitEventsSchema = z.object({
  events: z.array(traceEventSchema),
})

// POST /api/zip/traces/[sessionId]/events - Submit trace events
export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params
    const body = await request.json()
    
    // Validate request
    const validation = submitEventsSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request format',
          details: validation.error.errors,
        }
      }, { status: 400 })
    }
    
    const { events } = validation.data
    
    // Add events to trace session
    for (const event of events) {
      const eventId = uuidv4()
      
      await FlowTraceDatabase.addEvent({
        id: eventId,
        sessionId,
        timestamp: new Date(event.timestamp).toISOString(),
        nodeId: event.nodeId,
        portId: event.portId,
        eventType: event.eventType,
        data: event.data,
        duration: event.duration,
        metadata: event.metadata,
      })
    }
    
    return NextResponse.json({
      success: true,
      eventsProcessed: events.length,
      message: `Successfully processed ${events.length} trace events`,
    })
  } catch (error) {
    console.error('Error submitting trace events:', error)
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to submit trace events',
        traceId: `trace_${Date.now()}`,
      }
    }, { status: 500 })
  }
}