import { NextRequest, NextResponse } from 'next/server'
import { createSuccessResponse, withErrorHandling, extractUserId } from '@/lib/api-utils'
import { ApiError } from '@/types/api'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'

interface NodeTemplateResponse {
  id: string
  type: string
  title: string
  subtitle: string
  category: string
  subcategory?: string
  description: string
  icon: string
  properties: Record<string, any>
  requiredEnvVars?: string[]
  tags: string[]
  version: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Same mock data store as other node endpoints
const nodeTemplatesStore: NodeTemplateResponse[] = [
  {
    id: 'tpl_postgresql',
    type: 'database',
    title: 'PostgreSQL',
    subtitle: 'Relational Database',
    category: 'data-sources',
    subcategory: 'databases',
    description: 'Connect to PostgreSQL database for data operations',
    icon: 'database',
    properties: {
      host: { type: 'string', default: 'localhost', required: true },
      port: { type: 'number', default: 5432, required: true },
      database: { type: 'string', required: true },
      query: { type: 'text', required: true },
      timeout: { type: 'number', default: 30000 },
    },
    requiredEnvVars: ['DATABASE_URL', 'DB_USERNAME', 'DB_PASSWORD'],
    tags: ['database', 'sql', 'postgresql'],
    version: '1.0.0',
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl_gpt4',
    type: 'ai-model',
    title: 'GPT-4',
    subtitle: 'Large Language Model',
    category: 'ai-models',
    subcategory: 'llm',
    description: 'OpenAI GPT-4 for text generation and analysis',
    icon: 'brain',
    properties: {
      model: {
        type: 'select',
        options: ['gpt-4', 'gpt-4-turbo'],
        default: 'gpt-4',
        required: true,
      },
      maxTokens: { type: 'number', default: 2000, min: 1, max: 8000 },
      temperature: { type: 'number', default: 0.7, min: 0, max: 2, step: 0.1 },
      systemPrompt: { type: 'text', required: true },
      stream: { type: 'boolean', default: false },
    },
    requiredEnvVars: ['OPENAI_API_KEY'],
    tags: ['ai', 'llm', 'openai', 'text-generation'],
    version: '1.2.0',
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl_branch',
    type: 'logic',
    title: 'Branch',
    subtitle: 'Conditional Logic',
    category: 'logic-control',
    subcategory: 'conditions',
    description: 'Route data flow based on conditional rules',
    icon: 'git-branch',
    properties: {
      condition: { type: 'rules', required: true },
      defaultPath: { type: 'select', options: ['true', 'false'], default: 'false' },
    },
    tags: ['logic', 'conditional', 'routing'],
    version: '1.0.0',
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl_python_script',
    type: 'script',
    title: 'Python Script',
    subtitle: 'Sandboxed Python Runtime',
    category: 'scripting',
    subcategory: 'python',
    description: 'Execute sandboxed Python scripts with pip package support',
    icon: 'code',
    properties: {
      script: {
        type: 'code-editor',
        language: 'python',
        required: true,
        placeholder:
          '# Access input data via imports and metadata\n# Example:\n# result = imports.get("data", [])\n# return {"processed": len(result)}',
      },
      timeout: { type: 'number', default: 30000, min: 1000, max: 300000 },
      requirements: {
        type: 'textarea',
        placeholder: 'requests==2.28.0\npandas==1.5.0\nnumpy>=1.20.0',
        description: 'Pip packages to install (one per line)',
      },
    },
    tags: ['script', 'python', 'sandboxed', 'processing'],
    version: '1.1.0',
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl_javascript_script',
    type: 'script',
    title: 'JavaScript Script',
    subtitle: 'Sandboxed JavaScript Runtime',
    category: 'scripting',
    subcategory: 'javascript',
    description: 'Execute sandboxed JavaScript code with access to imports and metadata',
    icon: 'code',
    properties: {
      script: {
        type: 'code-editor',
        language: 'javascript',
        required: true,
        placeholder:
          '// Access input data via imports and metadata\n// Example:\n// const data = imports.data || [];\n// return { processed: data.length };',
      },
      timeout: { type: 'number', default: 10000, min: 100, max: 60000 },
    },
    tags: ['script', 'javascript', 'sandboxed', 'processing'],
    version: '1.0.0',
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl_data_transformer',
    type: 'transform',
    title: 'Data Transformer',
    subtitle: 'Transform Data',
    category: 'data-processing',
    subcategory: 'transformers',
    description: 'Transform and manipulate data using filters and operations',
    icon: 'shuffle',
    properties: {
      operations: { type: 'data-operations', required: true },
      outputFormat: { type: 'select', options: ['json', 'csv', 'xml'], default: 'json' },
      validateOutput: { type: 'boolean', default: true },
    },
    tags: ['transform', 'data', 'processing', 'filter'],
    version: '1.0.0',
    isActive: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

interface ValidateNodeRequest {
  nodeTemplateId: string
  properties: Record<string, any>
  connections?: {
    inputs: string[]
    outputs: string[]
  }
}

interface ValidationError {
  field: string
  message: string
  code: string
}

interface ValidateNodeResponse {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
  missingEnvVars: string[]
  requiredConnections: {
    inputs: string[]
    outputs: string[]
  }
}

// POST /api/nodes/validate - Validate node configuration
export const POST = withAuth(
  withErrorHandling(async (req: AuthenticatedRequest) => {

  const userId = req.auth?.subject?.id || extractUserId(req)
  const body: ValidateNodeRequest = await req.json()

  if (!body.nodeTemplateId) {
    throw new ApiError('VALIDATION_ERROR', 'nodeTemplateId is required', 400)
  }

  // Find the node template from our store
  const nodeTemplate = nodeTemplatesStore.find(
    template => template.id === body.nodeTemplateId || template.type === body.nodeTemplateId
  )

  if (!nodeTemplate) {
    throw new ApiError(
      'NODE_TEMPLATE_NOT_FOUND',
      `Node template '${body.nodeTemplateId}' not found`,
      404
    )
  }

  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  // Validate properties against the node template schema
  Object.entries(nodeTemplate.properties).forEach(([propKey, propSchema]: [string, any]) => {
    const propValue = body.properties?.[propKey]

    // Check required fields
    if (propSchema.required && (!propValue || propValue === '')) {
      errors.push({
        field: propKey,
        message: `${propKey} is required`,
        code: 'REQUIRED_FIELD',
      })
    }

    // Validate field types and constraints
    if (propValue !== undefined && propValue !== null && propValue !== '') {
      // Number validation
      if (propSchema.type === 'number') {
        const numValue = Number(propValue)
        if (isNaN(numValue)) {
          errors.push({
            field: propKey,
            message: `${propKey} must be a valid number`,
            code: 'INVALID_TYPE',
          })
        } else {
          if (propSchema.min !== undefined && numValue < propSchema.min) {
            errors.push({
              field: propKey,
              message: `${propKey} must be at least ${propSchema.min}`,
              code: 'VALUE_TOO_LOW',
            })
          }
          if (propSchema.max !== undefined && numValue > propSchema.max) {
            errors.push({
              field: propKey,
              message: `${propKey} must be at most ${propSchema.max}`,
              code: 'VALUE_TOO_HIGH',
            })
          }

          // Add warnings for certain ranges
          if (propKey === 'maxTokens' && numValue > 4000) {
            warnings.push({
              field: propKey,
              message: 'High token count may increase costs significantly',
              code: 'COST_WARNING',
            })
          }
          if (propKey === 'timeout' && numValue < 5000) {
            warnings.push({
              field: propKey,
              message: 'Very short timeout may cause execution failures',
              code: 'RECOMMENDED_VALUE',
            })
          }
        }
      }

      // Select validation
      if (propSchema.type === 'select' && propSchema.options) {
        if (!propSchema.options.includes(propValue)) {
          errors.push({
            field: propKey,
            message: `${propKey} must be one of: ${propSchema.options.join(', ')}`,
            code: 'INVALID_OPTION',
          })
        }
      }

      // Code editor validation and security warnings
      if (
        (propSchema.type === 'code-editor' || propKey === 'script') &&
        typeof propValue === 'string'
      ) {
        // Python-specific warnings
        if (propSchema.language === 'python') {
          if (propValue.includes('import os') || propValue.includes('import subprocess')) {
            warnings.push({
              field: propKey,
              message: 'Script contains potentially dangerous system imports',
              code: 'SECURITY_WARNING',
            })
          }
          if (propValue.includes('exec(') || propValue.includes('eval(')) {
            warnings.push({
              field: propKey,
              message: 'Script contains dynamic code execution which may be unsafe',
              code: 'SECURITY_WARNING',
            })
          }
        }

        // JavaScript-specific warnings
        if (propSchema.language === 'javascript') {
          if (propValue.includes('eval(') || propValue.includes('Function(')) {
            warnings.push({
              field: propKey,
              message: 'Script contains dynamic code execution which may be unsafe',
              code: 'SECURITY_WARNING',
            })
          }
          if (propValue.includes('require(') || propValue.includes('import(')) {
            warnings.push({
              field: propKey,
              message: 'External module imports are not allowed in sandboxed JavaScript',
              code: 'SECURITY_WARNING',
            })
          }
        }

        // General destructive operation warnings
        if (
          propValue.toLowerCase().includes('delete') ||
          propValue.toLowerCase().includes('drop')
        ) {
          warnings.push({
            field: propKey,
            message: 'Script contains potentially destructive operations',
            code: 'DANGEROUS_OPERATION',
          })
        }
      }

      // SQL query warnings
      if (propKey === 'query' && typeof propValue === 'string') {
        if (
          propValue.toLowerCase().includes('delete') ||
          propValue.toLowerCase().includes('drop')
        ) {
          warnings.push({
            field: propKey,
            message: 'Query contains potentially destructive operations',
            code: 'DANGEROUS_OPERATION',
          })
        }
      }
    }
  })

  // Simulate checking configured environment variables
  // In real implementation, this would query the user's actual env var configuration
  const configuredEnvVars = ['NODE_ENV', 'DATABASE_URL'] // Mock configured vars
  const actuallyMissingVars = (nodeTemplate.requiredEnvVars || []).filter(
    varName => !configuredEnvVars.includes(varName)
  )

  // Determine required connections based on node type
  let requiredInputs: string[] = []
  let requiredOutputs: string[] = []

  switch (nodeTemplate.type) {
    case 'transform':
    case 'script':
      requiredInputs = ['data']
      requiredOutputs = ['result']
      break
    case 'database':
      requiredOutputs = ['data']
      break
    case 'ai-model':
      requiredInputs = ['prompt']
      requiredOutputs = ['response']
      break
    case 'logic':
      requiredInputs = ['data']
      requiredOutputs = ['true', 'false']
      break
    default:
      requiredOutputs = ['result']
  }

  const response: ValidateNodeResponse = {
    isValid: errors.length === 0,
    errors,
    warnings,
    missingEnvVars: actuallyMissingVars,
    requiredConnections: {
      inputs: requiredInputs,
      outputs: requiredOutputs,
    },
  }

  return NextResponse.json(
    createSuccessResponse(response, {
      timestamp: new Date().toISOString(),
      requestId: `req_${Date.now()}`,
    })
  )
  }),
  {
    resource: 'nodes',
    action: 'read'
  }
)
