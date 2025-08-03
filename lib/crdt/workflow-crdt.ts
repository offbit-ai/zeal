/**
 * Workflow CRDT Implementation
 * 
 * Demonstrates how to integrate Y.js CRDTs with the existing workflow store
 * for real-time collaboration and offline-first functionality.
 */

import * as Y from 'yjs'
import { create } from 'zustand'
// import { withCRDT } from './store-adapter' // Not used
import { CRDTPersistence } from './persistence'
import type {
  CRDTWorkflowDoc,
  CRDTGraph,
  CRDTNode,
  CRDTConnection,
  CRDTPresence
} from './types'
import type {
  WorkflowNodeData as WorkflowNode,
  Connection as WorkflowConnection,
  NodeGroup
} from '@/types/workflow'
import type {
  WorkflowGraph
} from '@/types/snapshot'

/**
 * Convert a regular workflow node to CRDT format
 */
export function nodeToCRDT(node: WorkflowNode, doc: Y.Doc): Y.Map<any> {
  const yNode = new Y.Map()

  // Use metadata.id as the primary ID to maintain consistency
  const nodeId = node.metadata?.id  || ''
  yNode.set('id', nodeId)

  // Create and set position map
  const positionMap = new Y.Map()
  positionMap.set('x', node.position?.x || 0)
  positionMap.set('y', node.position?.y || 0)
  yNode.set('position', positionMap)

  // Create and set metadata map
  const metadataMap = new Y.Map()
  if (node.metadata && typeof node.metadata === 'object') {
    Object.entries(node.metadata).forEach(([key, value]) => {
      if (key && value !== undefined) {
        metadataMap.set(key, value)
      }
    })
  }
  yNode.set('metadata', metadataMap)

  // Create and set properties map
  const propertiesMap = new Y.Map()
  if (node.metadata.propertyValues && typeof node.metadata.propertyValues === 'object') {
    Object.entries(node.metadata.propertyValues).forEach(([key, value]) => {
      if (key && value !== undefined) {
        propertiesMap.set(key, value)
      }
    })
  }
  yNode.set('properties', propertiesMap)

  return yNode
}

/**
 * Convert a CRDT node back to regular format
 */
export function nodeFromCRDT(crdtNode: CRDTNode | any): WorkflowNode {
  // Handle both Y.Map and plain object formats
  const getPositionValue = (key: string) => {
    if (crdtNode.position && typeof crdtNode.position.get === 'function') {
      return crdtNode.position.get(key) || 0
    }
    return crdtNode.position?.[key] || 0
  }

  const position = {
    x: getPositionValue('x'),
    y: getPositionValue('y')
  }

  const metadata: any = {}
  if (crdtNode.metadata && typeof crdtNode.metadata.forEach === 'function') {
    crdtNode.metadata.forEach((value: any, key: string) => {
      metadata[key] = value
    })
  } else if (crdtNode.metadata) {
    Object.assign(metadata, crdtNode.metadata)
  }

  const propertyValues: any = {}
  if (crdtNode.properties && typeof crdtNode.properties.forEach === 'function') {
    crdtNode.properties.forEach((value: any, key: string) => {
      propertyValues[key] = value
    })
  } else if (crdtNode.properties) {
    Object.assign(propertyValues, crdtNode.properties)
  } else if (crdtNode.propertyValues) {
    Object.assign(propertyValues, crdtNode.propertyValues)
  }

  // Use metadata.id as the primary ID to maintain consistency
  const nodeId = metadata.id || crdtNode.id

  return {
    // id: nodeId,
    position,
    metadata: {
      ...metadata,
      id: nodeId, // Ensure metadata.id matches the node ID
      propertyValues
    },

  }
}

/**
 * Convert a connection to CRDT format
 */
