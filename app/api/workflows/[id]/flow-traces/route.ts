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
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'
import { buildTenantQuery } from '@/lib/auth/tenant-utils'

// GET /api/workflows/[id]/flow-traces - Get flow trace sessions for a specific workflow
export const GET = withAuth(
  withErrorHandling(
    async (req: AuthenticatedRequest, context?: { params: { id: string } }) => {
      const { searchParams } = new URL(req.url)
      if (!context || !context.params || !context.params.id) {
        throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow ID is required', 400)
      }
      const userId = req.auth?.subject?.id || extractUserId(req)
    const workflowId = context.params.id
    const pagination = parsePaginationParams(searchParams)
    const filters = parseFilterParams(searchParams)

    // Build query with tenant context
    const tenantQuery = buildTenantQuery(req as NextRequest)
    
    const { sessions, total } = await FlowTraceDatabase.listSessions({
      workflowId: workflowId,
      ...tenantQuery,
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
  ),
  {
    resource: 'flow-traces',
    action: 'read'
  }
)
