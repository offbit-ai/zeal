/**
 * Workflow operations for the MCP server using CRDT
 * Handles real-time modification of workflow data through the workflow store
 */

import { useWorkflowStore } from '../../store/workflow-store'
import type { NodeMetadata, Connection as WorkflowConnection } from '../../types/workflow'

export interface WorkflowNode {
  id: string
  metadata: any
  position: { x: number; y: number }
}

export interface WorkflowGroup {
  id: string
  title: string
  description?: string
  nodeIds: string[]
  position?: { x: number; y: number }
  size?: { width: number; height: number }
  color?: string
  collapsed?: boolean
}

export interface WorkflowGraph {
  id: string
  name: string
  nodes: WorkflowNode[]
  connections: WorkflowConnection[]
  groups: WorkflowGroup[]
}

export class WorkflowOperationsCRDT {
  /**
   * Initialize the workflow store if not already initialized
   */
  private static async ensureInitialized(workflowId: string): Promise<void> {
    const store = useWorkflowStore.getState()

    // Check if already initialized with the same workflow
    if (store.initialized && store.workflowId === workflowId) {
      return
    }

    // Initialize with collaborative mode enabled for CRDT sync
    await store.initialize(workflowId, undefined, {
      embedMode: false, // Not in embed mode for MCP
      collaborative: true, // Enable CRDT
      followMode: false, // MCP doesn't need follow mode
    })

    // Enable autosave to persist changes to database
    store.enableAutosave(true)
  }

  /**
   * Add a node to a workflow graph using CRDT
   */
  static async addNode(
    workflowId: string,
    graphId: string,
    node: Omit<WorkflowNode, 'id'>
  ): Promise<WorkflowNode> {
    await this.ensureInitialized(workflowId)
    const store = useWorkflowStore.getState()

    // Switch to the target graph if needed
    if (store.currentGraphId !== graphId) {
      store.switchGraph(graphId)
    }

    // Generate node ID if not provided
    const nodeId =
      node.metadata.id ||
      `${node.metadata.type}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

    // Create metadata with ID
    const metadata: NodeMetadata = {
      ...node.metadata,
      id: nodeId,
    }

    // Add node through CRDT
    const addedNodeId = store.addNode(metadata, node.position)

    // Update property values if provided
    if (node.metadata.propertyValues) {
      Object.entries(node.metadata.propertyValues).forEach(([key, value]) => {
        store.updateNodeProperty(addedNodeId, key, value)
      })
    }

    return {
      id: addedNodeId,
      metadata: { ...metadata, propertyValues: node.metadata.propertyValues || {} },
      position: node.position,
    }
  }

  /**
   * Create a node group using CRDT
   */
  static async createNodeGroup(
    workflowId: string,
    graphId: string,
    group: Omit<WorkflowGroup, 'id'>
  ): Promise<WorkflowGroup> {
    await this.ensureInitialized(workflowId)
    const store = useWorkflowStore.getState()

    // Switch to the target graph if needed
    if (store.currentGraphId !== graphId) {
      store.switchGraph(graphId)
    }

    // Create group through CRDT
    const groupId = store.createGroup(group.title, group.nodeIds, group.color)

    // Get the created group
    const createdGroup = store.groups.find(g => g.id === groupId)
    if (!createdGroup) {
      throw new Error('Failed to create group')
    }

    // Update description if provided
    if (group.description) {
      store.updateGroup(groupId, { description: group.description })
    }

    return {
      id: groupId,
      title: createdGroup.title,
      description: createdGroup.description,
      nodeIds: createdGroup.nodeIds,
      position: createdGroup.position,
      size: createdGroup.size,
      color: createdGroup.color,
      collapsed: createdGroup.isCollapsed,
    }
  }

  /**
   * Create a subgraph using CRDT
   */
  static async createSubgraph(
    workflowId: string,
    subgraph: {
      name: string
      description?: string
      inputs?: Array<{ id: string; name: string; type: string }>
      outputs?: Array<{ id: string; name: string; type: string }>
    }
  ): Promise<string> {
    await this.ensureInitialized(workflowId)
    const store = useWorkflowStore.getState()

    // Create new graph for the subgraph
    const subgraphId = store.addGraph(subgraph.name)

    // Switch to the new subgraph
    store.switchGraph(subgraphId)

    // Add input nodes if specified
    if (subgraph.inputs) {
      for (let i = 0; i < subgraph.inputs.length; i++) {
        const input = subgraph.inputs[i]
        const inputMetadata: NodeMetadata = {
          id: input.id,
          type: 'subgraph-input',
          title: input.name,
          icon: 'LogIn',
          category: 'graph-io',
          variant: 'blue-600',
          shape: 'circle',
          size: 'medium',
          inputs: [],
          outputs: [
            {
              id: 'output',
              name: input.name,
              type: input.type,
            },
          ],
          properties: {},
        }
        store.addNode(inputMetadata, { x: 100, y: 100 + i * 150 })
      }
    }

    // Add output nodes if specified
    if (subgraph.outputs) {
      for (let i = 0; i < subgraph.outputs.length; i++) {
        const output = subgraph.outputs[i]
        const outputMetadata: NodeMetadata = {
          id: output.id,
          type: 'subgraph-output',
          title: output.name,
          icon: 'LogOut',
          category: 'graph-io',
          variant: 'green-600',
          shape: 'circle',
          size: 'medium',
          inputs: [
            {
              id: 'input',
              name: output.name,
              type: output.type,
            },
          ],
          outputs: [],
          properties: {},
        }
        store.addNode(outputMetadata, { x: 500, y: 100 + i * 150 })
      }
    }

    // Switch back to main graph
    store.switchGraph('main')

    return subgraphId
  }

  /**
   * Create a connection between nodes using CRDT
   */
  static async connectNodes(
    workflowId: string,
    graphId: string,
    connection: Omit<WorkflowConnection, 'id'>
  ): Promise<WorkflowConnection> {
    await this.ensureInitialized(workflowId)
    const store = useWorkflowStore.getState()

    // Switch to the target graph if needed
    if (store.currentGraphId !== graphId) {
      store.switchGraph(graphId)
    }

    // Verify nodes exist
    const nodes = store.nodes
    const sourceNode = nodes.find(
      n => ((n as any).id || n.metadata.id) === connection.source.nodeId
    )
    const targetNode = nodes.find(
      n => ((n as any).id || n.metadata.id) === connection.target.nodeId
    )

    if (!sourceNode || !targetNode) {
      throw new Error('Source or target node not found')
    }

    // Create connection through CRDT
    const connectionObj: WorkflowConnection = {
      id: `conn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,

      source: {
        nodeId: connection.source.nodeId,
        portId: connection.source.portId,
      },
      target: {
        nodeId: connection.target.nodeId,
        portId: connection.target.portId,
      },
      state: 'pending',
    }

