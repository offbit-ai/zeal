'use client'

import { useState, useEffect, useCallback } from 'react'
import { InteractiveCanvas } from '@/components/InteractiveCanvas'
import { WorkflowSidebar } from '@/components/WorkflowSidebar'
import { WorkflowBottomToolbar } from '@/components/WorkflowBottomToolbar'
import { SearchButton } from '@/components/SearchButton'
import { NodeBrowserButton } from '@/components/NodeBrowserButton'
import { UndoRedoButtons } from '@/components/UndoRedoButtons'
import { SearchModal } from '@/components/SearchModal'
import { NodeBrowserPanel } from '@/components/NodeBrowserPanel'
import { HistoryBrowser } from '@/components/HistoryBrowser'
import { FlowTracer } from '@/components/FlowTracer'
import { Configuration } from '@/components/Configuration'
import { MissingEnvVarWarning } from '@/components/MissingEnvVarWarning'
import { EnvVarService } from '@/services/envVarService'
import { useEnvVarStore } from '@/store/envVarStore'
import { DraggableNode } from '@/components/DraggableNode'
import { Minimap } from '@/components/Minimap'
import { ZoomControls } from '@/components/ZoomControls'
import { Save, Upload, Play } from 'lucide-react'
import { ToastManager } from '@/components/Toast'
import { simulatePublishedWorkflows } from '@/utils/simulatePublishedWorkflows'
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
import { ConfigurationToast } from '@/components/ConfigurationToast'
import { NodeGroupContainer } from '@/components/NodeGroupContainer'
import { SelectionRectangle } from '@/components/SelectionRectangle'
import { GroupCreationModal } from '@/components/GroupCreationModal'
import { useWorkflowStore } from '@/store/workflowStore'
import { WorkflowStorageService } from '@/services/workflowStorage'
import { hasUnconfiguredDefaults } from '@/utils/nodeConfigurationStatus'

