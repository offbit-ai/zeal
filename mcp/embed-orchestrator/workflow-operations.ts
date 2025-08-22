/**
 * Workflow operations for the MCP server
 * Handles the actual modification of workflow data
 */

import { getDatabaseOperations } from '../../lib/database'
// import { generateId, generateSnapshotId } from '../../lib/database'

export interface WorkflowNode {
  id: string
  metadata: any
  position: { x: number; y: number }
}

export interface WorkflowConnection {
  id: string
  source: {
    nodeId: string
    portId: string
  }
  target: {
    nodeId: string
    portId: string
  }
  state?: 'pending' | 'warning' | 'error' | 'success' | 'running'
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

export class WorkflowOperations {
  /**
   * Add a node to a workflow graph
   */
  static async addNode(
    workflowId: string,
    graphId: string,
    node: Omit<WorkflowNode, 'id'>
  ): Promise<WorkflowNode> {
    const db = await getDatabaseOperations()

    // Get the latest snapshot for this workflow
    const snapshots = await db.listWorkflowSnapshots(workflowId)
    const latestSnapshot = snapshots.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0]

    if (!latestSnapshot) {
      throw new Error('No snapshot found for workflow')
    }

    // Parse graphs if stored as JSON string
    const graphs =
      typeof latestSnapshot.graphs === 'string'
        ? JSON.parse(latestSnapshot.graphs)
        : latestSnapshot.graphs || []

    // Find or create the target graph
    let graph = graphs.find((g: WorkflowGraph) => g.id === graphId)
    if (!graph) {
      graph = {
        id: graphId,
        name: graphId === 'main' ? 'Main' : graphId,
        nodes: [],
        connections: [],
        groups: [],
      }
      graphs.push(graph)
    }

    // Create the new node
    const newNode: WorkflowNode = {
      id:
        node.metadata.id ||
        `${node.metadata.type}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      ...node,
    }

    // Add node to graph
    graph.nodes.push(newNode)

    // Update the snapshot
    await db.updateWorkflowSnapshot(latestSnapshot.id, {
      graphs: JSON.stringify(graphs),
      updatedAt: new Date().toISOString(),
      saveCount: (latestSnapshot.saveCount || 0) + 1,
    })

    return newNode
  }

  /**
   * Create a node group
   */
  static async createNodeGroup(
    workflowId: string,
    graphId: string,
    group: Omit<WorkflowGroup, 'id'>
  ): Promise<WorkflowGroup> {
    const db = await getDatabaseOperations()

    // Get the latest snapshot
    const snapshots = await db.listWorkflowSnapshots(workflowId)
    const latestSnapshot = snapshots.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0]

    if (!latestSnapshot) {
      throw new Error('No snapshot found for workflow')
    }

    const graphs =
      typeof latestSnapshot.graphs === 'string'
        ? JSON.parse(latestSnapshot.graphs)
        : latestSnapshot.graphs || []

    const graph = graphs.find((g: WorkflowGraph) => g.id === graphId)
    if (!graph) {
      throw new Error('Graph not found')
    }

    // Calculate group position and size based on included nodes
    const groupNodes = graph.nodes.filter((n: WorkflowNode) => group.nodeIds.includes(n.id))

    if (groupNodes.length === 0) {
      throw new Error('No valid nodes found for group')
    }

    // Calculate bounding box
    const xs = groupNodes.map((n: any) => n.position.x)
    const ys = groupNodes.map((n: any) => n.position.y)
    const minX = Math.min(...xs) - 20
    const minY = Math.min(...ys) - 40
    const maxX = Math.max(...xs) + 200
    const maxY = Math.max(...ys) + 100

    const newGroup: WorkflowGroup = {
      id: `group-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      position: { x: minX, y: minY },
      size: { width: maxX - minX, height: maxY - minY },
      ...group,
    }

    // Add group to graph
    if (!graph.groups) {
      graph.groups = []
    }
    graph.groups.push(newGroup)

    // Update the snapshot
    await db.updateWorkflowSnapshot(latestSnapshot.id, {
      graphs: JSON.stringify(graphs),
      updatedAt: new Date().toISOString(),
      saveCount: (latestSnapshot.saveCount || 0) + 1,
    })

    return newGroup
  }

