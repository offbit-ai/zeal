import { NextRequest, NextResponse } from 'next/server'
import { createSuccessResponse, withErrorHandling, extractUserId } from '@/lib/api-utils'
import { ApiError } from '@/types/api'
import { FlowTraceDatabase } from '@/services/flowTraceDatabase'

// GET /api/flow-traces/traces/[traceId]/subgraph - Get subgraph traces for a parent trace
export const GET = withErrorHandling(
  async (req: NextRequest, context: { params: { traceId: string } } | undefined) => {
    const userId = extractUserId(req)

    if (!context || !context.params || !context.params.traceId) {
      throw new ApiError('TRACE_NOT_FOUND', 'Trace ID is required', 400)
    }
    const { traceId } = context.params

    // Get subgraph traces
    const traces = await FlowTraceDatabase.getSubgraphTraces(traceId)

    return NextResponse.json(createSuccessResponse(traces))
  }
)
