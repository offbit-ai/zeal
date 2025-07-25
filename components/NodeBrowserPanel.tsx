'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown, Trash2, Copy, ExternalLink } from 'lucide-react'
import { useWorkflowStore } from '@/store/workflowStore'

interface NodeBrowserPanelProps {
  isExpanded: boolean
  onNodeSelect?: (nodeId: string, position: { x: number; y: number }) => void
}

export function NodeBrowserPanel({ isExpanded, onNodeSelect }: NodeBrowserPanelProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['all']))
  const { nodes, connections, removeNode } = useWorkflowStore()

  // Group nodes by type
  const nodesByType = nodes.reduce((acc, node) => {
    const type = node.metadata.type
    if (!acc[type]) acc[type] = []
    acc[type].push(node)
    return acc
  }, {} as Record<string, typeof nodes>)

  // Get connection counts for each node
  const getNodeConnectionCount = (nodeId: string) => {
    const incoming = connections.filter(conn => conn.target.nodeId === nodeId).length
    const outgoing = connections.filter(conn => conn.source.nodeId === nodeId).length
    return { incoming, outgoing, total: incoming + outgoing }
  }

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  const handleNodeClick = (nodeId: string, position: { x: number; y: number }) => {
    onNodeSelect?.(nodeId, position)
  }

  const handleDuplicate = (e: React.MouseEvent, node: typeof nodes[0]) => {
    e.stopPropagation()
    const newMetadata = {
      ...node.metadata,
      id: `${node.metadata.id}-copy-${Date.now()}`
    }
    const newPosition = {
      x: node.position.x + 50,
      y: node.position.y + 50
    }
    useWorkflowStore.getState().addNode(newMetadata, newPosition)
  }

  const handleDelete = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    removeNode(nodeId)
  }

  return (
    <div className={`fixed right-0 top-[60px] bottom-0 w-64 bg-white border-l border-gray-200 flex flex-col transition-transform duration-300 ease-in-out z-20 ${
      isExpanded ? 'translate-x-0' : 'translate-x-full'
    }`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-900">Workflow Nodes</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          {nodes.length} nodes • {connections.length} connections
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* All Nodes Section */}
        <div>
          <button
            onClick={() => toggleCategory('all')}
            className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              {expandedCategories.has('all') ? (
                <ChevronDown className="w-3 h-3 text-gray-500" />
              ) : (
                <ChevronRight className="w-3 h-3 text-gray-500" />
              )}
              <span className="text-sm font-medium text-gray-700">All Nodes</span>
              <span className="text-xs text-gray-500">({nodes.length})</span>
            </div>
          </button>

          {expandedCategories.has('all') && (
            <div className="px-2 pb-2">
              {nodes.map((node, index) => {
                const connections = getNodeConnectionCount(node.metadata.id)
                return (
                  <div
                    key={node.metadata.id}
                    className="group flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    onClick={() => handleNodeClick(node.metadata.id, node.position)}
                  >
                    <div className={`p-1 rounded ${
                      node.metadata.variant === 'black' ? 'bg-black' :
                      node.metadata.variant === 'gray-700' ? 'bg-gray-700' :
                      node.metadata.variant === 'gray-600' ? 'bg-gray-600' :
                      'bg-gray-500'
                    }`}>
                      <node.metadata.icon className="w-3 h-3 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-900 truncate">
                        {node.metadata.title}
                      </div>
                      <div className="text-xs text-gray-500">
                        {connections.total} connections
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleDuplicate(e, node)}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title="Duplicate"
                      >
                        <Copy className="w-3 h-3 text-gray-500" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, node.metadata.id)}
                        className="p-1 hover:bg-red-100 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Grouped by Type */}
        {Object.entries(nodesByType).map(([type, typeNodes]) => (
          <div key={type}>
            <button
              onClick={() => toggleCategory(type)}
              className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {expandedCategories.has(type) ? (
                  <ChevronDown className="w-3 h-3 text-gray-500" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-gray-500" />
                )}
                <span className="text-sm font-medium text-gray-700 capitalize">{type}</span>
                <span className="text-xs text-gray-500">({typeNodes.length})</span>
              </div>
            </button>

            {expandedCategories.has(type) && (
              <div className="px-2 pb-2">
                {typeNodes.map((node) => {
                  const connections = getNodeConnectionCount(node.metadata.id)
                  return (
                    <div
                      key={node.metadata.id}
                      className="group flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      onClick={() => handleNodeClick(node.metadata.id, node.position)}
                    >
                      <div className={`p-1 rounded ${
                        node.metadata.variant === 'black' ? 'bg-black' :
                        node.metadata.variant === 'gray-700' ? 'bg-gray-700' :
                        node.metadata.variant === 'gray-600' ? 'bg-gray-600' :
                        'bg-gray-500'
                      }`}>
                        <node.metadata.icon className="w-3 h-3 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-900 truncate">
                          {node.metadata.title}
                        </div>
                        {node.metadata.subtitle && (
                          <div className="text-xs text-gray-400 truncate">
                            {node.metadata.subtitle}
                          </div>
                        )}
                      </div>
                      <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}