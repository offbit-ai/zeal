/**
 * REST API endpoints for Node Template Repository
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTemplateOperations } from '@/lib/database-template-operations'
import { SearchService } from '@/services/node-template-repository/search/search-service'
import { EmbeddingService } from '@/services/node-template-repository/search/embedding-service'
import type { SearchQuery } from '@/services/node-template-repository/core/models'

// Initialize services
let searchService: SearchService | null = null

async function getSearchService() {
  if (!searchService) {
    const templateOps = await getTemplateOperations()
    const embeddingService = EmbeddingService.fromEnvironment()

    searchService = new SearchService(templateOps, embeddingService)
  }
  return searchService
}

// GET /api/templates - Search templates
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || searchParams.get('query') || ''
    const category = searchParams.get('category')
    const subcategory = searchParams.get('subcategory')
    const tags = searchParams.get('tags')?.split(',').filter(Boolean)
    const capabilities = searchParams.get('capabilities')?.split(',').filter(Boolean)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const includeDeprecated = searchParams.get('includeDeprecated') === 'true'

    const service = await getSearchService()

    // Build search query
    const searchQuery: SearchQuery = {
      query,
      category: category || undefined,
      subcategory: subcategory || undefined,
      tags,
      capabilities,
      limit,
      offset,
      includeDeprecated,
    }

    // Perform search
    const results = await service.search(searchQuery)

    // Extract templates from search results
    const templates = results.map(result => result.template)

    return NextResponse.json({
      success: true,
      data: templates,
      pagination: {
        limit,
        offset,
        total: templates.length,
      },
    })
  } catch (error) {
    console.error('Template search error:', error)
    return NextResponse.json({ error: 'Failed to search templates' }, { status: 500 })
  }
}

// POST /api/templates - Create a new template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.title || !body.category) {
      return NextResponse.json({ error: 'Title and category are required' }, { status: 400 })
    }

    const templateOps = await getTemplateOperations()

    // Create template with defaults
    const template = {
      id: body.id || `tpl_custom_${Date.now()}`,
      version: body.version || '1.0.0',
      status: body.status || 'active',
      title: body.title,
      subtitle: body.subtitle,
      description: body.description || '',
      category: body.category,
      subcategory: body.subcategory,
      tags: body.tags || [],
      icon: body.icon || 'box',
      variant: body.variant,
      shape: body.shape || 'rectangle',
      size: body.size || 'medium',
      ports: body.ports || [],
      properties: body.properties || {},
      propertyRules: body.propertyRules,
      requiredEnvVars: body.requiredEnvVars,
      dependencies: body.dependencies,
      source: {
        type: 'manual' as const,
        location: 'api',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'api', // TODO: Get from auth
      updatedBy: 'api',
      isActive: true,
    }

    const created = await templateOps.createTemplate(template)

    // Generate embeddings and store in repository
    const embeddingService = EmbeddingService.fromEnvironment()

    const embeddings = await embeddingService.generateEmbeddings(created)

    // Extract metadata (simplified for now)
    const metadata = {
      capabilities: [],
      inputTypes: [],
      outputTypes: [],
      useCases: [],
      keywords: [],
    }

    await templateOps.upsertRepository({
      template: created,
      embeddings,
      metadata,
      source: template.source,
    })

    return NextResponse.json(
      {
        success: true,
        data: created,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Template creation error:', error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}
