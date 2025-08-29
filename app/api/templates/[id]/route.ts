/**
 * REST API endpoints for individual template operations
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTemplateOperations } from '@/lib/database-template-operations'
import { validateTenantAccess, createTenantViolationError } from '@/lib/auth/tenant-utils'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'

// GET /api/templates/[id] - Get a specific template
export const GET = withAuth(async (request: NextRequest, context?: { params: { id: string } }) => {
  try {
    if (!context || !context.params) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const { id } = context.params
    const templateOps = await getTemplateOperations()

    const template = await templateOps.getTemplate(id)

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Get repository data for additional metadata
    const repository = await templateOps.getRepository(id)

    return NextResponse.json({
      success: true,
      data: {
        ...template,
        metadata: repository
          ? {
              capabilities: repository.capabilities,
              inputTypes: repository.inputTypes,
              outputTypes: repository.outputTypes,
              useCases: repository.useCases,
              stats: repository.stats,
              relatedTemplates: repository.relationships,
            }
          : null,
      },
    })
  } catch (error) {
    console.error('Template fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 })
  }
}, {
  resource: 'template',
  action: 'read'
})

// PUT /api/templates/[id] - Update a template
export const PUT = withAuth(async (request: NextRequest, context?: { params: { id: string } }) => {
  try {
    if (!context || !context.params) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const { id } = context.params
    const body = await request.json()
    const templateOps = await getTemplateOperations()

    // Check if template exists
    const existing = await templateOps.getTemplate(id)
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Check tenant access
    if (!validateTenantAccess(existing, request as NextRequest)) {
      return createTenantViolationError()
    }

    // Update template
    const updated = await templateOps.updateTemplate(id, {
      ...body,
      updatedBy: 'api', // TODO: Get from auth
      updatedAt: new Date(),
    })

    // Re-generate embeddings if content changed
    if (body.title || body.description || body.ports || body.properties) {
      const { EmbeddingService } = await import(
        '@/services/node-template-repository/search/embedding-service'
      )
      const { MetadataExtractor } = await import(
        '@/services/node-template-repository/ingestion/metadata-extractor'
      )

      const embeddingService = EmbeddingService.fromEnvironment()

      const metadataExtractor = new MetadataExtractor()

      const embeddings = await embeddingService.generateEmbeddings(updated)
      const metadata = await metadataExtractor.extractMetadata(updated)

      await templateOps.upsertRepository({
        template: updated,
        embeddings,
        metadata,
        source: updated.source,
      })
    }

    return NextResponse.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    console.error('Template update error:', error)
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
  }
}, {
  resource: 'template',
  action: 'update'
})

// DELETE /api/templates/[id] - Delete a template
export const DELETE = withAuth(async (request: AuthenticatedRequest, context?: { params: { id: string } }) => {
  try {
    if (!context || !context.params) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const { id } = context.params
    const templateOps = await getTemplateOperations()

    // Check if template exists
    const existing = await templateOps.getTemplate(id)
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Check tenant access
    if (!validateTenantAccess(existing, request as NextRequest)) {
      return createTenantViolationError()
    }

    // Authorization is handled by withAuth middleware based on policy

    // Delete template (this will cascade to repository)
    await templateOps.deleteTemplate(id)

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully',
    })
  } catch (error) {
    console.error('Template deletion error:', error)
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
  }
}, {
  resource: 'template',
  action: 'delete'
})
