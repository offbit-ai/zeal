# Zeal Integration Protocol (ZIP) Specification

## Overview

The Zeal Integration Protocol (ZIP) provides a standardized interface for 3rd party platforms and workflow runtimes to integrate with Zeal's visual workflow editor. This protocol enables external systems to:

- Register custom node templates
- Programmatically orchestrate workflows
- Exchange real-time events
- Submit execution data for visualization
- Access execution history and replay capabilities

## 1. Node Template Ingestion API

### 1.1 Register Node Templates

**Endpoint:** `POST /api/zip/templates/register`

Register custom node templates that will appear in Zeal's node repository.

```typescript
interface RegisterTemplatesRequest {
  namespace: string;           // Unique namespace for your templates
  templates: NodeTemplate[];
  webhookUrl?: string;         // Optional webhook for template events
}

interface NodeTemplate {
  id: string;                  // Unique template ID within namespace
  type: string;                // Node type identifier
  title: string;
  subtitle?: string;
  category: string;            // Category in node repository
  subcategory?: string;
  description: string;
  icon: string;                // Icon identifier or custom SVG
  variant?: string;            // Color variant
  shape?: 'rectangle' | 'circle' | 'diamond';
  size?: 'small' | 'medium' | 'large';
  
  // Port definitions
  ports: {
    id: string;
    label: string;
    type: 'input' | 'output';
    position: 'left' | 'right' | 'top' | 'bottom';
    dataType?: string;         // Expected data type
    required?: boolean;
    multiple?: boolean;        // Allow multiple connections
  }[];
  
  // Property definitions
  properties?: {
    [key: string]: {
      type: 'string' | 'number' | 'boolean' | 'select' | 'code-editor';
      label?: string;
      description?: string;
      defaultValue?: any;
      options?: any[];         // For select type
      validation?: {
        required?: boolean;
        min?: number;
        max?: number;
        pattern?: string;
      };
    };
  };
  
  // Dynamic property rules
  propertyRules?: {
    triggers: string[];        // Properties that trigger rules
    rules: Array<{
      when: string;            // JSONPath condition
      updates: {               // Property updates when condition is met
        [key: string]: any;
      };
    }>;
  };
  
  // Runtime requirements
  runtime?: {
    executor: string;          // Identifier for your runtime
    version?: string;
    requiredEnvVars?: string[];
    capabilities?: string[];   // Required runtime capabilities
  };
}

interface RegisterTemplatesResponse {
  registered: number;
  templates: Array<{
    id: string;
    globalId: string;         // Fully qualified ID with namespace
    status: 'registered' | 'updated' | 'error';
    error?: string;
  }>;
}
```

### 1.2 Update Templates

**Endpoint:** `PUT /api/zip/templates/{namespace}/{templateId}`

Update an existing template definition.

### 1.3 Delete Templates

**Endpoint:** `DELETE /api/zip/templates/{namespace}/{templateId}`

Remove a template from the repository.

### 1.4 List Registered Templates

**Endpoint:** `GET /api/zip/templates/{namespace}`

List all templates registered under a namespace.

## 2. Orchestrator CRDT API

### 2.1 Create Workflow

**Endpoint:** `POST /api/zip/orchestrator/workflows`

```typescript
interface CreateWorkflowRequest {
  name: string;
  description?: string;
  metadata?: Record<string, any>;
}

interface CreateWorkflowResponse {
  workflowId: string;
  graphId: string;             // Main graph ID
  embedUrl: string;            // URL for embedding the workflow
  apiKey?: string;             // API key for programmatic access
}
```

### 2.2 Add Node

**Endpoint:** `POST /api/zip/orchestrator/nodes`

```typescript
interface AddNodeRequest {
  workflowId: string;
  graphId?: string;            // Default: 'main'
  templateId: string;          // Full template ID with namespace
  position: { x: number; y: number };
  propertyValues?: Record<string, any>;
}

interface AddNodeResponse {
  nodeId: string;
  node: {
    id: string;
    type: string;
    position: { x: number; y: number };
    metadata: NodeMetadata;
  };
}
```

### 2.3 Connect Nodes

**Endpoint:** `POST /api/zip/orchestrator/connections`

```typescript
interface ConnectNodesRequest {
  workflowId: string;
  graphId?: string;
  source: {
    nodeId: string;
    portId: string;
  };
  target: {
    nodeId: string;
    portId: string;
  };
}

interface ConnectNodesResponse {
  connectionId: string;
  connection: ConnectionData;
}
```

