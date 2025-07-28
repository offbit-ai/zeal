import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { NodeMetadata, Connection, WorkflowNodeData, NodeGroup } from '@/types/workflow'
import { WorkflowStorageService } from '@/services/workflowStorage'
import { createWorkflowSnapshot, restoreWorkflowFromSnapshot, restoreGraphFromSerialized } from '@/utils/workflowSerializer'
import { Database, Bot } from 'lucide-react'
import { useEnvVarStore } from './envVarStore'
import type { TriggerConfig } from '@/components/TriggerModal'
import { toast } from '@/lib/toast'

// Helper function to estimate node dimensions based on metadata
// Note: These are estimates since actual nodes use w-fit and content-dependent sizing
function calculateNodeDimensions(metadata: NodeMetadata): { width: number; height: number } {
  if (metadata.shape === 'circle') {
    return { width: 64, height: 64 }
  } else if (metadata.shape === 'diamond') {
    return { width: 48, height: 48 }
  }
  
  // Rectangle shape - estimate based on content
  // These nodes use w-fit, so width depends on icon + text + padding
  let estimatedWidth = 200 // More realistic minimum width
  let estimatedHeight = 70 // More realistic height
  
  // Estimate width based on title length (more accurate approximation)
  if (metadata.title) {
    const titleLength = metadata.title.length
    const estimatedTextWidth = titleLength * 10 // ~10px per character (more realistic)
    estimatedWidth = Math.max(estimatedWidth, estimatedTextWidth + 120) // Add icon + padding + margins
  }
  
  if (metadata.size === 'small') {
    estimatedHeight = 60
    estimatedWidth = Math.max(estimatedWidth, 180) // Increase minimum
  } else if (metadata.size === 'medium') {
    estimatedHeight = 70  
    estimatedWidth = Math.max(estimatedWidth, 250) // More realistic medium size
  } else if (metadata.size === 'large') {
    estimatedHeight = 80
    estimatedWidth = Math.max(estimatedWidth, 300) // More realistic large size
  }
  
  // Add extra height if subtitle is present
  if (metadata.subtitle) {
    estimatedHeight += 20 // More space for subtitle
  }
  
  return { width: estimatedWidth, height: estimatedHeight }
}

// Extended node data that includes position
interface WorkflowNode extends WorkflowNodeData {
  metadata: NodeMetadata
  position: { x: number; y: number }
}

// Selection state interface
interface SelectionState {
  selectedNodeIds: string[]
  isSelecting: boolean
  selectionStart: { x: number; y: number } | null
  selectionEnd: { x: number; y: number } | null
}

// Port position interface
interface PortPosition {
  nodeId: string
  portId: string
  x: number
  y: number
  position: 'top' | 'right' | 'bottom' | 'left'
}

// Port offset interface - stores relative position from node origin
interface PortOffset {
  nodeId: string
  portId: string
  offsetX: number
  offsetY: number
  position: 'top' | 'right' | 'bottom' | 'left'
}

// Workflow state interface
interface WorkflowState {
  workflowId: string | null
  workflowName: string
  workflowTrigger: TriggerConfig | null
  nodes: WorkflowNode[]
  connections: Connection[]
  groups: NodeGroup[]
  selection: SelectionState
  portPositions: Map<string, PortPosition>
  history: WorkflowSnapshot[]
  historyIndex: number
  maxHistorySize: number
  initialized: boolean
  isGroupDragging: boolean
}

// Snapshot for undo/redo
interface WorkflowSnapshot {
  nodes: WorkflowNode[]
  connections: Connection[]
  groups: NodeGroup[]
  timestamp: number
}

// Actions interface
interface WorkflowActions {
  // Node actions
  addNode: (metadata: NodeMetadata, position: { x: number; y: number }) => string | null
  removeNode: (nodeId: string) => void
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void
  updateNodeMetadata: (nodeId: string, metadata: NodeMetadata, saveSnapshot?: boolean) => void
  
  // Connection actions
  addConnection: (connection: Omit<Connection, 'id'>) => void
  removeConnection: (connectionId: string) => void
  updateConnectionState: (connectionId: string, state: Connection['state']) => void
  
  // Group actions
  createGroup: (title: string, description: string, nodeIds: string[], position: { x: number; y: number }) => void
  updateGroup: (groupId: string, updates: Partial<Omit<NodeGroup, 'id' | 'createdAt'>>) => void
  deleteGroup: (groupId: string) => void
  addNodeToGroup: (groupId: string, nodeId: string) => void
  removeNodeFromGroup: (groupId: string, nodeId: string) => void
  moveGroup: (groupId: string, position: { x: number; y: number }) => void
  resizeGroup: (groupId: string, size: { width: number; height: number }) => void
  autoResizeGroup: (groupId: string) => void
  createGroupFromSelection: (title: string, description: string) => void
  createEmptyGroup: (title: string, description: string, position: { x: number; y: number }) => void
  setGroupDragging: (isDragging: boolean) => void
  
  // Selection actions
  selectNode: (nodeId: string, addToSelection?: boolean) => void
  deselectNode: (nodeId: string) => void
  clearSelection: () => void
  selectMultipleNodes: (nodeIds: string[]) => void
  startSelection: (startPoint: { x: number; y: number }) => void
  updateSelection: (endPoint: { x: number; y: number }) => void
  endSelection: () => boolean
  isNodeSelected: (nodeId: string) => boolean
  
  // Port position actions
  updatePortPosition: (nodeId: string, portId: string, x: number, y: number, position: 'top' | 'right' | 'bottom' | 'left') => void
  getPortPosition: (nodeId: string, portId: string) => PortPosition | undefined
  updateAllPortPositions: (nodeId: string) => void
  
