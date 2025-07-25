'use client'

import { useState, useEffect } from 'react'
import { InteractiveCanvas } from '@/components/InteractiveCanvas'
import { WorkflowSidebar } from '@/components/WorkflowSidebar'
import { WorkflowBottomToolbar } from '@/components/WorkflowBottomToolbar'
import { SearchButton } from '@/components/SearchButton'
import { UndoRedoButtons } from '@/components/UndoRedoButtons'
import { SearchModal } from '@/components/SearchModal'
import { DraggableNode } from '@/components/DraggableNode'
import { Minimap } from '@/components/Minimap'
import { Save, Upload, Play } from 'lucide-react'
import type { NodeMetadata, Connection } from '@/types/workflow'
import { Database, Code, Bot, Cloud, Zap, GitBranch, Shuffle } from 'lucide-react'
import { useNodeBounds } from '@/hooks/useNodeBounds'
import { usePortPositions } from '@/hooks/usePortPositions'
import { useConnectionDrag } from '@/hooks/useConnectionDrag'
import { ConnectionLines } from '@/components/ConnectionLines'
import { DragConnectionLine } from '@/components/DragConnectionLine'
import { DeleteConnectionDialog } from '@/components/DeleteConnectionDialog'
import { PropertyPane } from '@/components/PropertyPane'
import { ModalPortal } from '@/components/ModalPortal'
import { useWorkflowStore } from '@/store/workflowStore'

