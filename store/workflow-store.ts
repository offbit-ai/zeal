/**
 * Workflow Store - Clean CRDT Implementation
 *
 * Core principles:
 * - CRDT is the single source of truth
 * - All mutations go through CRDT transactions
 * - Observers are side-effect free
 * - Real-time sync for all operations
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { shallow } from 'zustand/shallow'
import * as Y from 'yjs'
import { YMapEvent } from 'yjs'
import { RustSocketIOProvider } from '@/lib/crdt/rust-socketio-provider'
import { SyncOptimizerV2 } from '@/lib/crdt/sync-optimizer'
import { WorkflowStorageService } from '@/services/workflowStorage'
import { calculateNodeDimensions } from '@/utils/nodeUtils'
import type { Connection as WorkflowConnection, NodeMetadata, NodeGroup } from '@/types/workflow'
import type { CRDTPresence } from '@/lib/crdt/types'
import type {
  WorkflowSnapshot,
  WorkflowGraph,
  SerializedNode,
  SerializedConnection,
  SerializedGroup,
} from '@/types/snapshot'
import { WorkflowNodeData, Connection } from '@/types/workflow'
import type { TriggerConfig } from '@/components/TriggerModal'
import { roomKeeper } from '@/lib/services/room-keeper'

// Graph information
interface GraphInfo {
  id: string
  name: string
  namespace: string
  isMain?: boolean
  isDirty?: boolean
  canvasState?: CanvasState
}

// Canvas state (local only, not synced)
interface CanvasState {
  offset: { x: number; y: number }
  zoom: number
}

// Store interface
interface WorkflowStore {
  // Core state
  workflowId: string
  workflowName: string
  initialized: boolean
  workflowTrigger: TriggerConfig | null

  // CRDT
  doc: Y.Doc | null
  provider: RustSocketIOProvider | null
  syncOptimizer: SyncOptimizerV2 | null

  // Current view state
  currentGraphId: string
  nodes: WorkflowNodeData[]
  connections: WorkflowConnection[]
  groups: NodeGroup[]
  graphs: GraphInfo[]

  // Canvas state (per graph, local only)
  canvasStates: Record<string, CanvasState>

  // Selection state (local only)
  selectedNodeIds: string[]

  // Dirty state tracking (per graph, local only)
  dirtyGraphs: Set<string>

  // Presence
  presence: Map<number, CRDTPresence>
  localClientId?: number
  isConnected: boolean
  isSyncing: boolean

  // Force update timestamp
  lastUpdate?: number
  isOptimized: boolean

  // Data snapshot for diffing
  dataSnapshot?: string

  // Track embed mode
  embedMode: boolean
  // Track follow mode (auto-scroll to changes)
  followMode: boolean

  // Core actions
  initialize: (
    workflowId: string,
    workflowName?: string,
    options?: { embedMode?: boolean; collaborative?: boolean; followMode?: boolean }
  ) => Promise<void>
  cleanup: () => void

  // Graph management
  addGraph: (name: string) => string
  removeGraph: (graphId: string) => boolean
  renameGraph: (graphId: string, newName: string) => void
  switchGraph: (graphId: string) => void

  // Node management
  addNode: (metadata: NodeMetadata, position: { x: number; y: number }) => string
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void
  updateNodeProperty: (nodeId: string, property: string, value: any) => void
  updateNodeMetadata: (nodeId: string, metadata: NodeMetadata, saveSnapshot?: boolean) => void
  removeNode: (nodeId: string) => void
  getNodesForGraph: (graphId: string) => WorkflowNodeData[]

  // Connection management
  addConnection: (connection: WorkflowConnection) => void
  updateConnectionState: (connectionId: string, state: string) => void
  removeConnection: (connectionId: string) => void

  // Group management
  createGroup: (title: string, nodeIds: string[], color?: string) => string
  updateGroup: (groupId: string, updates: Partial<NodeGroup>) => void
  updateNodePositionInGroup: (
    groupId: string,
    nodeId: string,
    position: { x: number; y: number }
  ) => void
  updateGroupBounds: (
    groupId: string,
    bounds: Partial<{ x: number; y: number; width: number; height: number }>
  ) => void
  recalculateGroupBounds: (
    groupId: string,
    localNodePositions?: Record<string, { x: number; y: number }>
  ) => void
  recalculateAllGroupBounds: () => void
  addNodeToGroup: (nodeId: string, groupId: string) => void
  removeNodeFromGroup: (nodeId: string, groupId: string) => void
  removeGroup: (groupId: string) => void

  // Canvas state (local only)
  updateCanvasState: (graphId: string, state: Partial<CanvasState>) => void
  scrollToElement: (position: { x: number; y: number }, zoom?: number) => void

  // Selection (local only)
  setSelectedNodes: (nodeIds: string[]) => void

  // Utility
  getAllGraphsData: () => Array<{
    id: string
    name: string
    namespace: string
    isMain: boolean
    nodes: any[]
    connections: WorkflowConnection[]
    groups: NodeGroup[]
  }>

  // Presence
  updateCursorPosition: (position: { x: number; y: number }) => void

  // Persistence
  saveToAPI: () => Promise<void>
  enableAutosave: (enabled: boolean) => void
  rollbackToVersion: (versionId: string) => Promise<void>

  // Workflow metadata
  setWorkflowName: (name: string) => void
  setWorkflowTrigger: (trigger: TriggerConfig | null) => void

  // Dirty state management
  setGraphDirty: (graphId: string, isDirty: boolean) => void
  isGraphDirty: (graphId: string) => boolean
  clearAllDirtyState: () => void

  // CRDT connection management
  connectCRDT: () => void
}

// Store implementation
// Separate selector hooks to prevent unnecessary re-renders
export const useConnectionStatus = () => {
  const isConnected = useWorkflowStore(state => state.isConnected)
  const isSyncing = useWorkflowStore(state => state.isSyncing)
  return { isConnected, isSyncing }
}

export const usePresence = () => {
  const presence = useWorkflowStore(state => state.presence)
  const localClientId = useWorkflowStore(state => state.localClientId)
  return { presence, localClientId }
}

export const useWorkflowData = () => {
  const nodes = useWorkflowStore(state => state.nodes)
  const connections = useWorkflowStore(state => state.connections)
  const groups = useWorkflowStore(state => state.groups)
  const currentGraphId = useWorkflowStore(state => state.currentGraphId)
  const graphs = useWorkflowStore(state => state.graphs)

  return { nodes, connections, groups, currentGraphId, graphs }
}

export const useWorkflowStore = create<WorkflowStore>()(
  devtools((set, get) => {
    return {
      // Initial state
      workflowId: '',
      workflowName: 'Untitled Workflow',
      initialized: false,
      workflowTrigger: null,
      doc: null,
      provider: null,
      syncOptimizer: null,
      currentGraphId: 'main',
      nodes: [],
      connections: [],
      groups: [],
      graphs: [],
      canvasStates: {},
      selectedNodeIds: [],
      dirtyGraphs: new Set(),
      presence: new Map(),
      localClientId: undefined,
      lastUpdate: Date.now(),
      isConnected: false,
      isSyncing: false,
      isOptimized: false,
      dataSnapshot: undefined,
      embedMode: false,
      followMode: false,

      initialize: async (
        workflowId: string,
        workflowName?: string,
        options?: { embedMode?: boolean; collaborative?: boolean; followMode?: boolean }
      ) => {
        // Clean up any existing connection
        get().cleanup()

        // Create Y.Doc
        // In embed mode without collaboration, use a unique doc ID to avoid any cached data
        // In embed mode WITH collaboration, use the same workflowId for real-time updates
        // (presence will still be disabled via skipPresence flag)
        const docId =
          options?.embedMode && !options?.collaborative
            ? `${workflowId}-embed-${Date.now()}`
            : workflowId
        const doc = new Y.Doc({ guid: docId })

        // Initialize structure
        const metadataMap = doc.getMap('metadata')
        const graphsMap = doc.getMap<GraphInfo>('graphs')

        // Set up all observers before loading data
        setupObservers(doc, set, get)

        // Create provider and connect
        const { isCollaborationEnabled, getCRDTServerUrl } = await import('@/lib/config/runtime')

        // Check if CRDT should be enabled based on options and runtime config
        let enableCRDT = isCollaborationEnabled()

        // If in embed mode, respect the collaborative setting from options
        if (options?.embedMode) {
          enableCRDT = options.collaborative ?? false
        }

        // Store embed mode and follow mode in state
        set({
          embedMode: options?.embedMode ?? false,
          followMode: options?.followMode ?? false,
        })

        let provider: RustSocketIOProvider | null = null
        if (enableCRDT) {
          const serverUrl = getCRDTServerUrl()

          provider = new RustSocketIOProvider(doc, {
            roomName: workflowId,
            serverUrl: serverUrl,
            autoConnect: false, // Don't connect immediately
            skipPresence: options?.embedMode, // Skip presence in embed mode
            auth: {
              userId: sessionStorage.getItem('userId') || undefined,
              userName: sessionStorage.getItem('userName') || undefined,
            },
            onStatusChange: status => {
              const currentState = get()
              // Update connection status without triggering re-render of data components
              // Only update the specific fields without touching data
              const newConnected = status === 'connected'
              const newSyncing = status === 'connecting'

              if (
                currentState.isConnected !== newConnected ||
                currentState.isSyncing !== newSyncing
              ) {
                set({
                  isConnected: newConnected,
                  isSyncing: newSyncing,
                })
              }

              // Reset sync optimizer on reconnection
              if (status === 'connected' && currentState.syncOptimizer) {
                currentState.syncOptimizer.reset()
              }

              // Auto-reconnect on disconnect
              if (status === 'disconnected') {
                setTimeout(() => {
                  if (provider && !provider.connected) {
                    try {
                      provider.connect()
                    } catch (error) {
                      console.error('[WorkflowStore] Reconnection failed:', error)
                      // Try again in 5 seconds
                      setTimeout(() => {
                        if (provider && !provider.connected) {
                          provider.connect()
                        }
                      }, 5000)
                    }
                  }
                }, 1000)
              }
            },
            onSyncComplete: () => {
              set({ isSyncing: false })
            },
          })

          // Set up presence only if not in embed mode
          if (!options?.embedMode) {
            setupPresence(provider, set, get, doc)
          }

          // Create sync optimizer
          const syncOptimizer = new SyncOptimizerV2({
            onOptimizationChange: isOptimized => {
              set({ isOptimized })
            },
            minUsersForFullSync: 2,
            optimizedInterval: 30000,
          })

          syncOptimizer.attach(provider)

          // Update state with provider
          set({
            workflowId,
            doc,
            provider,
            syncOptimizer,
            initialized: true,
          })

          // Start room keeper to keep the CRDT room alive
          roomKeeper.start(workflowId)
        } else {
          // Update state without provider (no CRDT)
          set({
            workflowId,
            doc,
            provider: null,
            syncOptimizer: null,
            initialized: true,
          })
        }

        // Manually sync graphs state to ensure React gets the update
        const graphs: GraphInfo[] = []
        graphsMap.forEach((info: GraphInfo) => graphs.push(info))
        graphs.sort((a, b) => {
          if (a.isMain) return -1
          if (b.isMain) return 1
          return 0
        })
        set({ graphs })

        // ALWAYS load from API/Database first - it's the source of truth
        // This ensures deleted nodes and changes are reflected everywhere
        // In embed mode without collaboration, we NEVER use CRDT data
        // Always start fresh to ensure we see the latest state

        // Load from API/Database
        let snapshot: WorkflowSnapshot | null = null
        let isNewWorkflow = false

        try {
          snapshot = await WorkflowStorageService.getWorkflow(workflowId)
        } catch (error: any) {
          if (error?.code === 'WORKFLOW_NOT_FOUND' || error?.statusCode === 404) {
            isNewWorkflow = true
          } else {
            console.error('[WorkflowStore] Error loading workflow:', error)
            throw error
          }
        }

        if (isNewWorkflow) {
          // Create new empty workflow with proper structure
          const now = new Date().toISOString()
          const mainGraph: WorkflowGraph = {
            id: 'main',
            name: 'Main',
            namespace: `${workflowId}/main`,
            isMain: true,
            nodes: [],
            connections: [],
            groups: [],
            canvasState: { offset: { x: 0, y: 0 }, zoom: 1 },
          }

          snapshot = {
            id: workflowId,
            name: workflowName || 'Untitled Workflow',
            description: '',
            createdAt: now,
            updatedAt: now,
            lastSavedAt: now,
            saveCount: 1,
            isDraft: true,
            isPublished: false,
            graphs: [mainGraph],
            activeGraphId: 'main',
            metadata: {
              version: '1.0.0',
              totalNodeCount: 0,
              totalConnectionCount: 0,
              totalGroupCount: 0,
              graphCount: 1,
            },
          }

          // Save to API
          await WorkflowStorageService.saveWorkflow(snapshot)
        }

        // Load snapshot data into CRDT
        if (snapshot) {
          doc.transact(() => {
            // Set metadata with validation
            if (snapshot.id) metadataMap.set('workflowId', String(snapshot.id))
            if (snapshot.name) metadataMap.set('name', String(snapshot.name))

            // Set last modified timestamp from database
            const dbTimestamp = new Date(snapshot.updatedAt || snapshot.lastSavedAt).getTime()
            metadataMap.set('lastModified', dbTimestamp)

            // Load graphs
            if (snapshot.graphs && snapshot.graphs.length > 0) {
              snapshot.graphs.forEach(graph => {
                // Add graph info
                // Validate graph has required fields
                if (!graph.id || !graph.name) {
                  console.warn('[WorkflowStore] Skipping graph with missing id or name:', graph)
                  return
                }

                const graphInfo = {
                  id: String(graph.id),
                  name: String(graph.name),
                  namespace: String(graph.namespace || `${snapshot.id}/${graph.id}`),
                  isMain: graph.isMain || graph.id === 'main',
                }
                graphsMap.set(String(graph.id), graphInfo)

                // Load nodes
                const nodesMap = doc.getMap(`nodes-${graph.id}`)
                graph.nodes.forEach((node: any) => {
                  const yNode = new Y.Map()
                  // Handle both WorkflowNode and SerializedNode formats
                  const nodeId = node.id || node.metadata?.id
                  const metadata = node.metadata || {
                    id: nodeId,
                    type: node.type,
                    title: node.title || 'Untitled',
                    icon: node.icon || 'Circle',
                    variant: node.variant || 'gray-600',
                    shape: node.shape || 'rectangle',
                    size: node.size || 'medium',
                    ports: node.ports || [],
                    properties: node.properties || [],
                  }
                  // Validate nodeId is not null/undefined
                  if (!nodeId) {
                    console.warn('[WorkflowStore] Skipping node with no ID:', node)
                    return
                  }

                  yNode.set('id', String(nodeId))
                  yNode.set('metadata', metadata)
                  yNode.set('position', node.position || { x: 0, y: 0 })
                  yNode.set('propertyValues', node.propertyValues || metadata.propertyValues || {})
                  nodesMap.set(String(nodeId), yNode)
                })

                // Load connections
                const connectionsMap = doc.getMap(`connections-${graph.id}`)
                graph.connections.forEach(conn => {
                  const yConn = new Y.Map()
                  // Validate connection has required fields
                  if (!conn.id || !conn.source || !conn.target) {
                    console.warn('[WorkflowStore] Skipping connection with missing fields:', conn)
                    return
                  }

                  yConn.set('id', String(conn.id))
                  yConn.set('source', conn.source)
                  yConn.set('target', conn.target)
                  yConn.set('metadata', conn.metadata || {})
                  yConn.set('state', String(conn.state || 'idle'))
                  connectionsMap.set(String(conn.id), yConn)
                })

                // Load groups as plain objects
                const groupsMap = doc.getMap(`groups-${graph.id}`)
                graph.groups?.forEach(group => {
                  // Ensure all required fields have valid values
                  const plainGroup = {
                    id: group.id || '',
                    title: group.title || '',
                    description: group.description || '',
                    color: group.color || '#3b82f6',
                    position: group.position || { x: 0, y: 0 },
                    size: group.size || { width: 200, height: 150 },
                    nodeIds: group.nodeIds || [],
                    isCollapsed: group.isCollapsed || false,
                    createdAt: group.createdAt || new Date().toISOString(),
                    updatedAt: group.updatedAt || new Date().toISOString(),
                  }

                  // Validate required string fields are not null/undefined
                  if (!plainGroup.id || !plainGroup.title) {
                    console.warn('[WorkflowStore] Skipping group with invalid id or title:', group)
                    return
                  }

                  groupsMap.set(plainGroup.id, plainGroup)
                })

                // Load canvas state if available
                if (graph.canvasState) {
                  set((state: any) => ({
                    canvasStates: {
                      ...state.canvasStates,
                      [graph.id]: graph.canvasState,
                    },
                  }))
                }
              })
            } else {
              // Ensure at least main graph exists
              graphsMap.set('main', {
                id: 'main',
                name: 'Main',
                namespace: `${snapshot.id}/main`,
                isMain: true,
              })
            }
          })

          // Switch to active graph or main
          const activeGraphId = snapshot.activeGraphId || 'main'
          if (get().graphs.find(g => g.id === activeGraphId)) {
            get().switchGraph(activeGraphId)
          }
        }
      },

      cleanup: () => {
        const { provider, syncOptimizer, doc } = get()

        // Stop room keeper
        roomKeeper.stop()

        // Clean up observers
        cleanupObservers()

        // Clean up autosave
        if (autosaveTimer) {
          clearInterval(autosaveTimer)
          autosaveTimer = null
        }

        if (syncOptimizer) {
          syncOptimizer.detach()
        }

        if (provider) {
          provider.disconnect()
        }

        if (doc) {
          doc.destroy()
        }

        set({
          doc: null,
          provider: null,
          initialized: false,
          nodes: [],
          connections: [],
          groups: [],
          graphs: [],
          presence: new Map(),
          localClientId: undefined,
          isConnected: false,
          dataSnapshot: undefined,
        })
      },

      // Graph management
      addGraph: (name: string) => {
        const { doc, workflowId } = get()
        if (!doc) return ''

        const graphId = `graph-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

        doc.transact(() => {
          const graphsMap = doc.getMap('graphs')
          graphsMap.set(graphId, {
            id: graphId,
            name,
            namespace: `${workflowId}/${graphId}`,
            isMain: false,
          })
        }, 'local')

        return graphId
      },

      removeGraph: (graphId: string) => {
        const { doc, currentGraphId, graphs } = get()
        if (!doc || graphId === 'main') return false

        doc.transact(() => {
          // Remove graph
          const graphsMap = doc.getMap('graphs')
          graphsMap.delete(graphId)

          // Clear all data for this graph
          doc.getMap(`nodes-${graphId}`).clear()
          doc.getMap(`connections-${graphId}`).clear()
          doc.getMap(`groups-${graphId}`).clear()
        }, 'local')

        // If we removed the current graph, switch to main
        if (currentGraphId === graphId) {
          get().switchGraph('main')
        }
        return true
      },

      renameGraph: (graphId: string, newName: string) => {
        const { doc } = get()
        if (!doc) return

        doc.transact(() => {
          const graphsMap = doc.getMap('graphs')
          const graphInfo = graphsMap.get(graphId) as GraphInfo
          if (graphInfo) {
            graphsMap.set(graphId, { ...graphInfo, name: newName })
          }
        }, 'local')
      },

      switchGraph: (graphId: string) => {
        const { graphs } = get()
        if (!graphs.find(g => g.id === graphId)) return

        set({ currentGraphId: graphId })

        // Load data for the new graph
        const { doc } = get()
        if (doc) {
          loadGraphData(doc, graphId, get, set)
        }
      },

      // Node management
      addNode: (metadata: NodeMetadata, position: { x: number; y: number }) => {
        const { doc, currentGraphId, initialized } = get()

        if (!doc) {
          console.error('[WorkflowStore] Cannot add node - no doc', {
            initialized,
            currentGraphId,
            storeState: {
              workflowId: get().workflowId,
              graphs: get().graphs.length,
            },
          })
          return ''
        }

        const nodeId = metadata.id

        doc.transact(() => {
          // Update lastModified timestamp
          const metadataMap = doc.getMap('metadata')
          metadataMap.set('lastModified', Date.now())

          const nodesMap = doc.getMap(`nodes-${currentGraphId}`)
          const yNode = new Y.Map()

          yNode.set('id', nodeId)
          yNode.set('metadata', metadata)
          yNode.set('position', position)
          yNode.set('propertyValues', metadata.propertyValues || {})

          nodesMap.set(nodeId, yNode)
        }, 'local')

        // Mark graph as dirty
        get().setGraphDirty(currentGraphId, true)

        // Save to API immediately to ensure changes are persisted
        get()
          .saveToAPI()
          .catch(error => {
            console.error('[WorkflowStore] Failed to save after adding node:', error)
          })

        // Auto-scroll to new node if follow mode is enabled
        get().scrollToElement(position)

        return nodeId
      },

      updateNodePosition: (nodeId: string, position: { x: number; y: number }) => {
        const { doc, currentGraphId } = get()
        if (!doc) return

        doc.transact(() => {
          const nodesMap = doc.getMap(`nodes-${currentGraphId}`)
          const yNode = nodesMap.get(nodeId) as Y.Map<any>
          if (yNode) {
            const oldPosition = yNode.get('position')
            yNode.set('position', position)
          }
        }, 'local')

        // Mark graph as dirty
        get().setGraphDirty(currentGraphId, true)
      },

      updateNodeProperty: (nodeId: string, property: string, value: any) => {
        const { doc, currentGraphId } = get()
        if (!doc) return

        doc.transact(() => {
          const nodesMap = doc.getMap(`nodes-${currentGraphId}`)
          const yNode = nodesMap.get(nodeId) as Y.Map<any>
          if (yNode) {
            // Update propertyValues at the node level
            const properties = yNode.get('propertyValues') || {}
            yNode.set('propertyValues', { ...properties, [property]: value })
            
            // Also update metadata.propertyValues to ensure UI reflects the change
            const metadata = yNode.get('metadata') || {}
            const updatedMetadata = {
              ...metadata,
              propertyValues: {
                ...(metadata.propertyValues || {}),
                [property]: value
              }
            }
            yNode.set('metadata', updatedMetadata)
          }
        }, 'local')

        // Mark graph as dirty
        get().setGraphDirty(currentGraphId, true)
      },

      updateNodeMetadata: (
        nodeId: string,
        metadata: NodeMetadata,
        saveSnapshot: boolean = false
      ) => {
        const { doc, currentGraphId } = get()
        if (!doc) return

        doc.transact(() => {
          const nodesMap = doc.getMap(`nodes-${currentGraphId}`)
          const yNode = nodesMap.get(nodeId) as Y.Map<any>
          if (yNode) {
            // Update the entire metadata object
            yNode.set('metadata', metadata)

            // Also update propertyValues if they're part of the metadata
            if (metadata.propertyValues) {
              yNode.set('propertyValues', metadata.propertyValues)
            }
          }
        }, 'local')

        // Mark graph as dirty
        get().setGraphDirty(currentGraphId, true)

        // Save snapshot if requested (for undo/redo functionality)
        if (saveSnapshot) {
          // Force an update to trigger any snapshot mechanisms
          set({ lastUpdate: Date.now() })
        }
      },

      removeNode: (nodeId: string) => {
        const { doc, currentGraphId } = get()
        if (!doc) return

        doc.transact(() => {
          // Update lastModified timestamp to ensure CRDT deletions are preserved
          const metadataMap = doc.getMap('metadata')
          metadataMap.set('lastModified', Date.now())

          // Remove node
          const nodesMap = doc.getMap(`nodes-${currentGraphId}`)
          nodesMap.delete(nodeId)

          // Remove connections
          const connectionsMap = doc.getMap(`connections-${currentGraphId}`)
          const toRemove: string[] = []
          connectionsMap.forEach((yConn: any, connId: string) => {
            const source = yConn.get('source')
            const target = yConn.get('target')
            if (source?.nodeId === nodeId || target?.nodeId === nodeId) {
              toRemove.push(connId)
            }
          })
          toRemove.forEach(id => connectionsMap.delete(id))

          // Remove from groups
          const groupsMap = doc.getMap(`groups-${currentGraphId}`)
          groupsMap.forEach((storedGroup: any, groupId: string) => {
            // Handle both Y.Map and plain object formats
            let nodeIds: string[]
            if (storedGroup instanceof Y.Map) {
              nodeIds = storedGroup.get('nodeIds') || []
            } else {
              nodeIds = storedGroup.nodeIds || []
            }

            if (nodeIds.includes(nodeId)) {
              // Update the group by removing the node
              const updatedNodeIds = nodeIds.filter(id => id !== nodeId)

              if (storedGroup instanceof Y.Map) {
                storedGroup.set('nodeIds', updatedNodeIds)
              } else {
                // For plain objects, we need to delete and re-add
                const updatedGroup = {
                  ...storedGroup,
                  nodeIds: updatedNodeIds,
                  updatedAt: new Date().toISOString(),
                }
                groupsMap.delete(groupId)
                groupsMap.set(groupId, updatedGroup)
              }
            }
          })
        }, 'local')

        // Mark graph as dirty
        get().setGraphDirty(currentGraphId, true)

        // Wait a tick to ensure CRDT transaction is complete before saving
        setTimeout(() => {
          // Save to API to ensure deletion is persisted
          get()
            .saveToAPI()
            .then(() => {
              // Successfully saved
            })
            .catch(error => {
              console.error('[WorkflowStore] CRITICAL: Failed to save after node deletion:', error)
              // Show user-facing error
              if (typeof window !== 'undefined' && window.alert) {
                window.alert('Failed to save node deletion. Please refresh the page.')
              }
            })
        }, 10)
      },

      getNodesForGraph: (graphId: string) => {
        const { doc } = get()
        if (!doc) return []

        const nodesMap = doc.getMap(`nodes-${graphId}`)
        const nodes: WorkflowNodeData[] = []

        nodesMap.forEach((yNode: any, nodeId: string) => {
          const metadata = yNode.get('metadata') || {}
          const position = yNode.get('position')

          const node: WorkflowNodeData = {
            metadata: {
              id: nodeId,
              ...metadata,
              propertyValues: yNode.get('propertyValues') || metadata.propertyValues || {},
            },
            position: position, // No default - preserve exact position
          }
          nodes.push(node)
        })

        return nodes
      },

      // Connection management
      addConnection: (connection: WorkflowConnection) => {
        const { doc, currentGraphId } = get()
        if (!doc) {
          console.error('[WorkflowStore] Cannot add connection - no doc')
          return
        }

        if (!currentGraphId) {
          console.error('[WorkflowStore] Cannot add connection - no currentGraphId')
          return
        }

        // Validate connection data
        if (!connection || !connection.id) {
          console.error('[WorkflowStore] Invalid connection - missing id:', connection)
          return
        }

        if (!connection.source || !connection.source.nodeId || !connection.source.portId) {
          console.error('[WorkflowStore] Invalid connection source:', connection)
          return
        }

        if (!connection.target || !connection.target.nodeId || !connection.target.portId) {
          console.error('[WorkflowStore] Invalid connection target:', connection)
          return
        }

        try {
          doc.transact(() => {
            // Update lastModified timestamp
            const metadataMap = doc.getMap('metadata')
            metadataMap.set('lastModified', Date.now())

            const connectionsMap = doc.getMap(`connections-${currentGraphId}`)
            const yConn = new Y.Map()

            // Ensure all values are properly defined
            yConn.set('id', String(connection.id))
            yConn.set('source', {
              nodeId: String(connection.source.nodeId),
              portId: String(connection.source.portId),
            })
            yConn.set('target', {
              nodeId: String(connection.target.nodeId),
              portId: String(connection.target.portId),
            })
            yConn.set('state', String(connection.state || 'pending'))

            connectionsMap.set(connection.id, yConn)

            // Debug logging
            console.log('[DEBUG] Connection added to CRDT:', {
              graphId: currentGraphId,
              connectionId: connection.id,
              source: connection.source,
              target: connection.target,
              state: connection.state,
              connectionsMapSize: connectionsMap.size,
            })
          }, 'local')
        } catch (error) {
          console.error('[WorkflowStore] Error adding connection to CRDT:', error, {
            connection,
            currentGraphId,
            hasDoc: !!doc,
          })
          return
        }

        // Mark graph as dirty
        get().setGraphDirty(currentGraphId, true)

        // Force sync after adding connection
        // Don't update awareness here - it interferes with presence tracking

        // Auto-scroll to connection midpoint if follow mode is enabled
        const nodes = get().nodes
        const sourceNode = nodes.find(
          n => ((n as any).id || n.metadata.id) === connection.source.nodeId
        )
        const targetNode = nodes.find(
          n => ((n as any).id || n.metadata.id) === connection.target.nodeId
        )

        if (sourceNode && targetNode) {
          // Calculate midpoint between source and target nodes
          const midpoint = {
            x: (sourceNode.position.x + targetNode.position.x) / 2,
            y: (sourceNode.position.y + targetNode.position.y) / 2,
          }
          get().scrollToElement(midpoint)
        }
      },

      updateConnectionState: (connectionId: string, state: string) => {
        const { doc, currentGraphId } = get()
        if (!doc) return

        doc.transact(() => {
          const connectionsMap = doc.getMap(`connections-${currentGraphId}`)
          const yConn = connectionsMap.get(connectionId) as Y.Map<any>
          if (yConn) {
            yConn.set('state', state)
          }
        }, 'local')

        // Mark graph as dirty
        get().setGraphDirty(currentGraphId, true)
      },

      removeConnection: (connectionId: string) => {
        const { doc, currentGraphId } = get()
        if (!doc) return

        doc.transact(() => {
          // Update lastModified timestamp
          const metadataMap = doc.getMap('metadata')
          metadataMap.set('lastModified', Date.now())

          const connectionsMap = doc.getMap(`connections-${currentGraphId}`)
          connectionsMap.delete(connectionId)
        }, 'local')

        // Mark graph as dirty
        get().setGraphDirty(currentGraphId, true)

        // Save to API immediately to ensure changes are persisted
        get()
          .saveToAPI()
          .catch(error => {
            console.error('[WorkflowStore] Failed to save after removing connection:', error)
          })
      },

      // Group management
      createGroup: (title: string, nodeIds: string[], color: string = '#3b82f6') => {
        const { doc, currentGraphId, nodes } = get()
        if (!doc || nodeIds.length === 0) return ''

        // Calculate group bounds from nodes
        const groupNodes = nodes.filter(n => nodeIds.includes((n as any).id || n.metadata.id))
        if (groupNodes.length === 0) return ''

        // For new groups, assume no description initially (32px header)
        const headerOffset = 32
        const padding = 10

        const minX = Math.min(...groupNodes.map(n => n.position.x)) - padding
        const minY = Math.min(...groupNodes.map(n => n.position.y)) - headerOffset - padding

        // Calculate actual max bounds using real node dimensions from DOM
        let maxX = minX
        let maxY = minY + headerOffset // Start from after header
        let hasValidDimensions = false

        groupNodes.forEach(node => {
          const dimensions = calculateNodeDimensions(node.metadata)
          if (dimensions) {
            // Use actual DOM measurements
            maxX = Math.max(maxX, node.position.x + dimensions.width)
            maxY = Math.max(maxY, node.position.y + dimensions.height)
            hasValidDimensions = true
          } else {
            // If we can't measure, use a minimal fallback that will be corrected later
            // This happens when nodes are not yet rendered or are off-screen
            maxX = Math.max(maxX, node.position.x + 200) // Conservative default
            maxY = Math.max(maxY, node.position.y + 100)
          }
        })

        // Add padding to max bounds
        maxX += padding
        maxY += padding

        const groupId = `group-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
        const now = new Date().toISOString()

        // If we couldn't get DOM measurements, schedule a recalculation after nodes are likely rendered
        if (!hasValidDimensions) {
          setTimeout(() => {
            const state = get()
            if (state.groups.find(g => g.id === groupId)) {
              state.recalculateGroupBounds(groupId)
            }
          }, 100) // Give nodes time to render
        }

        // Calculate initial relative positions for nodes
        const nodePositions: Record<string, { x: number; y: number }> = {}
        groupNodes.forEach(node => {
          const nodeId = (node as any).id || node.metadata.id
          nodePositions[nodeId] = {
            x: node.position.x - minX,
            y: node.position.y - minY - headerOffset,
          }
        })

        doc.transact(() => {
          const groupsMap = doc.getMap(`groups-${currentGraphId}`)

          // Create group as plain object for proper sync
          const plainGroup = {
            id: groupId,
            title: title,
            description: '',
            color: color,
            position: { x: minX, y: minY },
            size: { width: maxX - minX, height: maxY - minY },
            nodeIds: nodeIds,
            isCollapsed: false,
            createdAt: now,
            updatedAt: now,
            nodePositions: nodePositions,
          }

          // Store as plain object (not Y.Map) - this will sync properly
          // Use JSON parse/stringify to ensure clean object
          const cleanGroup = JSON.parse(JSON.stringify(plainGroup))
          groupsMap.set(groupId, cleanGroup)
        }, 'local')

        // Mark graph as dirty
        get().setGraphDirty(currentGraphId, true)

        // Update local state immediately
        const newGroup: NodeGroup = {
          id: groupId,
          title,
          description: '',
          color,
          position: { x: minX, y: minY },
          size: { width: maxX - minX, height: maxY - minY },
          nodeIds,
          isCollapsed: false,
          createdAt: now,
          updatedAt: now,
          nodePositions: nodePositions,
        }

        set(state => ({
          groups: [...state.groups, newGroup],
        }))

        // Auto-scroll to group center if follow mode is enabled
        const groupCenter = {
          x: minX + (maxX - minX) / 2,
          y: minY + (maxY - minY) / 2,
        }
        get().scrollToElement(groupCenter)

        return groupId
      },

      updateGroup: (groupId: string, updates: Partial<NodeGroup>) => {
        const { doc, currentGraphId } = get()

        if (!doc) {
          console.error('🔷GROUPOPS STORE-002: updateGroup: doc is null')
          return
        }

        // Simplified event-based approach - only sync what changed
        doc.transact(() => {
          const groupsMap = doc.getMap(`groups-${currentGraphId}`)
          const storedGroup = groupsMap.get(groupId)

          if (!storedGroup) {
            console.error('🔷GROUPOPS STORE-ERROR: Group not found:', groupId)
            return
          }

          // Get current data
          const currentGroup =
            storedGroup instanceof Y.Map
              ? {
                  id: storedGroup.get('id'),
                  title: storedGroup.get('title'),
                  description: storedGroup.get('description'),
                  color: storedGroup.get('color'),
                  position: storedGroup.get('position'),
                  size: storedGroup.get('size'),
                  nodeIds: storedGroup.get('nodeIds') || [],
                  isCollapsed: storedGroup.get('isCollapsed') ?? false,
                  createdAt: storedGroup.get('createdAt'),
                  updatedAt: storedGroup.get('updatedAt'),
                }
              : {
                  ...storedGroup,
                  // Preserve exact position and size
                  position: (storedGroup as any).position,
                  size: (storedGroup as any).size,
                }

          // Ensure position is preserved if not being updated
          if (!updates.position && currentGroup.position) {
          }

          // Create updated group with minimal changes
          // Never let position or size become undefined
          const updatedGroup = {
            ...currentGroup,
            ...updates,
            position: updates.position || currentGroup.position,
            size: updates.size || currentGroup.size,
            updatedAt: new Date().toISOString(),
          }

          // Set the updated group - ensure it's a clean object
          // This helps prevent any Yjs internal properties from being included
          const cleanGroup = JSON.parse(JSON.stringify(updatedGroup))

          // Force Yjs to detect the change by deleting and re-adding
          groupsMap.delete(groupId)
          groupsMap.set(groupId, cleanGroup)
        }, 'local')

        // Mark graph as dirty
        get().setGraphDirty(currentGraphId, true)

        // Don't update local state immediately - let the CRDT observer handle it
        // This prevents race conditions and ensures consistency
      },

      updateNodePositionInGroup: (
        groupId: string,
        nodeId: string,
        position: { x: number; y: number }
      ) => {
        const { doc, currentGraphId, groups } = get()
        if (!doc) return

        const group = groups.find(g => g.id === groupId)
        if (!group) return

        doc.transact(() => {
          const groupsMap = doc.getMap(`groups-${currentGraphId}`)
          const storedGroup = groupsMap.get(groupId)
          if (!storedGroup) return

          // Get current group data
          const currentGroup =
            storedGroup instanceof Y.Map
              ? {
                  id: storedGroup.get('id'),
                  title: storedGroup.get('title'),
                  description: storedGroup.get('description'),
                  color: storedGroup.get('color'),
                  position: storedGroup.get('position'),
                  size: storedGroup.get('size'),
                  nodeIds: storedGroup.get('nodeIds') || [],
                  isCollapsed: storedGroup.get('isCollapsed') ?? false,
                  createdAt: storedGroup.get('createdAt'),
                  updatedAt: storedGroup.get('updatedAt'),
                  nodePositions: storedGroup.get('nodePositions') || {},
                }
              : {
                  ...storedGroup,
                  nodePositions: (storedGroup as any).nodePositions || {},
                }

          // Update node position
          const updatedNodePositions = {
            ...currentGroup.nodePositions,
            [nodeId]: position,
          }

          // Update the group with new node positions
          const updatedGroup = {
            ...currentGroup,
            nodePositions: updatedNodePositions,
            updatedAt: new Date().toISOString(),
          }

          // Store the updated group
          const cleanGroup = JSON.parse(JSON.stringify(updatedGroup))
          groupsMap.delete(groupId)
          groupsMap.set(groupId, cleanGroup)
        }, 'local')

        // Don't mark graph as dirty here - this was causing infinite loops
        // The graph will be marked dirty when nodes are actually moved by user action
      },

      updateGroupBounds: (
        groupId: string,
        bounds: Partial<{ x: number; y: number; width: number; height: number }>
      ) => {
        const { doc, currentGraphId, groups, nodes } = get()
        if (!doc) return

        // Find the group to get current position and member nodes
        const group = groups.find(g => g.id === groupId)
        if (!group) return

        // Calculate position delta for member nodes
        let deltaX = 0,
          deltaY = 0
        const currentGroupPos = group.position || { x: 0, y: 0 }
        if (bounds.x !== undefined) deltaX = bounds.x - currentGroupPos.x
        if (bounds.y !== undefined) deltaY = bounds.y - currentGroupPos.y

        // Update group bounds - event-based approach
        const updates: any = {}
        if (bounds.x !== undefined || bounds.y !== undefined) {
          updates.position = {
            x: bounds.x ?? currentGroupPos.x,
            y: bounds.y ?? currentGroupPos.y,
          }
        }
        if (bounds.width !== undefined || bounds.height !== undefined) {
          updates.size = {
            width: bounds.width ?? group.size?.width ?? 200,
            height: bounds.height ?? group.size?.height ?? 150,
          }
        }

        // Use the simplified updateGroup
        get().updateGroup(groupId, updates)

        // If group position changed, update member node absolute positions
        if (deltaX !== 0 || deltaY !== 0) {
          const memberNodes = nodes.filter(node =>
            group.nodeIds.includes((node as any).id || node.metadata.id)
          )

          doc.transact(() => {
            const nodesMap = doc.getMap(`nodes-${currentGraphId}`)
            memberNodes.forEach(node => {
              const yNode = nodesMap.get((node as any).id || node.metadata.id) as Y.Map<any>
              if (yNode) {
                const currentPos = yNode.get('position') || { x: 0, y: 0 }
                const newPos = {
                  x: currentPos.x + deltaX,
                  y: currentPos.y + deltaY,
                }
                yNode.set('position', newPos)
              }
            })
          }, 'local')
        }

        // Mark graph as dirty
        get().setGraphDirty(currentGraphId, true)

        // Force sync if provider is available
        const provider = get().provider
        if (provider && provider.socket && provider.socket.connected) {
          // Force immediate sync
          // Don't update awareness here - it interferes with presence tracking
        }
      },

      // Recalculate bounds for all groups - useful after nodes are rendered/resized
      recalculateAllGroupBounds: () => {
        const { groups } = get()
        groups.forEach(group => {
          get().recalculateGroupBounds(group.id)
        })
      },

      recalculateGroupBounds: (
        groupId: string,
        localNodePositions?: Record<string, { x: number; y: number }>
      ) => {
        const { doc, currentGraphId, nodes, groups } = get()
        if (!doc) return

        const group = groups.find(g => g.id === groupId)
        if (!group) return

        const memberNodes = nodes.filter(n =>
          group.nodeIds.includes((n as any).id || n.metadata.id)
        )
        if (memberNodes.length === 0) return

        // Header offset: 32px for header + 68px if description exists
        const headerOffset = group.description ? 100 : 32

        // CRITICAL: Preserve existing group position - NEVER change it
        const currentPosition = group.position || { x: 0, y: 0 }

        // Calculate the bounding rectangle that encompasses ALL member nodes
        let minNodeX = Infinity
        let minNodeY = Infinity
        let maxNodeX = -Infinity
        let maxNodeY = -Infinity
        let hasValidDimensions = false

        // First, collect all node data for analysis
        const nodeData: Array<{
          node: any
          absolutePos: { x: number; y: number }
          relativePos: { x: number; y: number }
          dimensions: { width: number; height: number } | null
          rightEdge: number
          bottomEdge: number
        }> = []

        memberNodes.forEach((node, index) => {
          const nodeId = (node as any).id || node.metadata.id
          let nodeRelativeX: number
          let nodeRelativeY: number

          // Use local positions if available (these are the actual visual positions)
          if (localNodePositions && localNodePositions[nodeId]) {
            nodeRelativeX = localNodePositions[nodeId].x
            nodeRelativeY = localNodePositions[nodeId].y
          } else {
            // Fallback to converting absolute positions
            const nodeAbsX = node.position?.x || 0
            const nodeAbsY = node.position?.y || 0
            nodeRelativeX = nodeAbsX - currentPosition.x
            nodeRelativeY = nodeAbsY - currentPosition.y - headerOffset
          }

          const dimensions = calculateNodeDimensions(node.metadata)
          const rightEdge = nodeRelativeX + (dimensions?.width || 200)
          const bottomEdge = nodeRelativeY + (dimensions?.height || 120)

          nodeData.push({
            node,
            absolutePos: { x: node.position?.x || 0, y: node.position?.y || 0 },
            relativePos: { x: nodeRelativeX, y: nodeRelativeY },
            dimensions,
            rightEdge,
            bottomEdge,
          })
        })

        // Find the nodes that are creating the extreme values
        const leftmostNode = nodeData.reduce((prev, curr) =>
          prev.relativePos.x < curr.relativePos.x ? prev : curr
        )
        const rightmostNode = nodeData.reduce((prev, curr) =>
          prev.rightEdge > curr.rightEdge ? prev : curr
        )
        const topmostNode = nodeData.reduce((prev, curr) =>
          prev.relativePos.y < curr.relativePos.y ? prev : curr
        )
        const bottommostNode = nodeData.reduce((prev, curr) =>
          prev.bottomEdge > curr.bottomEdge ? prev : curr
        )

        // Now process the nodes for bounds calculation
        nodeData.forEach(({ relativePos: { x: nodeRelativeX, y: nodeRelativeY }, dimensions }) => {
          if (dimensions) {
            // Use relative positions to calculate the content area bounds
            minNodeX = Math.min(minNodeX, nodeRelativeX)
            minNodeY = Math.min(minNodeY, nodeRelativeY)
            maxNodeX = Math.max(maxNodeX, nodeRelativeX + dimensions.width)
            maxNodeY = Math.max(maxNodeY, nodeRelativeY + dimensions.height)
            hasValidDimensions = true
          } else {
            // Fallback with reasonable default dimensions
            minNodeX = Math.min(minNodeX, nodeRelativeX)
            minNodeY = Math.min(minNodeY, nodeRelativeY)
            maxNodeX = Math.max(maxNodeX, nodeRelativeX + 200) // Default width
            maxNodeY = Math.max(maxNodeY, nodeRelativeY + 120) // Default height
          }
        })

        // If no valid dimensions found, preserve current group bounds entirely
        if (!hasValidDimensions && group.size && group.position) {
          return // Don't change anything if we can't calculate proper bounds
        }

        // Ensure we have valid bounds
        if (minNodeX === Infinity || minNodeY === Infinity) {
          return // Invalid node positions
        }

        // Calculate actual bounding rectangle from node positions (using local positions when available)
        const nodePositions = nodeData.map(nd => ({ x: nd.relativePos.x, y: nd.relativePos.y }))
        const minNodePosX = Math.min(...nodePositions.map(p => p.x))
        const maxNodePosX = Math.max(...nodePositions.map(p => p.x))
        const minNodePosY = Math.min(...nodePositions.map(p => p.y))
        const maxNodePosY = Math.max(...nodePositions.map(p => p.y))

        // Calculate span between node positions + width/height of a representative node
        const representativeNodeWidth = nodeData[0]?.dimensions?.width || 240
        const representativeNodeHeight = Math.max(
          ...nodeData.map(nd => nd.dimensions?.height || 120)
        )

        const nodeSpanWidth = maxNodePosX - minNodePosX + representativeNodeWidth
        const nodeSpanHeight = maxNodePosY - minNodePosY + representativeNodeHeight

        // Add padding: account for both left and right padding in total width
        const leftPadding = 20 // Initial left padding when nodes are placed
        const rightPadding = 220 // Right padding for expand state - increased by 60
        const bottomPadding = 140 // Bottom padding for expand state
        // Include left padding in total width calculation
        const requiredWidth = Math.max(300, nodeSpanWidth + leftPadding + rightPadding)
        const requiredHeight = Math.max(200, nodeSpanHeight + headerOffset + bottomPadding)

        // Update ONLY the size, preserve position completely
        const newBounds = {
          width: requiredWidth,
          height: requiredHeight,
        }

        // Update group bounds with only width/height - position unchanged
        get().updateGroupBounds(groupId, newBounds)
      },

      addNodeToGroup: (nodeId: string, groupId: string) => {
        const { doc, currentGraphId } = get()
        if (!doc) return

        doc.transact(() => {
          const groupsMap = doc.getMap(`groups-${currentGraphId}`)
          const storedGroup = groupsMap.get(groupId)
          if (!storedGroup) return

          let plainGroup: any

          // Handle both Y.Map and plain object formats
          if (storedGroup instanceof Y.Map) {
            plainGroup = {
              id: storedGroup.get('id'),
              title: storedGroup.get('title'),
              description: storedGroup.get('description'),
              color: storedGroup.get('color'),
              position: storedGroup.get('position'),
              size: storedGroup.get('size'),
              nodeIds: storedGroup.get('nodeIds') || [],
              isCollapsed: storedGroup.get('isCollapsed'),
              createdAt: storedGroup.get('createdAt'),
              updatedAt: storedGroup.get('updatedAt'),
              nodePositions: storedGroup.get('nodePositions') || {},
            }
          } else {
            plainGroup = { ...storedGroup }
          }

          if (!plainGroup.nodeIds.includes(nodeId)) {
            plainGroup.nodeIds = [...plainGroup.nodeIds, nodeId]
            plainGroup.updatedAt = new Date().toISOString()

            // Delete and re-add to trigger observers
            groupsMap.delete(groupId)
            groupsMap.set(groupId, plainGroup)
          }
        }, 'local')

        // Recalculate group bounds to fit new node
        get().recalculateGroupBounds(groupId)

        // Mark graph as dirty
        get().setGraphDirty(currentGraphId, true)
      },

      removeNodeFromGroup: (nodeId: string, groupId: string) => {
        const { doc, currentGraphId } = get()
        if (!doc) return

        doc.transact(() => {
          const groupsMap = doc.getMap(`groups-${currentGraphId}`)
          const storedGroup = groupsMap.get(groupId)
          if (!storedGroup) return

          let plainGroup: any

          // Handle both Y.Map and plain object formats
          if (storedGroup instanceof Y.Map) {
            plainGroup = {
              id: storedGroup.get('id'),
              title: storedGroup.get('title'),
              description: storedGroup.get('description'),
              color: storedGroup.get('color'),
              position: storedGroup.get('position'),
              size: storedGroup.get('size'),
              nodeIds: storedGroup.get('nodeIds') || [],
              isCollapsed: storedGroup.get('isCollapsed'),
              createdAt: storedGroup.get('createdAt'),
              updatedAt: storedGroup.get('updatedAt'),
              nodePositions: storedGroup.get('nodePositions') || {},
            }
          } else {
            plainGroup = { ...storedGroup }
          }

          plainGroup.nodeIds = plainGroup.nodeIds.filter((id: string) => id !== nodeId)

          // Also remove the node position from nodePositions
          if (plainGroup.nodePositions && plainGroup.nodePositions[nodeId]) {
            const newPositions = { ...plainGroup.nodePositions }
            delete newPositions[nodeId]
            plainGroup.nodePositions = newPositions
          }

          plainGroup.updatedAt = new Date().toISOString()

          // Delete and re-add to trigger observers
          groupsMap.delete(groupId)
          groupsMap.set(groupId, plainGroup)
        }, 'local')

        // Recalculate group bounds after removing node
        get().recalculateGroupBounds(groupId)

        // Mark graph as dirty
        get().setGraphDirty(currentGraphId, true)
      },

      removeGroup: (groupId: string) => {
        const { doc, currentGraphId } = get()
        if (!doc) return

        doc.transact(() => {
          const groupsMap = doc.getMap(`groups-${currentGraphId}`)
          groupsMap.delete(groupId)
        }, 'local')

        // Mark graph as dirty
        get().setGraphDirty(currentGraphId, true)
      },

      // Canvas state
      updateCanvasState: (graphId: string, state: Partial<CanvasState>) => {
        set(s => ({
          canvasStates: {
            ...s.canvasStates,
            [graphId]: {
              ...s.canvasStates[graphId],
              ...state,
            },
          },
        }))
      },

      // Auto-scroll to element if follow mode is enabled
      scrollToElement: (position: { x: number; y: number }, zoom?: number) => {
        const { followMode } = get()
        console.log('[WorkflowStore] scrollToElement called', { followMode, position, zoom })
        if (!followMode) return

        // Emit a custom event that the workflow page can listen to
        // This allows the page to handle the scrolling with its local state
        const event = new CustomEvent('workflow-follow-scroll', {
          detail: { position, zoom },
        })
        console.log('[WorkflowStore] Dispatching workflow-follow-scroll event', event.detail)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(event)
        }
      },

      // Selection
      setSelectedNodes: (nodeIds: string[]) => {
        set({ selectedNodeIds: nodeIds })
      },

      // Utility
      getAllGraphsData: () => {
        const { doc, graphs } = get()
        if (!doc) return []

        return graphs.map(graph => {
          const nodes: WorkflowNodeData[] = []
          const connections: WorkflowConnection[] = []
          const groups: NodeGroup[] = []

          // Load nodes
          const nodesMap = doc.getMap(`nodes-${graph.id}`)
          nodesMap.forEach((yNode: any) => {
            nodes.push({
              id: yNode.get('id'),
              metadata: yNode.get('metadata'),
              position: yNode.get('position'),
              propertyValues: yNode.get('propertyValues') || {},
            } as any)
          })

          // Load connections
          const connectionsMap = doc.getMap(`connections-${graph.id}`)

          // Debug logging
          console.log(`[DEBUG] Graph ${graph.id} connections map size:`, connectionsMap.size)

          connectionsMap.forEach((yConn: any) => {
            const conn = {
              id: yConn.get('id'),
              source: yConn.get('source'),
              target: yConn.get('target'),
              state: yConn.get('state'),
            } as Connection

            console.log(`[DEBUG] Connection from CRDT:`, conn)
            connections.push(conn)
          })

          // Load groups
          const groupsMap = doc.getMap(`groups-${graph.id}`)
          groupsMap.forEach((groupValue: any, key: string) => {
            // Skip internal keys
            if (key.startsWith('_')) return

            let groupData: any

            // Handle both Y.Map and plain object formats
            if (groupValue instanceof Y.Map) {
              groupData = {
                id: groupValue.get('id'),
                title: groupValue.get('title'),
                description: groupValue.get('description'),
                color: groupValue.get('color'),
                position: groupValue.get('position'),
                size: groupValue.get('size'),
                nodeIds: groupValue.get('nodeIds'),
                isCollapsed: groupValue.get('isCollapsed'),
                createdAt: groupValue.get('createdAt'),
                updatedAt: groupValue.get('updatedAt'),
                nodePositions: groupValue.get('nodePositions'),
              }
            } else if (typeof groupValue === 'object' && groupValue !== null) {
              // Plain object format
              groupData = { ...groupValue }
            } else {
              console.warn(
                '[WorkflowStore] getAllGraphsData: Unknown group format:',
                typeof groupValue
              )
              return
            }

            groups.push(groupData)
          })

          return {
            id: graph.id,
            name: graph.name,
            namespace: graph.namespace,
            isMain: graph.isMain || false,
            nodes,
            connections,
            groups,
          }
        })
      },

      // Presence
      updateCursorPosition: (() => {
        let lastUpdate = 0
        const throttleMs = 50 // Throttle cursor updates to max 20fps

        return (position: { x: number; y: number }) => {
          const now = Date.now()
          if (now - lastUpdate < throttleMs) return

          const { provider, currentGraphId, embedMode } = get()
          if (!provider) return

          // Skip cursor updates in embed mode
          if (embedMode) return

          const awareness = provider.getAwareness()
          if (awareness) {
            const localState = awareness.getLocalState() || {}
            awareness.setLocalState({
              ...localState,
              cursor: {
                ...position,
                graphId: currentGraphId,
              },
              lastSeen: Date.now(),
            })
            lastUpdate = now
          }
        }
      })(),

      // Persistence
      saveToAPI: async () => {
        const { workflowId, workflowName, currentGraphId } = get()
        const allGraphsData = get().getAllGraphsData()

        if (!workflowId) {
          console.warn('[WorkflowStore] Cannot save: no workflow ID')
          return
        }

        if (allGraphsData.length === 0) {
          console.warn('[WorkflowStore] Cannot save: no graphs available', {
            initialized: get().initialized,
            graphs: get().graphs,
            doc: !!get().doc,
          })
          return
        }

        // Debug logging
        console.log('[DEBUG] saveToAPI - data to save:', {
          workflowId,
          graphsCount: allGraphsData.length,
          graphs: allGraphsData.map(g => ({
            id: g.id,
            nodesCount: g.nodes.length,
            connectionsCount: g.connections.length,
            connections: g.connections,
          })),
        })

        // Calculate metadata
        let totalNodeCount = 0
        let totalConnectionCount = 0
        let totalGroupCount = 0

        // Convert to proper snapshot format
        const graphs: WorkflowGraph[] = allGraphsData.map(graph => {
          totalNodeCount += graph.nodes.length
          totalConnectionCount += graph.connections.length
          totalGroupCount += graph.groups.length

          return {
            id: graph.id,
            name: graph.name,
            namespace: graph.namespace,
            isMain: graph.isMain,
            nodes: graph.nodes.map(node => ({
              id: (node as any).id || node.metadata.id,
              type: node.metadata.type,
              position: node.position,
              metadata: {
                ...node.metadata,
                propertyValues: node.propertyValues || {},
              },
            })) as SerializedNode[],
            connections: graph.connections.map(conn => ({
              id: conn.id,
              source: conn.source,
              target: conn.target,
              state: conn.state || 'pending',
            })) as SerializedConnection[],
            groups: graph.groups.map(group => ({
              id: group.id,
              title: group.title,
              description: group.description || '',
              nodeIds: group.nodeIds,
              position: group.position,
              size: group.size,
              color: group.color || '#3b82f6',
              collapsed: group.isCollapsed || false,
              createdAt: group.createdAt || new Date().toISOString(),
              updatedAt: group.updatedAt || new Date().toISOString(),
              nodePositions: group.nodePositions,
            })) as SerializedGroup[],
            canvasState: get().canvasStates[graph.id] || { offset: { x: 0, y: 0 }, zoom: 1 },
          }
        })

        // Create snapshot with all required fields
        const now = new Date().toISOString()
        const snapshot: WorkflowSnapshot = {
          id: workflowId,
          name: workflowName,
          description: '',
          createdAt: now,
          updatedAt: now,
          lastSavedAt: now,
          saveCount: 1, // Will be incremented by API
          isDraft: true,
          isPublished: false,
          graphs,
          activeGraphId: currentGraphId,
          metadata: {
            version: '1.0.0',
            totalNodeCount,
            totalConnectionCount,
            totalGroupCount,
            graphCount: graphs.length,
          },
        }

        try {
          await WorkflowStorageService.saveWorkflow(snapshot)

          // Update CRDT metadata with last modified timestamp
          const { doc } = get()
          if (doc) {
            doc.transact(() => {
              const metadataMap = doc.getMap('metadata')
              metadataMap.set('lastModified', Date.now())
            })
          }

          // Clear dirty state for all graphs after successful save
          get().clearAllDirtyState()
        } catch (error) {
          console.error('[WorkflowStore] Failed to save to API:', error)
          console.error('[WorkflowStore] Snapshot data:', {
            id: snapshot.id,
            name: snapshot.name,
            graphCount: snapshot.graphs.length,
            graphs: snapshot.graphs.map(g => ({
              id: g.id,
              name: g.name,
              nodeCount: g.nodes.length,
              connectionCount: g.connections.length,
            })),
          })
          throw error
        }
      },

      enableAutosave: (enabled: boolean) => {
        // Clear any existing timer
        if (autosaveTimer) {
          clearInterval(autosaveTimer)
          autosaveTimer = null
        }

        if (enabled) {
          // Set up autosave every 5 seconds
          autosaveTimer = setInterval(() => {
            const state = get()
            // Only save if we have nodes to avoid API validation errors
            if (state.nodes.length > 0) {
              state.saveToAPI().catch(error => {
                console.error('[WorkflowStore] Autosave failed:', error)
              })
            } else {
            }
          }, 5000)
        } else {
        }
      },

      rollbackToVersion: async (versionId: string) => {
        const { workflowId, doc } = get()

        if (!workflowId) {
          console.error('[WorkflowStore] Cannot rollback - no workflow ID')
          throw new Error('No workflow ID available')
        }

        if (!doc) {
          console.error('[WorkflowStore] Cannot rollback - no doc')
          throw new Error('No CRDT document available')
        }

        try {
          // Call the API to perform the rollback
          const response = await fetch(`/api/workflows/${workflowId}/rollback`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ versionId }),
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error?.message || 'Failed to rollback workflow')
          }

          const result = await response.json()

          // The rollback creates a new version with the old data
          // We need to update the CRDT to reflect this change

          // Clear all existing data first
          doc.transact(() => {
            // Clear all graphs
            const graphsMap = doc.getMap('graphs')
            graphsMap.clear()

            // Clear metadata
            const metadataMap = doc.getMap('metadata')
            metadataMap.clear()

            // Get all graph IDs and clear their data
            const allGraphIds = get().graphs.map(g => g.id)
            allGraphIds.forEach(graphId => {
              const nodesMap = doc.getMap(`nodes-${graphId}`)
              const connectionsMap = doc.getMap(`connections-${graphId}`)
              const groupsMap = doc.getMap(`groups-${graphId}`)

              nodesMap.clear()
              connectionsMap.clear()
              groupsMap.clear()
            })
          })

          // Now populate with the rolled back data
          doc.transact(() => {
            const graphsMap = doc.getMap('graphs')
            const metadataMap = doc.getMap('metadata')

            // Set workflow metadata
            metadataMap.set('id', workflowId)
            metadataMap.set('name', result.data.name)

            // Process each graph from the rollback
            const graphs = result.data.graphs || []
            graphs.forEach((graph: any) => {
              // Add graph info
              graphsMap.set(graph.id, {
                id: graph.id,
                name: graph.name,
                namespace: graph.namespace || graph.id,
                isMain: graph.isMain || graph.id === 'main',
              })

              // Add nodes
              const nodesMap = doc.getMap(`nodes-${graph.id}`)
              graph.nodes?.forEach((node: any) => {
                const yNode = new Y.Map()
                yNode.set('id', node.id)
                yNode.set('metadata', node.metadata)
                yNode.set('position', node.position || { x: 0, y: 0 })
                yNode.set('size', node.size || { width: 200, height: 100 })
                yNode.set('propertyValues', node.propertyValues || {})
                nodesMap.set(node.id, yNode)
              })

              // Add connections
              const connectionsMap = doc.getMap(`connections-${graph.id}`)
              graph.connections?.forEach((conn: any) => {
                const yConn = new Y.Map()
                yConn.set('id', conn.id)
                yConn.set('source', conn.source)
                yConn.set('target', conn.target)
                yConn.set('sourcePortId', conn.sourcePortId)
                yConn.set('targetPortId', conn.targetPortId)
                yConn.set('state', conn.state || 'connected')
                connectionsMap.set(conn.id, yConn)
              })

              // Add groups
              const groupsMap = doc.getMap(`groups-${graph.id}`)
              graph.groups?.forEach((group: any) => {
                const yGroup = new Y.Map()
                yGroup.set('id', group.id)
                yGroup.set('title', group.title)
                yGroup.set('description', group.description || '')
                yGroup.set('nodeIds', group.nodeIds || [])
                yGroup.set('position', group.position)
                yGroup.set('size', group.size)
                yGroup.set('color', group.color || '#3b82f6')
                yGroup.set('isCollapsed', group.collapsed || false)
                yGroup.set('createdAt', group.createdAt || new Date().toISOString())
                yGroup.set('updatedAt', new Date().toISOString())
                groupsMap.set(group.id, yGroup)
              })
            })
          })

          // Switch to the main graph after rollback
          get().switchGraph('main')

          // Clear dirty state since we just rolled back
          get().clearAllDirtyState()
        } catch (error) {
          console.error('[WorkflowStore] Rollback failed:', error)
          throw error
        }
      },

      setWorkflowName: (name: string) => {
        const { doc } = get()
        if (!doc) return

        doc.transact(() => {
          const metadataMap = doc.getMap('metadata')
          metadataMap.set('name', name)
        }, 'local')

        set({ workflowName: name })
      },

      setWorkflowTrigger: (trigger: TriggerConfig | null) => {
        const { doc } = get()
        if (!doc) return

        doc.transact(() => {
          const metadataMap = doc.getMap('metadata')
          if (trigger) {
            metadataMap.set('trigger', trigger)
          } else {
            metadataMap.delete('trigger')
          }
        }, 'local')

        set({ workflowTrigger: trigger })
      },

      // Dirty state management
      setGraphDirty: (graphId: string, isDirty: boolean) => {
        set(state => {
          const newDirtyGraphs = new Set(state.dirtyGraphs)
          if (isDirty) {
            newDirtyGraphs.add(graphId)
          } else {
            newDirtyGraphs.delete(graphId)
          }
          return { dirtyGraphs: newDirtyGraphs }
        })
      },

      isGraphDirty: (graphId: string) => {
        return get().dirtyGraphs.has(graphId)
      },

      clearAllDirtyState: () => {
        set({ dirtyGraphs: new Set() })
      },

      connectCRDT: () => {
        const { provider } = get()
        if (provider && !provider.connected) {
          provider.connect()
        }
      },
    }
  })
)

// Observer management
let observers: (() => void)[] = []

// Autosave timer
let autosaveTimer: NodeJS.Timeout | null = null

function cleanupObservers() {
  observers.forEach(unobserve => unobserve())
  observers = []
}

function setupObservers(doc: Y.Doc, set: any, get: any) {
  // Observe graphs
  const graphsMap = doc.getMap('graphs')
  const graphsObserver = () => {
    const graphs: GraphInfo[] = []
    graphsMap.forEach((info: any) => graphs.push(info.toJSON ? info.toJSON() : info))
    graphs.sort((a, b) => {
      if (a.isMain) return -1
      if (b.isMain) return 1
      return 0
    })

    set({ graphs })
  }
  graphsMap.observe(graphsObserver)
  observers.push(() => graphsMap.unobserve(graphsObserver))

  // Observe metadata
  const metadataMap = doc.getMap('metadata')
  const metadataObserver = () => {
    const name = metadataMap.get('name')
    if (name) set({ workflowName: name })

    const trigger = metadataMap.get('trigger')
    set({ workflowTrigger: trigger || null })
  }
  metadataMap.observe(metadataObserver)
  observers.push(() => metadataMap.unobserve(metadataObserver))

  // Initial load
  graphsObserver()
  metadataObserver()

  // Load current graph data
  const currentGraphId = get().currentGraphId
  loadGraphData(doc, currentGraphId, get, set)
}

function loadGraphData(doc: Y.Doc, graphId: string, get: any, set: any) {
  if (!doc) {
    console.error('[loadGraphData] No document provided')
    return
  }

  // Clean up graph-specific observers
  const graphObservers = (window as any).__graphObservers || []
  if (Array.isArray(graphObservers)) {
    graphObservers.forEach((unobserve: () => void) => {
      if (typeof unobserve === 'function') {
        unobserve()
      }
    })
  }
  const newObservers: (() => void)[] = []

  // Helper to load all data
  const loadAll = () => {
    const nodes: WorkflowNodeData[] = []
    const connections: WorkflowConnection[] = []
    const groups: NodeGroup[] = []

    // Load nodes
    const nodesMap = doc.getMap(`nodes-${graphId}`)
    nodesMap.forEach((yNode: any, nodeId: string) => {
      const metadata = yNode.get('metadata')
      const position = yNode.get('position')

      // Skip nodes without metadata - they are invalid
      if (!metadata) {
        console.error('[Workflow Store] Node without metadata found, skipping:', {
          nodeId,
          hasPosition: !!position,
          propertyValues: yNode.get('propertyValues'),
          yNodeKeys: yNode ? Array.from(yNode.keys()) : 'yNode is null',
          rawYNode: yNode,
        })

        // Try to recover the node ID at least
        const storedId = yNode.get('id')
        if (storedId) {
          console.error('[Workflow Store] Node has ID but no metadata:', storedId)
        }
        return
      }

      // Merge propertyValues into metadata for proper rendering
      const propertyValues = yNode.get('propertyValues') || {}
      const nodeData = {
        id: yNode.get('id') || nodeId,
        metadata: {
          ...metadata,
          propertyValues: propertyValues, // Ensure propertyValues are in metadata
        },
        position,
      }

      // Only log if position is missing or invalid
      if (
        !nodeData.position ||
        typeof nodeData.position.x !== 'number' ||
        typeof nodeData.position.y !== 'number'
      ) {
        console.warn('[Workflow Store] Node loaded with invalid position:', {
          nodeId: nodeData.id,
          position: nodeData.position,
        })
      }
      nodes.push(nodeData as any)
    })

    // Load connections
    const connectionsMap = doc.getMap(`connections-${graphId}`)
    connectionsMap.forEach((yConn: any) => {
      connections.push({
        id: yConn.get('id'),
        source: yConn.get('source'),
        target: yConn.get('target'),
        state: yConn.get('state'),
      } as Connection)
    })

    // Load groups
    const groupsMap = doc.getMap(`groups-${graphId}`)
    console.log(
      '[WorkflowStore] Loading groups for graph:',
      graphId,
      'Groups map size:',
      groupsMap.size
    )
    groupsMap.forEach((groupValue: any, key: string) => {
      // Skip internal keys
      if (key.startsWith('_')) return

      let groupData: any

      // Handle both Y.Map and plain object formats
      if (groupValue instanceof Y.Map) {
        const position = groupValue.get('position')
        const size = groupValue.get('size')
        console.log('[WorkflowStore] Loading group:', {
          id: groupValue.get('id'),
          position: position,
          size: size,
          nodeIds: groupValue.get('nodeIds'),
        })
        groupData = {
          id: groupValue.get('id'),
          title: groupValue.get('title'),
          description: groupValue.get('description'),
          color: groupValue.get('color'),
          position: position,
          size: size,
          nodeIds: groupValue.get('nodeIds') || [],
          isCollapsed: groupValue.get('isCollapsed') ?? false,
          createdAt: groupValue.get('createdAt'),
          updatedAt: groupValue.get('updatedAt'),
          nodePositions: groupValue.get('nodePositions') || {},
        }
      } else if (typeof groupValue === 'object' && groupValue !== null) {
        // Plain object format - ensure required fields exist but preserve existing values
        groupData = {
          id: groupValue.id,
          title: groupValue.title,
          description: groupValue.description,
          color: groupValue.color,
          position: groupValue.position,
          size: groupValue.size,
          nodeIds: groupValue.nodeIds || [],
          isCollapsed: groupValue.isCollapsed ?? false,
          createdAt: groupValue.createdAt,
          updatedAt: groupValue.updatedAt,
          nodePositions: groupValue.nodePositions || {},
        }
      } else {
        console.warn('🔷GROUPOPS LOAD-WARNING: Unknown group format:', typeof groupValue)
        return
      }

      groups.push(groupData)
    })

    if (groups.length > 0) {
    }

    // Create a snapshot of the current data for comparison
    const newDataSnapshot = JSON.stringify({
      nodes: nodes.map(n => ({
        id: (n as any).id || n.metadata.id,
        position: n.position,
        metadata: n.metadata,
        propertyValues: (n as any).propertyValues || {},
      })),
      connections: connections.map(c => ({
        id: c.id,
        source: c.source,
        target: c.target,
        state: c.state,
      })),
      groups: groups.map(g => ({
        id: g.id,
        title: g.title,
        position: g.position,
        size: g.size,
        nodeIds: g.nodeIds,
        isCollapsed: g.isCollapsed,
        nodePositions: g.nodePositions,
      })),
    })

    // Only update if data has actually changed
    const currentSnapshot = get().dataSnapshot
    if (currentSnapshot !== newDataSnapshot) {
      set({
        nodes: [...nodes],
        connections: [...connections],
        groups: [...groups],
        dataSnapshot: newDataSnapshot,
        lastUpdate: Date.now(),
      })
    } else {
      // Data hasn't changed, don't trigger re-render
      console.debug('[Workflow Store] Data unchanged, skipping update')
    }
  }

  // Set up observers
  const nodesMap = doc.getMap(`nodes-${graphId}`)
  const nodesObserver = (events: Y.YEvent<any>[]) => {
    // Check if changes are from remote client
    let isRemoteChange = false
    let remoteUserInfo: any = null
    let changeActions: Array<{ action: 'add' | 'delete' | 'update'; key: string }> = []

    events.forEach(event => {
      // Capture changes while we're in the event handler
      if (event instanceof YMapEvent) {
        event.changes.keys.forEach((change, key) => {
          changeActions.push({ action: change.action as any, key })
        })
      }

      // Check if this is a remote change
      const state = get()
      const provider = state.provider

      if (event.transaction) {
        // If origin is 'local', it's definitely a local change
        if (event.transaction.origin === 'local') {
          return // Skip local changes
        }

        // If origin is the provider, it's a remote change
        if (provider && event.transaction.origin === provider) {
          isRemoteChange = true
        }
        // If origin is not 'local' and exists, it might be remote
        else if (event.transaction.origin) {
          isRemoteChange = true
        }
        // If no origin, check if we're in a sync context
        else {
          // During initial sync, transactions might not have origins
          // We'll skip these to avoid false notifications during initial load
        }
      }

      if (isRemoteChange) {
        const presence = state.presence

        // Find a remote user from presence
        presence.forEach((userPresence: any, clientId: any) => {
          if (clientId !== state.localClientId && !remoteUserInfo) {
            remoteUserInfo = userPresence
          }
        })

        // If we can't find user info from presence, create a generic one
        if (!remoteUserInfo && presence.size > 1) {
          remoteUserInfo = {
            userName: 'Another User',
            userId: 'remote-user',
          }
        }
      }
    })

    // Import notification store if we have remote changes
    if (isRemoteChange && remoteUserInfo && changeActions.length > 0) {
      import('@/store/notificationStore').then(module => {
        const useNotificationStore = module.useNotificationStore

        // Process the captured changes
        changeActions.forEach(change => {
          if (change.action === 'add') {
            useNotificationStore.getState().addNotification({
              type: 'node-added',
              message: 'added a node',
              userName: remoteUserInfo.userName || 'Remote User',
              userId: remoteUserInfo.userId || 'unknown',
            })
          } else if (change.action === 'delete') {
            useNotificationStore.getState().addNotification({
              type: 'node-deleted',
              message: 'deleted a node',
              userName: remoteUserInfo.userName || 'Remote User',
              userId: remoteUserInfo.userId || 'unknown',
            })
          }
        })
      })
    }

    // Simply reload on any change
    loadAll()

    // Handle follow mode for added nodes
    if (isRemoteChange && get().followMode) {
      changeActions.forEach(change => {
        if (change.action === 'add') {
          const addedNode: any = nodesMap.get(change.key)
          if (addedNode) {
            const position = addedNode.get ? addedNode.get('position') : addedNode.position
            if (position) {
              console.log('[WorkflowStore] Remote node added, scrolling to:', position)
              get().scrollToElement(position)
            }
          }
        }
      })
    }
  }
  nodesMap.observeDeep(nodesObserver)
  if (Array.isArray(newObservers)) {
    newObservers.push(() => nodesMap.unobserveDeep(nodesObserver))
  }

  const connectionsMap = doc.getMap(`connections-${graphId}`)
  const connectionsObserver = (events: Y.YEvent<any>[]) => {
    // Check if changes are from remote client
    let isRemoteChange = false
    let remoteUserInfo: any = null
    let changeActions: Array<{ action: 'add' | 'delete' | 'update'; key: string }> = []

    events.forEach(event => {
      // Capture changes while we're in the event handler
      if (event instanceof YMapEvent) {
        event.changes.keys.forEach((change, key) => {
          changeActions.push({ action: change.action as any, key })
        })
      }

      const state = get()
      const provider = state.provider

      if (event.transaction) {
        // If origin is 'local', it's definitely a local change
        if (event.transaction.origin === 'local') {
          return // Skip local changes
        }

        // If origin is the provider, it's a remote change
        if (provider && event.transaction.origin === provider) {
          isRemoteChange = true
        }
        // If origin is not 'local' and exists, it might be remote
        else if (event.transaction.origin) {
          isRemoteChange = true
        }
      }

      if (isRemoteChange) {
        const presence = state.presence
        presence.forEach((userPresence: any, clientId: any) => {
          if (clientId !== state.localClientId && !remoteUserInfo) {
            remoteUserInfo = userPresence
          }
        })

        // If we can't find user info from presence, create a generic one
        if (!remoteUserInfo && presence.size > 1) {
          remoteUserInfo = {
            userName: 'Another User',
            userId: 'remote-user',
          }
        }
      }
    })

    // Import notification store if we have remote changes
    if (isRemoteChange && remoteUserInfo && changeActions.length > 0) {
      import('@/store/notificationStore').then(module => {
        const useNotificationStore = module.useNotificationStore

        changeActions.forEach(change => {
          if (change.action === 'add') {
            useNotificationStore.getState().addNotification({
              type: 'connection-added',
              message: 'added a connection',
              userName: remoteUserInfo.userName || 'Remote User',
              userId: remoteUserInfo.userId || 'unknown',
            })
          } else if (change.action === 'delete') {
            useNotificationStore.getState().addNotification({
              type: 'connection-deleted',
              message: 'deleted a connection',
              userName: remoteUserInfo.userName || 'Remote User',
              userId: remoteUserInfo.userId || 'unknown',
            })
          }
        })
      })
    }

    loadAll()

    // Handle follow mode for added connections
    if (isRemoteChange && get().followMode) {
      changeActions.forEach(change => {
        if (change.action === 'add') {
          const addedConnection: any = connectionsMap.get(change.key)
          if (addedConnection) {
            const source = addedConnection.get
              ? addedConnection.get('source')
              : addedConnection.source
            const target = addedConnection.get
              ? addedConnection.get('target')
              : addedConnection.target
            if (source && target) {
              // Find nodes to calculate midpoint
              const nodes = get().nodes
              const sourceNode = nodes.find(
                (n: any) => ((n as any).id || n.metadata.id) === source.nodeId
              )
              const targetNode = nodes.find(
                (n: any) => ((n as any).id || n.metadata.id) === target.nodeId
              )

              if (sourceNode && targetNode) {
                const midpoint = {
                  x: (sourceNode.position.x + targetNode.position.x) / 2,
                  y: (sourceNode.position.y + targetNode.position.y) / 2,
                }
                console.log(
                  '[WorkflowStore] Remote connection added, scrolling to midpoint:',
                  midpoint
                )
                get().scrollToElement(midpoint)
              }
            }
          }
        }
      })
    }
  }
  connectionsMap.observeDeep(connectionsObserver)
  if (Array.isArray(newObservers)) {
    newObservers.push(() => connectionsMap.unobserveDeep(connectionsObserver))
  }

  const groupsMap = doc.getMap(`groups-${graphId}`)
  const groupsObserver = (events: Y.YEvent<any>[]) => {
    // Check if changes are from remote client
    let isRemoteChange = false
    let remoteUserInfo: any = null
    let changeActions: Array<{ action: 'add' | 'delete' | 'update'; key: string }> = []

    events.forEach(event => {
      // Capture changes while we're in the event handler
      if (event instanceof YMapEvent) {
        event.changes.keys.forEach((change, key) => {
          changeActions.push({ action: change.action as any, key })
        })
      }

      const state = get()
      const provider = state.provider

      if (event.transaction) {
        // If origin is 'local', it's definitely a local change
        if (event.transaction.origin === 'local') {
          return // Skip local changes
        }

        // If origin is the provider, it's a remote change
        if (provider && event.transaction.origin === provider) {
          isRemoteChange = true
        }
        // If origin is not 'local' and exists, it might be remote
        else if (event.transaction.origin) {
          isRemoteChange = true
        }
      }

      if (isRemoteChange) {
        const presence = state.presence
        presence.forEach((userPresence: any, clientId: any) => {
          if (clientId !== state.localClientId && !remoteUserInfo) {
            remoteUserInfo = userPresence
          }
        })

        // If we can't find user info from presence, create a generic one
        if (!remoteUserInfo && presence.size > 1) {
          remoteUserInfo = {
            userName: 'Another User',
            userId: 'remote-user',
          }
        }
      }
    })

    // Import notification store if we have remote changes
    if (isRemoteChange && remoteUserInfo && changeActions.length > 0) {
      import('@/store/notificationStore').then(module => {
        const useNotificationStore = module.useNotificationStore

        changeActions.forEach(change => {
          if (change.action === 'add') {
            useNotificationStore.getState().addNotification({
              type: 'group-created',
              message: 'created a group',
              userName: remoteUserInfo.userName || 'Remote User',
              userId: remoteUserInfo.userId || 'unknown',
            })
          } else if (change.action === 'delete') {
            useNotificationStore.getState().addNotification({
              type: 'group-deleted',
              message: 'deleted a group',
              userName: remoteUserInfo.userName || 'Remote User',
              userId: remoteUserInfo.userId || 'unknown',
            })
          }
        })
      })
    }

    // Simply reload on any change
    loadAll()

    // Handle follow mode for added groups
    if (isRemoteChange && get().followMode) {
      changeActions.forEach(change => {
        if (change.action === 'add') {
          const addedGroup: any = groupsMap.get(change.key)
          if (addedGroup) {
            const position = addedGroup.position || (addedGroup.get && addedGroup.get('position'))
            const size = addedGroup.size || (addedGroup.get && addedGroup.get('size'))
            if (position && size) {
              // Calculate group center
              const groupCenter = {
                x: position.x + size.width / 2,
                y: position.y + size.height / 2,
              }
              console.log('[WorkflowStore] Remote group added, scrolling to center:', groupCenter)
              get().scrollToElement(groupCenter)
            }
          }
        }
      })
    }
  }
  // Use observeDeep to catch changes to properties within individual groups
  groupsMap.observeDeep(groupsObserver)

  // Note: We don't need to observe individual groups because we're using the
  // delete/re-add approach in updateGroup which triggers the groupsMap observer
  if (Array.isArray(newObservers)) {
    newObservers.push(() => groupsMap.unobserveDeep(groupsObserver))
  }

  // Store for cleanup
  ;(window as any).__graphObservers = newObservers

  // Initial load
  loadAll()
}

function setupPresence(provider: RustSocketIOProvider, set: any, get: any, doc: Y.Doc) {
  const awareness = provider.getAwareness()

  // Store the local client ID
  set({ localClientId: awareness.clientID })

  // Set initial user state from sessionStorage
  const userId = sessionStorage.getItem('userId')
  const userName = sessionStorage.getItem('userName')
  const userColor = sessionStorage.getItem('userColor')

  if (userId && userName) {
    provider.setUserState({
      userId,
      userName,
      userColor: userColor || '#3b82f6',
      isActive: true,
    })
  }

  const updatePresence = () => {
    const currentPresence = get().presence
    const states = new Map<number, CRDTPresence>()
    awareness.getStates().forEach((state, clientId) => {
      // Only process if we have user data
      if (state.userId && state.userName) {
        states.set(clientId, {
          userId: state.userId,
          userName: state.userName,
          userColor: state.userColor || '#3b82f6',
          cursor: state.cursor,
          lastSeen: state.lastSeen || Date.now(),
        } as CRDTPresence)
      }
    })

    // Only update if presence actually changed
    const hasChanged =
      states.size !== currentPresence.size ||
      Array.from(states.entries()).some(([clientId, state]) => {
        const current = currentPresence.get(clientId)
        if (!current) return true
        return (
          current.userId !== state.userId ||
          current.userName !== state.userName ||
          current.userColor !== state.userColor ||
          JSON.stringify(current.cursor) !== JSON.stringify(state.cursor)
        )
      })

    if (hasChanged) {
      set({ presence: states })
    }
  }

  // Initial presence update
  updatePresence()

  awareness.on('change', (changes: any) => {
    updatePresence()

    // Debug logging
    const states = awareness.getStates()
    let hasGroupUpdate = false
    states.forEach((state, clientId) => {
      if (state.groupUpdate) {
        hasGroupUpdate = true
      }
    })

    if (hasGroupUpdate) {
    }

    // Check for group updates from other clients
    awareness.getStates().forEach((state, clientId) => {
      if (clientId !== awareness.clientID && state.groupUpdate) {
        const update = state.groupUpdate

        // Check if this is a recent update (within last 5 seconds)
        if (update.timestamp && Date.now() - update.timestamp < 5000) {
          // Manually reload the groups data
          const currentGraphId = get().currentGraphId
          const groupsMap = doc.getMap(`groups-${currentGraphId}`)
          const groups: NodeGroup[] = []

          groupsMap.forEach((yGroup: any, key: string) => {
            // Skip internal keys and non-Y.Map values
            if (key.startsWith('_') || !(yGroup instanceof Y.Map)) return

            const groupData = {
              id: yGroup.get('id'),
              title: yGroup.get('title'),
              description: yGroup.get('description'),
              color: yGroup.get('color'),
              position: yGroup.get('position'),
              size: yGroup.get('size'),
              nodeIds: yGroup.get('nodeIds'),
              isCollapsed: yGroup.get('isCollapsed'),
              createdAt: yGroup.get('createdAt'),
              updatedAt: yGroup.get('updatedAt'),
            }

            groups.push(groupData)
          })

          // Update the state with the reloaded groups
          set({ groups, lastUpdate: Date.now() })
        }
      }
    })
  })
  observers.push(() => awareness.off('change', updatePresence))

  // Initial state
  updatePresence()
}

export type { WorkflowStore }
