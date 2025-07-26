import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { NodeMetadata, Connection, WorkflowNodeData, NodeGroup } from '@/types/workflow'
import { WorkflowStorageService } from '@/services/workflowStorage'
import { createWorkflowSnapshot, restoreWorkflowFromSnapshot } from '@/utils/workflowSerializer'
import { Database, Bot } from 'lucide-react'
import { useEnvVarStore } from './envVarStore'

// Extended node data that includes position
interface WorkflowNode extends WorkflowNodeData {
  metadata: NodeMetadata
  position: { x: number; y: number }
}

// Workflow state interface
interface WorkflowState {
  workflowId: string | null
  workflowName: string
  nodes: WorkflowNode[]
  connections: Connection[]
  groups: NodeGroup[]
  history: WorkflowSnapshot[]
  historyIndex: number
  maxHistorySize: number
  initialized: boolean
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
  addNode: (metadata: NodeMetadata, position: { x: number; y: number }) => void
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
  saveToStorage: () => void
  loadFromStorage: (workflowId: string) => void
  createNewWorkflow: (name?: string) => void
  setWorkflowName: (name: string) => void
  publishWorkflow: () => void
  rollbackToVersion: (versionTimestamp: string) => void
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
    nodes: [],
    connections: [],
    groups: [],
    history: [],
    historyIndex: -1,
    maxHistorySize: 50,
    initialized: false,

    // Node actions
    addNode: (metadata: NodeMetadata, position: { x: number; y: number }) => {
      console.log('=== ADDING NODE ===')
      console.log('Node metadata:', { 
        id: metadata.id, 
        templateId: metadata.templateId, 
        title: metadata.title, 
        requiredEnvVars: metadata.requiredEnvVars 
      })
      
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
        
        return newState
      })
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
      set((state) => {
        const newGroup: NodeGroup = {
          id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
    },

    moveGroup: (groupId: string, position: { x: number; y: number }) => {
      set((state) => ({
        ...state,
        groups: state.groups.map(group => 
          group.id === groupId 
            ? { ...group, position, updatedAt: new Date().toISOString() }
            : group
        )
      }))
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
          groups: []
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
    saveToStorage: () => {
      const state = get()
      if (!state.workflowId) {
        // Create new workflow if no ID exists
        const snapshot = WorkflowStorageService.createDraftWorkflow(state.workflowName)
        set({ workflowId: snapshot.id })
        
        // Update with current state
        const updatedSnapshot = createWorkflowSnapshot(
          state.nodes,
          state.connections,
          state.workflowName,
          snapshot.id,
          snapshot,
          state.groups
        )
        WorkflowStorageService.saveWorkflow(updatedSnapshot)
      } else {
        // Update existing workflow
        const existingSnapshot = WorkflowStorageService.getWorkflow(state.workflowId)
        const snapshot = createWorkflowSnapshot(
          state.nodes,
          state.connections,
          state.workflowName,
          state.workflowId,
          existingSnapshot || undefined,
          state.groups
        )
        WorkflowStorageService.saveWorkflow(snapshot)
      }
    },

    loadFromStorage: (workflowId: string) => {
      const snapshot = WorkflowStorageService.getWorkflow(workflowId)
      if (!snapshot) {
        console.error('Workflow not found:', workflowId)
        return
      }

      const { nodes, connections, groups } = restoreWorkflowFromSnapshot(snapshot)
      
      set({
        workflowId: snapshot.id,
        workflowName: snapshot.name,
        nodes,
        connections,
        groups,
        history: [],
        historyIndex: -1
      })
      
      // Save initial snapshot for undo/redo
      setTimeout(() => get().saveSnapshot(), 0)
    },

    createNewWorkflow: (name?: string) => {
      const snapshot = WorkflowStorageService.createDraftWorkflow(name)
      
      console.log('CREATING NEW EMPTY WORKFLOW')
      
      set({
        workflowId: snapshot.id,
        workflowName: snapshot.name,
        nodes: [], // Start with empty workflow
        connections: [],
        groups: [],
        history: [],
        historyIndex: -1
      })
      
      // Save initial snapshot
      setTimeout(() => get().saveSnapshot(), 0)
    },

    setWorkflowName: (name: string) => {
      set({ workflowName: name })
    },

    publishWorkflow: () => {
      const state = get()
      if (!state.workflowId) {
        console.error('No workflow to publish')
        return
      }
      
      // Save current state first
      get().saveToStorage()
      
      // Publish the workflow
      const publishedSnapshot = WorkflowStorageService.publishWorkflow(state.workflowId)
      if (publishedSnapshot) {
        console.log('Workflow published successfully:', publishedSnapshot.publishedAt)
      }
    },

    rollbackToVersion: (versionTimestamp: string) => {
      const state = get()
      if (!state.workflowId) {
        console.error('No workflow to rollback')
        return
      }
      
      const rolledBackSnapshot = WorkflowStorageService.rollbackToVersion(state.workflowId, versionTimestamp)
      if (rolledBackSnapshot) {
        // Load the rolled back version
        const { nodes, connections, groups } = restoreWorkflowFromSnapshot(rolledBackSnapshot)
        
        set({
          nodes,
          connections,
          groups,
          history: [],
          historyIndex: -1
        })
        
        // Save initial snapshot for undo/redo
        setTimeout(() => get().saveSnapshot(), 0)
      }
    }
  }))
)

// Initialize with empty snapshot
useWorkflowStore.getState().saveSnapshot()