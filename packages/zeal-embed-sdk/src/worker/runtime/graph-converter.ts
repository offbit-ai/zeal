/**
 * Converts WorkflowGraph to Reflow Graph format
 */

import { Graph } from '@offbit-ai/reflow/wasm';
import { WorkflowGraph, SerializedNode, NodeTemplate, SerializedConnection, SerializedGroup } from '../../types';

export interface ReflowGraphData {
  id: string;
  name: string;
  nodes: ReflowNode[];
  edges: ReflowEdge[];
  metadata?: Record<string, any>;
}

export interface ReflowNode {
  id: string;
  type: string; // Template ID / Actor type
  data: any;
  position?: { x: number; y: number };
}

export interface ReflowEdge {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
  data?: any;
}

export class WorkflowToReflowConverter {
  /**
   * Convert WorkflowGraph to Reflow Graph
   */
  convert(
    workflow: WorkflowGraph,
    templateRegistry: Map<string, NodeTemplate>
  ): Graph {
    // Create Reflow graph
    const graph = new Graph(workflow.id, true, {
      id: workflow.id,
      name: workflow.name,
      namespace: workflow.namespace,
      isMain: workflow.isMain,
      canvasState: workflow.canvasState,
      groups: workflow.groups
    });
    
   
    
    // Convert and add nodes
    for (const node of workflow.nodes) {
      // Get template from registry using templateId in metadata
      const templateId = node.metadata.templateId || node.type;
      const template = templateRegistry.get(templateId);
      
      if (!template) {
        console.warn(`Template ${templateId} not found for node ${node.id}`);
        continue;
      }
      
      this.addNode(graph, node, template);
    }
    
    // Convert and add connections
    for (const connection of workflow.connections) {
      this.addConnection(graph, connection);
    }
    
    return graph;
  }
  
  /**
   * Add a node to the Reflow graph
   */
  private addNode(
    graph: Graph,
    node: SerializedNode,
    template: NodeTemplate
  ): void {
    // Node data includes all context needed for execution
    const nodeData = {
      // Identity
      nodeId: node.id,
      templateId: node.metadata.templateId || node.type,
      
      // Properties from serialized node
      properties: this.mergeProperties(
        template.properties || {},
        node.metadata.propertyValues || {}
      ),
      
      // Port configuration from node metadata
      ports: node.metadata.ports,
      
      // Full metadata
      metadata: {
        ...node.metadata,
        position: node.position
      },
      
      // Runtime configuration from template
      config: {
        executor: template.runtime?.executor || 'default',
        requiredEnvVars: node.metadata.requiredEnvVars
      }
    };
    
    // Add node to graph
    // Actor type is the template ID
    graph.addNode(node.id, nodeData.templateId, nodeData);
  }
  
  /**
   * Add a connection to the Reflow graph
   */
  private addConnection(
    graph: Graph,
    connection: SerializedConnection
  ): void {
    // Connection data
    const connectionData = {
      id: connection.id,
      state: connection.state,
      metadata: connection.metadata || {}
    };
    
    // Add edge to graph
    graph.addConnection(
      connection.source.nodeId,
      connection.source.portId,
      connection.target.nodeId,
      connection.target.portId,
      connectionData
    );
  }
  
  /**
   * Merge template properties with node overrides
   */
  private mergeProperties(
    templateProps: Record<string, any>,
    nodeProps: Record<string, any>
  ): Record<string, any> {
    const merged = { ...templateProps };
    
    // Apply node overrides
    for (const [key, value] of Object.entries(nodeProps)) {
      // Deep merge for objects
      if (typeof value === 'object' && 
          value !== null && 
          !Array.isArray(value) &&
          typeof merged[key] === 'object' &&
          merged[key] !== null &&
          !Array.isArray(merged[key])) {
        merged[key] = {
          ...merged[key],
          ...value
        };
      } else {
        // Direct override for primitives and arrays
        merged[key] = value;
      }
    }
    
    return merged;
  }
  
  /**
   * Create port configuration map from SerializedNode ports
   */
  private createPortMap(
    nodePorts: Array<{
      id: string
      label: string
      type: 'input' | 'output'
      position: 'top' | 'right' | 'bottom' | 'left'
    }>,
    propertyValues?: Record<string, any>
  ): Record<string, any> {
    const ports: Record<string, any> = {};
    
    for (const port of nodePorts) {
      ports[port.id] = {
        label: port.label,
        type: port.type,
        position: port.position,
        value: propertyValues?.[port.id],
        required: false
      };
    }
    
    return ports;
  }
  
  /**
   * Convert graph data to Reflow Graph
   */
  fromGraphData(data: ReflowGraphData): Graph {
    const graph = new Graph(data.id, true, {});
    
    // Set metadata
    graph.setProperties({
      id: data.id,
      name: data.name,
      ...data.metadata
    });
    
    // Add nodes
    for (const node of data.nodes) {
      graph.addNode(node.id, node.type, node.data);
    }
    
    // Add edges
    for (const edge of data.edges) {
      graph.addConnection(
        edge.source,
        edge.sourceHandle,
        edge.target,
        edge.targetHandle,
        edge.data
      );
    }
    
    return graph;
  }
  
  /**
   * Export graph to JSON-serializable format
   */
  toGraphData(graph: Graph): ReflowGraphData {
    const nodes: ReflowNode[] = [];
    const edges: ReflowEdge[] = [];
    
    // Extract nodes
    const graphNodes = graph.getNodes();
    for (const node of graphNodes) {
      nodes.push({
        id: node.id,
        type: node.type,
        data: node.data,
        position: node.data?.metadata?.position
      });
    }
    
    // Extract edges
    const graphEdges = graph.getConnections();
    for (const edge of graphEdges) {
      edges.push({
        id: edge.id || `${edge.source}-${edge.target}`,
        source: edge.source,
        sourceHandle: edge.sourcePort,
        target: edge.target,
        targetHandle: edge.targetPort,
        data: edge.data
      });
    }
    
    return {
      id: graph.getProperties()?.id || 'unknown',
      name: graph.getProperties()?.name || 'Unnamed',
      nodes,
      edges,
      metadata: graph.getProperties()
    };
  }
}