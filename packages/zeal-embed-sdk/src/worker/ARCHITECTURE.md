# Zeal Embed Worker-Based Reflow Architecture

## Overview

This document outlines the architecture for integrating Reflow workflow engine with Zeal Embed SDK using Web Workers for same-origin, browser-based execution. The system enables local real-time orchestration while deferring non-critical operations to the API.

## Core Components

### 1. Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Main Thread                           │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Zeal Embed  │  │ Actor System │  │ ZIP Protocol │   │
│  │   Editor    │  │   Registry   │  │    Client    │   │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                  │           │
│         └─────────────────┴──────────────────┘           │
│                           │                              │
│                    MessageChannel                        │
└───────────────────────────┼──────────────────────────────┘
                            │
┌───────────────────────────┼──────────────────────────────┐
│                    SharedWorker                          │
│         ┌─────────────────┴────────────────┐            │
│         │      Event Bridge Manager        │            │
│         └─────────┬───────────┬────────────┘            │
│                   │           │                          │
│  ┌────────────────▼───┐  ┌───▼──────────────┐          │
│  │   Reflow Runtime   │  │  Template Actor   │          │
│  │   (WASM Module)    │  │     Registry      │          │
│  └────────────────────┘  └──────────────────┘          │
│                                                          │
│  ┌─────────────────────────────────────────┐            │
│  │         Graph Converter & Executor       │            │
│  └─────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────┘
```

### 2. Module Structure

```
packages/zeal-embed-sdk/src/worker/
├── runtime/
│   ├── reflow-runtime.worker.ts    # Main SharedWorker implementation
│   ├── reflow-runtime.ts           # Main thread runtime API
│   ├── template-actor.ts           # Template-bound actor system
│   └── graph-converter.ts          # WorkflowGraph to Reflow conversion
├── bridge/
│   ├── event-bridge.ts             # Reflow ↔ Zeal event mapping
│   ├── message-protocol.ts         # Worker communication protocol
│   └── execution-handle.ts         # Execution tracking and control
├── actors/
│   ├── actor-registry.ts           # Actor registration and management
│   ├── actor-builder.ts            # Fluent API for actor creation
│   └── system-actors.ts            # Built-in system actors
├── types/
│   ├── reflow.d.ts                 # Reflow WASM type definitions
│   ├── actor.types.ts              # Actor system types
│   └── events.types.ts             # Event and message types
└── wasm/
    ├── reflow_bg.wasm              # Reflow WASM binary
    └── reflow.js                   # Reflow WASM JS bindings
```

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)

#### 1.1 Worker Setup
```typescript
// runtime/reflow-runtime.worker.ts
import init, { Graph, Network } from '../wasm/reflow';

class ReflowWorker {
  private initialized = false;
  private networks = new Map<string, Network>();
  private templates = new Map<string, NodeTemplate>();
  
  async initialize() {
    await init(); // Initialize WASM
    this.setupMessageHandlers();
    this.initialized = true;
  }
  
  private setupMessageHandlers() {
    self.onconnect = (e) => {
      const port = e.ports[0];
      port.onmessage = (event) => this.handleMessage(event, port);
      port.start();
    };
  }
}
```

#### 1.2 Main Thread Runtime
```typescript
// runtime/reflow-runtime.ts
export class ZealReflowRuntime {
  private worker: SharedWorker;
  private port: MessagePort;
  private actors = new Map<string, TemplateActor>();
  
  constructor(workerUrl = '/worker/reflow-runtime.worker.js') {
    this.worker = new SharedWorker(workerUrl);
    this.port = this.worker.port;
    this.setupPortHandlers();
  }
  
  bindTemplate(templateId: string): TemplateActorBuilder {
    return new TemplateActorBuilder(templateId, this);
  }
}
```

### Phase 2: Event Bridge System (Week 1-2)

#### 2.1 Event Mapping
```typescript
// bridge/event-bridge.ts

export interface EventBridge {
  // Reflow to Zeal events
  mapReflowEvent(reflowEvent: ReflowEvent): ZealEvent[];
  
  // Zeal to Reflow events
  mapZealEvent(zealEvent: ZealEvent): ReflowEvent[];
  
  // Bidirectional sync
  syncState(state: GraphState): void;
}

export class ReflowZealEventBridge implements EventBridge {
  private eventMap = new Map<string, EventMapper>();
  
