# Zeal AI Integrations with GraphRAG

Powerful AI integrations for the Zeal workflow orchestration platform, enabling GPT models and Claude to create, manage, and optimize workflows through natural language.

## 🎯 Overview

This repository contains two production-ready AI integration servers:

1. **OpenAI Functions Server** - Exposes Zeal's capabilities as OpenAI function calls for GPT models
2. **Anthropic MCP Server** - Implements Model Context Protocol for deep Claude integration

Both servers leverage the Zeal Integration Protocol (ZIP) to provide comprehensive workflow orchestration capabilities to AI models.

## 🚀 Features

### Common Capabilities
- ✅ **Workflow Management** - Create, update, delete, and execute workflows
- ✅ **Node Operations** - Add nodes, create connections, configure properties
- ✅ **Execution Monitoring** - Real-time status updates and flow traces
- ✅ **Template Search** - Semantic search for node templates
- ✅ **Analytics** - Query performance metrics and historical data
- ✅ **Authentication** - Secure API key and JWT support
- ✅ **Rate Limiting** - Configurable limits per user/organization

### OpenAI Functions Specific
- 🤖 **GPT-4 Optimized** - Functions designed for GPT-4's capabilities
- 📊 **Streaming Support** - Real-time execution updates
- 🔄 **Async Operations** - Non-blocking workflow execution
- 📝 **Detailed Schemas** - Comprehensive parameter validation

### MCP Server Specific
- 🧠 **Contextual Understanding** - Deep workflow context for Claude
- 🎨 **AI-Powered Design** - Automatic workflow generation from descriptions
- 🔧 **Intelligent Optimization** - Performance analysis and improvements
- 🐛 **Smart Debugging** - AI-assisted error resolution
- 💡 **Natural Language** - Convert descriptions to workflows

### GraphRAG-Enhanced Features (When Enabled)
- 🔍 **Semantic Node Search** - Find nodes by meaning, not just keywords
- 🎯 **Service-Aware Selection** - Won't mix competing services (e.g., Slack/Discord)
- 🔗 **Intelligent Connections** - Generates logical data flow automatically
- 📊 **Graph-Based Analysis** - Identifies redundancies and missing capabilities
- 🧪 **Context-Aware Testing** - Generates tests based on workflow structure

## 📦 Installation

### Prerequisites
- Node.js 20+
- Zeal platform running (localhost:3000 by default)
- API keys for Zeal
- OPENROUTER_API_KEY (optional, enables GraphRAG AI features)

### Build GraphRAG Knowledge Graph

For enhanced AI capabilities, build the GraphRAG knowledge graph:

```bash
# Run setup script from Zeal root directory
./ai-integrations/setup-ai.sh

# Or manually build GraphRAG
OPENROUTER_API_KEY=your_key npm run graphrag:build
```

This creates a semantic knowledge graph enabling:
- Intelligent node selection based on context
- Automatic duplicate prevention
- Optimal connection generation
- Context-aware workflow optimization

### OpenAI Functions Server

```bash
cd ai-integrations/openai-functions
npm install
npm run build
npm start
```

### MCP Server

```bash
cd ai-integrations/mcp-server
npm install
npm run build
npm start
```

## 🔧 Configuration

### OpenAI Functions Server

Create a `.env` file:

```env
# Server Configuration
PORT=3456
NODE_ENV=production

# Zeal Integration
ZEAL_API_URL=http://localhost:3000
ZEAL_API_KEY=your-zeal-api-key

# GraphRAG AI Features (optional but recommended)
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_MODEL=anthropic/claude-3-haiku-20240307

# Authentication
JWT_SECRET=your-jwt-secret
API_KEY_HEADER=X-API-Key

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Redis (optional, for caching)
REDIS_URL=redis://localhost:6379
```

### MCP Server

Create a `.env` file:

```env
# Server Configuration
MCP_TRANSPORT=stdio  # or 'sse' for server-sent events
PORT=3457  # Only for SSE transport

# Zeal Integration
ZEAL_API_URL=http://localhost:3000
ZEAL_API_KEY=your-zeal-api-key

# GraphRAG AI Features (optional but recommended)
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_MODEL=anthropic/claude-3-haiku-20240307

# GraphRAG AI Features (optional but recommended)
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_MODEL=anthropic/claude-3-haiku-20240307

# AI Features
ENABLE_AI_OPTIMIZATION=true
ENABLE_AUTO_DESIGN=true
ENABLE_SMART_DEBUG=true

# Caching
CACHE_TTL=3600
MAX_CACHE_SIZE=100
```

