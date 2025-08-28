import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTemplateOperations } from '@/lib/database-template-operations'
import { RegisterTemplatesResponse } from '@/types/zip'

// Template validation schema
const nodeTemplateSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  category: z.string(),
  subcategory: z.string().optional(),
  description: z.string(),
  icon: z.string(),
  variant: z.string().optional(),
  shape: z.enum(['rectangle', 'circle', 'diamond']).optional(),
  size: z.enum(['small', 'medium', 'large']).optional(),
  
  ports: z.array(z.object({
    id: z.string(),
    label: z.string(),
    type: z.enum(['input', 'output']),
    position: z.enum(['left', 'right', 'top', 'bottom']),
    dataType: z.string().optional(),
    required: z.boolean().optional(),
    multiple: z.boolean().optional(),
  })),
  
  properties: z.record(z.object({
    type: z.enum(['string', 'number', 'boolean', 'select', 'code-editor']),
    label: z.string().optional(),
    description: z.string().optional(),
    defaultValue: z.any().optional(),
    options: z.array(z.any()).optional(),
    validation: z.object({
      required: z.boolean().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
    }).optional(),
  })).optional(),
  
  propertyRules: z.object({
    triggers: z.array(z.string()),
    rules: z.array(z.object({
      when: z.string(),
      updates: z.record(z.any()),
    })),
  }).optional(),
  
  runtime: z.object({
    executor: z.string(),
    version: z.string().optional(),
    requiredEnvVars: z.array(z.string()).optional(),
    capabilities: z.array(z.string()).optional(),
  }).optional(),
})

const registerTemplatesSchema = z.object({
  namespace: z.string(),
  templates: z.array(nodeTemplateSchema),
  webhookUrl: z.string().optional(),
})

// POST /api/zip/templates/register
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request
    const validation = registerTemplatesSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request format',
          details: validation.error.errors,
        }
      }, { status: 400 })
    }
    
    const { namespace, templates, webhookUrl } = validation.data
    const templateOps = await getTemplateOperations()
    const response: RegisterTemplatesResponse = {
      registered: 0,
      templates: [],
    }
    
    // Process each template
    for (const template of templates) {
      try {
        // Convert ZIP template format to internal format
        const internalTemplate = {
          id: `${namespace}/${template.id}`,
          type: template.type,
          title: template.title,
          subtitle: template.subtitle || '',
          description: template.description,
          category: template.category,
          subcategory: template.subcategory || '',
          icon: template.icon,
          variant: template.variant || 'gray-700',
          shape: template.shape || 'rectangle',
          size: template.size || 'medium',
          inputs: template.ports
            .filter(p => p.type === 'input')
            .map(p => ({
              id: p.id,
              label: p.label,
              position: p.position,
              description: p.dataType || '',
              required: p.required || false,
              multiple: p.multiple || false,
            })),
          outputs: template.ports
            .filter(p => p.type === 'output')
            .map(p => ({
              id: p.id,
              label: p.label,
              position: p.position,
              description: p.dataType || '',
              multiple: p.multiple || false,
            })),
          properties: template.properties || {},
          propertyRules: template.propertyRules,
          tags: [`namespace:${namespace}`, ...(template.runtime?.capabilities || [])],
          metadata: {
            runtime: template.runtime,
            webhookUrl,
          },
        }
        
        // Store template using template operations
        await templateOps.createTemplate({
          id: `${namespace}/${template.id}`,
          version: '1.0.0',
          status: 'active',
          source: {
            type: 'zip',
            location: namespace,
          },
          title: template.title,
          subtitle: template.subtitle || '',
          category: template.category,
          subcategory: template.subcategory || '',
          description: template.description,
          icon: template.icon,
          variant: template.variant || 'gray-700',
          shape: template.shape || 'rectangle',
          size: template.size || 'medium',
          inputs: template.ports
            .filter(p => p.type === 'input')
            .map(p => ({
              id: p.id,
              label: p.label,
              position: p.position,
              description: p.dataType || '',
              required: p.required || false,
              multiple: p.multiple || false,
            })),
          outputs: template.ports
            .filter(p => p.type === 'output')
            .map(p => ({
              id: p.id,
              label: p.label,
              position: p.position,
              description: p.dataType || '',
              multiple: p.multiple || false,
            })),
          properties: template.properties || {},
          propertyRules: template.propertyRules,
          tags: [`namespace:${namespace}`, ...(template.runtime?.capabilities || [])],
          metadata: {
            runtime: template.runtime,
            webhookUrl,
          },
          createdBy: 'zip-integration',
          updatedBy: 'zip-integration',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any)
        
        response.registered++
        response.templates.push({
          id: template.id,
          globalId: `${namespace}/${template.id}`,
          status: 'registered',
        })
      } catch (error) {
        response.templates.push({
          id: template.id,
          globalId: `${namespace}/${template.id}`,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
    
    // Store webhook URL if provided
    if (webhookUrl) {
      // Store webhook URL in template metadata for now
      // This can be extended to a separate webhooks table later
      console.log(`Webhook URL registered for namespace ${namespace}: ${webhookUrl}`)
    }
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error registering templates:', error)
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to register templates',
        details: error instanceof Error ? error.message : undefined,
        traceId: `trace_${Date.now()}`,
      }
    }, { status: 500 })
  }
}