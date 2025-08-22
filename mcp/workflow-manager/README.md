# Zeal Workflow Manager MCP

This MCP (Model Context Protocol) server provides workflow management capabilities for Zeal, allowing AI agents to create, list, update, and manage workflows programmatically.

## Features

- **Create Workflows**: Create new draft workflows with names and descriptions
- **List Workflows**: List all workflows with filtering by status and search
- **Get Workflow Details**: Retrieve full details of a specific workflow
- **Update Workflows**: Update workflow metadata (name, description)
- **Delete Workflows**: Remove workflows from the system
- **Publish Workflows**: Convert draft workflows to published state
- **Get Workflow URLs**: Generate URLs for accessing workflows in UI or embed mode

## Installation

1. Install dependencies:

```bash
cd mcp/workflow-manager
npm install
```

2. Build the TypeScript code:

```bash
npm run build
```

## Usage

### With Claude Desktop

Add the following to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "zeal-workflow-manager": {
      "command": "node",
      "args": ["--loader", "tsx", "/path/to/zeal/mcp/workflow-manager/index.ts"],
      "env": {
        "ZEAL_BASE_URL": "http://localhost:3000",
        "DATABASE_URL": "your-database-url"
      }
    }
  }
}
```

### Available Tools

#### create_workflow

Create a new workflow.

```typescript
{
  name: string,        // Required: Name of the workflow
  description?: string // Optional: Description of the workflow
}
```

Returns:

```json
{
  "success": true,
  "workflow": {
    /* workflow object */
  },
  "url": "/workflow?id=workflow-id",
  "message": "Created workflow \"My Workflow\" with ID: workflow-123"
}
```

#### list_workflows

List all workflows with optional filtering.

```typescript
{
  limit?: number,     // Max workflows to return (default: 20)
  status?: 'draft' | 'published', // Filter by status
  search?: string     // Search by name or description
}
```

#### get_workflow

Get details of a specific workflow.

```typescript
{
  workflowId: string // ID of the workflow
}
```

#### update_workflow

Update workflow metadata.

```typescript
{
  workflowId: string,  // ID of the workflow to update
  name?: string,       // New name
  description?: string // New description
}
```

#### delete_workflow

Delete a workflow.

```typescript
{
  workflowId: string // ID of the workflow to delete
}
```

#### publish_workflow

Publish a draft workflow.

```typescript
{
  workflowId: string // ID of the workflow to publish
}
```

#### get_workflow_url

Get the URL to access a workflow.

```typescript
{
  workflowId: string,   // ID of the workflow
  embedMode?: boolean   // Get embed URL (default: false)
}
```

## Example Usage in AI Conversations

```
User: Create a new workflow for data processing

AI: I'll create a new workflow for you.

[Uses create_workflow tool with name="Data Processing Workflow"]

AI: I've created a new workflow called "Data Processing Workflow" with ID workflow-123.
You can access it at: /workflow?id=workflow-123

Would you like me to help you add nodes to this workflow?
```

## Integration with Embed Orchestrator MCP

Once you have a workflow ID from this MCP, you can use the embed-orchestrator MCP to add nodes, create connections, and build the workflow structure:

```
1. Use workflow-manager MCP to create a workflow
2. Get the workflow ID from the response
3. Use embed-orchestrator MCP with that workflow ID to:
   - Add nodes
   - Create connections
   - Create groups
   - Add subgraphs
```

## Environment Variables

- `ZEAL_BASE_URL`: Base URL of your Zeal instance (default: http://localhost:3000)
- `DATABASE_URL`: Database connection string (required)
- `NODE_ENV`: Environment mode (development/production)

## Development

Run in development mode:

```bash
npm run dev
```

## Notes

- All workflows are created as drafts by default
- Use the publish_workflow tool to make a workflow publicly available
- The workflow manager handles high-level workflow operations
- For node-level operations, use the embed-orchestrator MCP
