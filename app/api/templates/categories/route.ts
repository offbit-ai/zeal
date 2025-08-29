/**
 * API endpoint for template categories
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTemplateOperations } from '@/lib/database-template-operations'
import { SearchService } from '@/services/node-template-repository/search/search-service'
import { EmbeddingService } from '@/services/node-template-repository/search/embedding-service'
import { withAuth } from '@/lib/auth/middleware'

// Category metadata
const CATEGORY_METADATA: Record<
  string,
  { displayName: string; description: string; icon: string }
> = {
  'data-sources': {
    displayName: 'Data Sources',
    description: 'Connect to databases, APIs, and external data sources',
    icon: 'database',
  },
  'ai-models': {
    displayName: 'AI Models',
    description: 'Integrate with AI and machine learning models',
    icon: 'brain',
  },
  'logic-control': {
    displayName: 'Logic & Control',
    description: 'Control flow, conditions, and logic operations',
    icon: 'git-branch',
  },
  'data-processing': {
    displayName: 'Data Processing',
    description: 'Transform, filter, and process data',
    icon: 'shuffle',
  },
  communication: {
    displayName: 'Communication',
    description: 'Send messages, notifications, and integrate with communication platforms',
    icon: 'message-square',
  },
  scripting: {
    displayName: 'Scripting',
    description: 'Custom scripts and code execution',
    icon: 'code',
  },
  'tools-utilities': {
    displayName: 'Tools & Utilities',
    description: 'General purpose tools and utilities',
    icon: 'wrench',
  },
  'storage-memory': {
    displayName: 'Storage & Memory',
    description: 'Store and retrieve data',
    icon: 'hard-drive',
  },
  'cloud-services': {
    displayName: 'Cloud Services',
    description: 'Integrate with cloud platforms and services',
    icon: 'cloud',
  },
  'graph-io': {
    displayName: 'Graph I/O',
    description: 'Input and output for subgraphs',
    icon: 'arrow-right-left',
  },
  inputs: {
    displayName: 'User Inputs',
    description: 'Capture user input and interactions',
    icon: 'text-cursor-input',
  },
  media: {
    displayName: 'Media',
    description: 'Process images, audio, and video',
    icon: 'image',
  },
}

// GET /api/templates/categories - Get all template categories with counts
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const templateOps = await getTemplateOperations()
    
    // Use listTemplates to get all templates for category analysis
    const allTemplates = await templateOps.listTemplates()
    
    // Count templates by category
    const categoryCounts: Record<string, number> = {}
    const categoryTemplates: Record<string, any[]> = {}
    
    allTemplates.forEach((template: any) => {
      const category = template.category || 'utilities'
      categoryCounts[category] = (categoryCounts[category] || 0) + 1
      
      if (!categoryTemplates[category]) {
        categoryTemplates[category] = []
      }
      categoryTemplates[category].push({
        id: template.id,
        title: template.title,
        description: template.description,
        icon: template.icon,
        tags: template.tags,
        isActive: template.isActive,
      })
    })
    
    // Build response with metadata
    const categories = Object.entries(CATEGORY_METADATA).map(([key, metadata]) => ({
      id: key,
      displayName: metadata.displayName,
      description: metadata.description,
      icon: metadata.icon,
      count: categoryCounts[key] || 0,
      templates: categoryTemplates[key] || [],
    }))
    
    // Add any categories that exist in templates but not in metadata
    Object.keys(categoryCounts).forEach(categoryKey => {
      if (!CATEGORY_METADATA[categoryKey]) {
        categories.push({
          id: categoryKey,
          displayName: categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1).replace('-', ' '),
          description: `Templates in ${categoryKey} category`,
          icon: 'folder',
          count: categoryCounts[categoryKey],
          templates: categoryTemplates[categoryKey] || [],
        })
      }
    })
    
    return NextResponse.json({
      success: true,
      data: {
        categories: categories.sort((a, b) => b.count - a.count),
        totalTemplates: allTemplates.length,
        totalCategories: categories.length,
      },
    })
  } catch (error) {
    console.error('Error fetching template categories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch template categories' },
      { status: 500 }
    )
  }
}, {
  resource: 'template',
  action: 'read'
})

// POST /api/templates/categories - Get templates by category with search/filter
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { 
      category, 
      search, 
      limit = 50, 
      offset = 0,
      tags = [],
      sortBy = 'relevance' 
    } = body
    
    const templateOps = await getTemplateOperations()
    
    // Use the robust search mechanism
    if (search && search.trim()) {
      // Use searchTemplates for query-based search
      const searchResults = await templateOps.searchTemplates({
        query: search,
        category: category && category !== 'all' ? category : undefined,
        tags: tags.length > 0 ? tags : undefined,
        limit,
        offset,
        includeDeprecated: false
      })
      
      const templates = searchResults.map(result => ({
        ...result.template,
        score: result.score,
        highlights: result.highlights
      }))
      
      return NextResponse.json({
        success: true,
        data: {
          templates,
          pagination: {
            total: templates.length,
            limit,
            offset,
            hasMore: false, // Search results are already limited
          },
          filters: {
            category,
            search,
            tags,
            sortBy,
          },
          isSemanticSearch: true,
        },
      })
    }
    
    // Use listTemplates for category/tag filtering without search
    let templates = await templateOps.listTemplates({
      category: category && category !== 'all' ? category : undefined,
      includeDeprecated: false
    })
    
    // Filter by category if specified
    if (category && category !== 'all') {
      templates = templates.filter((template: any) => 
        (template.category || 'utilities') === category
      )
    }
    
    // Filter by tags if specified
    if (tags.length > 0) {
      templates = templates.filter((template: any) =>
        tags.some((tag: string) => 
          template.tags?.some((templateTag: string) => 
            templateTag.toLowerCase().includes(tag.toLowerCase())
          )
        )
      )
    }
    
    // Search filter
    if (search && search.trim()) {
      const searchLower = search.toLowerCase()
      templates = templates.filter((template: any) =>
        template.title.toLowerCase().includes(searchLower) ||
        template.description.toLowerCase().includes(searchLower) ||
        template.tags?.some((tag: string) => tag.toLowerCase().includes(searchLower))
      )
    }
    
    // Sort templates
    if (sortBy === 'name') {
      templates.sort((a: any, b: any) => a.title.localeCompare(b.title))
    } else if (sortBy === 'recent') {
      templates.sort((a: any, b: any) => 
        new Date(b.updatedAt || b.createdAt).getTime() - 
        new Date(a.updatedAt || a.createdAt).getTime()
      )
    }
    // Default 'relevance' keeps original order
    
    // Apply pagination
    const total = templates.length
    const paginatedTemplates = templates.slice(offset, offset + limit)
    
    return NextResponse.json({
      success: true,
      data: {
        templates: paginatedTemplates,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
        filters: {
          category,
          search,
          tags,
          sortBy,
        },
      },
    })
  } catch (error) {
    console.error('Error filtering template categories:', error)
    return NextResponse.json(
      { error: 'Failed to filter templates' },
      { status: 500 }
    )
  }
}, {
  resource: 'template',
  action: 'read'
})