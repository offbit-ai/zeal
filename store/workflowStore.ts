import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { NodeMetadata, Connection, WorkflowNodeData } from '@/types/workflow'

// Extended node data that includes position
interface WorkflowNode extends WorkflowNodeData {
  metadata: NodeMetadata
  position: { x: number; y: number }
}

// Workflow state interface
interface WorkflowState {
  nodes: WorkflowNode[]
  connections: Connection[]
  history: WorkflowSnapshot[]
  historyIndex: number
  maxHistorySize: number
}

// Snapshot for undo/redo
interface WorkflowSnapshot {
  nodes: WorkflowNode[]
  connections: Connection[]
  timestamp: number
}

// Actions interface
interface WorkflowActions {
  // Node actions
  addNode: (metadata: NodeMetadata, position: { x: number; y: number }) => void
  removeNode: (nodeId: string) => void
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void
  
  // Connection actions
  addConnection: (connection: Omit<Connection, 'id'>) => void
  removeConnection: (connectionId: string) => void
  updateConnectionState: (connectionId: string, state: Connection['state']) => void
  
  // History actions
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  saveSnapshot: () => void
  
  // Utility actions
  clearWorkflow: () => void
  loadWorkflow: (nodes: WorkflowNode[], connections: Connection[]) => void
}

// Combine state and actions
type WorkflowStore = WorkflowState & WorkflowActions

// Helper function to create a snapshot (preserving icon references)
const createSnapshot = (nodes: WorkflowNode[], connections: Connection[]): WorkflowSnapshot => ({
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
    nodes: [],
    connections: [],
    history: [],
    historyIndex: -1,
    maxHistorySize: 50,

    // Node actions
    addNode: (metadata: NodeMetadata, position: { x: number; y: number }) => {
      set((state) => {
        const newNode: WorkflowNode = {
          metadata,
          position
        }
        
        const newState = {
          ...state,
          nodes: [...state.nodes, newNode]
        }
        
        // Save snapshot after action
        setTimeout(() => get().saveSnapshot(), 0)
        
        return newState
      })
    },

    removeNode: (nodeId: string) => {
      set((state) => {
        // Remove node and all its connections
        const newNodes = state.nodes.filter(node => node.metadata.id !== nodeId)
        const newConnections = state.connections.filter(conn => 
          conn.source.nodeId !== nodeId && conn.target.nodeId !== nodeId
        )
        
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

    // History actions
    saveSnapshot: () => {
      set((state) => {
        const snapshot = createSnapshot(state.nodes, state.connections)
        
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
        const newState = {
          ...state,
          nodes: [],
          connections: []
        }
        
        // Save snapshot after action
        setTimeout(() => get().saveSnapshot(), 0)
        
        return newState
      })
    },

    loadWorkflow: (nodes: WorkflowNode[], connections: Connection[]) => {
      set((state) => {
        const newState = {
          ...state,
          nodes: nodes.map(node => ({
            ...node,
            metadata: { ...node.metadata },
            position: { ...node.position }
          })),
          connections: connections.map(conn => ({ ...conn }))
        }
        
        // Save snapshot after action
        setTimeout(() => get().saveSnapshot(), 0)
        
        return newState
      })
    }
  }))
)

// Initialize with empty snapshot
useWorkflowStore.getState().saveSnapshot()