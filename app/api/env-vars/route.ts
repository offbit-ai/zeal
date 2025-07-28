import { NextRequest, NextResponse } from 'next/server'
import { 
  createSuccessResponse, 
  createErrorResponse, 
  withErrorHandling, 
  validateRequired,
  parsePaginationParams,
  parseFilterParams,
  extractUserId,
  validateEnvVarKey,
  mockDelay
} from '@/lib/api-utils'
import { ApiError, EnvVarCreateRequest, EnvVarResponse } from '@/types/api'
import { apiCache, CACHE_TTL, invalidateCache } from '@/lib/api-cache'
import { EnvVarDatabase } from '@/services/envVarDatabase'

// GET /api/env-vars - List environment variables
export const GET = withErrorHandling(async (req: NextRequest) => {
  // Generate cache key
  const cacheKey = apiCache.generateKey(req)
  
  // Check cache first
  const cachedResponse = apiCache.get(cacheKey)
  if (cachedResponse) {
    console.log(`Cache hit for env-vars: ${cacheKey}`)
    return NextResponse.json(cachedResponse)
  }
  
  const { searchParams } = new URL(req.url)
  const userId = extractUserId(req)
  const pagination = parsePaginationParams(searchParams)
  const filters = parseFilterParams(searchParams)
  
  // Get environment variables from database
  const { data, total } = await EnvVarDatabase.list({
    category: filters.category,
    limit: pagination.limit,
    offset: (pagination.page - 1) * pagination.limit
  })
  
  const totalPages = Math.ceil(total / pagination.limit)
  
  const response = createSuccessResponse(data, {
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages
    },
    timestamp: new Date().toISOString(),
    requestId: `req_${Date.now()}`
  })
  
  // Cache the response
  apiCache.set(cacheKey, response, CACHE_TTL.ENV_VARS)
  
  return NextResponse.json(response)
})

// POST /api/env-vars - Create environment variable
export const POST = withErrorHandling(async (req: NextRequest) => {
  const userId = extractUserId(req)
  const body: EnvVarCreateRequest = await req.json()
  
  // Validate required fields
  validateRequired(body, ['key', 'value'])
  validateEnvVarKey(body.key)
  
  // Check for duplicate key
  const existingVar = await EnvVarDatabase.getByKey(body.key)
  
  if (existingVar) {
    throw new ApiError(
      'DUPLICATE_ENV_VAR',
      `Environment variable with key '${body.key}' already exists`,
      409
    )
  }
  
  // Ensure isSecret is set based on category or explicit flag
  const isSecret = body.isSecret || body.category === 'secrets'
  
  // Create new environment variable using upsert to handle potential race conditions
  const newEnvVar = await EnvVarDatabase.upsert({
    ...body,
    isSecret,
    userId
  })
  
  // Invalidate cache for env vars
  invalidateCache('/api/env-vars')
  
  return NextResponse.json(createSuccessResponse(newEnvVar), { status: 201 })
})