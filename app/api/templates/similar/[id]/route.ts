/**
 * API endpoint for finding similar templates
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTemplateOperations } from '@/lib/database-template-operations'
import { SearchService } from '@/services/node-template-repository/search/search-service'
import { EmbeddingService } from '@/services/node-template-repository/search/embedding-service'

// GET /api/templates/similar/[id] - Get similar templates
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '10')

    const templateOps = await getTemplateOperations()
    const embeddingService = EmbeddingService.fromEnvironment()

    const searchService = new SearchService(templateOps, embeddingService)
    const similar = await searchService.getSimilarTemplates(params.id, limit)

    return NextResponse.json({
      success: true,
      data: similar,
    })
  } catch (error) {
    console.error('Similar templates error:', error)
    return NextResponse.json({ error: 'Failed to find similar templates' }, { status: 500 })
  }
}
