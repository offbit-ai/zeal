import { NextRequest } from 'next/server'

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class ApiCache {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private defaultTTL = 60000 // 60 seconds default

  /**
   * Generate a cache key based on request URL and parameters
   */
  generateKey(req: NextRequest): string {
    const url = new URL(req.url)
    const pathname = url.pathname
    const searchParams = url.searchParams.toString()
    const userId = req.headers.get('x-user-id') || 'anonymous'
    
    // Create a unique key based on path, query params, and user
    return `${userId}:${pathname}:${searchParams}`
  }

  /**
   * Get data from cache if valid
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    const now = Date.now()
    const age = now - entry.timestamp

    // Check if cache entry has expired
    if (age > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Set data in cache with optional TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    })
  }

  /**
   * Clear specific cache entry
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cache entries matching a pattern
   */
  clearPattern(pattern: string): void {
    const keys = Array.from(this.cache.keys())
    keys.forEach(key => {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    })
  }

  /**
   * Clear all cache entries for a specific user
   */
  clearUserCache(userId: string): void {
    this.clearPattern(`${userId}:`)
  }

  /**
   * Clear entire cache
   */
  clearAll(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }
}

// Export singleton instance
export const apiCache = new ApiCache()

// Cache TTL configurations for different endpoints
export const CACHE_TTL = {
  ENV_VARS: 300000,      // 5 minutes - env vars change infrequently
  NODES: 600000,         // 10 minutes - node templates are relatively static
  CATEGORIES: 900000,    // 15 minutes - categories rarely change
  USER_DATA: 60000,      // 1 minute - user-specific data
  SEARCH_RESULTS: 30000  // 30 seconds - search results
}

/**
 * Higher-order function to add caching to an API handler
 */
export function withCache<T>(
  handler: (req: NextRequest) => Promise<T>,
  ttl: number = 60000
) {
  return async (req: NextRequest): Promise<T> => {
    const cacheKey = apiCache.generateKey(req)
    
    // Check if we have a cached response
    const cachedData = apiCache.get<T>(cacheKey)
    if (cachedData !== null) {
      console.log(`Cache hit for ${cacheKey}`)
      return cachedData
    }

    // If not cached, execute the handler
    console.log(`Cache miss for ${cacheKey}`)
    const result = await handler(req)
    
    // Cache the result
    apiCache.set(cacheKey, result, ttl)
    
    return result
  }
}

/**
 * Invalidate cache entries when data is modified
 */
export function invalidateCache(pattern: string): void {
  apiCache.clearPattern(pattern)
  console.log(`Cache invalidated for pattern: ${pattern}`)
}