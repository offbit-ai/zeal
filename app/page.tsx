'use client'

import { useState, useEffect, useCallback } from 'react'
import { InteractiveCanvas } from '@/components/InteractiveCanvas'
import { WorkflowSidebar } from '@/components/WorkflowSidebar'
import { WorkflowBottomToolbar } from '@/components/WorkflowBottomToolbar'
import { SearchButton } from '@/components/SearchButton'
import { NodeBrowserButton } from '@/components/NodeBrowserButton'
import { TriggerManager } from '@/components/TriggerManager'
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
import { Save, Upload, Play, Edit2, Check, X, Clock, Globe, Cable, RotateCcw } from 'lucide-react'
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
import { EmptyGroupCreationModal } from '@/components/EmptyGroupCreationModal'
import { GroupEditModal } from '@/components/GroupEditModal'
import { GroupDeleteModal } from '@/components/GroupDeleteModal'
import { useWorkflowStore } from '@/store/workflowStore'
import { WorkflowStorageService } from '@/services/workflowStorage'
import { hasUnconfiguredDefaults } from '@/utils/nodeConfigurationStatus'
import { TabBar } from '@/components/TabBar'
import { useGraphStore } from '@/store/graphStore'
import { SubgraphNode } from '@/components/SubgraphNode'
import { createWorkflowSnapshot, createWorkflowGraph, restoreWorkflowFromSnapshot, restoreGraphFromSerialized } from '@/utils/workflowSerializer'
import { LoadingOverlay } from '@/components/LoadingOverlay'
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog'
import { SaveGraphButton } from '@/components/SaveGraphButton'
import { toast } from '@/lib/toast'

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
  const [searchModalInitialTab, setSearchModalInitialTab] = useState<'repository' | 'custom' | 'subgraphs' | undefined>(undefined)
  const [autosaveEnabled, setAutosaveEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadingMessage, setLoadingMessage] = useState('Initializing workflow...')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null)
  const [isPropertyPaneOpen, setIsPropertyPaneOpen] = useState(false)
  const [isPropertyPaneVisible, setIsPropertyPaneVisible] = useState(false)
  const [isPropertyPaneClosing, setIsPropertyPaneClosing] = useState(false)
  const [configurationToastNodeId, setConfigurationToastNodeId] = useState<string | null>(null)
  const [isGroupCreationModalOpen, setIsGroupCreationModalOpen] = useState(false)
  const [isEmptyGroupModalOpen, setIsEmptyGroupModalOpen] = useState(false)
  const [emptyGroupPosition, setEmptyGroupPosition] = useState({ x: 0, y: 0 })
  const [nodeHoveringGroupId, setNodeHoveringGroupId] = useState<string | null>(null)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null)
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 })
  const [canvasZoom, setCanvasZoom] = useState(1)
  const [viewportSize, setViewportSize] = useState({ width: 1200, height: 800 })
  const [isEditingWorkflowName, setIsEditingWorkflowName] = useState(false)
  const [editedWorkflowName, setEditedWorkflowName] = useState('')
  const { updateNodeBounds, removeNodeBounds, getNodeBoundsArray } = useNodeBounds()
  const { updatePortPosition: oldUpdatePortPosition, getPortPosition: getStoredPortPosition } = usePortPositions()
  
  // Zustand stores
  const { 
    workflowId,
    workflowName,
    workflowTrigger,
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
    saveToStorageWithCanvasState,
    loadFromStorage,
    createNewWorkflow,
    setWorkflowName,
    publishWorkflow,
    clearSelection,
    startSelection,
    updateSelection,
    endSelection,
    createGroupFromSelection,
    createEmptyGroup,
    addNodeToGroup,
    removeNodeFromGroup,
    updateGroup,
    deleteGroup,
    removeNode,
    isNodeSelected,
    updatePortPosition,
    getPortPosition,
    updateAllPortPositions,
    autoResizeGroup,
    saveCurrentGraphState,
    loadGraphState
  } = useWorkflowStore()
  
  // Graph store
  const {
    graphs,
    currentGraphId,
    addGraph,
    removeGraph,
    switchGraph,
    renameGraph,
    setMainGraph,
    setGraphDirty,
    updateCanvasState,
    updateWorkflowState,
    loadGraphs,
    getCurrentGraph,
    getMainGraph,
    getGraphById
  } = useGraphStore()
  
  const { dragState, startDrag, updateDrag, endDrag } = useConnectionDrag(connections)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [connectionToDelete, setConnectionToDelete] = useState<string | null>(null)
  const [unsavedChangesDialog, setUnsavedChangesDialog] = useState<{
    isOpen: boolean
    pendingAction: (() => void) | null
    graphName?: string
  }>({ isOpen: false, pendingAction: null })
  const [isSavingGraph, setIsSavingGraph] = useState(false)
  
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

  // Track unsaved changes and warn before page unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const currentGraph = getCurrentGraph()
      if (currentGraph?.isDirty) {
        e.preventDefault()
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
        return 'You have unsaved changes. Are you sure you want to leave?'
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [getCurrentGraph])

  // Update document title with workflow name and unsaved indicator
  useEffect(() => {
    const currentGraph = getCurrentGraph()
    const hasUnsaved = graphs.some(g => g.isDirty)
    
    if (workflowName) {
      const unsavedIndicator = hasUnsaved ? '• ' : ''
      document.title = `${unsavedIndicator}${workflowName} - Zeal`
    } else {
      document.title = 'Zeal - Workflow Orchestrator'
    }
  }, [workflowName, graphs, getCurrentGraph])

  // Initialize workflow on mount
  useEffect(() => {
    if (!initialized && isLoading) {
      const initializeWorkflow = async () => {
        try {
          setLoadingMessage('Loading workflow data...')
          
          // Check if there's a saved workflow to load
          const savedWorkflowId = WorkflowStorageService.getCurrentWorkflowId()
          console.log('🏁 Initializing workflow with saved ID:', savedWorkflowId)
          console.log('🏁 Current store nodes:', storeNodes?.length || 0)
          console.log('🔍 Looking for saved workflow ID:', savedWorkflowId)
          
          if (savedWorkflowId) {
            // Load existing workflow
            try {
              const result = await loadFromStorage(savedWorkflowId)
              if (result?.canvasState) {
                setCanvasOffset(result.canvasState.offset)
                setCanvasZoom(result.canvasState.zoom)
              }
            } catch (error) {
              console.error('Failed to load workflow:', error)
              // Clear invalid workflow ID and create new workflow
              WorkflowStorageService.clearCurrentWorkflowId()
              toast.error('Previous workflow not found. Creating new workflow.')
              try {
                await createNewWorkflow('New Workflow')
              } catch (createError) {
                console.error('Failed to create new workflow:', createError)
                toast.error(createError)
              }
            }
          } else if (!storeNodes || storeNodes.length === 0) {
            // Create new empty workflow
            createNewWorkflow('New Workflow').catch(error => {
              console.error('Failed to create new workflow:', error)
              toast.error(error)
            })
          }
          
          // Skip loading env vars during initialization - will load on demand
          
          // Initialize graphs from storage
          setLoadingMessage('Loading graphs...')
          
          // Get the most recent workflow
          let recentWorkflows: any[] = []
          try {
            console.log('🔍 Loading workflow history...')
            recentWorkflows = await WorkflowStorageService.getWorkflowHistory(1)
            console.log('📚 Found workflows:', recentWorkflows.length, recentWorkflows.map(w => ({ id: w.id, name: w.name, activeGraphId: w.activeGraphId })))
          } catch (error) {
            console.error('❌ Failed to load workflow history:', error)
            // Continue without history
          }
          if (recentWorkflows.length > 0) {
            const snapshot = recentWorkflows[0]
            
            // Check if it's a multi-graph snapshot
            const restored = restoreWorkflowFromSnapshot(snapshot)
            console.log('📊 Restored snapshot with activeGraphId:', snapshot.activeGraphId)
            if (restored.graphs) {
              // Multi-graph workflow - convert to GraphInfo format and load
              const graphInfos = restored.graphs.map(graph => {
                const graphState = restoreGraphFromSerialized(graph)
                return {
                  id: graph.id,
                  name: graph.name,
                  namespace: graph.namespace,
                  isMain: graph.isMain,
                  isDirty: false,
                  canvasState: graph.canvasState || { offset: { x: 0, y: 0 }, zoom: 1 },
                  workflowState: {
                    nodes: graphState.nodes,
                    connections: graphState.connections,
                    groups: graphState.groups,
                    trigger: graph.isMain ? snapshot.trigger : null,
                    portPositions: graphState.portPositions
                  }
                }
              })
              
              // Determine the target graph BEFORE loading graphs
              const targetGraphId = snapshot.activeGraphId && graphInfos.some(g => g.id === snapshot.activeGraphId)
                ? snapshot.activeGraphId
                : graphInfos.find(g => g.isMain)?.id || graphInfos[0].id
              
              console.log('📊 Available graphs:', graphInfos.map(g => ({ id: g.id, name: g.name, isMain: g.isMain })))
              console.log('📊 Saved activeGraphId:', snapshot.activeGraphId)
              console.log('📊 Target graph determined:', targetGraphId)
              
              // Load graphs with the correct active graph ID from the start
              loadGraphs(graphInfos, targetGraphId)
              console.log('✅ Loaded graphs with activeGraphId:', targetGraphId)
            } else if (restored.nodes) {
              // Legacy single-graph workflow
              const mainGraphInfo = {
                id: 'main',
                name: 'Main',
                namespace: 'main',
                isMain: true,
                isDirty: false,
                canvasState: restored.canvasState || { offset: { x: 0, y: 0 }, zoom: 1 },
                workflowState: {
                  nodes: restored.nodes,
                  connections: restored.connections || [],
                  groups: restored.groups || [],
                  trigger: snapshot.trigger,
                  portPositions: undefined // Legacy workflows don't have saved port positions
                }
              }
              
              loadGraphs([mainGraphInfo])
              switchGraph('main')
            }
            
            // Set workflow metadata
            setWorkflowName(snapshot.name)
            
            // IMPORTANT: Set the current workflow ID so it persists across refreshes
            useWorkflowStore.setState({ workflowId: snapshot.id })
            WorkflowStorageService.setCurrentWorkflowId(snapshot.id)
            console.log('💾 Set current workflow ID:', snapshot.id)
          }
          
          setInitialized(true)
          
          // Small delay to ensure everything is rendered
          await new Promise(resolve => setTimeout(resolve, 200))
          
          setIsLoading(false)
        } catch (error) {
          console.error('Failed to initialize workflow:', error)
          setIsLoading(false)
        }
      }
      
      initializeWorkflow()
    }
  }, [initialized, isLoading, storeNodes?.length, setInitialized, loadFromStorage, createNewWorkflow, loadGraphs, switchGraph])

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
  
  
  // Handle graph switching
  useEffect(() => {
    const currentGraph = getCurrentGraph()
    if (!currentGraph) return
    
    // Load canvas state
    if (currentGraph.canvasState) {
      setCanvasOffset(currentGraph.canvasState.offset)
      setCanvasZoom(currentGraph.canvasState.zoom)
    } else {
      // Reset canvas state for new graph
      setCanvasOffset({ x: 0, y: 0 })
      setCanvasZoom(1)
    }
    
    // Load workflow state
    if (currentGraph.workflowState) {
      loadGraphState(currentGraph.workflowState)
      
      // Trigger port position measurement by applying a tiny transform to each node
      // This mimics what happens when a node is moved, which correctly calculates port positions
      setTimeout(() => {
        const state = useWorkflowStore.getState()
        state.nodes.forEach(node => {
          // Apply a tiny position change to trigger port position recalculation
          const currentPos = node.position
          updateNodePosition(node.metadata.id, { 
            x: currentPos.x + 0.1, 
            y: currentPos.y + 0.1 
          })
          // Immediately revert to original position
          setTimeout(() => {
            updateNodePosition(node.metadata.id, currentPos)
          }, 10)
        })
      }, 300)
    } else if (currentGraph.id !== 'main' || !initialized) {
      // Only clear for non-main graphs or if not initialized
      loadGraphState({
        nodes: [],
        connections: [],
        groups: [],
        trigger: null
      })
    }
  }, [currentGraphId, getCurrentGraph, loadGraphState, initialized, updateAllPortPositions])
  
  

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

  // Automatic graph state persistence - save current graph state to graph store when changes occur
  useEffect(() => {
    if (!initialized) return // Don't persist before initialization
    
    const currentGraph = getCurrentGraph()
    if (currentGraph) {
      const workflowState = saveCurrentGraphState()
      updateWorkflowState(currentGraph.id, workflowState)
      updateCanvasState(currentGraph.id, { offset: canvasOffset, zoom: canvasZoom })
      console.log('📝 Graph state persisted to store:', currentGraph.id)
    }
  }, [storeNodes, connections, groups, workflowTrigger, canvasOffset, canvasZoom, initialized])

  // Opt-in autosave to storage/server - only when enabled
  useEffect(() => {
    if (!autosaveEnabled || !initialized) return
    
    const autosaveDelay = 5000 // 5 seconds delay for actual persistence
    const autosaveTimer = setTimeout(() => {
      try {
        saveWorkflowSilent()
        console.log('🔄 Autosaved to storage (activeGraphId:', currentGraphId, ')')
      } catch (error) {
        console.error('Autosave failed:', error)
      }
    }, autosaveDelay)

    return () => clearTimeout(autosaveTimer)
  }, [storeNodes, connections, groups, workflowTrigger, graphs, currentGraphId, autosaveEnabled, initialized])

  const handleNodePositionChange = (nodeId: string, position: { x: number; y: number }) => {
    updateNodePosition(nodeId, position)
    // Mark graph as dirty when nodes are moved
    setGraphDirty(currentGraphId, true)
    // Clear highlighting when a node is moved
    if (highlightedNodeId === nodeId) {
      setHighlightedNodeId(null)
    }
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

  const handleRunSimulation = () => {
    // Get all connections sorted by their source node's x position (left to right)
    const sortedConnections = [...connections].sort((a, b) => {
      const aNode = storeNodes.find(n => n.metadata.id === a.source.nodeId)
      const bNode = storeNodes.find(n => n.metadata.id === b.source.nodeId)
      if (!aNode || !bNode) return 0
      return aNode.position.x - bNode.position.x
    })

    // Start simulation
    simulateWorkflowExecution(sortedConnections)
  }

  const simulateWorkflowExecution = async (sortedConnections: Connection[]) => {
    // Reset all connections to pending
    sortedConnections.forEach(conn => {
      updateConnectionState(conn.id, 'pending')
    })

    // Simulate execution for each connection
    for (let i = 0; i < sortedConnections.length; i++) {
      const connection = sortedConnections[i]
      
      // Set to running state
      updateConnectionState(connection.id, 'running')
      
      // Wait for animation
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Randomly choose success or error (80% success rate)
      const finalState = Math.random() > 0.2 ? 'success' : 'error'
      updateConnectionState(connection.id, finalState)
      
      // Small delay before next connection
      if (i < sortedConnections.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }
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

  // Handle highlighting newly added nodes and pan canvas to show them
  const handleNodeAdded = (nodeId: string) => {
    setHighlightedNodeId(nodeId)
    
    // Find the newly added node to get its position
    const newNode = storeNodes.find(node => node.metadata.id === nodeId)
    if (newNode) {
      // Calculate viewport center and pan to the new node
      const viewportCenterX = window.innerWidth / 2
      const viewportCenterY = window.innerHeight / 2
      
      const newOffset = {
        x: viewportCenterX - newNode.position.x * canvasZoom,
        y: viewportCenterY - newNode.position.y * canvasZoom
      }
      
      setCanvasOffset(newOffset)
    }
    
    // Highlight will be removed when the node is moved (no timeout)
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

  // Handle save workflow (with toast)
  const handleSaveWorkflow = async () => {
    try {
      await saveWorkflowSilent()
      ToastManager.success(`Workflow "${workflowName}" saved successfully!`)
    } catch (error) {
      ToastManager.error('Failed to save workflow. Please try again.')
      console.error('Save error:', error)
    }
  }

  // Handle save individual graph
  const handleSaveGraph = async () => {
    const currentGraph = getCurrentGraph()
    if (!currentGraph || !currentGraph.isDirty) return
    
    setIsSavingGraph(true)
    try {
      // Save the current graph state
      const workflowState = saveCurrentGraphState()
      updateWorkflowState(currentGraph.id, workflowState)
      updateCanvasState(currentGraph.id, { offset: canvasOffset, zoom: canvasZoom })
      
      // Save to storage
      await saveWorkflowSilent()
      
      // Mark only the current graph as clean
      setGraphDirty(currentGraph.id, false)
      
      // Success message
      toast.success(`Graph "${currentGraph.name}" saved successfully`)
    } catch (error) {
      console.error('Failed to save graph:', error)
      toast.error('Failed to save graph')
    } finally {
      setIsSavingGraph(false)
    }
  }

  // Silent save function for autosave (no toast)
  const saveWorkflowSilent = async () => {
    try {
      // Save current graph state first
      const currentGraph = getCurrentGraph()
      if (currentGraph) {
        const workflowState = saveCurrentGraphState()
        console.log('💾 Saving workflow state:', {
          nodeCount: workflowState.nodes.length,
          subgraphNodes: workflowState.nodes.filter(n => n.metadata.type === 'subgraph'),
          allNodeTypes: workflowState.nodes.map(n => n.metadata.type)
        })
        updateWorkflowState(currentGraph.id, workflowState)
        updateCanvasState(currentGraph.id, { offset: canvasOffset, zoom: canvasZoom })
      }
      
      // Create workflow graphs from graph store
      const workflowGraphs = graphs.map(g => {
        const graphState = g.workflowState || { nodes: [], connections: [], groups: [], trigger: null }
        // Get current port positions from store when saving
        const currentPortPositions = g.id === currentGraphId ? useWorkflowStore.getState().portPositions : undefined
        return createWorkflowGraph(
          g.id,
          g.name,
          g.namespace,
          g.isMain,
          graphState.nodes || [],
          graphState.connections || [],
          graphState.groups || [],
          g.canvasState,
          currentPortPositions
        )
      })
      
      // Get existing snapshot if available
      const existingSnapshot = workflowId ? await WorkflowStorageService.getWorkflow(workflowId) : null
      
      // Create multi-graph snapshot
      const snapshot = createWorkflowSnapshot(
        workflowGraphs,
        currentGraphId,
        workflowName,
        workflowId || undefined,
        existingSnapshot || undefined,
        workflowTrigger
      )
      
      // Save to storage
      console.log('🔄 Saving workflow with activeGraphId:', snapshot.activeGraphId)
      const savedWorkflow = await WorkflowStorageService.saveWorkflow(snapshot)
      console.log('✅ Workflow saved successfully:', savedWorkflow.id)
      
      // Update workflowId if it was a new workflow
      if (!workflowId && savedWorkflow.id) {
        // Update the workflowId in the store
        useWorkflowStore.setState({ workflowId: savedWorkflow.id })
        WorkflowStorageService.setCurrentWorkflowId(savedWorkflow.id)
      }
      
      // Mark all graphs as clean after successful save
      graphs.forEach(graph => {
        setGraphDirty(graph.id, false)
      })
    } catch (error) {
      console.error('Failed to save workflow:', error)
      toast.error(error)
      throw error // Re-throw to let autosave handler catch it
    }
  }

  // Check if there are any unsaved changes across all graphs
  const hasUnsavedChanges = () => {
    return graphs.some(graph => graph.isDirty)
  }

  // Handle navigation with unsaved changes check
  const handleNavigationWithCheck = (action: () => void, actionGraphName?: string) => {
    const dirtyGraphs = graphs.filter(graph => graph.isDirty)
    
    if (dirtyGraphs.length > 0) {
      // Show dialog with the first dirty graph's name
      const graphName = actionGraphName || dirtyGraphs[0].name
      setUnsavedChangesDialog({
        isOpen: true,
        pendingAction: action,
        graphName
      })
    } else {
      // No unsaved changes, proceed with action
      action()
    }
  }

  // Handle unsaved changes dialog actions
  const handleUnsavedChangesSave = async () => {
    try {
      await handleSaveWorkflow()
      // After successful save, execute the pending action
      if (unsavedChangesDialog.pendingAction) {
        unsavedChangesDialog.pendingAction()
      }
      setUnsavedChangesDialog({ isOpen: false, pendingAction: null })
    } catch (error) {
      // Error already handled in handleSaveWorkflow
    }
  }

  const handleUnsavedChangesDiscard = () => {
    // Mark all graphs as clean since we're discarding changes
    graphs.forEach(graph => {
      setGraphDirty(graph.id, false)
    })
    
    // Execute the pending action
    if (unsavedChangesDialog.pendingAction) {
      unsavedChangesDialog.pendingAction()
    }
    setUnsavedChangesDialog({ isOpen: false, pendingAction: null })
  }

  const handleUnsavedChangesCancel = () => {
    setUnsavedChangesDialog({ isOpen: false, pendingAction: null })
  }

  // Handle publish workflow
  const handlePublishWorkflow = async () => {
    try {
      await publishWorkflow()
      ToastManager.success(`Workflow "${workflowName}" published successfully!`)
    } catch (error) {
      ToastManager.error('Failed to publish workflow. Please try again.')
      console.error('Publish error:', error)
    }
  }

  // Handle load workflow from history
  const handleLoadWorkflow = async (selectedWorkflowId: string) => {
    const action = async () => {
      try {
        // Save current workflow first if it has changes
        if (workflowId !== selectedWorkflowId && storeNodes.length > 0) {
          await saveToStorageWithCanvasState({ offset: canvasOffset, zoom: canvasZoom })
        }
        
        // Load the selected workflow with multi-graph support
        const snapshot = await WorkflowStorageService.getWorkflow(selectedWorkflowId)
        if (!snapshot) {
          throw new Error('Workflow not found')
        }
        
        // Restore the workflow
        const restored = restoreWorkflowFromSnapshot(snapshot)
        
        if (restored.graphs && restored.graphs.length > 0) {
          // Multi-graph workflow
          const graphInfos = restored.graphs.map(graph => {
            const graphState = restoreGraphFromSerialized(graph)
            return {
              id: graph.id,
              name: graph.name,
              namespace: graph.namespace,
              isMain: graph.isMain,
              isDirty: false,
              canvasState: graph.canvasState || { offset: { x: 0, y: 0 }, zoom: 1 },
              workflowState: {
                nodes: graphState.nodes,
                connections: graphState.connections,
                groups: graphState.groups,
                trigger: graph.isMain ? snapshot.trigger : null,
                portPositions: graphState.portPositions
              }
            }
          })
          
          // Determine the target graph BEFORE loading graphs
          const targetGraphId = snapshot.activeGraphId && graphInfos.some(g => g.id === snapshot.activeGraphId)
            ? snapshot.activeGraphId
            : graphInfos.find(g => g.isMain)?.id || graphInfos[0].id
          
          // Load all graphs with the correct active graph ID from the start
          loadGraphs(graphInfos, targetGraphId)
          
          // Load the target graph state
          const targetGraph = graphInfos.find(g => g.id === targetGraphId)
          if (targetGraph && targetGraph.workflowState) {
            loadGraphState(targetGraph.workflowState)
            if (targetGraph.canvasState) {
              setCanvasOffset(targetGraph.canvasState.offset)
              setCanvasZoom(targetGraph.canvasState.zoom)
            }
          }
          
          // Update workflow metadata
          useWorkflowStore.setState({
            workflowId: snapshot.id,
            workflowName: snapshot.name,
            workflowTrigger: snapshot.trigger || null
          })
        } else {
          // Legacy single-graph workflow
          const result = await loadFromStorage(selectedWorkflowId)
          if (result?.canvasState) {
            setCanvasOffset(result.canvasState.offset)
            setCanvasZoom(result.canvasState.zoom)
          }
        }
        
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
    
    // Check for unsaved changes before loading a different workflow
    if (hasUnsavedChanges()) {
      handleNavigationWithCheck(action, workflowName)
    } else {
      await action()
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
  const handleOpenConfigFromWarning = async () => {
    // Fetch env vars when opening configuration
    await updateConfiguredEnvVars()
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

  // Handle empty group creation
  const handleEmptyGroupCreationConfirm = (title: string, description: string, position: { x: number; y: number }) => {
    createEmptyGroup(title, description, position)
    setIsEmptyGroupModalOpen(false)
  }

  const handleEmptyGroupCreationCancel = () => {
    setIsEmptyGroupModalOpen(false)
  }

  const handleCreateEmptyGroup = (canvasPosition: { x: number; y: number }) => {
    setEmptyGroupPosition(canvasPosition)
    setIsEmptyGroupModalOpen(true)
  }


  const handleNodeDropIntoGroup = (nodeId: string, groupId: string) => {
    addNodeToGroup(groupId, nodeId)
  }

  const handleNodeHoverGroup = (groupId: string | null) => {
    setNodeHoveringGroupId(groupId)
  }

  const handleGroupEditClick = (groupId: string) => {
    setEditingGroupId(groupId)
  }

  const handleGroupEditConfirm = (groupId: string, title: string, description: string) => {
    updateGroup(groupId, { title, description })
    setEditingGroupId(null)
  }

  const handleGroupEditCancel = () => {
    setEditingGroupId(null)
  }

  const handleGroupDeleteClick = (groupId: string) => {
    setDeletingGroupId(groupId)
  }

  const handleGroupDeleteConfirm = (groupId: string, preserveNodes: boolean) => {
    if (preserveNodes) {
      // Remove nodes from group but keep them
      const group = groups.find(g => g.id === groupId)
      if (group) {
        group.nodeIds.forEach(nodeId => {
          removeNodeFromGroup(groupId, nodeId)
        })
      }
    } else {
      // Delete all nodes in the group first
      const group = groups.find(g => g.id === groupId)
      if (group) {
        group.nodeIds.forEach(nodeId => {
          removeNode(nodeId)
        })
      }
    }
    
    // Delete the group
    deleteGroup(groupId)
    setDeletingGroupId(null)
  }

  const handleGroupDeleteCancel = () => {
    setDeletingGroupId(null)
  }
  
  // Tab bar handlers
  const handleTabSelect = (graphId: string) => {
    // Don't do anything if we're selecting the current graph
    if (graphId === currentGraphId) return
    
    const currentGraph = getCurrentGraph()
    
    // Always save current graph state before switching (in memory, not to storage)
    if (currentGraph) {
      // Save canvas state
      updateCanvasState(currentGraph.id, { offset: canvasOffset, zoom: canvasZoom })
      
      // Save workflow state
      const workflowState = saveCurrentGraphState()
      updateWorkflowState(currentGraph.id, workflowState)
    }
    
    // Switch to new graph
    switchGraph(graphId)
  }
  
  const handleTabClose = (graphId: string) => {
    const graph = graphs.find(g => g.id === graphId)
    if (graph?.isMain) {
      // Can't close main graph
      return
    }
    
    // Check if this graph has unsaved changes
    if (graph?.isDirty) {
      handleNavigationWithCheck(() => {
        if (removeGraph(graphId)) {
          // Graph was removed successfully
        }
      }, graph.name)
    } else {
      if (removeGraph(graphId)) {
        // Graph was removed successfully
      }
    }
  }
  
  const handleTabAdd = () => {
    const currentGraph = getCurrentGraph()
    
    // Save current graph state before adding new graph (in memory, not to storage)
    if (currentGraph) {
      const workflowState = saveCurrentGraphState()
      updateWorkflowState(currentGraph.id, workflowState)
      updateCanvasState(currentGraph.id, { offset: canvasOffset, zoom: canvasZoom })
    }
    
    const newGraphId = addGraph(`Graph ${graphs.length + 1}`)
    switchGraph(newGraphId)
  }
  
  const handleTabRename = (graphId: string, newName: string) => {
    renameGraph(graphId, newName)
  }
  
  const handleSetMainTab = (graphId: string) => {
    setMainGraph(graphId)
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
        // Mark graph as dirty when connections are created
        setGraphDirty(currentGraphId, true)
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
      // Mark graph as dirty when connections are deleted
      setGraphDirty(currentGraphId, true)
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
      // Don't handle keyboard shortcuts if user is typing in an input field
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }
      
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
        
        // Ctrl/Cmd + E: Create empty group at center of viewport
        if (e.key === 'e' && !e.shiftKey) {
          e.preventDefault()
          // Calculate center of viewport in canvas coordinates
          const centerX = (-canvasOffset.x + viewportSize.width / 2) / canvasZoom
          const centerY = (-canvasOffset.y + viewportSize.height / 2) / canvasZoom
          handleCreateEmptyGroup({ x: centerX, y: centerY })
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
        
        // Cmd+Shift+D to clear dirty state on all graphs (for debugging)
        if (e.key === 'd') {
          e.preventDefault()
          graphs.forEach(graph => {
            setGraphDirty(graph.id, false)
          })
          ToastManager.info('Cleared dirty state on all graphs')
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
      {/* Loading Overlay */}
      {isLoading && <LoadingOverlay message={loadingMessage} />}
      
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shadow-sm relative z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-medium text-gray-900">Zeal</h1>
          <div className="flex items-center gap-2">
            {isEditingWorkflowName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editedWorkflowName}
                  onChange={(e) => setEditedWorkflowName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setWorkflowName(editedWorkflowName)
                      setIsEditingWorkflowName(false)
                    } else if (e.key === 'Escape') {
                      setIsEditingWorkflowName(false)
                      setEditedWorkflowName(workflowName)
                    }
                  }}
                  className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  autoFocus
                />
                <button
                  onClick={() => {
                    setWorkflowName(editedWorkflowName)
                    setIsEditingWorkflowName(false)
                  }}
                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setIsEditingWorkflowName(false)
                    setEditedWorkflowName(workflowName)
                  }}
                  className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <span className="text-sm text-gray-700 font-medium">{workflowName}</span>
                <button
                  onClick={() => {
                    setIsEditingWorkflowName(true)
                    setEditedWorkflowName(workflowName)
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {workflowId && <span className="text-xs text-gray-400">ID: {workflowId.slice(0, 8)}...</span>}
            {workflowTrigger && getCurrentGraph()?.isMain && (
              <button
                onClick={() => {
                  // Find and click the trigger manager button to open the modal
                  const triggerButton = document.querySelector('[title="Edit Trigger"]') as HTMLButtonElement;
                  if (triggerButton) triggerButton.click();
                }}
                className="flex items-center gap-2 px-3 py-1 bg-purple-100 hover:bg-purple-200 rounded-full transition-colors group"
                title={`${workflowTrigger.name}: ${workflowTrigger.description || 'Click to edit trigger'}`}
              >
                <span className="text-xs font-medium text-gray-600">Trigger</span>
                <div className="w-px h-4 bg-purple-300"></div>
                <div className="flex items-center gap-1.5">
                  {workflowTrigger.type === 'rest' ? (
                    <Globe className="w-3 h-3 text-blue-600" />
                  ) : workflowTrigger.type === 'websocket' ? (
                    <Cable className="w-3 h-3 text-green-600" />
                  ) : (
                    <Clock className="w-3 h-3 text-purple-600" />
                  )}
                  <span className="text-xs font-medium text-gray-700">
                    {workflowTrigger.type === 'rest' ? 'HTTP' :
                     workflowTrigger.type === 'websocket' ? 'WebSocket' :
                     workflowTrigger.type === 'scheduler' ? (
                       (workflowTrigger.config as any).isOneTime ? 'Once' :
                       (workflowTrigger.config as any).interval ? `Every ${(workflowTrigger.config as any).interval.value} ${(workflowTrigger.config as any).interval.unit}` :
                       'Cron'
                     ) : 'Active'}
                  </span>
                  <Edit2 className="w-3 h-3 text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Save button group with shared border */}
          <div className="flex items-center border border-gray-200 rounded-md overflow-hidden">
            <button 
              onClick={handleSaveWorkflow}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Save
            </button>
            
            {/* Autosave Toggle */}
            <button
              onClick={() => setAutosaveEnabled(!autosaveEnabled)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-l cursor-pointer ${
                autosaveEnabled 
                  ? 'bg-green-50 text-green-700 hover:bg-green-100 border-green-200' 
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'
              }`}
              title={autosaveEnabled ? 'Autosave: ON - Click to disable' : 'Autosave: OFF - Click to enable'}
            >
              <RotateCcw className={`w-3 h-3 ${autosaveEnabled ? 'animate-spin' : ''}`} />
              {autosaveEnabled ? 'Auto' : 'Manual'}
            </button>
          </div>
          <button 
            onClick={handlePublishWorkflow}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Publish
          </button>
          <button 
            onClick={handleRunSimulation}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            Run
          </button>
        </div>
      </header>
      
      {/* Tab Bar */}
      <TabBar
        tabs={graphs.map(g => ({
          id: g.id,
          name: g.name,
          isMain: g.isMain,
          isDirty: g.isDirty
        }))}
        activeTabId={currentGraphId}
        onTabSelect={handleTabSelect}
        onTabClose={handleTabClose}
        onTabAdd={handleTabAdd}
        onTabRename={handleTabRename}
        onSetMainTab={handleSetMainTab}
      />

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
              <NodeGroupContainer 
                key={group.id} 
                group={group}
                isDropTarget={nodeHoveringGroupId === group.id}
                onEditClick={handleGroupEditClick}
                onDeleteClick={handleGroupDeleteClick}
                zoom={canvasZoom}
              >
                {/* Render nodes that belong to this group */}
                {groupNodes.map(node => {
                  // Check if this is a subgraph node
                  if (node.metadata.type === 'subgraph') {
                    return (
                      <SubgraphNode
                        key={`group-${group.id}-node-${node.metadata.id}`}
                        metadata={node.metadata as any}
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
                        onClick={() => handleNodeSelect(node.metadata.id)}
                        isHighlighted={node.metadata.id === highlightedNodeId}
                        isNodeSelected={isNodeSelected(node.metadata.id)}
                        zoom={canvasZoom}
                      />
                    )
                  }
                  
                  return (
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
                    onNodeDropIntoGroup={handleNodeDropIntoGroup}
                    onNodeHoverGroup={handleNodeHoverGroup}
                    groups={groups}
                    zoom={canvasZoom}
                  />
                  )
                })}
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
            .map(node => {
              // Debug log for subgraph nodes
              // if (node.metadata.type === 'subgraph') {
              //   console.log('🔍 Rendering subgraph node:', {
              //     id: node.metadata.id,
              //     type: node.metadata.type,
              //     title: node.metadata.title,
              //     graphId: (node.metadata as any).graphId,
              //     graphNamespace: (node.metadata as any).graphNamespace
              //   })
              // }
              
              // Check if this is a subgraph node
              if (node.metadata.type === 'subgraph') {
                return (
                  <SubgraphNode
                    key={`${node.metadata.id}-${node.metadata.title}-${node.metadata.icon}-${node.metadata.variant}`}
                    metadata={node.metadata as any}
                    position={node.position}
                    onPositionChange={handleNodePositionChange}
                    onBoundsChange={updateNodeBounds}
                    onPortPositionUpdate={updatePortPosition}
                    onPortDragStart={handlePortDragStart}
                    onPortDragEnd={handlePortDragEnd}
                    onClick={() => handleNodeSelect(node.metadata.id)}
                    isHighlighted={node.metadata.id === highlightedNodeId}
                    isNodeSelected={isNodeSelected(node.metadata.id)}
                    zoom={canvasZoom}
                  />
                )
              }
              
              return (
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
                  onNodeDropIntoGroup={handleNodeDropIntoGroup}
                  onNodeHoverGroup={handleNodeHoverGroup}
                  groups={groups}
                  zoom={canvasZoom}
                />
              )
            })}
        </InteractiveCanvas>

        {/* Floating UI Components */}
        <WorkflowSidebar 
          isCollapsed={isSidebarCollapsed}
          onCategoryClick={handleCategoryClick}
          // onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
        
        <SearchButton onClick={() => setIsSearchOpen(true)} />
        <NodeBrowserButton onClick={handleNodeBrowserToggle} isActive={isNodeBrowserOpen} />
        <TriggerManager />
        <UndoRedoButtons onUndo={undo} onRedo={redo} canUndo={canUndo()} canRedo={canRedo()} />
        <WorkflowBottomToolbar 
          onHistoryClick={() => setIsHistoryBrowserOpen(true)}
          onDebuggerClick={() => setIsFlowTracerOpen(true)}
          onCreateEmptyGroupClick={() => {
            // Calculate center of viewport in canvas coordinates
            const centerX = (-canvasOffset.x + viewportSize.width / 2) / canvasZoom
            const centerY = (-canvasOffset.y + viewportSize.height / 2) / canvasZoom
            handleCreateEmptyGroup({ x: centerX, y: centerY })
          }}
          onConfigClick={async () => {
            // Fetch env vars when opening configuration
            await updateConfiguredEnvVars()
            setIsConfigOpen(true)
          }}
          onAddSubgraphClick={() => {
            setSelectedCategory(null) // Reset category
            setSearchModalInitialTab('subgraphs') // Open to subgraphs tab
            setIsSearchOpen(true)
          }}
        />
        
        <Minimap
          canvasOffset={canvasOffset}
          nodes={getNodeBoundsArray().map(bounds => ({
            id: bounds.id,
            position: { x: bounds.x, y: bounds.y },
            size: { width: bounds.width, height: bounds.height }
          }))}
          groups={groups.map(group => ({
            id: group.id,
            position: group.position,
            size: group.size,
            color: group.color,
            collapsed: group.collapsed,
            title: group.title,
            nodeIds: group.nodeIds
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
        
        {/* Save Graph Button */}
        <SaveGraphButton
          isVisible={getCurrentGraph()?.isDirty || false}
          graphName={getCurrentGraph()?.name || ''}
          onSave={handleSaveGraph}
          isSaving={isSavingGraph}
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
          onNodeAdded={handleNodeAdded}
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
            setSearchModalInitialTab(undefined) // Reset tab selection
          }}
          initialCategory={selectedCategory}
          initialTab={searchModalInitialTab}
          onNodeAdded={handleNodeAdded}
          canvasOffset={canvasOffset}
          canvasZoom={canvasZoom}
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

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        isOpen={unsavedChangesDialog.isOpen}
        onSave={handleUnsavedChangesSave}
        onDiscard={handleUnsavedChangesDiscard}
        onCancel={handleUnsavedChangesCancel}
        graphName={unsavedChangesDialog.graphName}
      />

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

      {/* Empty Group Creation Modal */}
      <EmptyGroupCreationModal
        isOpen={isEmptyGroupModalOpen}
        position={emptyGroupPosition}
        onConfirm={handleEmptyGroupCreationConfirm}
        onCancel={handleEmptyGroupCreationCancel}
      />

      {/* Group Edit Modal */}
      {editingGroupId && (() => {
        const editingGroup = groups.find(g => g.id === editingGroupId)
        if (!editingGroup) return null
        
        return (
          <GroupEditModal
            isOpen={true}
            groupId={editingGroupId}
            currentTitle={editingGroup.title}
            currentDescription={editingGroup.description || ''}
            onConfirm={handleGroupEditConfirm}
            onCancel={handleGroupEditCancel}
          />
        )
      })()}

      {/* Group Delete Modal */}
      {deletingGroupId && (() => {
        const deletingGroup = groups.find(g => g.id === deletingGroupId)
        if (!deletingGroup) return null
        
        return (
          <GroupDeleteModal
            isOpen={true}
            groupId={deletingGroupId}
            groupTitle={deletingGroup.title}
            nodeCount={deletingGroup.nodeIds.length}
            onConfirm={handleGroupDeleteConfirm}
            onCancel={handleGroupDeleteCancel}
          />
        )
      })()}
    </main>
  )
}