  /**
   * Create a subgraph
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
    const db = await getDatabaseOperations()

    // Get the latest snapshot
    const snapshots = await db.listWorkflowSnapshots(workflowId)
    const latestSnapshot = snapshots.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0]

    if (!latestSnapshot) {
      throw new Error('No snapshot found for workflow')
    }

    const graphs =
      typeof latestSnapshot.graphs === 'string'
        ? JSON.parse(latestSnapshot.graphs)
        : latestSnapshot.graphs || []

    // Generate subgraph ID
    const subgraphId = `subgraph-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

    // Create new graph for the subgraph
    const newGraph: WorkflowGraph = {
      id: subgraphId,
      name: subgraph.name,
      nodes: [],
      connections: [],
      groups: [],
    }

    // Add input/output nodes if specified
    if (subgraph.inputs) {
      subgraph.inputs.forEach((input, index) => {
        newGraph.nodes.push({
          id: input.id,
          metadata: {
            type: 'subgraph-input',
            title: input.name,
            icon: 'input',
            category: 'graph-io',
            outputs: [
              {
                id: 'output',
                name: input.name,
                type: input.type,
              },
            ],
          },
          position: { x: 100, y: 100 + index * 150 },
        })
      })
    }

    if (subgraph.outputs) {
      subgraph.outputs.forEach((output, index) => {
        newGraph.nodes.push({
          id: output.id,
          metadata: {
            type: 'subgraph-output',
            title: output.name,
            icon: 'output',
            category: 'graph-io',
            inputs: [
              {
                id: 'input',
                name: output.name,
                type: output.type,
              },
            ],
          },
          position: { x: 500, y: 100 + index * 150 },
        })
      })
    }

    graphs.push(newGraph)

    // Update the snapshot
    await db.updateWorkflowSnapshot(latestSnapshot.id, {
      graphs: JSON.stringify(graphs),
      updatedAt: new Date().toISOString(),
      saveCount: (latestSnapshot.saveCount || 0) + 1,
    })

    return subgraphId
  }

  /**
   * Create a connection between nodes
   */
  static async connectNodes(
    workflowId: string,
    graphId: string,
    connection: Omit<WorkflowConnection, 'id'>
  ): Promise<WorkflowConnection> {
    const db = await getDatabaseOperations()

    // Get the latest snapshot
    const snapshots = await db.listWorkflowSnapshots(workflowId)
    const latestSnapshot = snapshots.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0]

    if (!latestSnapshot) {
      throw new Error('No snapshot found for workflow')
    }

    const graphs =
      typeof latestSnapshot.graphs === 'string'
        ? JSON.parse(latestSnapshot.graphs)
        : latestSnapshot.graphs || []

    const graph = graphs.find((g: WorkflowGraph) => g.id === graphId)
    if (!graph) {
      throw new Error('Graph not found')
    }

    // Verify nodes exist
    const sourceNode = graph.nodes.find((n: WorkflowNode) => n.id === connection.source.nodeId)
    const targetNode = graph.nodes.find((n: WorkflowNode) => n.id === connection.target.nodeId)

    if (!sourceNode || !targetNode) {
      throw new Error('Source or target node not found')
    }

