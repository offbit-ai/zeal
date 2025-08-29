/**
 * Shared ZIP Protocol Bridge for AI Integrations
 * Provides a unified interface for both OpenAI Functions and MCP servers
 */

import ZealClient from '../../packages/zeal-sdk';
// Since the types are not properly exported, we'll define them locally
interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: any[];
  connections: any[];
  metadata?: any;
  graph?: {
    nodes: any[];
    connections: any[];
  };
}

interface Node {
  id: string;
  type: string;
  position?: { x: number; y: number };
  properties?: any;
  metadata?: any;
  data?: any;
}

interface Connection {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

interface Template {
  id: string;
  type: string;
  title: string;
  description: string;
  category: string;
  properties?: any;
  name?: string;
  confidence?: number;
  reasoning?: string;
}

interface ExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
}

interface FlowTrace {
  id: string;
  nodeId: string;
  status: string;
  timestamp: Date;
  data?: any;
  errorMessage?: string;
  targetNodeId?: string;
}

interface ZipEvent {
  type: string;
  data: any;
}

export interface CreateWorkflowParams {
  name: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  nodes?: NodeDefinition[];
  connections?: ConnectionDefinition[];
}

export interface NodeDefinition {
  id?: string;
  type: string;
  position: { x: number; y: number };
  config?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface ConnectionDefinition {
  sourceNodeId: string;
  sourcePort?: string;
  targetNodeId: string;
  targetPort?: string;
}

export interface WorkflowUpdates {
  name?: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  nodes?: NodeDefinition[];
  connections?: ConnectionDefinition[];
}

export interface NodeUpdates {
  position?: { x: number; y: number };
  config?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface ExecutionOptions {
  mode?: 'sync' | 'async' | 'debug';
  input?: Record<string, any>;
  timeout?: number;
  webhookUrl?: string;
}

export interface ExecutionStatus {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  result?: any;
  error?: string;
  traces?: FlowTrace[];
  nodeOutputs?: Record<string, any>;
}

export interface TraceFilters {
  workflowId?: string;
  sessionId?: string;
  timeRange?: {
    start: Date;
    end: Date;
  };
  status?: 'success' | 'failed' | 'warning';
  nodeId?: string;
  limit?: number;
}

export interface Analytics {
  workflowId: string;
  executionCount: number;
  successRate: number;
  averageDuration: number;
  errorRate: number;
  nodeMetrics: Record<string, {
    executionCount: number;
    averageDuration: number;
    errorRate: number;
  }>;
}

export interface SearchOptions {
  query: string;
  category?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

/**
 * ZIP Protocol Bridge implementation
 */
export class ZIPBridge {
  private client: ZealClient;
  private activeExecutions: Map<string, ExecutionStatus> = new Map();
  private eventSubscriptions: Map<string, any> = new Map();

  constructor(config: {
    baseUrl: string;
    apiKey?: string;
    namespace?: string;
  }) {
    this.client = new ZealClient({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      defaultNamespace: config.namespace || 'ai-integration'
    });
  }

  // ============= Workflow Operations =============

  async createWorkflow(params: CreateWorkflowParams): Promise<Workflow> {
    const workflow = await this.client.workflows.create({
      name: params.name,
      description: params.description,
      tags: params.tags,
      metadata: params.metadata,
      graph: {
        nodes: params.nodes?.map(n => ({
          id: n.id || this.generateId(),
          type: n.type,
          position: n.position,
          data: n.config,
          metadata: n.metadata
        })) || [],
        connections: params.connections?.map(c => ({
          id: this.generateId(),
          source: c.sourceNodeId,
          sourcePort: c.sourcePort || 'output',
          target: c.targetNodeId,
          targetPort: c.targetPort || 'input'
        })) || []
      }
    });

    return workflow;
  }

  async updateWorkflow(id: string, updates: WorkflowUpdates): Promise<Workflow> {
    const workflow = await this.client.workflows.update(id, {
      name: updates.name,
      description: updates.description,
      tags: updates.tags,
      metadata: updates.metadata
    });

    // Handle node and connection updates separately if provided
    if (updates.nodes || updates.connections) {
      const graph = await this.client.workflows.getGraph(id);
      
      if (updates.nodes) {
        for (const node of updates.nodes) {
          if (node.id && graph.nodes.find((n: any) => n.id === node.id)) {
            await this.updateNode(id, node.id, node);
          } else {
            await this.addNode(id, node);
          }
        }
      }

      if (updates.connections) {
        // Remove existing connections and add new ones
        const existingConnections = graph.connections || [];
        for (const conn of existingConnections) {
          await this.client.workflows.removeConnection(id, conn.id);
        }
        for (const conn of updates.connections) {
          await this.connectNodes(id, conn);
        }
      }
    }

    return workflow;
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.client.workflows.delete(id);
  }

