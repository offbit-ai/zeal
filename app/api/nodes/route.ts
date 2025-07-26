import { NextRequest, NextResponse } from 'next/server'
import { 
  createSuccessResponse, 
  withErrorHandling, 
  parsePaginationParams,
  parseFilterParams,
  extractUserId,
  mockDelay
} from '@/lib/api-utils'
import { ApiError } from '@/types/api'
import { allNodeTemplates } from '@/data/nodeTemplates'

interface NodeTemplateResponse {
  id: string
  type: string
  title: string
  subtitle: string
  category: string
  subcategory?: string
  description: string
  icon: string
  variant?: string
  shape?: string
  size?: string
  ports?: Array<{
    id: string
    label: string
    type: 'input' | 'output'
    position: string
  }>
  properties: Record<string, any>
  requiredEnvVars?: string[]
  tags: string[]
  version: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  propertyRules?: {
    triggers: string[]
    rules: Array<{
      when: string
      updates: Record<string, any>
    }>
  }
}

// Initialize node templates from modules with proper timestamps
const nodeTemplatesStore: NodeTemplateResponse[] = allNodeTemplates.map((template: any, index: number) => ({
  // Map JSON structure to API structure
  id: template.id,
  type: template.type,
  title: template.title,
  subtitle: template.subtitle,
  category: template.category,
  subcategory: template.subcategory,
  description: template.description,
  icon: template.icon,
  variant: template.variant,
  shape: template.shape,
  size: template.size,
  ports: template.ports,
  properties: template.properties,
  requiredEnvVars: template.requiredEnvVars,
  tags: template.tags,
  version: template.version || '1.0.0',
  isActive: template.isActive !== false, // Default to true unless explicitly false
  createdAt: template.createdAt || new Date(Date.now() - 86400000 * (30 - index)).toISOString(),
  updatedAt: template.updatedAt || new Date().toISOString(),
  ...(template.propertyRules ? { propertyRules: template.propertyRules } : {})
}))

// GET /api/nodes - List node templates
export const GET = withErrorHandling(async (req: NextRequest) => {
  await mockDelay(100)
  
  const { searchParams } = new URL(req.url)
  const _userId = extractUserId(req) // Prefix with _ to indicate intentionally unused
  const pagination = parsePaginationParams(searchParams)
  const filters = parseFilterParams(searchParams)
  
  // Get all node templates from JSON data (no isActive filter)
  let filteredNodes = [...nodeTemplatesStore]
  
  if (filters.category) {
    filteredNodes = filteredNodes.filter(node => 
      node.category.toLowerCase() === filters.category.toLowerCase()
    )
  }
  
  if (filters.subcategory) {
    filteredNodes = filteredNodes.filter(node => 
      node.subcategory?.toLowerCase() === filters.subcategory.toLowerCase()
    )
  }
  
  if (filters.search) {
    const searchLower = filters.search.toLowerCase()
    filteredNodes = filteredNodes.filter(node => 
      node.title.toLowerCase().includes(searchLower) ||
      node.description.toLowerCase().includes(searchLower) ||
      node.tags.some(tag => tag.toLowerCase().includes(searchLower))
    )
  }
  
  if (filters.tags) {
    const filterTags = Array.isArray(filters.tags) ? filters.tags : [filters.tags]
    filteredNodes = filteredNodes.filter(node => 
      filterTags.some(tag => node.tags.includes(tag))
    )
  }
  
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
  
  return NextResponse.json(createSuccessResponse(paginatedNodes, {
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

// POST /api/nodes - Create custom node template (admin only)
export const POST = withErrorHandling(async (req: NextRequest) => {
  await mockDelay(200)
  
  const userId = extractUserId(req)
  const body = await req.json()
  
  // In real implementation, check if user has admin permissions
  // For now, simulate admin check
  if (!userId.startsWith('admin_')) {
    throw new ApiError('FORBIDDEN', 'Only administrators can create node templates', 403)
  }
  
  // Validate required fields
  if (!body.type || !body.title || !body.category) {
    throw new ApiError('VALIDATION_ERROR', 'type, title, and category are required', 400)
  }
  
  // Check for duplicate type
  const existingNode = nodeTemplatesStore.find(node => node.type === body.type)
  if (existingNode) {
    throw new ApiError(
      'DUPLICATE_NODE_TYPE',
      `Node template with type '${body.type}' already exists`,
      409
    )
  }
  
  // Create new node template
  const newNodeTemplate: NodeTemplateResponse = {
    id: `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  
  nodeTemplatesStore.push(newNodeTemplate)
  
  return NextResponse.json(createSuccessResponse(newNodeTemplate), { status: 201 })
})