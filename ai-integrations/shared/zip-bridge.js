"use strict";
/**
 * Shared ZIP Protocol Bridge for AI Integrations
 * Provides a unified interface for both OpenAI Functions and MCP servers
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZIPBridge = void 0;
const zeal_sdk_1 = __importDefault(require("../../packages/zeal-sdk"));
/**
 * ZIP Protocol Bridge implementation
 */
class ZIPBridge {
    client;
    activeExecutions = new Map();
    eventSubscriptions = new Map();
    constructor(config) {
        this.client = new zeal_sdk_1.default({
            baseUrl: config.baseUrl,
            apiKey: config.apiKey,
            defaultNamespace: config.namespace || 'ai-integration'
        });
    }
    // ============= Workflow Operations =============
    async createWorkflow(params) {
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
    async updateWorkflow(id, updates) {
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
                    if (node.id && graph.nodes.find((n) => n.id === node.id)) {
                        await this.updateNode(id, node.id, node);
                    }
                    else {
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
    async deleteWorkflow(id) {
        await this.client.workflows.delete(id);
    }
    async getWorkflow(id) {
        return await this.client.workflows.get(id);
    }
    async listWorkflows(filters) {
        return await this.client.workflows.list(filters);
    }
    // ============= Node Operations =============
    async addNode(workflowId, node) {
        const newNode = await this.client.workflows.addNode(workflowId, {
            id: node.id || this.generateId(),
            type: node.type,
            position: node.position,
            data: node.config,
            metadata: node.metadata
        });
        return newNode;
    }
    async updateNode(workflowId, nodeId, updates) {
        return await this.client.workflows.updateNode(workflowId, nodeId, {
            position: updates.position,
            data: updates.config,
            metadata: updates.metadata
        });
    }
    async deleteNode(workflowId, nodeId) {
        await this.client.workflows.removeNode(workflowId, nodeId);
    }
    async connectNodes(workflowId, connection) {
        return await this.client.workflows.addConnection(workflowId, {
            source: connection.sourceNodeId,
            sourcePort: connection.sourcePort || 'output',
            target: connection.targetNodeId,
            targetPort: connection.targetPort || 'input'
        });
    }
    async disconnectNodes(workflowId, connectionId) {
        await this.client.workflows.removeConnection(workflowId, connectionId);
    }
    // ============= Execution Operations =============
    async executeWorkflow(workflowId, options) {
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
        }
        catch (error) {
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
    async getExecutionStatus(executionId) {
        // Check local cache first
        if (this.activeExecutions.has(executionId)) {
            return this.activeExecutions.get(executionId);
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
    async cancelExecution(executionId) {
        await this.client.executions.cancel(executionId);
        if (this.activeExecutions.has(executionId)) {
            const execution = this.activeExecutions.get(executionId);
            execution.status = 'cancelled';
            execution.endTime = new Date();
        }
    }
    async *streamExecutionEvents(executionId) {
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
                        const execution = this.activeExecutions.get(executionId);
                        execution.status = event.type === 'execution.completed' ? 'completed' : 'failed';
                        execution.endTime = new Date();
                    }
                }
            }
        }
        finally {
            await subscription.stop();
            this.eventSubscriptions.delete(executionId);
        }
    }
    // ============= Template Operations =============
    async searchTemplates(options) {
        return await this.client.templates.search({
            query: options.query,
            category: options.category,
            tags: options.tags,
            limit: options.limit || 10,
            offset: options.offset || 0
        });
    }
    async getTemplate(id) {
        return await this.client.templates.get(id);
    }
    async registerTemplate(template) {
        await this.client.templates.register(template);
    }
    // ============= Analytics Operations =============
    async getFlowTraces(filters) {
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
    async getAnalytics(workflowId) {
        const [sessions, traces] = await Promise.all([
            this.client.traces.getSessions({ workflowId }),
            this.client.traces.query({ workflowId, limit: 1000 })
        ]);
        // Calculate analytics
        const totalExecutions = sessions.length;
        const successfulExecutions = sessions.filter((s) => s.status === 'completed').length;
        const failedExecutions = sessions.filter((s) => s.status === 'failed').length;
        const durations = sessions
            .filter((s) => s.endTime)
            .map((s) => new Date(s.endTime).getTime() - new Date(s.startTime).getTime());
        const avgDuration = durations.length > 0
            ? durations.reduce((a, b) => a + b, 0) / durations.length
            : 0;
        // Node-level metrics
        const nodeMetrics = {};
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
        const finalNodeMetrics = {};
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
    generateId() {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    async waitForCompletion(executionId, timeout) {
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
    async dispose() {
        // Clean up any active subscriptions
        for (const subscription of this.eventSubscriptions.values()) {
            await subscription.stop();
        }
        this.eventSubscriptions.clear();
        this.activeExecutions.clear();
    }
}
exports.ZIPBridge = ZIPBridge;
//# sourceMappingURL=zip-bridge.js.map