  constructor() {
    this.registerDefaultMappers();
  }
  
  private registerDefaultMappers() {
    // Node execution events
    this.eventMap.set('node.execute.start', {
      toZeal: (e) => [{
        type: 'NODE_EXECUTION_STARTED',
        nodeId: e.nodeId,
        timestamp: Date.now()
      }],
      toReflow: (e) => [{
        type: 'execute_node',
        node_id: e.nodeId
      }]
    });
    
    // Data flow events
    this.eventMap.set('data.transfer', {
      toZeal: (e) => [{
        type: 'CONNECTION_DATA_TRANSFER',
        sourceNode: e.source,
        targetNode: e.target,
        data: e.data
      }],
      toReflow: (e) => [{
        type: 'send_data',
        from: e.sourceNode,
        to: e.targetNode,
        payload: e.data
      }]
    });
    
    // Error events
    this.eventMap.set('node.error', {
      toZeal: (e) => [{
        type: 'NODE_ERROR',
        nodeId: e.nodeId,
        error: e.error,
        canRetry: e.retriable
      }],
      toReflow: (e) => [{
        type: 'node_failed',
        node_id: e.nodeId,
        reason: e.error
      }]
    });
  }
}
```

#### 2.2 Communication Protocol
```typescript
// bridge/message-protocol.ts

export enum MessageType {
  // Initialization
  INIT = 'INIT',
  READY = 'READY',
  
  // Actor registration
  REGISTER_ACTOR = 'REGISTER_ACTOR',
  ACTOR_REGISTERED = 'ACTOR_REGISTERED',
  
  // Execution
  EXECUTE_GRAPH = 'EXECUTE_GRAPH',
  EXECUTION_STARTED = 'EXECUTION_STARTED',
  EXECUTION_PROGRESS = 'EXECUTION_PROGRESS',
  EXECUTION_COMPLETE = 'EXECUTION_COMPLETE',
  EXECUTION_ERROR = 'EXECUTION_ERROR',
  
  // Control
  PAUSE_EXECUTION = 'PAUSE_EXECUTION',
  RESUME_EXECUTION = 'RESUME_EXECUTION',
  CANCEL_EXECUTION = 'CANCEL_EXECUTION',
  
  // Events
  REFLOW_EVENT = 'REFLOW_EVENT',
  ZEAL_EVENT = 'ZEAL_EVENT'
}

export interface WorkerMessage {
  id: string;
  type: MessageType;
  payload: any;
  timestamp: number;
  source: 'main' | 'worker';
}

export class MessageProtocol {
  private pendingResponses = new Map<string, {
    resolve: Function;
    reject: Function;
    timeout: number;
  }>();
  
  sendMessage(
    port: MessagePort,
    type: MessageType,
    payload: any,
    transferables?: Transferable[]
  ): Promise<any> {
    const id = crypto.randomUUID();
    const message: WorkerMessage = {
      id,
      type,
      payload,
      timestamp: Date.now(),
      source: 'main'
    };
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingResponses.delete(id);
        reject(new Error(`Message ${type} timed out`));
      }, 30000);
      
      this.pendingResponses.set(id, { resolve, reject, timeout });
      port.postMessage(message, transferables || []);
    });
  }
  
  handleResponse(message: WorkerMessage) {
    const pending = this.pendingResponses.get(message.id);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingResponses.delete(message.id);
      pending.resolve(message.payload);
    }
  }
}
```

### Phase 3: Template Actor System (Week 2)

#### 3.1 Actor Registration
```typescript
// actors/actor-registry.ts

export class TemplateActorRegistry {
  private actors = new Map<string, RegisteredActor>();
  private templates = new Map<string, NodeTemplate>();
  
  register(templateId: string, actor: TemplateActor): void {
    this.actors.set(templateId, {
      templateId,
      actor,
      port: null,
      status: 'registered'
    });
  }
  
  async bindToWorker(
    templateId: string,
    workerPort: MessagePort
  ): Promise<void> {
    const registered = this.actors.get(templateId);
    if (!registered) {
      throw new Error(`No actor registered for template ${templateId}`);
    }
    
    // Create MessageChannel for this actor
    const channel = new MessageChannel();
    
    // Send one port to worker
    await this.protocol.sendMessage(
      workerPort,
      MessageType.REGISTER_ACTOR,
      {
        templateId,
        template: this.templates.get(templateId)
      },
      [channel.port1]
    );
    
    // Keep the other port for communication
    registered.port = channel.port2;
    registered.status = 'bound';
    
    // Setup execution handler
    channel.port2.onmessage = async (e) => {
      if (e.data.type === 'EXECUTE') {
        await this.handleActorExecution(
          registered.actor,
          e.data,
          e.ports[0]
        );
      }
    };
  }
  
