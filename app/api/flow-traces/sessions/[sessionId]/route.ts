import { NextRequest, NextResponse } from 'next/server'
import { createSuccessResponse, withErrorHandling, extractUserId } from '@/lib/api-utils'
import { ApiError } from '@/types/api'
import { FlowTraceDatabase } from '@/services/flowTraceDatabase'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'
import { validateTenantAccess, createTenantViolationError } from '@/lib/auth/tenant-utils'

// GET /api/flow-traces/sessions/[sessionId] - Get trace session with all traces
export const GET = withAuth(
  withErrorHandling(
    async (req: AuthenticatedRequest, context?: { params: { sessionId: string } }) => {
      const userId = req.auth?.subject?.id || extractUserId(req)

    if (!context || !context.params || !context.params.sessionId) {
      throw new ApiError('TRACE_SESSION_NOT_FOUND', 'Session ID is required', 400)
    }

    const { sessionId } = context.params

    const session = await FlowTraceDatabase.getSession(sessionId)

    if (!session) {
      throw new ApiError('TRACE_SESSION_NOT_FOUND', 'Trace session not found', 404)
    }

    // Check tenant access - skip if session doesn't have tenant info yet
    if ((session as any).tenantId && !validateTenantAccess(session as any, req as NextRequest)) {
      return createTenantViolationError()
    }

    return NextResponse.json(createSuccessResponse(session))
    }
  ),
  {
    resource: 'flow-traces',
    action: 'read'
  }
)

// PUT /api/flow-traces/sessions/[sessionId] - Update session (complete/fail)
export const PUT = withAuth(
  withErrorHandling(
    async (req: AuthenticatedRequest, context?: { params: { sessionId: string } }) => {
      const userId = req.auth?.subject?.id || extractUserId(req)

    if (!context || !context.params || !context.params.sessionId) {
      throw new ApiError('TRACE_SESSION_NOT_FOUND', 'Session ID is required', 400)
    }

    const { sessionId } = context.params
    const body = await req.json()

    if (!body.status || !['completed', 'failed'].includes(body.status)) {
      throw new ApiError('VALIDATION_ERROR', 'Status must be either "completed" or "failed"', 400)
    }

    // Check session exists and tenant access
    const session = await FlowTraceDatabase.getSession(sessionId)
    if (!session) {
      throw new ApiError('TRACE_SESSION_NOT_FOUND', 'Trace session not found', 404)
    }

    if ((session as any).tenantId && !validateTenantAccess(session as any, req as NextRequest)) {
      return createTenantViolationError()
    }

    await FlowTraceDatabase.completeSession(sessionId, body.status)

    return NextResponse.json(createSuccessResponse({ success: true }))
    }
  ),
  {
    resource: 'flow-traces',
    action: 'update'
  }
)

// POST /api/flow-traces/sessions/[sessionId]/traces - Add trace to session
export const POST = withAuth(
  withErrorHandling(
    async (req: AuthenticatedRequest, context?: { params: { sessionId: string } }) => {
      const userId = req.auth?.subject?.id || extractUserId(req)

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
  ),
  {
    resource: 'flow-traces',
    action: 'create'
  }
)
