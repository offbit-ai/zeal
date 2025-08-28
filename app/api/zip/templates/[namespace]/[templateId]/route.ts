import { NextRequest, NextResponse } from 'next/server'
import { getTemplateOperations } from '@/lib/database-template-operations'

// PUT /api/zip/templates/[namespace]/[templateId] - Update template
export async function PUT(
  request: NextRequest,
  { params }: { params: { namespace: string; templateId: string } }
) {
  try {
    const { namespace, templateId } = params
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
}

// DELETE /api/zip/templates/[namespace]/[templateId] - Delete template
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { namespace: string; templateId: string } }
) {
  try {
    const { namespace, templateId } = params
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
}