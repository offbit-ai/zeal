# Zeal - Visual Workflow Editor

A modern, real-time collaborative workflow editor with node-based visual programming, built with Next.js, TypeScript, and CRDT synchronization.

![Zeal Screenshot](zeal-screenshot.png)
![reflective_property_propagation (2)](https://github.com/user-attachments/assets/13ea3c48-c98f-4df7-974d-4df1ddf81640)

## 🚀 Quick Start

### Using Docker (Recommended)

#### Development

```bash
# Clone the repository
git clone https://github.com/offbit-ai/zeal.git
cd zeal

# Copy environment variables
cp .env.example .env

# Generate a secure secret for NextAuth
openssl rand -base64 32

# Start all services (auth is disabled by default)
docker-compose up -d

# View logs
docker-compose logs -f
```

#### Production

```bash
# Clone the repository
git clone https://github.com/offbit-ai/zeal.git
cd zeal

# Copy environment variables
cp .env.example .env

# Generate a secure secret for NextAuth
openssl rand -base64 32

# Start all services in production mode
./docker-compose-prod.sh up

# View logs
./docker-compose-prod.sh logs -f
```

The application will be available at:

- Web UI: http://localhost:3000
- CRDT Server: ws://localhost:8080
- PostgreSQL: localhost:5432
- TimescaleDB: localhost:5433 (for flow traces)
- Redis: localhost:6379
- ZIP WebSocket: ws://localhost:3000/zip/events

### Microservices Deployment

Deploy Zeal as scalable microservices with flexible database options:

```bash
# Local deployment with PostgreSQL
./scripts/deploy-microservices.sh local

# Local deployment with Supabase
./scripts/deploy-microservices.sh --supabase local

# Production deployment with PostgreSQL
./scripts/deploy-microservices.sh production

# Production deployment with Supabase
./scripts/deploy-microservices.sh --supabase production
```

### Kubernetes Deployment

Deploy Zeal to Kubernetes with customizable configurations:

#### Local Development with Minikube

```bash
# Quick automated setup
./scripts/minikube-quick-setup.sh

# Or interactive setup
./scripts/minikube-setup.sh setup

# With custom memory allocation (MB)
MINIKUBE_MEMORY=6144 ./scripts/minikube-setup.sh setup
```

This creates a complete local Kubernetes environment with:

- Automatic port conflict detection and resolution
- Local Docker registry
- Minikube cluster
- Automatic image building and deployment
- PostgreSQL database
- Local access via http://zeal.local

See [Minikube Setup Guide](docs/MINIKUBE_SETUP.md) for details.

#### Production Kubernetes

```bash
# Interactive deployment generator (recommended)
./scripts/generate-k8s-deployment.sh

# Or use environment variables
cp k8s/.env.k8s.example k8s/.env.k8s
# Edit k8s/.env.k8s with your values
./scripts/deploy-k8s.sh
```

The Kubernetes deployment supports:

- Custom container registry and image tags
- Horizontal pod autoscaling
- TLS/HTTPS with cert-manager
- Both PostgreSQL and Supabase
- Resource limits and health checks

See [Kubernetes Deployment Guide](k8s/README.md) for detailed instructions.

### Manual Installation

```bash
# Install dependencies
npm install

# Build Rust CRDT server
cd crdt-server
cargo build --release
cd ..

# Setup database
# First, ensure PostgreSQL is installed and running
# Create the database (if using local PostgreSQL):
# psql -U postgres -c "CREATE DATABASE zeal_db;"

# Initialize database schema
# Option 1: Using the init script (recommended)
# Make sure DATABASE_URL is set in .env.local
./scripts/init-db.sh

# Option 2: Manual initialization
# Replace with your actual database URL
psql postgresql://user:password@localhost/zeal_db < init.sql

# Start development servers (auth disabled by default)
npm run dev

# Or use the development script for guided setup:
./start-dev.sh  # Prompts for optional auth configuration
```

> **Note**:
>
> - The `createdb` command is part of PostgreSQL client tools. If not available, use `psql -U postgres -c "CREATE DATABASE zeal_db;"`
> - Make sure to set `DATABASE_URL` in your `.env.local` file before running the init script
> - If you encounter "relation 'workflows' does not exist" errors, the database schema hasn't been initialized properly

## 📋 Features

- **Visual Workflow Editor**: Drag-and-drop node-based interface
- **Real-time Collaboration**: Multiple users can edit simultaneously with CRDT sync
- **Node Groups**: Organize nodes into collapsible groups
- **Version History**: Track all changes with rollback to published versions
- **Execution Replay**: Review past workflow executions with recorded data flow\*
- **Flow Tracing**: Examine execution logs and data flow through nodes\*
- **Analytics**: Performance metrics, error tracking, and usage trends
- **Node Repository**: Extensible library of 50+ node types
- **Subgraphs**: Create reusable workflow components
- **Auto-save**: Changes are automatically persisted every 30 seconds
- **Export/Import**: Share workflows as JSON files
- **Snapshot Management**: Create named checkpoints at milestones
- **Embeddable Editor**: Integrate the workflow editor into your own applications
- **API & WebSocket Support**: Programmatic control via REST API and real-time WebSocket
- **AI Agent Integration**: MCP server for AI-powered workflow orchestration
- **Zeal Integration Protocol (ZIP)**: Standard interface for third-party runtime integration
- **Time-Series Flow Traces**: TimescaleDB-powered execution history with time travel queries

\*Note: History browsing and flow tracing features depend on workflow execution data being recorded by your runtime engine implementation via the ZIP protocol.

## 🏗️ Architecture

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed system design.

### Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Node.js, Rust (CRDT server)
- **Database**: PostgreSQL or Supabase, Redis, TimescaleDB (for flow traces)
- **Real-time**: Socket.IO, Yjs CRDT, WebSocket (ZIP protocol)
- **Deployment**: Docker, Docker Compose, Kubernetes

### Deployment Options

- **Docker Compose**: Single-node deployment for development and small-scale production
- **Microservices**: Scalable multi-container deployment with load balancing
- **Kubernetes**: Cloud-native deployment with auto-scaling and orchestration

## ⚠️ Implementation Notes

This project provides a visual workflow editor interface and collaboration infrastructure. The following components require implementation through the **Zeal Integration Protocol (ZIP)**:

### 1. **Workflow Runtime Engine Integration**

While Zeal provides the visual editor and orchestration capabilities, the actual workflow execution must be implemented by your runtime engine. The **Zeal Integration Protocol (ZIP)** provides a standardized way to integrate any runtime:

#### Using the ZIP SDK for Runtime Integration:

```typescript
import ZealClient from '@offbit-ai/zeal-sdk'

// Initialize ZIP client
const client = new ZealClient({ baseUrl: 'http://localhost:3000' })

// Register your runtime's node templates
await client.templates.register({
  namespace: 'my-runtime',
  category: 'Processing',
  templates: [/* your node definitions */]
})

// Subscribe to workflow execution requests
const subscription = client.createSubscription({
  namespace: 'my-runtime',
  events: ['execution.requested', 'node.*']
})

subscription.onEvent(async (event) => {
  // Handle execution in your runtime
  if (event.type === 'execution.requested') {
    await executeWorkflow(event.workflowId)
  }
})

// Report execution progress back to Zeal
async function executeNode(nodeId: string) {
  // Send visual state update
  client.events.updateVisualState([{
    id: nodeId,
    elementType: 'node',
    state: 'running'
  }])
  
  // Your execution logic here
  const result = await yourRuntime.execute(nodeId)
  
  // Record execution trace
  await client.traces.submitEvents(sessionId, {
    events: [{
      nodeId,
      eventType: 'output',
      data: result
    }]
  })
}
```

#### What You Need to Implement:

- **Execution Engine**: Core logic to execute workflow nodes in sequence/parallel
- **Node Handlers**: Specific execution logic for each node type
- **Data Pipeline**: Pass data between nodes according to connections
- **Error Handling**: Manage failures and retries
- **State Management**: Track execution progress and intermediate results

#### What ZIP Provides:

- **Bidirectional Communication**: WebSocket and webhooks for real-time updates
- **Visual Feedback**: Update node/connection states during execution
- **Execution Traces**: Record all execution data for replay and debugging (stored in TimescaleDB)
- **Template Registration**: Define custom nodes for your runtime
- **Event Subscriptions**: React to workflow changes and execution requests
- **Time Travel Queries**: Replay past executions and analyze performance trends

#### Example Runtime Integrations:

Common workflow runtime engines that can be integrated via ZIP:

- **Apache Airflow**: Use ZIP SDK to bridge Airflow DAGs with Zeal's visual editor
- **Temporal**: Connect Temporal workflows for durable execution
- **n8n**: Integrate n8n's node library and execution engine
- **Node-RED**: Bridge Node-RED flows with Zeal's collaboration features
- **Custom Python/Node.js**: Build your own lightweight runtime using the SDK

See [ZIP Integration Examples](packages/zeal-sdk/examples/) for sample implementations

### 2. **User Management & Authentication**

Zeal includes a comprehensive authorization framework (`zeal-auth`) that is **disabled by default** for easier development. The authorization system provides:

#### Built-in Authorization Features (When Enabled):
- **JWT Token Validation**: Integrate with external identity providers (Auth0, Okta, AWS Cognito, etc.)
- **Policy-Based Access Control**: Fine-grained permissions using YAML policies
- **Multi-Tenancy Support**: Automatic tenant isolation for SaaS deployments
- **Claim Mapping**: Map JWT claims to Zeal's authorization model
- **Audit Logging**: Track all authorization decisions
- **Development Mode**: Mock authentication for local development

#### Enabling Authorization:

**Quick Start (Development Mode):**
```bash
# During setup, choose to enable authorization
./start-dev.sh
# When prompted: "Enable authorization? (y/N)": y
# Select: "1. Development (mock auth)"
```

**Production Mode:**
```bash
# Set environment variables before starting
export ZEAL_AUTH_ENABLED=true
export ZEAL_AUTH_MODE=production
export AUTH_JWT_ISSUER="https://your-identity-provider.com"
export AUTH_JWT_AUDIENCE="https://api.your-app.com"
export AUTH_JWT_JWKS_URI="https://your-idp.com/.well-known/jwks.json"
```

#### What's NOT Included:
While authorization is built-in, the following user management features require external implementation:

- User registration and login UI/flows
- Identity provider setup (use Auth0, Okta, AWS Cognito, etc.)
- User profile management interfaces
- Team/organization creation workflows
- Password reset and account recovery

### 3. **Production Deployment Considerations**

For production deployments, see our [comprehensive deployment guide](deployments/README.md) which covers:

- **K3s**: Self-hosted Kubernetes deployment
- **AWS EKS**: Scalable cloud deployment with AWS services
- **Azure AKS**: Enterprise deployment with Azure services  
- **GCP GKE**: Google Cloud deployment with GKE
- Security hardening and SSL/TLS configuration
- Monitoring, alerting, and backup strategies
- Cost optimization and scaling considerations

## 🔧 Configuration

### Environment Variables

| Variable                           | Description                        | Default                          |
| ---------------------------------- | ---------------------------------- | -------------------------------- |
| `DATABASE_URL`                     | PostgreSQL connection string       | Required (if not using Supabase) |
| `REDIS_URL`                        | Redis connection string            | Required                         |
| `TIMESCALE_HOST`                   | TimescaleDB host                   | localhost                        |
| `TIMESCALE_PORT`                   | TimescaleDB port                   | 5433                            |
| `TIMESCALE_DATABASE`               | TimescaleDB database name          | zeal_traces                      |
| `TIMESCALE_USER`                   | TimescaleDB username               | zeal_user                        |
| `TIMESCALE_PASSWORD`               | TimescaleDB password               | zeal_password                    |
| `NEXT_PUBLIC_CRDT_SERVER_URL`      | CRDT server WebSocket URL          | ws://localhost:8080              |
| `NEXTAUTH_SECRET`                  | NextAuth.js secret key             | Required                         |
| `NEXTAUTH_URL`                     | Application URL                    | http://localhost:3000            |
| `NEXT_PUBLIC_DISABLE_CONSOLE_LOGS` | Disable console logs in production | false                            |
| `USE_SUPABASE`                     | Use Supabase instead of PostgreSQL | false                            |
| `SUPABASE_URL`                     | Supabase project URL               | Required (if USE_SUPABASE=true)  |
| `SUPABASE_ANON_KEY`                | Supabase anonymous key             | Required (if USE_SUPABASE=true)  |
| `SUPABASE_SERVICE_ROLE_KEY`        | Supabase service role key          | Required (if USE_SUPABASE=true)  |
| **Authorization (Optional)**       |                                    |                                  |
| `ZEAL_AUTH_ENABLED`                | Enable authorization system        | false (disabled by default)      |
| `ZEAL_AUTH_MODE`                   | Auth mode (development/production) | development                      |
| `AUTH_JWT_ISSUER`                  | JWT issuer URL                     | Required for production auth     |
| `AUTH_JWT_AUDIENCE`                | JWT audience                       | Required for production auth     |
| `AUTH_JWT_JWKS_URI`                | JWKS endpoint URL                  | Required for production auth     |

See `.env.example` and `.env.supabase.example` for all configuration options.

### Production Deployment

For enterprise production deployments, see our [Production Deployment Guide](deployments/README.md) with comprehensive solutions for:

- **Cloud Platforms**: AWS EKS, Azure AKS, GCP GKE
- **Self-Hosted**: K3s deployment with automated setup
- **Infrastructure as Code**: Complete Terraform configurations
- **High Availability**: Multi-zone deployments with auto-scaling
- **Security**: Private networks, encryption, secrets management
- **Monitoring**: Comprehensive observability and alerting

For simple Docker-based production deployment:

```bash
# Quick production Docker setup
./docker-compose-prod.sh up
```

## 📚 Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [Workflow Editor Guide](docs/WORKFLOW_EDITOR.md)
- [Node Template Reference](docs/NODE_TEMPLATES_REFERENCE.md)
- [API Documentation](docs/API.md)
- [Embedding Guide](docs/EMBEDDING_GUIDE.md) - **New!** Integrate Zeal into your applications
- [Production Deployment Guide](deployments/README.md) - **Comprehensive cloud and self-hosted solutions**
- [Docker Deployment Guide](docs/DEPLOYMENT.md)
- [Kubernetes Deployment](k8s/README.md)
- [Minikube Local Setup](docs/MINIKUBE_SETUP.md)
- [Microservices Guide](docs/MICROSERVICES_DEPLOYMENT.md)

## 🔌 Integration Options

### Zeal Integration Protocol (ZIP)

The Zeal Integration Protocol enables third-party workflow runtime engines to integrate seamlessly with the Zeal editor. ZIP provides:

- **Bidirectional Event System**: Real-time WebSocket and webhook communication
- **Node Template Registration**: Register custom nodes from your runtime
- **Execution Flow Visualization**: Show real-time execution state in the editor
- **Flow Trace Recording**: Submit execution logs for replay and debugging
- **Programmatic Orchestration**: Create and modify workflows via API

#### ZIP SDK Options

Zeal provides SDKs in multiple languages for integrating with the ZIP protocol:

**TypeScript/JavaScript**
```bash
npm install @offbit-ai/zeal-sdk
```

**Python**
```bash
pip install zeal-sdk
```

**Go**
```bash
go get github.com/offbit-ai/zeal-go-sdk
```

**Rust**
```toml
[dependencies]
zeal-sdk = "1.0.0"
```

**Java**
```xml
<dependency>
    <groupId>com.offbit</groupId>
    <artifactId>zeal-java-sdk</artifactId>
    <version>1.0.0</version>
</dependency>
```

#### Quick Start Example (TypeScript)

```typescript
import ZealClient from '@offbit-ai/zeal-sdk'

const client = new ZealClient({
  baseUrl: 'http://localhost:3000',
})

// Register custom node templates
await client.templates.register({
  namespace: 'my-runtime',
  category: 'Custom Nodes',
  templates: [...],
})

// Subscribe to workflow events
const subscription = client.createSubscription({
  port: 3001,
  namespace: 'my-runtime',
  events: ['node.*', 'execution.*'],
})

subscription.onEvent(async (event) => {
  console.log('Workflow event:', event.type, event.data)
  // Handle node execution, workflow updates, etc.
})

await subscription.start()
```

#### ZIP Features

**Real-time Execution Visualization**
```typescript
// Connect to WebSocket for real-time updates
await client.events.connect(workflowId, {
  onVisualStateUpdate: (update) => {
    // Visual state updates for nodes and connections
    console.log('Visual update:', update.elements)
  },
  onRuntimeEvent: (event) => {
    // Runtime execution events
    console.log('Runtime event:', event.type)
  }
})

// Send execution state updates
client.events.updateVisualState([
  {
    id: 'connection-1',
    elementType: 'connection',
    state: 'running',
    progress: 45,
  },
  {
    id: 'node-1',
    elementType: 'node',
    state: 'success',
  }
])
```

**Flow Trace Recording**
```typescript
// Create trace session for execution replay
const session = await client.traces.createSession({
  workflowId: 'workflow-123',
  workflowName: 'Data Processing Pipeline',
})

// Submit execution events
await client.traces.submitEvents(session.sessionId, {
  events: [
    {
      timestamp: Date.now(),
      nodeId: 'transform-node',
      eventType: 'output',
      data: { processed: 1000, errors: 0 }
    }
  ]
})

// Complete session with status
await client.traces.completeSession(session.sessionId, 'completed')
```

**Observable Event Streams**
```typescript
// Use RxJS observables for event processing
const observable = subscription.asObservable()

// Filter and transform specific events
observable
  .filter(event => event.type === 'node.failed')
  .map(event => ({
    nodeId: event.nodeId,
    error: event.error,
    timestamp: event.timestamp
  }))
  .subscribe(failure => {
    console.error('Node failure detected:', failure)
  })
```

See the SDK documentation for your preferred language:

**SDK Documentation**
- [TypeScript/JavaScript SDK](packages/zeal-sdk/) - Full-featured SDK with RxJS observables
- [Python SDK](packages/zeal-python-sdk/) - Async/await support with type hints
- [Go SDK](packages/zeal-go-sdk/) - Idiomatic Go with channels and goroutines
- [Rust SDK](packages/zeal-rust-sdk/) - High-performance with async runtime
- [Java SDK](packages/zeal-java-sdk/) - Enterprise-ready with CompletableFuture and builder patterns

**Integration Examples**
- [Webhook subscription patterns](packages/zeal-sdk/examples/webhook-subscription.ts)
- [WebSocket real-time communication](packages/zeal-sdk/examples/websocket-events.ts)
- [Flow trace recording](packages/zeal-sdk/examples/flow-traces.ts)
- [Template registration](packages/zeal-sdk/examples/template-registration.ts)

### Embedding the Workflow Editor

Zeal can be embedded into your applications using:

- **iframe Integration**: Simple embedding with customizable options
- **API Key Authentication**: Secure access with granular permissions
- **WebSocket Real-time Updates**: Programmatic control and event handling
- **Drag & Drop Support**: Allow users to drag custom nodes into workflows

Quick example:

```html
<iframe
  src="https://your-zeal-instance.com/embed/WORKFLOW_ID?apiKey=YOUR_KEY"
  width="100%"
  height="600"
>
</iframe>
```

See the [Embedding Guide](docs/EMBEDDING_GUIDE.md) for complete documentation.

### AI Integration - OpenAI Functions & Anthropic MCP

Zeal provides production-ready AI integrations for both OpenAI and Anthropic models, enabling natural language workflow orchestration:

#### OpenAI Functions Server
A dedicated server that exposes Zeal's capabilities as OpenAI-compatible functions:

- **20+ Functions**: Complete workflow, node, execution, and analytics operations
- **GPT-4 & Assistants API**: Full compatibility with OpenAI's function calling
- **Streaming Support**: Real-time execution updates via Server-Sent Events
- **Batch Operations**: Execute multiple functions in a single request

```python
# Example: Using with OpenAI API
from openai import OpenAI
import requests

# Fetch available functions from Zeal
tools = requests.get("http://localhost:3456/tools").json()

# Use with GPT-4
client = OpenAI()
response = client.chat.completions.create(
    model="gpt-4-turbo-preview",
    messages=[{"role": "user", "content": "Create a data processing workflow"}],
    tools=tools,
    tool_choice="auto"
)
```

#### Anthropic MCP Server
Model Context Protocol server for Claude (Desktop & API) with advanced AI features:

- **AI-Powered Tools**: Workflow optimization, debugging, and auto-design
- **Natural Language**: Convert descriptions directly to workflows
- **Dual Transport**: Works with both Claude Desktop (stdio) and API (HTTP)
- **Context Resources**: Provide workflow context for better AI understanding

```python
# Example: Using with Claude API
from anthropic import Anthropic
import requests

# Fetch MCP tools
tools = requests.get("http://localhost:3457/tools").json()

# Use with Claude
client = Anthropic()
response = client.messages.create(
    model="claude-3-opus-20240229",
    messages=[{"role": "user", "content": "Optimize my workflow for performance"}],
    tools=tools,
    tool_choice={"type": "auto"}
)
```

#### Key AI Features

| Feature | OpenAI Functions | Anthropic MCP |
|---------|------------------|---------------|
| Workflow Creation | ✅ Standard | ✅ With AI design |
| Node Operations | ✅ CRUD operations | ✅ Smart suggestions |
| Execution Control | ✅ Full control | ✅ With debugging |
| Optimization | Via GPT analysis | ✅ Built-in optimizer |
| Natural Language | Via GPT | ✅ Native support |
| Test Generation | Manual | ✅ Automatic |
| Workflow Comparison | Basic | ✅ Advanced analysis |

#### Getting Started

1. **Install dependencies**:
```bash
cd ai-integrations/openai-functions && npm install
cd ../mcp-server && npm install
```

2. **Start the servers**:
```bash
# Terminal 1: OpenAI Functions Server
npm run dev  # Runs on port 3456

# Terminal 2: MCP Server
npm run dev  # Runs on port 3457
```

3. **Configure AI clients** to use the servers (see [AI Integration Guide](ai-integrations/README.md))

#### Advanced Usage Patterns

- **Collaborative AI**: Use GPT-4 for creation and Claude for optimization
- **Parallel Generation**: Create multiple workflows simultaneously
- **AI Orchestrator**: Intelligent task delegation based on AI strengths
- **Debugging Assistant**: AI-powered error analysis and fixes

See [AI Integration Documentation](ai-integrations/) for complete setup, examples, and API reference.

The MCP server for embedded orchestration is also available in `/mcp/embed-orchestrator`.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

This project is licensed under the Apache License 2.0 - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built with [Yjs](https://yjs.dev/) for CRDT synchronization
- UI components from [Tailwind CSS](https://tailwindcss.com/)
- Icons from [Lucide](https://lucide.dev/)
- Brand icons from [Simple Icons](https://simpleicons.org/) and [Font Awesome](https://fontawesome.com/)
