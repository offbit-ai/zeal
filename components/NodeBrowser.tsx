'use client'

import { useState, useEffect } from 'react'
import { X, Grid, List, Search, Eye, Trash2, Copy, ExternalLink } from 'lucide-react'
import { useWorkflowStore } from '@/store/workflowStore'
import { ModalPortal } from './ModalPortal'

interface NodeBrowserProps {
  isOpen: boolean
  onClose: () => void
  onNodeSelect?: (nodeId: string, position: { x: number; y: number }) => void
}

type ViewMode = 'grid' | 'list'
type SortBy = 'name' | 'type' | 'connections' | 'position'

export function NodeBrowser({ isOpen, onClose, onNodeSelect }: NodeBrowserProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [sortBy, setSortBy] = useState<SortBy>('position')
  const [searchQuery, setSearchQuery] = useState('')
  
  const { nodes, connections, removeNode } = useWorkflowStore()

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true)
        })
      })
    } else {
      setIsAnimating(false)
      const timer = setTimeout(() => {
        setIsVisible(false)
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Get connection counts for each node
  const getNodeConnectionCount = (nodeId: string) => {
    const incoming = connections.filter(conn => conn.target.nodeId === nodeId).length
    const outgoing = connections.filter(conn => conn.source.nodeId === nodeId).length
    return { incoming, outgoing, total: incoming + outgoing }
  }

  // Filter nodes based on search
  const filteredNodes = nodes.filter(node => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      node.metadata.title.toLowerCase().includes(query) ||
      node.metadata.type.toLowerCase().includes(query) ||
      (node.metadata.subtitle && node.metadata.subtitle.toLowerCase().includes(query))
    )
  })

  // Sort nodes
  const sortedNodes = [...filteredNodes].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.metadata.title.localeCompare(b.metadata.title)
      case 'type':
        return a.metadata.type.localeCompare(b.metadata.type)
      case 'connections':
        return getNodeConnectionCount(b.metadata.id).total - getNodeConnectionCount(a.metadata.id).total
      case 'position':
      default:
        return a.position.x - b.position.x || a.position.y - b.position.y
    }
  })

  const handleNodeClick = (nodeId: string, position: { x: number; y: number }) => {
    onNodeSelect?.(nodeId, position)
    onClose()
  }

  const handleDuplicate = (e: React.MouseEvent, nodeIndex: number) => {
    e.stopPropagation()
    const node = sortedNodes[nodeIndex]
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

  if (!isVisible) return null

  return (
    <ModalPortal isOpen={isOpen}>
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
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Workflow Nodes</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {nodes.length} nodes • {connections.length} connections
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded transition-colors ${
                    viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title="List View"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded transition-colors ${
                    viewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title="Grid View"
                >
                  <Grid className="w-4 h-4" />
                </button>
              </div>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
              >
                <option value="position">By Position</option>
                <option value="name">By Name</option>
                <option value="type">By Type</option>
                <option value="connections">By Connections</option>
              </select>

              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 rounded-md transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search nodes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
                autoFocus
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {sortedNodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Search className="w-12 h-12 mb-4 text-gray-300" />
                <p className="text-lg font-medium">No nodes found</p>
                <p className="text-sm mt-1">Try adjusting your search criteria</p>
              </div>
            ) : viewMode === 'list' ? (
              <div className="space-y-2">
                {sortedNodes.map((node, index) => {
                  const connections = getNodeConnectionCount(node.metadata.id)
                  return (
                    <div
                      key={node.metadata.id}
                      className="group flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md hover:border-gray-300 transition-all duration-200 cursor-pointer"
                      onClick={() => handleNodeClick(node.metadata.id, node.position)}
                    >
                      {/* Icon */}
                      <div className={`p-2 rounded-lg ${
                        node.metadata.variant === 'black' ? 'bg-black' :
                        node.metadata.variant === 'gray-700' ? 'bg-gray-700' :
                        node.metadata.variant === 'gray-600' ? 'bg-gray-600' :
                        'bg-gray-500'
                      }`}>
                        <node.metadata.icon className="w-5 h-5 text-white" />
                      </div>

                      {/* Info */}
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2">
                          <h3 className="font-medium text-gray-900">{node.metadata.title}</h3>
                          <span className="text-xs text-gray-500">#{index + 1}</span>
                        </div>
                        {node.metadata.subtitle && (
                          <p className="text-sm text-gray-500">{node.metadata.subtitle}</p>
                        )}
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                          <span>Type: {node.metadata.type}</span>
                          <span>•</span>
                          <span>{connections.incoming} in, {connections.outgoing} out</span>
                          <span>•</span>
                          <span>({Math.round(node.position.x)}, {Math.round(node.position.y)})</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleDuplicate(e, index)}
                          className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                          title="Duplicate Node"
                        >
                          <Copy className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, node.metadata.id)}
                          className="p-1.5 hover:bg-red-50 rounded transition-colors"
                          title="Delete Node"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                        <ExternalLink className="w-4 h-4 text-gray-400 ml-2" />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {sortedNodes.map((node, index) => {
                  const connections = getNodeConnectionCount(node.metadata.id)
                  return (
                    <div
                      key={node.metadata.id}
                      className="group bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-gray-300 transition-all duration-200 cursor-pointer"
                      onClick={() => handleNodeClick(node.metadata.id, node.position)}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className={`p-2 rounded-lg ${
                          node.metadata.variant === 'black' ? 'bg-black' :
                          node.metadata.variant === 'gray-700' ? 'bg-gray-700' :
                          node.metadata.variant === 'gray-600' ? 'bg-gray-600' :
                          'bg-gray-500'
                        }`}>
                          <node.metadata.icon className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xs text-gray-500">#{index + 1}</span>
                      </div>

                      {/* Title */}
                      <h3 className="font-medium text-gray-900 mb-1">{node.metadata.title}</h3>
                      {node.metadata.subtitle && (
                        <p className="text-xs text-gray-500 mb-2">{node.metadata.subtitle}</p>
                      )}

                      {/* Stats */}
                      <div className="space-y-1 text-xs text-gray-500">
                        <div>Type: {node.metadata.type}</div>
                        <div>{connections.total} connections</div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleDuplicate(e, index)}
                          className="flex-1 p-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                        >
                          Duplicate
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, node.metadata.id)}
                          className="flex-1 p-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}