  private async handleActorExecution(
    actor: TemplateActor,
    data: any,
    responsePort: MessagePort
  ) {
    try {
      const result = await actor.execute(data.inputs, data.context);
      responsePort.postMessage({ success: true, result });
    } catch (error) {
      responsePort.postMessage({ 
        success: false, 
        error: error.message 
      });
    }
  }
}
```

#### 3.2 Actor Builder
```typescript
// actors/actor-builder.ts

export class TemplateActorBuilder {
  private config: ActorConfig = {};
  
  constructor(
    private templateId: string,
    private runtime: ZealReflowRuntime
  ) {
    this.config.templateId = templateId;
  }
  
  handler(fn: ActorHandler): this {
    this.config.handler = fn;
    return this;
  }
  
  streaming(): this {
    this.config.streaming = true;
    return this;
  }
  
  timeout(ms: number): this {
    this.config.timeout = ms;
    return this;
  }
  
  retry(config: RetryConfig): this {
    this.config.retry = config;
    return this;
  }
  
  cache(config: CacheConfig): this {
    this.config.cache = config;
    return this;
  }
  
  register(): ZealReflowRuntime {
    const actor = new TemplateActor(this.config);
    this.runtime.registerActor(this.templateId, actor);
    return this.runtime;
  }
}
```

### Phase 4: Graph Conversion (Week 2-3)

#### 4.1 Graph Converter
```typescript
// runtime/graph-converter.ts

export class WorkflowToReflowConverter {
  constructor(
    private templateRegistry: Map<string, NodeTemplate>
  ) {}
  
  convert(workflow: WorkflowGraph): ReflowGraphData {
    const nodes: ReflowNode[] = [];
    const edges: ReflowEdge[] = [];
    
    // Convert nodes
    for (const node of workflow.nodes) {
      const template = this.templateRegistry.get(node.template.id);
      if (!template) continue;
      
      nodes.push(this.convertNode(node, template));
    }
    
    // Convert connections
    for (const conn of workflow.connections) {
      edges.push(this.convertConnection(conn));
    }
    
    return {
      id: workflow.id,
      name: workflow.name || 'Unnamed Workflow',
      nodes,
      edges,
      metadata: workflow.metadata
    };
  }
  
  private convertNode(
    node: WorkflowNode,
    template: NodeTemplate
  ): ReflowNode {
    return {
      id: node.id,
      type: template.id, // Actor type = template ID
      data: {
        // Node instance data
        nodeId: node.id,
        templateId: template.id,
        
        // Merged properties
        properties: {
          ...template.properties,
          ...node.properties
        },
        
        // Port configurations
        inputs: this.createPortConfig(template.inputs, node.inputs),
        outputs: this.createPortConfig(template.outputs, node.outputs),
        
        // Metadata
        metadata: {
          ...template.metadata,
          ...node.metadata,
          position: node.position,
          ui: node.ui
        }
      }
    };
  }
  
  private convertConnection(conn: WorkflowConnection): ReflowEdge {
    return {
      id: conn.id,
      source: conn.sourceNode,
      sourceHandle: conn.sourcePort || 'output',
      target: conn.targetNode,
      targetHandle: conn.targetPort || 'input',
      data: {
        type: conn.type || 'data',
        metadata: conn.metadata
      }
    };
  }
}
```

### Phase 5: Execution Management (Week 3)

#### 5.1 Execution Handle
```typescript
// bridge/execution-handle.ts

export class ExecutionHandle {
  private eventEmitter = new EventEmitter();
  private state: ExecutionState = 'pending';
  private progress = new Map<string, NodeProgress>();
  
  constructor(
    public readonly id: string,
    private protocol: MessageProtocol,
    private port: MessagePort
  ) {
    this.setupEventHandlers();
  }
  
  // Execution control
  async pause(): Promise<void> {
    await this.protocol.sendMessage(
      this.port,
      MessageType.PAUSE_EXECUTION,
      { executionId: this.id }
    );
    this.state = 'paused';
  }
  
