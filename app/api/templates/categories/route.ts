/**
 * API endpoint for template categories
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTemplateOperations } from '@/lib/database-template-operations'
import { SearchService } from '@/services/node-template-repository/search/search-service'
import { EmbeddingService } from '@/services/node-template-repository/search/embedding-service'

// Category metadata
const CATEGORY_METADATA: Record<string, { displayName: string; description: string; icon: string }> = {
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

// GET /api/templates/categories - Get category tree
export async function GET(request: NextRequest) {
  try {
    // Import the category operations to get from database
    const { getCategoryOperations } = await import('@/lib/database-category-operations')
    const categoryOps = await getCategoryOperations()
    
    // Get categories with counts from database
    const categoriesWithCounts = await categoryOps.getCategoriesWithCounts()
    
    // Format for API response
    const categories = categoriesWithCounts.map(cat => ({
      name: cat.name,
      displayName: cat.displayName,
      description: cat.description,
      icon: cat.icon,
      subcategories: cat.subcategories || [],
      totalNodes: cat.totalNodes,
      isActive: cat.isActive,
    }))

    return NextResponse.json({
      success: true,
      data: categories,
    })
  } catch (error) {
    console.error('Category tree error:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}
