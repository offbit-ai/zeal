# Zeal SDK

TypeScript SDK for the Zeal Integration Protocol (ZIP), enabling third-party workflow runtime integration with the Zeal workflow editor.

## Prerequisites

⚠️ **Important**: A running Zeal server instance is required for the SDK to function. The SDK communicates with the Zeal server via REST APIs and WebSocket connections.

### Starting the Zeal Server

```bash
# Clone the Zeal repository
git clone https://github.com/offbit-ai/zeal.git
cd zeal

# Install dependencies
npm install

# Start the development server
npm run dev
# Or use the start script
./start-dev.sh
```

The Zeal server will be available at `http://localhost:3000` by default.

For detailed setup instructions, deployment options, and configuration, please refer to the [Zeal repository](https://github.com/offbit-ai/zeal).

## Installation

```bash
npm install @offbit-ai/zeal-sdk
```

## Quick Start

```typescript
import ZealClient from '@offbit-ai/zeal-sdk'

const client = new ZealClient({
  baseUrl: 'http://localhost:3000',
})

// Register node templates
await client.templates.register({
  namespace: 'my-integration',
  category: 'Custom Nodes',
  templates: [...],
})

// Orchestrate workflows
const workflow = await client.orchestrator.createWorkflow({
  name: 'My Workflow',
  description: 'Created via SDK',
})

// Submit execution traces
const session = await client.traces.createSession({
  workflowId: workflow.workflowId,
  workflowName: workflow.name,
})
```

## Webhook Subscriptions

The SDK provides two patterns for receiving webhook events: callbacks and observables.

### Callback Pattern

```typescript
const subscription = client.createSubscription({
  port: 3001,
  namespace: 'my-integration',
  events: ['workflow.*', 'node.*'],
})

// Subscribe with callback
const unsubscribe = subscription.onEvent(async (event) => {
  console.log('Received event:', event.type, event.data)
})

// Start receiving events
await subscription.start()

// Later: cleanup
unsubscribe()
await subscription.stop()
```

### Observable Pattern

```typescript
const subscription = client.createSubscription({
  port: 3001,
  namespace: 'my-integration',
})

// Get observable
const observable = subscription.asObservable()

// Filter and transform events
const errorEvents = observable
  .filter(event => event.type.includes('error'))
  .map(event => ({
    id: event.id,
    error: event.data.error,
    timestamp: event.timestamp,
  }))

// Subscribe to transformed stream
const sub = errorEvents.subscribe(
  (error) => console.error('Error:', error),
  (err) => console.error('Stream error:', err),
  () => console.log('Stream completed')
)

await subscription.start()

// Later: cleanup
sub.unsubscribe()
await subscription.stop()
```

### Event Type Filtering

```typescript
// Subscribe to specific event types
subscription.onEventType(['node.executed', 'execution.completed'], (event) => {
  console.log('Execution event:', event)
})

// Subscribe to events from specific sources
subscription.onEventSource('crdt', (event) => {
  console.log('CRDT event:', event)
})
```

## API Documentation

### Templates API

Register and manage node templates:

```typescript
// Register templates
await client.templates.register({
  namespace: 'my-integration',
  category: 'Custom',
  templates: [...],
})

// List templates
const templates = await client.templates.list('my-integration')

// Get template by ID
const template = await client.templates.get('template-id')
```

### Orchestrator API

Programmatically create and modify workflows:

```typescript
// Create workflow
const workflow = await client.orchestrator.createWorkflow({
  name: 'My Workflow',
  description: 'Created via SDK',
})

// Add node
const node = await client.orchestrator.addNode({
  workflowId: workflow.workflowId,
  templateId: 'template-id',
  position: { x: 100, y: 100 },
  properties: {...},
})

// Connect nodes
await client.orchestrator.addConnection({
  workflowId: workflow.workflowId,
  source: { nodeId: 'node1', portId: 'output' },
  target: { nodeId: 'node2', portId: 'input' },
})
```

### Traces API

Submit execution trace data:

```typescript
// Create session
const session = await client.traces.createSession({
  workflowId: 'workflow-id',
  workflowName: 'My Workflow',
})

// Submit events
await client.traces.submitEvents(session.sessionId, {
  events: [
    {
      timestamp: Date.now(),
      nodeId: 'node-id',
      eventType: 'output',
      data: {...},
    },
  ],
})

// Complete session
await client.traces.completeSession(session.sessionId, 'completed')
```

### Events API

Real-time bidirectional communication:

```typescript
// Connect to WebSocket
await client.events.connect()

// Subscribe to events
client.events.on('runtime:nodeExecuting', (data) => {
  console.log('Node executing:', data.nodeId)
})

// Send events
await client.events.send('runtime:nodeCompleted', {
  nodeId: 'node-id',
  output: {...},
})
```

### Webhooks API

Manage webhook registrations:

```typescript
// Register webhook
const webhook = await client.webhooks.register({
  namespace: 'my-integration',
  url: 'https://my-service.com/webhook',
  events: ['workflow.*', 'execution.*'],
})

// List webhooks
const webhooks = await client.webhooks.list('my-integration')

// Update webhook
await client.webhooks.update(webhook.webhookId, {
  events: ['node.*'],
  isActive: false,
})

// Delete webhook
await client.webhooks.delete(webhook.webhookId)
```

## Webhook Event Types

### Workflow Events
- `workflow.created` - New workflow created
- `workflow.updated` - Workflow updated
- `workflow.deleted` - Workflow deleted
- `workflow.published` - Workflow published

### Node Events
- `node.added` - Node added to workflow
- `node.updated` - Node properties updated
- `node.deleted` - Node removed
- `node.executed` - Node executed in runtime

### Connection Events
- `connection.added` - Connection created
- `connection.deleted` - Connection removed

### Execution Events
- `execution.started` - Workflow execution started
- `execution.completed` - Workflow execution completed
- `execution.failed` - Workflow execution failed

### Trace Events
- `trace.event` - Trace event recorded

## Examples

See the [examples](./examples) directory for complete working examples.

## License

Apache-2.0