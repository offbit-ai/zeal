import { Search, X, Download, Plus, Check, Filter, Code, Edit3 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNodeRepository, NodeRepositoryItem } from '@/store/nodeRepository'
import { useWorkflowStore } from '@/store/workflowStore'
import { updateDynamicNodeMetadata } from '@/utils/dynamicNodeMetadata'
import { Icon } from '@/lib/icons'
import { NodeCreatorModal } from './NodeCreatorModal'

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
  initialCategory?: string | null
  onNodeAdded?: (nodeId: string) => void
}

export function SearchModal({ isOpen, onClose, initialCategory, onNodeAdded }: SearchModalProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isNodeCreatorOpen, setIsNodeCreatorOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'repository' | 'custom'>('repository')
  const [customNodes, setCustomNodes] = useState<NodeRepositoryItem[]>([])
  const [editingNode, setEditingNode] = useState<NodeRepositoryItem | null>(null)
  
  const {
    categories,
    filteredNodes,
    searchQuery,
    selectedCategory,
    selectedSubcategory,
    setSearchQuery,
    setSelectedCategory,
    setSelectedSubcategory,
    installNode,
    uninstallNode
  } = useNodeRepository()

  const { addNode } = useWorkflowStore()

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
      subtitle: nodeTemplate.subtitle,
      type: nodeTemplate.type,
      category: 'Custom',
      subcategory: nodeTemplate.type === 'script' ? 'Scripts' : 'APIs',
      metadata: nodeTemplate,
      isInstalled: true,
      installSize: '0 KB',
      downloads: 0,
      lastUpdated: new Date().toISOString()
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
  }, [isOpen, initialCategory, setSearchQuery, setSelectedCategory])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const handleAddToCanvas = async (nodeItem: NodeRepositoryItem) => {
    console.log('🔍 SEARCH: Adding node from search modal:', {
      id: nodeItem.id,
      hasMetadata: !!nodeItem.metadata,
      metadataKeys: nodeItem.metadata ? Object.keys(nodeItem.metadata) : [],
      hasPropertyRules: !!nodeItem.metadata?.propertyRules,
      propertyRules: nodeItem.metadata?.propertyRules
    })
    
    if (!nodeItem.isInstalled) {
      installNode(nodeItem.id)
    }
    
    // Initialize property values with defaults from the template
    const propertyValues: Record<string, any> = {}
    if (nodeItem.metadata.properties) {
      nodeItem.metadata.properties.forEach((prop: any) => {
        if (prop.defaultValue !== undefined) {
          propertyValues[prop.id] = prop.defaultValue
        }
      })
    }
    
    // Create a new instance with unique ID from the template
    let instanceMetadata = {
      ...nodeItem.metadata,
      id: `${nodeItem.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Generate unique instance ID
      propertyValues // Include initialized property values
    }
    
    console.log('🔍 SEARCH: Instance metadata after creation:', {
      hasPropertyRules: !!instanceMetadata.propertyRules,
      metadataKeys: Object.keys(instanceMetadata),
      propertyRules: instanceMetadata.propertyRules
    })
    
    // Apply dynamic metadata updates based on default values
    try {
      instanceMetadata = await updateDynamicNodeMetadata(instanceMetadata, propertyValues, nodeItem.metadata.propertyRules)
    } catch (error) {
      console.error('Failed to apply initial dynamic metadata:', error)
    }
    
    // Add to canvas at center with slight randomization
    const position = {
      x: 400 + Math.random() * 200 - 100,
      y: 200 + Math.random() * 200 - 100
    }
    
    const addedNodeId = addNode(instanceMetadata, position)
    if (addedNodeId && onNodeAdded) {
      onNodeAdded(addedNodeId)
    }
    onClose()
  }

  const getStatusBadge = (node: NodeRepositoryItem) => {
    if (node.isBuiltIn) {
      return <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">Built-in</span>
    }
    if (node.isInstalled) {
      return <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded">Installed</span>
    }
    return <span className="text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Available</span>
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
                    <category.icon className="w-4 h-4" />
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
                            <Icon name={node.metadata.icon} className="w-5 h-5 text-gray-700" />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">{node.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              {getStatusBadge(node)}
                              {node.version && (
                                <span className="text-xs text-gray-500">v{node.version}</span>
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
                        <button
                          onClick={() => handleAddToCanvas(node)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add to Canvas
                        </button>
                        
                        {!node.isBuiltIn && (
                          <button
                            onClick={() => 
                              node.isInstalled ? uninstallNode(node.id) : installNode(node.id)
                            }
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                              node.isInstalled
                                ? 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                                : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {node.isInstalled ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                Installed
                              </>
                            ) : (
                              <>
                                <Download className="w-3.5 h-3.5" />
                                Install
                              </>
                            )}
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
          ) : (
            /* Custom Nodes Tab */
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="space-y-6">
                {/* Group by type */}
                {['Scripts', 'APIs'].map(type => {
                  const nodesOfType = customNodes.filter(node => 
                    type === 'Scripts' ? node.metadata.type === 'script' : node.metadata.type === 'api'
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
                                  name={node.metadata.icon}
                                  source={node.metadata.icon && ['python', 'javascript', 'openai', 'aws', 'google', 'slack', 'github', 'mongodb', 'postgresql', 'mysql', 'redis'].includes(node.metadata.icon) ? 'brand' : 'lucide'}
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
                              <h4 className="font-medium text-gray-900 mb-1">{node.metadata.title}</h4>
                              <p className="text-sm text-gray-500 line-clamp-2">
                                {node.metadata.subtitle || `Custom ${node.metadata.type} node`}
                              </p>
                            </div>
                            
                            {/* Node Info */}
                            <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                              <span className="flex items-center gap-1">
                                <Code className="w-3 h-3" />
                                {node.metadata.type === 'script' ? 
                                  (node.metadata.variant?.includes('blue') ? 'Python' : 'JavaScript') : 
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
          )}
        </div>
      </div>
      
      {/* Node Creator Modal */}
      <NodeCreatorModal
        isOpen={isNodeCreatorOpen}
        onClose={() => {
          setIsNodeCreatorOpen(false)
          setEditingNode(null)
        }}
        editingNode={editingNode?.metadata}
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
            
            // Add to canvas at center with slight randomization
            const position = {
              x: 400 + Math.random() * 200 - 100,
              y: 200 + Math.random() * 200 - 100
            }
            
            const addedNodeId = addNode(instanceMetadata, position)
            if (addedNodeId && onNodeAdded) {
              onNodeAdded(addedNodeId)
            }
            onClose() // Close the search modal
          }
          
          setIsNodeCreatorOpen(false)
          setEditingNode(null)
        }}
      />
    </div>
  )
}