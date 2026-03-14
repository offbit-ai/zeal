# Zeal Go SDK

Go SDK for the Zeal Integration Protocol (ZIP) — a comprehensive toolkit for workflow automation and real-time collaboration.

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
        Name:        "My Workflow",
        Description: stringPtr("A sample workflow"),
    })
    if err != nil {
        log.Fatal(err)
    }

    log.Printf("Created workflow: %s", workflow.WorkflowID)
}

func stringPtr(s string) *string { return &s }
```

## Features

- **Orchestrator API**: Create and manage workflows, nodes, connections, and groups
- **Templates API**: Register templates with optional Web Component display
- **Component Bundles**: Upload custom node renderers (Web Components)
- **Traces API**: Real-time execution tracing and session management
- **Webhooks API**: Webhook subscription and delivery management
- **Events**: Full ZIP event system with stream support
- **Stream Frames**: Parse binary stream data from Reflow infrastructure
- **Type Safety**: Complete type definitions matching TypeScript/Rust SDKs

## Configuration

```go
config := zeal.ClientConfig{
    BaseURL:           "http://localhost:3000",
    AuthToken:         "your-auth-token",     // Optional
    DefaultTimeout:    30 * time.Second,
    VerifyTLS:         true,
    UserAgent:         "zeal-go-sdk/1.0.0",
    MaxRetries:        3,
    RetryBackoffMs:    1000,
    EnableCompression: true,
}

client, err := zeal.NewClient(config)
```

## API Reference

### Orchestrator API

Create and manage workflows programmatically:

```go
ctx := context.Background()

// Create workflow
workflow, err := client.Orchestrator().CreateWorkflow(ctx, zeal.CreateWorkflowRequest{
    Name:        "Data Pipeline",
    Description: stringPtr("ETL workflow for user data"),
    Metadata:    map[string]interface{}{"env": "production"},
})

// List workflows
list, err := client.Orchestrator().ListWorkflows(ctx, &zeal.ListWorkflowsParams{
    Limit:  intPtr(20),
    Offset: intPtr(0),
})

// Get workflow state
state, err := client.Orchestrator().GetWorkflowState(ctx, workflow.WorkflowID, "main")

// Add node
node, err := client.Orchestrator().AddNode(ctx, zeal.AddNodeRequest{
    WorkflowID: workflow.WorkflowID,
    TemplateID: "tpl_http_request",
    Position:   zeal.Position{X: 200, Y: 150},
    Properties: map[string]interface{}{
        "url":    "https://api.example.com/data",
        "method": "GET",
    },
})

// Update node properties
_, err = client.Orchestrator().UpdateNode(ctx, node.NodeID, zeal.UpdateNodeRequest{
    WorkflowID: workflow.WorkflowID,
    Properties: map[string]interface{}{
        "timeout": 5000,
    },
})

// Connect nodes
connection, err := client.Orchestrator().ConnectNodes(ctx, zeal.ConnectNodesRequest{
    WorkflowID: workflow.WorkflowID,
    Source:      zeal.NodePort{NodeID: "node-1", PortID: "output"},
    Target:      zeal.NodePort{NodeID: "node-2", PortID: "input"},
})

// Create group
group, err := client.Orchestrator().CreateGroup(ctx, zeal.CreateGroupRequest{
    WorkflowID:  workflow.WorkflowID,
    Title:       "Data Sources",
    NodeIDs:     []string{"node-1", "node-2"},
    Color:       stringPtr("#3b82f6"),
    Description: stringPtr("Input data fetching nodes"),
})

// Update group
_, err = client.Orchestrator().UpdateGroup(ctx, zeal.UpdateGroupRequest{
    WorkflowID: workflow.WorkflowID,
    GroupID:    group.GroupID,
    Title:     stringPtr("Updated Title"),
})

// Remove connection
err = client.Orchestrator().RemoveConnection(ctx, zeal.RemoveConnectionRequest{
    WorkflowID:   workflow.WorkflowID,
    ConnectionID: connection.ConnectionID,
})

// Delete node
_, err = client.Orchestrator().DeleteNode(ctx, node.NodeID, workflow.WorkflowID, "main")