// Sample nodes metadata
// const nodes: NodeMetadata[] = [
//   {
//     id: '1',
//     templateId: 'tpl_postgresql',
//     type: 'database',
//     title: 'Get Database',
//     subtitle: 'getAll: databasePage',
//     icon: Database,
//     variant: 'black',
//     shape: 'rectangle',
//     size: 'medium',
//     ports: [
//       { id: 'db-out-1', label: 'Records', type: 'output', position: 'right' },
//       { id: 'db-out-2', label: 'Count', type: 'output', position: 'bottom' }
//     ],
//     properties: [
//       { id: 'table', label: 'Table Name', type: 'text', required: true, placeholder: 'e.g., users' },
//       { id: 'operation', label: 'Operation', type: 'select', options: ['getAll', 'getById', 'query'], defaultValue: 'getAll' },
//       { id: 'limit', label: 'Limit', type: 'number', defaultValue: 100 },
//       { id: 'conditions', label: 'WHERE Conditions', type: 'textarea', placeholder: 'e.g., status = "active"' },
//       { 
//         id: 'filterRules', 
//         label: 'Filter Rules', 
//         type: 'rules',
//         availableFields: ['id', 'status', 'created_at', 'updated_at', 'email', 'name'],
//         availableOperators: ['is', 'is_not', 'contains', 'greater_than', 'less_than', 'empty', 'not_empty'],
//         description: 'Advanced filtering rules for database queries'
//       }
//     ],
//     requiredEnvVars: ['DATABASE_URL', 'DB_PASSWORD'],
//     propertyValues: {
//       table: 'databasePage',
//       operation: 'getAll',
//       limit: 100,
//       conditions: '',
//       filterRules: []
//     }
//   },
//   {
//     id: '2',
//     templateId: 'tpl_python_script',
//     type: 'code',
//     title: 'Update CRM',
//     icon: Code,
//     variant: 'gray-700',
//     shape: 'rectangle',
//     size: 'medium',
//     ports: [
//       { id: 'crm-in-1', label: 'Data', type: 'input', position: 'left' },
//       { id: 'crm-in-2', label: 'Config', type: 'input', position: 'top' },
//       { id: 'crm-out-1', label: 'Result', type: 'output', position: 'right' },
//       { id: 'crm-out-2', label: 'Error', type: 'output', position: 'bottom' }
//     ],
//     properties: [
//       { id: 'endpoint', label: 'API Endpoint', type: 'text', required: true, placeholder: 'https://api.crm.com/update' },
//       { id: 'method', label: 'HTTP Method', type: 'select', options: ['POST', 'PUT', 'PATCH', 'GET'], defaultValue: 'POST' },
//       { id: 'timeout', label: 'Timeout (ms)', type: 'number', defaultValue: 5000 },
//       { id: 'retry', label: 'Retry on Failure', type: 'boolean', defaultValue: true }
//     ],
//     requiredEnvVars: ['CRM_API_KEY', 'CRM_BASE_URL'],
//     propertyValues: {
//       endpoint: '',
//       method: 'POST',
//       timeout: 5000,
//       retry: true
//     }
//   },
//   {
//     id: '3',
//     templateId: 'tpl_gpt4',
//     type: 'service',
//     title: 'Claude',
//     icon: Bot,
//     variant: 'black',
//     shape: 'circle',
//     size: 'medium',
//     ports: [
//       { id: 'ai-in-1', label: 'Prompt', type: 'input', position: 'left' },
//       { id: 'ai-in-2', label: 'Context', type: 'input', position: 'top' },
//       { id: 'ai-out-1', label: 'Response', type: 'output', position: 'right' }
//     ],
//     properties: [
//       { id: 'model', label: 'Model', type: 'select', options: ['claude-3-5-sonnet', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'], defaultValue: 'claude-3-5-sonnet' },
//       { id: 'maxTokens', label: 'Max Tokens', type: 'number', defaultValue: 1000 },
//       { id: 'temperature', label: 'Temperature', type: 'number', defaultValue: 0.7 },
//       { id: 'systemPrompt', label: 'System Prompt', type: 'textarea', placeholder: 'You are a helpful assistant...', description: 'Define the AI assistant behavior and context' },
//       { 
//         id: 'responseRules', 
//         label: 'Response Processing Rules', 
//         type: 'rules',
//         availableFields: ['Response Length', 'Confidence Score', 'Content Type', 'Language', 'Sentiment', 'Topic'],
//         availableOperators: ['is', 'is_not', 'contains', 'not_contains', 'greater_than', 'less_than'],
//         description: 'Define rules to process and route AI responses based on content analysis'
//       }
//     ],
//     requiredEnvVars: ['ANTHROPIC_API_KEY'],
//     propertyValues: {
//       model: 'claude-3-5-sonnet',
//       maxTokens: 1000,
//       temperature: 0.7,
//       systemPrompt: '',
//       responseRules: []
//     }
//   },
//   {
//     id: '4',
//     templateId: 'tpl_branch',
//     type: 'condition',
//     title: 'Branch',
//     icon: GitBranch,
//     variant: 'gray-700',
//     shape: 'diamond',
//     size: 'medium',
//     ports: [
//       { id: 'branch-in', label: 'Input', type: 'input', position: 'top' },
//       { id: 'branch-out-1', label: 'True', type: 'output', position: 'right' },
//       { id: 'branch-out-2', label: 'False', type: 'output', position: 'bottom' }
//     ],
//     properties: [
//       { 
//         id: 'decisionRules', 
//         label: 'Decision Rules', 
//         type: 'rules',
//         availableFields: ['TRG ID: Sellthrough', 'TRG ID: Category', 'TRG ID: Price', 'TRG ID: Quantity', 'TRG ID: Date', 'Status', 'Count', 'Amount'],
//         availableOperators: ['is', 'is_not', 'contains', 'not_contains', 'greater_than', 'less_than', 'greater_equal', 'less_equal', 'empty', 'not_empty'],
//         description: 'Define the conditions that determine True or False output. If any rule set evaluates to true, the True port will be activated.'
//       }
//     ],
//     propertyValues: {
//       decisionRules: []
//     }
//   },
//   {
//     id: '5',
//     templateId: 'tpl_data_transformer',
//     type: 'transformer',
//     title: 'Data Transformer',
//     subtitle: 'Transform & Process Data',
//     icon: Shuffle,
//     variant: 'gray-600',
//     shape: 'rectangle',
//     size: 'medium',
//     ports: [
//       { id: 'transform-in-1', label: 'Input Data', type: 'input', position: 'left' },
//       { id: 'transform-in-2', label: 'Schema', type: 'input', position: 'top' },
//       { id: 'transform-out-1', label: 'Transformed', type: 'output', position: 'right' },
//       { id: 'transform-out-2', label: 'Errors', type: 'output', position: 'bottom' }
//     ],
//     properties: [
//       { 
//         id: 'dataOperations', 
//         label: 'Data Operations', 
//         type: 'dataOperations',
//         availableFields: ['id', 'name', 'email', 'status', 'created_at', 'updated_at', 'first_name', 'last_name', 'age', 'department', 'salary', 'role', 'address', 'phone'],
//         description: 'Configure data transformation pipelines including mapping, filtering, sorting, and aggregation'
//       },
//       { id: 'errorHandling', label: 'Error Handling', type: 'select', options: ['ignore', 'skip_item', 'stop_pipeline', 'log_and_continue'], defaultValue: 'log_and_continue' },
//       { id: 'batchSize', label: 'Batch Size', type: 'number', defaultValue: 1000, description: 'Number of items to process in each batch' },
//       { id: 'enableValidation', label: 'Enable Validation', type: 'boolean', defaultValue: true, description: 'Validate data before and after transformation' }
//     ],
//     propertyValues: {
//       dataOperations: [],
//       errorHandling: 'log_and_continue',
//       batchSize: 1000,
//       enableValidation: true
//     }
//   }
// ]

