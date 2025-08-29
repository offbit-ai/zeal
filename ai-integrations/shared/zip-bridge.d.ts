/**
 * Shared ZIP Protocol Bridge for AI Integrations
 * Provides a unified interface for both OpenAI Functions and MCP servers
 */
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
    position?: {
        x: number;
        y: number;
    };
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
    position: {
        x: number;
        y: number;
    };
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
    position?: {
        x: number;
        y: number;
    };
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
export declare class ZIPBridge {
    private client;
    private activeExecutions;
    private eventSubscriptions;
    constructor(config: {
        baseUrl: string;
        apiKey?: string;
        namespace?: string;
    });
    createWorkflow(params: CreateWorkflowParams): Promise<Workflow>;
    updateWorkflow(id: string, updates: WorkflowUpdates): Promise<Workflow>;
    deleteWorkflow(id: string): Promise<void>;
    getWorkflow(id: string): Promise<Workflow>;
    listWorkflows(filters?: {
        tags?: string[];
        search?: string;
        limit?: number;
        offset?: number;
    }): Promise<Workflow[]>;
    addNode(workflowId: string, node: NodeDefinition): Promise<Node>;
    updateNode(workflowId: string, nodeId: string, updates: NodeUpdates): Promise<Node>;
    deleteNode(workflowId: string, nodeId: string): Promise<void>;
    connectNodes(workflowId: string, connection: ConnectionDefinition): Promise<Connection>;
    disconnectNodes(workflowId: string, connectionId: string): Promise<void>;
    executeWorkflow(workflowId: string, options?: ExecutionOptions): Promise<ExecutionResult>;
    getExecutionStatus(executionId: string): Promise<ExecutionStatus>;
    cancelExecution(executionId: string): Promise<void>;
    streamExecutionEvents(executionId: string): AsyncIterator<ZipEvent>;
    searchTemplates(options: SearchOptions): Promise<Template[]>;
    getTemplate(id: string): Promise<Template>;
    registerTemplate(template: Template): Promise<void>;
    getFlowTraces(filters: TraceFilters): Promise<FlowTrace[]>;
    getAnalytics(workflowId: string): Promise<Analytics>;
    private generateId;
    private waitForCompletion;
    dispose(): Promise<void>;
}
export {};
//# sourceMappingURL=zip-bridge.d.ts.map