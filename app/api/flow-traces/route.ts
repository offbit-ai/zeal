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
import { buildTenantQuery, addTenantContext } from '@/lib/auth/tenant-utils'

// GET /api/flow-traces - List flow trace sessions
export const GET = withAuth(
  withErrorHandling(async (req: AuthenticatedRequest) => {
    const { searchParams } = new URL(req.url)
    const userId = req.auth?.subject?.id || extractUserId(req)
    const pagination = parsePaginationParams(searchParams)
    const filters = parseFilterParams(searchParams)

    // Build query with tenant context
    const tenantQuery = buildTenantQuery(req as NextRequest)

    const { sessions, total } = await FlowTraceDatabase.getSessions(userId, {
      limit: pagination.limit,
      offset: (pagination.page - 1) * pagination.limit,
      search: filters.search,
      status: filters.status as 'running' | 'completed' | 'failed' | undefined,
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
  }),
  {
    resource: 'flow-traces',
    action: 'read'
  }
)

// POST /api/flow-traces - Create a new trace session
export const POST = withAuth(
  withErrorHandling(async (req: AuthenticatedRequest) => {
    const userId = req.auth?.subject?.id || extractUserId(req)
    const body = await req.json()

    // Validate required fields
    if (!body.workflowId || !body.workflowName) {
      throw new ApiError('VALIDATION_ERROR', 'workflowId and workflowName are required', 400)
    }

    // Add tenant context to session data
    const sessionData = addTenantContext({
      workflowId: body.workflowId,
      workflowVersionId: body.workflowVersionId,
      workflowName: body.workflowName,
      userId,
    }, req as NextRequest)

    // Create new session
    const session = await FlowTraceDatabase.createSession(sessionData)

    return NextResponse.json(createSuccessResponse(session), { status: 201 })
  }),
  {
    resource: 'flow-traces',
    action: 'create'
  }
)
