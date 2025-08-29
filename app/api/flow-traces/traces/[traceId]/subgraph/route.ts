import { NextRequest, NextResponse } from 'next/server'
import { createSuccessResponse, withErrorHandling, extractUserId } from '@/lib/api-utils'
import { ApiError } from '@/types/api'
import { FlowTraceDatabase } from '@/services/flowTraceDatabase'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'
import { validateTenantAccess, createTenantViolationError } from '@/lib/auth/tenant-utils'

// GET /api/flow-traces/traces/[traceId]/subgraph - Get subgraph traces for a parent trace
export const GET = withAuth(async (
  request: NextRequest,
  context?: { params: { traceId: string } }
) => {
  if (!context || !context.params) {
    return NextResponse.json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Missing trace ID parameter'
      }
    }, { status: 400 })
  }
  
  const { traceId } = context.params

  // Get subgraph traces
  const traces = await FlowTraceDatabase.getSubgraphTraces(traceId)

  return NextResponse.json(createSuccessResponse(traces))
}, {
  resource: 'execution',
  action: 'read'
})
