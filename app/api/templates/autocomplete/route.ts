/**
 * API endpoint for template search autocomplete
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTemplateOperations } from '@/lib/database-template-operations'
import { SearchService } from '@/services/node-template-repository/search/search-service'
import { EmbeddingService } from '@/services/node-template-repository/search/embedding-service'
import { withAuth } from '@/lib/auth/middleware'

// GET /api/templates/autocomplete - Get autocomplete suggestions
export const GET = withAuth(async (request: NextRequest, context?: { params: any }) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''
    const limit = parseInt(searchParams.get('limit') || '10')

    if (query.length < 2) {
      return NextResponse.json({
        success: true,
        data: [],
      })
    }

    const templateOps = await getTemplateOperations()
    const embeddingService = EmbeddingService.fromEnvironment()

    const searchService = new SearchService(templateOps, embeddingService)
    const suggestions = await searchService.getAutocompleteSuggestions(query, limit)

    return NextResponse.json({
      success: true,
      data: suggestions,
    })
  } catch (error) {
    console.error('Autocomplete error:', error)
    return NextResponse.json({ error: 'Failed to get suggestions' }, { status: 500 })
  }
}, {
  resource: 'template',
  action: 'read'
})
