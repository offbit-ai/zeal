import { NextRequest, NextResponse } from 'next/server'
import { createSuccessResponse, withErrorHandling, extractUserId, mockDelay } from '@/lib/api-utils'
import { ApiError } from '@/types/api'
import { EnvVarDatabase } from '@/services/envVarDatabase'
import { allNodeTemplates } from '@/data/nodeTemplates'

interface NodeTemplateResponse {
  id: string
  type: string
  title: string
  requiredEnvVars?: string[]
}

// Same mock data store as node endpoints (should be shared database in real app)
const nodeTemplatesStore: NodeTemplateResponse[] = allNodeTemplates.map(
  (template: any, index: number) => ({
    // Map JSON structure to API structure
    id: template.id,
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
    ports: template.ports,
    properties: template.properties,
    requiredEnvVars: template.requiredEnvVars,
    tags: template.tags,
    version: template.version || '1.0.0',
    isActive: template.isActive !== false, // Default to true unless explicitly false
    createdAt: template.createdAt || new Date(Date.now() - 86400000 * (30 - index)).toISOString(),
    updatedAt: template.updatedAt || new Date().toISOString(),
    ...(template.propertyRules ? { propertyRules: template.propertyRules } : {}),
  })
)

interface ValidateEnvVarsRequest {
  requiredVars?: string[] // Legacy support
  templateIds?: string[] // New template-based validation
}

interface ValidateEnvVarsResponse {
  missingVars: string[]
  configuredVars: string[]
  validationStatus: 'valid' | 'missing_vars'
  templateValidation?: Array<{
    templateId: string
    templateTitle: string
    requiredVars: string[]
    missingVars: string[]
  }>
}

// POST /api/env-vars/validate - Validate required environment variables
export const POST = withErrorHandling(async (req: NextRequest) => {
  await mockDelay(75)

  const _userId = extractUserId(req) // Prefix with _ to indicate intentionally unused

  let body: ValidateEnvVarsRequest = {}
  try {
    body = await req.json()
  } catch (error) {
    // Handle empty or malformed JSON body
    if (
      error instanceof SyntaxError ||
      (error instanceof Error && error.message.includes('Unexpected end of JSON input'))
    ) {
      body = {} // Default to empty object
    } else {
      throw error // Re-throw other errors
    }
  }

  let requiredVars: string[] = []
  let templateValidation: ValidateEnvVarsResponse['templateValidation'] = undefined

  // New template-based validation
  if (body.templateIds && Array.isArray(body.templateIds)) {
    const requiredVarsSet = new Set<string>()
    templateValidation = []

    body.templateIds.forEach(templateId => {
      const template = nodeTemplatesStore.find(t => t.id === templateId)

      if (template && template.requiredEnvVars) {
        template.requiredEnvVars.forEach(varName => {
          requiredVarsSet.add(varName)
        })

        templateValidation!.push({
          templateId: template.id,
          templateTitle: template.title,
          requiredVars: template.requiredEnvVars,
          missingVars: [], // Will be filled in below
        })
      }
    })

    requiredVars = Array.from(requiredVarsSet)
  }
  // Legacy support for direct requiredVars array
  else if (body.requiredVars && Array.isArray(body.requiredVars)) {
    requiredVars = body.requiredVars
  } else {
    // Return empty validation result for empty requests instead of erroring
    return NextResponse.json(
      createSuccessResponse(
        {
          missingVars: [],
          configuredVars: [],
          validationStatus: 'valid',
          templateValidation: [],
        } as ValidateEnvVarsResponse,
        {
          timestamp: new Date().toISOString(),
          requestId: `req_${Date.now()}`,
        }
      )
    )
  }

  // Get actual configured environment variables from database
  const { data: envVars } = await EnvVarDatabase.list()
  const configuredVars = envVars.map(v => v.key)

  const missingVars = requiredVars.filter(varName => !configuredVars.includes(varName))

  // Fill in missing vars for each template if using template-based validation
  if (templateValidation) {
    templateValidation.forEach(templateVal => {
      templateVal.missingVars = templateVal.requiredVars.filter(
        varName => !configuredVars.includes(varName)
      )
    })
  }

  const response: ValidateEnvVarsResponse = {
    missingVars,
    configuredVars: requiredVars.filter(varName => configuredVars.includes(varName)),
    validationStatus: missingVars.length > 0 ? 'missing_vars' : 'valid',
    templateValidation,
  }

  return NextResponse.json(
    createSuccessResponse(response, {
      timestamp: new Date().toISOString(),
      requestId: `req_${Date.now()}`,
    })
  )
})
