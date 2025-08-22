# Zeal Orchestrator Agent

The Zeal Orchestrator is an AI-powered interface that allows users to create workflows using natural language. It combines all three MCP servers (workflow-manager, embed-orchestrator, and node-template-repository) to provide an intuitive workflow building experience.

## Overview

The Orchestrator provides:

- Natural language workflow creation
- Automatic node discovery and placement
- Intelligent connection creation
- Real-time workflow visualization
- Chat-based interaction model

## Architecture

### Real-Time Updates

The orchestrator supports real-time updates through CRDT synchronization. As the AI agent adds nodes and creates connections, these changes appear instantly in the embedded workflow view. See [ORCHESTRATOR_REALTIME.md](./ORCHESTRATOR_REALTIME.md) for implementation details.

### Components

1. **Chat Interface** (`/components/orchestrator/ChatInterface.tsx`)
   - Natural language input
   - Conversation history
   - Real-time response streaming
   - Action notifications

2. **Embed View** (`/components/orchestrator/EmbedView.tsx`)
   - Live workflow visualization
   - Embedded workflow editor
   - Real-time updates as nodes are added

3. **Orchestrator Agent** (`/lib/orchestrator/agent.ts`)
   - Natural language understanding
   - Intent extraction
   - Tool orchestration
   - Workflow building logic

4. **MCP Client** (`/lib/orchestrator/mcp-client.ts`)
   - Bridge between frontend and MCP servers
   - API endpoint mapping
   - Request transformation

### Data Flow

```
User Input → Chat Interface → Orchestrator Agent → MCP Client → API Endpoints → MCP Servers
                                                                                      ↓
                                                                                Database/Services
                                                                                      ↓
Embed View ← Workflow Updates ← WebSocket/Polling ← CRDT Store ← Workflow Operations
```

## Configuration

### Environment Variables

Add these to your `.env.local`:

```bash
# OpenRouter Configuration (required)
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet

# Optional: Change the model
# Available models: https://openrouter.ai/models
# Examples:
# - anthropic/claude-3.5-sonnet (recommended)
# - openai/gpt-4-turbo
# - meta-llama/llama-3-70b-instruct
```

### Getting an OpenRouter API Key

1. Sign up at [OpenRouter](https://openrouter.ai)
2. Go to your [API Keys](https://openrouter.ai/keys) page
3. Create a new API key
4. Add credits to your account
5. Copy the key to your `.env.local`

## Usage

### Accessing the Orchestrator

Navigate to `/orchestrator` in your Zeal instance.

### Creating a Workflow

1. **Start with a description**: Type what you want to build

   ```
   "Create a workflow that fetches data from an API and saves it to a database"
   ```

2. **The agent will**:
   - Create a new workflow with an appropriate name
   - Search for relevant node templates
   - Add nodes to the workflow
   - Create connections between nodes
   - Provide feedback on what was created

3. **Continue building**: You can add more functionality
   ```
   "Add error handling and logging to the workflow"
   ```

### Example Interactions

#### Simple Data Pipeline

```
User: "I need to fetch weather data from an API and store it"

Agent: I've created a new workflow "Weather Data Pipeline" and added 2 nodes with 1 connection. The workflow is ready for you to use!

Actions performed:
- Created workflow
- Added HTTP Request node for API calls
- Added Database Insert node for storage
- Connected the API response to the database input
```

#### Complex Integration

```
User: "Build a workflow that monitors GitHub issues, filters by label, and sends notifications to Slack"

Agent: I've created a new workflow "GitHub Issue Monitor" and added 4 nodes with 3 connections. The workflow is ready for you to use!

Actions performed:
- Created workflow
- Added GitHub Issues node
- Added Filter node for label filtering
- Added Transform node for message formatting
- Added Slack Notification node
- Connected all nodes in sequence
```

## Implementation Details

### Intent Extraction

The agent uses an LLM to extract user intent and identify:

- Workflow purpose
- Required nodes (as search queries)
- Node connections
- Suggested workflow name and description

### Node Discovery

The agent searches for nodes using semantic search:

```typescript
const result = await mcpClient.callTool('embed_orchestrator', 'add_node_from_template', {
  workflowId,
  query: 'HTTP API request',
  position: { x: 100, y: 100 },
})
```

### Connection Intelligence

The agent automatically creates connections based on:

- Node input/output compatibility
- Workflow data flow logic
- User intent

### Error Handling

The system handles:

- Failed node searches
- Invalid connections
- API errors
- LLM failures

## API Endpoints

The Orchestrator uses these endpoints:

### Workflow Management

- `POST /api/workflows` - Create workflow
- `GET /api/workflows` - List workflows
- `GET /api/workflows/:id` - Get workflow details

### Node Operations

- `POST /api/orchestrator/nodes/from-template` - Add node from template search
- `POST /api/orchestrator/connections` - Create node connections
- `GET /api/orchestrator/nodes` - List workflow nodes

### Template Search

- `GET /api/templates` - Search templates
- `GET /api/templates/categories` - Get categories

## Extending the Orchestrator

### Adding New Intents

Modify `lib/orchestrator/prompts.ts` to handle new types of requests:

```typescript
export const CUSTOM_INTENT_PROMPT = `
Extract intent for specific workflow types...
`
```

### Custom Node Placement

Implement intelligent node positioning in `agent.ts`:

```typescript
private calculateNodePosition(index: number, total: number) {
  // Custom layout logic
  return {
    x: 100 + (index * 200),
    y: 100 + (index % 2 * 150)
  }
}
```

### Adding Tool Support

Extend `mcp-client.ts` with new tool mappings:

```typescript
'new_mcp_server.tool_name': {
  endpoint: '/api/new-endpoint',
  method: 'POST',
  transformArgs: (args) => ({ /* transform */ })
}
```

## Troubleshooting

### OpenRouter API Issues

- Verify API key is set correctly
- Check OpenRouter credit balance
- Ensure selected model is available

### Workflow Creation Fails

- Check database connection
- Verify MCP server configuration
- Check API endpoint availability

### Nodes Not Found

- Ensure template repository is populated
- Check embedding service configuration
- Verify search service is running

### Connections Not Working

- Verify node IDs are correct
- Check port compatibility
- Ensure workflow is saved

## Best Practices

1. **Clear Descriptions**: Be specific about what you want to build
2. **Iterative Building**: Start simple and add complexity
3. **Use Natural Language**: Describe workflows as you would to a colleague
4. **Provide Context**: Include details about data formats and requirements

## Future Enhancements

- [ ] Multi-turn workflow refinement
- [ ] Workflow templates and patterns
- [ ] Collaborative workflow building
- [ ] Voice input support
- [ ] Workflow optimization suggestions
- [ ] Integration with more LLM providers