export function connectionToCRDT(
  connection: WorkflowConnection,
  doc: Y.Doc
): Y.Map<any> {
  const yConnection = new Y.Map()

  // Set the ID
  yConnection.set('id', connection.id || '')

  // Create and set source map
  const sourceMap = new Y.Map()
  sourceMap.set('nodeId', connection.source?.nodeId || '')
  sourceMap.set('portId', connection.source?.portId || '')
  yConnection.set('source', sourceMap)

  // Create and set target map
  const targetMap = new Y.Map()
  targetMap.set('nodeId', connection.target?.nodeId || '')
  targetMap.set('portId', connection.target?.portId || '')
  yConnection.set('target', targetMap)

  // Create and set metadata map
  const metadataMap = new Y.Map()
  if (connection.metadata && typeof connection.metadata === 'object') {
    Object.entries(connection.metadata).forEach(([key, value]) => {
      if (key && value !== undefined) {
        metadataMap.set(key, value)
      }
    })
  }
  yConnection.set('metadata', metadataMap)

  // Set the connection state
  yConnection.set('state', connection.state || 'pending')

  return yConnection
}

/**
 * Convert a CRDT connection back to regular format
 */
export function connectionFromCRDT(
  crdtConnection: CRDTConnection | any
): WorkflowConnection {
  // Handle both Y.Map and plain object formats
  const getSourceValue = (key: string) => {
    if (crdtConnection.source && typeof crdtConnection.source.get === 'function') {
      return crdtConnection.source.get(key) || ''
    }
    return crdtConnection.source?.[key] || ''
  }

  const getTargetValue = (key: string) => {
    if (crdtConnection.target && typeof crdtConnection.target.get === 'function') {
      return crdtConnection.target.get(key) || ''
    }
    return crdtConnection.target?.[key] || ''
  }

  const source = {
    nodeId: getSourceValue('nodeId'),
    portId: getSourceValue('portId')
  }

  const target = {
    nodeId: getTargetValue('nodeId'),
    portId: getTargetValue('portId')
  }

  const metadata: any = {}
  if (crdtConnection.metadata && typeof crdtConnection.metadata.forEach === 'function') {
    crdtConnection.metadata.forEach((value: any, key: string) => {
      metadata[key] = value
    })
  } else if (crdtConnection.metadata) {
    Object.assign(metadata, crdtConnection.metadata)
  }

  // Get the connection state
  const state = (typeof crdtConnection.state === 'string')
    ? crdtConnection.state
    : crdtConnection.state?.get ? crdtConnection.state.get('state')
      : 'pending'

  return {
    id: crdtConnection.id,
    source,
    target,
    metadata,
    state: state as any
  }
}

/**
 * Convert a group to CRDT format
 */
export function groupToCRDT(group: NodeGroup, doc: Y.Doc): Y.Map<any> {
  const yGroup = new Y.Map()

  // Set basic properties
  yGroup.set('id', group.id || '')
  yGroup.set('title', group.title || '')
  yGroup.set('description', group.description || '')
  yGroup.set('color', group.color || '#e5e7eb')
  yGroup.set('collapsed', group.isCollapsed || false)
  yGroup.set('createdAt', group.createdAt || new Date().toISOString())
  yGroup.set('updatedAt', group.updatedAt || new Date().toISOString())

  // Create and set position map
  const positionMap = new Y.Map()
  positionMap.set('x', group.position?.x || 0)
  positionMap.set('y', group.position?.y || 0)
  yGroup.set('position', positionMap)

  // Create and set size map
  const sizeMap = new Y.Map()
  sizeMap.set('width', group.size?.width || 300)
  sizeMap.set('height', group.size?.height || 200)
  yGroup.set('size', sizeMap)

  // Create and set nodeIds array
  const nodeIdsArray = new Y.Array<string>()
  if (group.nodeIds && Array.isArray(group.nodeIds)) {
    // group.nodeIds.forEach(nodeId => )
    nodeIdsArray.push(group.nodeIds)
  }
  yGroup.set('nodeIds', nodeIdsArray)

  return yGroup
}

/**
 * Convert a CRDT group back to regular format
 */
