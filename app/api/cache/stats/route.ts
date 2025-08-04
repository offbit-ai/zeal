import { NextRequest, NextResponse } from 'next/server'
import { createSuccessResponse, withErrorHandling, extractUserId } from '@/lib/api-utils'
import { apiCache } from '@/lib/api-cache'
import { ApiError } from '@/types/api'

// GET /api/cache/stats - Get cache statistics (admin only)
export const GET = withErrorHandling(async (req: NextRequest) => {
  const userId = extractUserId(req)

  // In real implementation, check if user has admin permissions
  // For now, allow all authenticated users to view cache stats
  if (!userId) {
    throw new ApiError('UNAUTHORIZED', 'Authentication required', 401)
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
})

// DELETE /api/cache/stats - Clear cache (admin only)
export const DELETE = withErrorHandling(async (req: NextRequest) => {
  const userId = extractUserId(req)
  const { searchParams } = new URL(req.url)
  const pattern = searchParams.get('pattern')
  const clearAll = searchParams.get('clear_all') === 'true'

  // In real implementation, check if user has admin permissions
  if (!userId.startsWith('admin_')) {
    throw new ApiError('FORBIDDEN', 'Only administrators can clear cache', 403)
  }

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
  apiCache.clearUserCache(userId)
  return NextResponse.json(
    createSuccessResponse({
      message: `Cache entries for user ${userId} cleared`,
      timestamp: new Date().toISOString(),
    })
  )
})
