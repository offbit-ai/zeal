/**
 * GraphRAG Integration for AI-powered workflow operations
 * Leverages the knowledge graph for intelligent node selection and workflow design
 */

import Graph from 'graphology';
import { GraphRAGEngine, GraphRAGIntent } from '../../../../lib/knowledge-graph/graphrag-engine';
import { ZIPBridge } from '../../../shared/zip-bridge';
import path from 'path';
import fs from 'fs/promises';

export class GraphRAGIntegration {
  private graphragEngine: GraphRAGEngine | null = null;
  private graph: Graph;
  private graphSnapshot: any = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(
    private zipBridge: ZIPBridge,
    private llm: any,
    private embeddings?: any
  ) {
    this.graph = new Graph({ multi: true, type: 'directed' });
  }

  /**
   * Initialize the GraphRAG engine
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInitialize();
    await this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      console.log('🚀 Initializing GraphRAG integration...');

      // Load the graph snapshot
      await this.loadGraphSnapshot();

      // Initialize the GraphRAG engine
      this.graphragEngine = new GraphRAGEngine(
        this.graph,
        this.llm,
        this.embeddings
      );

      this.initialized = true;
      console.log('✅ GraphRAG integration initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize GraphRAG:', error);
      throw error;
    }
  }

  /**
   * Load the GraphRAG snapshot
   */
  private async loadGraphSnapshot(): Promise<void> {
    try {
      // Try to load from file system first (server-side)
      const snapshotPath = path.join(process.cwd(), 'data', 'graphrag-snapshot.json');
      const snapshotData = await fs.readFile(snapshotPath, 'utf8');
      this.graphSnapshot = JSON.parse(snapshotData);
      
      // Build the graph from snapshot
      this.buildGraphFromSnapshot();
      
      console.log(`📊 Loaded GraphRAG snapshot with ${this.graphSnapshot.nodes.length} nodes`);
    } catch (error) {
      console.warn('⚠️ Could not load graphrag-snapshot.json from file system:', error);
      
      // Try to fetch from HTTP endpoint
      try {
        const response = await fetch('/graphrag-snapshot.json');
        if (response.ok) {
          this.graphSnapshot = await response.json();
          this.buildGraphFromSnapshot();
          console.log(`📊 Loaded GraphRAG snapshot via HTTP with ${this.graphSnapshot.nodes.length} nodes`);
        }
      } catch (fetchError) {
        console.error('❌ Could not load GraphRAG snapshot:', fetchError);
        throw new Error('GraphRAG snapshot not available');
      }
    }
  }

  /**
   * Build the graph from the loaded snapshot
   */
  private buildGraphFromSnapshot(): void {
    if (!this.graphSnapshot) return;

    // Clear existing graph
    this.graph.clear();

    // Add nodes
    this.graphSnapshot.nodes.forEach((node: any) => {
      this.graph.addNode(node.id, node.attributes);
    });

    // Add edges
    this.graphSnapshot.edges.forEach((edge: any) => {
      this.graph.addEdge(edge.source, edge.target, edge.attributes);
    });

    console.log(`📊 Built graph with ${this.graph.order} nodes and ${this.graph.size} edges`);
  }

  /**
   * Find relevant nodes for a workflow based on description
   */
  async findRelevantNodes(description: string): Promise<any[]> {
    await this.initialize();
    
    if (!this.graphragEngine) {
      throw new Error('GraphRAG engine not initialized');
    }

    // Extract intent from description
    const intent = await this.graphragEngine.extractIntent(description);
    console.log('📝 Extracted intent:', intent);

    // Find relevant nodes
    const relevantNodes = await this.graphragEngine.findRelevantNodes(description, intent);
    console.log(`🔍 Found ${relevantNodes.length} relevant nodes`);

    // Prevent duplicates
    const uniqueNodes = await this.graphragEngine.preventDuplicates(relevantNodes);
    console.log(`✨ Filtered to ${uniqueNodes.length} unique nodes`);

    // Convert to template format
    const templates = uniqueNodes.map(node => {
      const graphNode = this.graph.getNodeAttributes(node.nodeId);
      return {
        id: node.nodeId,
        template: graphNode?.data || {},
        relevance: node.score,
        reasons: node.reasons,
        metadata: node.metadata
      };
    });

    return templates;
  }

