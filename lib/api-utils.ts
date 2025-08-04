import { NextRequest, NextResponse } from 'next/server'
import { ApiResponse, ApiError } from '@/types/api'

// Generate unique request ID
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Create successful API response
export function createSuccessResponse<T>(data: T, meta?: ApiResponse<T>['meta']): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
      ...meta,
    },
  }
}

// Create error API response
export function createErrorResponse(error: ApiError | Error, requestId?: string): ApiResponse {
  const isApiError = error instanceof ApiError

  return {
    success: false,
    error: {
      code: isApiError ? error.code : 'INTERNAL_SERVER_ERROR',
      message: error.message,
      details: isApiError ? error.details : undefined,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: requestId || generateRequestId(),
    },
  }
}

// API route wrapper with error handling
export function withErrorHandling<T = any>(
  handler: (req: NextRequest, context?: T) => Promise<NextResponse>
) {
  return async (req: NextRequest, context?: T): Promise<NextResponse> => {
    try {
      return await handler(req, context)
    } catch (error: any) {
      // Handle connection reset errors gracefully
      if (error.code === 'ECONNRESET' || error.message === 'aborted') {
        console.log('Request aborted by client')
        return new NextResponse(null, { status: 499 }) // Client Closed Request
      }

      console.error('API Error:', error)

      if (error instanceof ApiError) {
        return NextResponse.json(createErrorResponse(error), { status: error.statusCode })
      }

      // Unknown error
      const apiError = new ApiError('INTERNAL_SERVER_ERROR', 'An unexpected error occurred', 500)

      return NextResponse.json(createErrorResponse(apiError), { status: 500 })
    }
  }
}

// Validation helper
export function validateRequired(obj: any, fields: string[]): void {
  const missing = fields.filter(field => {
    const value = obj[field]
    return value === undefined || value === null || value === ''
  })

  if (missing.length > 0) {
    throw new ApiError('VALIDATION_ERROR', `Required fields missing: ${missing.join(', ')}`, 400, {
      missingFields: missing,
    })
  }
}

// Parse pagination parameters
export function parsePaginationParams(searchParams: URLSearchParams) {
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
  const sortBy = searchParams.get('sortBy') || 'createdAt'
  const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

  return { page, limit, sortBy, sortOrder }
}

// Parse filter parameters
export function parseFilterParams(searchParams: URLSearchParams) {
  return {
    search: searchParams.get('search') || undefined,
    category: searchParams.get('category') || undefined,
    subcategory: searchParams.get('subcategory') || undefined,
    tags: searchParams.get('tags') || undefined,
    status: searchParams.get('status') || undefined,
    dateFrom: searchParams.get('dateFrom') || undefined,
    dateTo: searchParams.get('dateTo') || undefined,
  }
}

// Mock database delay (simulate network latency)
export function mockDelay(ms: number = 100): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Simulate microservice call
export async function callMicroservice<T>(
  service: string,
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: any
): Promise<T> {
  // In real implementation, this would make HTTP calls to microservices through a gateway
  // [MOCK] log removed

  // Simulate network delay
  await mockDelay(50)

  // For now, throw an error to indicate this is not implemented
  throw new ApiError(
    'MICROSERVICE_NOT_IMPLEMENTED',
    `Microservice call to ${service}/${endpoint} not implemented yet`,
    501
  )
}

// CORS helper
export function setCorsHeaders(response: NextResponse): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return response
}

// Rate limiting helper (basic implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(identifier)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (record.count >= maxRequests) {
    return false
  }

  record.count++
  return true
}

// Extract user ID (mock implementation - no auth required for now)
export function extractUserId(_request: NextRequest): string {
  // For now, return a default user ID since we don't require authentication
  // In real implementation, this would validate JWT and extract user ID
  return 'user_default'
}

// Environment variable validation
export function validateEnvVarKey(key: string): void {
  if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
    throw new ApiError(
      'INVALID_ENV_VAR_KEY',
      'Environment variable key must start with uppercase letter and contain only uppercase letters, numbers, and underscores',
      400
    )
  }
}

// Workflow validation helpers
export function validateWorkflowNodes(nodes: any[]): void {
  if (!Array.isArray(nodes)) {
    throw new ApiError('VALIDATION_ERROR', 'Nodes must be an array', 400)
  }

  const nodeIds = new Set<string>()

  for (const node of nodes) {
    if (!node.id || typeof node.id !== 'string') {
      throw new ApiError('VALIDATION_ERROR', 'Each node must have a valid string ID', 400)
    }

    if (nodeIds.has(node.id)) {
      throw new ApiError('VALIDATION_ERROR', `Duplicate node ID: ${node.id}`, 400)
    }

    nodeIds.add(node.id)
  }
}

export function validateWorkflowConnections(connections: any[], nodeIds: Set<string>): void {
  if (!Array.isArray(connections)) {
    throw new ApiError('VALIDATION_ERROR', 'Connections must be an array', 400)
  }

  for (const connection of connections) {
    // Handle both old format (sourceNodeId/targetNodeId) and new format (source.nodeId/target.nodeId)
    const sourceNodeId = connection.sourceNodeId || connection.source?.nodeId
    const targetNodeId = connection.targetNodeId || connection.target?.nodeId

    if (!sourceNodeId || !nodeIds.has(sourceNodeId)) {
      throw new ApiError('VALIDATION_ERROR', `Invalid source node ID: ${sourceNodeId}`, 400)
    }

    if (!targetNodeId || !nodeIds.has(targetNodeId)) {
      throw new ApiError('VALIDATION_ERROR', `Invalid target node ID: ${targetNodeId}`, 400)
    }
  }
}
