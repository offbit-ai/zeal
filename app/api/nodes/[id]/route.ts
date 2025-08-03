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

// Backend mock data store (same as main route - should be shared database in real app)
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
      timeout: { type: 'number', default: 30000 }
    },
    requiredEnvVars: ['DATABASE_URL', 'DB_USERNAME', 'DB_PASSWORD'],
    tags: ['database', 'sql', 'postgresql'],
    version: '1.0.0',
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    updatedAt: new Date().toISOString()
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
      model: { type: 'select', options: ['gpt-4', 'gpt-4-turbo'], default: 'gpt-4', required: true },
      maxTokens: { type: 'number', default: 2000, min: 1, max: 8000 },
      temperature: { type: 'number', default: 0.7, min: 0, max: 2, step: 0.1 },
      systemPrompt: { type: 'text', required: true },
      stream: { type: 'boolean', default: false }
    },
    requiredEnvVars: ['OPENAI_API_KEY'],
    tags: ['ai', 'llm', 'openai', 'text-generation'],
    version: '1.2.0',
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date().toISOString()
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
      defaultPath: { type: 'select', options: ['true', 'false'], default: 'false' }
    },
    tags: ['logic', 'conditional', 'routing'],
    version: '1.0.0',
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date().toISOString()
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
      script: { type: 'code-editor', language: 'python', required: true, placeholder: '# Access input data via imports and metadata\n# Example:\n# result = imports.get("data", [])\n# return {"processed": len(result)}' },
      timeout: { type: 'number', default: 30000, min: 1000, max: 300000 },
      requirements: { type: 'textarea', placeholder: 'requests==2.28.0\npandas==1.5.0\nnumpy>=1.20.0', description: 'Pip packages to install (one per line)' }
    },
    tags: ['script', 'python', 'sandboxed', 'processing'],
    version: '1.1.0',
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date().toISOString()
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
      script: { type: 'code-editor', language: 'javascript', required: true, placeholder: '// Access input data via imports and metadata\n// Example:\n// const data = imports.data || [];\n// return { processed: data.length };' },
      timeout: { type: 'number', default: 10000, min: 100, max: 60000 }
    },
    tags: ['script', 'javascript', 'sandboxed', 'processing'],
    version: '1.0.0',
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    updatedAt: new Date().toISOString()
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
      validateOutput: { type: 'boolean', default: true }
    },
    tags: ['transform', 'data', 'processing', 'filter'],
    version: '1.0.0',
    isActive: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  }
]

// GET /api/nodes/[id] - Get specific node template
export const GET = withErrorHandling(async (req: NextRequest, context?: { params: { id: string } }) => {
  await mockDelay(75)
  
  if (!context || !context.params || !context.params.id) {
    throw new ApiError('NODE_TEMPLATE_NOT_FOUND', 'Node ID is required', 400)
  }
  
  const userId = extractUserId(req)
  const { id } = context.params
  
  const nodeTemplate = nodeTemplatesStore.find(node => 
    (node.id === id || node.type === id) && node.isActive
  )
  
  if (!nodeTemplate) {
    throw new ApiError('NODE_TEMPLATE_NOT_FOUND', 'Node template not found', 404)
  }
  
  return NextResponse.json(createSuccessResponse(nodeTemplate))
})

// PUT /api/nodes/[id] - Update node template (admin only)
export const PUT = withErrorHandling(async (req: NextRequest, context?: { params: { id: string } }) => {
  await mockDelay(150)
  
  if (!context || !context.params || !context.params.id) {
    throw new ApiError('NODE_TEMPLATE_NOT_FOUND', 'Node ID is required', 400)
  }
  
  const userId = extractUserId(req)
  const { id } = context.params
  const body = await req.json()
  
  // In real implementation, check if user has admin permissions
  if (!userId.startsWith('admin_')) {
    throw new ApiError('FORBIDDEN', 'Only administrators can modify node templates', 403)
  }
  
  const nodeIndex = nodeTemplatesStore.findIndex(node => node.id === id)
  
  if (nodeIndex === -1) {
    throw new ApiError('NODE_TEMPLATE_NOT_FOUND', 'Node template not found', 404)
  }
  
  const existingNode = nodeTemplatesStore[nodeIndex]
  
  // Check for duplicate type if type is being changed
  if (body.type && body.type !== existingNode.type) {
    const duplicateNode = nodeTemplatesStore.find(node => 
      node.type === body.type && node.id !== id
    )
    
    if (duplicateNode) {
      throw new ApiError(
        'DUPLICATE_NODE_TYPE',
        `Node template with type '${body.type}' already exists`,
        409
      )
    }
  }
  
  // Update node template
  const updatedNode = {
    ...existingNode,
    type: body.type !== undefined ? body.type : existingNode.type,
    title: body.title !== undefined ? body.title : existingNode.title,
    subtitle: body.subtitle !== undefined ? body.subtitle : existingNode.subtitle,
    category: body.category !== undefined ? body.category : existingNode.category,
    subcategory: body.subcategory !== undefined ? body.subcategory : existingNode.subcategory,
    description: body.description !== undefined ? body.description : existingNode.description,
    icon: body.icon !== undefined ? body.icon : existingNode.icon,
    properties: body.properties !== undefined ? body.properties : existingNode.properties,
    requiredEnvVars: body.requiredEnvVars !== undefined ? body.requiredEnvVars : existingNode.requiredEnvVars,
    tags: body.tags !== undefined ? body.tags : existingNode.tags,
    version: body.version !== undefined ? body.version : existingNode.version,
    isActive: body.isActive !== undefined ? body.isActive : existingNode.isActive,
    updatedAt: new Date().toISOString()
  }
  
  nodeTemplatesStore[nodeIndex] = updatedNode
  
  return NextResponse.json(createSuccessResponse(updatedNode))
})

// DELETE /api/nodes/[id] - Deactivate node template (admin only)
export const DELETE = withErrorHandling(async (req: NextRequest, context?: { params: { id: string } }) => {
  await mockDelay(100)
  
  if (!context || !context.params || !context.params.id) {
    throw new ApiError('NODE_TEMPLATE_NOT_FOUND', 'Node ID is required', 400)
  }
  
  const userId = extractUserId(req)
  const { id } = context.params
  
  // In real implementation, check if user has admin permissions
  if (!userId.startsWith('admin_')) {
    throw new ApiError('FORBIDDEN', 'Only administrators can deactivate node templates', 403)
  }
  
  const nodeIndex = nodeTemplatesStore.findIndex(node => node.id === id)
  
  if (nodeIndex === -1) {
    throw new ApiError('NODE_TEMPLATE_NOT_FOUND', 'Node template not found', 404)
  }
  
  // Instead of actually deleting, mark as inactive (soft delete)
  nodeTemplatesStore[nodeIndex] = {
    ...nodeTemplatesStore[nodeIndex],
    isActive: false,
    updatedAt: new Date().toISOString()
  }
  
  return NextResponse.json(createSuccessResponse({ deactivated: true }))
})