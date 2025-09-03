# @offbit-ai/zeal-embed-sdk

Browser-compatible SDK for embedding the Zeal workflow editor into web applications.

## Prerequisites

⚠️ **Important**: A running Zeal server instance is required for the SDK to function. The embed SDK loads the workflow editor from the Zeal server and communicates via WebSocket connections.

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

## Features

- 🌐 **Browser Compatible** - No Node.js dependencies, works in any modern browser
- 🔧 **Full ZIP Protocol** - Complete access to templates, orchestrator, traces, and events APIs
- 🔄 **Real-time Updates** - WebSocket integration for live collaboration
- 📝 **TypeScript Support** - Full type safety and IntelliSense
- 🎨 **Flexible Configuration** - Extensive customization options
- 🔒 **Secure** - Token-based authentication with session storage fallback

## Installation

```bash
npm install @offbit-ai/zeal-embed-sdk
# or
yarn add @offbit-ai/zeal-embed-sdk
# or
pnpm add @offbit-ai/zeal-embed-sdk
```

### CDN

```html
<script type="module">
  import { ZealEmbed, EmbedConfigBuilder } from 'https://unpkg.com/@offbit-ai/zeal-embed-sdk@latest/dist/index.mjs'
</script>
```

## Quick Start

```javascript
import { ZealEmbed, EmbedConfigBuilder } from '@offbit-ai/zeal-embed-sdk'

// Configure the embed
const config = new EmbedConfigBuilder('#workflow-container')
  .withBaseUrl('https://your-zeal-instance.com')
  .withWorkflow('workflow_id')
  .withAuthToken('your-auth-token')
  .withHeight('800px')
  .build()

// Create and initialize
const embed = await ZealEmbed.create(config)

// Listen to events
embed.on('ready', () => {
  console.log('Workflow editor ready!')
})

embed.on('nodeAdded', (node) => {
  console.log('Node added:', node)
})
```

## Authentication

The SDK uses auth tokens for authentication. Tokens are checked in this order:

1. Provided via configuration
2. Session storage (`ZEAL_AUTH_TOKEN`)

```javascript
// Option 1: Via configuration
const config = new EmbedConfigBuilder('#container')
  .withAuthToken('your-auth-token')
  .build()

// Option 2: Via session storage (automatic)
sessionStorage.setItem('ZEAL_AUTH_TOKEN', 'your-auth-token')
```

## API Reference

### EmbedConfigBuilder

Fluent builder for configuring the embed:

```javascript
const builder = new EmbedConfigBuilder('#container')
  // Basic configuration
  .withBaseUrl('https://your-zeal-instance.com')
  .withWorkflow('workflow_id')
  .withAuthToken('token')
  
  // Display options
  .withHeight('800px')
  .withWidth('100%')
  .withTheme('light') // 'light' | 'dark' | 'auto'
  .withMinimap(true)
  .withZoomControls(true)
  .withSubgraphTabs(true)
  .withNodeCreation(true)
  
  // Permissions
  .withPermissions({
    canAddNodes: true,
    canEditNodes: true,
    canDeleteNodes: true,
    canExecute: true,
    canViewWorkflow: true,
    canExportData: false
  })
  
  // View-only mode
  .asViewOnly()
  
  // Hide UI elements
  .hideElements(['.toolbar-export', '.menu-settings'])
  
  // Node libraries
  .withNodeLibraries('data-processing', 'ml-nodes')
  
  // Event handlers
  .onReady(() => console.log('Ready'))
  .onNodeAdded((node) => console.log('Node added:', node))
  .onExecutionCompleted((result) => console.log('Done:', result))
```

### ZealEmbed Instance

```javascript
const embed = await ZealEmbed.create(config)

// Properties
embed.iframe          // HTMLIFrameElement
embed.client          // ZIPClient instance

// Methods
await embed.execute({ inputs: { data: 'test' } })
await embed.save()
await embed.load('workflow_id')
await embed.getWorkflow()
await embed.setWorkflow(workflowData)
await embed.registerNodeTemplates(templates)
embed.updateDisplay({ theme: 'dark' })
embed.destroy()
embed.isReady()
await embed.waitForReady()

// Events (EventEmitter)
embed.on('eventName', handler)
embed.once('eventName', handler)
embed.off('eventName', handler)
```

### ZIPClient

Full access to ZIP protocol APIs:

