import { NextRequest, NextResponse } from 'next/server'
import {
  createSuccessResponse,
  withErrorHandling,
  parsePaginationParams,
  parseFilterParams,
  extractUserId,
} from '@/lib/api-utils'
import { ApiError } from '@/types/api'
import { FlowTraceDatabase } from '@/services/flowTraceDatabase'

// GET /api/workflows/[id]/flow-traces - Get flow trace sessions for a specific workflow
export const GET = withErrorHandling(
  async (req: NextRequest, context?: { params: { id: string } }) => {
    const { searchParams } = new URL(req.url)
    if (!context || !context.params || !context.params.id) {
      throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow ID is required', 400)
    }
    const userId = extractUserId(req)
    const workflowId = context.params.id
    const pagination = parsePaginationParams(searchParams)
    const filters = parseFilterParams(searchParams)

    const { sessions, total } = await FlowTraceDatabase.listSessions({
      workflowId: workflowId,
      limit: pagination.limit,
      offset: (pagination.page - 1) * pagination.limit,
      status: filters.status,
      startDate: filters.dateFrom,
      endDate: filters.dateTo,
    })

    const totalPages = Math.ceil(total / pagination.limit)

    return NextResponse.json(
      createSuccessResponse(sessions, {
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          totalPages,
        },
        timestamp: new Date().toISOString(),
        requestId: `req_${Date.now()}`,
      })
    )
  }
)
