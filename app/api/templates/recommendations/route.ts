/**
 * API endpoint for template recommendations
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTemplateOperations } from '@/lib/database-template-operations'
import { SearchService } from '@/services/node-template-repository/search/search-service'
import { EmbeddingService } from '@/services/node-template-repository/search/embedding-service'

// POST /api/templates/recommendations - Get template recommendations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { recentlyUsed, workflowCategory, currentNodes } = body

    const templateOps = await getTemplateOperations()
    const embeddingService = EmbeddingService.fromEnvironment()

    const searchService = new SearchService(templateOps, embeddingService)
    const recommendations = await searchService.getRecommendations({
      recentlyUsed,
      workflowCategory,
      currentNodes,
    })

    return NextResponse.json({
      success: true,
      data: recommendations,
    })
  } catch (error) {
    console.error('Recommendations error:', error)
    return NextResponse.json({ error: 'Failed to get recommendations' }, { status: 500 })
  }
}