  /**
   * Generate optimal connections for selected nodes
   */
  async generateConnections(nodes: any[]): Promise<any[]> {
    await this.initialize();
    
    if (!this.graphragEngine) {
      throw new Error('GraphRAG engine not initialized');
    }

    // Convert to RelevanceScore format
    const relevanceScores = nodes.map(node => ({
      nodeId: node.id || node.nodeId,
      score: node.relevance || 80,
      reasons: node.reasons || [],
      connections: [],
      metadata: node.metadata || {}
    }));

    // Find optimal connections
    const connections = await this.graphragEngine.findOptimalConnections(relevanceScores);
    console.log(`🔗 Generated ${connections.length} connections`);

    return connections;
  }

  /**
   * Analyze a workflow request and design a complete workflow
   */
  async designWorkflow(requirements: {
    description: string;
    complexity?: 'simple' | 'moderate' | 'complex';
    includeErrorHandling?: boolean;
    includeValidation?: boolean;
  }): Promise<{
    nodes: any[];
    connections: any[];
    metadata: any;
  }> {
    await this.initialize();

    const { description, complexity = 'moderate', includeErrorHandling = true } = requirements;

    // Find relevant nodes using GraphRAG
    const relevantNodes = await this.findRelevantNodes(description);

    if (relevantNodes.length === 0) {
      console.warn('⚠️ No relevant nodes found, using fallback approach');
      return {
        nodes: [],
        connections: [],
        metadata: {
          error: 'No relevant nodes found for the given requirements',
          suggestion: 'Try providing more specific requirements or ensure templates are loaded'
        }
      };
    }

    // Generate positions for nodes
    const nodes = relevantNodes.map((node, index) => ({
      id: node.id,
      type: node.template.type || node.id,
      position: {
        x: 100 + (index * 250),
        y: 100 + (Math.floor(index / 4) * 150)
      },
      config: node.template.properties || {},
      metadata: {
        ...node.metadata,
        relevance: node.relevance,
        reasons: node.reasons,
        autoGenerated: true
      }
    }));

    // Add error handler if requested
    if (includeErrorHandling) {
      nodes.push({
        id: 'error_handler',
        type: 'error_handler',
        position: {
          x: 100,
          y: 400
        },
        config: {
          retryAttempts: 3,
          retryDelay: 1000,
          fallbackAction: 'log'
        },
        metadata: {
          autoGenerated: true,
          purpose: 'error_handling'
        }
      });
    }

    // Generate connections
    const connections = await this.generateConnections(nodes);

    return {
      nodes,
      connections,
      metadata: {
        designedBy: 'GraphRAG',
        nodeCount: nodes.length,
        connectionCount: connections.length,
        complexity,
        includesErrorHandling: includeErrorHandling,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Suggest node improvements based on GraphRAG analysis
   */
  async suggestNodeImprovements(workflowId: string): Promise<any[]> {
    await this.initialize();

    // Get current workflow
    const workflow = await this.zipBridge.getWorkflow(workflowId);
    const currentNodes = workflow.graph?.nodes || [];

    if (currentNodes.length === 0) {
      return [];
    }

    const suggestions: any[] = [];

    // Analyze each node for potential improvements
    for (const node of currentNodes) {
      // Check if there are better alternatives
      const alternatives = await this.findAlternatives(node);
      if (alternatives.length > 0) {
        suggestions.push({
          nodeId: node.id,
          type: 'alternative',
          current: node.type,
          suggested: alternatives[0].id,
          reason: `${alternatives[0].template.title} may be more suitable`,
          confidence: alternatives[0].relevance
        });
      }

      // Check for missing complementary nodes
      const complementary = await this.findComplementaryNodes(node);
      if (complementary.length > 0) {
        suggestions.push({
          nodeId: node.id,
          type: 'complementary',
          suggested: complementary[0].id,
          reason: `Consider adding ${complementary[0].template.title} for better workflow`,
          confidence: complementary[0].relevance
        });
      }
    }

    return suggestions;
  }

  /**
   * Find alternative nodes for a given node
   */
  private async findAlternatives(node: any): Promise<any[]> {
    if (!this.graphSnapshot) return [];

    const alternatives: any[] = [];
    
    // Find nodes marked as alternatives in the graph
    const nodeEdges = this.graphSnapshot.edges.filter(
      (edge: any) => 
        edge.source === node.type && 
        edge.attributes.type === 'ALTERNATIVE_TO'
    );

    for (const edge of nodeEdges) {
      const altNode = this.graphSnapshot.nodes.find(
        (n: any) => n.id === edge.target
      );
      
      if (altNode) {
        alternatives.push({
          id: altNode.id,
          template: altNode.attributes.data,
          relevance: 0.8
        });
      }
    }

    return alternatives;
  }

  /**
   * Find complementary nodes that work well with a given node
   */
  private async findComplementaryNodes(node: any): Promise<any[]> {
    if (!this.graphSnapshot) return [];

    const complementary: any[] = [];
    
    // Find nodes commonly used together
    const nodeEdges = this.graphSnapshot.edges.filter(
      (edge: any) => 
        edge.source === node.type && 
        edge.attributes.type === 'COMMONLY_USED_WITH'
    );

    for (const edge of nodeEdges) {
      const compNode = this.graphSnapshot.nodes.find(
        (n: any) => n.id === edge.target
      );
      
      if (compNode) {
        complementary.push({
          id: compNode.id,
          template: compNode.attributes.data,
          relevance: edge.attributes.data?.confidence || 0.7
        });
      }
    }

    return complementary;
  }

  /**
   * Analyze workflow for optimization opportunities using GraphRAG
   */
  async analyzeForOptimization(workflowId: string): Promise<{
    bottlenecks: any[];
    redundancies: any[];
    missingCapabilities: any[];
  }> {
    await this.initialize();

    const workflow = await this.zipBridge.getWorkflow(workflowId);
    const nodes = workflow.graph?.nodes || [];
    const connections = workflow.graph?.connections || [];

    const bottlenecks: any[] = [];
    const redundancies: any[] = [];
    const missingCapabilities: any[] = [];

    // Analyze for redundancies
    const nodesByType = new Map<string, any[]>();
    nodes.forEach((node: any) => {
      if (!nodesByType.has(node.type)) {
        nodesByType.set(node.type, []);
      }
      nodesByType.get(node.type)!.push(node);
    });

    // Check for duplicate capabilities
    for (const [type, similarNodes] of nodesByType.entries()) {
      if (similarNodes.length > 1) {
        // Check if they serve the same purpose
        const capabilities = await this.getNodeCapabilities(type);
        if (capabilities.length > 0) {
          redundancies.push({
            type: 'duplicate_capability',
            nodes: similarNodes.map(n => n.id),
            capability: capabilities[0],
            suggestion: 'Consider consolidating these nodes'
          });
        }
      }
    }

    // Analyze for missing capabilities
    const workflowCapabilities = new Set<string>();
    for (const node of nodes) {
      const caps = await this.getNodeCapabilities(node.type);
      caps.forEach(cap => workflowCapabilities.add(cap));
    }

    // Check if common patterns are missing important capabilities
    if (workflowCapabilities.has('send_message') && !workflowCapabilities.has('error_handler')) {
      missingCapabilities.push({
        capability: 'error_handler',
        reason: 'Workflows with external communications should handle errors',
        suggestion: 'Add error handling for robustness'
      });
    }

    return {
      bottlenecks,
      redundancies,
      missingCapabilities
    };
  }

  /**
   * Get capabilities of a node type from the graph
   */
  private async getNodeCapabilities(nodeType: string): Promise<string[]> {
    if (!this.graphSnapshot) return [];

    const node = this.graphSnapshot.nodes.find(
      (n: any) => n.id === nodeType && n.attributes?.type === 'template'
    );

    if (node?.attributes?.data?.capabilities) {
      return node.attributes.data.capabilities;
    }

    // Extract capabilities from edges
    const capabilities: string[] = [];
    const capabilityEdges = this.graphSnapshot.edges.filter(
      (edge: any) => 
        edge.source === nodeType && 
        edge.attributes.type === 'HAS_CAPABILITY'
    );

    capabilityEdges.forEach((edge: any) => {
      const capId = edge.target.replace('capability:', '');
      capabilities.push(capId);
    });

    return capabilities;
  }

  /**
   * Check if GraphRAG is available and initialized
   */
  isAvailable(): boolean {
    return this.initialized && this.graphragEngine !== null && this.graphSnapshot !== null;
  }

  /**
   * Get GraphRAG status
   */
  getStatus(): {
    initialized: boolean;
    nodeCount: number;
    edgeCount: number;
    templateCount: number;
  } {
    return {
      initialized: this.initialized,
      nodeCount: this.graph.order,
      edgeCount: this.graph.size,
      templateCount: this.graphSnapshot?.metadata?.templateCount || 0
    };
  }
}