export function groupFromCRDT(crdtGroup: any): NodeGroup {
  // Get values from Y.Map
  const getValue = (key: string, defaultValue: any = '') => {
    if (typeof crdtGroup.get === 'function') {
      return crdtGroup.get(key) ?? defaultValue
    }
    return crdtGroup[key] ?? defaultValue
  }

  // Get position from Y.Map
  const positionMap = getValue('position')
  const getPositionValue = (key: string, defaultValue: number = 0) => {
    if (positionMap && typeof positionMap.get === 'function') {
      return positionMap.get(key) ?? defaultValue
    }
    return positionMap?.[key] ?? defaultValue
  }

  // Get size from Y.Map
  const sizeMap = getValue('size')
  const getSizeValue = (key: string, defaultValue: number) => {
    if (sizeMap && typeof sizeMap.get === 'function') {
      return sizeMap.get(key) ?? defaultValue
    }
    return sizeMap?.[key] ?? defaultValue
  }

  const position = {
    x: getPositionValue('x', 0),
    y: getPositionValue('y', 0)
  }

  const size = {
    width: getSizeValue('width', 300),
    height: getSizeValue('height', 200)
  }

  // Get nodeIds array
  let nodeIds: string[] = []
  const nodeIdsValue = getValue('nodeIds', [])
  if (nodeIdsValue) {
    if (typeof nodeIdsValue.toArray === 'function') {
      nodeIds = nodeIdsValue.toArray()
    } else if (Array.isArray(nodeIdsValue)) {
      nodeIds = nodeIdsValue
    }
  }

  return {
    id: getValue('id', ''),
    title: getValue('title', ''),
    description: getValue('description', ''),
    nodeIds,
    position,
    size,
    color: getValue('color', '#e5e7eb'),
    isCollapsed: getValue('collapsed', false),
    createdAt: getValue('createdAt', new Date().toISOString()),
    updatedAt: getValue('updatedAt', new Date().toISOString())
  }
}

/**
 * Example: Create a CRDT-enabled workflow store
 * 
 * Note: This example is commented out as it uses withCRDT which
 * is not needed for the current implementation.
 */