## 🎮 Usage

### OpenAI Functions with GPT-4

```python
from openai import OpenAI

client = OpenAI()

# Create a workflow using GPT-4
response = client.chat.completions.create(
    model="gpt-4-turbo-preview",
    messages=[
        {
            "role": "user",
            "content": "Create a workflow that fetches data from an API, transforms it, and saves to a database"
        }
    ],
    tools=load_tools_from_server("http://localhost:3456/tools"),
    tool_choice="auto"
)

# Process function calls
for tool_call in response.choices[0].message.tool_calls:
    result = execute_function(tool_call.function.name, tool_call.function.arguments)
    print(f"Executed: {tool_call.function.name}")
```

### OpenAI Assistant Integration

```javascript
// Create an assistant with Zeal functions
const assistant = await openai.beta.assistants.create({
  name: "Workflow Designer",
  instructions: "You help users design and execute workflows",
  tools: await loadZealFunctions(),
  model: "gpt-4-turbo-preview"
});

// Use the assistant
const thread = await openai.beta.threads.create();
await openai.beta.threads.messages.create(thread.id, {
  role: "user",
  content: "Create a data processing pipeline"
});

const run = await openai.beta.threads.runs.create(thread.id, {
  assistant_id: assistant.id
});
```

### MCP with Claude Desktop

1. Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "zeal": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "ZEAL_API_KEY": "your-key"
      }
    }
  }
}
```

2. Restart Claude Desktop

3. Use natural language:
```
"Create a workflow that monitors a website for changes and sends notifications"
```

### MCP Programmatic Usage

```typescript
import { MCPClient } from '@modelcontextprotocol/sdk';

const client = new MCPClient({
  name: 'zeal-client',
  version: '1.0.0'
});

// Connect to MCP server
await client.connect({
  transport: 'stdio',
  command: 'node',
  args: ['path/to/mcp-server/dist/index.js']
});

// Use tools
const result = await client.callTool('workflow_create', {
  name: 'Data Pipeline',
  requirements: 'Process CSV files and store in database',
  auto_design: true
});

// Access resources
const workflows = await client.readResource('workflow://list');
```

## 🧪 Testing

### Run Tests

```bash
# OpenAI Functions Server
cd openai-functions
npm test

# MCP Server
cd mcp-server
npm test
```

### Integration Testing

```bash
# Test with actual Zeal instance
ZEAL_API_URL=http://localhost:3000 npm run test:integration
```

## 📊 Available Functions/Tools

### Workflow Management
- `create_workflow` - Create new workflows
- `update_workflow` - Modify existing workflows
- `delete_workflow` - Remove workflows
- `list_workflows` - Get all workflows
- `get_workflow` - Get workflow details

### Node Operations
- `add_node` - Add nodes to workflows
- `update_node` - Modify node properties
- `delete_node` - Remove nodes
- `connect_nodes` - Create connections
- `disconnect_nodes` - Remove connections

### Execution Control
- `execute_workflow` - Run workflows
- `get_execution_status` - Check execution status
- `cancel_execution` - Stop running executions
- `stream_execution_events` - Real-time updates

### Templates & Search
- `search_node_templates` - Find node templates
- `get_template_details` - Template information
- `register_template` - Add custom templates

### Analytics & Monitoring
- `query_flow_traces` - Historical execution data
- `get_analytics` - Performance metrics
- `get_execution_logs` - Detailed logs

### AI-Powered (MCP Only)
- `workflow_optimize` - Performance optimization (GraphRAG-enhanced when available)
- `node_suggest` - Smart node recommendations (uses semantic search with GraphRAG)
- `debug_execution` - AI debugging assistance
- `generate_test_data` - Test data generation (context-aware with GraphRAG)
- `workflow_from_description` - Natural language to workflow (GraphRAG-powered design)
- `explain_workflow` - Generate explanations with technical analysis
- `compare_workflows` - Compare and suggest improvements

## 🔐 Security

### Authentication Methods

1. **API Key** - Header-based authentication
```bash
curl -H "X-API-Key: your-key" http://localhost:3456/functions
```

2. **JWT** - Token-based authentication
```bash
curl -H "Authorization: Bearer your-jwt" http://localhost:3456/functions
```

3. **OAuth 2.0** - For production deployments (optional)

### Rate Limiting

Default limits:
- 100 requests per minute per API key
- 1000 requests per hour per organization
- Configurable via environment variables

## 📈 Monitoring

### Metrics Exposed

- Function call frequency
- Response times (p50, p95, p99)
- Error rates by function
- Token usage (for cost tracking)
- Active connections
- Cache hit rates

### Health Endpoints

```bash
# OpenAI Functions Server
GET http://localhost:3456/health
GET http://localhost:3456/metrics