  // History actions
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  saveSnapshot: () => void
  
  // Utility actions
  clearWorkflow: () => void
  loadWorkflow: (nodes: WorkflowNode[], connections: Connection[], groups?: NodeGroup[]) => void
  setInitialized: (initialized: boolean) => void
  
  // Storage actions
  saveToStorage: () => Promise<void>
  saveToStorageWithCanvasState: (canvasState: { offset: { x: number; y: number }; zoom: number }) => Promise<void>
  loadFromStorage: (workflowId: string) => Promise<{ canvasState?: { offset: { x: number; y: number }; zoom: number } } | null>
  createNewWorkflow: (name?: string) => Promise<void>
  setWorkflowName: (name: string) => void
  setWorkflowTrigger: (trigger: TriggerConfig | null) => void
  publishWorkflow: () => Promise<void>
  rollbackToVersion: (versionTimestamp: string) => Promise<void>
  
  // Graph state management
  saveCurrentGraphState: () => { nodes: WorkflowNode[]; connections: Connection[]; groups: NodeGroup[]; trigger: TriggerConfig | null }
  loadGraphState: (state: { nodes: WorkflowNode[]; connections: Connection[]; groups: NodeGroup[]; trigger: TriggerConfig | null; portPositions?: Map<string, PortPosition> }) => void
}

// Combine state and actions
type WorkflowStore = WorkflowState & WorkflowActions

// Helper function to create a snapshot (preserving icon references)
const createSnapshot = (nodes: WorkflowNode[], connections: Connection[], groups: NodeGroup[]): WorkflowSnapshot => ({
  nodes: nodes.map(node => ({
    ...node,
    metadata: {
      ...node.metadata,
      // Keep icon reference intact, clone other properties
      ports: node.metadata.ports ? [...node.metadata.ports] : undefined
    },
    position: { ...node.position }
  })),
  connections: connections.map(conn => ({ ...conn })), // Shallow clone is sufficient
  groups: groups.map(group => ({ ...group })), // Clone groups
  timestamp: Date.now()
})

// Helper function to check if connection already exists
const connectionExists = (connections: Connection[], newConnection: Omit<Connection, 'id'>): boolean => {
  return connections.some(conn => 
    conn.source.nodeId === newConnection.source.nodeId &&
    conn.source.portId === newConnection.source.portId &&
    conn.target.nodeId === newConnection.target.nodeId &&
    conn.target.portId === newConnection.target.portId
  )
}

