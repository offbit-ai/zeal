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

// GET /api/flow-traces - List flow trace sessions
export const GET = withErrorHandling(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const userId = extractUserId(req)
  const pagination = parsePaginationParams(searchParams)
  const filters = parseFilterParams(searchParams)
  
  const { sessions, total } = await FlowTraceDatabase.getAllSessions(userId, {
    limit: pagination.limit,
    offset: (pagination.page - 1) * pagination.limit,
    search: filters.search,
    status: filters.status,
    timeFilter: filters.timeFilter as '1h' | '6h' | '24h' | '7d' | undefined
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

// POST /api/flow-traces - Create a new trace session
export const POST = withErrorHandling(async (req: NextRequest) => {
  const userId = extractUserId(req)
  const body = await req.json()
  
  // Validate required fields
  if (!body.workflowId || !body.workflowName) {
    throw new ApiError(
      'VALIDATION_ERROR', 
      'workflowId and workflowName are required',
      400
    )
  }
  
  // Create new session
  const session = await FlowTraceDatabase.createSession({
    workflowId: body.workflowId,
    workflowVersionId: body.workflowVersionId,
    workflowName: body.workflowName,
    userId
  })
  
  return NextResponse.json(createSuccessResponse(session), { status: 201 })
})