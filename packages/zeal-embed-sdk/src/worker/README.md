# Zeal Embed Worker Runtime

Browser-based workflow execution using Reflow WASM and SharedWorkers.

## Features

- **Local Execution**: Run workflows entirely in the browser
- **Template-Based Actors**: Bind JavaScript functions to node templates
- **Real-time Updates**: Stream execution progress and results
- **Worker Isolation**: Non-blocking execution in SharedWorker
- **Event Bridge**: Bidirectional event mapping between Reflow and Zeal

## Quick Start

```typescript
import { ZealEmbed } from '@offbit/zeal-embed-sdk';
import { ZealReflowRuntime } from '@offbit/zeal-embed-sdk/worker';

// Initialize embed with worker runtime
const embed = new ZealEmbed({
  container: '#editor',
  runtime: new ZealReflowRuntime()
});

// Register actor for a template
embed.runtime
  .bindTemplate('http-request')
  .handler(async (inputs, context) => {
    const response = await fetch(inputs.url);
    return await response.json();
  })
  .register();

// Execute workflow
const handle = await embed.runtime.execute(workflowGraph);
const result = await handle.waitForCompletion();
```

## Architecture

```
Main Thread (UI)
    ↓
MessageChannel
    ↓
SharedWorker
    ├── Reflow WASM Runtime
    ├── Template Actor Registry
    └── Event Bridge
```

## Actor Registration

Actors are JavaScript functions bound to specific node templates:

```typescript
embed.runtime
  .bindTemplate('data-processor')
  .handler(async (inputs, context) => {
    // Access template properties
    const { algorithm } = context.properties;
    
    // Process data
    return processData(inputs.data, algorithm);
  })
  .timeout(5000) // 5 second timeout
  .retry({ maxAttempts: 3 })
  .register();
```

## Streaming Actors

Support for progressive/streaming results:

```typescript
embed.runtime
  .bindTemplate('stream-processor')
  .streaming()
  .handler(async function* (inputs, context) {
    for (const item of inputs.data) {
      const processed = await processItem(item);
      yield { processed, progress: context.progress };
    }
  })
  .register();
```

## Event Handling

Monitor workflow execution with events:

```typescript
const handle = await embed.runtime.execute(graph);

handle.on('progress', (update) => {
  console.log(`Node ${update.nodeId}: ${update.status}`);
});

handle.on('error', (error) => {
  console.error('Execution failed:', error);
});
```

## Browser Compatibility

- Chrome 89+ (SharedWorker support)
- Firefox 29+ (SharedWorker support)
- Safari 16+ (SharedWorker support)
- Edge 79+ (Chromium-based)

## Building

```bash
# Install dependencies
npm install

# Build WASM module
npm run build:wasm

# Build worker bundle
npm run build:worker

# Run tests
npm test
```

## Performance

- **Zero-latency** for local operations
- **Non-blocking** execution in worker thread
- **Efficient** message passing with MessageChannel
- **Optimized** WASM execution with Reflow

## Security

- Actors run in isolated worker context
- No direct DOM access from actors
- Input validation before execution
- Configurable timeouts and resource limits