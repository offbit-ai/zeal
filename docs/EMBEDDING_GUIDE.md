# Zeal Workflow Editor Embedding Guide

This guide explains how to embed the Zeal workflow editor into your application using the official `@offbit-ai/zeal-embed-sdk`.

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Authentication](#authentication)
5. [Configuration Options](#configuration-options)
6. [API Reference](#api-reference)
7. [WebSocket Events](#websocket-events)
8. [Advanced Usage](#advanced-usage)
9. [Security Considerations](#security-considerations)
10. [Migration from iframe](#migration-from-iframe)
11. [Examples](#examples)

## Overview

The Zeal Embed SDK (`@offbit-ai/zeal-embed-sdk`) is a browser-compatible SDK that provides:

- **Easy Integration**: Simple API for embedding the workflow editor
- **Full ZIP Protocol Support**: Access to templates, orchestrator, traces, and events APIs
- **Real-time Updates**: WebSocket integration for live collaboration
- **Type Safety**: Full TypeScript support
- **Browser Compatible**: No Node.js dependencies

## Installation

### npm/yarn

```bash
npm install @offbit-ai/zeal-embed-sdk
# or
yarn add @offbit-ai/zeal-embed-sdk
```

### CDN

```html
<script type="module">
  import { ZealEmbed, EmbedConfigBuilder } from 'https://unpkg.com/@offbit-ai/zeal-embed-sdk@latest/dist/index.mjs'
</script>
```

## Quick Start

### Basic Embedding

```javascript
import { ZealEmbed, EmbedConfigBuilder } from '@offbit-ai/zeal-embed-sdk'

// Create embed configuration
const config = new EmbedConfigBuilder('#workflow-container')
  .withBaseUrl('https://your-zeal-instance.com')
  .withWorkflow('wf_123')
  .withAuthToken('your-auth-token')
  .withHeight('800px')
  .build()

// Create and initialize embed
const embed = await ZealEmbed.create(config)

// Listen to events
embed.on('ready', () => {
  console.log('Workflow editor is ready')
})

embed.on('nodeAdded', (node) => {
  console.log('Node added:', node)
})
```

### React Component

```jsx
import React, { useEffect, useRef } from 'react'
import { ZealEmbed, EmbedConfigBuilder } from '@offbit-ai/zeal-embed-sdk'

function WorkflowEditor({ workflowId, authToken }) {
  const containerRef = useRef(null)
  const embedRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    const initEmbed = async () => {
      const config = new EmbedConfigBuilder(containerRef.current)
        .withBaseUrl('https://your-zeal-instance.com')
        .withWorkflow(workflowId)
        .withAuthToken(authToken)
        .withHeight('100%')
        .withTheme('light')
        .onNodeAdded((node) => console.log('Node added:', node))
        .onExecutionCompleted((result) => console.log('Execution completed:', result))
        .build()

      embedRef.current = await ZealEmbed.create(config)
    }

    initEmbed()

    return () => {
      embedRef.current?.destroy()
    }
  }, [workflowId, authToken])

  return <div ref={containerRef} style={{ width: '100%', height: '800px' }} />
}
```

## Authentication

The SDK uses auth tokens for authentication. Tokens are checked in this order:
1. Provided in configuration
2. Session storage (`ZEAL_AUTH_TOKEN`)

### Setting Auth Token

```javascript
// Option 1: Provide in configuration
const config = new EmbedConfigBuilder('#container')
  .withAuthToken('your-auth-token')
  .build()

// Option 2: Set in session storage (will be used automatically)
sessionStorage.setItem('ZEAL_AUTH_TOKEN', 'your-auth-token')
```

## Configuration Options

### EmbedConfigBuilder Methods

```javascript
const builder = new EmbedConfigBuilder('#container')
  // Basic configuration
  .withBaseUrl('https://your-zeal-instance.com')
  .withWorkflow('workflow_id')
  .withAuthToken('auth_token')
  
  // Display options
  .withHeight('800px')
  .withWidth('100%')
  .withTheme('light') // or 'dark'
  .withMinimap(true)
  .withZoomControls(true)
  .withSubgraphTabs(true)
  .withNodeCreation(true)
  
  // Permissions
  .withPermissions({
    canAddNodes: true,
    canEditNodes: true,
    canDeleteNodes: true,
    canAddGroups: true,
    canEditGroups: true,
    canDeleteGroups: true,
    canExecute: true,
    canViewWorkflow: true,
    canExportData: false
  })
  
  // Rate limits
  .withRateLimits({
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    requestsPerDay: 10000,
    executionsPerHour: 100,
    executionsPerDay: 1000
  })
  
  // Hide specific UI elements
  .hideElements(['.toolbar-item-export', '.menu-settings'])
  
  // Node libraries to load
  .withNodeLibraries('data-processing', 'ml-nodes', 'custom-nodes')
  
  // Read-only mode
  .asViewOnly()
  
  // Event handlers
  .onReady(() => console.log('Ready'))
  .onError((error) => console.error('Error:', error))
  .onNodeAdded((node) => console.log('Node added:', node))
  .onNodeUpdated((node) => console.log('Node updated:', node))
  .onNodeDeleted((nodeId) => console.log('Node deleted:', nodeId))
  .onConnectionCreated((connection) => console.log('Connection created:', connection))
  .onConnectionDeleted((connectionId) => console.log('Connection deleted:', connectionId))
  .onWorkflowSaved((workflow) => console.log('Workflow saved:', workflow))
  .onExecutionStarted((sessionId) => console.log('Execution started:', sessionId))
  .onExecutionCompleted((result) => console.log('Execution completed:', result))
  .onExecutionFailed((error) => console.log('Execution failed:', error))
```

## API Reference

### ZealEmbed Instance

```javascript
const embed = await ZealEmbed.create(config)

// Properties
embed.iframe          // HTMLIFrameElement - The embedded iframe
embed.client          // ZIPClient - Access to ZIP protocol APIs

// Methods
await embed.execute({ inputs: { data: 'test' } })  // Execute workflow
await embed.save()                                  // Save workflow
await embed.load('workflow_id')                     // Load different workflow
await embed.getWorkflow()                           // Get workflow data
await embed.setWorkflow(workflowData)               // Set workflow data
await embed.registerNodeTemplates(templates)        // Register custom nodes
embed.updateDisplay({ theme: 'dark' })              // Update display options
embed.destroy()                                      // Clean up embed
embed.isReady()                                      // Check if ready
await embed.waitForReady()                          // Wait for ready state

// Event methods (EventEmitter)
embed.on('eventName', handler)
embed.once('eventName', handler)
embed.off('eventName', handler)
embed.emit('eventName', data)
```

### ZIPClient - Full ZIP Protocol Access

The embed includes a browser-compatible ZIP client with all APIs:

```javascript
const { client } = embed

// Templates API
await client.templates.register({
  namespace: 'custom',
  templates: [/* your templates */]
})
await client.templates.list('namespace')
await client.templates.update('namespace', 'templateId', updates)
await client.templates.delete('namespace', 'templateId')

// Orchestrator API
await client.orchestrator.createWorkflow({ name: 'New Workflow' })
await client.orchestrator.listWorkflows({ limit: 10 })
await client.orchestrator.getWorkflowState('workflowId')
await client.orchestrator.addNode({
  workflowId: 'wf_123',
  templateId: 'data-transform',
  position: { x: 100, y: 200 }
})
await client.orchestrator.updateNode('nodeId', updates)
await client.orchestrator.deleteNode('nodeId', 'workflowId')
await client.orchestrator.connectNodes({
  workflowId: 'wf_123',
  sourceNodeId: 'node1',
  sourcePortId: 'output',
  targetNodeId: 'node2',
  targetPortId: 'input'
})
await client.orchestrator.execute({
  workflowId: 'wf_123',
  inputs: { data: 'test' }
})
await client.orchestrator.getExecutionStatus('sessionId')
await client.orchestrator.cancelExecution('sessionId')

// Traces API
const session = await client.traces.createSession({ workflowId: 'wf_123' })
await client.traces.submitEvent(session.sessionId, {
  timestamp: Date.now(),
  nodeId: 'node1',
  eventType: 'input',
  data: { value: 'test' }
})
await client.traces.completeSession(session.sessionId, { status: 'success' })

// Events API (WebSocket)
await client.events.connect('workflowId')
client.events.on('node.executing', (event) => console.log('Node executing:', event))
client.events.updateVisualState([{
  id: 'node1',
  elementType: 'node',
  state: 'running',
  progress: 50
}])
client.events.disconnect()

// Health check
const health = await client.health()
```

## WebSocket Events

The SDK provides real-time updates via WebSocket:

### ZIP Event Types

```javascript
// Node execution events
embed.on('node.executing', (event) => { /* ... */ })
embed.on('node.completed', (event) => { /* ... */ })
embed.on('node.failed', (event) => { /* ... */ })
embed.on('node.warning', (event) => { /* ... */ })

// Workflow execution events
embed.on('execution.started', (event) => { /* ... */ })
embed.on('execution.completed', (event) => { /* ... */ })
embed.on('execution.failed', (event) => { /* ... */ })

// Workflow lifecycle events
embed.on('workflow.created', (event) => { /* ... */ })
embed.on('workflow.updated', (event) => { /* ... */ })
embed.on('workflow.deleted', (event) => { /* ... */ })

// CRDT collaboration events
embed.on('node.added', (event) => { /* ... */ })
embed.on('node.updated', (event) => { /* ... */ })
embed.on('node.deleted', (event) => { /* ... */ })
embed.on('connection.added', (event) => { /* ... */ })
embed.on('connection.deleted', (event) => { /* ... */ })
embed.on('group.created', (event) => { /* ... */ })
embed.on('group.updated', (event) => { /* ... */ })
embed.on('group.deleted', (event) => { /* ... */ })
```

## Advanced Usage

### Custom Node Templates

```javascript
const customTemplates = [
  {
    id: 'custom-processor',
    type: 'processor',
    title: 'Custom Processor',
    category: 'custom',
    description: 'A custom data processor',
    ports: {
      inputs: [
        { id: 'input', name: 'Input', type: 'any' }
      ],
      outputs: [
        { id: 'output', name: 'Output', type: 'any' }
      ]
    },
    properties: {
      mode: { type: 'select', options: ['fast', 'accurate'], default: 'fast' },
      threshold: { type: 'number', default: 0.5, min: 0, max: 1 }
    }
  }
]

await embed.registerNodeTemplates(customTemplates)
```

### Programmatic Workflow Building

```javascript
const embed = await ZealEmbed.create(config)
const { client } = embed

// Create a new workflow
const { workflowId } = await client.orchestrator.createWorkflow({
  name: 'Data Pipeline',
  description: 'Automated data processing pipeline'
})

// Add nodes
const node1 = await client.orchestrator.addNode({
  workflowId,
  templateId: 'data-source',
  position: { x: 100, y: 100 },
  properties: { source: 'database' }
})

const node2 = await client.orchestrator.addNode({
  workflowId,
  templateId: 'data-transform',
  position: { x: 300, y: 100 },
  properties: { operation: 'filter' }
})

// Connect nodes
await client.orchestrator.connectNodes({
  workflowId,
  sourceNodeId: node1.nodeId,
  sourcePortId: 'output',
  targetNodeId: node2.nodeId,
  targetPortId: 'input'
})

// Load the workflow in the embed
await embed.load(workflowId)
```

### Real-time Collaboration

```javascript
// Enable real-time collaboration features
const embed = await ZealEmbed.create(config)

// Listen to collaboration events
embed.on('node.added', (event) => {
  console.log(`User added node: ${event.nodeId}`)
})

embed.on('node.updated', (event) => {
  console.log(`Node ${event.nodeId} was updated`)
})

embed.on('connection.added', (event) => {
  console.log('New connection created:', event.data)
})

// Update visual states for other users
embed.client.events.updateVisualState([
  {
    id: 'node-123',
    elementType: 'node',
    state: 'running',
    progress: 75,
    message: 'Processing...'
  }
])
```

## Security Considerations

### Content Security Policy

```html
<meta http-equiv="Content-Security-Policy" 
      content="frame-src https://your-zeal-instance.com; 
               connect-src https://your-zeal-instance.com wss://your-zeal-instance.com;">
```

### Domain Restrictions

Configure allowed embedding domains in your Zeal instance:

```javascript
// Zeal server configuration
{
  embed: {
    allowedOrigins: [
      'https://myapp.com',
      'https://staging.myapp.com',
      'http://localhost:3000' // Development
    ]
  }
}
```

### Token Security

- Never expose auth tokens in client-side code
- Use environment variables or secure token management
- Implement token rotation
- Set appropriate expiration times

## Migration from iframe

If you're currently using direct iframe embedding, here's how to migrate:

### Before (iframe)

```html
<iframe src="https://zeal.example.com/embed/wf_123?apiKey=key" 
        width="100%" height="600"></iframe>
```

### After (SDK)

```javascript
import { ZealEmbed, EmbedConfigBuilder } from '@offbit-ai/zeal-embed-sdk'

const config = new EmbedConfigBuilder('#container')
  .withBaseUrl('https://zeal.example.com')
  .withWorkflow('wf_123')
  .withAuthToken('key')
  .withHeight('600px')
  .build()

const embed = await ZealEmbed.create(config)
```

## Examples

### Example 1: SaaS Platform Integration

```javascript
import { ZealEmbed, EmbedConfigBuilder } from '@offbit-ai/zeal-embed-sdk'

class WorkflowBuilder {
  constructor(tenantId) {
    this.tenantId = tenantId
    this.embed = null
  }

  async initialize(container) {
    // Get tenant-specific configuration
    const { workflowId, authToken } = await this.getTenantConfig()

    // Build embed configuration
    const config = new EmbedConfigBuilder(container)
      .withBaseUrl(process.env.ZEAL_URL)
      .withWorkflow(workflowId)
      .withAuthToken(authToken)
      .withHeight('100vh')
      .withTheme('light')
      .withPermissions({
        canExecute: false, // Execution handled by platform
        canExportData: false
      })
      .onWorkflowSaved(this.handleWorkflowSave.bind(this))
      .onNodeAdded(this.trackNodeUsage.bind(this))
      .build()

    // Create embed
    this.embed = await ZealEmbed.create(config)

    // Register custom nodes for this tenant
    await this.registerTenantNodes()
  }

  async registerTenantNodes() {
    const templates = await this.fetchTenantTemplates()
    await this.embed.registerNodeTemplates(templates)
  }

  async handleWorkflowSave(workflow) {
    // Save to platform database
    await fetch(`/api/tenants/${this.tenantId}/workflows`, {
      method: 'PUT',
      body: JSON.stringify(workflow)
    })
  }

  async trackNodeUsage(node) {
    // Analytics tracking
    analytics.track('node_added', {
      tenantId: this.tenantId,
      nodeType: node.type,
      timestamp: Date.now()
    })
  }

  async deploy() {
    const workflow = await this.embed.getWorkflow()
    
    // Deploy workflow to execution environment
    const response = await fetch(`/api/deploy`, {
      method: 'POST',
      body: JSON.stringify({
        tenantId: this.tenantId,
        workflow
      })
    })

    return response.json()
  }
}

// Usage
const builder = new WorkflowBuilder('tenant_123')
await builder.initialize('#workflow-container')
```

### Example 2: AI-Powered Workflow Generation

```javascript
import { ZealEmbed, EmbedConfigBuilder, ZIPClient } from '@offbit-ai/zeal-embed-sdk'

class AIWorkflowGenerator {
  constructor() {
    this.client = new ZIPClient({
      baseUrl: process.env.ZEAL_URL,
      authToken: process.env.ZEAL_AUTH_TOKEN
    })
  }

  async generateFromPrompt(prompt) {
    // Call AI to understand the workflow requirements
    const requirements = await this.analyzePrompt(prompt)

    // Create new workflow
    const { workflowId } = await this.client.orchestrator.createWorkflow({
      name: requirements.name,
      description: `Generated from: ${prompt}`
    })

    // Build workflow based on AI analysis
    const nodes = []
    for (const step of requirements.steps) {
      const node = await this.client.orchestrator.addNode({
        workflowId,
        templateId: step.templateId,
        position: step.position,
        properties: step.properties
      })
      nodes.push(node)
    }

    // Create connections
    for (let i = 0; i < nodes.length - 1; i++) {
      await this.client.orchestrator.connectNodes({
        workflowId,
        sourceNodeId: nodes[i].nodeId,
        sourcePortId: 'output',
        targetNodeId: nodes[i + 1].nodeId,
        targetPortId: 'input'
      })
    }

    return workflowId
  }

  async embedGeneratedWorkflow(workflowId, container) {
    const config = new EmbedConfigBuilder(container)
      .withBaseUrl(process.env.ZEAL_URL)
      .withWorkflow(workflowId)
      .withAuthToken(process.env.ZEAL_AUTH_TOKEN)
      .withHeight('600px')
      .asViewOnly() // Read-only for review
      .build()

    return await ZealEmbed.create(config)
  }
}

// Usage
const generator = new AIWorkflowGenerator()
const workflowId = await generator.generateFromPrompt(
  "Create a workflow that processes CSV files, filters data, and sends email notifications"
)
const embed = await generator.embedGeneratedWorkflow(workflowId, '#preview')
```

### Example 3: Monitoring Dashboard

```javascript
import { ZealEmbed, EmbedConfigBuilder } from '@offbit-ai/zeal-embed-sdk'

class WorkflowMonitor {
  constructor(workflowId) {
    this.workflowId = workflowId
    this.embed = null
  }

  async initialize(container) {
    const config = new EmbedConfigBuilder(container)
      .withBaseUrl(process.env.ZEAL_URL)
      .withWorkflow(this.workflowId)
      .withAuthToken(process.env.ZEAL_AUTH_TOKEN)
      .asViewOnly()
      .withHeight('500px')
      .build()

    this.embed = await ZealEmbed.create(config)

    // Setup real-time monitoring
    this.setupMonitoring()
  }

  async setupMonitoring() {
    const { client } = this.embed

    // Connect to WebSocket for real-time events
    await client.events.connect(this.workflowId)

    // Listen to execution events
    client.events.on('node.executing', (event) => {
      this.updateNodeStatus(event.nodeId, 'executing')
    })

    client.events.on('node.completed', (event) => {
      this.updateNodeStatus(event.nodeId, 'completed')
      this.updateMetrics(event)
    })

    client.events.on('node.failed', (event) => {
      this.updateNodeStatus(event.nodeId, 'failed')
      this.handleError(event)
    })

    // Start trace session for detailed monitoring
    const session = await client.traces.createSession({
      workflowId: this.workflowId
    })

    this.traceSessionId = session.sessionId
  }

  updateNodeStatus(nodeId, status) {
    // Update visual state in the embed
    this.embed.client.events.updateVisualState([{
      id: nodeId,
      elementType: 'node',
      state: status === 'executing' ? 'running' : status,
      highlight: status === 'failed'
    }])

    // Update external dashboard
    this.updateDashboard(nodeId, status)
  }

  updateMetrics(event) {
    // Track performance metrics
    if (event.duration) {
      metrics.record('node.execution.duration', event.duration, {
        nodeId: event.nodeId,
        workflowId: this.workflowId
      })
    }
  }

  handleError(event) {
    // Send alerts for failures
    alerting.send({
      severity: 'error',
      title: `Node ${event.nodeId} failed`,
      description: event.error?.message,
      workflowId: this.workflowId
    })
  }
}

// Usage
const monitor = new WorkflowMonitor('production_workflow_123')
await monitor.initialize('#monitoring-dashboard')
```

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure your domain is in the allowed origins list
2. **Auth Token Invalid**: Check token expiration and permissions
3. **WebSocket Connection Failed**: Verify WebSocket endpoint and firewall rules
4. **Build Errors**: Ensure you're using a modern bundler that supports ES modules

### Debug Mode

Enable debug logging:

```javascript
const config = new EmbedConfigBuilder('#container')
  .withBaseUrl('https://your-zeal-instance.com')
  .withWorkflow('wf_123')
  .withAuthToken('token')
  .build()

// Enable debug mode
config.debug = true

const embed = await ZealEmbed.create(config)
```

## Support

For additional help:

- GitHub Issues: https://github.com/offbit-ai/zeal/issues
- Documentation: https://docs.zeal.app
- NPM Package: https://www.npmjs.com/package/@offbit-ai/zeal-embed-sdk