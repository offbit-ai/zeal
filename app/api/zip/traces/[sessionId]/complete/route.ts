import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { FlowTraceDatabase } from '@/services/flowTraceDatabase'
import { CompleteTraceSessionRequest } from '@/types/zip'

const completeSessionSchema = z.object({
  status: z.enum(['success', 'error', 'cancelled']),
  summary: z.object({
    totalNodes: z.number(),
    successfulNodes: z.number(),
    failedNodes: z.number(),
    totalDuration: z.number(),
    totalDataProcessed: z.number(),
  }).optional(),
  error: z.object({
    message: z.string(),
    nodeId: z.string().optional(),
    stack: z.string().optional(),
  }).optional(),
})

// POST /api/zip/traces/[sessionId]/complete - Complete trace session
export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params
    const body = await request.json()
    
    // Validate request
    const validation = completeSessionSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request format',
          details: validation.error.errors,
        }
      }, { status: 400 })
    }
    
    const { status, summary, error } = validation.data
    
    // Update session status
    await FlowTraceDatabase.updateSession(sessionId, {
      status: status === 'success' ? 'completed' : status === 'cancelled' ? 'cancelled' : 'failed',
      endTime: new Date().toISOString(),
      summary,
      error,
    })
    
    return NextResponse.json({
      success: true,
      sessionId,
      status,
      message: `Trace session ${sessionId} completed with status: ${status}`,
    })
  } catch (error) {
    console.error('Error completing trace session:', error)
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to complete trace session',
        traceId: `trace_${Date.now()}`,
      }
    }, { status: 500 })
  }
}