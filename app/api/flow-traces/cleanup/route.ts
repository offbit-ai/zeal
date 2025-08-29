import { NextRequest, NextResponse } from 'next/server'
import { createSuccessResponse, withErrorHandling, extractUserId } from '@/lib/api-utils'
import { ApiError } from '@/types/api'
import { FlowTraceDatabase } from '@/services/flowTraceDatabase'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'
import { validateTenantAccess, createTenantViolationError } from '@/lib/auth/tenant-utils'

// DELETE /api/flow-traces/cleanup - Delete old trace sessions
export const DELETE = withAuth(async (request: AuthenticatedRequest, context?: { params: any }) => {
  if (!context || !context.params) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }
  
  // Get tenant context for filtering cleanup operations
  const tenantId = request.auth?.subject?.tenantId
  const isAdmin = request.auth?.subject?.roles?.includes('admin')
  
  const { searchParams } = new URL(request.url)

  // Get days to keep from query params, default to 30
  const daysToKeep = parseInt(searchParams.get('daysToKeep') || '30', 10)

  if (isNaN(daysToKeep) || daysToKeep < 1) {
    return NextResponse.json({ error: 'daysToKeep must be a positive number' }, { status: 400 })
  }

  // Calculate the date threshold
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

  // Note: TimescaleDB handles retention automatically, but we validate tenant access
  if (tenantId && !isAdmin) {
    return NextResponse.json({ 
      error: 'Insufficient permissions. Cleanup operations require admin access or are handled automatically via retention policies.' 
    }, { status: 403 })
  }
  
  const deletedCount = await FlowTraceDatabase.deleteOldSessions(cutoffDate)

  return NextResponse.json(
    createSuccessResponse({
      deleted: deletedCount,
      message: `Deleted ${deletedCount} trace sessions older than ${daysToKeep} days`,
    })
  )
}, {
  resource: 'execution',
  action: 'delete'
})
