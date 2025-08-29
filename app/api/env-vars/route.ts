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
} from '@/lib/api-utils'
import { ApiError, EnvVarCreateRequest, EnvVarResponse } from '@/types/api'
import { apiCache, CACHE_TTL, invalidateCache } from '@/lib/api-cache'
import { EnvVarDatabase } from '@/services/envVarDatabase'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'
import {
  buildTenantQuery,
  addTenantContext,
  applyTenantFilterToArray
} from '@/lib/auth/tenant-utils'

// GET /api/env-vars - List environment variables
export const GET = withAuth(
  withErrorHandling(async (req: AuthenticatedRequest) => {
  // Generate cache key
  const cacheKey = apiCache.generateKey(req)

  // Check cache first
  const cachedResponse = apiCache.get(cacheKey)
  if (cachedResponse) {
    // console.log removed
    return NextResponse.json(cachedResponse)
  }

  const { searchParams } = new URL(req.url)
  const userId = req.auth?.subject?.id || extractUserId(req)
  const pagination = parsePaginationParams(searchParams)
  const filters = parseFilterParams(searchParams)

  // Build query with tenant context
  const tenantQuery = buildTenantQuery(req as NextRequest)

  // Get environment variables from database with tenant filter
  const { data, total } = await EnvVarDatabase.list({
    ...tenantQuery,
    category: filters.category,
    limit: pagination.limit,
    offset: (pagination.page - 1) * pagination.limit,
  })

  const totalPages = Math.ceil(total / pagination.limit)

  const response = createSuccessResponse(data, {
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages,
    },
    timestamp: new Date().toISOString(),
    requestId: `req_${Date.now()}`,
  })

  // Cache the response
  apiCache.set(cacheKey, response, CACHE_TTL.ENV_VARS)

  return NextResponse.json(response)
  }),
  {
    resource: 'env-vars',
    action: 'read'
  }
)

// POST /api/env-vars - Create environment variable
export const POST = withAuth(
  withErrorHandling(async (req: AuthenticatedRequest) => {
    const userId = req.auth?.subject?.id || extractUserId(req)
    const body: EnvVarCreateRequest = await req.json()

  // Validate required fields
  validateRequired(body, ['key', 'value'])
  validateEnvVarKey(body.key)

  // Build tenant context
  const tenantQuery = buildTenantQuery(req as NextRequest)

  // Check for duplicate key within the same tenant
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

  // Add tenant context to the new environment variable
  const envVarData = addTenantContext({
    ...body,
    isSecret,
    userId,
  }, req as NextRequest)

  // Create new environment variable using upsert to handle potential race conditions
  const newEnvVar = await EnvVarDatabase.upsert(envVarData)

  // Invalidate cache for env vars
  invalidateCache('/api/env-vars')

  return NextResponse.json(createSuccessResponse(newEnvVar), { status: 201 })
  }),
  {
    resource: 'env-vars',
    action: 'create'
  }
)