  async getWorkflow(id: string): Promise<Workflow> {
    return await this.client.workflows.get(id);
  }

  async listWorkflows(filters?: {
    tags?: string[];
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<Workflow[]> {
    return await this.client.workflows.list(filters);
  }

  // ============= Node Operations =============

  async addNode(workflowId: string, node: NodeDefinition): Promise<Node> {
    const newNode = await this.client.workflows.addNode(workflowId, {
      id: node.id || this.generateId(),
      type: node.type,
      position: node.position,
      data: node.config,
      metadata: node.metadata
    });

    return newNode;
  }

  async updateNode(workflowId: string, nodeId: string, updates: NodeUpdates): Promise<Node> {
    return await this.client.workflows.updateNode(workflowId, nodeId, {
      position: updates.position,
      data: updates.config,
      metadata: updates.metadata
    });
  }

  async deleteNode(workflowId: string, nodeId: string): Promise<void> {
    await this.client.workflows.removeNode(workflowId, nodeId);
  }

  async connectNodes(workflowId: string, connection: ConnectionDefinition): Promise<Connection> {
    return await this.client.workflows.addConnection(workflowId, {
      source: connection.sourceNodeId,
      sourcePort: connection.sourcePort || 'output',
      target: connection.targetNodeId,
      targetPort: connection.targetPort || 'input'
    });
  }

  async disconnectNodes(workflowId: string, connectionId: string): Promise<void> {
    await this.client.workflows.removeConnection(workflowId, connectionId);
  }

  // ============= Execution Operations =============

  async executeWorkflow(workflowId: string, options?: ExecutionOptions): Promise<ExecutionResult> {
    const executionId = this.generateId();
    
    // Store execution status
    this.activeExecutions.set(executionId, {
      id: executionId,
      workflowId,
      status: 'pending',
      startTime: new Date()
    });

    try {
      const result = await this.client.executions.create({
        workflowId,
        input: options?.input,
        mode: options?.mode || 'async',
        webhookUrl: options?.webhookUrl
      });

      // Update execution status
      this.activeExecutions.set(executionId, {
        id: executionId,
        workflowId,
        status: 'running',
        startTime: new Date()
      });

      // For sync mode, wait for completion
      if (options?.mode === 'sync') {
        const finalResult = await this.waitForCompletion(result.id, options.timeout);
        this.activeExecutions.set(executionId, {
          id: executionId,
          workflowId,
          status: 'completed',
          startTime: new Date(),
          endTime: new Date(),
          result: finalResult
        });
        return finalResult;
      }

      return result;
    } catch (error) {
      this.activeExecutions.set(executionId, {
        id: executionId,
        workflowId,
        status: 'failed',
        startTime: new Date(),
        endTime: new Date(),
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async getExecutionStatus(executionId: string): Promise<ExecutionStatus> {
    // Check local cache first
    if (this.activeExecutions.has(executionId)) {
      return this.activeExecutions.get(executionId)!;
    }

    // Fetch from server
    const execution = await this.client.executions.get(executionId);
    
    return {
      id: execution.id,
      workflowId: execution.workflowId,
      status: execution.status,
      startTime: new Date(execution.startTime),
      endTime: execution.endTime ? new Date(execution.endTime) : undefined,
      result: execution.result,
      error: execution.error
    };
  }

  async cancelExecution(executionId: string): Promise<void> {
    await this.client.executions.cancel(executionId);
    
    if (this.activeExecutions.has(executionId)) {
      const execution = this.activeExecutions.get(executionId)!;
      execution.status = 'cancelled';
      execution.endTime = new Date();
    }
  }

  async *streamExecutionEvents(executionId: string): AsyncIterator<ZipEvent> {
    const subscription = this.client.createSubscription({
      events: ['execution.*'],
      filters: {
        executionId
      }
    });

    await subscription.start();
    this.eventSubscriptions.set(executionId, subscription);

    try {
      for await (const event of subscription.events()) {
        yield event;
        
        // Update local execution status based on events
        if (event.type === 'execution.completed' || event.type === 'execution.failed') {
          if (this.activeExecutions.has(executionId)) {
            const execution = this.activeExecutions.get(executionId)!;
            execution.status = event.type === 'execution.completed' ? 'completed' : 'failed';
            execution.endTime = new Date();
          }
        }
      }
    } finally {
      await subscription.stop();
      this.eventSubscriptions.delete(executionId);
    }
  }

  // ============= Template Operations =============

  async searchTemplates(options: SearchOptions): Promise<Template[]> {
    return await this.client.templates.search({
      query: options.query,
      category: options.category,
      tags: options.tags,
      limit: options.limit || 10,
      offset: options.offset || 0
    });
  }

  async getTemplate(id: string): Promise<Template> {
    return await this.client.templates.get(id);
  }

  async registerTemplate(template: Template): Promise<void> {
    await this.client.templates.register(template);
  }

  // ============= Analytics Operations =============

  async getFlowTraces(filters: TraceFilters): Promise<FlowTrace[]> {
    const traces = await this.client.traces.query({
      workflowId: filters.workflowId,
      sessionId: filters.sessionId,
      startTime: filters.timeRange?.start,
      endTime: filters.timeRange?.end,
      status: filters.status,
      nodeId: filters.nodeId,
      limit: filters.limit || 100
    });

    return traces;
  }

  async getAnalytics(workflowId: string): Promise<Analytics> {
    const [sessions, traces] = await Promise.all([
      this.client.traces.getSessions({ workflowId }),
      this.client.traces.query({ workflowId, limit: 1000 })
    ]);

    // Calculate analytics
    const totalExecutions = sessions.length;
    const successfulExecutions = sessions.filter((s: any) => s.status === 'completed').length;
    const failedExecutions = sessions.filter((s: any) => s.status === 'failed').length;
    
    const durations = sessions
      .filter((s: any) => s.endTime)
      .map((s: any) => new Date(s.endTime!).getTime() - new Date(s.startTime).getTime());
    
    const avgDuration = durations.length > 0 
      ? durations.reduce((a: number, b: number) => a + b, 0) / durations.length 
      : 0;

    // Node-level metrics
    const nodeMetrics: Record<string, any> = {};
    for (const trace of traces) {
      const nodeId = trace.targetNodeId;
      if (!nodeMetrics[nodeId]) {
        nodeMetrics[nodeId] = {
          executionCount: 0,
          totalDuration: 0,
          errorCount: 0
        };
      }
      nodeMetrics[nodeId].executionCount++;
      nodeMetrics[nodeId].totalDuration += trace.duration;
      if (trace.status === 'error') {
        nodeMetrics[nodeId].errorCount++;
      }
    }

    // Calculate averages for nodes
    const finalNodeMetrics: Record<string, any> = {};
    for (const [nodeId, metrics] of Object.entries(nodeMetrics)) {
      finalNodeMetrics[nodeId] = {
        executionCount: metrics.executionCount,
        averageDuration: metrics.totalDuration / metrics.executionCount,
        errorRate: metrics.errorCount / metrics.executionCount
      };
    }

    return {
      workflowId,
      executionCount: totalExecutions,
      successRate: totalExecutions > 0 ? successfulExecutions / totalExecutions : 0,
      averageDuration: avgDuration,
      errorRate: totalExecutions > 0 ? failedExecutions / totalExecutions : 0,
      nodeMetrics: finalNodeMetrics
    };
  }

  // ============= Helper Methods =============

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async waitForCompletion(executionId: string, timeout?: number): Promise<any> {
    const startTime = Date.now();
    const maxTimeout = timeout || 30000; // 30 seconds default

    while (Date.now() - startTime < maxTimeout) {
      const status = await this.getExecutionStatus(executionId);
      
      if (status.status === 'completed') {
        return status.result;
      }
      
      if (status.status === 'failed') {
        throw new Error(status.error || 'Execution failed');
      }
      
      if (status.status === 'cancelled') {
        throw new Error('Execution was cancelled');
      }

      // Wait 500ms before checking again
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error('Execution timeout');
  }

  async dispose(): Promise<void> {
    // Clean up any active subscriptions
    for (const subscription of this.eventSubscriptions.values()) {
      await subscription.stop();
    }
    this.eventSubscriptions.clear();
    this.activeExecutions.clear();
  }
}