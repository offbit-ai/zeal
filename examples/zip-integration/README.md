# Zeal Integration Protocol (ZIP) Examples

This directory contains example integrations demonstrating how to use the Zeal Integration Protocol (ZIP) to integrate workflow runtimes with Zeal.

## Overview

ZIP enables 3rd party platforms and workflow runtimes to:
- Register custom node templates
- Programmatically orchestrate workflows
- Exchange real-time events
- Submit execution data for visualization
- Access execution history and replay capabilities

## Example: Reflow Integration

The `reflow-example.ts` demonstrates a complete integration with a fictional actor-based DAG engine called "Reflow".

### Features Demonstrated

1. **Template Registration**: Register custom node types specific to your runtime
2. **Workflow Creation**: Programmatically create workflows with nodes and connections
3. **WebSocket Events**: Real-time bidirectional communication
4. **Execution Tracing**: Submit execution data for visualization and replay
5. **Visual Updates**: Update node and connection states during execution

### Running the Example

1. **Install the SDK**:
```bash
cd packages/zeal-sdk
npm install
npm run build
```

2. **Start your Zeal instance**:
```bash
npm run dev
```

3. **Run the integration example**:
```bash
cd examples/zip-integration
npm install
npx ts-node reflow-example.ts
```

4. **View the workflow**: Open the embed URL printed by the script

5. **Trigger execution**: Use the Zeal UI to start workflow execution and watch the integration respond

## Integration Steps

### 1. Register Templates

```typescript
await zealClient.templates.register({
  namespace: 'your-runtime',
  templates: [
    {
      id: 'custom-node',
      type: 'runtime-specific',
      title: 'Custom Node',
      // ... node configuration
    }
  ]
})
```

### 2. Create Workflows

```typescript
const workflow = await zealClient.orchestrator.createWorkflow({
  name: 'My Workflow',
  description: 'Created via ZIP'
})

const node = await zealClient.orchestrator.addNode({
  workflowId: workflow.workflowId,
  templateId: 'your-runtime/custom-node',
  position: { x: 100, y: 100 }
})
```

### 3. Connect to WebSocket

```typescript
await zealClient.events.connect(workflowId, {
  onZealEvent: (event) => {
    // Handle events from Zeal (execution control, etc.)
  },
  onConnected: () => {
    console.log('Connected to Zeal')
  }
})
```

### 4. Submit Execution Data

```typescript
// Create trace session
const session = await zealClient.traces.createSession({
  workflowId,
  executionId: 'unique-execution-id'
})

// Submit trace events
await zealClient.traces.traceNodeExecution(
  session.sessionId,
  nodeId,
  'output',
  { result: 'data' }
)

// Update visual state
zealClient.events.updateVisualState([{
  id: nodeId,
  elementType: 'node',
  state: 'running',
  progress: 50
}])
```

## Webhook Integration

ZIP also supports webhook-based integration for events:

```typescript
// Register webhook
const webhook = await zealClient.webhooks.register({
  namespace: 'your-runtime',
  url: 'https://your-server.com/webhook',
  events: ['workflow.created', 'node.added']
})

// Test webhook
await zealClient.webhooks.test(webhook.webhookId)
```

## Rate Limiting

The ZIP API implements rate limiting to prevent abuse:

- Template operations: 100 requests/hour
- Orchestrator operations: 1000 requests/hour
- Trace submissions: 10000 events/hour
- WebSocket events: 1000 events/minute

Rate limit information is provided in response headers:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp

## API Documentation

Full API documentation is available in `/zip_resource/zeal_integration_protocol.md`

## Support

For questions and support:
- GitHub Issues: https://github.com/offbit-ai/zeal/issues
- Documentation: https://github.com/offbit-ai/zeal/wiki