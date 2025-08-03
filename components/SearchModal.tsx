import { Search, X, Download, Plus, Filter, Code, Edit3, Loader2, GitBranch, Link, Database, Brain, Shuffle, MessageSquare, PencilRuler, HardDrive, Cloud, ArrowRightLeft, Folder } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNodeRepository, NodeRepositoryItem } from '@/hooks/useNodeRepository'
import { useWorkflowStore } from '@/store/workflow-store'
import { useNodeRepositoryStore } from '@/store/nodeRepositoryStore'
import { updateDynamicNodeMetadata } from '@/utils/dynamicNodeMetadata'
import { Icon } from '@/lib/icons'
import { NodeCreatorModal } from './NodeCreatorModal'
import { SubgraphPortSelector } from './SubgraphPortSelector'
import type { SubgraphNodeMetadata } from '@/types/workflow'
import { findEmptyArea, calculatePanToCenter, animateCanvasPan } from '@/utils/findEmptyArea'

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
  initialCategory?: string | null
  initialTab?: 'repository' | 'custom' | 'subgraphs'
  onNodeAdded?: (nodeId: string) => void
  canvasOffset?: { x: number; y: number }
  canvasZoom?: number
  viewportSize?: { width: number; height: number }
  onCanvasOffsetChange?: (offset: { x: number; y: number }) => void
  onHighlightNode?: (nodeId: string) => void
}

