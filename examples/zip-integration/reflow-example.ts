/**
 * Example integration: Reflow (actor-based DAG engine)
 * Demonstrates how to integrate a workflow runtime with Zeal using ZIP
 */

import { ZealClient } from '@offbit-ai/zeal-sdk'
import { RuntimeEventType } from '@offbit-ai/zeal-sdk'

// Initialize Zeal client
const zealClient = new ZealClient({
  baseUrl: 'http://localhost:3000', // Self-hosted Zeal instance
})

// Example Reflow integration
class ReflowIntegration {
  private sessionId: string | null = null
  
  async setup() {
    // 1. Register Reflow-specific node templates
    await this.registerTemplates()
    
    // 2. Create a workflow for testing
    const workflow = await this.createTestWorkflow()
    
    // 3. Connect to WebSocket for real-time events
    await this.connectWebSocket(workflow.workflowId)
    
    return workflow
  }
  
  async registerTemplates() {
    const response = await zealClient.templates.register({
      namespace: 'reflow',
      templates: [
        {
          id: 'actor-node',
          type: 'reflow-actor',
          title: 'Reflow Actor',
          category: 'reflow',
          subcategory: 'compute',
          description: 'Actor node for distributed computation',
          icon: 'cpu',
          variant: 'blue-600',
          shape: 'rectangle',
          size: 'medium',
          ports: [
            {
              id: 'in',
              label: 'Input',
              type: 'input',
              position: 'left',
              dataType: 'any',
              required: false,
              multiple: true,
            },
            {
              id: 'out',
              label: 'Output',
              type: 'output',
              position: 'right',
              dataType: 'any',
              multiple: true,
            },
          ],
          properties: {
            actorType: {
              type: 'select',
              label: 'Actor Type',
              description: 'Type of actor computation',
              defaultValue: 'compute',
              options: ['compute', 'filter', 'aggregate', 'transform'],
              validation: { required: true },
            },
            config: {
              type: 'code-editor',
              label: 'Configuration',
              description: 'Actor configuration (JSON)',
              defaultValue: '{}',
            },
            parallelism: {
              type: 'number',
              label: 'Parallelism',
              description: 'Number of parallel actors',
              defaultValue: 1,
              validation: { min: 1, max: 100 },
            },
          },
          runtime: {
            executor: 'reflow',
            version: '1.0.0',
            requiredEnvVars: ['REFLOW_SERVER_URL'],
            capabilities: ['distributed', 'streaming', 'fault-tolerant'],
          },
        },
        {
          id: 'message-router',
          type: 'reflow-router',
          title: 'Message Router',
          category: 'reflow',
          subcategory: 'control',
          description: 'Routes messages between actors',
          icon: 'git-branch',
          variant: 'green-600',
          shape: 'diamond',
          ports: [
            {
              id: 'in',
              label: 'Input',
              type: 'input',
              position: 'top',
            },
            {
              id: 'out1',
              label: 'Route 1',
              type: 'output',
              position: 'right',
            },
            {
              id: 'out2',
              label: 'Route 2',
              type: 'output',
              position: 'bottom',
            },
          ],
          properties: {
            routingStrategy: {
              type: 'select',
              label: 'Routing Strategy',
              options: ['round-robin', 'random', 'hash', 'conditional'],
              defaultValue: 'round-robin',
            },
            condition: {
              type: 'code-editor',
              label: 'Routing Condition',
              description: 'JavaScript expression for conditional routing',
            },
          },
          runtime: {
            executor: 'reflow',
            version: '1.0.0',
          },
        },
      ],
    })
    
    console.log(`Registered ${response.registered} Reflow templates`)
  }
  
  async createTestWorkflow() {
    // Create a new workflow
    const workflow = await zealClient.orchestrator.createWorkflow({
      name: 'Reflow Test Workflow',
      description: 'Example workflow for Reflow integration',
      metadata: {
        runtime: 'reflow',
        version: '1.0.0',
      },
    })
    
    // Add nodes
    const sourceActor = await zealClient.orchestrator.addNode({
      workflowId: workflow.workflowId,
      templateId: 'reflow/actor-node',
      position: { x: 100, y: 100 },
      propertyValues: {
        actorType: 'compute',
        config: '{"operation": "generate"}',
        parallelism: 1,
      },
    })
    
    const router = await zealClient.orchestrator.addNode({
      workflowId: workflow.workflowId,
      templateId: 'reflow/message-router',
      position: { x: 300, y: 100 },
      propertyValues: {
        routingStrategy: 'round-robin',
      },
    })
    
    const processor1 = await zealClient.orchestrator.addNode({
      workflowId: workflow.workflowId,
      templateId: 'reflow/actor-node',
      position: { x: 500, y: 50 },
      propertyValues: {
        actorType: 'transform',
        config: '{"operation": "uppercase"}',
        parallelism: 2,
      },
    })
    
    const processor2 = await zealClient.orchestrator.addNode({
      workflowId: workflow.workflowId,
      templateId: 'reflow/actor-node',
      position: { x: 500, y: 150 },
      propertyValues: {
        actorType: 'transform',
        config: '{"operation": "lowercase"}',
        parallelism: 2,
      },
    })
    
    // Connect nodes
    await zealClient.orchestrator.connectNodes({
      workflowId: workflow.workflowId,
      source: { nodeId: sourceActor.nodeId, portId: 'out' },
      target: { nodeId: router.nodeId, portId: 'in' },
    })
    
    await zealClient.orchestrator.connectNodes({
      workflowId: workflow.workflowId,
      source: { nodeId: router.nodeId, portId: 'out1' },
      target: { nodeId: processor1.nodeId, portId: 'in' },
    })
    
    await zealClient.orchestrator.connectNodes({
      workflowId: workflow.workflowId,
      source: { nodeId: router.nodeId, portId: 'out2' },
      target: { nodeId: processor2.nodeId, portId: 'in' },
    })
    
    // Create a group for processors
    await zealClient.orchestrator.createGroup({
      workflowId: workflow.workflowId,
      title: 'Processing Actors',
      nodeIds: [processor1.nodeId, processor2.nodeId],
      color: '#3B82F6',
      description: 'Parallel processing actors',
    })
    
    console.log(`Created workflow: ${workflow.workflowId}`)
    console.log(`Embed URL: ${workflow.embedUrl}`)
    
    return workflow
  }
  