### 2.4 Update Node Properties

**Endpoint:** `PATCH /api/zip/orchestrator/nodes/{nodeId}`

```typescript
interface UpdateNodeRequest {
  workflowId: string;
  graphId?: string;
  properties?: Record<string, any>;
  position?: { x: number; y: number };
}
```

### 2.5 Create Node Group

**Endpoint:** `POST /api/zip/orchestrator/groups`

```typescript
interface CreateGroupRequest {
  workflowId: string;
  graphId?: string;
  title: string;
  nodeIds: string[];
  color?: string;
  description?: string;
}
```

### 2.6 Get Workflow State

**Endpoint:** `GET /api/zip/orchestrator/workflows/{workflowId}/state`

Returns the current CRDT state of the workflow.

## 3. Bidirectional Event System

### 3.1 WebSocket Connection

**Endpoint:** `wss://your-zeal-instance/zip/events`

#### Authentication

```typescript
// Initial handshake
{
  "type": "auth",
  "apiKey": "your-api-key",
  "workflowId": "workflow-id"
}
```

### 3.2 Zeal Events (Zeal → Runtime)

```typescript
interface ZealEvent {
  id: string;                  // Unique event ID
  timestamp: number;
  workflowId: string;
  type: ZealEventType;
  data: any;
}

enum ZealEventType {
  // Workflow events
  WORKFLOW_CREATED = 'workflow.created',
  WORKFLOW_UPDATED = 'workflow.updated',
  WORKFLOW_DELETED = 'workflow.deleted',
  
  // Node events
  NODE_ADDED = 'node.added',
  NODE_UPDATED = 'node.updated',
  NODE_DELETED = 'node.deleted',
  NODE_PROPERTIES_CHANGED = 'node.properties.changed',
  
  // Connection events
  CONNECTION_CREATED = 'connection.created',
  CONNECTION_DELETED = 'connection.deleted',
  
  // Execution control
  EXECUTION_START = 'execution.start',
  EXECUTION_STOP = 'execution.stop',
  EXECUTION_PAUSE = 'execution.pause',
  EXECUTION_RESUME = 'execution.resume',
  
  // User events
  USER_JOINED = 'user.joined',
  USER_LEFT = 'user.left',
  USER_CURSOR_MOVED = 'user.cursor.moved'
}
```

### 3.3 Runtime Events (Runtime → Zeal)

```typescript
interface RuntimeEvent {
  type: RuntimeEventType;
  workflowId: string;
  timestamp: number;
  data: any;
}

enum RuntimeEventType {
  // Node execution events
  NODE_EXECUTION_START = 'node.execution.start',
  NODE_EXECUTION_SUCCESS = 'node.execution.success',
  NODE_EXECUTION_ERROR = 'node.execution.error',
  NODE_EXECUTION_PROGRESS = 'node.execution.progress',
  
  // Connection flow events
  CONNECTION_FLOW_START = 'connection.flow.start',
  CONNECTION_FLOW_END = 'connection.flow.end',
  CONNECTION_FLOW_ERROR = 'connection.flow.error',
  
  // Workflow execution events
  WORKFLOW_EXECUTION_START = 'workflow.execution.start',
  WORKFLOW_EXECUTION_COMPLETE = 'workflow.execution.complete',
  WORKFLOW_EXECUTION_ERROR = 'workflow.execution.error'
}

// Example: Update node execution state
{
  "type": "node.execution.start",
  "workflowId": "workflow-123",
  "timestamp": 1234567890,
  "data": {
    "nodeId": "node-456",
    "executionId": "exec-789"
  }
}

// Example: Update connection state
{
  "type": "connection.flow.start",
  "workflowId": "workflow-123",
  "timestamp": 1234567890,
  "data": {
    "connectionId": "conn-789",
    "sourceNodeId": "node-123",
    "targetNodeId": "node-456",
    "dataSize": 1024,
    "preview": { "type": "json", "value": {...} }
  }
}
```

### 3.4 Visual State Updates

The runtime can control visual states of nodes and connections:

```typescript
interface VisualStateUpdate {
  type: 'visual.state.update';
  elements: Array<{
    id: string;
    elementType: 'node' | 'connection';
    state: 'idle' | 'pending' | 'running' | 'success' | 'error' | 'warning';
    progress?: number;         // 0-100 for progress indication
    message?: string;          // Status message
    highlight?: boolean;       // Highlight element
    color?: string;           // Override color
  }>;
}
```

