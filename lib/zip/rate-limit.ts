import { NextRequest, NextResponse } from 'next/server'

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  message?: string // Custom error message
}

interface RateLimitStore {
  count: number
  resetTime: number
}

// In-memory store for rate limiting (can be replaced with Redis in production)
const rateLimitStore = new Map<string, RateLimitStore>()

// Default rate limit configurations for different endpoints
export const rateLimits: Record<string, RateLimitConfig> = {
  'templates': { windowMs: 60 * 60 * 1000, maxRequests: 100 }, // 100 requests/hour
  'orchestrator': { windowMs: 60 * 60 * 1000, maxRequests: 1000 }, // 1000 requests/hour
  'traces': { windowMs: 60 * 60 * 1000, maxRequests: 10000 }, // 10000 events/hour
  'events': { windowMs: 60 * 1000, maxRequests: 1000 }, // 1000 events/minute
  'webhooks': { windowMs: 60 * 60 * 1000, maxRequests: 50 }, // 50 requests/hour
  'default': { windowMs: 60 * 60 * 1000, maxRequests: 500 }, // 500 requests/hour
}

/**
 * Get client identifier from request
 */
function getClientId(request: NextRequest): string {
  // In self-hosted mode, we can use IP address or a custom header
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const clientId = request.headers.get('x-client-id') // Custom client ID header
  
  return clientId || forwardedFor || realIp || 'anonymous'
}

/**
 * Clean up expired entries from the store
 */
function cleanupStore() {
  const now = Date.now()
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}

/**
 * Rate limiting middleware
 */
export function rateLimitMiddleware(
  endpoint: string,
  customConfig?: Partial<RateLimitConfig>
) {
  const config = {
    ...(rateLimits[endpoint] || rateLimits.default),
    ...customConfig,
  }
  
  return async function middleware(request: NextRequest): Promise<NextResponse | null> {
    const clientId = getClientId(request)
    const key = `${endpoint}:${clientId}`
    const now = Date.now()
    
    // Clean up expired entries periodically
    if (Math.random() < 0.01) { // 1% chance to clean up
      cleanupStore()
    }
    
    // Get or create rate limit entry
    let limitData = rateLimitStore.get(key)
    
    if (!limitData || limitData.resetTime < now) {
      // Create new window
      limitData = {
        count: 0,
        resetTime: now + config.windowMs,
      }
      rateLimitStore.set(key, limitData)
    }
    
    // Increment request count
    limitData.count++
    
    // Check if rate limit exceeded
    if (limitData.count > config.maxRequests) {
      const resetDate = new Date(limitData.resetTime)
      
      return NextResponse.json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: config.message || `Rate limit exceeded. Please try again after ${resetDate.toISOString()}`,
          details: {
            limit: config.maxRequests,
            windowMs: config.windowMs,
            resetTime: resetDate.toISOString(),
          },
        }
      }, {
        status: 429,
        headers: {
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': Math.max(0, config.maxRequests - limitData.count).toString(),
          'X-RateLimit-Reset': limitData.resetTime.toString(),
          'Retry-After': Math.ceil((limitData.resetTime - now) / 1000).toString(),
        },
      })
    }
    
    // Add rate limit headers to successful responses
    // This will be added by the route handlers
    return null
  }
}

/**
 * Helper to add rate limit headers to successful responses
 */
export function addRateLimitHeaders(
  response: NextResponse,
  endpoint: string,
  clientId: string
): NextResponse {
  const key = `${endpoint}:${clientId}`
  const limitData = rateLimitStore.get(key)
  const config = rateLimits[endpoint] || rateLimits.default
  
  if (limitData) {
    response.headers.set('X-RateLimit-Limit', config.maxRequests.toString())
    response.headers.set('X-RateLimit-Remaining', 
      Math.max(0, config.maxRequests - limitData.count).toString())
    response.headers.set('X-RateLimit-Reset', limitData.resetTime.toString())
  }
  
  return response
}