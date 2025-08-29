import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { SearchService } from '../../../../../services/node-template-repository/search/search-service'
import { EmbeddingService } from '../../../../../services/node-template-repository/search/embedding-service'
import { getTemplateOperations } from '../../../../../lib/database-template-operations'
import { ServerCRDTOperations } from '../../../../../lib/crdt/server-operations'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'

const AddNodeFromTemplateSchema = z.object({
  workflowId: z.string().min(1, 'Workflow ID is required'),
  query: z.string().min(1, 'Search query is required'),
  graphId: z.string().default('main'),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
  propertyValues: z.record(z.any()).optional(),
})

export const POST = withAuth(async (request: AuthenticatedRequest, context?: { params: any }) => {
  try {
    const body = await request.json()
    
    // Validate input with Zod
    const validationResult = AddNodeFromTemplateSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      )
    }
    
    const params = validationResult.data

    // Search for templates
    const templateOps = await getTemplateOperations()
    const embeddingService = EmbeddingService.fromEnvironment()
    const searchService = new SearchService(templateOps, embeddingService)

    console.log(`[API] Searching for template with query: "${params.query}"`)

    const searchResults = await searchService.search({
      query: params.query,
      limit: 5, // Get more results to find better matches
    })

    console.log(
      `[API] Found ${searchResults.length} templates:`,
      searchResults.map(r => r.template.title)
    )

    if (searchResults.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No matching template found',
        },
        { status: 404 }
      )
    }

    // Try to find exact match first, otherwise use the best semantic match
    const template =
      searchResults.find(r => r.template.title === params.query)?.template ||
      searchResults[0].template
    console.log(`[API] Selected template: ${template.title}`)

    // Extract inputs and outputs from ports
    const inputs = template.ports.filter(port => port.type === 'input')
    const outputs = template.ports.filter(port => port.type === 'output')

    // Extract default property values from template
    const defaultPropertyValues: Record<string, any> = {}
    if (template.properties) {
      Object.entries(template.properties).forEach(([propId, prop]: [string, any]) => {
        if (prop.defaultValue !== undefined) {
          defaultPropertyValues[propId] = prop.defaultValue
        } else if (prop.type === 'code-editor') {
          // Initialize code-editor properties with empty string
          defaultPropertyValues[propId] = ''
        }
      })
    }

    // Merge default values with provided values (provided values take precedence)
    const finalPropertyValues = {
      ...defaultPropertyValues,
      ...(params.propertyValues || {}),
    }

    // Create node from template using appropriate operations
    const nodeData = {
      metadata: {
        id: template.id,
        type: template.id, // Use id as type since template doesn't have a type field
        title: template.title,
        description: template.description,
        icon: template.icon,
        category: template.category,
        subcategory: template.subcategory,
        inputs: inputs,
        outputs: outputs,
        properties: template.properties || {},
        propertyValues: finalPropertyValues,
      },
      position: params.position || { x: 100, y: 100 },
    }

    // Always use ServerCRDTOperations for embed mode
    const node = await ServerCRDTOperations.addNode(
      params.workflowId,
      params.graphId,
      nodeData
    )

    return NextResponse.json({
      success: true,
      data: {
        node,
        template: {
          id: template.id,
          title: template.title,
          category: template.category,
        },
        message: 'Node added from template successfully',
      }
    })
  } catch (error) {
    console.error('Error adding node from template:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add node',
      },
      { status: 500 }
    )
  }
}, {
  resource: 'node',
  action: 'create'
})
