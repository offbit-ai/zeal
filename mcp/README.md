# Zeal MCP Servers

This directory contains Model Context Protocol (MCP) servers that provide AI agents with access to Zeal's workflow orchestration and node template repository capabilities.

## Overview

The MCP servers enable AI agents to:

- Search for and discover node templates using semantic search
- Add nodes to workflows based on natural language queries
- Create and manage workflow structures (groups, subgraphs, connections)
- Access node template repository with AI-powered embeddings

## MCP Servers

### 1. Workflow Manager (`workflow-manager/`)

Provides AI agents with high-level workflow management capabilities.

**Tools:**

- `create_workflow` - Create new workflows with names and descriptions
- `list_workflows` - List all workflows with filtering options
- `get_workflow` - Get detailed information about a specific workflow
- `update_workflow` - Update workflow metadata (name, description)
- `delete_workflow` - Delete workflows from the system
- `publish_workflow` - Publish draft workflows
- `get_workflow_url` - Get URLs for accessing workflows in UI or embed mode

**Features:**

- Complete workflow lifecycle management
- No API key required for basic operations
- Integration with WorkflowService and WorkflowStorageService
- Support for both UI and embed mode URLs

### 2. Node Template Repository (`node-template-repository/`)

Provides AI agents with semantic search capabilities over node templates.

**Tools:**

- `search_templates` - Search for node templates using natural language
- `get_template` - Get detailed information about a specific template
- `get_categories` - List all available template categories
- `get_similar_templates` - Find templates similar to a given one
- `create_template` - Create new templates dynamically
- `ingest_templates` - Bulk ingest templates from files

**Features:**

- AI-powered semantic search using OpenAI/Azure/Google embeddings
- Category and tag-based filtering
- Template versioning and metadata extraction
- Support for both PostgreSQL and Supabase databases

### 3. Embed Orchestrator (`embed-orchestrator/`)

Provides AI agents with workflow orchestration capabilities through the embed API.

**Tools:**

- `add_node` - Add a new node to a workflow
- `add_node_from_template` - Search for a template and add it as a node in one step
- `search_node_templates` - Integrated template search (uses node-template-repository)
- `create_node_group` - Create groups of related nodes
- `create_subgraph` - Create modular subgraphs
- `create_node_proxy` - Create proxy nodes that reference other nodes/subgraphs
- `list_workflow_nodes` - List all nodes in a workflow
- `connect_nodes` - Create connections between nodes

**Features:**

- API key-based authentication and permission validation
- Integration with node template repository for semantic search
- Support for workflow composition and organization
- Error handling with detailed feedback

## Integration Architecture

The embed-orchestrator integrates with the node-template-repository by sharing the same underlying services:

```typescript
// Template search integration
const searchService = await getTemplateSearchService()
const searchResults = await searchService.search({ query, category, limit })
```

This allows the embed orchestrator to:

1. Search for templates using AI embeddings
2. Automatically select the best matching template
3. Add it as a configured node to the workflow
4. Set appropriate properties and metadata

## Configuration

### Environment Variables

For AI-powered embeddings, configure the embedding provider:

```bash
# OpenAI (recommended)
EMBEDDING_VENDOR=openai
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_API_KEY=sk-your-openai-key

# Azure OpenAI
EMBEDDING_VENDOR=azure-openai
EMBEDDING_MODEL=text-embedding-ada-002
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_VERSION=2024-02-01
EMBEDDING_API_KEY=your-azure-key

# Development/Testing
EMBEDDING_VENDOR=mock
```

### Database Configuration

```bash
# Use template repository features
USE_TEMPLATE_REPOSITORY=true
AUTO_INGEST_TEMPLATES=true

# Database selection
USE_SUPABASE=false  # Set to true for Supabase, false for PostgreSQL
DATABASE_URL=postgresql://...  # For PostgreSQL
NEXT_PUBLIC_SUPABASE_URL=...   # For Supabase
SUPABASE_SERVICE_ROLE_KEY=...  # For Supabase
```

## Usage Examples

### Using with Claude Desktop

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "zeal-workflow-manager": {
      "command": "node",
      "args": ["--loader", "tsx", "/path/to/zeal/mcp/workflow-manager/index.ts"],
      "env": {
        "DATABASE_URL": "your-database-url"
      }
    },
    "zeal-templates": {
      "command": "node",
      "args": ["/path/to/zeal/mcp/node-template-repository/index.ts"]
    },
    "zeal-orchestrator": {
      "command": "node",
      "args": ["/path/to/zeal/mcp/embed-orchestrator/index.ts"]
    }
  }
}
```

### Example AI Interactions

**Workflow Management:**

```
AI: "Create a new workflow for data processing"
→ Uses create_workflow("Data Processing Pipeline", "ETL workflow for customer data")
→ Returns workflow ID and URL

AI: "List all my draft workflows"
→ Uses list_workflows(status: "draft")
→ Returns list of draft workflows with IDs and names
```

**Template Search:**

```
AI: "I need to add a node that can fetch data from a REST API"
→ Uses search_node_templates("REST API data fetching")
→ Returns relevant HTTP request and API connector templates
```

**Workflow Creation:**

```
AI: "Create a data processing workflow with an API source and database sink"
→ Uses add_node_from_template("REST API", position: {x: 100, y: 100})
→ Uses add_node_from_template("database connector", position: {x: 300, y: 100})
→ Uses connect_nodes(source_node, "output", target_node, "input")
```

**Template Discovery:**

```
AI: "What templates are available for machine learning?"
→ Uses search_templates("machine learning", category: "ai-models")
→ Returns OpenAI, Hugging Face, and other ML templates
```

**Complete Workflow Example:**

```
User: "Create a workflow that fetches data from an API and saves it to a database"

AI: I'll help you create that workflow. Let me start by creating a new workflow.
→ Uses create_workflow("API to Database Pipeline", "Fetch data from API and store in database")
→ Gets workflow ID: "workflow-123"

AI: Now I'll add the necessary nodes to your workflow.
→ Uses add_node_from_template("HTTP Request", workflowId: "workflow-123", position: {x: 100, y: 100})
→ Uses add_node_from_template("Database Insert", workflowId: "workflow-123", position: {x: 400, y: 100})
→ Uses connect_nodes(httpNode.id, "response", dbNode.id, "data")

AI: Your workflow is ready! You can access it at: /workflow?id=workflow-123
```

## Development

### Building

```bash
# Build node-template-repository
cd mcp/node-template-repository
npm run build

# Build embed-orchestrator
cd mcp/embed-orchestrator
npm run build
```

### Testing

```bash
# TypeScript compilation check
npx tsc --noEmit

# Test MCP server
node index.ts
```

### Adding New Tools

1. Define the tool schema in the `tools` array
2. Add the handler in the `CallToolRequestSchema` switch statement
3. Implement the business logic using existing services
4. Add proper error handling and validation

## Security

- All embed orchestrator operations require valid API keys
- Permission-based access control (view, add nodes, edit, etc.)
- Input validation and sanitization
- Rate limiting and error handling for embedding services

## Performance

- Embedding services support batch processing
- Template search uses optimized vector similarity
- Database operations are pooled and cached
- Lazy initialization of services to reduce startup time

## Troubleshooting

**Template search not working:**

- Check embedding vendor configuration
- Verify database connection and schema
- Ensure templates have been ingested

**Embed operations failing:**

- Verify API key permissions
- Check workflow exists and is accessible
- Validate node metadata and position parameters

**TypeScript errors:**

- Ensure correct tsconfig.json setup
- Check that all required services are included
- Verify import paths are correct for cross-directory references
