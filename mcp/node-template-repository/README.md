# Node Template Repository MCP Server

A Model Context Protocol (MCP) server that provides AI agents with access to the Zeal node template repository for searching, discovering, and composing workflow templates.

## Features

- **Semantic Search**: Natural language search across all node templates
- **Template Discovery**: Find templates by category, capabilities, or similarity
- **Workflow Composition**: AI-assisted workflow creation from requirements
- **Compatibility Checking**: Validate connections between templates
- **Template Ingestion**: Import templates from file system

## Installation

```bash
cd mcp/node-template-repository
npm install
npm run build
```

## Usage

### With Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "node-templates": {
      "command": "node",
      "args": ["/path/to/zeal/mcp/node-template-repository/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://user:password@localhost:5432/zeal",
        "EMBEDDING_PROVIDER": "openai",
        "OPENAI_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Standalone

```bash
# Set environment variables
export DATABASE_URL="postgresql://user:password@localhost:5432/zeal"
export EMBEDDING_PROVIDER="mock"  # or "openai" for real embeddings

# Run the server
npm start
```

## Available Tools

### search_templates

Search for node templates using natural language queries.

```typescript
{
  query: "api data source for REST endpoints",
  category: "data-sources",
  tags: ["api", "rest"],
  capabilities: ["data-fetch"],
  limit: 20
}
```

### get_template

Get detailed information about a specific template.

```typescript
{
  templateId: 'tpl_rest_api'
}
```

### find_similar_templates

Find templates similar to a given template.

```typescript
{
  templateId: "tpl_openai_chat",
  limit: 10
}
```

### get_recommendations

Get template recommendations based on context.

```typescript
{
  recentlyUsed: ["tpl_rest_api", "tpl_json_parser"],
  workflowCategory: "data-processing",
  currentNodes: ["tpl_rest_api"]
}
```

### compose_workflow

Compose a workflow from templates based on requirements.

```typescript
{
  requirements: "I need to fetch data from an API, transform it, and save to a database",
  constraints: {
    maxNodes: 5,
    requiredCapabilities: ["data-fetch", "transform", "database"],
    preferredTemplates: ["tpl_rest_api"]
  }
}
```

### validate_template_compatibility

Check if two templates can be connected.

```typescript
{
  sourceTemplateId: "tpl_rest_api",
  targetTemplateId: "tpl_json_parser",
  sourcePortId: "response-data",
  targetPortId: "input-data"
}
```

### get_categories

Get the category tree of available templates.

```typescript
{
} // No parameters required
```

### ingest_templates

Ingest templates from the file system (admin operation).

```typescript
{
  paths: ["data/nodeTemplates"],
  force: false
}
```

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string (required)
- `EMBEDDING_PROVIDER`: Provider for embeddings (`openai`, `local`, or `mock`)
- `OPENAI_API_KEY`: OpenAI API key (required if using OpenAI embeddings)
- `EMBEDDING_MODEL`: Model to use for embeddings (default: text-embedding-ada-002)

## Example Conversations

### Finding Templates

```
Human: Find me templates that can process JSON data
```
