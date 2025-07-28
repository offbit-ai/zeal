import { NextRequest, NextResponse } from 'next/server'
import { 
  createSuccessResponse, 
  withErrorHandling, 
  extractUserId
} from '@/lib/api-utils'
import { ApiError } from '@/types/api'
import { FlowTraceDatabase } from '@/services/flowTraceDatabase'

// GET /api/flow-traces/traces/[traceId]/subgraph - Get subgraph traces for a parent trace
export const GET = withErrorHandling(async (req: NextRequest, { params }: { params: { traceId: string } }) => {
  const userId = extractUserId(req)
  const { traceId } = params
  
  // Get subgraph traces
  const traces = await FlowTraceDatabase.getSubgraphTraces(traceId)
  
  return NextResponse.json(createSuccessResponse(traces))
})