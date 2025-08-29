/**
 * Server-side CRDT operations that work without browser dependencies
 * Broadcasts changes through WebSocket or other mechanisms for real-time sync
 */

import { getDatabaseOperations } from '../database'
import type { NodeMetadata, Connection as WorkflowConnection } from '../../types/workflow'
import { Doc } from 'yjs'
import * as Y from 'yjs'
import { webhookEvents } from '@/services/event-bus'

export interface WorkflowNode {
  id: string
  metadata: any
  position: { x: number; y: number }
}

export interface CRDTUpdate {
  type:
    | 'node-added'
    | 'node-updated'
    | 'node-removed'
    | 'connection-added'
    | 'connection-removed'
    | 'group-created'
    | 'group-updated'
    | 'group-removed'
  workflowId: string
  graphId: string
  data: any
  timestamp: number
}

/**
 * Server-side CRDT operations that can broadcast updates
 */
export class ServerCRDTOperations {
  private static docs = new Map<string, Doc>()

  /**
   * Get or create a Y.Doc for a workflow
   */
  private static getDoc(workflowId: string): Doc {
    if (!this.docs.has(workflowId)) {
      const doc = new Doc()
      this.docs.set(workflowId, doc)
    }
    return this.docs.get(workflowId)!
  }

  /**
   * Add a node and broadcast the change
   */
  static async addNode(
    workflowId: string,
    graphId: string,
    node: Omit<WorkflowNode, 'id'>
  ): Promise<WorkflowNode> {
    const doc = this.getDoc(workflowId)

    // Generate a unique node ID
    const nodeId = `node-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

    // Create node data
    const nodeData: WorkflowNode = {
      id: nodeId,
      metadata: {
        ...node.metadata,
        id: nodeId,
        propertyValues: node.metadata.propertyValues || {},
      },
      position: node.position,
    }

    // Update CRDT document
    doc.transact(() => {
      const graphs = doc.getMap('graphs')
      const graph = (graphs.get(graphId) as Y.Map<any>) || new Y.Map()

      if (!graphs.has(graphId)) {
        graphs.set(graphId, graph)
        graph.set('id', graphId)
        graph.set('nodes', new Y.Map())
        graph.set('connections', new Y.Map())
        graph.set('groups', new Y.Map())
      }

      const nodes = graph.get('nodes') as Y.Map<any>
      const yNode = new Y.Map()

      yNode.set('id', nodeId)
      yNode.set('metadata', nodeData.metadata)
      yNode.set('position', nodeData.position)
      // yNode.set('propertyValues', nodeData.metadata.propertyValues)

      nodes.set(nodeId, yNode)
    })

    // Broadcast the update
    await this.broadcastUpdate({
      type: 'node-added',
      workflowId,
      graphId,
      data: nodeData,
      timestamp: Date.now(),
    })
    
    // Emit webhook event
    await webhookEvents.nodeAdded(workflowId, graphId, nodeId, nodeData)

    // Also save to database for persistence - with retry logic for concurrency
    let retryCount = 0
    const maxRetries = 3
    
    while (retryCount < maxRetries) {
      try {
        const dbOps = await getDatabaseOperations()
        console.log(`[ServerCRDTOperations] Fetching workflow ${workflowId} from database (attempt ${retryCount + 1})...`)

        // Get the latest version which contains the graphs - ALWAYS get fresh data
        const { versions } = await dbOps.listWorkflowVersions(workflowId, { limit: 1 })
        const latestVersion = versions[0]

        if (latestVersion && latestVersion.graphs) {
          // Parse graphs if it's a string
          const graphs =
            typeof latestVersion.graphs === 'string'
              ? JSON.parse(latestVersion.graphs)
              : latestVersion.graphs

          // Only log full graphs on first attempt to reduce noise
          if (retryCount === 0) {
            console.log(`[ServerCRDTOperations] Current nodes count in DB: ${graphs[0]?.nodes?.length || 0}`)
          }
          
          const graph = graphs.find((g: any) => g.id === graphId)
          if (graph) {
            // Initialize nodes array if it doesn't exist
            if (!graph.nodes) {
              graph.nodes = []
            }
            
            // Check if node already exists to avoid duplicates
            const existingNodeIndex = graph.nodes.findIndex((n: any) => n.id === nodeId)
            if (existingNodeIndex === -1) {
              graph.nodes.push(nodeData as any)
              console.log(
                `[ServerCRDTOperations] Adding node ${nodeId} (${nodeData.metadata?.title}) to graph ${graphId}, total nodes: ${graph.nodes.length}`
              )
            } else {
              console.log(
                `[ServerCRDTOperations] Node ${nodeId} already exists in graph, skipping`
              )
              break // Node already exists, no need to update
            }

            // Update the version with modified graphs
            await dbOps.updateWorkflowVersion(latestVersion.id, {
              graphs: JSON.stringify(graphs),
              isDraft: true,
              createdAt: new Date().toISOString(),
            })

            console.log(`[ServerCRDTOperations] Successfully saved node ${nodeId} to database`)
            break // Success, exit the retry loop
          } else {
            console.warn(
              `[ServerCRDTOperations] Graph ${graphId} not found in workflow ${workflowId}`
            )
            break // No point retrying if graph doesn't exist
          }
        } else {
          console.warn(
            `[ServerCRDTOperations] No workflow version found for ${workflowId} or version has no graphs`
          )
          break // No point retrying if workflow doesn't exist
        }
      } catch (error: any) {
        retryCount++
        if (retryCount >= maxRetries) {
          console.error('[ServerCRDTOperations] Error saving to database after retries:', error)
          // Continue anyway - CRDT update was successful
        } else {
          console.warn(`[ServerCRDTOperations] Database save failed, retrying... (${retryCount}/${maxRetries})`)
          // Small delay before retry
          await new Promise(resolve => setTimeout(resolve, 100 * retryCount))
        }
      }
    }

    return nodeData
  }

  /**
   * Create a connection and broadcast the change
   */
  static async connectNodes(
    workflowId: string,
    graphId: string,
    connection: {
      sourceNodeId: string
      sourcePortId: string
      targetNodeId: string
      targetPortId: string
    }
  ): Promise<WorkflowConnection> {
    const doc = this.getDoc(workflowId)

    // Generate connection ID
    const connectionId = `conn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

    const connectionData: WorkflowConnection = {
      id: connectionId,
      source: {
        nodeId: connection.sourceNodeId,
        portId: connection.sourcePortId,
      },
      target: {
        nodeId: connection.targetNodeId,
        portId: connection.targetPortId,
      },
      state: 'pending',
    }

    // Update CRDT document
    doc.transact(() => {
      const graphs = doc.getMap('graphs')
      const graph = graphs.get(graphId) as Y.Map<any>

      if (graph) {
        const connections = graph.get('connections') as Y.Map<any>
        const yConnection = new Y.Map()

        yConnection.set('id', connectionId)
        yConnection.set('source', connectionData.source)
        yConnection.set('target', connectionData.target)
        yConnection.set('state', connectionData.state)

        connections.set(connectionId, yConnection)
      }
    })

    // Broadcast the update
    await this.broadcastUpdate({
      type: 'connection-added',
      workflowId,
      graphId,
      data: connectionData,
      timestamp: Date.now(),
    })
    
    // Emit webhook event
    await webhookEvents.connectionAdded(workflowId, graphId, connectionData)

    // Save to database
    try {
      const dbOps = await getDatabaseOperations()
      console.log(`[ServerCRDTOperations] Fetching workflow ${workflowId} from database...`)

      // Get the latest version which contains the graphs
      const { versions } = await dbOps.listWorkflowVersions(workflowId, { limit: 1 })
      const latestVersion = versions[0]

      if (latestVersion && latestVersion.graphs) {
        // Parse graphs if it's a string
        const graphs =
          typeof latestVersion.graphs === 'string'
            ? JSON.parse(latestVersion.graphs)
            : latestVersion.graphs

        console.log(
          '[ServerCRDTOperations] Before adding connection - graphs structure:',
          JSON.stringify(graphs, null, 2)
        )

        const graph = graphs.find((g: any) => g.id === graphId)
        if (graph) {
          // Initialize connections array if it doesn't exist
          if (!graph.connections) {
            graph.connections = []
          }
          graph.connections.push(connectionData)
          console.log(
            `[ServerCRDTOperations] Adding connection ${connectionId} to graph ${graphId}, total connections: ${graph.connections.length}`
          )
          console.log(
            '[ServerCRDTOperations] Connection data structure:',
            JSON.stringify(connectionData, null, 2)
          )

          // Update the version with modified graphs
          await dbOps.updateWorkflowVersion(latestVersion.id, {
            graphs: JSON.stringify(graphs),
            isDraft: true,
            createdAt: new Date().toISOString(),
          })

          console.log(
            `[ServerCRDTOperations] Successfully saved connection ${connectionId} to database`
          )
        } else {
          console.warn(
            `[ServerCRDTOperations] Graph ${graphId} not found in workflow ${workflowId}`
          )
        }
      } else {
        console.warn(
          `[ServerCRDTOperations] No workflow version found for ${workflowId} or version has no graphs`
        )
      }
    } catch (error) {
      console.error('[ServerCRDTOperations] Error saving connection to database:', error)
      // Continue anyway - CRDT update was successful
    }

    return connectionData
  }

