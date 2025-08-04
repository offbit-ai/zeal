'use client'

import React, { useState, useMemo } from 'react'
import { X, Search, ArrowRight, ArrowLeft, Link } from 'lucide-react'
import { useWorkflowStore } from '@/store/workflow-store'
import { Icon } from '@/lib/icons'
import { ModalPortal } from './ModalPortal'
import type { WorkflowGraph } from '@/types/snapshot'

interface SubgraphPortSelectorProps {
  isOpen: boolean
  onClose: () => void
  subgraphId: string
  subgraphName: string
  canvasOffset?: { x: number; y: number }
  canvasZoom?: number
  onSelectPort: (nodeId: string, portId: string, portType: 'input' | 'output') => void
}

export function SubgraphPortSelector({
  isOpen,
  onClose,
  subgraphId,
  subgraphName,
  canvasOffset,
  canvasZoom,
  onSelectPort,
}: SubgraphPortSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const { addNode, graphs, nodes, currentGraphId, getNodesForGraph } = useWorkflowStore()
  const setGraphDirty = (graphId: string, isDirty: boolean) => {
    // TODO: Track dirty state locally if needed
  }

  // [SubgraphPortSelector] log removed

  // Get the subgraph data
  const subgraph = graphs.find(g => g.id === subgraphId)

  // Get nodes from the subgraph
  const subgraphNodes = useMemo(() => {
    const nodes = getNodesForGraph(subgraphId)
    // [SubgraphPortSelector] log removed
    return nodes
  }, [subgraphId, getNodesForGraph])

  // Filter nodes based on search
  const filteredNodes = useMemo(() => {
    if (!searchQuery) return subgraphNodes

    const query = searchQuery.toLowerCase()
    return subgraphNodes.filter(
      node =>
        node.metadata.title.toLowerCase().includes(query) ||
        node.metadata.type.toLowerCase().includes(query)
    )
  }, [subgraphNodes, searchQuery])

  // Get selected node details
  const selectedNode = selectedNodeId
    ? subgraphNodes.find(n => n.metadata.id === selectedNodeId)
    : null

  const handleCreateProxyNode = (portId: string, portType: 'input' | 'output') => {
    if (!selectedNode) return

    // Only support input ports for proxy connections
    if (portType !== 'input') return

    // Generate a unique ID for the proxy node
    const proxyNodeId = `proxy_input_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    // Create the proxy node with pre-filled configuration
    const proxyNode = {
      id: proxyNodeId,
      templateId: 'proxy_input',
      type: 'graph-io',
      title: `${subgraphName}: ${selectedNode.metadata.title}`,
      subtitle: `Graph: ${subgraphId} | Port: ${portId}`,
      icon: 'link',
      variant: 'purple',
      shape: 'circle' as const,
      size: 'small' as const,
      requiredEnvVars: [],
      properties: {},
      ports: [
        {
          id: 'proxy',
          label: 'Proxy',
          type: 'input',
          position: 'left',
        },
      ],
      propertyValues: {
        subgraphId: subgraphId,
        targetNodeId: selectedNode.metadata.id,
        targetPortId: portId,
        description: `Proxy connection to ${selectedNode.metadata.title} (${portId}) in ${subgraphName}`,
      },
    }

    // Calculate position based on canvas viewport
    let position: { x: number; y: number }
    if (canvasOffset && canvasZoom !== undefined) {
      const viewportCenterX = window.innerWidth / 2
      const viewportCenterY = window.innerHeight / 2
      const worldCenterX = (viewportCenterX - canvasOffset.x) / canvasZoom
      const worldCenterY = (viewportCenterY - canvasOffset.y) / canvasZoom

      position = {
        x: worldCenterX + Math.random() * 100 - 50,
        y: worldCenterY + Math.random() * 100 - 50,
      }
    } else {
      position = {
        x: 400 + Math.random() * 200 - 100,
        y: 200 + Math.random() * 200 - 100,
      }
    }

    // Add the node to the current graph
    const nodeId = addNode(proxyNode as any, position)

    // Mark the graph as dirty if node was added successfully
    if (nodeId) {
      setGraphDirty(currentGraphId, true)
    }

    // Close the modal
    onClose()

    // Callback to parent
    onSelectPort(selectedNode.metadata.id, portId, portType)
  }

  // [SubgraphPortSelector] log removed

  return (
    <ModalPortal isOpen={isOpen}>
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-lg shadow-xl w-[800px] max-h-[600px] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Select Input Port from Subgraph
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Choose a node and input port from "{subgraphName}" to create a proxy connection
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Left Panel - Node List */}
            <div className="w-1/2 border-r border-gray-200 flex flex-col">
              {/* Search */}
              <div className="p-4 border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search nodes..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Node List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {filteredNodes.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">
                    {searchQuery ? 'No nodes found' : 'No nodes in this subgraph'}
                  </div>
                ) : (
                  filteredNodes.map(node => {
                    const isSelected = selectedNodeId === node.metadata.id

                    return (
                      <button
                        key={node.metadata.id}
                        onClick={() => setSelectedNodeId(node.metadata.id)}
                        className={`w-full p-3 rounded-lg transition-colors text-left ${
                          isSelected
                            ? 'bg-blue-50 border border-blue-500'
                            : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded ${isSelected ? 'bg-blue-100' : 'bg-gray-200'}`}
                          >
                            <Icon
                              name={node.metadata.icon || 'box'}
                              className="w-4 h-4 text-gray-700"
                            />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{node.metadata.title}</div>
                            <div className="text-xs text-gray-500">{node.metadata.type}</div>
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* Right Panel - Port List */}
            <div className="w-1/2 flex flex-col">
              {selectedNode ? (
                <>
                  {/* Selected Node Info */}
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded">
                        <Icon
                          name={selectedNode.metadata.icon || 'box'}
                          className="w-5 h-5 text-gray-700"
                        />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {selectedNode.metadata.title}
                        </div>
                        <div className="text-sm text-gray-500">
                          {selectedNode.metadata.subtitle}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Port Lists */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Input Ports */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
                        <ArrowRight className="w-4 h-4 text-gray-500" />
                        Input Ports
                      </h3>
                      <div className="space-y-2">
                        {selectedNode.metadata.ports
                          ?.filter(p => p.type === 'input')
                          .map(port => (
                            <button
                              key={port.id}
                              onClick={() => handleCreateProxyNode(port.id, 'input')}
                              className="w-full p-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors group"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <Link className="w-4 h-4 text-purple-600" />
                                  <div className="text-left">
                                    <div className="font-medium text-gray-900">{port.label}</div>
                                    <div className="text-xs text-gray-500">ID: {port.id}</div>
                                  </div>
                                </div>
                                <div className="text-xs text-gray-500 group-hover:text-gray-700">
                                  Create Proxy Input
                                </div>
                              </div>
                            </button>
                          ))}
                        {selectedNode.metadata.ports?.filter(p => p.type === 'input').length ===
                          0 && (
                          <div className="text-center text-gray-400 py-4 text-sm">
                            No input ports
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <Link className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Select a node to view its ports</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