```javascript
const { client } = embed

// Templates API
await client.templates.register({ namespace: 'custom', templates: [...] })
await client.templates.list('namespace')
await client.templates.update('namespace', 'templateId', updates)
await client.templates.delete('namespace', 'templateId')

// Orchestrator API
await client.orchestrator.createWorkflow({ name: 'New Workflow' })
await client.orchestrator.listWorkflows({ limit: 10 })
await client.orchestrator.getWorkflowState('workflowId')
await client.orchestrator.addNode({ workflowId, templateId, position })
await client.orchestrator.connectNodes({ workflowId, sourceNodeId, targetNodeId })
await client.orchestrator.execute({ workflowId, inputs })

// Traces API
const session = await client.traces.createSession({ workflowId })
await client.traces.submitEvent(sessionId, event)
await client.traces.completeSession(sessionId, { status: 'success' })

// Events API (WebSocket)
await client.events.connect('workflowId')
client.events.on('node.executing', handler)
client.events.updateVisualState([...])
client.events.disconnect()
```

## Events

The SDK emits various events for workflow interactions:

### Execution Events
- `node.executing` - Node starts execution
- `node.completed` - Node execution completed
- `node.failed` - Node execution failed
- `execution.started` - Workflow execution started
- `execution.completed` - Workflow execution completed
- `execution.failed` - Workflow execution failed

### Editor Events
- `ready` - Editor fully loaded
- `nodeAdded` - Node added to workflow
- `nodeUpdated` - Node properties updated
- `nodeDeleted` - Node removed
- `connectionCreated` - Nodes connected
- `connectionDeleted` - Connection removed
- `workflowSaved` - Workflow saved

## Examples

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

### Programmatic Workflow Building

```javascript
const embed = await ZealEmbed.create(config)
const { client } = embed

// Create workflow
const { workflowId } = await client.orchestrator.createWorkflow({
  name: 'Data Pipeline',
  description: 'Automated data processing'
})

// Add nodes
const node1 = await client.orchestrator.addNode({
  workflowId,
  templateId: 'data-source',
  position: { x: 100, y: 100 }
})

const node2 = await client.orchestrator.addNode({
  workflowId,
  templateId: 'data-transform',
  position: { x: 300, y: 100 }
})

// Connect nodes
await client.orchestrator.connectNodes({
  workflowId,
  sourceNodeId: node1.nodeId,
  sourcePortId: 'output',
  targetNodeId: node2.nodeId,
  targetPortId: 'input'
})

// Load in editor
await embed.load(workflowId)
```

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
      inputs: [{ id: 'input', name: 'Input', type: 'any' }],
      outputs: [{ id: 'output', name: 'Output', type: 'any' }]
    },
    properties: {
      mode: { type: 'select', options: ['fast', 'accurate'], default: 'fast' },
      threshold: { type: 'number', default: 0.5, min: 0, max: 1 }
    }
  }
]

await embed.registerNodeTemplates(customTemplates)
```

## Browser Compatibility

The SDK works in all modern browsers that support:
- ES2018+
- WebSocket API
- Fetch API
- EventEmitter pattern

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## TypeScript

The SDK is written in TypeScript and includes complete type definitions.

```typescript
import { 
  ZealEmbed, 
  EmbedConfig, 
  EmbedInstance,
  NodeTemplate,
  WorkflowExecutionResult 
} from '@offbit-ai/zeal-embed-sdk'
```

## Security

### Content Security Policy

If using CSP, add these directives:

```html
<meta http-equiv="Content-Security-Policy" 
      content="frame-src https://your-zeal-instance.com; 
               connect-src https://your-zeal-instance.com wss://your-zeal-instance.com;">
```

### Best Practices

- Never expose auth tokens in client-side code
- Use environment variables for configuration
- Implement token rotation
- Set appropriate CORS policies

## Migration from iframe

If migrating from direct iframe embedding:

### Before
```html
<iframe src="https://zeal.example.com/embed/wf_123?apiKey=key" 
        width="100%" height="600"></iframe>
```

### After
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

## Documentation

- [Full Documentation](https://github.com/offbit-ai/zeal/blob/main/docs/EMBEDDING_GUIDE.md)
- [API Reference](https://zeal.offbit.ai/docs/embed-sdk)
- [Examples](https://github.com/offbit-ai/zeal/tree/main/packages/zeal-embed-sdk/examples)

## Contributing

Contributions are welcome! Please read our [Contributing Guide](https://github.com/offbit-ai/zeal/blob/main/CONTRIBUTING.md) for details.

## License

Apache-2.0 - see [LICENSE](https://github.com/offbit-ai/zeal/blob/main/LICENSE) for details.

## Support

- GitHub Issues: [https://github.com/offbit-ai/zeal/issues](https://github.com/offbit-ai/zeal/issues)
- Documentation: [https://zeal.offbit.ai/docs](https://zeal.offbit.ai/docs)
- Community: [Discord](https://discord.gg/zeal)