// Remove group
err = client.Orchestrator().RemoveGroup(ctx, zeal.RemoveGroupRequest{
    WorkflowID: workflow.WorkflowID,
    GroupID:    group.GroupID,
})
```

### Templates API

Register and manage node templates:

```go
// Register templates
response, err := client.Templates().Register(ctx, zeal.RegisterTemplatesRequest{
    Namespace: "my-integration",
    Templates: []zeal.NodeTemplate{
        {
            ID:          "data-fetcher",
            Type:        "api",
            Title:       "Data Fetcher",
            Category:    "data-sources",
            Description: "Fetch data from REST API",
            Icon:        "download",
            Variant:     stringPtr("blue-600"),
            Shape:       stringPtr("rectangle"),
            Size:        stringPtr("medium"),
            Ports: []zeal.Port{
                {ID: "url-in", Label: "URL", Type: "input", Position: "left"},
                {ID: "data-out", Label: "Data", Type: "output", Position: "right"},
            },
        },
    },
})

// List templates
templates, err := client.Templates().List(ctx, "my-integration")
```

#### Custom Display Components (Web Components)

Register templates with custom Web Component-based node rendering:

```go
// 1. Upload the component bundle
bundle, err := client.Components().Upload(ctx, zeal.UploadBundleRequest{
    Namespace: "my-ns",
    Source: `
        class MyChartNode extends HTMLElement {
            constructor() {
                super()
                this.attachShadow({ mode: 'open' })
                this.shadowRoot.innerHTML = '<canvas></canvas>'
            }
            set propertyValues(v) { this.render(v) }
            connectedCallback() {
                this.zeal?.onPropertyChange((values) => this.render(values))
            }
            render(props) { /* draw chart */ }
        }
        customElements.define('my-chart-node', MyChartNode)
    `,
})
// bundle.BundleID -> "a1b2c3d4e5f6g7h8.js"

// 2. Register template with display field
_, err = client.Templates().Register(ctx, zeal.RegisterTemplatesRequest{
    Namespace: "my-ns",
    Templates: []zeal.NodeTemplate{
        {
            ID:          "chart-display",
            Type:        "chart",
            Title:       "Chart",
            Category:    "visualization",
            Description: "Interactive chart node",
            Icon:        "bar-chart",
            Ports:       []zeal.Port{{ID: "data-in", Label: "Data", Type: "input", Position: "left"}},
            Display: &zeal.DisplayComponent{
                Element:       "my-chart-node",
                BundleID:      stringPtr(fmt.Sprintf("my-ns/%s", bundle.BundleID)),
                Shadow:        boolPtr(true),
                ObservedProps: []string{"chartType", "colorScheme"},
                Width:         stringPtr("400px"),
            },
        },
    },
})
```

### Traces API

Record and replay execution traces:

```go
// Create trace session
session, err := client.Traces().CreateSession(ctx, zeal.CreateTraceSessionRequest{
    WorkflowID:  "workflow-123",
    ExecutionID: "exec-456",
    Metadata: map[string]interface{}{
        "trigger":     "manual",
        "environment": "production",
    },
})

// Submit trace events
err = client.Traces().SubmitEvents(ctx, session.SessionID, []zeal.TraceEvent{
    {
        Timestamp: time.Now().UnixMilli(),
        NodeID:    "node-1",
        EventType: "input",
        Data: zeal.TraceData{
            Size:     256,
            DataType: "application/json",
            Preview:  map[string]interface{}{"key": "value"},
        },
    },
    {
        Timestamp: time.Now().UnixMilli(),
        NodeID:    "node-1",
        EventType: "output",
        Data: zeal.TraceData{
            Size:     512,
            DataType: "application/json",
        },
        Duration: int64Ptr(150),
    },
})

// Complete session
_, err = client.Traces().CompleteSession(ctx, session.SessionID, zeal.CompleteSessionRequest{
    Status: "success",
    Summary: &zeal.SessionSummary{
        TotalNodes:         5,
        SuccessfulNodes:    5,
        FailedNodes:        0,
        TotalDuration:      1200,
        TotalDataProcessed: 4096,
    },
})
```

### Webhooks API

```go
// Create webhook
webhook, err := client.Webhooks().Create(ctx, zeal.CreateWebhookRequest{
    URL:    "https://my-server.com/hooks/zeal",
    Events: []string{"node.executing", "node.completed", "stream.opened"},
})

