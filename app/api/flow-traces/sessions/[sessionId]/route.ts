import { NextRequest, NextResponse } from 'next/server'
import { createSuccessResponse, withErrorHandling, extractUserId } from '@/lib/api-utils'
import { ApiError } from '@/types/api'
import { FlowTraceDatabase } from '@/services/flowTraceDatabase'

// GET /api/flow-traces/sessions/[sessionId] - Get trace session with all traces
export const GET = withErrorHandling(
  async (req: NextRequest, context?: { params: { sessionId: string } }) => {
    const userId = extractUserId(req)

    if (!context || !context.params || !context.params.sessionId) {
      throw new ApiError('TRACE_SESSION_NOT_FOUND', 'Session ID is required', 400)
    }

    const { sessionId } = context.params

    const session = await FlowTraceDatabase.getSession(sessionId)

    if (!session) {
      throw new ApiError('TRACE_SESSION_NOT_FOUND', 'Trace session not found', 404)
    }

    return NextResponse.json(createSuccessResponse(session))
  }
)

// PUT /api/flow-traces/sessions/[sessionId] - Update session (complete/fail)
export const PUT = withErrorHandling(
  async (req: NextRequest, context?: { params: { sessionId: string } }) => {
    const userId = extractUserId(req)

    if (!context || !context.params || !context.params.sessionId) {
      throw new ApiError('TRACE_SESSION_NOT_FOUND', 'Session ID is required', 400)
    }

    const { sessionId } = context.params
    const body = await req.json()

    if (!body.status || !['completed', 'failed'].includes(body.status)) {
      throw new ApiError('VALIDATION_ERROR', 'Status must be either "completed" or "failed"', 400)
    }

    await FlowTraceDatabase.completeSession(sessionId, body.status)

    return NextResponse.json(createSuccessResponse({ success: true }))
  }
)

// POST /api/flow-traces/sessions/[sessionId]/traces - Add trace to session
export const POST = withErrorHandling(
  async (req: NextRequest, context?: { params: { sessionId: string } }) => {
    const userId = extractUserId(req)

    if (!context || !context.params || !context.params.sessionId) {
      throw new ApiError('TRACE_SESSION_NOT_FOUND', 'Session ID is required', 400)
    }

    const { sessionId } = context.params
    const body = await req.json()

    // Validate required fields
    if (!body.source || !body.target || body.duration === undefined) {
      throw new ApiError('VALIDATION_ERROR', 'source, target, and duration are required', 400)
    }

    // Add trace
    const trace = await FlowTraceDatabase.addTrace(sessionId, {
      source: body.source,
      target: body.target,
      duration: body.duration,
      status: body.status || 'success',
      data: body.data || { payload: {}, size: 0, type: 'unknown' },
      error: body.error,
      graphId: body.graphId,
      graphName: body.graphName,
      parentTraceId: body.parentTraceId,
      depth: body.depth,
    })

    return NextResponse.json(createSuccessResponse(trace), { status: 201 })
  }
)
