/**
 * API endpoint for finding similar templates
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTemplateOperations } from '@/lib/database-template-operations'
import { SearchService } from '@/services/node-template-repository/search/search-service'
import { EmbeddingService } from '@/services/node-template-repository/search/embedding-service'
import { withAuth } from '@/lib/auth/middleware'

// GET /api/templates/similar/[id] - Get similar templates
export const GET = withAuth(async (request: NextRequest, context?: { params: any }) => {
  try {
    const searchParams = context?.params
    if (!searchParams || !searchParams.id) {
      return NextResponse.json({ error: 'Missing template ID' }, { status: 400 })
    }
    const limit = parseInt(searchParams.get('limit') || '10')

    const templateOps = await getTemplateOperations()
    const embeddingService = EmbeddingService.fromEnvironment()

    const searchService = new SearchService(templateOps, embeddingService)
    const similar = await searchService.getSimilarTemplates(searchParams.id, limit)

    return NextResponse.json({
      success: true,
      data: similar,
    })
  } catch (error) {
    console.error('Similar templates error:', error)
    return NextResponse.json({ error: 'Failed to find similar templates' }, { status: 500 })
  }
}, {
  resource: 'template',
  action: 'read'
})
