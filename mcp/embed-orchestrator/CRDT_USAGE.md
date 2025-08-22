# Embed Orchestrator MCP - CRDT Usage

## Overview

The Embed Orchestrator MCP server now supports real-time CRDT synchronization for scenarios where the AI agent and embed view are in the same browser tab. This ensures immediate visual feedback as the AI constructs workflows.

## When to Use CRDT Mode

Use CRDT mode (`useCRDT: true`) when:

- The AI agent and embed view are in the same browser tab
- You need real-time visual updates without API round-trips
- Follow mode is enabled in the embed view for auto-scrolling

Use Database mode (`useCRDT: false` or omitted) when:

- The AI agent is running in a different process/server
- You need persistent storage guarantees
- Multiple agents are working on the same workflow from different locations

## Usage Examples

### Adding a Node with CRDT

```json
{
  "tool": "add_node",
  "arguments": {
    "apiKey": "your-api-key",
    "workflowId": "workflow-123",
    "graphId": "main",
    "metadata": {
      "type": "process",
      "title": "Data Processor",
      "description": "Processes incoming data"
    },
    "position": { "x": 300, "y": 200 },
    "useCRDT": true
  }
}
```

### Creating a Connection with CRDT

```json
{
  "tool": "connect_nodes",
  "arguments": {
    "apiKey": "your-api-key",
    "workflowId": "workflow-123",
    "graphId": "main",
    "sourceNodeId": "node-1",
    "sourcePortId": "output",
    "targetNodeId": "node-2",
    "targetPortId": "input",
    "useCRDT": true
  }
}
```

### Creating a Node Group with CRDT

```json
{
  "tool": "create_node_group",
  "arguments": {
    "apiKey": "your-api-key",
    "workflowId": "workflow-123",
    "graphId": "main",
    "group": {
      "title": "Data Pipeline",
      "nodeIds": ["node-1", "node-2", "node-3"],
      "color": "#3b82f6"
    },
    "useCRDT": true
  }
}
```

## How It Works

1. **Initialization**: When `useCRDT: true`, the MCP server initializes the workflow store with the same workflow ID
2. **Shared State**: The workflow store connects to the CRDT server, sharing state with the embed view
3. **Real-time Updates**: Changes made through MCP are immediately reflected in the embed view
4. **Follow Mode**: If the embed has `follow=true`, it auto-scrolls to show new elements

## Benefits

- **Instant Feedback**: Users see nodes appear immediately as the AI adds them
- **Smooth Animation**: Follow mode provides smooth scrolling to new elements
- **Reduced Latency**: No API round-trip delays
- **Synchronized State**: Perfect consistency between AI actions and visual display

## Integration with Orchestrator

In the orchestrator page, the embed view is configured with:

```typescript
const embedUrl = `/embed/${workflowId}?hideHeader=true&collaborative=true&follow=true`
```

This ensures:

- `collaborative=true` - Enables CRDT synchronization
- `follow=true` - Auto-scrolls to AI-created elements

The AI agent should use `useCRDT: true` for all operations when working in this environment.