/*
export const useCRDTWorkflowStore = create(
  withCRDT({
    docName: 'workflow-main',
    gcEnabled: true
  })(
    (set, get) => ({
      // State
      currentWorkflowId: null as string | null,
      graphs: {} as Record<string, WorkflowGraph>,
      
      // Actions
      addNode: (graphId: string, node: WorkflowNode) => {
        const { doc } = get()
        
        doc.transact(() => {
          const graphsMap = doc.getMap('graphs')
          let graphMap = graphsMap.get(graphId) as Y.Map<any>
          
          if (!graphMap) {
            graphMap = new Y.Map()
            graphsMap.set(graphId, graphMap)
          }
          
          const nodesMap = graphMap.get('nodes') as Y.Map<any> || new Y.Map()
          const crdtNode = nodeToCRDT(node, doc)
          
          // Store CRDT node
          nodesMap.set(node.id, crdtNode)
          graphMap.set('nodes', nodesMap)
        }, 'user')
      },

      updateNodePosition: (
        graphId: string,
        nodeId: string,
        position: { x: number; y: number }
      ) => {
        const { doc } = get()
        
        doc.transact(() => {
          const graphsMap = doc.getMap('graphs')
          const graphMap = graphsMap.get(graphId) as Y.Map<any>
          
          if (graphMap) {
            const nodesMap = graphMap.get('nodes') as Y.Map<any>
            const node = nodesMap?.get(nodeId) as CRDTNode
            
            if (node?.position) {
              node.position.set('x', position.x)
              node.position.set('y', position.y)
            }
          }
        }, 'user')
      },

      addConnection: (graphId: string, connection: WorkflowConnection) => {
        const { doc } = get()
        
        doc.transact(() => {
          const graphsMap = doc.getMap('graphs')
          let graphMap = graphsMap.get(graphId) as Y.Map<any>
          
          if (!graphMap) {
            graphMap = new Y.Map()
            graphsMap.set(graphId, graphMap)
          }
          
          const connectionsMap = graphMap.get('connections') as Y.Map<any> || new Y.Map()
          const crdtConnection = connectionToCRDT(connection, doc)
          
          connectionsMap.set(connection.id, crdtConnection)
          graphMap.set('connections', connectionsMap)
        }, 'user')
      },

      deleteNode: (graphId: string, nodeId: string) => {
        const { doc } = get()
        
        doc.transact(() => {
          const graphsMap = doc.getMap('graphs')
          const graphMap = graphsMap.get(graphId) as Y.Map<any>
          
          if (graphMap) {
            const nodesMap = graphMap.get('nodes') as Y.Map<any>
            nodesMap?.delete(nodeId)
            
            // Also delete connections to/from this node
            const connectionsMap = graphMap.get('connections') as Y.Map<any>
            if (connectionsMap) {
              const toDelete: string[] = []
              
              connectionsMap.forEach((conn: CRDTConnection, id: string) => {
                if (
                  conn.source.get('nodeId') === nodeId ||
                  conn.target.get('nodeId') === nodeId
                ) {
                  toDelete.push(id)
                }
              })
              
              toDelete.forEach(id => connectionsMap.delete(id))
            }
          }
        }, 'user')
      },

      // Get computed state from CRDT
      getGraph: (graphId: string): WorkflowGraph | null => {
        const { doc } = get()
        const graphsMap = doc.getMap('graphs')
        const graphMap = graphsMap.get(graphId) as Y.Map<any>
        
        if (!graphMap) return null
        
        const nodes: WorkflowNode[] = []
        const connections: WorkflowConnection[] = []
        
        // Convert nodes
        const nodesMap = graphMap.get('nodes') as Y.Map<any>
        if (nodesMap) {
          nodesMap.forEach((node: CRDTNode) => {
            nodes.push(nodeFromCRDT(node))
          })
        }
        
        // Convert connections
        const connectionsMap = graphMap.get('connections') as Y.Map<any>
        if (connectionsMap) {
          connectionsMap.forEach((conn: CRDTConnection) => {
            connections.push(connectionFromCRDT(conn))
          })
        }
        
        return {
          id: graphId,
          name: graphMap.get('name') || 'Untitled',
          namespace: graphMap.get('namespace') || 'default',
          isMain: graphMap.get('isMain') || false,
          isDirty: false,
          workflowState: {
            nodes,
            connections,
            groups: []
          }
        }
      }
    })
  )
)
*/

/**
 * Initialize CRDT persistence
 */
export async function initializeCRDTPersistence(
  doc: Y.Doc,
  workflowId: string
): Promise<void> {
  const persistence = new CRDTPersistence({
    dbName: 'zeal-workflows',
    autoSaveInterval: 1000
  })

  await persistence.initializeDoc(workflowId, doc, () => {
    // Workflow synced to IndexedDB
  })
}

/**
 * Create presence provider for real-time collaboration
 */
export function createPresenceProvider(
  doc: Y.Doc,
  userId: string,
  userName: string
): {
  awareness: any
  setPresence: (presence: Partial<CRDTPresence>) => void
  getPresence: () => Map<number, CRDTPresence>
} {
  const awareness = {
    clientID: doc.clientID,
    states: new Map<number, any>()
  }

  const setPresence = (presence: Partial<CRDTPresence>) => {
    const fullPresence: CRDTPresence = {
      userId,
      userName,
      userColor: generateUserColor(userId),
      isActive: true,
      lastSeen: Date.now(),
      ...presence
    }

    awareness.states.set(awareness.clientID, fullPresence)

    // In a real implementation, awareness updates would be broadcast
    // through a proper Y.js awareness protocol over WebSocket/WebRTC
  }

  const getPresence = (): Map<number, CRDTPresence> => {
    return awareness.states
  }

  return { awareness, setPresence, getPresence }
}

/**
 * Generate a consistent color for a user
 */
function generateUserColor(userId: string): string {
  const colors = [
    '#ef4444', // red
    '#f59e0b', // amber
    '#10b981', // emerald
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16', // lime
  ]

  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }

  return colors[Math.abs(hash) % colors.length]
}