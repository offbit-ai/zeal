# GraphRAG Usage Guide

## Overview

GraphRAG (Graph Retrieval Augmented Generation) has been implemented in Zeal to solve the problem of irrelevant and duplicate nodes being added by the orchestrator agent. This guide explains how it works and how to use it.

## Problems Solved

1. **Irrelevant Nodes**: Previously, when asking for Slack integration, the agent might add Discord nodes
2. **Duplicate Nodes**: Multiple instances of the same service (e.g., two Slack Webhook nodes)
3. **Poor Connection Logic**: Nodes that don't logically connect together
4. **No Service Awareness**: Agent didn't understand which nodes work with which services

## How GraphRAG Works

### 1. Knowledge Graph Construction

When the system starts, it builds a knowledge graph from all available node templates:

```
Templates → Graph Nodes → Relationships → Service/Capability Mapping
```

The graph includes:
- **Template Nodes**: Each node template
- **Service Nodes**: Services like Slack, Discord, GitHub
- **Capability Nodes**: Actions like send, receive, transform
- **Relationships**: How nodes connect and which are alternatives

### 2. Intelligent Node Selection

When a user makes a request:

1. **Intent Extraction**: GraphRAG analyzes the request to identify:
   - Required services (e.g., "slack", "github")
   - Required capabilities (e.g., "receive webhook", "send message")
   - Data flow requirements

2. **Graph Query**: The system queries the knowledge graph to find:
   - Nodes that integrate with the requested services
   - Nodes with the required capabilities
   - Nodes that can connect to form a complete workflow

3. **Relevance Scoring**: Each node gets a score based on:
   - Service match (+10 points for exact service)
   - Capability match (+5 points for each capability)
   - Connection potential (+3 points if it connects well)
   - Service penalty (-20 points for competing services)

4. **Duplicate Prevention**: The system ensures:
   - No two nodes provide the same capability for the same service
   - Alternative nodes (e.g., Discord vs Slack) are not mixed

## Usage

### Automatic Mode (Default)

GraphRAG is automatically enabled when you start the application. You'll see a status indicator in the chat interface:

- ✅ GraphRAG enabled - Full intelligent node selection
- ⚠️ GraphRAG unavailable - Fallback to traditional search

### Example Requests

**Good Request:**
```
"Create a workflow to monitor PR requests from my github repository 
https://github.com/offbit-ai/zeal and send a slack message to #new_pr channel"
```

GraphRAG will:
1. Identify services: GitHub, Slack
2. Find GitHub webhook receiver node
3. Find Slack webhook sender node
4. NOT add Discord or duplicate Slack nodes
5. Create optimal connections

**Complex Request:**
```
"Monitor my GitHub repo for new issues, transform the data to include 
only critical issues, and send notifications to both Slack and email"
```

GraphRAG will:
1. Find GitHub issue webhook node
2. Add data transformer/filter node
3. Add Slack notification node
4. Add email sender node
5. Create proper data flow connections

## Architecture

### Graph Structure

```typescript
// Node Types
- Template: Actual workflow nodes
- Service: External services (Slack, GitHub, etc.)
- Capability: What nodes can do (send, receive, etc.)
- DataType: Data formats nodes work with

// Relationships
- INTEGRATES_WITH: Template uses a service
- HAS_CAPABILITY: Template provides a capability
- CAN_CONNECT_TO: Templates can be connected
- ALTERNATIVE_TO: Templates are alternatives (Slack vs Discord)
- COMMONLY_USED_WITH: Templates often used together
```

### Components

1. **GraphBuilder** (`/lib/knowledge-graph/graph-builder.ts`)
   - Builds graph from templates
   - Extracts services and capabilities
   - Creates relationships

2. **GraphRAGEngine** (`/lib/knowledge-graph/graphrag-engine.ts`)
   - Queries the graph
   - Scores relevance
   - Prevents duplicates
   - Finds optimal paths

3. **OrchestratorAgent** (`/lib/orchestrator/agent.ts`)
   - Uses GraphRAG when available
   - Falls back to search if needed
   - Integrates results into workflow

## Debugging

Enable debug logging to see GraphRAG decisions:

```javascript
// In browser console
localStorage.setItem('DEBUG_GRAPHRAG', 'true')
```

This will show:
- Intent extraction results
- Node scoring details
- Duplicate prevention decisions
- Connection optimization

## Performance

- Graph building: ~1-2 seconds on startup
- Node selection: ~100-200ms per request
- Memory usage: ~10-20MB for typical template set

## Future Improvements

1. **Learning**: Track successful workflows to improve scoring
2. **Custom Rules**: Allow users to define preferences
3. **Explanation UI**: Show why nodes were selected
4. **Graph Visualization**: Interactive graph explorer

## Troubleshooting

### GraphRAG Not Working

1. Check browser console for errors
2. Ensure database has templates: `npm run templates:ingest`
3. Try force refresh: Ctrl+Shift+R

### Wrong Nodes Selected

1. Check if templates have correct metadata
2. Verify service detection in template descriptions
3. Enable debug logging to see scoring

### Performance Issues

1. Check template count (should be < 1000 for client-side)
2. Consider server-side GraphRAG for large deployments
3. Use `--trace-warnings` flag to debug Node.js issues