export function SearchModal({ 
  isOpen, 
  onClose, 
  initialCategory, 
  initialTab, 
  onNodeAdded, 
  canvasOffset, 
  canvasZoom,
  viewportSize,
  onCanvasOffsetChange,
  onHighlightNode
}: SearchModalProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isNodeCreatorOpen, setIsNodeCreatorOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'repository' | 'custom' | 'subgraphs'>(initialTab || 'repository')
  const [customNodes, setCustomNodes] = useState<NodeRepositoryItem[]>([])
  const [editingNode, setEditingNode] = useState<NodeRepositoryItem | null>(null)
  const [installingNodes, setInstallingNodes] = useState<Set<string>>(new Set())
  const [portSelectorState, setPortSelectorState] = useState<{
    isOpen: boolean
    subgraphId: string
    subgraphName: string
  }>({ isOpen: false, subgraphId: '', subgraphName: '' })
  
  const nodeRepository = useNodeRepository()
  const { categories: apiCategories, fetchAll: fetchApiData } = useNodeRepositoryStore()
  
  // Fetch API data on mount if not already loaded
  useEffect(() => {
    if (apiCategories.length === 0) {
      fetchApiData()
    }
  }, [])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)

  const { addNode, graphs, currentGraphId, workflowName, workflowId, nodes: storeNodes, groups, setGraphDirty } = useWorkflowStore()

  // Filter nodes based on search and category
  const filteredNodes = nodeRepository.filter(node => {
    // Search filter
    if (searchQuery && !node.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !node.description.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !node.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))) {
      return false
    }
    
    // Category filter
    if (selectedCategory && node.category !== selectedCategory) {
      return false
    }
    
    // Subcategory filter
    if (selectedSubcategory && node.subcategory !== selectedSubcategory) {
      return false
    }
    
    return true
  })
  
  // Extract unique categories with structure
  const categoriesMap = new Map<string, { subcategories: Set<string> }>()
  nodeRepository.forEach(node => {
    if (!categoriesMap.has(node.category)) {
      categoriesMap.set(node.category, { subcategories: new Set() })
    }
    if (node.subcategory) {
      categoriesMap.get(node.category)!.subcategories.add(node.subcategory)
    }
  })
  
  // Icon mapping for categories
  const CATEGORY_ICONS: Record<string, any> = {
    'data-sources': Database,
    'ai-models': Brain,
    'logic-control': GitBranch,
    'data-processing': Shuffle,
    'communication': MessageSquare,
    'scripting': Code,
    'tools-utilities': PencilRuler,
    'storage-memory': HardDrive,
    'cloud-services': Cloud,
    'graph-io': ArrowRightLeft
  }
  
  const categories = Array.from(categoriesMap.entries()).map(([name, data]) => {
    // Try to find the category in API data to get display name
    const apiCategory = apiCategories.find(cat => cat.name === name)
    const displayName = apiCategory?.displayName || name
    
    return {
      id: name,
      name: displayName,
      icon: CATEGORY_ICONS[name] || Folder,
      subcategories: Array.from(data.subcategories).map(sub => ({
        id: sub.toLowerCase().replace(/\s+/g, '-'),
        name: sub.split(/[-_]/).map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ')
      }))
    }
  })

  // Handle node installation with animation
  const handleInstallNode = async (node: NodeRepositoryItem) => {
    // Add to installing set
    setInstallingNodes(prev => new Set(Array.from(prev).concat(node.id)))
    
    try {
      // Simulate installation delay
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Mark node as installed (in real app, this would persist)
      // For now, just update the UI
      
      // Remove from installing set
      setInstallingNodes(prev => {
        const newSet = new Set(prev)
        newSet.delete(node.id)
        return newSet
      })
    } catch (error) {
      console.error('Failed to install node:', error)
      // Remove from installing set on error
      setInstallingNodes(prev => {
        const newSet = new Set(prev)
        newSet.delete(node.id)
        return newSet
      })
    }
  }

  // Load custom nodes from localStorage on mount
  useEffect(() => {
    const savedNodes = localStorage.getItem('customNodes')
    if (savedNodes) {
      try {
        setCustomNodes(JSON.parse(savedNodes))
      } catch (err) {
        console.error('Failed to load custom nodes:', err)
      }
    }
  }, [])

  // Save custom node
  const saveCustomNode = (nodeTemplate: any, isEditing: boolean = false) => {
    const customNode: NodeRepositoryItem = {
      id: isEditing && editingNode ? editingNode.id : nodeTemplate.id,
      title: nodeTemplate.title,
      subtitle: nodeTemplate.subtitle || '',
      description: nodeTemplate.subtitle || '',
      icon: nodeTemplate.icon,
      variant: nodeTemplate.variant,
      category: 'Custom',
      subcategory: nodeTemplate.type === 'script' ? 'Scripts' : 'APIs',
      tags: [],
      template: nodeTemplate as any,
      isInstalled: nodeTemplate.isInstalled || false,
    }
    
    let updatedNodes: NodeRepositoryItem[]
    if (isEditing && editingNode) {
      // Replace the existing node
      updatedNodes = customNodes.map(node => 
        node.id === editingNode.id ? customNode : node
      )
    } else {
      // Add new node
      updatedNodes = [...customNodes, customNode]
    }
    
    setCustomNodes(updatedNodes)
    localStorage.setItem('customNodes', JSON.stringify(updatedNodes))
    setEditingNode(null)
  }

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      // Set initial category if provided
      if (initialCategory) {
        setSelectedCategory(initialCategory)
      }
      // Set initial tab if provided
      if (initialTab) {
        setActiveTab(initialTab)
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true)
        })
      })
    } else {
      setIsAnimating(false)
      const timer = setTimeout(() => {
        setIsVisible(false)
        setSearchQuery('') // Reset search on close
        setSelectedCategory(null) // Reset filters
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [isOpen, initialCategory, initialTab, setSearchQuery, setSelectedCategory])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const handleAddSubgraph = (graphId: string) => {
    const graph = graphs.find(g => g.id === graphId)
    if (!graph) return
    
    // Create subgraph node metadata
    const subgraphMetadata: SubgraphNodeMetadata = {
      id: `subgraph-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      templateId: 'subgraph',
      type: 'subgraph',
      title: graph.name,
      subtitle: `Subgraph: ${graph.namespace || `${workflowName}/${graph.id}`}`,
      icon: 'git-branch',
      variant: 'orange-600',
      shape: 'rectangle',
      graphId: graph.id,
      graphNamespace: graph.namespace || `${workflowName}/${graph.id}`,
      graphName: graph.name,
      workflowId: workflowId,
      workflowName: workflowName,
      ports: [
        { id: 'input', label: 'Input', type: 'input', position: 'left' },
        { id: 'output', label: 'Output', type: 'output', position: 'right' }
      ],
      properties: {}, // Subgraph nodes don't have editable properties
      propertyValues: {}
    }
    
    // Find an empty area for the new subgraph node
    let position: { x: number; y: number }
    if (canvasOffset && canvasZoom !== undefined && viewportSize) {
      const viewportCenterX = viewportSize.width / 2
      const viewportCenterY = viewportSize.height / 2
      const worldCenterX = (viewportCenterX - canvasOffset.x) / canvasZoom
      const worldCenterY = (viewportCenterY - canvasOffset.y) / canvasZoom
      
      position = findEmptyArea(
        storeNodes,
        groups,
        { width: 200, height: 100 },
        { x: worldCenterX, y: worldCenterY }
      )
    } else {
      position = findEmptyArea(storeNodes, groups)
    }
    
    const addedNodeId = addNode(subgraphMetadata, position)
    if (addedNodeId) {
      setGraphDirty(currentGraphId, true)
      
      // Pan canvas to the new node and highlight it
      if (canvasOffset && canvasZoom && viewportSize && onCanvasOffsetChange && onHighlightNode) {
        const targetOffset = calculatePanToCenter(
          position,
          viewportSize,
          canvasOffset,
          canvasZoom
        )
        
        animateCanvasPan(
          canvasOffset,
          targetOffset,
          500,
          (offset) => onCanvasOffsetChange(offset),
          () => {
            onHighlightNode(addedNodeId)
            setTimeout(() => onHighlightNode(''), 2000)
          }
        )
      }
      
      if (onNodeAdded) {
        onNodeAdded(addedNodeId)
      }
    }
    onClose()
  }

  const handleAddToCanvas = async (nodeItem: NodeRepositoryItem) => {
    
    // Skip installation check - all repository nodes are available
    
    // Initialize property values with defaults from the template
    const propertyValues: Record<string, any> = {}
    if (nodeItem.template.properties) {
      // Properties is an object, iterate over its entries
      Object.entries(nodeItem.template.properties).forEach(([propId, prop]: [string, any]) => {
        if (prop.defaultValue !== undefined) {
          propertyValues[propId] = prop.defaultValue
        } else if (prop.type === 'code-editor') {
          // Initialize code-editor properties with empty string
          propertyValues[propId] = ''
        }
      })
    }
    
    // Create a new instance with unique ID from the template
    let instanceMetadata = {
      ...nodeItem.template,
      id: `${nodeItem.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` as string, // Generate unique instance ID
      variant: nodeItem.template.variant || 'gray-600', // Ensure variant has a default value
      propertyValues // Include initialized property values
    }
    
    
    // Apply dynamic metadata updates based on default values
    try {
      instanceMetadata = await updateDynamicNodeMetadata(instanceMetadata as any, propertyValues, nodeItem.template.propertyRules) as any
    } catch (error) {
      console.error('Failed to apply initial dynamic metadata:', error)
    }
    
    // Find an empty area for the new node
    let position = { x: 400, y: 200 } // Default fallback position
    
    if (canvasOffset && canvasZoom && viewportSize) {
      // Calculate the center of the current viewport in world coordinates
      const viewportCenterX = viewportSize.width / 2
      const viewportCenterY = viewportSize.height / 2
      
      // Convert viewport center to world coordinates
      const worldCenterX = (viewportCenterX - canvasOffset.x) / canvasZoom
      const worldCenterY = (viewportCenterY - canvasOffset.y) / canvasZoom
      
      // Find an empty area near the viewport center
      position = findEmptyArea(
        storeNodes,
        groups,
        { width: 200, height: 100 },
        { x: worldCenterX, y: worldCenterY }
      )
      
      // Found empty area for node at position
    } else {
      // Fallback to finding empty area without viewport info
      position = findEmptyArea(storeNodes, groups)
      // Using fallback empty area search
    }
    
    const addedNodeId = addNode(instanceMetadata as any, position)
    if (addedNodeId) {
      setGraphDirty(currentGraphId, true)
      
      // Pan canvas to the new node and highlight it
      if (canvasOffset && canvasZoom && viewportSize && onCanvasOffsetChange && onHighlightNode) {
        // Calculate the new offset to center the node
        const targetOffset = calculatePanToCenter(
          position,
          viewportSize,
          canvasOffset,
          canvasZoom
        )
        
        // Animate the pan
        animateCanvasPan(
          canvasOffset,
          targetOffset,
          500, // 500ms animation
          (offset) => onCanvasOffsetChange(offset),
          () => {
            // After panning, highlight the node
            onHighlightNode(addedNodeId)
            
            // Clear highlight after 2 seconds
            setTimeout(() => {
              onHighlightNode('')
            }, 2000)
          }
        )
      }
      
      if (onNodeAdded) {
        onNodeAdded(addedNodeId)
      }
    }
    onClose()
  }

  const getStatusBadge = (node: NodeRepositoryItem) => {
    // All repository nodes are available
    if (node.category === 'Custom') {
      return <span className="text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Custom</span>
    }
    return <span className="text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Available</span>
  }

  const handleOpenPortSelector = (graphId: string, graphName: string) => {
    // Opening port selector for graph
    setPortSelectorState({
      isOpen: true,
      subgraphId: graphId,
      subgraphName: graphName
    })
  }

  if (!isVisible) return null

  return (
    <div 
      className={`fixed inset-0 flex items-center justify-center z-50 transition-colors duration-200 ease-out ${
        isAnimating ? 'bg-black/50' : 'bg-black/0'
      }`}
      onClick={onClose}
    >
      <div 
        className={`bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] mx-4 transition-all duration-200 ease-out transform ${
          isAnimating ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'
        } flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-gray-200">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-medium text-gray-900">Node Repository</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsNodeCreatorOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Node
              </button>
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 rounded-md transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 px-4">
            <button
              onClick={() => setActiveTab('repository')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'repository'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Repository
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'custom'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Custom Nodes ({customNodes.length})
            </button>
            <button
              onClick={() => setActiveTab('subgraphs')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'subgraphs'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Subgraphs ({graphs.filter(g => g.id !== currentGraphId).length})
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {activeTab === 'repository' ? (
            <>
              {/* Categories Sidebar */}
              <div className="w-64 border-r border-gray-200 p-4 overflow-y-auto">
            <div className="space-y-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedCategory === null
                    ? 'bg-black text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                All Categories
              </button>
              
              {categories.map((category) => (
                <div key={category.id}>
                  <button
                    onClick={() => setSelectedCategory(category.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                      selectedCategory === category.id
                        ? 'bg-black text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {category.icon && <category.icon className="w-4 h-4" />}
                    {category.name}
                  </button>
                  
                  {/* Subcategories */}
                  {selectedCategory === category.id && category.subcategories && (
                    <div className="ml-4 mt-1 space-y-1">
                      {category.subcategories.map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => setSelectedSubcategory(sub.id)}
                          className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors ${
                            selectedSubcategory === sub.id
                              ? 'bg-gray-200 text-gray-900'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {sub.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search Bar */}
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search nodes, tools, agents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                  autoFocus
                />
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredNodes.length === 0 ? (
                <div className="text-center py-12">
                  <Filter className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No nodes found</h3>
                  <p className="text-gray-500">Try adjusting your search or filter criteria</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredNodes.map((node) => (
                    <div
                      key={node.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      {/* Node Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 rounded-md">
                            <Icon name={node.template.icon} className="w-5 h-5 text-gray-700" />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">{node.title}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              {getStatusBadge(node)}
                              {node.template.version && (
                                <span className="text-xs text-gray-500">v{node.template.version}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-gray-600 mb-3">{node.description}</p>

                      {/* Tags */}
                      {node.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {node.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                          {node.tags.length > 3 && (
                            <span className="text-xs text-gray-500">
                              +{node.tags.length - 3} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {node.isInstalled ? (
                          <button
                            onClick={() => handleAddToCanvas(node)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add to Canvas
                          </button>
                        ) : (
                          <button
                            onClick={() => handleInstallNode(node)}
                            disabled={installingNodes.has(node.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                              installingNodes.has(node.id)
                                ? 'bg-orange-100 text-orange-700 cursor-not-allowed'
                                : 'bg-orange-500 text-white hover:bg-orange-600'
                            }`}
                          >
                            {installingNodes.has(node.id) ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            {installingNodes.has(node.id) ? 'Installing...' : 'Install'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
            </>
          ) : activeTab === 'custom' ? (
            /* Custom Nodes Tab */
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="space-y-6">
                {/* Group by type */}
                {['Scripts', 'APIs'].map(type => {
                  const nodesOfType = customNodes.filter((node: any) => 
                    type === 'Scripts' ? node.template.type === 'script' : node.template.type === 'api'
                  )
                  
                  if (nodesOfType.length === 0) return null
                  
                  return (
                    <div key={type}>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">{type}</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {nodesOfType.map((node) => (
                          <div
                            key={node.id}
                            className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                <Icon
                                  name={node.template.icon}
                                  source={node.template.icon && ['python', 'javascript', 'openai', 'aws', 'google', 'slack', 'github', 'mongodb', 'postgresql', 'mysql', 'redis'].includes(node.template.icon) ? 'brand' : 'lucide'}
                                  className="w-6 h-6 text-gray-600"
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    setEditingNode(node)
                                    setIsNodeCreatorOpen(true)
                                  }}
                                  className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Edit custom node"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    const updatedNodes = customNodes.filter(n => n.id !== node.id)
                                    setCustomNodes(updatedNodes)
                                    localStorage.setItem('customNodes', JSON.stringify(updatedNodes))
                                  }}
                                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Delete custom node"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            
                            <div className="mb-3">
                              <h4 className="font-medium text-gray-900 mb-1">{node.template.title}</h4>
                              <p className="text-sm text-gray-500 line-clamp-2">
                                {node.template.subtitle || `Custom ${node.template.type} node`}
                              </p>
                            </div>
                            
                            {/* Node Info */}
                            <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                              <span className="flex items-center gap-1">
                                <Code className="w-3 h-3" />
                                {node.template.type === 'script' ? 
                                  (node.template.variant?.includes('blue') ? 'Python' : 'JavaScript') : 
                                  'API'
                                }
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-1 h-1 bg-green-500 rounded-full"></span>
                                Custom
                              </span>
                            </div>

                            {/* Actions */}
                            <button
                              onClick={() => handleAddToCanvas(node)}
                              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add to Canvas
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
                
                {customNodes.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500 mb-4">No custom nodes yet</p>
                    <button
                      onClick={() => setIsNodeCreatorOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Create Your First Node
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'subgraphs' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Available Subgraphs</h3>
                <p className="text-sm text-gray-500 mt-1">Add references to other graphs in your workflow</p>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                {graphs.filter(g => g.id !== currentGraphId).length === 0 ? (
                  <div className="text-center py-12">
                    <GitBranch className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No other graphs available</h3>
                    <p className="text-gray-500">Create more graphs to use them as subgraphs</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {graphs.filter(g => g.id !== currentGraphId).map((graph) => (
                      <div
                        key={graph.id}
                        className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                            <GitBranch className="w-6 h-6 text-orange-600" />
                          </div>
                          {graph.isMain && (
                            <span className="text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded">Main</span>
                          )}
                        </div>
                        
                        <div className="mb-3">
                          <h4 className="font-medium text-gray-900 mb-1">{graph.name}</h4>
                          <p className="text-sm text-gray-500">
                            Namespace: {graph.namespace || `${workflowName}/${graph.id}`}
                          </p>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAddSubgraph(graph.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-sm font-medium rounded-md hover:bg-orange-700 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Subgraph
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenPortSelector(graph.id, graph.name)
                            }}
                            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 transition-colors"
                            title="Create proxy connection to specific port"
                          >
                            <Link className="w-3.5 h-3.5" />
                            Proxy
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      
      {/* Node Creator Modal */}
      <NodeCreatorModal
        isOpen={isNodeCreatorOpen}
        onClose={() => {
          setIsNodeCreatorOpen(false)
          setEditingNode(null)
        }}
        editingNode={{
          id: editingNode?.template.id || '',
          title: editingNode?.template.title || '',
          subtitle: editingNode?.template.subtitle || '',
          description: editingNode?.template.description || '',
          icon: editingNode?.template.icon || '',
          variant: editingNode?.template.variant || 'gray-600',
          type: editingNode?.template.type || 'script',
          properties: editingNode?.template.properties || {} as any,
          propertyValues: editingNode?.template.properties ? Object.entries(editingNode?.template.properties as any) : {},
          shape: editingNode?.template.shape || 'rectangle',
          ports: editingNode?.template.ports || [],
          requiredEnvVars: editingNode?.template.requiredEnvVars || [],
        }}
        onNodeCreated={(nodeTemplate) => {
          // Save the custom node template
          saveCustomNode(nodeTemplate, !!editingNode)
          
          // Only add to canvas if not editing
          if (!editingNode) {
            // Create a unique instance of the node template
            const instanceMetadata = {
              ...nodeTemplate,
              id: `${nodeTemplate.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              propertyValues: nodeTemplate.propertyValues || {}
            }
            
            // Find an empty area for the new custom node
            let position: { x: number; y: number }
            if (canvasOffset && canvasZoom && viewportSize) {
              const viewportCenterX = viewportSize.width / 2
              const viewportCenterY = viewportSize.height / 2
              const worldCenterX = (viewportCenterX - canvasOffset.x) / canvasZoom
              const worldCenterY = (viewportCenterY - canvasOffset.y) / canvasZoom
              
              position = findEmptyArea(
                storeNodes,
                groups,
                { width: 200, height: 100 },
                { x: worldCenterX, y: worldCenterY }
              )
            } else {
              position = findEmptyArea(storeNodes, groups)
            }
            
            const addedNodeId = addNode(instanceMetadata, position)
            if (addedNodeId) {
              setGraphDirty(currentGraphId, true)
              
              // Pan canvas to the new node and highlight it
              if (canvasOffset && canvasZoom && viewportSize && onCanvasOffsetChange && onHighlightNode) {
                const targetOffset = calculatePanToCenter(
                  position,
                  viewportSize,
                  canvasOffset,
                  canvasZoom
                )
                
                animateCanvasPan(
                  canvasOffset,
                  targetOffset,
                  500,
                  (offset) => onCanvasOffsetChange(offset),
                  () => {
                    onHighlightNode(addedNodeId)
                    setTimeout(() => onHighlightNode(''), 2000)
                  }
                )
              }
              
              if (onNodeAdded) {
                onNodeAdded(addedNodeId)
              }
            }
            onClose() // Close the search modal
          }
          
          setIsNodeCreatorOpen(false)
          setEditingNode(null)
        }}
      />
      
      {/* Subgraph Port Selector Modal - render outside of main modal to avoid z-index issues */}
      {portSelectorState.isOpen && (
        <SubgraphPortSelector
          isOpen={portSelectorState.isOpen}
          onClose={() => setPortSelectorState({ isOpen: false, subgraphId: '', subgraphName: '' })}
          subgraphId={portSelectorState.subgraphId}
          subgraphName={portSelectorState.subgraphName}
          canvasOffset={canvasOffset}
          canvasZoom={canvasZoom}
          onSelectPort={(nodeId, portId, portType) => {
            // Close both modals after creating the proxy node
            setPortSelectorState({ isOpen: false, subgraphId: '', subgraphName: '' })
            onClose()
          }}
        />
      )}
    </div>
  )
}