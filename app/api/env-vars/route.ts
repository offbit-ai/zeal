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

// Mock data store (in real app, this would be a database)
let envVarsStore: EnvVarResponse[] = [
  {
    id: 'env_1',
    key: 'NODE_ENV',
    value: 'development',
    isSecret: false,
    description: 'Application environment',
    category: 'environment',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'user_123'
  },
  {
    id: 'env_2',
    key: 'DATABASE_URL',
    value: 'postgresql://localhost:5432/zeal',
    isSecret: true,
    description: 'Primary database connection string',
    category: 'environment',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'user_123'
  }
]

// GET /api/env-vars - List environment variables
export const GET = withErrorHandling(async (req: NextRequest) => {
  await mockDelay(100) // Simulate database query
  
  const { searchParams } = new URL(req.url)
  const userId = extractUserId(req)
  const pagination = parsePaginationParams(searchParams)
  const filters = parseFilterParams(searchParams)
  
  // Filter environment variables
  let filteredVars = envVarsStore.filter(envVar => envVar.createdBy === userId)
  
  if (filters.category) {
    filteredVars = filteredVars.filter(envVar => envVar.category === filters.category)
  }
  
  if (filters.search) {
    const searchLower = filters.search.toLowerCase()
    filteredVars = filteredVars.filter(envVar => 
      envVar.key.toLowerCase().includes(searchLower) ||
      envVar.description?.toLowerCase().includes(searchLower)
    )
  }
  
  // Apply pagination
  const total = filteredVars.length
  const totalPages = Math.ceil(total / pagination.limit)
  const offset = (pagination.page - 1) * pagination.limit
  const paginatedVars = filteredVars.slice(offset, offset + pagination.limit)
  
  // Remove secret values for non-secret variables (security)
  const sanitizedVars = paginatedVars.map(envVar => ({
    ...envVar,
    value: envVar.isSecret ? '***' : envVar.value
  }))
  
  return NextResponse.json(createSuccessResponse(sanitizedVars, {
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages
    },
    timestamp: new Date().toISOString(),
    requestId: `req_${Date.now()}`
  }))
})

// POST /api/env-vars - Create environment variable
export const POST = withErrorHandling(async (req: NextRequest) => {
  await mockDelay(150) // Simulate database write
  
  const userId = extractUserId(req)
  const body: EnvVarCreateRequest = await req.json()
  
  // Validate required fields
  validateRequired(body, ['key', 'value', 'category'])
  validateEnvVarKey(body.key)
  
  // Check for duplicate key
  const existingVar = envVarsStore.find(envVar => 
    envVar.key === body.key && envVar.createdBy === userId
  )
  
  if (existingVar) {
    throw new ApiError(
      'DUPLICATE_ENV_VAR',
      `Environment variable with key '${body.key}' already exists`,
      409
    )
  }
  
  // Validate category
  if (!['environment', 'secrets'].includes(body.category)) {
    throw new ApiError(
      'INVALID_CATEGORY',
      'Category must be either "environment" or "secrets"',
      400
    )
  }
  
  // Create new environment variable
  const newEnvVar: EnvVarResponse = {
    id: `env_${Date.now()}`,
    key: body.key,
    value: body.value,
    isSecret: body.isSecret || body.category === 'secrets',
    description: body.description,
    category: body.category,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: userId
  }
  
  envVarsStore.push(newEnvVar)
  
  // Return sanitized response
  const response = {
    ...newEnvVar,
    value: newEnvVar.isSecret ? '***' : newEnvVar.value
  }
  
  return NextResponse.json(createSuccessResponse(response), { status: 201 })
})