  async resume(): Promise<void> {
    await this.protocol.sendMessage(
      this.port,
      MessageType.RESUME_EXECUTION,
      { executionId: this.id }
    );
    this.state = 'running';
  }
  
  async cancel(): Promise<void> {
    await this.protocol.sendMessage(
      this.port,
      MessageType.CANCEL_EXECUTION,
      { executionId: this.id }
    );
    this.state = 'cancelled';
  }
  
  // Event subscriptions
  on(event: ExecutionEvent, handler: Function): this {
    this.eventEmitter.on(event, handler);
    return this;
  }
  
  once(event: ExecutionEvent, handler: Function): this {
    this.eventEmitter.once(event, handler);
    return this;
  }
  
  // Progress tracking
  getProgress(): ExecutionProgress {
    return {
      state: this.state,
      nodes: Array.from(this.progress.values()),
      completedNodes: this.getCompletedNodes().length,
      totalNodes: this.progress.size,
      percentage: this.calculateProgressPercentage()
    };
  }
  
  // Wait for completion
  async waitForCompletion(): Promise<ExecutionResult> {
    if (this.state === 'completed') {
      return this.result;
    }
    
    return new Promise((resolve, reject) => {
      this.once('complete', resolve);
      this.once('error', reject);
    });
  }
}
```

## Integration Examples

### Basic Usage
```typescript
import { ZealEmbed } from '@offbit/zeal-embed-sdk';
import { ZealReflowRuntime } from '@offbit/zeal-embed-sdk/worker';

// Initialize embed with worker runtime
const embed = new ZealEmbed({
  container: '#editor',
  runtime: new ZealReflowRuntime()
});

// Load templates
const templates = await embed.loadTemplates();

// Register actors for templates
embed.runtime
  .bindTemplate('http-request')
  .handler(async (inputs, context) => {
    const response = await fetch(inputs.url, {
      method: context.properties.method || 'GET',
      headers: context.properties.headers
    });
    return await response.json();
  })
  .register();

embed.runtime
  .bindTemplate('data-transform')
  .handler(async (inputs, context) => {
    const { expression } = context.properties;
    const fn = new Function('data', expression);
    return fn(inputs.data);
  })
  .register();

// Execute workflow
const handle = await embed.runtime.execute(workflowGraph, {
  initialData: { url: 'https://api.example.com' }
});

// Monitor progress
handle.on('progress', (update) => {
  console.log(`Node ${update.nodeId}: ${update.status}`);
});

// Get result
const result = await handle.waitForCompletion();
```

### Streaming Actor
```typescript
embed.runtime
  .bindTemplate('stream-processor')
  .streaming()
  .handler(async function* (inputs, context) {
    const { batchSize = 10 } = context.properties;
    
    for (let i = 0; i < inputs.data.length; i += batchSize) {
      const batch = inputs.data.slice(i, i + batchSize);
      const processed = await processBatch(batch);
      
      yield {
        batch: Math.floor(i / batchSize),
        total: Math.ceil(inputs.data.length / batchSize),
        data: processed
      };
    }
  })
  .register();
```

## Performance Considerations

1. **Worker Pool**: Consider using multiple workers for parallel execution
2. **Message Size**: Implement chunking for large data transfers
3. **Caching**: Cache compiled WASM modules and actor instances
4. **Memory Management**: Implement cleanup for completed executions

## Security Considerations

1. **Sandboxing**: Actors run in worker context, isolated from main thread
2. **Content Security Policy**: Configure CSP for worker scripts
3. **Input Validation**: Validate all inputs before execution
4. **Resource Limits**: Implement timeouts and memory limits

## Testing Strategy

1. **Unit Tests**: Test individual actors and converters
2. **Integration Tests**: Test worker communication and execution
3. **Performance Tests**: Benchmark execution with complex graphs
4. **Browser Compatibility**: Test across different browsers

## Deployment

1. **Build Process**: 
   - Compile Reflow to WASM
   - Bundle worker scripts
   - Generate TypeScript definitions

2. **Distribution**:
   - NPM package with worker scripts
   - CDN distribution for browser usage
   - Separate WASM assets

## Future Enhancements

1. **Multi-worker execution** for parallel node processing
2. **Persistent execution** with IndexedDB storage
3. **Remote actor execution** hybrid mode
4. **Visual debugging** tools integration
5. **Performance profiling** and optimization