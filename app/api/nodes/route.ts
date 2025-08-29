import { NextRequest, NextResponse } from 'next/server'
import {
  createSuccessResponse,
  withErrorHandling,
  parsePaginationParams,
  parseFilterParams,
  extractUserId,
} from '@/lib/api-utils'
import { ApiError } from '@/types/api'
import { apiCache, CACHE_TTL, invalidateCache } from '@/lib/api-cache'
import { nodeTemplateService } from '@/services/nodeTemplateService'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'
import { buildTenantQuery, addTenantContext } from '@/lib/auth/tenant-utils'

// GET /api/nodes - List node templates
export const GET = withAuth(
  withErrorHandling(async (req: AuthenticatedRequest) => {
  // Generate cache key
  const cacheKey = apiCache.generateKey(req)

  // Check cache first
  const cachedResponse = apiCache.get(cacheKey)
  if (cachedResponse) {
    return NextResponse.json(cachedResponse)
  }


  const { searchParams } = new URL(req.url)
  const userId = req.auth?.subject?.id || extractUserId(req)
  const tenantQuery = buildTenantQuery(req as NextRequest)
  const pagination = parsePaginationParams(searchParams)
  const filters = parseFilterParams(searchParams)

  // Use the new template service with tenant context
  const searchResult = await nodeTemplateService.searchTemplates({
    query: filters.search,
    category: filters.category,
    subcategory: filters.subcategory,
    tags: filters.tags ? (Array.isArray(filters.tags) ? filters.tags : [filters.tags]) : undefined,
    useRepository: searchParams.get('useRepository') === 'true',
    limit: 1000, // Get all for client-side pagination
    ...tenantQuery,
  })

  let filteredNodes = searchResult.templates

  // Sort nodes
  filteredNodes.sort((a, b) => {
    if (pagination.sortBy === 'title') {
      return pagination.sortOrder === 'asc'
        ? a.title.localeCompare(b.title)
        : b.title.localeCompare(a.title)
    }
    if (pagination.sortBy === 'category') {
      return pagination.sortOrder === 'asc'
        ? a.category.localeCompare(b.category)
        : b.category.localeCompare(a.category)
    }
    // Default sort by updatedAt
    return pagination.sortOrder === 'asc'
      ? new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
      : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  // Apply pagination
  const total = filteredNodes.length
  const totalPages = Math.ceil(total / pagination.limit)
  const offset = (pagination.page - 1) * pagination.limit
  const paginatedNodes = filteredNodes.slice(offset, offset + pagination.limit)

  const response = createSuccessResponse(paginatedNodes, {
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages,
    },
    ...(searchResult.isSemanticSearch
      ? {
          searchMetadata: {
            provider: 'template-repository',
            query: filters.search,
          },
        }
      : {}),
    timestamp: new Date().toISOString(),
    requestId: `req_${Date.now()}`,
  })

  // Cache the response
  apiCache.set(cacheKey, response, CACHE_TTL.NODES)

  return NextResponse.json(response)
  }),
  {
    resource: 'nodes',
    action: 'read'
  }
)

// POST /api/nodes - Create custom node template
export const POST = withAuth(
  withErrorHandling(async (req: AuthenticatedRequest) => {
    const userId = req.auth?.subject?.id || extractUserId(req)
  const body = await req.json()

  // Validate required fields
  if (!body.type || !body.title || !body.category) {
    throw new ApiError('VALIDATION_ERROR', 'type, title, and category are required', 400)
  }

  // Check for duplicate ID
  const existingNode = await nodeTemplateService.getTemplateById(body.id || body.type)
  if (existingNode) {
    throw new ApiError(
      'DUPLICATE_NODE_TYPE',
      `Node template with id '${body.id || body.type}' already exists`,
      409
    )
  }

  // Add tenant context to template data
  const templateData = addTenantContext({
    id: body.id || `tpl_custom_${Date.now()}`,
    type: body.type,
    title: body.title,
    subtitle: body.subtitle || '',
    category: body.category,
    subcategory: body.subcategory,
    description: body.description || '',
    icon: body.icon || 'box',
    properties: body.properties || {},
    requiredEnvVars: body.requiredEnvVars || [],
    tags: body.tags || [],
    version: body.version || '1.0.0',
    variant: body.variant,
    shape: body.shape || 'rectangle',
    size: body.size || 'medium',
    ports: body.ports || [],
    propertyRules: body.propertyRules,
    createdBy: userId,
    // Mark as pending approval for non-admin users
    status: userId.startsWith('admin_') ? 'active' : 'draft',
  }, req as NextRequest)

  // Save the template to the database
  const createdTemplate = await nodeTemplateService.createTemplate(templateData)

  // Invalidate all nodes cache since this affects all users
  invalidateCache('/api/nodes')

  return NextResponse.json(createSuccessResponse(createdTemplate), { status: 201 })
  }),
  {
    resource: 'nodes',
    action: 'create'
  }
)
