import { apiClient } from './apiClient'
import { NodeRepositoryItem, NodeCategory } from '@/store/nodeRepository'
import { iconLibrary } from '@/lib/icons'
import { 
  Database, Code, GitBranch, Shuffle, Cloud, 
  Mail, Brain, Cpu, PencilRuler, Folder
} from 'lucide-react'

// Icon mapping for categories (Lucide components for categories)
const CATEGORY_ICONS: Record<string, any> = {
  'data-sources': Database,
  'ai-models': Brain,
  'logic-control': GitBranch,
  'data-processing': Shuffle,
  'communication': Mail,
  'scripting': Code,
  'tools-utilities': PencilRuler,
  'storage-memory': Cpu,
  'cloud-services': Cloud
}

// Note: Icon mapping is now handled by the Icon Library
// This eliminates the need for manual icon mapping

export class NodeRepositoryService {

  static async getNodes(params?: {
    category?: string
    subcategory?: string
    search?: string
    tags?: string[]
    limit?: number
    page?: number
  }): Promise<{
    nodes: NodeRepositoryItem[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }> {
    const response = await apiClient.getPaginated<any>('/nodes', {
      category: params?.category,
      subcategory: params?.subcategory,
      search: params?.search,
      tags: params?.tags?.join(','),
      limit: params?.limit || 50,
      page: params?.page || 1
    })

    // Convert API response to NodeRepositoryItem format
    const nodes = response.data.map(this.convertApiNodeToRepositoryItem)

    return {
      nodes,
      pagination: response.pagination
    }
  }

  static async getNode(id: string): Promise<NodeRepositoryItem | null> {
    const nodeData = await apiClient.get<any>(`/nodes/${id}`)
    return this.convertApiNodeToRepositoryItem(nodeData)
  }

  static async getCategories(): Promise<NodeCategory[]> {
    const categories = await apiClient.get<any[]>('/nodes/categories')
    
    return categories.map(cat => ({
      id: cat.name,
      name: cat.displayName,
      description: cat.description,
      icon: CATEGORY_ICONS[cat.name] || Folder,
      subcategories: cat.subcategories?.map((sub: any) => ({
        id: sub.name,
        name: sub.displayName,
        description: sub.description
      })) || []
    }))
  }

  static async validateNode(templateId: string, properties: Record<string, any>): Promise<{
    isValid: boolean
    errors: Array<{ field: string; message: string; code: string }>
    warnings: Array<{ field: string; message: string; code: string }>
    missingEnvVars: string[]
  }> {
    const validation = await apiClient.post<any>('/nodes/validate', {
      nodeTemplateId: templateId,
      properties
    })
    
    return validation
  }

  static async searchNodes(query: string, filters?: {
    category?: string
    tags?: string[]
  }): Promise<NodeRepositoryItem[]> {
    const response = await this.getNodes({
      search: query,
      category: filters?.category,
      tags: filters?.tags,
      limit: 100
    })
    
    return response.nodes
  }

  // Convert API node response to NodeRepositoryItem
  private static convertApiNodeToRepositoryItem(apiNode: any): NodeRepositoryItem {
    return {
      id: apiNode.id,
      name: apiNode.title,
      description: apiNode.description,
      category: apiNode.category,
      subcategory: apiNode.subcategory,
      keywords: apiNode.tags || [],
      tags: apiNode.tags || [],
      metadata: {
        id: `${apiNode.id}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`, // Generate unique instance ID
        templateId: apiNode.id, // Reference to the template schema
        type: apiNode.type,
        title: apiNode.title,
        subtitle: apiNode.subtitle,
        icon: apiNode.icon || 'box',
        variant: (apiNode.variant || 'gray-700') as any,
        shape: (apiNode.shape || 'rectangle') as any,
        size: apiNode.size || 'medium',
        ports: apiNode.ports || [],
        properties: NodeRepositoryService.convertApiPropertiesToMetadata(apiNode.properties),
        requiredEnvVars: apiNode.requiredEnvVars || [],
        propertyRules: apiNode.propertyRules // Include property rules from template
      },
      isBuiltIn: true,
      isInstalled: !['tpl_gemini', 'tpl_huggingface', 'tpl_mongodb', 'tpl_redis'].includes(apiNode.id),
      version: apiNode.version || '1.0.0',
      author: 'Zeal Team',
      documentation: `Documentation for ${apiNode.title}`
    }
  }

  // Convert API properties schema to metadata properties
  private static convertApiPropertiesToMetadata(apiProperties: Record<string, any>): any[] {
    const properties: any[] = []
    
    Object.entries(apiProperties).forEach(([key, schema]: [string, any]) => {
      let defaultValue: any
      
      if (schema.defaultValue !== undefined) {
        defaultValue = schema.defaultValue
      } else if (schema.default !== undefined) {
        defaultValue = schema.default
      } else if (schema.type === 'string' || schema.type === 'text') {
        defaultValue = ''
      } else if (schema.type === 'number') {
        defaultValue = 0
      } else if (schema.type === 'boolean') {
        defaultValue = false
      } else if (schema.type === 'select' && schema.options?.[0]) {
        defaultValue = schema.options[0]
      } else if (schema.type === 'textarea') {
        defaultValue = ''
      } else if (schema.type === 'code' || schema.type === 'code-editor') {
        defaultValue = ''
      } else if (schema.type === 'rules') {
        defaultValue = []
      } else if (schema.type === 'dataOperations' || schema.type === 'data-operations') {
        defaultValue = []
      }
      
      const property: any = {
        id: key,
        label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
        type: schema.type,
        defaultValue: defaultValue,
        required: schema.required || false,
        placeholder: schema.placeholder,
        description: schema.description
      }

      // Add type-specific properties
      if (schema.options) property.options = schema.options
      if (schema.min !== undefined) property.min = schema.min
      if (schema.max !== undefined) property.max = schema.max
      if (schema.step !== undefined) property.step = schema.step
      if (schema.language) property.language = schema.language
      if (schema.lineNumbers !== undefined) property.lineNumbers = schema.lineNumbers
      if (schema.wordWrap !== undefined) property.wordWrap = schema.wordWrap
      
      // For rules type
      if (schema.type === 'rules') {
        if (schema.availableFields) property.availableFields = schema.availableFields
        if (schema.availableOperators) property.availableOperators = schema.availableOperators
      }
      
      // For dataOperations type
      if (schema.type === 'dataOperations' || schema.type === 'data-operations') {
        if (schema.availableFields) property.availableFields = schema.availableFields
      }
      
      properties.push(property)
    })
    
    return properties
  }
}