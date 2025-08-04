import { apiClient } from './apiClient'
import { NodeRepositoryItem, NodeCategory } from '@/types/nodeRepository'
import { iconLibrary } from '@/lib/icons'
import {
  Database,
  Code,
  GitBranch,
  Shuffle,
  Cloud,
  Mail,
  Brain,
  Cpu,
  PencilRuler,
  Folder,
  ArrowRightLeft,
} from 'lucide-react'

// Icon mapping for categories (Lucide components for categories)
const CATEGORY_ICONS: Record<string, any> = {
  'data-sources': Database,
  'ai-models': Brain,
  'logic-control': GitBranch,
  'data-processing': Shuffle,
  communication: Mail,
  scripting: Code,
  'tools-utilities': PencilRuler,
  'storage-memory': Cpu,
  'cloud-services': Cloud,
  'graph-io': ArrowRightLeft,
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
      page: params?.page || 1,
    })

    // Convert API response to NodeRepositoryItem format
    const nodes = response.data.map(this.convertApiNodeToRepositoryItem)

    return {
      nodes,
      pagination: response.pagination,
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
      subcategories:
        cat.subcategories?.map((sub: any) => ({
          id: sub.name,
          name: sub.displayName,
          description: sub.description,
        })) || [],
    }))
  }

  static async validateNode(
    templateId: string,
    properties: Record<string, any>
  ): Promise<{
    isValid: boolean
    errors: Array<{ field: string; message: string; code: string }>
    warnings: Array<{ field: string; message: string; code: string }>
    missingEnvVars: string[]
  }> {
    const validation = await apiClient.post<any>('/nodes/validate', {
      nodeTemplateId: templateId,
      properties,
    })

    return validation
  }

  static async searchNodes(
    query: string,
    filters?: {
      category?: string
      tags?: string[]
    }
  ): Promise<NodeRepositoryItem[]> {
    const response = await this.getNodes({
      search: query,
      category: filters?.category,
      tags: filters?.tags,
      limit: 100,
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
        properties: apiNode.properties || {},
        requiredEnvVars: apiNode.requiredEnvVars || [],
        propertyRules: apiNode.propertyRules, // Include property rules from template
      },
      isBuiltIn: true,
      isInstalled: !['tpl_gemini', 'tpl_huggingface', 'tpl_mongodb', 'tpl_redis'].includes(
        apiNode.id
      ),
      version: apiNode.version || '1.0.0',
      author: 'Zeal Team',
      documentation: `Documentation for ${apiNode.title}`,
    }
  }
}
