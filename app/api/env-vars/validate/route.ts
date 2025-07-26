import { NextRequest, NextResponse } from 'next/server'
import { 
  createSuccessResponse, 
  withErrorHandling, 
  extractUserId,
  mockDelay
} from '@/lib/api-utils'
import { ApiError } from '@/types/api'

interface NodeTemplateResponse {
  id: string
  type: string
  title: string
  requiredEnvVars?: string[]
}

// Same mock data store as node endpoints (should be shared database in real app)
const nodeTemplatesStore: NodeTemplateResponse[] = [
  {
    id: 'tpl_postgresql',
    type: 'database',
    title: 'PostgreSQL',
    requiredEnvVars: ['DATABASE_URL', 'DB_PASSWORD']
  },
  {
    id: 'tpl_gpt4',
    type: 'ai-model',
    title: 'Claude',
    requiredEnvVars: ['ANTHROPIC_API_KEY']
  },
  {
    id: 'tpl_branch',
    type: 'logic',
    title: 'Branch'
  },
  {
    id: 'tpl_python_script',
    type: 'script',
    title: 'Python Script',
    requiredEnvVars: ['CRM_API_KEY', 'CRM_BASE_URL']
  },
  {
    id: 'tpl_javascript_script',
    type: 'script',
    title: 'JavaScript Script'
  },
  {
    id: 'tpl_data_transformer',
    type: 'transform',
    title: 'Data Transformer'
  }
]

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
    if (error instanceof SyntaxError || error?.message?.includes('Unexpected end of JSON input')) {
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
          missingVars: [] // Will be filled in below
        })
      }
    })
    
    requiredVars = Array.from(requiredVarsSet)
  } 
  // Legacy support for direct requiredVars array
  else if (body.requiredVars && Array.isArray(body.requiredVars)) {
    requiredVars = body.requiredVars
  } 
  else {
    // Return empty validation result for empty requests instead of erroring
    return NextResponse.json(createSuccessResponse({
      missingVars: [],
      configuredVars: [],
      validationStatus: 'valid',
      templateValidation: []
    } as ValidateEnvVarsResponse, {
      timestamp: new Date().toISOString(),
      requestId: `req_${Date.now()}`
    }))
  }
  
  // Mock configured environment variables
  // In real implementation, this would query the user's actual env var configuration
  const configuredVars = [
    'NODE_ENV',
    'API_BASE_URL'
    // Intentionally missing: DATABASE_URL, DB_PASSWORD, ANTHROPIC_API_KEY, CRM_API_KEY, CRM_BASE_URL
  ]
  
  const missingVars = requiredVars.filter(varName => 
    !configuredVars.includes(varName)
  )
  
  // Fill in missing vars for each template if using template-based validation
  if (templateValidation) {
    templateValidation.forEach(templateVal => {
      templateVal.missingVars = templateVal.requiredVars.filter(varName => 
        !configuredVars.includes(varName)
      )
    })
  }
  
  const response: ValidateEnvVarsResponse = {
    missingVars,
    configuredVars: requiredVars.filter(varName => 
      configuredVars.includes(varName)
    ),
    validationStatus: missingVars.length > 0 ? 'missing_vars' : 'valid',
    templateValidation
  }
  
  return NextResponse.json(createSuccessResponse(response, {
    timestamp: new Date().toISOString(),
    requestId: `req_${Date.now()}`
  }))
})