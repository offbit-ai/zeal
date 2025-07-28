import { NextRequest, NextResponse } from 'next/server'
import { 
  createSuccessResponse, 
  withErrorHandling, 
  parsePaginationParams,
  parseFilterParams,
  extractUserId
} from '@/lib/api-utils'
import { ApiError } from '@/types/api'
import { FlowTraceDatabase } from '@/services/flowTraceDatabase'

// GET /api/workflows/[id]/flow-traces - Get flow trace sessions for a specific workflow
export const GET = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const { searchParams } = new URL(req.url)
  const userId = extractUserId(req)
  const workflowId = params.id
  const pagination = parsePaginationParams(searchParams)
  const filters = parseFilterParams(searchParams)
  
  const { sessions, total } = await FlowTraceDatabase.getWorkflowSessions(workflowId, {
    limit: pagination.limit,
    offset: (pagination.page - 1) * pagination.limit,
    status: filters.status,
    startTimeFrom: filters.startTimeFrom,
    startTimeTo: filters.startTimeTo
  })
  
  const totalPages = Math.ceil(total / pagination.limit)
  
  return NextResponse.json(createSuccessResponse(sessions, {
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages
    },
    timestamp: new Date().toISOString(),
    requestId: `req_${Date.now()}`
  }))
})