    // Create connection
    const newConnection: WorkflowConnection = {
      id: `conn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      ...connection,
    }

    if (!graph.connections) {
      graph.connections = []
    }
    graph.connections.push(newConnection)

    // Update the snapshot
    await db.updateWorkflowSnapshot(latestSnapshot.id, {
      graphs: JSON.stringify(graphs),
      updatedAt: new Date().toISOString(),
      saveCount: (latestSnapshot.saveCount || 0) + 1,
    })

    return newConnection
  }

  /**
   * List nodes in a workflow graph
   */
  static async listNodes(workflowId: string, graphId: string): Promise<WorkflowNode[]> {
    const db = await getDatabaseOperations()

    // Get the latest snapshot
    const snapshots = await db.listWorkflowSnapshots(workflowId)
    const latestSnapshot = snapshots.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0]

    if (!latestSnapshot) {
      return []
    }

    const graphs =
      typeof latestSnapshot.graphs === 'string'
        ? JSON.parse(latestSnapshot.graphs)
        : latestSnapshot.graphs || []

    const graph = graphs.find((g: WorkflowGraph) => g.id === graphId)
    if (!graph) {
      return []
    }

    return graph.nodes || []
  }

  /**
   * Update property values of an existing node
   */
  static async updateNodeProperties(
    workflowId: string,
    graphId: string,
    nodeId: string,
    propertyValues: Record<string, any>
  ): Promise<WorkflowNode> {
    const db = await getDatabaseOperations()

    // Get the latest snapshot for this workflow
    const snapshots = await db.listWorkflowSnapshots(workflowId)
    const latestSnapshot = snapshots.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0]

    if (!latestSnapshot) {
      throw new Error('No snapshot found for workflow')
    }

    // Parse graphs if stored as JSON string
    const graphs =
      typeof latestSnapshot.graphs === 'string'
        ? JSON.parse(latestSnapshot.graphs)
        : latestSnapshot.graphs || []

    // Find the target graph
    const graph = graphs.find((g: WorkflowGraph) => g.id === graphId)
    if (!graph) {
      throw new Error(`Graph ${graphId} not found`)
    }

    // Find the node
    const nodeIndex = graph.nodes.findIndex((n: WorkflowNode) => n.id === nodeId)
    if (nodeIndex === -1) {
      throw new Error(`Node ${nodeId} not found`)
    }

    // Update the node's propertyValues (merge with existing)
    const node = graph.nodes[nodeIndex]
    node.metadata = {
      ...node.metadata,
      propertyValues: {
        ...(node.metadata.propertyValues || {}),
        ...propertyValues,
      },
    }

    // Update the snapshot
    await db.updateWorkflowSnapshot(latestSnapshot.id, {
      graphs: JSON.stringify(graphs),
      updatedAt: new Date().toISOString(),
    })

    return node
  }

  /**
   * Update position of an existing node
   */
  static async updateNodePosition(
    workflowId: string,
    graphId: string,
    nodeId: string,
    position: { x: number; y: number }
  ): Promise<WorkflowNode> {
    const db = await getDatabaseOperations()

    // Get the latest snapshot for this workflow
    const snapshots = await db.listWorkflowSnapshots(workflowId)
    const latestSnapshot = snapshots.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0]

    if (!latestSnapshot) {
      throw new Error('No snapshot found for workflow')
    }

    // Parse graphs if stored as JSON string
    const graphs =
      typeof latestSnapshot.graphs === 'string'
        ? JSON.parse(latestSnapshot.graphs)
        : latestSnapshot.graphs || []

    // Find the target graph
    const graph = graphs.find((g: WorkflowGraph) => g.id === graphId)
    if (!graph) {
      throw new Error(`Graph ${graphId} not found`)
    }

    // Find the node
    const nodeIndex = graph.nodes.findIndex((n: WorkflowNode) => n.id === nodeId)
    if (nodeIndex === -1) {
      throw new Error(`Node ${nodeId} not found`)
    }

    // Update the node's position
    graph.nodes[nodeIndex].position = position

    // Update the snapshot
    await db.updateWorkflowSnapshot(latestSnapshot.id, {
      graphs: JSON.stringify(graphs),
      updatedAt: new Date().toISOString(),
    })

    return graph.nodes[nodeIndex]
  }

  /**
   * Update properties of an existing group
   */
  static async updateGroupProperties(
    workflowId: string,
    graphId: string,
    groupId: string,
    updates: Partial<WorkflowGroup>
  ): Promise<WorkflowGroup> {
    const db = await getDatabaseOperations()

    // Get the latest snapshot for this workflow
    const snapshots = await db.listWorkflowSnapshots(workflowId)
    const latestSnapshot = snapshots.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0]

    if (!latestSnapshot) {
      throw new Error('No snapshot found for workflow')
    }

    // Parse graphs if stored as JSON string
    const graphs =
      typeof latestSnapshot.graphs === 'string'
        ? JSON.parse(latestSnapshot.graphs)
        : latestSnapshot.graphs || []

    // Find the target graph
    const graph = graphs.find((g: WorkflowGraph) => g.id === graphId)
    if (!graph) {
      throw new Error(`Graph ${graphId} not found`)
    }

    // Initialize groups array if it doesn't exist
    if (!graph.groups) {
      graph.groups = []
    }

    // Find the group
    const groupIndex = graph.groups.findIndex((g: WorkflowGroup) => g.id === groupId)
    if (groupIndex === -1) {
      throw new Error(`Group ${groupId} not found`)
    }

    // Update the group properties
    graph.groups[groupIndex] = {
      ...graph.groups[groupIndex],
      ...updates,
      id: groupId, // Ensure ID doesn't change
    }

    // Update the snapshot
    await db.updateWorkflowSnapshot(latestSnapshot.id, {
      graphs: JSON.stringify(graphs),
      updatedAt: new Date().toISOString(),
    })

    return graph.groups[groupIndex]
  }
}
