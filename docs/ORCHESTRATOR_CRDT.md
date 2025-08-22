# Orchestrator API - CRDT Mode

## Overview

The Orchestrator API endpoints now support real-time CRDT synchronization for scenarios where the AI agent and embed view need instant visual feedback. This is perfect for live workflow construction demonstrations.

## API Endpoints with CRDT Support

### 1. Add Node from Template

**Endpoint**: `POST /api/orchestrator/nodes/from-template`

**Request Body**:

```json
{
  "workflowId": "workflow-123",
  "query": "data processor node",
  "graphId": "main",
  "position": { "x": 300, "y": 200 },
  "propertyValues": {},
  "useCRDT": true // Enable CRDT mode
}
```

**Response**:

```json
{
  "success": true,
  "node": {
    "id": "process-1234567890",
    "metadata": { ... },
    "position": { "x": 300, "y": 200 }
  },
  "template": {
    "id": "data-processor",
    "title": "Data Processor",
    "category": "processing"
  },
  "usedCRDT": true
}
```

### 2. Create Connection

**Endpoint**: `POST /api/orchestrator/connections`

**Request Body**:

```json
{
  "workflowId": "workflow-123",
  "graphId": "main",
  "sourceNodeId": "node-1",
  "sourcePortId": "output",
  "targetNodeId": "node-2",
  "targetPortId": "input",
  "useCRDT": true // Enable CRDT mode
}
```

**Response**:

```json
{
  "success": true,
  "connection": {
    "id": "conn-1234567890",
    "source": { "nodeId": "node-1", "portId": "output" },
    "target": { "nodeId": "node-2", "portId": "input" },
    "state": "idle"
  },
  "usedCRDT": true
}
```

## Integration with Orchestrator UI

When using the orchestrator UI (`/orchestrator`), the embed view is configured with:

- `collaborative=true` - Enables CRDT synchronization
- `follow=true` - Auto-scrolls to new elements

To enable real-time updates, include `useCRDT: true` in API requests:

```javascript
// Example: Adding a node with real-time updates
const response = await fetch('/api/orchestrator/nodes/from-template', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    workflowId: currentWorkflowId,
    query: 'data processing node',
    position: { x: 400, y: 300 },
    useCRDT: true, // Real-time sync
  }),
})
```

## Benefits of CRDT Mode

1. **Instant Visual Feedback**: Nodes and connections appear immediately in the embed view
2. **Smooth Animations**: Follow mode provides smooth scrolling to new elements
3. **No Latency**: Changes bypass API persistence layer for immediate updates
4. **Perfect Sync**: AI actions and visual display are perfectly synchronized

## When to Use CRDT Mode

**Use CRDT** (`useCRDT: true`) when:

- Running in the orchestrator UI with embed view
- Need real-time visual feedback
- AI and embed are in the same browser context
- Demonstrating workflow construction live

**Use Database Mode** (`useCRDT: false` or omitted) when:

- Running headless or from external services
- Need guaranteed persistence
- Multiple agents working from different locations
- Production workflows requiring durability

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   AI Agent      │────►│ Orchestrator API │────►│ Workflow Store  │
│                 │     │  (useCRDT=true)  │     │    (CRDT)       │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                           │
                              ┌────────────────────────────┘
                              ▼
                        ┌─────────────────┐
                        │   Embed View    │
                        │ (follow=true)   │
                        └─────────────────┘
```

## Example: Building a Workflow with Real-time Updates

```javascript
// 1. Add first node
await fetch('/api/orchestrator/nodes/from-template', {
  method: 'POST',
  body: JSON.stringify({
    workflowId: 'demo-workflow',
    query: 'read file',
    position: { x: 100, y: 200 },
    useCRDT: true,
  }),
})
// → Node appears instantly, view scrolls to it

// 2. Add second node
await fetch('/api/orchestrator/nodes/from-template', {
  method: 'POST',
  body: JSON.stringify({
    workflowId: 'demo-workflow',
    query: 'process data',
    position: { x: 400, y: 200 },
    useCRDT: true,
  }),
})
// → Second node appears, view scrolls to it

// 3. Connect the nodes
await fetch('/api/orchestrator/connections', {
  method: 'POST',
  body: JSON.stringify({
    workflowId: 'demo-workflow',
    sourceNodeId: 'file-reader-123',
    sourcePortId: 'output',
    targetNodeId: 'data-processor-456',
    targetPortId: 'input',
    useCRDT: true,
  }),
})
// → Connection appears, view scrolls to midpoint
```
