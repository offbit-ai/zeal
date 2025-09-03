# Zeal Go SDK

Go SDK for the Zeal Integration Protocol (ZIP) - A comprehensive toolkit for workflow automation and real-time collaboration.

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
go get github.com/offbit-ai/zeal-go-sdk
```

## Quick Start

```go
package main

import (
    "context"
    "log"
    
    zeal "github.com/offbit-ai/zeal-go-sdk"
)

func main() {
    config := zeal.ClientConfig{
        BaseURL: "http://localhost:3000",
    }
    
    client, err := zeal.NewClient(config)
    if err != nil {
        log.Fatal(err)
    }
    
    // Create a workflow
    workflow, err := client.Orchestrator().CreateWorkflow(context.Background(), zeal.CreateWorkflowRequest{
        Name: "My Workflow",
        Description: "A sample workflow",
    })
    if err != nil {
        log.Fatal(err)
    }
    
    log.Printf("Created workflow: %s", workflow.WorkflowID)
}
```

## Features

- **Orchestrator API**: Create and manage workflows, nodes, connections, and groups
- **Templates API**: Register, list, update, and delete node templates  
- **Traces API**: Real-time execution tracing and session management
- **Webhooks API**: Webhook subscription and delivery management
- **Events**: Full ZIP event system with WebSocket support
- **Type Safety**: Complete type definitions matching TypeScript/Rust SDKs

## API Reference

### Orchestrator API

```go
// Create workflow
workflow, err := client.Orchestrator().CreateWorkflow(ctx, zeal.CreateWorkflowRequest{...})

// Add node
node, err := client.Orchestrator().AddNode(ctx, zeal.AddNodeRequest{...})

// Connect nodes  
connection, err := client.Orchestrator().ConnectNodes(ctx, zeal.ConnectNodesRequest{...})

// Create group
group, err := client.Orchestrator().CreateGroup(ctx, zeal.CreateGroupRequest{...})

// Update group
updated, err := client.Orchestrator().UpdateGroup(ctx, zeal.UpdateGroupRequest{...})

// Remove connection
err = client.Orchestrator().RemoveConnection(ctx, zeal.RemoveConnectionRequest{...})

// Remove group
err = client.Orchestrator().RemoveGroup(ctx, zeal.RemoveGroupRequest{...})
```

### Templates API

```go
// Register templates
response, err := client.Templates().Register(ctx, zeal.RegisterTemplatesRequest{...})

// List templates
templates, err := client.Templates().List(ctx, "namespace")
```

### Traces API

```go
// Create trace session
session, err := client.Traces().CreateSession(ctx, zeal.CreateTraceSessionRequest{...})

// Submit events
err = client.Traces().SubmitEvents(ctx, sessionID, events)

// Complete session
err = client.Traces().CompleteSession(ctx, sessionID, zeal.CompleteSessionRequest{...})
```

### Event System

```go
// Listen to webhook events
subscription := client.Webhooks().Subscribe()

subscription.OnEvent(func(event zeal.ZipWebhookEvent) error {
    switch e := event.(type) {
    case *zeal.NodeExecutingEvent:
        log.Printf("Node %s executing in workflow %s", e.NodeID, e.WorkflowID)
    case *zeal.GroupCreatedEvent:
        log.Printf("Group created in workflow %s", e.WorkflowID)
    }
    return nil
})
```

## License

Apache License 2.0 - see LICENSE file for details.