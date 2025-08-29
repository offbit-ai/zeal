import { NextRequest, NextResponse } from 'next/server'
import { createSuccessResponse, withErrorHandling, extractUserId } from '@/lib/api-utils'
import { ApiError } from '@/types/api'
import { apiCache, CACHE_TTL, invalidateCache } from '@/lib/api-cache'
import { nodeTemplateService } from '@/services/nodeTemplateService'
import { getCategoryOperations } from '@/lib/database-category-operations'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'
import { addTenantContext } from '@/lib/auth/tenant-utils'

interface NodeCategoryResponse {
  name: string
  displayName: string
  description: string
  icon: string
  subcategories: {
    name: string
    displayName: string
    description: string
    nodeCount: number
  }[]
  totalNodes: number
  isActive: boolean
}

// GET /api/nodes/categories - List node categories
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

  const includeSubcategories = searchParams.get('include_subcategories') !== 'false'
  const includeInactive = searchParams.get('include_inactive') === 'true'

  // Get categories from the template service
  const categories = await nodeTemplateService.getCategories()

  // Filter and format categories
  let filteredCategories: NodeCategoryResponse[] = categories
    .filter((category: any) => includeInactive || category.isActive)
    .map((category: any) => ({
      name: category.name,
      displayName: category.displayName,
      description: category.description,
      icon: category.icon,
      subcategories: includeSubcategories ? category.subcategories : [],
      totalNodes: category.totalNodes,
      isActive: category.isActive,
    }))

  const response = createSuccessResponse(filteredCategories, {
    timestamp: new Date().toISOString(),
    requestId: `req_${Date.now()}`,
  })

  // Cache the response
  apiCache.set(cacheKey, response, CACHE_TTL.CATEGORIES)

  return NextResponse.json(response)
  }),
  {
    resource: 'nodes',
    action: 'read'
  }
)

// POST /api/nodes/categories - Create new category
export const POST = withAuth(
  withErrorHandling(async (req: AuthenticatedRequest) => {

  const userId = req.auth?.subject?.id || extractUserId(req)
  const body = await req.json()

  // Validate required fields
  if (!body.name || !body.displayName) {
    throw new ApiError('VALIDATION_ERROR', 'name and displayName are required', 400)
  }

  try {
    const categoryOps = await getCategoryOperations()

    // Check for duplicate category name
    const existingCategory = await categoryOps.getCategoryByName(body.name)
    if (existingCategory) {
      throw new ApiError(
        'DUPLICATE_CATEGORY_NAME',
        `Category with name '${body.name}' already exists`,
        409
      )
    }

    // Create new category with tenant context
    const categoryData = addTenantContext({
      name: body.name,
      displayName: body.displayName,
      description: body.description || '',
      icon: body.icon || 'folder',
      isActive: body.isActive !== false,
      sortOrder: body.sortOrder,
      createdBy: userId,
      updatedBy: userId,
    }, req as NextRequest)
    
    const createdCategory = await categoryOps.createCategory(categoryData)

    // Create subcategories if provided
    const subcategoriesWithCounts = []
    if (body.subcategories && Array.isArray(body.subcategories) && createdCategory.id) {
      for (let i = 0; i < body.subcategories.length; i++) {
        const subcat = body.subcategories[i]
        const createdSubcat = await categoryOps.createSubcategory(createdCategory.id, {
          name: subcat.name,
          displayName: subcat.displayName,
          description: subcat.description || '',
          sortOrder: i,
        })
        subcategoriesWithCounts.push({
          ...createdSubcat,
          nodeCount: 0,
        })
      }
    }

    // Format response
    const newCategory: NodeCategoryResponse = {
      name: createdCategory.name,
      displayName: createdCategory.displayName,
      description: createdCategory.description,
      icon: createdCategory.icon,
      subcategories: subcategoriesWithCounts,
      totalNodes: 0,
      isActive: createdCategory.isActive,
    }

    // Invalidate all categories cache since this affects all users
    invalidateCache('/api/nodes/categories')

    return NextResponse.json(createSuccessResponse(newCategory), { status: 201 })
  } catch (error) {
    console.error('Failed to create category:', error)
    if (error instanceof ApiError) throw error
    throw new ApiError('INTERNAL_ERROR', 'Failed to create category', 500)
  }
  }),
  {
    resource: 'nodes',
    action: 'create'
  }
)
