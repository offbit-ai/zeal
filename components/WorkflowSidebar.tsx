import { useEffect } from 'react'
import { useNodeRepository } from '@/store/nodeRepository'
import { useWorkflowStore } from '@/store/workflowStore'
import { Tooltip } from './Tooltip'
import { Plus } from 'lucide-react'

interface WorkflowSidebarProps {
  isCollapsed?: boolean
  onCategoryClick?: (categoryId: string) => void
}

export function WorkflowSidebar({ isCollapsed = false, onCategoryClick }: WorkflowSidebarProps) {
  const { categories, nodes, loadNodes, loadCategories } = useNodeRepository()
  const { addNode } = useWorkflowStore()

  // Load nodes and categories on mount
  useEffect(() => {
    const initializeRepository = async () => {
      try {
        if (nodes.length === 0) {
          await loadNodes()
        }
        if (categories.length === 0) {
          await loadCategories()
        }
      } catch (error) {
        console.error('Failed to initialize node repository:', error)
      }
    }

    initializeRepository()
  }, []) // Only run on mount
  
  // Get installed nodes grouped by category
  const installedNodes = nodes.filter(node => node.isInstalled)
  const nodesByCategory = categories.map(category => ({
    ...category,
    nodes: installedNodes.filter(node => node.category === category.id)
  })).filter(category => category.nodes.length > 0)

  const handleAddNode = (nodeItem: any) => {
    // Create a new instance with unique ID from the template
    const instanceMetadata = {
      ...nodeItem.metadata,
      id: `${nodeItem.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` // Generate unique instance ID
    }
    
    // Add to canvas at center with slight randomization
    const position = {
      x: 400 + Math.random() * 200 - 100,
      y: 200 + Math.random() * 200 - 100
    }
    
    addNode(instanceMetadata, position)
  }

  if (isCollapsed) {
    // Collapsed floating sidebar - show category icons that open the modal
    return (
     categories.length ? <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-12 bg-white rounded-lg shadow-sm border border-gray-200 z-10">
        <div className="p-2">
          {categories.map((category) => {
            const nodeCount = nodes.filter(node => node.category === category.id && node.isInstalled).length
            return (
              <Tooltip key={category.id} content={`${category.name} (${nodeCount} installed)`} position="right">
                <div 
                  onClick={() => onCategoryClick?.(category.id)}
                  className="flex items-center justify-center w-8 h-8 mb-2 last:mb-0 rounded-md hover:bg-gray-100 cursor-pointer transition-colors"
                >
                  <category.icon className="w-4 h-4 text-gray-600" strokeWidth={1.5} />
                </div>
              </Tooltip>
            )
          })}
        </div>
      </div> : null
    )
  }

  // Expanded floating sidebar - show full content
  return (
    categories.length ? <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-64 bg-white rounded-lg shadow-sm border border-gray-200 z-10 max-h-[80vh] overflow-y-auto">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-900">Installed Nodes</h2>
          <span className="text-xs text-gray-500">{installedNodes.length} available</span>
        </div>
        
        {nodesByCategory.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-sm text-gray-500 mb-2">No nodes installed</div>
            <div className="text-xs text-gray-400">Use search to browse and install nodes</div>
          </div>
        ) : (
          nodesByCategory.map((category) => (
            <div key={category.id} className="mb-6 last:mb-0">
              <div className="flex items-center gap-2 mb-3">
                <category.icon className="w-4 h-4 text-gray-600" />
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {category.name}
                </h3>
                <span className="text-xs text-gray-400">({category.nodes.length})</span>
              </div>
              <div className="space-y-1">
                {category.nodes.map((node) => (
                  <div
                    key={node.id}
                    className="group flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleAddNode(node)}
                  >
                    <div className="p-1.5 bg-gray-100 rounded-md group-hover:bg-gray-200 transition-colors">
                      <node.metadata.icon className="w-4 h-4 text-gray-600" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {node.name}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {node.metadata.subtitle || node.description}
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
    </div> : null
  )
}