// List webhooks
webhooks, err := client.Webhooks().List(ctx)

// Update webhook
_, err = client.Webhooks().Update(ctx, webhook.Subscription.ID, zeal.UpdateWebhookRequest{
    IsActive: boolPtr(false),
})

// Delete webhook
_, err = client.Webhooks().Delete(ctx, webhook.Subscription.ID)
```

### Event System

Listen to webhook events with the subscription pattern:

```go
subscription := client.Webhooks().Subscribe()

subscription.OnEvent(func(event zeal.ZipWebhookEvent) error {
    switch e := event.(type) {
    case *zeal.NodeExecutingEvent:
        log.Printf("Node %s executing in workflow %s", e.NodeID, e.WorkflowID)
    case *zeal.NodeCompletedEvent:
        log.Printf("Node %s completed (duration: %dms)", e.NodeID, *e.Duration)
    case *zeal.StreamOpenedEvent:
        log.Printf("Stream %d opened on node %s (port: %s)", e.StreamID, e.NodeID, e.Port)
    case *zeal.StreamClosedEvent:
        log.Printf("Stream %d closed (%d bytes)", e.StreamID, e.TotalBytes)
    case *zeal.StreamErrorEvent:
        log.Printf("Stream %d error: %s", e.StreamID, e.Error)
    case *zeal.GroupCreatedEvent:
        log.Printf("Group created in workflow %s", e.WorkflowID)
    }
    return nil
})

// Parse incoming webhook JSON
event, err := zeal.ParseZipWebhookEvent(jsonBytes)
```

### Stream Events & Binary Frames

Work with binary streaming data from the Reflow infrastructure:

```go
// Type guards
zeal.IsStreamEvent("stream.opened")   // true
zeal.IsStreamEvent("node.executing")  // false
zeal.IsExecutionEvent("node.failed")  // true

// Create stream events
opened := zeal.CreateStreamOpenedEvent(
    "workflow-1", "node-1", "ImageOut", 42,
    stringPtr("image/raw-rgba"),  // contentType
    uint64Ptr(262144),            // sizeHint
    nil,                          // graphId
)

closed := zeal.CreateStreamClosedEvent("workflow-1", "node-1", 42, 262144, nil)
errEvt := zeal.CreateStreamErrorEvent("workflow-1", "node-1", 42, "upstream reset", nil)

// Parse binary stream frames
// Wire format: [1 byte: type] [8 bytes: stream_id LE u64] [payload...]
frame, err := zeal.ParseStreamFrame(data)
if err != nil {
    log.Fatal(err)
}

switch frame.FrameType {
case zeal.StreamFrameBegin: // 0x01
    log.Printf("Stream %d beginning", frame.StreamID)
case zeal.StreamFrameData:  // 0x02
    log.Printf("Stream %d data: %d bytes", frame.StreamID, len(frame.Payload))
case zeal.StreamFrameEnd:   // 0x03
    log.Printf("Stream %d complete", frame.StreamID)
case zeal.StreamFrameError: // 0x04
    log.Printf("Stream %d error: %s", frame.StreamID, string(frame.Payload))
}
```

### DisplayComponent Type Reference

```go
type DisplayComponent struct {
    Element       string   `json:"element"`                 // Custom element tag (must contain hyphen)
    BundleID      *string  `json:"bundleId,omitempty"`      // Uploaded bundle reference
    Source        *string  `json:"source,omitempty"`        // Inline JS source
    Shadow        *bool    `json:"shadow,omitempty"`        // Shadow DOM (default: true)
    ObservedProps []string `json:"observedProps,omitempty"` // Props forwarded individually
    Width         *string  `json:"width,omitempty"`         // Custom node width
}
```

## Helper Functions

```go
func stringPtr(s string) *string   { return &s }
func boolPtr(b bool) *bool         { return &b }
func intPtr(i int) *int            { return &i }
func int64Ptr(i int64) *int64      { return &i }
func uint64Ptr(i uint64) *uint64   { return &i }
```

## License

Apache License 2.0 - see LICENSE file for details.
