import { NextRequest, NextResponse } from 'next/server'
import { getTemplateOperations } from '@/lib/database-template-operations'
import { withZIPAuthorization } from '@/lib/auth/zip-middleware'

// PUT /api/zip/templates/[namespace]/[templateId] - Update template
export const PUT = withZIPAuthorization(async (
  request: NextRequest,
  context?: { params: { namespace: string; templateId: string } }
) => {
  try {
    if (!context || !context.params) {
      return NextResponse.json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing template parameters'
        }
      }, { status: 400 })
    }
    const { namespace, templateId } = context.params
    const body = await request.json()
    
    const globalId = `${namespace}/${templateId}`
    
    // Find existing template
    const templateOps = await getTemplateOperations()
    const existingTemplate = await templateOps.getTemplate(globalId)
    
    if (!existingTemplate) {
      return NextResponse.json({
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: `Template ${globalId} not found`,
        }
      }, { status: 404 })
    }
    
    // Update template
    await templateOps.updateTemplate(globalId, {
      ...existingTemplate,
      ...body,
      tags: [`namespace:${namespace}`, ...(body.runtime?.capabilities || [])],
      updatedBy: 'zip-integration',
      updatedAt: new Date(),
    })
    
    return NextResponse.json({
      success: true,
      template: {
        id: templateId,
        globalId,
        status: 'updated',
      },
    })
  } catch (error) {
    console.error('Error updating template:', error)
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update template',
        traceId: `trace_${Date.now()}`,
      }
    }, { status: 500 })
  }
}, {
  resourceType: 'template',
  action: 'update'
})

// DELETE /api/zip/templates/[namespace]/[templateId] - Delete template
export const DELETE = withZIPAuthorization(async (
  request: NextRequest,
  context?: { params: { namespace: string; templateId: string } }
) => {
  try {
    if (!context || !context.params) {
      return NextResponse.json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing template parameters'
        }
      }, { status: 400 })
    }
    const { namespace, templateId } = context.params
    const globalId = `${namespace}/${templateId}`
    
    const templateOps = await getTemplateOperations()
    await templateOps.deleteTemplate(globalId)
    
    return NextResponse.json({
      success: true,
      message: `Template ${globalId} deleted`,
    })
  } catch (error) {
    console.error('Error deleting template:', error)
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete template',
        traceId: `trace_${Date.now()}`,
      }
    }, { status: 500 })
  }
}, {
  resourceType: 'template',
  action: 'delete'
})