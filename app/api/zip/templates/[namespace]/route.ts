import { NextRequest, NextResponse } from 'next/server'
import { nodeTemplateService } from '@/services/nodeTemplateService'

// GET /api/zip/templates/[namespace] - List templates in namespace
export async function GET(
  request: NextRequest,
  { params }: { params: { namespace: string } }
) {
  try {
    const { namespace } = params
    
    // Search for templates with namespace tag
    const result = await nodeTemplateService.searchTemplates({
      tags: [`namespace:${namespace}`],
      limit: 1000, // Get all templates in namespace
      useRepository: true,
    })
    
    // Transform to ZIP format
    const templates = result.templates.map((template: any) => ({
      id: template.id.replace(`${namespace}/`, ''),
      globalId: template.id,
      type: template.type,
      title: template.title,
      subtitle: template.subtitle,
      category: template.category,
      subcategory: template.subcategory,
      description: template.description,
      icon: template.icon,
      variant: template.variant,
      shape: template.shape,
      size: template.size,
      ports: [
        ...(template.inputs || []).map((input: any) => ({
          id: input.id,
          label: input.label,
          type: 'input',
          position: input.position,
          dataType: input.description,
          required: input.required,
          multiple: input.multiple,
        })),
        ...(template.outputs || []).map((output: any) => ({
          id: output.id,
          label: output.label,
          type: 'output',
          position: output.position,
          dataType: output.description,
          multiple: output.multiple,
        })),
      ],
      properties: template.properties,
      propertyRules: template.propertyRules,
      runtime: template.metadata?.runtime,
    }))
    
    return NextResponse.json({
      namespace,
      templates,
      count: templates.length,
    })
  } catch (error) {
    console.error('Error listing namespace templates:', error)
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list templates',
        traceId: `trace_${Date.now()}`,
      }
    }, { status: 500 })
  }
}