## 4. Flow Trace API

### 4.1 Create Trace Session

**Endpoint:** `POST /api/zip/traces/sessions`

```typescript
interface CreateTraceSessionRequest {
  workflowId: string;
  workflowVersionId?: string;
  executionId: string;         // Your runtime's execution ID
  metadata?: {
    trigger?: string;
    environment?: string;
    tags?: string[];
  };
}

interface CreateTraceSessionResponse {
  sessionId: string;
  startTime: string;
}
```

### 4.2 Submit Trace Data

**Endpoint:** `POST /api/zip/traces/{sessionId}/events`

```typescript
interface TraceEvent {
  timestamp: number;
  nodeId: string;
  portId?: string;
  eventType: 'input' | 'output' | 'error' | 'log';
  data: {
    size: number;              // Data size in bytes
    type: string;              // MIME type or data type
    preview?: any;             // Preview of data (truncated)
    fullData?: any;            // Full data (if small enough)
  };
  duration?: number;           // Processing duration in ms
  metadata?: {
    cpuUsage?: number;
    memoryUsage?: number;
    custom?: Record<string, any>;
  };
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

interface SubmitTraceEventsRequest {
  events: TraceEvent[];
}
```

### 4.3 Complete Trace Session

**Endpoint:** `POST /api/zip/traces/{sessionId}/complete`

```typescript
interface CompleteTraceSessionRequest {
  status: 'success' | 'error' | 'cancelled';
  summary?: {
    totalNodes: number;
    successfulNodes: number;
    failedNodes: number;
    totalDuration: number;
    totalDataProcessed: number;
  };
  error?: {
    message: string;
    nodeId?: string;
    stack?: string;
  };
}
```

### 4.4 Batch Trace Submission

**Endpoint:** `POST /api/zip/traces/batch`

For high-throughput scenarios, submit trace data in batches:

```typescript
interface BatchTraceSubmission {
  sessionId: string;
  events: TraceEvent[];
  isComplete?: boolean;        // Mark session as complete
}
```

## 5. Execution History & Replay API

### 5.1 List Execution Sessions

**Endpoint:** `GET /api/zip/executions`

```typescript
interface ListExecutionsRequest {
  workflowId?: string;
  status?: 'running' | 'completed' | 'failed';
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

interface ExecutionSummary {
  sessionId: string;
  workflowId: string;
  workflowName: string;
  startTime: string;
  endTime?: string;
  status: string;
  summary: {
    totalNodes: number;
    successfulNodes: number;
    failedNodes: number;
    totalDuration: number;
  };
}
```

### 5.2 Get Execution Details

**Endpoint:** `GET /api/zip/executions/{sessionId}`

Returns detailed execution data including all trace events.

### 5.3 Get Replay Data

**Endpoint:** `GET /api/zip/executions/{sessionId}/replay`

```typescript
interface ReplayData {
  sessionId: string;
  workflowSnapshot: any;       // Complete workflow state at execution time
  events: Array<{
    timestamp: number;
    relativeTime: number;      // Ms from start
    nodeId: string;
    eventType: string;
    data: any;
  }>;
  timeline: {
    totalDuration: number;
    nodeTimings: Record<string, {
      startTime: number;
      endTime: number;
      duration: number;
    }>;
  };
}
```

### 5.4 Export Execution Data

**Endpoint:** `GET /api/zip/executions/{sessionId}/export`

Query parameters:
- `format`: 'json' | 'csv' | 'opentelemetry'
- `includeData`: Include full data payloads

## 6. Authentication & Authorization

### 6.1 API Key Management

**Endpoint:** `POST /api/zip/auth/keys`

```typescript
interface CreateApiKeyRequest {
  name: string;
  permissions: string[];       // List of permission scopes
  expiresAt?: string;
  metadata?: Record<string, any>;
}

interface ApiKeyResponse {
  id: string;
  key: string;                 // Only returned on creation
  name: string;
  permissions: string[];
  createdAt: string;
  expiresAt?: string;
}
```

### 6.2 Permission Scopes

- `templates:read` - Read template definitions
- `templates:write` - Create/update/delete templates
- `workflows:read` - Read workflow data
- `workflows:write` - Create/update workflows
- `orchestrator:execute` - Execute orchestrator operations
- `traces:write` - Submit trace data
- `traces:read` - Read trace data
- `events:subscribe` - Subscribe to WebSocket events
- `events:publish` - Publish runtime events

