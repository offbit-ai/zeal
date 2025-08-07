import React, { useEffect } from 'react'
import { useWorkflowStore } from '@/store/workflow-store'
import { useNodeRepositoryStore } from '@/store/nodeRepositoryStore'
import { Tooltip } from './Tooltip'
import {
  Plus,
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
  HardDrive,
  MessageSquare,
  Settings,
  Pen,
  TextCursorInput,
  ClapperboardIcon,
} from 'lucide-react'
import { Icon } from '@/lib/icons'
import { updateDynamicNodeMetadata } from '@/utils/dynamicNodeMetadata'
import { NodeTemplateResponse } from '@/types/api'

interface WorkflowSidebarProps {
  isCollapsed?: boolean
  onCategoryClick?: (categoryId: string) => void
}

// Icon mapping for categories (Lucide components for categories)
const CATEGORY_ICONS: Record<string, any> = {
  'data-sources': Database,
  'ai-models': Brain,
  'logic-control': GitBranch,
  'data-processing': Shuffle,
  communication: MessageSquare,
  scripting: Code,
  'tools-utilities': PencilRuler,
  'storage-memory': Cpu,
  'cloud-services': Cloud,
  'graph-io': ArrowRightLeft,
  'inputs': TextCursorInput,
  'media': ClapperboardIcon
}

export function WorkflowSidebar({ isCollapsed = false, onCategoryClick }: WorkflowSidebarProps) {
  const { addNode } = useWorkflowStore()
  const { categories, nodeTemplates, isLoading, error, fetchAll } = useNodeRepositoryStore()

  // Fetch categories and nodes from API on mount
  useEffect(() => {
    fetchAll()
  }, [])

  // Filter active nodes
  const activeNodes = nodeTemplates.filter(node => node.isActive)

  // Group nodes by category
  const nodesByCategory = categories
    .filter(category => category.isActive)
    .map(category => ({
      id: category.name,
      title: category.displayName,
      icon: CATEGORY_ICONS[category.name] || Folder,
      nodes: activeNodes.filter(node => node.category === category.name),
    }))
    .filter(category => category.nodes.length > 0)

  const handleAddNode = async (nodeTemplate: NodeTemplateResponse) => {
    // Initialize property values with defaults from the template
    const propertyValues: Record<string, any> = {}
    if (nodeTemplate.properties) {
      // Properties is an object, iterate over its entries
      Object.entries(nodeTemplate.properties).forEach(([propId, prop]: [string, any]) => {
        if (prop.defaultValue !== undefined) {
          propertyValues[propId] = prop.defaultValue
        } else if (prop.type === 'code-editor') {
          // Initialize code-editor properties with empty string
          propertyValues[propId] = ''
        }
      })
    }

    // Create a new instance with unique ID from the template
    let instanceMetadata: any = {
      templateId: nodeTemplate.id,
      type: nodeTemplate.type,
      title: nodeTemplate.title,
      subtitle: nodeTemplate.subtitle,
      category: nodeTemplate.category,
      subcategory: nodeTemplate.subcategory,
      description: nodeTemplate.description,
      icon: nodeTemplate.icon,
      variant: nodeTemplate.variant || 'gray-600',
      shape: nodeTemplate.shape,
      size: nodeTemplate.size,
      ports: nodeTemplate.ports || [],
      properties: nodeTemplate.properties || {},
      requiredEnvVars: nodeTemplate.requiredEnvVars || [],
      id: `${nodeTemplate.id}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`, // Generate unique instance ID
      propertyValues, // Include initialized property values
      propertyRules: nodeTemplate.propertyRules, // Preserve property rules from template
    }

    // Apply dynamic metadata updates based on default values
    try {
      instanceMetadata = await updateDynamicNodeMetadata(
        instanceMetadata as any,
        propertyValues,
        nodeTemplate.propertyRules
      )
    } catch (error) {
      console.error('Failed to apply initial dynamic metadata:', error)
    }

    // Add to canvas at center with slight randomization
    const position = {
      x: 400 + Math.random() * 200 - 100,
      y: 200 + Math.random() * 200 - 100,
    }

    addNode(instanceMetadata, position)
  }

  if (isLoading) {
    return (
      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-12 bg-white rounded-lg shadow-sm border border-gray-200 z-10">
        <div className="p-2 text-center">
          <div className="text-xs text-gray-500">Loading...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-64 bg-white rounded-lg shadow-sm border border-gray-200 z-10">
        <div className="p-4 text-center">
          <div className="text-sm text-red-500">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-xs text-blue-500 hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (isCollapsed) {
    // Collapsed floating sidebar - show category icons that open the modal
    return nodesByCategory.length ? (
      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-12 bg-white rounded-lg shadow-sm border border-gray-200 z-10">
        <div className="p-2">
          {nodesByCategory.map(category => {
            return (
              <Tooltip
                key={category.id}
                content={`${category.title} (${category.nodes.length} nodes)`}
                position="right"
              >
                <div
                  onClick={() => onCategoryClick?.(category.id)}
                  className="flex items-center justify-center w-8 h-8 mb-2 last:mb-0 rounded-md hover:bg-gray-100 cursor-pointer transition-colors"
                >
                  {React.createElement(category.icon, { className: 'w-4 h-4 text-gray-600' })}
                </div>
              </Tooltip>
            )
          })}
        </div>
      </div>
    ) : null
  }

  // Expanded floating sidebar - show full content
  return nodesByCategory.length ? (
    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-64 bg-white rounded-lg shadow-sm border border-gray-200 z-10 max-h-[80vh] overflow-y-auto">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-900">Available Nodes</h2>
          <span className="text-xs text-gray-500">{activeNodes.length} nodes</span>
        </div>

        {nodesByCategory.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-sm text-gray-500 mb-2">No nodes available</div>
            <div className="text-xs text-gray-400">Check your connection and try again</div>
          </div>
        ) : (
          nodesByCategory.map(category => (
            <div key={category.id} className="mb-6 last:mb-0">
              <div className="flex items-center gap-2 mb-3">
                {React.createElement(category.icon, { className: 'w-4 h-4 text-gray-500' })}
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {category.title}
                </h3>
                <span className="text-xs text-gray-400">({category.nodes.length})</span>
              </div>
              <div className="space-y-1">
                {category.nodes.map(node => (
                  <div
                    key={node.id}
                    className="group flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleAddNode(node)}
                  >
                    <div className="p-1.5 bg-gray-100 rounded-md group-hover:bg-gray-200 transition-colors">
                      <Icon name={node.icon} className="w-4 h-4 text-gray-600" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{node.title}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {node.subtitle || node.description}
                      </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  ) : null
}
