# Zeal Python SDK

Python SDK for the Zeal Integration Protocol (ZIP) - A comprehensive toolkit for workflow automation and real-time collaboration.

## Prerequisites

⚠️ **Important**: A running Zeal server instance is required for the SDK to function. The SDK communicates with the Zeal server via REST APIs and WebSocket connections.

### Starting the Zeal Server

```bash
# Clone the Zeal repository
git clone https://github.com/offbit-ai/zeal.git
cd zeal

# Install dependencies
npm install

# Start the development server
npm run dev
# Or use the start script
./start-dev.sh
```

The Zeal server will be available at `http://localhost:3000` by default.

For detailed setup instructions, deployment options, and configuration, please refer to the [Zeal repository](https://github.com/offbit-ai/zeal).

## Installation

```bash
pip install zeal-sdk
```

## Quick Start

```python
import asyncio
from zeal import ZealClient, ClientConfig, CreateWorkflowRequest

async def main():
    config = ClientConfig(base_url="http://localhost:3000")
    client = ZealClient(config)
    
    # Create a workflow
    workflow = await client.orchestrator.create_workflow(
        CreateWorkflowRequest(
            name="My Workflow",
            description="A sample workflow"
        )
    )
    
    print(f"Created workflow: {workflow.workflow_id}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Features

- **Orchestrator API**: Create and manage workflows, nodes, connections, and groups
- **Templates API**: Register, list, update, and delete node templates  
- **Traces API**: Real-time execution tracing and session management
- **Webhooks API**: Webhook subscription and delivery management
- **Events**: Full ZIP event system with WebSocket support
- **Type Safety**: Complete type hints and Pydantic models
- **Async/Await**: Built on modern async Python with httpx and websockets

## API Reference

### Orchestrator API

```python
# Create workflow
workflow = await client.orchestrator.create_workflow(
    CreateWorkflowRequest(name="My Workflow", description="Sample")
)

# Add node
node = await client.orchestrator.add_node(
    AddNodeRequest(
        workflow_id=workflow.workflow_id,
        template_id="processor",
        position=Position(x=100, y=200)
    )
)

# Connect nodes  
connection = await client.orchestrator.connect_nodes(
    ConnectNodesRequest(
        workflow_id=workflow.workflow_id,
        source=NodePort(node_id="node1", port_id="output"),
        target=NodePort(node_id="node2", port_id="input")
    )
)

# Create group
group = await client.orchestrator.create_group(
    CreateGroupRequest(
        workflow_id=workflow.workflow_id,
        title="Processing Group",
        node_ids=["node1", "node2"]
    )
)

# Update group
updated = await client.orchestrator.update_group(
    UpdateGroupRequest(
        workflow_id=workflow.workflow_id,
        group_id=group.group_id,
        title="Updated Group"
    )
)

# Remove connection
await client.orchestrator.remove_connection(
    RemoveConnectionRequest(
        workflow_id=workflow.workflow_id,
        connection_id=connection.connection_id
    )
)

# Remove group
await client.orchestrator.remove_group(
    RemoveGroupRequest(
        workflow_id=workflow.workflow_id,
        group_id=group.group_id
    )
)
```

### Templates API

```python
# Register templates
response = await client.templates.register(
    RegisterTemplatesRequest(
        namespace="my-templates",
        templates=[template1, template2]
    )
)

# List templates
templates = await client.templates.list("my-templates")
```

### Traces API

```python
# Create trace session
session = await client.traces.create_session(
    CreateTraceSessionRequest(
        workflow_id=workflow.workflow_id,
        execution_id="exec-123"
    )
)

# Submit events
await client.traces.submit_events(session.session_id, [event1, event2])

# Complete session
await client.traces.complete_session(
    session.session_id,
    CompleteSessionRequest(status="success")
)
```

### Event System

```python
from zeal.events import NodeExecutingEvent, GroupCreatedEvent

# Parse webhook events
def handle_webhook(payload: dict):
    event = parse_zip_webhook_event(payload)
    
    if isinstance(event, NodeExecutingEvent):
        print(f"Node {event.node_id} executing in workflow {event.workflow_id}")
    elif isinstance(event, GroupCreatedEvent):
        print(f"Group created in workflow {event.workflow_id}")
```

## Development

### Setup

```bash
git clone https://github.com/offbit-ai/zeal
cd zeal/packages/zeal-python-sdk
pip install -e ".[dev]"
```

### Testing

```bash
pytest
pytest --cov=zeal --cov-report=html
```

### Code Formatting

```bash
black zeal/
isort zeal/
mypy zeal/
```

## License

Apache License 2.0 - see LICENSE file for details.