## 7. Integration Example: Reflow

Here's how Reflow (actor-based DAG engine) would integrate:

```typescript
// 1. Register Reflow-specific node templates
await zealClient.templates.register({
  namespace: 'reflow',
  templates: [
    {
      id: 'actor-node',
      type: 'reflow-actor',
      title: 'Reflow Actor',
      category: 'reflow',
      ports: [
        { id: 'in', type: 'input', position: 'left' },
        { id: 'out', type: 'output', position: 'right' }
      ],
      properties: {
        actorType: { type: 'string', required: true },
        config: { type: 'code-editor', language: 'json' }
      },
      runtime: {
        executor: 'reflow',
        version: '1.0'
      }
    }
  ]
});

// 2. Subscribe to workflow events
const ws = zealClient.events.connect({
  workflowId: 'workflow-123',
  handlers: {
    'execution.start': async (event) => {
      // Start Reflow execution
      const execution = await reflow.execute(event.data.workflowId);
      
      // Create trace session
      const session = await zealClient.traces.createSession({
        workflowId: event.data.workflowId,
        executionId: execution.id
      });
      
      // Monitor actor events
      execution.on('actor.start', (actor) => {
        // Update visual state
        zealClient.events.send({
          type: 'node.execution.start',
          data: { nodeId: actor.nodeId }
        });
      });
      
      execution.on('message.sent', (msg) => {
        // Submit trace
        zealClient.traces.submitEvent(session.id, {
          nodeId: msg.fromActor,
          eventType: 'output',
          data: { size: msg.size, type: 'reflow-message' }
        });
        
        // Update connection visual
        zealClient.events.send({
          type: 'connection.flow.start',
          data: { 
            sourceNodeId: msg.fromActor,
            targetNodeId: msg.toActor
          }
        });
      });
    }
  }
});

// 3. Handle execution completion
execution.on('complete', async (result) => {
  await zealClient.traces.completeSession(session.id, {
    status: 'success',
    summary: {
      totalNodes: result.actorsExecuted,
      successfulNodes: result.actorsSucceeded,
      totalDuration: result.duration
    }
  });
});
```

## 8. Error Handling

All API endpoints return consistent error responses:

```typescript
interface ErrorResponse {
  error: {
    code: string;              // Machine-readable error code
    message: string;           // Human-readable message
    details?: any;             // Additional error details
    traceId?: string;          // Request trace ID for debugging
  };
}
```

Common error codes:
- `AUTH_INVALID_KEY` - Invalid API key
- `AUTH_INSUFFICIENT_PERMISSIONS` - Missing required permissions
- `RESOURCE_NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Request validation failed
- `RATE_LIMIT_EXCEEDED` - Rate limit exceeded
- `INTERNAL_ERROR` - Internal server error

## 9. Rate Limiting

API rate limits:
- Template operations: 100 requests/hour
- Orchestrator operations: 1000 requests/hour
- Trace submissions: 10000 events/hour
- WebSocket events: 1000 events/minute

Rate limit headers:
- `X-RateLimit-Limit` - Request limit
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Reset timestamp

## 10. SDK Support

Official SDKs will be provided for:
- JavaScript/TypeScript
- Python
- Go
- Rust

Example usage with TypeScript SDK:

```typescript
import { ZealClient } from '@offbit-ai/zeal-sdk';

const client = new ZealClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://your-zeal-instance.com'
});

// Register templates
await client.templates.register({...});

// Create workflow
const workflow = await client.orchestrator.createWorkflow({
  name: 'My Workflow'
});

// Add nodes
const node = await client.orchestrator.addNode({
  workflowId: workflow.id,
  templateId: 'reflow/actor-node',
  position: { x: 100, y: 100 }
});

// Subscribe to events
client.events.on('node.added', (event) => {
  console.log('Node added:', event.data);
});
```

## 11. Versioning

The API uses URL versioning: `/api/v1/zip/*`

Version compatibility:
- Breaking changes will increment major version
- New endpoints/fields are backward compatible
- Deprecated features will be marked and maintained for 6 months

## 12. Health Check

**Endpoint:** `GET /api/zip/health`

Returns service health status:

```typescript
{
  status: 'healthy',
  version: '1.0.0',
  services: {
    api: 'healthy',
    crdt: 'healthy',
    database: 'healthy',
    websocket: 'healthy'
  }
}
```