export default function Home() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isNodeBrowserOpen, setIsNodeBrowserOpen] = useState(false)
  const [isHistoryBrowserOpen, setIsHistoryBrowserOpen] = useState(false)
  const [isFlowTracerOpen, setIsFlowTracerOpen] = useState(false)
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [showEnvVarWarning, setShowEnvVarWarning] = useState(false)
  const missingEnvVars = useEnvVarStore(state => state.missingVars)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null)
  const [isPropertyPaneOpen, setIsPropertyPaneOpen] = useState(false)
  const [isPropertyPaneVisible, setIsPropertyPaneVisible] = useState(false)
  const [isPropertyPaneClosing, setIsPropertyPaneClosing] = useState(false)
  const [configurationToastNodeId, setConfigurationToastNodeId] = useState<string | null>(null)
  const [isGroupCreationModalOpen, setIsGroupCreationModalOpen] = useState(false)
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 })
  const [canvasZoom, setCanvasZoom] = useState(1)
  const [viewportSize, setViewportSize] = useState({ width: 1200, height: 800 })
  const { updateNodeBounds, removeNodeBounds, getNodeBoundsArray } = useNodeBounds()
  const { updatePortPosition: oldUpdatePortPosition, getPortPosition: getStoredPortPosition } = usePortPositions()
  
  // Zustand store
  const { 
    workflowId,
    workflowName,
    nodes: storeNodes, 
    connections,
    groups,
    selection,
    initialized,
    addConnection, 
    removeConnection, 
    updateConnectionState, 
    updateNodePosition,
    setInitialized,
    undo,
    redo,
    canUndo,
    canRedo,
    saveToStorage,
    loadFromStorage,
    createNewWorkflow,
    setWorkflowName,
    publishWorkflow,
    selectNode,
    clearSelection,
    startSelection,
    updateSelection,
    endSelection,
    createGroupFromSelection,
    isNodeSelected,
    updatePortPosition,
    getPortPosition,
    autoResizeGroup
  } = useWorkflowStore()
  
  const { dragState, startDrag, updateDrag, endDrag } = useConnectionDrag(connections)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [connectionToDelete, setConnectionToDelete] = useState<string | null>(null)
  
  // Update configured environment variables in the store
  const updateConfiguredEnvVars = async () => {
    try {
      const sections = await EnvVarService.getConfigSections()
      const configuredVars: string[] = []
      
      sections.forEach(section => {
        section.variables.forEach(variable => {
          if (variable.value) {
            configuredVars.push(variable.key)
          }
        })
      })
      
      useEnvVarStore.getState().updateConfiguredVars(configuredVars)
    } catch (error) {
      console.error('Failed to update configured environment variables:', error)
    }
  }

  // Initialize workflow on mount
  useEffect(() => {
    if (!initialized) {
      // Check if there's a saved workflow to load
      const savedWorkflowId = WorkflowStorageService.getCurrentWorkflowId()
      
      if (savedWorkflowId) {
        // Load existing workflow
        loadFromStorage(savedWorkflowId)
      } else if (storeNodes.length === 0) {
        // Create new empty workflow
        createNewWorkflow('New Workflow')
      }
      
      setInitialized(true)
      
      // Load configured environment variables
      updateConfiguredEnvVars()
    }
  }, [initialized, storeNodes.length, setInitialized, loadFromStorage, createNewWorkflow])

  // Keyboard shortcut to test environment variable warning (Cmd+Shift+T)
  // useEffect(() => {
  //   const handleKeyPress = (e: KeyboardEvent) => {
  //     if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 't') {
  //       e.preventDefault()
  //       console.log('TESTING: Adding PostgreSQL node to trigger env var check')
  //       const { addNode } = useWorkflowStore.getState()
  //       addNode({
  //         id: `test-postgresql-${Date.now()}`,
  //         templateId: 'tpl_postgresql',
  //         type: 'database',
  //         title: 'Test PostgreSQL',
  //         icon: Database,
  //         variant: 'black',
  //         shape: 'rectangle',
  //         size: 'medium',
  //         requiredEnvVars: ['DATABASE_URL', 'DB_PASSWORD'],
  //         properties: [],
  //         propertyValues: {}
  //       }, { x: 300 + Math.random() * 100, y: 200 + Math.random() * 100 })
  //       ToastManager.info('Test node added - checking for environment variables...')
  //     }
  //   }
    
  //   window.addEventListener('keydown', handleKeyPress)
  //   return () => window.removeEventListener('keydown', handleKeyPress)
  // }, [])

  // Show env var warning when there are missing vars
  useEffect(() => {
    setShowEnvVarWarning(missingEnvVars.length > 0)
  }, [missingEnvVars])

  // Check for nodes that need configuration and show toast
  useEffect(() => {
    // If we're showing a toast for a specific node, check if it still needs configuration
    if (configurationToastNodeId) {
      const currentNode = storeNodes.find(n => n.metadata.id === configurationToastNodeId)
      if (!currentNode || !hasUnconfiguredDefaults(currentNode.metadata)) {
        // Node is now properly configured, dismiss the toast
        setConfigurationToastNodeId(null)
        return
      }
    }
    
    // Only check for new unconfigured nodes if we don't already have a toast showing
    if (configurationToastNodeId) return
    
    // Find nodes that need configuration
    const unconfiguredNodes = storeNodes.filter(node => hasUnconfiguredDefaults(node.metadata))
    
    if (unconfiguredNodes.length > 0) {
      // Show toast for the most recently added node that needs configuration
      const latestUnconfigured = unconfiguredNodes[unconfiguredNodes.length - 1]
      setConfigurationToastNodeId(latestUnconfigured.metadata.id)
    }
  }, [storeNodes, configurationToastNodeId])

  // Clean up node bounds when nodes are removed
  useEffect(() => {
    const currentNodeIds = new Set(storeNodes.map(node => node.metadata.id))
    const currentBounds = getNodeBoundsArray()
    
    // Remove bounds for nodes that no longer exist
    currentBounds.forEach(bounds => {
      if (!currentNodeIds.has(bounds.id)) {
        removeNodeBounds(bounds.id)
      }
    })
  }, [storeNodes, getNodeBoundsArray, removeNodeBounds])

  // Removed the debugging interval that was causing endless API calls
  
  
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

  // Handle node browser toggle
  const handleNodeBrowserToggle = () => {
    setIsNodeBrowserOpen(!isNodeBrowserOpen)
  }

  // Zoom control handlers
  const handleZoomIn = () => {
    setCanvasZoom(prev => Math.min(3, prev * 1.2))
  }

  const handleZoomOut = () => {
    setCanvasZoom(prev => Math.max(0.1, prev / 1.2))
  }

  const handleZoomReset = () => {
    setCanvasZoom(1)
    setCanvasOffset({ x: 0, y: 0 })
  }

  // Handle category click from sidebar
  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId)
    setIsSearchOpen(true)
  }

  // Handle node selection from browser
  const handleNodeSelectFromBrowser = (nodeId: string, position: { x: number; y: number }) => {
    // Center the canvas on the selected node
    const viewportCenterX = window.innerWidth / 2
    const viewportCenterY = window.innerHeight / 2
    
    const newOffset = {
      x: viewportCenterX - position.x * canvasZoom,
      y: viewportCenterY - position.y * canvasZoom
    }
    
    setCanvasOffset(newOffset)
    setHighlightedNodeId(nodeId)
    
    // Remove highlight after 2 seconds
    setTimeout(() => {
      setHighlightedNodeId(null)
    }, 2000)
  }

  // Handle save workflow
  const handleSaveWorkflow = () => {
    try {
      saveToStorage()
      ToastManager.success(`Workflow "${workflowName}" saved successfully!`)
    } catch (error) {
      ToastManager.error('Failed to save workflow. Please try again.')
      console.error('Save error:', error)
    }
  }

  // Handle publish workflow
  const handlePublishWorkflow = () => {
    try {
      publishWorkflow()
      ToastManager.success(`Workflow "${workflowName}" published successfully!`)
    } catch (error) {
      ToastManager.error('Failed to publish workflow. Please try again.')
      console.error('Publish error:', error)
    }
  }

  // Handle load workflow from history
  const handleLoadWorkflow = (selectedWorkflowId: string) => {
    try {
      // Save current workflow first if it has changes
      if (workflowId !== selectedWorkflowId && storeNodes.length > 0) {
        saveToStorage()
      }
      
      // Load the selected workflow
      loadFromStorage(selectedWorkflowId)
      
      // The workflowName will be updated by the store after loading
      setTimeout(() => {
        const { workflowName: newName } = useWorkflowStore.getState()
        ToastManager.info(`Loaded workflow "${newName}"`)
      }, 100)
    } catch (error) {
      ToastManager.error('Failed to load workflow. Please try again.')
      console.error('Load error:', error)
    }
  }

  // Handle environment variable configuration
  const handleVariableConfigured = () => {
    // Update configured vars after configuration
    updateConfiguredEnvVars()
  }

  // Handle dismissing env var warning (no persistent dismissal)
  const handleDismissEnvVarWarning = () => {
    setShowEnvVarWarning(false)
  }

  // Handle opening config from warning
  const handleOpenConfigFromWarning = () => {
    setIsConfigOpen(true)
  }

  // Handle group creation
  const handleGroupCreationConfirm = (title: string, description: string) => {
    createGroupFromSelection(title, description)
    setIsGroupCreationModalOpen(false)
  }

  const handleGroupCreationCancel = () => {
    setIsGroupCreationModalOpen(false)
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
        // Account for canvas offset and zoom
        updateDrag({
          x: (e.clientX - rect.left - canvasOffset.x) / canvasZoom,
          y: (e.clientY - rect.top - canvasOffset.y) / canvasZoom
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
  }, [dragState.isDragging, canvasOffset, canvasZoom, updateDrag, endDrag])
  
  // Keyboard shortcuts for testing connection states and undo/redo
  useEffect(() => {
    // Detect if user is on macOS
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    
    const handleKeyPress = (e: KeyboardEvent) => {
      // Press '1', '2', '3', '4' to set the first connection to different states
      if (['1', '2', '3', '4'].includes(e.key) && connections.length > 0) {
        const states: ('pending' | 'warning' | 'error' | 'success')[] = ['pending', 'warning', 'error', 'success']
        const stateIndex = parseInt(e.key) - 1
        const firstConnectionId = connections[0].id
        updateConnectionState(firstConnectionId, states[stateIndex])
      }
      
      // Check for the appropriate modifier key based on platform
      const hasModifier = isMac ? e.metaKey : e.ctrlKey
      
      // Undo/Redo shortcuts (Cmd+Z / Cmd+Shift+Z on Mac, Ctrl+Z / Ctrl+Shift+Z on Windows/Linux)
      if (hasModifier) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault()
          undo()
        } else if (e.key === 'z' && e.shiftKey) {
          e.preventDefault()
          redo()
        }
        
        // Group selected nodes (Cmd+G on Mac, Ctrl+G on Windows/Linux)
        if (e.key === 'g' && !e.shiftKey) {
          e.preventDefault()
          if (selection.selectedNodeIds.length > 0) {
            setIsGroupCreationModalOpen(true)
          }
        }
      }
      
      // Clear selection with Escape
      if (e.key === 'Escape') {
        e.preventDefault()
        clearSelection()
      }
        
      // Other keyboard shortcuts (Cmd+Shift+...)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
        // Cmd+Shift+P to simulate published workflows (for testing)
        if (e.key === 'p') {
          e.preventDefault()
          simulatePublishedWorkflows()
          ToastManager.info('Simulated published workflows created')
        }
        
        // Cmd+Shift+E to clear environment variable storage (for testing)
        if (e.key === 'e') {
          e.preventDefault()
          EnvVarService.clearStorage()
          // Clear configured vars in store
          useEnvVarStore.getState().updateConfiguredVars([])
          ToastManager.info('Environment variable storage cleared')
        }
        
        // Cmd+Shift+C to create test connection (for debugging)
        if (e.key === 'c') {
          e.preventDefault()
          if (storeNodes.length >= 2) {
            const firstNode = storeNodes[0]
            const secondNode = storeNodes[1]
            
            // Create a test connection between first two nodes
            const testConnection = {
              id: `test-conn-${Date.now()}`,
              source: {
                nodeId: firstNode.metadata.id,
                portId: firstNode.metadata.ports?.[0]?.id || 'test-out'
              },
              target: {
                nodeId: secondNode.metadata.id,
                portId: secondNode.metadata.ports?.[0]?.id || 'test-in'
              },
              state: 'pending' as const
            }
            
            addConnection(testConnection)
            ToastManager.info('Test connection created')
          } else {
            ToastManager.error('Need at least 2 nodes to create a test connection')
          }
        }
        
        // Cmd+Shift+R to manually resize all groups (for debugging)
        if (e.key === 'r') {
          e.preventDefault()
          groups.forEach(group => {
            console.log(`🔧 Manually triggering resize for group ${group.id}`)
            autoResizeGroup(group.id)
          })
          ToastManager.info(`Resized ${groups.length} groups`)
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [connections, undo, redo])



  return (
    <main className="flex h-screen flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-medium text-gray-900">Zeal</h1>
          <div className="text-sm text-gray-500">
            {workflowName}
            {workflowId && <span className="text-xs text-gray-400 ml-2">ID: {workflowId.slice(0, 8)}...</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleSaveWorkflow}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </button>
          <button 
            onClick={handlePublishWorkflow}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
          >
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
        <InteractiveCanvas 
          offset={canvasOffset} 
          onOffsetChange={setCanvasOffset}
          zoom={canvasZoom}
          onZoomChange={setCanvasZoom}
          onSelectionStart={startSelection}
          onSelectionUpdate={updateSelection}
          onSelectionEnd={() => {
            const hasSelectedNodes = endSelection()
            // Automatically open group creation modal if nodes were selected
            if (hasSelectedNodes) {
              setIsGroupCreationModalOpen(true)
            }
          }}
          onSelectionClear={clearSelection}
        >
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
          
          {/* Node Groups - render before nodes so they appear behind */}
          {groups.map(group => {
            // Get nodes that belong to this group
            const groupNodes = storeNodes.filter(node => group.nodeIds.includes(node.metadata.id))
            return (
              <NodeGroupContainer key={group.id} group={group}>
                {/* Render nodes that belong to this group */}
                {groupNodes.map(node => (
                  <DraggableNode
                    key={`group-${group.id}-node-${node.metadata.id}`}
                    metadata={node.metadata}
                    position={{
                      x: node.position.x - group.position.x,
                      y: node.position.y - group.position.y - (group.description ? 60 : 32)
                    }}
                    onPositionChange={(nodeId, position) => {
                      // Convert relative position back to absolute
                      handleNodePositionChange(nodeId, {
                        x: position.x + group.position.x,
                        y: position.y + group.position.y + (group.description ? 60 : 32)
                      })
                    }}
                    onBoundsChange={(nodeId, bounds) => {
                      // Use absolute node position for bounds
                      updateNodeBounds(nodeId, {
                        x: node.position.x,
                        y: node.position.y,
                        width: bounds.width,
                        height: bounds.height
                      })
                    }}
                    onPortPositionUpdate={updatePortPosition}
                    onPortDragStart={handlePortDragStart}
                    onPortDragEnd={handlePortDragEnd}
                    onClick={handleNodeSelect}
                    isHighlighted={node.metadata.id === highlightedNodeId}
                    isSelected={isNodeSelected(node.metadata.id)}
                  />
                ))}
              </NodeGroupContainer>
            )
          })}
          
          {/* Selection Rectangle */}
          {selection.isSelecting && selection.selectionStart && selection.selectionEnd && (
            <SelectionRectangle
              startPoint={selection.selectionStart}
              endPoint={selection.selectionEnd}
              visible={selection.isSelecting}
            />
          )}

          {/* Ungrouped Workflow Nodes */}
          {storeNodes
            .filter(node => !groups.some(group => group.nodeIds.includes(node.metadata.id)))
            .map(node => (
              <DraggableNode
                key={`${node.metadata.id}-${node.metadata.title}-${node.metadata.icon}-${node.metadata.variant}`}
                metadata={node.metadata}
                position={node.position}
                onPositionChange={handleNodePositionChange}
                onBoundsChange={updateNodeBounds}
                onPortPositionUpdate={updatePortPosition}
                onPortDragStart={handlePortDragStart}
                onPortDragEnd={handlePortDragEnd}
                onClick={handleNodeSelect}
                isHighlighted={node.metadata.id === highlightedNodeId}
                isSelected={isNodeSelected(node.metadata.id)}
              />
            ))}
        </InteractiveCanvas>

        {/* Floating UI Components */}
        <WorkflowSidebar 
          isCollapsed={isSidebarCollapsed}
          onCategoryClick={handleCategoryClick}
          // onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
        
        <SearchButton onClick={() => setIsSearchOpen(true)} />
        <NodeBrowserButton onClick={handleNodeBrowserToggle} isActive={isNodeBrowserOpen} />
        <UndoRedoButtons onUndo={undo} onRedo={redo} canUndo={canUndo()} canRedo={canRedo()} />
        <WorkflowBottomToolbar 
          onHistoryClick={() => setIsHistoryBrowserOpen(true)}
          onDebuggerClick={() => setIsFlowTracerOpen(true)}
          onConfigClick={() => setIsConfigOpen(true)}
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

        <ZoomControls
          zoom={canvasZoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomReset={handleZoomReset}
        />
        </div>

        {/* Node Browser Panel */}
        {isNodeBrowserOpen && (
          <div 
            className="fixed inset-0 z-10"
            onClick={handleNodeBrowserToggle}
          />
        )}
        <NodeBrowserPanel 
          isExpanded={isNodeBrowserOpen}
          onNodeSelect={handleNodeSelectFromBrowser}
        />

        {/* Property Pane */}
        {isPropertyPaneVisible && (
          <>
            {/* Backdrop */}
            <div 
              className={`fixed inset-0 z-30 bg-black/20 transition-opacity duration-300 ${
                isPropertyPaneClosing ? 'opacity-0' : 'opacity-100'
              }`}
              onClick={handlePropertyPaneClose}
            />
            {/* Property Pane */}
            <div className="fixed right-0 top-0 h-full z-55">
              <PropertyPane
                selectedNodeId={selectedNodeId}
                onClose={handlePropertyPaneClose}
                isClosing={isPropertyPaneClosing}
              />
            </div>
          </>
        )}
      </div>

      {/* Search Modal */}
      <ModalPortal isOpen={isSearchOpen}>
        <SearchModal 
          isOpen={isSearchOpen} 
          onClose={() => {
            setIsSearchOpen(false)
            setSelectedCategory(null) // Reset category selection
          }}
          initialCategory={selectedCategory}
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

      {/* History Browser */}
      <HistoryBrowser
        isOpen={isHistoryBrowserOpen}
        onClose={() => setIsHistoryBrowserOpen(false)}
        onSelectWorkflow={handleLoadWorkflow}
        onViewFlowTrace={(workflowId) => {
          setIsHistoryBrowserOpen(false)
          setIsFlowTracerOpen(true)
          // In production, you would load flow traces for the specific workflow
          ToastManager.info(`Viewing flow traces for workflow ${workflowId}`)
        }}
        currentWorkflowId={workflowId}
      />

      {/* Flow Tracer */}
      <FlowTracer
        isOpen={isFlowTracerOpen}
        onClose={() => setIsFlowTracerOpen(false)}
      />

      {/* Configuration */}
      <Configuration
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onVariableConfigured={handleVariableConfigured}
      />

      {/* Missing Environment Variables Warning */}
      {showEnvVarWarning && missingEnvVars.length > 0 && (
        <MissingEnvVarWarning
          missingVars={missingEnvVars}
          onDismiss={handleDismissEnvVarWarning}
          onOpenConfig={handleOpenConfigFromWarning}
        />
      )}

      {/* Configuration Toast */}
      {configurationToastNodeId && (() => {
        const node = storeNodes.find(n => n.metadata.id === configurationToastNodeId)
        return node ? (
          <ConfigurationToast
            nodeMetadata={node.metadata}
            onConfigure={() => {
              setConfigurationToastNodeId(null)
              handleNodeSelect(configurationToastNodeId)
            }}
            onDismiss={() => setConfigurationToastNodeId(null)}
          />
        ) : null
      })()}

      {/* Group Creation Modal */}
      <GroupCreationModal
        isOpen={isGroupCreationModalOpen}
        selectedNodeCount={selection.selectedNodeIds.length}
        selectedNodeNames={selection.selectedNodeIds.map(id => {
          const node = storeNodes.find(n => n.metadata.id === id)
          return node ? node.metadata.title : 'Unknown'
        })}
        onConfirm={handleGroupCreationConfirm}
        onCancel={handleGroupCreationCancel}
      />
    </main>
  )
}