// Generate unique ID for connections
const generateConnectionId = (): string => `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

export const useWorkflowStore = create<WorkflowStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    workflowId: null,
    workflowName: 'Untitled Workflow',
    workflowTrigger: null,
    nodes: [],
    connections: [],
    groups: [],
    selection: {
      selectedNodeIds: [],
      isSelecting: false,
      selectionStart: null,
      selectionEnd: null
    },
    portPositions: new Map(),
    history: [],
    historyIndex: -1,
    maxHistorySize: 50,
    initialized: false,
    isGroupDragging: false,

    // Node actions
    addNode: (metadata: NodeMetadata, position: { x: number; y: number }) => {
      console.log('=== ADDING NODE ===')
      console.log('Node metadata:', { 
        id: metadata.id, 
        templateId: metadata.templateId, 
        title: metadata.title, 
        requiredEnvVars: metadata.requiredEnvVars 
      })
      
      let addedNodeId: string | null = null
      
      set((state) => {
        // Check if a node with this ID already exists
        const existingNode = state.nodes.find(node => node.metadata.id === metadata.id)
        if (existingNode) {
          console.warn(`Node with ID "${metadata.id}" already exists. Skipping duplicate.`)
          return state // Return unchanged state
        }

        const newNode: WorkflowNode = {
          metadata,
          position
        }
        
        const newState = {
          ...state,
          nodes: [...state.nodes, newNode]
        }
        
        console.log('New state after adding node:', { 
          nodeCount: newState.nodes.length,
          nodeWithEnvVars: newState.nodes.filter(n => n.metadata.requiredEnvVars?.length > 0).length
        })
        
        // Track required environment variables
        if (metadata.requiredEnvVars && metadata.requiredEnvVars.length > 0) {
          useEnvVarStore.getState().addRequiredVars(metadata.requiredEnvVars)
        }
        
        // Save snapshot after action
        setTimeout(() => get().saveSnapshot(), 0)
        
        // Port positions will be initialized by DOM measurements when the node is rendered
        
        // Store the added node ID for return
        addedNodeId = metadata.id
        
        return newState
      })
      
      return addedNodeId
    },

    removeNode: (nodeId: string) => {
      set((state) => {
        // Find the node being removed
        const nodeToRemove = state.nodes.find(node => node.metadata.id === nodeId)
        
        // Remove node and all its connections
        const newNodes = state.nodes.filter(node => node.metadata.id !== nodeId)
        const newConnections = state.connections.filter(conn => 
          conn.source.nodeId !== nodeId && conn.target.nodeId !== nodeId
        )
        
        // Remove required environment variables if this was the only node requiring them
        if (nodeToRemove?.metadata.requiredEnvVars && nodeToRemove.metadata.requiredEnvVars.length > 0) {
          // Check if any remaining nodes require the same vars
          const remainingRequiredVars = new Set<string>()
          newNodes.forEach(node => {
            if (node.metadata.requiredEnvVars) {
              node.metadata.requiredEnvVars.forEach(v => remainingRequiredVars.add(v))
            }
          })
          
          // Remove vars that are no longer required
          const varsToRemove = nodeToRemove.metadata.requiredEnvVars.filter(
            v => !remainingRequiredVars.has(v)
          )
          if (varsToRemove.length > 0) {
            useEnvVarStore.getState().removeRequiredVars(varsToRemove)
          }
        }
        
        const newState = {
          ...state,
          nodes: newNodes,
          connections: newConnections
        }
        
        // Save snapshot after action
        setTimeout(() => get().saveSnapshot(), 0)
        
        return newState
      })
    },

    updateNodePosition: (nodeId: string, position: { x: number; y: number }) => {
      set((state) => ({
        ...state,
        nodes: state.nodes.map(node => 
          node.metadata.id === nodeId 
            ? { ...node, position }
            : node
        )
      }))
      
      // Auto-resize any groups that contain this node
      const state = get()
      const groupsContainingNode = state.groups.filter(group => group.nodeIds.includes(nodeId))
      groupsContainingNode.forEach(group => {
        get().autoResizeGroup(group.id)
      })
      
      // Port positions will be updated by DOM measurements when the node moves
      // Note: Position updates don't create snapshots (too frequent)
    },

    updateNodeMetadata: (nodeId: string, metadata: NodeMetadata, saveSnapshot = true) => {
      console.log('🔄 STORE: updateNodeMetadata called for node:', nodeId)
      console.log('🔄 STORE: New metadata:', {
        title: metadata.title,
        icon: metadata.icon,
        variant: metadata.variant,
        subtitle: metadata.subtitle
      })
      
      set((state) => {
        // Find the old node to compare env vars
        const oldNode = state.nodes.find(n => n.metadata.id === nodeId)
        console.log('🔄 STORE: Old metadata:', oldNode ? {
          title: oldNode.metadata.title,
          icon: oldNode.metadata.icon,
          variant: oldNode.metadata.variant,
          subtitle: oldNode.metadata.subtitle
        } : 'not found')
        
        const oldRequiredVars = oldNode?.metadata.requiredEnvVars || []
        const newRequiredVars = metadata.requiredEnvVars || []
        
        // Update env var tracking if required vars changed
        const envVarStore = useEnvVarStore.getState()
        const varsToRemove = oldRequiredVars.filter(v => !newRequiredVars.includes(v))
        const varsToAdd = newRequiredVars.filter(v => !oldRequiredVars.includes(v))
        
        if (varsToRemove.length > 0) {
          // Check if any other nodes still require these vars
          const otherNodes = state.nodes.filter(n => n.metadata.id !== nodeId)
          const stillRequiredVars = new Set<string>()
          otherNodes.forEach(node => {
            if (node.metadata.requiredEnvVars) {
              node.metadata.requiredEnvVars.forEach(v => stillRequiredVars.add(v))
            }
          })
          
          const actualVarsToRemove = varsToRemove.filter(v => !stillRequiredVars.has(v))
          if (actualVarsToRemove.length > 0) {
            envVarStore.removeRequiredVars(actualVarsToRemove)
          }
        }
        
        if (varsToAdd.length > 0) {
          envVarStore.addRequiredVars(varsToAdd)
        }
        
        const newState = {
          ...state,
          nodes: state.nodes.map(node => 
            node.metadata.id === nodeId 
              ? { ...node, metadata: { ...metadata } }
              : node
          )
        }
        
        console.log('🔄 STORE: Updated node in new state:', newState.nodes.find(n => n.metadata.id === nodeId)?.metadata ? {
          title: newState.nodes.find(n => n.metadata.id === nodeId)!.metadata.title,
          icon: newState.nodes.find(n => n.metadata.id === nodeId)!.metadata.icon,
          variant: newState.nodes.find(n => n.metadata.id === nodeId)!.metadata.variant,
          subtitle: newState.nodes.find(n => n.metadata.id === nodeId)!.metadata.subtitle
        } : 'not found')
        
        // Save snapshot after metadata changes (only if requested)
        if (saveSnapshot) {
          setTimeout(() => get().saveSnapshot(), 0)
        }
        
        return newState
      })
    },

    // Connection actions
    addConnection: (connection: Omit<Connection, 'id'>) => {
      set((state) => {
        // Check if connection already exists
        if (connectionExists(state.connections, connection)) {
          return state // No change if duplicate
        }
        
        // Check if nodes exist
        const sourceNode = state.nodes.find(n => n.metadata.id === connection.source.nodeId)
        const targetNode = state.nodes.find(n => n.metadata.id === connection.target.nodeId)
        
        if (!sourceNode || !targetNode) {
          return state // No change if nodes don't exist
        }
        
        const newConnection: Connection = {
          ...connection,
          id: generateConnectionId(),
          state: connection.state || 'pending'
        }
        
        const newState = {
          ...state,
          connections: [...state.connections, newConnection]
        }
        
        // Port positions will be available from DOM measurements
        
        // Save snapshot after action
        setTimeout(() => get().saveSnapshot(), 0)
        
        return newState
      })
    },

    removeConnection: (connectionId: string) => {
      set((state) => {
        const newState = {
          ...state,
          connections: state.connections.filter(conn => conn.id !== connectionId)
        }
        
        // Save snapshot after action
        setTimeout(() => get().saveSnapshot(), 0)
        
        return newState
      })
    },

    updateConnectionState: (connectionId: string, connectionState: Connection['state']) => {
      set((state) => ({
        ...state,
        connections: state.connections.map(conn => 
          conn.id === connectionId 
            ? { ...conn, state: connectionState }
            : conn
        )
      }))
      // Note: State updates don't create snapshots (too frequent)
    },

    // Group actions
    createGroup: (title: string, description: string, nodeIds: string[], position: { x: number; y: number }) => {
      const groupId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      set((state) => {
        const newGroup: NodeGroup = {
          id: groupId,
          title,
          description,
          nodeIds,
          position,
          size: { width: 400, height: 300 }, // Default size
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        
        const newState = {
          ...state,
          groups: [...state.groups, newGroup]
        }
        
        // Save snapshot after action
        setTimeout(() => get().saveSnapshot(), 0)
        
        return newState
      })
      
      // Auto-resize the group to fit its nodes (immediate execution after group creation)
      setTimeout(() => {
        console.log(`🔄 Auto-resizing newly created group: ${groupId}`)
        get().autoResizeGroup(groupId)
      }, 10)
    },

    updateGroup: (groupId: string, updates: Partial<Omit<NodeGroup, 'id' | 'createdAt'>>) => {
      set((state) => {
        const newState = {
          ...state,
          groups: state.groups.map(group => 
            group.id === groupId 
              ? { ...group, ...updates, updatedAt: new Date().toISOString() }
              : group
          )
        }
        
        // Save snapshot after action
        setTimeout(() => get().saveSnapshot(), 0)
        
        return newState
      })
    },

    deleteGroup: (groupId: string) => {
      set((state) => {
        const newState = {
          ...state,
          groups: state.groups.filter(group => group.id !== groupId)
        }
        
        // Save snapshot after action
        setTimeout(() => get().saveSnapshot(), 0)
        
        return newState
      })
    },

    addNodeToGroup: (groupId: string, nodeId: string) => {
      set((state) => {
        const newState = {
          ...state,
          groups: state.groups.map(group => 
            group.id === groupId 
              ? { ...group, nodeIds: [...group.nodeIds, nodeId], updatedAt: new Date().toISOString() }
              : group
          )
        }
        
        // Save snapshot after action
        setTimeout(() => get().saveSnapshot(), 0)
        
        return newState
      })
      
      // Auto-resize the group to fit its nodes immediately
      get().autoResizeGroup(groupId)
    },

    removeNodeFromGroup: (groupId: string, nodeId: string) => {
      set((state) => {
        const newState = {
          ...state,
          groups: state.groups.map(group => 
            group.id === groupId 
              ? { ...group, nodeIds: group.nodeIds.filter(id => id !== nodeId), updatedAt: new Date().toISOString() }
              : group
          )
        }
        
        // Save snapshot after action
        setTimeout(() => get().saveSnapshot(), 0)
        
        return newState
      })
      
      // Auto-resize the group to fit its nodes immediately
      get().autoResizeGroup(groupId)
    },

    moveGroup: (groupId: string, position: { x: number; y: number }) => {
      set((state) => {
        const targetGroup = state.groups.find(g => g.id === groupId)
        if (!targetGroup) return state

        // Calculate the delta movement
        const deltaX = position.x - targetGroup.position.x
        const deltaY = position.y - targetGroup.position.y

        // Update all nodes in the group
        const updatedNodes = state.nodes.map(node => {
          if (targetGroup.nodeIds.includes(node.metadata.id)) {
            return {
              ...node,
              position: {
                x: node.position.x + deltaX,
                y: node.position.y + deltaY
              }
            }
          }
          return node
        })

        // Batch update port positions for all nodes in the group
        const portsToUpdate = new Map(state.portPositions)
        targetGroup.nodeIds.forEach(nodeId => {
          const node = updatedNodes.find(n => n.metadata.id === nodeId)
          if (node && node.metadata.ports) {
            // Get accurate node dimensions
            const { width: nodeWidth, height: nodeHeight } = calculateNodeDimensions(node.metadata)
            
            node.metadata.ports.forEach(port => {
              let portX = node.position.x
              let portY = node.position.y
              
              const portsOnSameSide = node.metadata.ports!.filter(p => p.position === port.position)
              const portIndex = portsOnSameSide.findIndex(p => p.id === port.id)
              const totalPorts = portsOnSameSide.length
              
              let offsetRatio = 0.5
              if (totalPorts > 1) {
                const spacing = 1 / (totalPorts + 1)
                offsetRatio = spacing * (portIndex + 1)
              }
              
              // Port dimensions: 12px x 12px (w-3 h-3)
              const portSize = 12
              const portOffset = 8 // -top-2, -right-2, etc. = 8px in Tailwind
              
              switch (port.position) {
                case 'top':
                  portX = node.position.x + nodeWidth * offsetRatio
                  portY = node.position.y - portOffset + portSize / 2 // Above node, centered on port
                  break
                case 'right':
                  portX = node.position.x + nodeWidth + portOffset - portSize / 2 // Right of node, centered on port
                  portY = node.position.y + nodeHeight * offsetRatio
                  break
                case 'bottom':
                  portX = node.position.x + nodeWidth * offsetRatio
                  portY = node.position.y + nodeHeight + portOffset - portSize / 2 // Below node, centered on port
                  break
                case 'left':
                  portX = node.position.x - portOffset + portSize / 2 // Left of node, centered on port
                  portY = node.position.y + nodeHeight * offsetRatio
                  break
              }
              
              const key = `${nodeId}-${port.id}`
              portsToUpdate.set(key, { nodeId, portId: port.id, x: portX, y: portY, position: port.position })
            })
          }
        })

        // Update the group position
        const updatedGroups = state.groups.map(group => 
          group.id === groupId 
            ? { ...group, position, updatedAt: new Date().toISOString() }
            : group
        )

        return {
          ...state,
          nodes: updatedNodes,
          groups: updatedGroups,
          portPositions: portsToUpdate
        }
      })
      // Note: Position updates don't create snapshots (too frequent)
    },

    resizeGroup: (groupId: string, size: { width: number; height: number }) => {
      set((state) => ({
        ...state,
        groups: state.groups.map(group => 
          group.id === groupId 
            ? { ...group, size, updatedAt: new Date().toISOString() }
            : group
        )
      }))
      // Note: Resize updates don't create snapshots (too frequent)
    },

    createGroupFromSelection: (title: string, description: string) => {
      const state = get()
      if (state.selection.selectedNodeIds.length === 0) return

      // Calculate bounding box for selected nodes
      const selectedNodes = state.nodes.filter(node => 
        state.selection.selectedNodeIds.includes(node.metadata.id)
      )
      
      if (selectedNodes.length === 0) return

      // Calculate position based on the top-left-most node
      let minX = Infinity, minY = Infinity
      selectedNodes.forEach(node => {
        minX = Math.min(minX, node.position.x)
        minY = Math.min(minY, node.position.y)
      })

      // Add padding around the nodes for positioning
      const padding = 40
      const groupPosition = { x: minX - padding, y: minY - padding }
      // Use default size - auto-resize will handle proper sizing
      const groupSize = { 
        width: 400, 
        height: 300 
      }

      // Use provided title and description
      const groupTitle = title
      const groupDescription = description

      const groupId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const newGroup: NodeGroup = {
        id: groupId,
        title: groupTitle,
        description: groupDescription,
        nodeIds: [...state.selection.selectedNodeIds],
        position: groupPosition,
        size: groupSize,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      set((currentState) => ({
        ...currentState,
        groups: [...currentState.groups, newGroup],
        selection: {
          ...currentState.selection,
          selectedNodeIds: [] // Clear selection after grouping
        }
      }))

      // Auto-resize the group to fit its nodes (immediate execution after group creation)
      setTimeout(() => {
        console.log(`🔄 Auto-resizing newly created group from selection: ${groupId}`)
        get().autoResizeGroup(groupId)
      }, 10)
      
      // Save snapshot after action
      setTimeout(() => get().saveSnapshot(), 100)
    },

    createEmptyGroup: (title: string, description: string, position: { x: number; y: number }) => {
      const groupId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      set((state) => {
        const newGroup: NodeGroup = {
          id: groupId,
          title,
          description,
          nodeIds: [], // Empty group
          position,
          size: { width: 300, height: 200 }, // Smaller default size for empty groups
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        
        const newState = {
          ...state,
          groups: [...state.groups, newGroup]
        }
        
        // Save snapshot after action
        setTimeout(() => get().saveSnapshot(), 0)
        
        return newState
      })
    },

    // Selection actions
    selectNode: (nodeId: string, addToSelection = false) => {
      set((state) => {
        const currentSelection = state.selection.selectedNodeIds
        let newSelection: string[]

        if (addToSelection) {
          // Add to existing selection if not already selected
          newSelection = currentSelection.includes(nodeId) 
            ? currentSelection
            : [...currentSelection, nodeId]
        } else {
          // Replace selection with single node
          newSelection = [nodeId]
        }

        return {
          ...state,
          selection: {
            ...state.selection,
            selectedNodeIds: newSelection
          }
        }
      })
    },

    deselectNode: (nodeId: string) => {
      set((state) => ({
        ...state,
        selection: {
          ...state.selection,
          selectedNodeIds: state.selection.selectedNodeIds.filter(id => id !== nodeId)
        }
      }))
    },

    clearSelection: () => {
      set((state) => ({
        ...state,
        selection: {
          ...state.selection,
          selectedNodeIds: [],
          isSelecting: false,
          selectionStart: null,
          selectionEnd: null
        }
      }))
    },

    selectMultipleNodes: (nodeIds: string[]) => {
      set((state) => ({
        ...state,
        selection: {
          ...state.selection,
          selectedNodeIds: [...nodeIds]
        }
      }))
    },

    startSelection: (startPoint: { x: number; y: number }) => {
      set((state) => ({
        ...state,
        selection: {
          ...state.selection,
          isSelecting: true,
          selectionStart: startPoint,
          selectionEnd: startPoint
        }
      }))
    },

    updateSelection: (endPoint: { x: number; y: number }) => {
      set((state) => ({
        ...state,
        selection: {
          ...state.selection,
          selectionEnd: endPoint
        }
      }))
    },

    endSelection: () => {
      const state = get()
      if (!state.selection.selectionStart || !state.selection.selectionEnd) {
        // Clear selection if no valid rectangle
        get().clearSelection()
        return false
      }

      // Calculate selection rectangle
      const start = state.selection.selectionStart
      const end = state.selection.selectionEnd
      const selectionRect = {
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y)
      }

      // Find nodes within selection rectangle
      const selectedNodeIds: string[] = []
      state.nodes.forEach(node => {
        const nodeWidth = 200 // Approximate node width
        const nodeHeight = 100 // Approximate node height
        const nodeRect = {
          x: node.position.x,
          y: node.position.y,
          width: nodeWidth,
          height: nodeHeight
        }

        // Check if node intersects with selection rectangle
        if (
          nodeRect.x < selectionRect.x + selectionRect.width &&
          nodeRect.x + nodeRect.width > selectionRect.x &&
          nodeRect.y < selectionRect.y + selectionRect.height &&
          nodeRect.y + nodeRect.height > selectionRect.y
        ) {
          selectedNodeIds.push(node.metadata.id)
        }
      })

      set((currentState) => ({
        ...currentState,
        selection: {
          selectedNodeIds,
          isSelecting: false,
          selectionStart: null,
          selectionEnd: null
        }
      }))

      // Return whether nodes were selected
      return selectedNodeIds.length > 0
    },

    isNodeSelected: (nodeId: string) => {
      const state = get()
      return state.selection.selectedNodeIds.includes(nodeId)
    },

    // Port position actions
    updatePortPosition: (nodeId: string, portId: string, x: number, y: number, position: 'top' | 'right' | 'bottom' | 'left') => {
      set((state) => {
        const key = `${nodeId}-${portId}`
        const newPortPositions = new Map(state.portPositions)
        newPortPositions.set(key, { nodeId, portId, x, y, position })
        return { ...state, portPositions: newPortPositions }
      })
    },

    getPortPosition: (nodeId: string, portId: string) => {
      const state = get()
      const key = `${nodeId}-${portId}`
      return state.portPositions.get(key)
    },

    updateAllPortPositions: (nodeId: string) => {
      const state = get()
      const node = state.nodes.find(n => n.metadata.id === nodeId)
      if (!node) return

      // Calculate port positions based on node position and metadata
      const ports = node.metadata.ports || []
      
      // Get accurate node dimensions
      const { width: nodeWidth, height: nodeHeight } = calculateNodeDimensions(node.metadata)

      // Batch update all port positions at once
      set((state) => {
        const newPortPositions = new Map(state.portPositions)
        
        ports.forEach(port => {
          let portX = node.position.x
          let portY = node.position.y

          // Count ports on same side for positioning
          const portsOnSameSide = ports.filter(p => p.position === port.position)
          const portIndex = portsOnSameSide.findIndex(p => p.id === port.id)
          const totalPorts = portsOnSameSide.length
          
          let offsetRatio = 0.5
          if (totalPorts > 1) {
            const spacing = 1 / (totalPorts + 1)
            offsetRatio = spacing * (portIndex + 1)
          }

          // Port dimensions: 12px x 12px (w-3 h-3)
          const portSize = 12
          const portOffset = 8 // -top-2, -right-2, etc. = 8px in Tailwind
          
          switch (port.position) {
            case 'top':
              portX = node.position.x + nodeWidth * offsetRatio
              portY = node.position.y - portOffset + portSize / 2 // Above node, centered on port
              break
            case 'right':
              portX = node.position.x + nodeWidth + portOffset - portSize / 2 // Right of node, centered on port
              portY = node.position.y + nodeHeight * offsetRatio
              break
            case 'bottom':
              portX = node.position.x + nodeWidth * offsetRatio
              portY = node.position.y + nodeHeight + portOffset - portSize / 2 // Below node, centered on port
              break
            case 'left':
              portX = node.position.x - portOffset + portSize / 2 // Left of node, centered on port
              portY = node.position.y + nodeHeight * offsetRatio
              break
          }

          const key = `${nodeId}-${port.id}`
          newPortPositions.set(key, { nodeId, portId: port.id, x: portX, y: portY, position: port.position })
        })
        
        return { ...state, portPositions: newPortPositions }
      })
    },

    // History actions
    saveSnapshot: () => {
      set((state) => {
        const snapshot = createSnapshot(state.nodes, state.connections, state.groups)
        
        // Remove any snapshots after current index (when adding after undo)
        const newHistory = state.history.slice(0, state.historyIndex + 1)
        newHistory.push(snapshot)
        
        // Limit history size
        if (newHistory.length > state.maxHistorySize) {
          newHistory.shift()
        } else {
          return {
            ...state,
            history: newHistory,
            historyIndex: newHistory.length - 1
          }
        }
        
        return {
          ...state,
          history: newHistory,
          historyIndex: newHistory.length - 1
        }
      })
    },

    undo: () => {
      set((state) => {
        if (state.historyIndex <= 0) return state
        
        const newIndex = state.historyIndex - 1
        const snapshot = state.history[newIndex]
        
        if (!snapshot) return state
        
        return {
          ...state,
          nodes: snapshot.nodes.map(node => ({
            ...node,
            metadata: { ...node.metadata },
            position: { ...node.position }
          })),
          connections: snapshot.connections.map(conn => ({ ...conn })),
          groups: snapshot.groups.map(group => ({ ...group })),
          historyIndex: newIndex
        }
      })
    },

    redo: () => {
      set((state) => {
        if (state.historyIndex >= state.history.length - 1) return state
        
        const newIndex = state.historyIndex + 1
        const snapshot = state.history[newIndex]
        
        if (!snapshot) return state
        
        return {
          ...state,
          nodes: snapshot.nodes.map(node => ({
            ...node,
            metadata: { ...node.metadata },
            position: { ...node.position }
          })),
          connections: snapshot.connections.map(conn => ({ ...conn })),
          groups: snapshot.groups.map(group => ({ ...group })),
          historyIndex: newIndex
        }
      })
    },

    canUndo: () => {
      const state = get()
      return state.historyIndex > 0
    },

    canRedo: () => {
      const state = get()
      return state.historyIndex < state.history.length - 1
    },

    // Utility actions
    clearWorkflow: () => {
      set((state) => {
        // Clear env var tracking
        useEnvVarStore.getState().clear()
        
        const newState = {
          ...state,
          nodes: [],
          connections: [],
          groups: [],
          workflowTrigger: null,
          selection: {
            selectedNodeIds: [],
            isSelecting: false,
            selectionStart: null,
            selectionEnd: null
          }
        }
        
        // Save snapshot after action
        setTimeout(() => get().saveSnapshot(), 0)
        
        return newState
      })
    },

    loadWorkflow: (nodes: WorkflowNode[], connections: Connection[], groups: NodeGroup[] = []) => {
      set((state) => {
        // Rebuild env var tracking
        const envVarStore = useEnvVarStore.getState()
        envVarStore.clear()
        
        // Add all required vars from loaded nodes
        const allRequiredVars = new Set<string>()
        nodes.forEach(node => {
          if (node.metadata.requiredEnvVars) {
            node.metadata.requiredEnvVars.forEach(v => allRequiredVars.add(v))
          }
        })
        
        if (allRequiredVars.size > 0) {
          envVarStore.addRequiredVars(Array.from(allRequiredVars))
        }
        
        const newState = {
          ...state,
          nodes: nodes.map(node => ({
            ...node,
            metadata: { ...node.metadata },
            position: { ...node.position }
          })),
          connections: connections.map(conn => ({ ...conn })),
          groups: groups.map(group => ({ ...group }))
        }
        
        // Save snapshot after action
        setTimeout(() => get().saveSnapshot(), 0)
        
        return newState
      })
    },

    setInitialized: (initialized: boolean) => {
      set((state) => ({
        ...state,
        initialized
      }))
    },

    // Storage actions
    saveToStorage: async () => {
      const state = get()
      if (!state.workflowId) {
        // Create new workflow if no ID exists
        const snapshot = await WorkflowStorageService.createDraftWorkflow(state.workflowName)
        set({ workflowId: snapshot.id })
        
        // Update with current state
        const updatedSnapshot = createWorkflowSnapshot(
          state.nodes,
          state.connections,
          state.workflowName,
          snapshot.id,
          snapshot,
          state.groups,
          state.workflowTrigger
        )
        await WorkflowStorageService.saveWorkflow(updatedSnapshot)
      } else {
        // Update existing workflow
        const existingSnapshot = await WorkflowStorageService.getWorkflow(state.workflowId)
        const snapshot = createWorkflowSnapshot(
          state.nodes,
          state.connections,
          state.workflowName,
          state.workflowId,
          existingSnapshot || undefined,
          state.groups,
          state.workflowTrigger
        )
        await WorkflowStorageService.saveWorkflow(snapshot)
      }
    },

    saveToStorageWithCanvasState: async (canvasState: { offset: { x: number; y: number }; zoom: number }) => {
      const state = get()
      if (!state.workflowId) {
        // Create new workflow if no ID exists
        const snapshot = await WorkflowStorageService.createDraftWorkflow(state.workflowName)
        set({ workflowId: snapshot.id })
        
        // Update with current state including canvas state
        const updatedSnapshot = createWorkflowSnapshot(
          state.nodes,
          state.connections,
          state.workflowName,
          snapshot.id,
          snapshot,
          state.groups,
          state.workflowTrigger,
          canvasState
        )
        await WorkflowStorageService.saveWorkflow(updatedSnapshot)
      } else {
        // Update existing workflow
        const existingSnapshot = await WorkflowStorageService.getWorkflow(state.workflowId)
        const snapshot = createWorkflowSnapshot(
          state.nodes,
          state.connections,
          state.workflowName,
          state.workflowId,
          existingSnapshot || undefined,
          state.groups,
          state.workflowTrigger,
          canvasState
        )
        await WorkflowStorageService.saveWorkflow(snapshot)
      }
    },

    loadFromStorage: async (workflowId: string) => {
      const snapshot = await WorkflowStorageService.getWorkflow(workflowId)
      if (!snapshot) {
        console.error('Workflow not found:', workflowId)
        return null
      }

      const restored = restoreWorkflowFromSnapshot(snapshot)
      
      // Handle multi-graph snapshots
      if (restored.graphs && restored.graphs.length > 0) {
        // For now, load the main graph
        const mainGraph = restored.graphs.find(g => g.isMain) || restored.graphs[0]
        const { nodes, connections, groups, canvasState } = restoreGraphFromSerialized(mainGraph)
        
        set({
          workflowId: snapshot.id,
          workflowName: snapshot.name,
          workflowTrigger: snapshot.triggerConfig || null,
          nodes: nodes || [],
          connections: connections || [],
          groups: groups || [],
          history: [],
          historyIndex: -1
        })
        
        // Save initial snapshot for undo/redo
        setTimeout(() => get().saveSnapshot(), 0)
        
        return { canvasState }
      } else {
        // Legacy single-graph format
        const { nodes, connections, groups, canvasState } = restored
        
        set({
          workflowId: snapshot.id,
          workflowName: snapshot.name,
          workflowTrigger: snapshot.trigger || null,
          nodes: nodes || [],
          connections: connections || [],
          groups: groups || [],
          history: [],
          historyIndex: -1
        })
        
        // Save initial snapshot for undo/redo
        setTimeout(() => get().saveSnapshot(), 0)
        
        return { canvasState }
      }
    },

    createNewWorkflow: async (name?: string) => {
      try {
        const snapshot = await WorkflowStorageService.createDraftWorkflow(name)
        
        console.log('CREATING NEW EMPTY WORKFLOW')
        
        set({
          workflowId: snapshot.id,
          workflowName: snapshot.name,
          workflowTrigger: null,
          nodes: [], // Start with empty workflow
          connections: [],
          groups: [],
          history: [],
          historyIndex: -1
        })
        
        // Save initial snapshot
        setTimeout(() => get().saveSnapshot(), 0)
        
        toast.success(`Created new workflow: ${snapshot.name}`)
      } catch (error) {
        console.error('Failed to create workflow:', error)
        toast.error(error)
        throw error // Re-throw to let caller handle if needed
      }
    },

    setWorkflowName: (name: string) => {
      set({ workflowName: name })
    },

    setWorkflowTrigger: (trigger: TriggerConfig | null) => {
      set({ workflowTrigger: trigger })
      // Save to storage when trigger is updated
      get().saveToStorage().catch(error => {
        console.error('Failed to save workflow after trigger update:', error)
        toast.error(error)
      })
    },

    publishWorkflow: async () => {
      const state = get()
      if (!state.workflowId) {
        toast.error('No workflow to publish')
        return
      }
      
      try {
        // Save current state first
        await get().saveToStorage()
        
        // Publish the workflow
        const publishedSnapshot = await WorkflowStorageService.publishWorkflow(state.workflowId)
        if (publishedSnapshot) {
          console.log('Workflow published successfully:', publishedSnapshot.publishedAt)
          toast.success('Workflow published successfully')
        }
      } catch (error) {
        console.error('Failed to publish workflow:', error)
        toast.error(error)
        throw error
      }
    },

    rollbackToVersion: async (versionTimestamp: string) => {
      const state = get()
      if (!state.workflowId) {
        toast.error('No workflow to rollback')
        return
      }
      
      try {
        const rolledBackSnapshot = await WorkflowStorageService.rollbackToVersion(state.workflowId, versionTimestamp)
        if (rolledBackSnapshot) {
          // Load the rolled back version
          const { nodes, connections, groups } = restoreWorkflowFromSnapshot(rolledBackSnapshot)
          
          set({
            nodes,
            connections,
            groups,
            workflowTrigger: rolledBackSnapshot.trigger || null,
            history: [],
            historyIndex: -1
          })
          
          // Port positions will be initialized by DOM measurements when nodes are rendered
          
          // Save initial snapshot for undo/redo
          setTimeout(() => get().saveSnapshot(), 0)
          
          toast.success('Successfully rolled back to previous version')
        }
      } catch (error) {
        console.error('Failed to rollback to version:', error)
        toast.error(error)
        throw error
      }
    },

    autoResizeGroup: (groupId: string) => {
      console.log(`🔄 Auto-resizing group ${groupId}`)
      set((state) => {
        const group = state.groups.find(g => g.id === groupId)
        if (!group || group.nodeIds.length === 0) {
          console.log(`❌ Auto-resize failed: group not found or no nodes`)
          return state
        }
        
        // Get all nodes in this group
        const groupNodes = state.nodes.filter(node => group.nodeIds.includes(node.metadata.id))
        console.log(`📊 Found ${groupNodes.length} nodes in group:`, groupNodes.map(n => n.metadata.id))
        if (groupNodes.length === 0) return state
        
        // Calculate bounding box of all nodes in the group
        // We need to estimate node dimensions since we don't have actual DOM measurements here
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        
        groupNodes.forEach(node => {
          const nodeDimensions = calculateNodeDimensions(node.metadata)
          const nodeLeft = node.position.x
          const nodeTop = node.position.y
          const nodeRight = node.position.x + nodeDimensions.width
          const nodeBottom = node.position.y + nodeDimensions.height
          
          minX = Math.min(minX, nodeLeft)
          minY = Math.min(minY, nodeTop)
          maxX = Math.max(maxX, nodeRight)
          maxY = Math.max(maxY, nodeBottom)
        })
        
        // Add padding around the nodes
        const padding = 40 // Increased padding for better spacing
        const headerHeight = group.description ? 60 : 32
        
        // Calculate new group size
        const contentWidth = maxX - minX + (padding * 2)
        const contentHeight = maxY - minY + (padding * 2) + headerHeight
        
        // Ensure minimum size
        const newWidth = Math.max(contentWidth, 200)
        const newHeight = Math.max(contentHeight, 150)
        
        console.log(`📏 Group resize calculation:`, {
          boundingBox: { minX, minY, maxX, maxY },
          contentSize: { width: contentWidth, height: contentHeight },
          finalSize: { width: newWidth, height: newHeight },
          oldSize: group.size
        })
        
        // Update group size
        return {
          ...state,
          groups: state.groups.map(g => 
            g.id === groupId 
              ? { ...g, size: { width: newWidth, height: newHeight }, updatedAt: new Date().toISOString() }
              : g
          )
        }
      })
    },
    setGroupDragging: (isDragging: boolean) => {
      set((state) => ({
        ...state,
        isGroupDragging: isDragging
      }))
    },
    
    // Graph state management
    saveCurrentGraphState: () => {
      const state = get()
      return {
        nodes: state.nodes,
        connections: state.connections,
        groups: state.groups,
        trigger: state.workflowTrigger
      }
    },
    
    loadGraphState: (graphState: { nodes: WorkflowNode[]; connections: Connection[]; groups: NodeGroup[]; trigger: TriggerConfig | null; portPositions?: Map<string, PortPosition> }) => {
      set({
        nodes: graphState.nodes,
        connections: graphState.connections,
        groups: graphState.groups,
        workflowTrigger: graphState.trigger,
        portPositions: new Map(), // Always start with empty port positions - let nodes recalculate
        history: [],
        historyIndex: -1,
        selection: {
          selectedNodeIds: [],
          isSelecting: false,
          selectionStart: null,
          selectionEnd: null
        }
      })
      
      // Save initial snapshot for undo/redo
      setTimeout(() => get().saveSnapshot(), 0)
    }
  }))
)

// Initialize with empty snapshot
useWorkflowStore.getState().saveSnapshot()