  async connectWebSocket(workflowId: string) {
    await zealClient.events.connect(workflowId, {
      onConnected: () => {
        console.log('Connected to Zeal WebSocket')
      },
      onZealEvent: (event) => {
        console.log('Zeal event:', event.type, event.data)
        
        // Handle workflow execution events
        if (event.type === 'execution.start') {
          this.startExecution(workflowId, event.data)
        }
      },
      onError: (error) => {
        console.error('WebSocket error:', error)
      },
    })
  }
  
  async startExecution(workflowId: string, executionData: any) {
    console.log('Starting Reflow execution for workflow:', workflowId)
    
    // Create trace session
    const session = await zealClient.traces.createSession({
      workflowId,
      executionId: `reflow-exec-${Date.now()}`,
      metadata: {
        trigger: 'manual',
        environment: 'development',
        tags: ['reflow', 'test'],
      },
    })
    
    this.sessionId = session.sessionId
    
    // Simulate Reflow execution
    await this.simulateReflowExecution(workflowId, session.sessionId)
  }
  
  async simulateReflowExecution(workflowId: string, sessionId: string) {
    // Get workflow state
    const state = await zealClient.orchestrator.getWorkflowState(workflowId)
    
    // Emit workflow execution start
    zealClient.events.emitRuntimeEvent({
      type: RuntimeEventType.WORKFLOW_EXECUTION_START,
      workflowId,
      timestamp: Date.now(),
      data: { sessionId },
    })
    
    // Simulate execution of each node
    for (const node of state.state.nodes) {
      // Start node execution
      zealClient.events.emitNodeExecution(workflowId, node.id, 'start', {
        sessionId,
      })
      
      // Update visual state
      zealClient.events.updateVisualState([
        {
          id: node.id,
          elementType: 'node',
          state: 'running',
          progress: 0,
          message: 'Processing...',
        },
      ])
      
      // Trace input
      await zealClient.traces.traceNodeExecution(
        sessionId,
        node.id,
        'input',
        { message: 'Test input data' },
        0
      )
      
      // Simulate processing
      await this.sleep(1000)
      
      // Update progress
      zealClient.events.updateVisualState([
        {
          id: node.id,
          elementType: 'node',
          state: 'running',
          progress: 50,
        },
      ])
      
      await this.sleep(1000)
      
      // Complete node execution
      zealClient.events.emitNodeExecution(workflowId, node.id, 'success', {
        sessionId,
        output: { result: 'Processed successfully' },
      })
      
      // Update visual state
      zealClient.events.updateVisualState([
        {
          id: node.id,
          elementType: 'node',
          state: 'success',
          progress: 100,
          message: 'Completed',
        },
      ])
      
      // Trace output
      await zealClient.traces.traceNodeExecution(
        sessionId,
        node.id,
        'output',
        { result: 'Processed successfully' },
        2000
      )
    }
    
    // Simulate connection flows
    for (const connection of state.state.connections) {
      zealClient.events.emitConnectionFlow(
        workflowId,
        connection.id,
        'start',
        { dataSize: 1024 }
      )
      
      await this.sleep(500)
      
      zealClient.events.emitConnectionFlow(
        workflowId,
        connection.id,
        'end'
      )
    }
    
    // Complete execution
    zealClient.events.emitRuntimeEvent({
      type: RuntimeEventType.WORKFLOW_EXECUTION_COMPLETE,
      workflowId,
      timestamp: Date.now(),
      data: {
        sessionId,
        summary: {
          totalNodes: state.state.nodes.length,
          successfulNodes: state.state.nodes.length,
          failedNodes: 0,
        },
      },
    })
    
    // Complete trace session
    await zealClient.traces.completeSession(sessionId, {
      status: 'success',
      summary: {
        totalNodes: state.state.nodes.length,
        successfulNodes: state.state.nodes.length,
        failedNodes: 0,
        totalDuration: 5000,
        totalDataProcessed: 1024 * state.state.nodes.length,
      },
    })
    
    console.log('Execution completed successfully')
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  
  async cleanup() {
    zealClient.events.disconnect()
  }
}

// Run the example
async function main() {
  const integration = new ReflowIntegration()
  
  try {
    // Check health
    const health = await zealClient.health()
    console.log('Zeal health:', health)
    
    // Setup integration
    const workflow = await integration.setup()
    
    // Wait for user to trigger execution in Zeal UI
    console.log('\nWorkflow created! Open the embed URL to view it:')
    console.log(workflow.embedUrl)
    console.log('\nThe integration is now listening for execution events...')
    console.log('Trigger execution from the Zeal UI to see the integration in action.')
    
    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\nShutting down...')
      await integration.cleanup()
      process.exit(0)
    })
  } catch (error) {
    console.error('Integration error:', error)
    await integration.cleanup()
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  main()
}

export { ReflowIntegration }