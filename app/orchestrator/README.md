# Zeal Orchestrator

AI-powered workflow creation interface that enables users to build workflows using natural language.

## Quick Start

1. **Set up OpenRouter API key** in `.env.local`:

   ```bash
   OPENROUTER_API_KEY=your-api-key
   ```

2. **Navigate to** `/orchestrator`

3. **Start building** by describing what you want:
   - "Create a workflow that processes CSV files"
   - "Build an API integration with error handling"
   - "Set up a data pipeline with transformations"

## Features

- **Natural Language Interface**: Describe workflows in plain English
- **Automatic Node Discovery**: AI finds the right nodes for your needs
- **Intelligent Connections**: Automatically connects nodes based on data flow
- **Real-time Visualization**: See your workflow build in real-time
- **Split View**: Chat on the left, workflow on the right

## How It Works

1. **Intent Recognition**: The AI understands what you want to build
2. **Workflow Creation**: Automatically creates and names your workflow
3. **Node Selection**: Searches for and adds appropriate nodes
4. **Connection Logic**: Creates connections between compatible nodes
5. **Continuous Building**: Add more features through conversation

## Example Usage

```
You: "I need to fetch data from a REST API every hour and save it to PostgreSQL"

Orchestrator:
✓ Created workflow "Hourly API Data Sync"
✓ Added Schedule Trigger (hourly)
✓ Added HTTP Request node
✓ Added PostgreSQL Insert node
✓ Connected all nodes

You: "Add error handling that sends alerts to Slack"

Orchestrator:
✓ Added Error Handler node
✓ Added Slack Notification node
✓ Connected error output to Slack
```

## Components

- **Chat Interface**: Natural language input and response display
- **Embed View**: Live workflow editor in iframe
- **Agent Logic**: LLM-powered workflow understanding
- **MCP Integration**: Connects to all three MCP servers

## Configuration

See [ORCHESTRATOR.md](../../docs/ORCHESTRATOR.md) for detailed configuration and usage instructions.