# MCP Server
GET http://localhost:3457/health
GET http://localhost:3457/mcp/status
```

## 🚢 Deployment

### Docker

```dockerfile
# OpenAI Functions Server
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3456
CMD ["node", "dist/index.js"]
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: zeal-ai-functions
spec:
  replicas: 3
  selector:
    matchLabels:
      app: zeal-ai-functions
  template:
    metadata:
      labels:
        app: zeal-ai-functions
    spec:
      containers:
      - name: openai-functions
        image: zeal/openai-functions:latest
        ports:
        - containerPort: 3456
        env:
        - name: ZEAL_API_KEY
          valueFrom:
            secretKeyRef:
              name: zeal-secrets
              key: api-key
```

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
# Clone repository
git clone https://github.com/offbit-ai/zeal.git
cd zeal/ai-integrations

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test
```

## 📚 Documentation

- [OpenAI Functions Guide](./openai-functions/docs/README.md)
- [MCP Server Guide](./mcp-server/docs/README.md)
- [API Reference](./docs/API.md)
- [Examples](./examples/)

## 📊 GraphRAG Architecture

The GraphRAG system enhances AI capabilities through a knowledge graph:

```
Node Templates → LLM Analysis → Knowledge Graph → AI Features
```

### Graph Components
- **Template Nodes**: Workflow components with capabilities
- **Service Nodes**: External services (Slack, GitHub, MongoDB, etc.)
- **Capability Nodes**: Actions (send_message, transform_data, etc.)
- **Relationships**: 
  - INTEGRATES_WITH: Template uses a service
  - HAS_CAPABILITY: Template provides capability
  - CAN_CONNECT_TO: Compatible connections
  - ALTERNATIVE_TO: Interchangeable nodes
  - COMMONLY_USED_WITH: Frequently paired nodes

### GraphRAG Process
1. **Intent Extraction**: Analyzes requests to identify services and capabilities
2. **Semantic Search**: Finds relevant nodes using embeddings
3. **Duplicate Prevention**: Ensures no redundant nodes
4. **Connection Generation**: Creates logical data flow
5. **Optimization Analysis**: Identifies improvements

## 🐛 Troubleshooting

### Common Issues

1. **Connection refused** - Ensure Zeal is running on the correct port
2. **Authentication failed** - Check your API key is valid
3. **Rate limit exceeded** - Implement exponential backoff
4. **Function not found** - Update function definitions from server
5. **GraphRAG not working** - Run `./ai-integrations/setup-ai.sh` to build knowledge graph
6. **AI features limited** - Set OPENROUTER_API_KEY for full capabilities

### Debug Mode

Enable debug logging:
```bash
DEBUG=zeal:* npm start
```

## 📄 License

Apache License 2.0 - See [LICENSE](../LICENSE) for details.

## 🔗 Links

- [Zeal Platform](https://github.com/offbit-ai/zeal)
- [OpenAI Functions Docs](https://platform.openai.com/docs/guides/function-calling)
- [Anthropic MCP Docs](https://modelcontextprotocol.io)
- [ZIP Protocol Spec](../packages/zeal-sdk/README.md)

## 💬 Support

- GitHub Issues: [Create an issue](https://github.com/offbit-ai/zeal/issues)
- Discord: [Join our community](https://discord.gg/zeal)
- Email: support@offbit.ai