    store.addConnection(connectionObj)

    return connectionObj
  }

  /**
   * List nodes in a workflow graph using CRDT
   */
  static async listNodes(workflowId: string, graphId: string): Promise<WorkflowNode[]> {
    await this.ensureInitialized(workflowId)
    const store = useWorkflowStore.getState()

    // Get nodes for the specified graph
    const graphData = store.getAllGraphsData().find(g => g.id === graphId)
    if (!graphData) {
      return []
    }

    return graphData.nodes.map(node => ({
      id: (node as any).id || node.metadata.id,
      metadata: node.metadata,
      position: node.position,
      propertyValues: (node as any).propertyValues || {},
    }))
  }

  /**
   * Remove a node using CRDT
   */
  static async removeNode(workflowId: string, graphId: string, nodeId: string): Promise<void> {
    await this.ensureInitialized(workflowId)
    const store = useWorkflowStore.getState()

    // Switch to the target graph if needed
    if (store.currentGraphId !== graphId) {
      store.switchGraph(graphId)
    }

    store.removeNode(nodeId)
  }

  /**
   * Remove a connection using CRDT
   */
  static async removeConnection(
    workflowId: string,
    graphId: string,
    connectionId: string
  ): Promise<void> {
    await this.ensureInitialized(workflowId)
    const store = useWorkflowStore.getState()

    // Switch to the target graph if needed
    if (store.currentGraphId !== graphId) {
      store.switchGraph(graphId)
    }

    store.removeConnection(connectionId)
  }

  /**
   * Update property values of an existing node using CRDT
   */
  static async updateNodeProperties(
    workflowId: string,
    graphId: string,
    nodeId: string,
    propertyValues: Record<string, any>
  ): Promise<WorkflowNode> {
    await this.ensureInitialized(workflowId)
    const store = useWorkflowStore.getState()

    // Switch to the target graph if needed
    if (store.currentGraphId !== graphId) {
      store.switchGraph(graphId)
    }

    // Get the node from the array
    const node = store.nodes.find(n => n.metadata.id === nodeId)
    if (!node) {
      throw new Error(`Node ${nodeId} not found`)
    }

    // Update each property individually through CRDT for real-time sync
    // This ensures proper propagation to all connected clients
    for (const [property, value] of Object.entries(propertyValues)) {
      store.updateNodeProperty(nodeId, property, value)
    }

    // Also update the metadata to ensure consistency
    const updatedMetadata = {
      ...node.metadata,
      propertyValues: {
        ...(node.metadata.propertyValues || {}),
        ...propertyValues,
      },
    }
    
    // Use updateNodeMetadata with saveSnapshot=true to trigger updates
    store.updateNodeMetadata(nodeId, updatedMetadata, true)

    return {
      id: nodeId,
      metadata: updatedMetadata,
      position: node.position,
    }
  }

  /**
   * Update position of an existing node using CRDT (alias for updateNodePosition)
   */
  static async updateNodePosition(
    workflowId: string,
    graphId: string,
    nodeId: string,
    position: { x: number; y: number }
  ): Promise<WorkflowNode> {
    await this.ensureInitialized(workflowId)
    const store = useWorkflowStore.getState()

    // Switch to the target graph if needed
    if (store.currentGraphId !== graphId) {
      store.switchGraph(graphId)
    }

    store.updateNodePosition(nodeId, position)

    // Get the updated node from the array
    const node = store.nodes.find(n => n.metadata.id === nodeId)
    if (!node) {
      throw new Error(`Node ${nodeId} not found`)
    }

    return {
      id: nodeId,
      metadata: node.metadata,
      position: node.position,
    }
  }

  /**
   * Update properties of an existing group using CRDT
   */
  static async updateGroupProperties(
    workflowId: string,
    graphId: string,
    groupId: string,
    updates: Partial<WorkflowGroup>
  ): Promise<WorkflowGroup> {
    await this.ensureInitialized(workflowId)
    const store = useWorkflowStore.getState()

    // Switch to the target graph if needed
    if (store.currentGraphId !== graphId) {
      store.switchGraph(graphId)
    }

    // Get the group from the array
    const group = store.groups.find(g => g.id === groupId)
    if (!group) {
      throw new Error(`Group ${groupId} not found`)
    }

    // Update the group using store method
    const updatedGroup = {
      ...group,
      ...updates,
      id: groupId, // Ensure ID doesn't change
    }

    store.updateGroup(groupId, updatedGroup)

    return updatedGroup
  }
}
