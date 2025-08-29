import { NextRequest, NextResponse } from 'next/server'
import { createSuccessResponse, withErrorHandling, extractUserId } from '@/lib/api-utils'
import { apiCache } from '@/lib/api-cache'
import { ApiError } from '@/types/api'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'
import { validateTenantAccess, createTenantViolationError } from '@/lib/auth/tenant-utils'

// GET /api/cache/stats - Get cache statistics (admin only)
export const GET = withAuth(async (request: AuthenticatedRequest, context?: { params: any }) => {
  if (!context || !context.params) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }
  
  // Cache stats are system-level - require admin access for multi-tenant environments
  const tenantId = request.auth?.subject?.tenantId
  const isAdmin = request.auth?.subject?.roles?.includes('admin')
  
  if (tenantId && !isAdmin) {
    return NextResponse.json({ error: 'Insufficient permissions. Cache statistics require admin access.' }, { status: 403 })
  }

  const stats = apiCache.getStats()

  return NextResponse.json(
    createSuccessResponse({
      cacheSize: stats.size,
      entries: stats.keys.map(key => {
        const parts = key.split(':')
        return {
          userId: parts[0],
          endpoint: parts[1],
          queryParams: parts[2] || 'none',
        }
      }),
      timestamp: new Date().toISOString(),
    })
  )
}, {
  resource: 'workflow',
  action: 'read'
})

// DELETE /api/cache/stats - Clear cache (admin only)
export const DELETE = withAuth(async (request: AuthenticatedRequest, context?: { params: any }) => {
  if (!context || !context.params) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }
  
  // Cache clearing is system-level - require admin access for multi-tenant environments  
  const tenantId = request.auth?.subject?.tenantId
  const isAdmin = request.auth?.subject?.roles?.includes('admin')
  
  if (tenantId && !isAdmin) {
    return NextResponse.json({ error: 'Insufficient permissions. Cache clearing requires admin access.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const pattern = searchParams.get('pattern')
  const clearAll = searchParams.get('clear_all') === 'true'

  if (clearAll) {
    apiCache.clearAll()
    return NextResponse.json(
      createSuccessResponse({
        message: 'All cache entries cleared',
        timestamp: new Date().toISOString(),
      })
    )
  }

  if (pattern) {
    apiCache.clearPattern(pattern)
    return NextResponse.json(
      createSuccessResponse({
        message: `Cache entries matching pattern "${pattern}" cleared`,
        timestamp: new Date().toISOString(),
      })
    )
  }

  // Clear current user's cache by default
  const userId = request.auth?.subject?.id || 'unknown'
  apiCache.clearUserCache(userId)
  return NextResponse.json(
    createSuccessResponse({
      message: `Cache entries for user ${userId} cleared`,
      timestamp: new Date().toISOString(),
    })
  )
}, {
  resource: 'workflow',
  action: 'delete'
})