  /**
   * Create a node group and broadcast the change
   */
  static async createNodeGroup(
    workflowId: string,
    graphId: string,
    group: {
      title: string
      nodeIds: string[]
      color?: string
      description?: string
    }
  ): Promise<any> {
    const doc = this.getDoc(workflowId)

    // Generate group ID
    const groupId = `group-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

    const groupData = {
      id: groupId,
      title: group.title,
      nodeIds: group.nodeIds,
      color: group.color || '#3b82f6',
      description: group.description,
      isCollapsed: false,
    }

    // Update CRDT document
    doc.transact(() => {
      const graphs = doc.getMap('graphs')
      const graph = graphs.get(graphId) as Y.Map<any>

      if (graph) {
        const groups = graph.get('groups') as Y.Map<any>
        const yGroup = new Y.Map()

        Object.entries(groupData).forEach(([key, value]) => {
          yGroup.set(key, value)
        })

        groups.set(groupId, yGroup)
      }
    })

    // Broadcast the update
    await this.broadcastUpdate({
      type: 'group-created',
      workflowId,
      graphId,
      data: groupData,
      timestamp: Date.now(),
    })

    // Save to database
    try {
      const dbOps = await getDatabaseOperations()
      console.log(`[ServerCRDTOperations] Fetching workflow ${workflowId} from database...`)

      // Get the latest version which contains the graphs
      const { versions } = await dbOps.listWorkflowVersions(workflowId, { limit: 1 })
      const latestVersion = versions[0]

      if (latestVersion && latestVersion.graphs) {
        // Parse graphs if it's a string
        const graphs =
          typeof latestVersion.graphs === 'string'
            ? JSON.parse(latestVersion.graphs)
            : latestVersion.graphs

        const graph = graphs.find((g: any) => g.id === graphId)
        if (graph) {
          // Initialize groups array if it doesn't exist
          if (!graph.groups) {
            graph.groups = []
          }
          graph.groups.push(groupData as any)
          console.log(
            `[ServerCRDTOperations] Adding group ${groupId} to graph ${graphId}, total groups: ${graph.groups.length}`
          )

          // Update the version with modified graphs
          await dbOps.updateWorkflowVersion(latestVersion.id, {
            graphs: JSON.stringify(graphs),
            isDraft: true,
            createdAt: new Date().toISOString(),
          })

          console.log(`[ServerCRDTOperations] Successfully saved group ${groupId} to database`)
        } else {
          console.warn(
            `[ServerCRDTOperations] Graph ${graphId} not found in workflow ${workflowId}`
          )
        }
      } else {
        console.warn(
          `[ServerCRDTOperations] No workflow version found for ${workflowId} or version has no graphs`
        )
      }
    } catch (error) {
      console.error('[ServerCRDTOperations] Error saving group to database:', error)
      // Continue anyway - CRDT update was successful
    }

    // Emit webhook event
    await webhookEvents.groupCreated(workflowId, graphId, groupData)

    return groupData
  }

  /**
   * Broadcast update to connected clients
   * This can be implemented using WebSocket, Server-Sent Events, or other real-time mechanisms
   */
  private static async broadcastUpdate(update: CRDTUpdate): Promise<void> {
    // Log the update for debugging
    console.log('[ServerCRDTOperations] Broadcasting update:', update)

    // In a real implementation, this would send the update through:
    // 1. WebSocket connections to connected clients
    // 2. Redis pub/sub for multi-server deployments
    // 3. Server-Sent Events
    // 4. Or any other real-time communication mechanism

    // For now, we'll store the update so clients can poll for changes
    // This is a temporary solution until WebSocket is implemented
    if (typeof globalThis !== 'undefined' && (globalThis as any).pendingCRDTUpdates) {
      const updates = (globalThis as any).pendingCRDTUpdates as Map<string, CRDTUpdate[]>
      const workflowUpdates = updates.get(update.workflowId) || []
      workflowUpdates.push(update)
      updates.set(update.workflowId, workflowUpdates)
    } else if (typeof globalThis !== 'undefined') {
      ;(globalThis as any).pendingCRDTUpdates = new Map([[update.workflowId, [update]]])
    }
  }

  /**
   * Update node properties
   */
  static async updateNodeProperties(
    workflowId: string,
    graphId: string,
    nodeId: string,
    propertyValues: Record<string, any>
  ): Promise<WorkflowNode> {
    const doc = this.getDoc(workflowId)
    
    let updatedNode: WorkflowNode | null = null
    
    // Update CRDT document
    doc.transact(() => {
      const graphs = doc.getMap('graphs')
      let graph = graphs.get(graphId) as Y.Map<any>
      
      // Initialize graph if it doesn't exist
      if (!graph) {
        graph = new Y.Map()
        graph.set('id', graphId)
        graph.set('nodes', new Y.Map())
        graph.set('connections', new Y.Map())
        graph.set('groups', new Y.Map())
        graphs.set(graphId, graph)
      }
      
      let nodes = graph.get('nodes') as Y.Map<any>
      if (!nodes) {
        nodes = new Y.Map()
        graph.set('nodes', nodes)
      }
      
      let yNode = nodes.get(nodeId) as Y.Map<any>
      
      // If node doesn't exist in CRDT, try to load it from database
      if (!yNode) {
        console.log(`[ServerCRDTOperations] Node ${nodeId} not in CRDT, attempting to load from database...`)
        
        // We'll create a placeholder node in CRDT that will be updated
        // The actual node data should be in the database already
        yNode = new Y.Map()
        yNode.set('id', nodeId)
        yNode.set('metadata', {})
        yNode.set('position', { x: 0, y: 0 })
        nodes.set(nodeId, yNode)
        
        console.log(`[ServerCRDTOperations] Created placeholder for node ${nodeId} in CRDT`)
      }
      
      // Get current metadata
      const currentMetadata = yNode.get('metadata') || {}
      
      // Update propertyValues within metadata
      const updatedMetadata = {
        ...currentMetadata,
        propertyValues: {
          ...(currentMetadata.propertyValues || {}),
          ...propertyValues
        }
      }
      
      // Set updated metadata
      yNode.set('metadata', updatedMetadata)
      
      // Store at root level for CRDT as well (for compatibility)
      Object.entries(propertyValues).forEach(([key, value]) => {
        yNode.set(key, value)
      })
      
      updatedNode = {
        id: nodeId,
        metadata: updatedMetadata,
        position: yNode.get('position')
      }
    })
    
    // Broadcast the update
    await this.broadcastUpdate({
      type: 'node-updated',
      workflowId,
      graphId,
      data: {
        nodeId,
        propertyValues
      },
      timestamp: Date.now()
    })
    
    // Emit webhook event
    await webhookEvents.nodeUpdated(workflowId, graphId, nodeId, { propertyValues })
    
    // Also update in database for persistence
    try {
      const db = await getDatabaseOperations()
      console.log(`[ServerCRDTOperations] Updating node properties in database for workflow ${workflowId}`)
      console.log(`[ServerCRDTOperations] Property values to update:`, propertyValues)
      
      // Get the latest version which contains the graphs
      const { versions } = await db.listWorkflowVersions(workflowId, { limit: 1 })
      const latestVersion = versions[0]
      
      if (!latestVersion) {
        console.warn(`[ServerCRDTOperations] No version found for workflow ${workflowId}`)
        return updatedNode!
      }
      
      if (latestVersion && latestVersion.graphs) {
        const graphs = typeof latestVersion.graphs === 'string'
          ? JSON.parse(latestVersion.graphs)
          : latestVersion.graphs || []
        
        console.log(`[ServerCRDTOperations] Found ${graphs.length} graphs in workflow`)
        
        const graph = graphs.find((g: any) => g.id === graphId)
        if (graph) {
          console.log(`[ServerCRDTOperations] Found graph ${graphId} with ${graph.nodes?.length || 0} nodes`)
          
          // Initialize nodes array if it doesn't exist
          if (!graph.nodes) {
            graph.nodes = []
          }
          
          // Log all node IDs in the database for debugging
          console.log(`[ServerCRDTOperations] Looking for node ${nodeId} in database`)
          console.log(`[ServerCRDTOperations] Available node IDs in database:`, graph.nodes.map((n: any) => n.id))
          
          const nodeIndex = graph.nodes.findIndex((n: any) => n.id === nodeId)
          if (nodeIndex !== -1) {
            // Update existing node
            const oldPropertyValues = graph.nodes[nodeIndex].metadata?.propertyValues || {}
            graph.nodes[nodeIndex].metadata = {
              ...graph.nodes[nodeIndex].metadata,
              propertyValues: {
                ...oldPropertyValues,
                ...propertyValues
              }
            }
            
            console.log(`[ServerCRDTOperations] Updated properties for node ${nodeId}:`)
            console.log(`  Old values:`, oldPropertyValues)
            console.log(`  New values:`, graph.nodes[nodeIndex].metadata.propertyValues)
          } else {
            // Try to find by metadata.id as well
            const nodeByMetadataId = graph.nodes.findIndex((n: any) => n.metadata?.id === nodeId)
            if (nodeByMetadataId !== -1) {
              console.log(`[ServerCRDTOperations] Found node by metadata.id instead of root id`)
              const oldPropertyValues = graph.nodes[nodeByMetadataId].metadata?.propertyValues || {}
              graph.nodes[nodeByMetadataId].metadata = {
                ...graph.nodes[nodeByMetadataId].metadata,
                propertyValues: {
                  ...oldPropertyValues,
                  ...propertyValues
                }
              }
              
              console.log(`[ServerCRDTOperations] Updated properties for node ${nodeId}:`)
              console.log(`  Old values:`, oldPropertyValues)
              console.log(`  New values:`, graph.nodes[nodeByMetadataId].metadata.propertyValues)
            } else {
              // Node doesn't exist in database - this shouldn't happen but handle gracefully
              console.warn(`[ServerCRDTOperations] Node ${nodeId} not found in database (searched ${graph.nodes.length} nodes)`)
              console.warn(`[ServerCRDTOperations] First few nodes in DB:`, graph.nodes.slice(0, 2).map((n: any) => ({
                id: n.id,
                metadataId: n.metadata?.id,
                title: n.metadata?.title
              })))
              return updatedNode!
            }
          }
          
          // Update the version with modified graphs
          console.log(`[ServerCRDTOperations] Saving updated graphs to database...`)
          await db.updateWorkflowVersion(latestVersion.id, {
            graphs: JSON.stringify(graphs),
            isDraft: true,
            createdAt: new Date().toISOString(),
          })
          console.log(`[ServerCRDTOperations] Successfully saved property updates to database`)
        } else {
          console.warn(`[ServerCRDTOperations] Graph ${graphId} not found in workflow`)
        }
      } else {
        console.warn(`[ServerCRDTOperations] Version has no graphs`)
      }
    } catch (error) {
      console.error('[ServerCRDTOperations] Error updating database:', error)
      // Continue anyway - CRDT update was successful
    }
    
    return updatedNode!
  }

  /**
   * Update node position
   */
  static async updateNodePosition(
    workflowId: string,
    graphId: string,
    nodeId: string,
    position: { x: number; y: number }
  ): Promise<WorkflowNode> {
    const doc = this.getDoc(workflowId)
    
    let updatedNode: WorkflowNode | null = null
    
    // Update CRDT document
    doc.transact(() => {
      const graphs = doc.getMap('graphs')
      let graph = graphs.get(graphId) as Y.Map<any>
      
      // Initialize graph if it doesn't exist
      if (!graph) {
        graph = new Y.Map()
        graph.set('id', graphId)
        graph.set('nodes', new Y.Map())
        graph.set('connections', new Y.Map())
        graph.set('groups', new Y.Map())
        graphs.set(graphId, graph)
      }
      
      let nodes = graph.get('nodes') as Y.Map<any>
      if (!nodes) {
        nodes = new Y.Map()
        graph.set('nodes', nodes)
      }
      
      let yNode = nodes.get(nodeId) as Y.Map<any>
      
      // If node doesn't exist in CRDT, create a placeholder
      if (!yNode) {
        console.log(`[ServerCRDTOperations] Node ${nodeId} not in CRDT, creating placeholder...`)
        yNode = new Y.Map()
        yNode.set('id', nodeId)
        yNode.set('metadata', {})
        yNode.set('position', { x: 0, y: 0 })
        nodes.set(nodeId, yNode)
      }
      
      yNode.set('position', position)
      
      updatedNode = {
        id: nodeId,
        metadata: yNode.get('metadata'),
        position
      }
    })
    
    // Broadcast the update
    await this.broadcastUpdate({
      type: 'node-updated',
      workflowId,
      graphId,
      data: {
        nodeId,
        position
      },
      timestamp: Date.now()
    })
    
    // Also update position in database for persistence
    try {
      const db = await getDatabaseOperations()
      console.log(`[ServerCRDTOperations] Updating node position in database for workflow ${workflowId}`)
      
      // Get the latest version which contains the graphs
      const { versions } = await db.listWorkflowVersions(workflowId, { limit: 1 })
      const latestVersion = versions[0]
      
      if (latestVersion && latestVersion.graphs) {
        const graphs = typeof latestVersion.graphs === 'string'
          ? JSON.parse(latestVersion.graphs)
          : latestVersion.graphs || []
        
        const graph = graphs.find((g: any) => g.id === graphId)
        if (graph) {
          // Initialize nodes array if it doesn't exist
          if (!graph.nodes) {
            graph.nodes = []
          }
          
          const nodeIndex = graph.nodes.findIndex((n: any) => n.id === nodeId)
          if (nodeIndex !== -1) {
            // Update existing node position
            graph.nodes[nodeIndex].position = position
            
            console.log(`[ServerCRDTOperations] Updated position for node ${nodeId} to (${position.x}, ${position.y}) in database`)
          } else {
            // Node doesn't exist in database - this shouldn't happen but handle gracefully
            console.warn(`[ServerCRDTOperations] Node ${nodeId} not found in database, skipping database update`)
          }
          
          // Update the version with modified graphs
          await db.updateWorkflowVersion(latestVersion.id, {
            graphs: JSON.stringify(graphs),
            isDraft: true,
            createdAt: new Date().toISOString(),
          })
          
          console.log(`[ServerCRDTOperations] Successfully saved node position to database`)
        }
      }
    } catch (error) {
      console.error('[ServerCRDTOperations] Error updating position in database:', error)
      // Continue anyway - CRDT update was successful
    }
    
    return updatedNode!
  }

  /**
   * Update group properties
   */
  static async updateGroupProperties(
    workflowId: string,
    graphId: string,
    groupId: string,
    updates: any
  ): Promise<any> {
    const doc = this.getDoc(workflowId)
    
    let updatedGroup: any = null
    
    // Update CRDT document
    doc.transact(() => {
      const graphs = doc.getMap('graphs')
      let graph = graphs.get(graphId) as Y.Map<any>
      
      // Initialize graph if it doesn't exist
      if (!graph) {
        graph = new Y.Map()
        graph.set('id', graphId)
        graph.set('nodes', new Y.Map())
        graph.set('connections', new Y.Map())
        graph.set('groups', new Y.Map())
        graphs.set(graphId, graph)
      }
      
      let groups = graph.get('groups') as Y.Map<any>
      if (!groups) {
        groups = new Y.Map()
        graph.set('groups', groups)
      }
      
      const yGroup = groups.get(groupId) as Y.Map<any>
      if (!yGroup) {
        throw new Error(`Group ${groupId} not found`)
      }
      
      // Update group properties
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          yGroup.set(key, value)
        }
      })
      
      updatedGroup = {
        id: groupId,
        ...updates
      }
    })
    
    // Broadcast the update
    await this.broadcastUpdate({
      type: 'group-updated',
      workflowId,
      graphId,
      data: {
        groupId,
        updates
      },
      timestamp: Date.now()
    })
    
    // Emit webhook event
    await webhookEvents.groupUpdated(workflowId, graphId, { groupId, ...updatedGroup })
    
    return updatedGroup
  }

  /**
   * Get pending updates for a workflow (temporary polling solution)
   */
  static getPendingUpdates(workflowId: string, since?: number): CRDTUpdate[] {
    if (typeof globalThis === 'undefined' || !(globalThis as any).pendingCRDTUpdates) {
      return []
    }

    const updates = (globalThis as any).pendingCRDTUpdates as Map<string, CRDTUpdate[]>
    const workflowUpdates = updates.get(workflowId) || []

    if (since) {
      return workflowUpdates.filter(u => u.timestamp > since)
    }

    return workflowUpdates
  }

  /**
   * Clear pending updates for a workflow
   */
  static clearPendingUpdates(workflowId: string): void {
    if (typeof globalThis !== 'undefined' && (globalThis as any).pendingCRDTUpdates) {
      const updates = (globalThis as any).pendingCRDTUpdates as Map<string, CRDTUpdate[]>
      updates.delete(workflowId)
    }
  }

  /**
   * Add multiple nodes in a single batch to avoid race conditions
   */
  static async addNodesBatch(
    workflowId: string,
    graphId: string,
    nodes: Array<Omit<WorkflowNode, 'id'>>
  ): Promise<WorkflowNode[]> {
    const doc = this.getDoc(workflowId)
    const createdNodes: WorkflowNode[] = []
    
    // First, update CRDT for all nodes
    doc.transact(() => {
      const graphs = doc.getMap('graphs')
      const graph = (graphs.get(graphId) as Y.Map<any>) || new Y.Map()

      if (!graphs.has(graphId)) {
        graphs.set(graphId, graph)
        graph.set('id', graphId)
        graph.set('nodes', new Y.Map())
        graph.set('connections', new Y.Map())
        graph.set('groups', new Y.Map())
      }

      const nodesMap = graph.get('nodes') as Y.Map<any>
      
      // Add all nodes to CRDT
      for (const node of nodes) {
        // Generate a unique node ID
        const nodeId = `node-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
        
        // Create node data
        const nodeData: WorkflowNode = {
          id: nodeId,
          metadata: {
            ...node.metadata,
            id: nodeId,
            propertyValues: node.metadata.propertyValues || {},
          },
          position: node.position,
        }
        
        const yNode = new Y.Map()
        yNode.set('id', nodeId)
        yNode.set('metadata', nodeData.metadata)
        yNode.set('position', nodeData.position)
        
        nodesMap.set(nodeId, yNode)
        createdNodes.push(nodeData)
      }
    })
    
    // Broadcast all updates
    for (const nodeData of createdNodes) {
      await this.broadcastUpdate({
        type: 'node-added',
        workflowId,
        graphId,
        data: nodeData,
        timestamp: Date.now(),
      })
    }
    
    // Save all nodes to database in a single transaction
    try {
      const dbOps = await getDatabaseOperations()
      console.log(`[ServerCRDTOperations] Batch saving ${createdNodes.length} nodes to database for workflow ${workflowId}...`)
      
      // Get the latest version which contains the graphs
      const { versions } = await dbOps.listWorkflowVersions(workflowId, { limit: 1 })
      const latestVersion = versions[0]
      
      if (latestVersion && latestVersion.graphs) {
        // Parse graphs if it's a string
        const graphs =
          typeof latestVersion.graphs === 'string'
            ? JSON.parse(latestVersion.graphs)
            : latestVersion.graphs
        
        const graph = graphs.find((g: any) => g.id === graphId)
        if (graph) {
          // Initialize nodes array if it doesn't exist
          if (!graph.nodes) {
            graph.nodes = []
          }
          
          // Add all new nodes at once
          for (const nodeData of createdNodes) {
            // Check if node already exists to avoid duplicates
            const existingNodeIndex = graph.nodes.findIndex((n: any) => n.id === nodeData.id)
            if (existingNodeIndex === -1) {
              graph.nodes.push(nodeData as any)
              console.log(
                `[ServerCRDTOperations] Added node ${nodeData.id} (${nodeData.metadata?.title}) to batch`
              )
            }
          }
          
          console.log(
            `[ServerCRDTOperations] Saving batch of ${createdNodes.length} nodes, total nodes in graph: ${graph.nodes.length}`
          )
          
          // Update the version with modified graphs - single database write
          await dbOps.updateWorkflowVersion(latestVersion.id, {
            graphs: JSON.stringify(graphs),
            isDraft: true,
            createdAt: new Date().toISOString(),
          })
          
          console.log(`[ServerCRDTOperations] Successfully saved batch of ${createdNodes.length} nodes to database`)
        } else {
          console.warn(
            `[ServerCRDTOperations] Graph ${graphId} not found in workflow ${workflowId}`
          )
        }
      } else {
        console.warn(
          `[ServerCRDTOperations] No workflow version found for ${workflowId} or version has no graphs`
        )
      }
    } catch (error) {
      console.error('[ServerCRDTOperations] Error batch saving to database:', error)
      // Continue anyway - CRDT update was successful
    }
    
    return createdNodes
  }

  /**
   * Remove a node from the workflow
   */
  static async removeNode(
    workflowId: string,
    graphId: string,
    nodeId: string
  ): Promise<void> {
    const doc = this.getDoc(workflowId)
    
    // Update CRDT document
    doc.transact(() => {
      const graphs = doc.getMap('graphs')
      const graph = graphs.get(graphId) as Y.Map<any>
      
      if (graph) {
        const nodes = graph.get('nodes') as Y.Map<any>
        if (nodes) {
          nodes.delete(nodeId)
        }
        
        // Also remove any connections that involve this node
        const connections = graph.get('connections') as Y.Map<any>
        if (connections) {
          const toDelete: string[] = []
          connections.forEach((conn: Y.Map<any>, connId: string) => {
            const source = conn.get('source')
            const target = conn.get('target')
            if (
              (source && source.nodeId === nodeId) ||
              (target && target.nodeId === nodeId)
            ) {
              toDelete.push(connId)
            }
          })
          toDelete.forEach(connId => connections.delete(connId))
        }
        
        // Also remove from any groups
        const groups = graph.get('groups') as Y.Map<any>
        if (groups) {
          groups.forEach((group: Y.Map<any>) => {
            const nodeIds = group.get('nodeIds')
            if (Array.isArray(nodeIds)) {
              const newNodeIds = nodeIds.filter(id => id !== nodeId)
              if (newNodeIds.length !== nodeIds.length) {
                group.set('nodeIds', newNodeIds)
              }
            }
          })
        }
      }
    })
    
    // Broadcast the update
    await this.broadcastUpdate({
      type: 'node-removed',
      workflowId,
      graphId,
      data: { nodeId },
      timestamp: Date.now(),
    })
    
    // Emit webhook event
    await webhookEvents.nodeDeleted(workflowId, graphId, nodeId)
    
    // Remove from database for persistence
    try {
      const db = await getDatabaseOperations()
      console.log(`[ServerCRDTOperations] Removing node ${nodeId} from database for workflow ${workflowId}`)
      
      const { versions } = await db.listWorkflowVersions(workflowId, { limit: 1 })
      const latestVersion = versions[0]
      
      if (latestVersion && latestVersion.graphs) {
        const graphs = typeof latestVersion.graphs === 'string'
          ? JSON.parse(latestVersion.graphs)
          : latestVersion.graphs
        
        const graph = graphs.find((g: any) => g.id === graphId)
        if (graph) {
          // Remove node
          if (graph.nodes) {
            graph.nodes = graph.nodes.filter((n: any) => n.id !== nodeId)
          }
          
          // Remove connections involving this node
          if (graph.connections) {
            graph.connections = graph.connections.filter((c: any) => 
              c.source !== nodeId && c.target !== nodeId
            )
          }
          
          // Remove from groups
          if (graph.groups) {
            graph.groups = graph.groups.map((g: any) => ({
              ...g,
              nodeIds: g.nodeIds ? g.nodeIds.filter((id: string) => id !== nodeId) : []
            }))
          }
          
          // Update the version with modified graphs
          await db.updateWorkflowVersion(latestVersion.id, {
            graphs: JSON.stringify(graphs),
            isDraft: true,
            createdAt: new Date().toISOString(),
          })
          
          console.log(`[ServerCRDTOperations] Successfully removed node ${nodeId} from database`)
        }
      }
    } catch (error) {
      console.error('[ServerCRDTOperations] Error removing node from database:', error)
    }
  }

  /**
   * Remove a connection from the workflow
   */
  static async removeConnection(
    workflowId: string,
    graphId: string,
    connectionId: string
  ): Promise<void> {
    const doc = this.getDoc(workflowId)
    
    // Update CRDT document
    doc.transact(() => {
      const graphs = doc.getMap('graphs')
      const graph = graphs.get(graphId) as Y.Map<any>
      
      if (graph) {
        const connections = graph.get('connections') as Y.Map<any>
        if (connections) {
          connections.delete(connectionId)
        }
      }
    })
    
    // Broadcast the update
    await this.broadcastUpdate({
      type: 'connection-removed',
      workflowId,
      graphId,
      data: { connectionId },
      timestamp: Date.now(),
    })
    
    // Emit webhook event
    await webhookEvents.connectionDeleted(workflowId, graphId, { connectionId })
    
    // Remove from database
    try {
      const db = await getDatabaseOperations()
      const { versions } = await db.listWorkflowVersions(workflowId, { limit: 1 })
      const latestVersion = versions[0]
      
      if (latestVersion && latestVersion.graphs) {
        const graphs = typeof latestVersion.graphs === 'string'
          ? JSON.parse(latestVersion.graphs)
          : latestVersion.graphs
        
        const graph = graphs.find((g: any) => g.id === graphId)
        if (graph && graph.connections) {
          graph.connections = graph.connections.filter((c: any) => c.id !== connectionId)
          
          await db.updateWorkflowVersion(latestVersion.id, {
            graphs: JSON.stringify(graphs),
            isDraft: true,
            createdAt: new Date().toISOString(),
          })
        }
      }
    } catch (error) {
      console.error('[ServerCRDTOperations] Error removing connection from database:', error)
    }
  }

  /**
   * Remove a group from the workflow
   */
  static async removeGroup(
    workflowId: string,
    graphId: string,
    groupId: string
  ): Promise<void> {
    const doc = this.getDoc(workflowId)
    
    // Update CRDT document
    doc.transact(() => {
      const graphs = doc.getMap('graphs')
      const graph = graphs.get(graphId) as Y.Map<any>
      
      if (graph) {
        const groups = graph.get('groups') as Y.Map<any>
        if (groups) {
          groups.delete(groupId)
        }
      }
    })
    
    // Broadcast the update
    await this.broadcastUpdate({
      type: 'group-removed',
      workflowId,
      graphId,
      data: { groupId },
      timestamp: Date.now(),
    })
    
    // Emit webhook event
    await webhookEvents.groupDeleted(workflowId, graphId, { groupId })
    
    // Remove from database
    try {
      const db = await getDatabaseOperations()
      const { versions } = await db.listWorkflowVersions(workflowId, { limit: 1 })
      const latestVersion = versions[0]
      
      if (latestVersion && latestVersion.graphs) {
        const graphs = typeof latestVersion.graphs === 'string'
          ? JSON.parse(latestVersion.graphs)
          : latestVersion.graphs
        
        const graph = graphs.find((g: any) => g.id === graphId)
        if (graph && graph.groups) {
          graph.groups = graph.groups.filter((g: any) => g.id !== groupId)
          
          await db.updateWorkflowVersion(latestVersion.id, {
            graphs: JSON.stringify(graphs),
            isDraft: true,
            createdAt: new Date().toISOString(),
          })
          
          console.log(`[ServerCRDTOperations] Successfully removed group ${groupId} from database`)
        }
      }
    } catch (error) {
      console.error('[ServerCRDTOperations] Error removing group from database:', error)
    }
  }
}
