# Zeal Embed Orchestrator MCP Server

A Model Context Protocol (MCP) server that exposes Zeal's workflow orchestration capabilities to AI agents. This server allows AI-powered systems to programmatically create and modify workflows through a standardized interface.

## Features

- **Node Operations**: Add nodes to workflows with full metadata and positioning
- **Group Management**: Create and manage node groups for organization
- **Subgraph Creation**: Build reusable subgraphs with defined inputs/outputs
- **Proxy Nodes**: Create references to existing nodes or subgraphs
- **Node Discovery**: Integration with semantic search for finding node templates
- **Connection Management**: Create connections between nodes
- **Secure Access**: API key-based authentication with granular permissions

## Installation

### As an MCP Server

1. Build the server:

```bash
cd mcp/embed-orchestrator
npm install
npm run build
```

2. Add to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "zeal-embed": {
      "command": "node",
      "args": ["/path/to/zeal/mcp/embed-orchestrator/dist/index.js"],
      "env": {
        "DATABASE_URL": "your-database-url"
      }
    }
  }
}
```

## Available Tools

### 1. `add_node`

Add a new node to a workflow graph.

**Parameters:**

- `apiKey` (string, required): Embed API key for authentication
- `workflowId` (string, required): ID of the workflow to modify
- `graphId` (string, optional): ID of the graph (default: "main")
- `metadata` (object, required): Node metadata
  - `type` (string, required): Node type identifier
  - `title` (string, required): Display title
  - `description` (string, optional): Node description
  - `icon` (string, optional): Icon identifier
  - `category` (string, optional): Node category
  - `variant` (string, optional): Visual variant
  - `shape` (string, optional): Node shape
  - `propertyValues` (object, optional): Initial property values
- `position` (object, required): Node position
  - `x` (number, required): X coordinate
  - `y` (number, required): Y coordinate

**Example:**

```json
{
  "tool": "add_node",
  "arguments": {
    "apiKey": "emb_test_abc123",
    "workflowId": "wf_123",
    "metadata": {
      "type": "data-transform",
      "title": "JSON Parser",
      "description": "Parse JSON data",
      "category": "data-processing"
    },
    "position": { "x": 100, "y": 200 }
  }
}
```

### 2. `create_node_group`

Create a new group to organize nodes.

**Parameters:**

- `apiKey` (string, required): Embed API key
- `workflowId` (string, required): Workflow ID
- `graphId` (string, optional): Graph ID (default: "main")
- `group` (object, required): Group configuration
  - `title` (string, required): Group title
  - `description` (string, optional): Group description
  - `nodeIds` (array, required): IDs of nodes to include
  - `color` (string, optional): Group color
  - `collapsed` (boolean, optional): Initial collapsed state

### 3. `create_subgraph`

Create a new subgraph for reusable workflow components.

**Parameters:**

- `apiKey` (string, required): Embed API key
- `workflowId` (string, required): Workflow ID
- `subgraph` (object, required): Subgraph configuration
  - `name` (string, required): Subgraph name
  - `description` (string, optional): Description
  - `inputs` (array, optional): Input port definitions
  - `outputs` (array, optional): Output port definitions

### 4. `create_node_proxy`

Create a proxy node that references another node or subgraph.

**Parameters:**

- `apiKey` (string, required): Embed API key
- `workflowId` (string, required): Workflow ID
- `graphId` (string, optional): Graph ID (default: "main")
- `proxyType` (string, required): "node" or "subgraph"
- `referenceId` (string, required): ID of referenced element
- `position` (object, required): Proxy node position
- `title` (string, optional): Custom title for proxy

### 5. `search_node_templates`

Search for node templates using semantic search.

**Parameters:**

- `query` (string, required): Search query
- `category` (string, optional): Filter by category
- `limit` (number, optional): Max results (default: 10)

### 6. `list_workflow_nodes`

List all nodes in a workflow graph.

**Parameters:**

- `apiKey` (string, required): Embed API key
- `workflowId` (string, required): Workflow ID
- `graphId` (string, optional): Graph ID (default: "main")

### 7. `connect_nodes`

Create a connection between two nodes.

**Parameters:**

- `apiKey` (string, required): Embed API key
- `workflowId` (string, required): Workflow ID
- `graphId` (string, optional): Graph ID (default: "main")
- `sourceNodeId` (string, required): Source node ID
- `sourcePortId` (string, required): Source port ID
- `targetNodeId` (string, required): Target node ID
- `targetPortId` (string, required): Target port ID

## API Key Management

API keys are required for all operations and must have appropriate permissions:

- `canAddNodes`: Required for adding nodes, creating subgraphs, and proxies
- `canEditNodes`: Required for creating connections
- `canAddGroups`: Required for creating node groups
- `canViewWorkflow`: Required for listing nodes

Create API keys through the Zeal web interface or API.

## Integration with AI Agents

This MCP server is designed to work with AI agents that support the Model Context Protocol. The agent can use these tools to:

1. **Workflow Generation**: Create complete workflows from natural language descriptions
2. **Workflow Modification**: Add or modify nodes based on requirements
3. **Template Discovery**: Find appropriate node types using semantic search
4. **Workflow Organization**: Group related nodes and create reusable subgraphs

## Example Workflow Creation

Here's how an AI agent might create a data processing workflow:

1. Search for relevant node templates:

```json
{
  "tool": "search_node_templates",
  "arguments": {
    "query": "read CSV file and transform data",
    "category": "data-processing"
  }
}
```

2. Add nodes based on search results:

```json
{
  "tool": "add_node",
  "arguments": {
    "apiKey": "emb_test_abc123",
    "workflowId": "wf_123",
    "metadata": {
      "type": "csv-reader",
      "title": "Read Customer Data"
    },
    "position": { "x": 100, "y": 100 }
  }
}
```

3. Connect nodes to form the workflow:

```json
{
  "tool": "connect_nodes",
  "arguments": {
    "apiKey": "emb_test_abc123",
    "workflowId": "wf_123",
    "sourceNodeId": "csv-reader-123",
    "sourcePortId": "output",
    "targetNodeId": "data-transform-456",
    "targetPortId": "input"
  }
}
```

## Future Enhancements

- **Node Repository MCP Integration**: Full semantic search capabilities
- **Workflow Execution**: Tools to run and monitor workflows
- **Advanced Orchestration**: Complex workflow patterns and templates
- **Multi-Agent Collaboration**: Support for multiple agents working on the same workflow

## Development

To contribute or modify the MCP server:

1. Clone the repository
2. Install dependencies: `npm install`
3. Run in development mode: `npm run dev`
4. Build for production: `npm run build`

## Environment Variables

- `DATABASE_URL`: PostgreSQL or Supabase connection string
- `USE_SUPABASE`: Set to "true" to use Supabase instead of PostgreSQL

## License

Apache 2.0 - See LICENSE file in the root directory.