// Sample nodes metadata
const nodes: NodeMetadata[] = [
  {
    id: '1',
    type: 'database',
    title: 'Get Database',
    subtitle: 'getAll: databasePage',
    icon: Database,
    variant: 'black',
    shape: 'rectangle',
    size: 'medium',
    ports: [
      { id: 'db-out-1', label: 'Records', type: 'output', position: 'right' },
      { id: 'db-out-2', label: 'Count', type: 'output', position: 'bottom' }
    ],
    properties: [
      { id: 'table', label: 'Table Name', type: 'text', required: true, placeholder: 'e.g., users' },
      { id: 'operation', label: 'Operation', type: 'select', options: ['getAll', 'getById', 'query'], defaultValue: 'getAll' },
      { id: 'limit', label: 'Limit', type: 'number', defaultValue: 100 },
      { id: 'conditions', label: 'WHERE Conditions', type: 'textarea', placeholder: 'e.g., status = "active"' },
      { 
        id: 'filterRules', 
        label: 'Filter Rules', 
        type: 'rules',
        availableFields: ['id', 'status', 'created_at', 'updated_at', 'email', 'name'],
        availableOperators: ['is', 'is_not', 'contains', 'greater_than', 'less_than', 'empty', 'not_empty'],
        description: 'Advanced filtering rules for database queries'
      }
    ],
    propertyValues: {
      table: 'databasePage',
      operation: 'getAll',
      limit: 100,
      conditions: '',
      filterRules: []
    }
  },
  {
    id: '2',
    type: 'code',
    title: 'Update CRM',
    icon: Code,
    variant: 'gray-700',
    shape: 'rectangle',
    size: 'medium',
    ports: [
      { id: 'crm-in-1', label: 'Data', type: 'input', position: 'left' },
      { id: 'crm-in-2', label: 'Config', type: 'input', position: 'top' },
      { id: 'crm-out-1', label: 'Result', type: 'output', position: 'right' },
      { id: 'crm-out-2', label: 'Error', type: 'output', position: 'bottom' }
    ],
    properties: [
      { id: 'endpoint', label: 'API Endpoint', type: 'text', required: true, placeholder: 'https://api.crm.com/update' },
      { id: 'method', label: 'HTTP Method', type: 'select', options: ['POST', 'PUT', 'PATCH', 'GET'], defaultValue: 'POST' },
      { id: 'timeout', label: 'Timeout (ms)', type: 'number', defaultValue: 5000 },
      { id: 'retry', label: 'Retry on Failure', type: 'boolean', defaultValue: true }
    ],
    propertyValues: {
      endpoint: '',
      method: 'POST',
      timeout: 5000,
      retry: true
    }
  },
  {
    id: '3',
    type: 'service',
    title: 'Claude',
    icon: Bot,
    variant: 'black',
    shape: 'circle',
    size: 'medium',
    ports: [
      { id: 'ai-in-1', label: 'Prompt', type: 'input', position: 'left' },
      { id: 'ai-in-2', label: 'Context', type: 'input', position: 'top' },
      { id: 'ai-out-1', label: 'Response', type: 'output', position: 'right' }
    ],
    properties: [
      { id: 'model', label: 'Model', type: 'select', options: ['claude-3-5-sonnet', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'], defaultValue: 'claude-3-5-sonnet' },
      { id: 'maxTokens', label: 'Max Tokens', type: 'number', defaultValue: 1000 },
      { id: 'temperature', label: 'Temperature', type: 'number', defaultValue: 0.7 },
      { id: 'systemPrompt', label: 'System Prompt', type: 'textarea', placeholder: 'You are a helpful assistant...', description: 'Define the AI assistant behavior and context' },
      { 
        id: 'responseRules', 
        label: 'Response Processing Rules', 
        type: 'rules',
        availableFields: ['Response Length', 'Confidence Score', 'Content Type', 'Language', 'Sentiment', 'Topic'],
        availableOperators: ['is', 'is_not', 'contains', 'not_contains', 'greater_than', 'less_than'],
        description: 'Define rules to process and route AI responses based on content analysis'
      }
    ],
    propertyValues: {
      model: 'claude-3-5-sonnet',
      maxTokens: 1000,
      temperature: 0.7,
      systemPrompt: '',
      responseRules: []
    }
  },
  {
    id: '4',
    type: 'condition',
    title: 'Branch',
    icon: GitBranch,
    variant: 'gray-700',
    shape: 'diamond',
    size: 'medium',
    ports: [
      { id: 'branch-in', label: 'Input', type: 'input', position: 'top' },
      { id: 'branch-out-1', label: 'True', type: 'output', position: 'right' },
      { id: 'branch-out-2', label: 'False', type: 'output', position: 'bottom' }
    ],
    properties: [
      { 
        id: 'decisionRules', 
        label: 'Decision Rules', 
        type: 'rules',
        availableFields: ['TRG ID: Sellthrough', 'TRG ID: Category', 'TRG ID: Price', 'TRG ID: Quantity', 'TRG ID: Date', 'Status', 'Count', 'Amount'],
        availableOperators: ['is', 'is_not', 'contains', 'not_contains', 'greater_than', 'less_than', 'greater_equal', 'less_equal', 'empty', 'not_empty'],
        description: 'Define the conditions that determine True or False output. If any rule set evaluates to true, the True port will be activated.'
      }
    ],
    propertyValues: {
      decisionRules: []
    }
  },
  {
    id: '5',
    type: 'transformer',
    title: 'Data Transformer',
    subtitle: 'Transform & Process Data',
    icon: Shuffle,
    variant: 'gray-600',
    shape: 'rectangle',
    size: 'medium',
    ports: [
      { id: 'transform-in-1', label: 'Input Data', type: 'input', position: 'left' },
      { id: 'transform-in-2', label: 'Schema', type: 'input', position: 'top' },
      { id: 'transform-out-1', label: 'Transformed', type: 'output', position: 'right' },
      { id: 'transform-out-2', label: 'Errors', type: 'output', position: 'bottom' }
    ],
    properties: [
      { 
        id: 'dataOperations', 
        label: 'Data Operations', 
        type: 'dataOperations',
        availableFields: ['id', 'name', 'email', 'status', 'created_at', 'updated_at', 'first_name', 'last_name', 'age', 'department', 'salary', 'role', 'address', 'phone'],
        description: 'Configure data transformation pipelines including mapping, filtering, sorting, and aggregation'
      },
      { id: 'errorHandling', label: 'Error Handling', type: 'select', options: ['ignore', 'skip_item', 'stop_pipeline', 'log_and_continue'], defaultValue: 'log_and_continue' },
      { id: 'batchSize', label: 'Batch Size', type: 'number', defaultValue: 1000, description: 'Number of items to process in each batch' },
      { id: 'enableValidation', label: 'Enable Validation', type: 'boolean', defaultValue: true, description: 'Validate data before and after transformation' }
    ],
    propertyValues: {
      dataOperations: [],
      errorHandling: 'log_and_continue',
      batchSize: 1000,
      enableValidation: true
    }
  }
]

export default function Home() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isPropertyPaneOpen, setIsPropertyPaneOpen] = useState(false)
  const [isPropertyPaneVisible, setIsPropertyPaneVisible] = useState(false)
  const [isPropertyPaneClosing, setIsPropertyPaneClosing] = useState(false)
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 })
  const [viewportSize, setViewportSize] = useState({ width: 1200, height: 800 })
  const { updateNodeBounds, getNodeBoundsArray } = useNodeBounds()
  const { updatePortPosition, getPortPosition } = usePortPositions()
  
  // Zustand store
  const { 
    nodes: storeNodes, 
    connections, 
    initialized,
    addConnection, 
    removeConnection, 
    updateConnectionState, 
    updateNodePosition,
    setInitialized,
    undo,
    redo,
    canUndo,
    canRedo
  } = useWorkflowStore()
  
  const { dragState, startDrag, updateDrag, endDrag } = useConnectionDrag(connections)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [connectionToDelete, setConnectionToDelete] = useState<string | null>(null)
  
  // Initialize store with sample nodes if empty (run only once)
  useEffect(() => {
    if (!initialized && storeNodes.length === 0) {
      nodes.forEach((node, index) => {
        // Arrange nodes in a grid layout based on metadata
        const cols = 3
        const col = index % cols
        const row = Math.floor(index / cols)
        const position = {
          x: 200 + col * 300,
          y: 150 + row * 200
        }
        useWorkflowStore.getState().addNode(node, position)
      })
      setInitialized(true)
    }
  }, [initialized, storeNodes.length, setInitialized])
  
  useEffect(() => {
    const updateViewportSize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight - 60 // Subtract header height
      })
    }
    
    updateViewportSize()
    window.addEventListener('resize', updateViewportSize)
    return () => window.removeEventListener('resize', updateViewportSize)
  }, [])

  const handleNodePositionChange = (nodeId: string, position: { x: number; y: number }) => {
    updateNodePosition(nodeId, position)
  }

  // Handle node selection
  const handleNodeSelect = (nodeId: string) => {
    setSelectedNodeId(nodeId)
    setIsPropertyPaneOpen(true)
    setIsPropertyPaneVisible(true)
    setIsPropertyPaneClosing(false)
  }

  // Handle property pane close
  const handlePropertyPaneClose = () => {
    setIsPropertyPaneClosing(true)
    // Wait for animation to complete before hiding
    setTimeout(() => {
      setIsPropertyPaneVisible(false)
      setIsPropertyPaneOpen(false)
      setIsPropertyPaneClosing(false)
      setSelectedNodeId(null)
    }, 300) // Match animation duration
  }
  
  const handlePortDragStart = (nodeId: string, portId: string, portType: 'input' | 'output') => {
    const portPosition = getPortPosition(nodeId, portId)
    
    if (portPosition) {
      startDrag(nodeId, portId, portType, { x: portPosition.x, y: portPosition.y })
    } else {
      // If port position isn't available yet, try again after a short delay
      setTimeout(() => {
        const delayedPosition = getPortPosition(nodeId, portId)
        if (delayedPosition) {
          startDrag(nodeId, portId, portType, { x: delayedPosition.x, y: delayedPosition.y })
        }
      }, 100)
    }
  }
  
  const handlePortDragEnd = (nodeId: string, portId: string, portType: 'input' | 'output') => {
    // Only process if we're currently dragging
    if (dragState.isDragging) {
      const newConnection = endDrag(nodeId, portId, portType)
      if (newConnection) {
        // New connections start in pending state by default
        addConnection({ 
          ...newConnection, 
          state: 'pending' as const 
        })
      }
    }
  }
  
  
  // Handle connection click for deletion
  const handleConnectionClick = (connectionId: string) => {
    setConnectionToDelete(connectionId)
    setDeleteDialogOpen(true)
  }
  
  // Confirm connection deletion
  const handleDeleteConnection = () => {
    if (connectionToDelete) {
      removeConnection(connectionToDelete)
      setConnectionToDelete(null)
      setDeleteDialogOpen(false)
    }
  }
  
  // Cancel connection deletion
  const handleCancelDelete = () => {
    setConnectionToDelete(null)
    setDeleteDialogOpen(false)
  }
  
  // Handle mouse move for drag line
  useEffect(() => {
    if (!dragState.isDragging) return
    
    const handleMouseMove = (e: MouseEvent) => {
      const canvas = document.querySelector('.relative.w-full.h-full.overflow-hidden')
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        // Account for canvas offset
        updateDrag({
          x: e.clientX - rect.left - canvasOffset.x,
          y: e.clientY - rect.top - canvasOffset.y
        })
      }
    }
    
    const handleMouseUp = () => {
      endDrag(null, null, null)
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragState.isDragging, canvasOffset, updateDrag, endDrag])
  
  // Keyboard shortcuts for testing connection states and undo/redo
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Press '1', '2', '3', '4' to set the first connection to different states
      if (['1', '2', '3', '4'].includes(e.key) && connections.length > 0) {
        const states: ('pending' | 'warning' | 'error' | 'success')[] = ['pending', 'warning', 'error', 'success']
        const stateIndex = parseInt(e.key) - 1
        const firstConnectionId = connections[0].id
        updateConnectionState(firstConnectionId, states[stateIndex])
      }
      
      // Undo/Redo shortcuts (Cmd+Z / Cmd+Shift+Z)
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault()
          undo()
        } else if (e.key === 'z' && e.shiftKey) {
          e.preventDefault()
          redo()
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [connections, undo, redo])


  const categories = [
    {
      id: 'connections',
      title: 'Connections',
      items: [
        { id: '1', title: 'Database', icon: Database },
        { id: '2', title: 'API', icon: Cloud },
        { id: '3', title: 'Webhook', icon: Zap },
      ]
    },
    {
      id: 'actions',
      title: 'Actions',
      items: [
        { id: '4', title: 'Data Transformer', icon: Shuffle },
        { id: '5', title: 'Code Block', icon: Code },
        { id: '6', title: 'AI Assistant', icon: Bot },
        { id: '7', title: 'Branch Logic', icon: GitBranch },
      ]
    }
  ]

  return (
    <main className="flex h-screen flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-medium text-gray-900">Zeal</h1>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors">
            <Save className="w-3.5 h-3.5" />
            Save
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors">
            <Upload className="w-3.5 h-3.5" />
            Publish
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors">
            <Play className="w-3.5 h-3.5" />
            Run
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex relative overflow-hidden">
        <div className="flex-1 relative overflow-hidden">
        <InteractiveCanvas offset={canvasOffset} onOffsetChange={setCanvasOffset}>
          {/* Connection Lines - render before nodes so they appear behind */}
          <ConnectionLines connections={connections} getPortPosition={getPortPosition} onConnectionClick={handleConnectionClick} />
          
          {/* Drag connection line */}
          {dragState.isDragging && dragState.sourceNodeId && dragState.sourcePortId && dragState.currentPosition && (() => {
            const sourcePos = getPortPosition(dragState.sourceNodeId, dragState.sourcePortId)
            return sourcePos ? (
              <DragConnectionLine
                sourcePosition={sourcePos}
                currentPosition={dragState.currentPosition}
              />
            ) : null
          })()}
          
          {/* Workflow Nodes */}
          {storeNodes.map(node => (
            <DraggableNode
              key={node.metadata.id}
              metadata={node.metadata}
              initialPosition={node.position}
              onPositionChange={handleNodePositionChange}
              onBoundsChange={updateNodeBounds}
              onPortPositionUpdate={updatePortPosition}
              onPortDragStart={handlePortDragStart}
              onPortDragEnd={handlePortDragEnd}
              onClick={handleNodeSelect}
            />
          ))}
        </InteractiveCanvas>

        {/* Floating UI Components */}
        <WorkflowSidebar 
          categories={categories} 
          isCollapsed={isSidebarCollapsed}
          // onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
        
        <SearchButton onClick={() => setIsSearchOpen(true)} />
        <UndoRedoButtons onUndo={undo} onRedo={redo} canUndo={canUndo()} canRedo={canRedo()} />
        <WorkflowBottomToolbar 
          onHistoryClick={() => {}}
          onDebuggerClick={() => {}}
        />
        
        <Minimap
          canvasOffset={canvasOffset}
          nodes={getNodeBoundsArray().map(bounds => ({
            id: bounds.id,
            position: { x: bounds.x, y: bounds.y },
            size: { width: bounds.width, height: bounds.height }
          }))}
          viewportSize={viewportSize}
          onViewportChange={setCanvasOffset}
        />
        </div>

        {/* Property Pane */}
        {isPropertyPaneVisible && (
          <div className="absolute inset-0 z-30 flex">
            {/* Backdrop */}
            <div 
              className={`flex-1 bg-black/20 transition-opacity duration-300 ${
                isPropertyPaneClosing ? 'opacity-0' : 'opacity-100'
              }`}
              onClick={handlePropertyPaneClose}
            />
            {/* Property Pane */}
            <PropertyPane
              selectedNodeId={selectedNodeId}
              onClose={handlePropertyPaneClose}
              isClosing={isPropertyPaneClosing}
            />
          </div>
        )}
      </div>

      {/* Search Modal */}
      <ModalPortal isOpen={isSearchOpen}>
        <SearchModal 
          isOpen={isSearchOpen} 
          onClose={() => setIsSearchOpen(false)} 
        />
      </ModalPortal>
      
      {/* Delete Connection Dialog */}
      <ModalPortal isOpen={deleteDialogOpen}>
        <DeleteConnectionDialog
          isOpen={deleteDialogOpen}
          onConfirm={handleDeleteConnection}
          onCancel={handleCancelDelete}
        />
      </ModalPortal>
    </main>
  )
}