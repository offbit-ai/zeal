# Zeal Java SDK

Java SDK for the Zeal Integration Protocol (ZIP) - A comprehensive toolkit for workflow automation and real-time collaboration.

## Installation

### Maven
```xml
<dependency>
    <groupId>com.offbit</groupId>
    <artifactId>zeal-java-sdk</artifactId>
    <version>1.0.0</version>
</dependency>
```

### Gradle
```gradle
implementation 'com.offbit:zeal-java-sdk:1.0.0'
```

## Quick Start

```java
import com.offbit.zeal.ZealClient;
import com.offbit.zeal.config.ClientConfig;
import com.offbit.zeal.types.orchestrator.CreateWorkflowRequest;

public class QuickStart {
    public static void main(String[] args) throws Exception {
        // Create client with configuration
        ClientConfig config = ClientConfig.builder()
            .baseUrl("http://localhost:3000")
            .build();
        
        ZealClient client = new ZealClient(config);
        
        // Create a workflow
        CreateWorkflowRequest request = CreateWorkflowRequest.builder()
            .name("My Workflow")
            .description("A sample workflow")
            .build();
        
        var response = client.orchestrator().createWorkflow(request);
        System.out.println("Created workflow: " + response.getWorkflowId());
        
        // Clean up
        client.close();
    }
}
```

## Features

- **Full ZIP Protocol Support**: Complete implementation of the Zeal Integration Protocol
- **Type-Safe API**: Strongly typed requests and responses with builder patterns
- **Async Support**: CompletableFuture-based async operations
- **Webhook Subscriptions**: Built-in HTTP server for receiving webhook events
- **Observable Pattern**: Reactive programming support for event streams
- **Retry Logic**: Automatic retry with exponential backoff
- **Event System**: Comprehensive event hierarchy with type guards

## Configuration

```java
ClientConfig config = ClientConfig.builder()
    .baseUrl("http://localhost:3000")
    .timeout(Duration.ofSeconds(60))
    .maxRetries(5)
    .retryBackoffMs(2000)
    .verifyTls(false)  // For development only
    .userAgent("my-app/1.0")
    .addDefaultHeader("X-API-Key", "secret")
    .build();
```

## API Usage

### Orchestrator API

```java
// Create workflow
CreateWorkflowResponse workflow = client.orchestrator()
    .createWorkflow(request);

// Add node
var nodeResponse = client.orchestrator()
    .addNode(nodeRequest);

// Connect nodes
var connection = client.orchestrator()
    .connectNodes(connectionRequest);

// Create group
var group = client.orchestrator()
    .createGroup(groupRequest);
```

### Templates API

```java
// Register templates
var result = client.templates()
    .register(templatesRequest);

// List templates
var templates = client.templates()
    .list("namespace");
```

### Traces API

```java
// Create trace session
var session = client.traces()
    .createSession(sessionRequest);

// Submit events
client.traces()
    .submitEvents(session.getSessionId(), events);

// Complete session
client.traces()
    .completeSession(session.getSessionId(), completeRequest);
```

### Webhooks API

```java
// Create webhook
var webhook = client.webhooks()
    .create(webhookRequest);

// List webhooks
var webhooks = client.webhooks()
    .list();

// Test webhook
var testResult = client.webhooks()
    .test(webhookId);
```

## Webhook Subscriptions

```java
// Create subscription with options
SubscriptionOptions options = SubscriptionOptions.builder()
    .port(3001)
    .namespace("my-runtime")
    .events(Arrays.asList("node.*", "execution.*"))
    .autoRegister(true)
    .build();

WebhookSubscription subscription = client.createWebhookSubscription(options);

// Subscribe to events
subscription.onEvent(event -> {
    System.out.println("Received event: " + event.getType());
});

// Type-safe event handling
subscription.onEvent(NodeExecutingEvent.class, event -> {
    System.out.println("Node executing: " + event.getNodeId());
});

// Start the subscription
subscription.start();

// Register with Zeal (if not auto-registered)
subscription.register();
```

## Observable Pattern

```java
// Get observable interface
WebhookObservable observable = subscription.asObservable();

// Filter and map events
observable
    .filter(event -> event.isExecutionEvent())
    .map(event -> event.getWorkflowId())
    .subscribe(
        workflowId -> System.out.println("Execution in workflow: " + workflowId),
        error -> System.err.println("Error: " + error),
        () -> System.out.println("Complete")
    );

// Filter by event type
subscription.filterEvents(event -> "node.failed".equals(event.getType()))
    .subscribe(event -> {
        System.err.println("Node failed: " + event);
    });
```

## Async Operations

```java
// Async workflow creation
CompletableFuture<CreateWorkflowResponse> future = client.orchestrator()
    .createWorkflowAsync(request);

future.thenAccept(response -> {
    System.out.println("Workflow created: " + response.getWorkflowId());
}).exceptionally(error -> {
    System.err.println("Failed to create workflow: " + error);
    return null;
});

// Combine multiple async operations
CompletableFuture.allOf(
    client.orchestrator().createWorkflowAsync(request1),
    client.orchestrator().createWorkflowAsync(request2)
).thenRun(() -> {
    System.out.println("All workflows created");
});
```

## Event Types

The SDK provides a complete event hierarchy:

```java
// Execution events
NodeExecutingEvent
NodeCompletedEvent
NodeFailedEvent
NodeWarningEvent
ExecutionStartedEvent
ExecutionCompletedEvent
ExecutionFailedEvent

// Workflow events
WorkflowCreatedEvent
WorkflowUpdatedEvent
WorkflowDeletedEvent

// CRDT events
NodeAddedEvent
NodeUpdatedEvent
NodeDeletedEvent
ConnectionAddedEvent
ConnectionDeletedEvent
GroupCreatedEvent
GroupUpdatedEvent
GroupDeletedEvent
```

## Error Handling

```java
try {
    var workflow = client.orchestrator().createWorkflow(request);
} catch (ZealException e) {
    if (e.isClientError()) {
        // Handle 4xx errors
        System.err.println("Client error: " + e.getMessage());
    } else if (e.isServerError()) {
        // Handle 5xx errors
        System.err.println("Server error: " + e.getMessage());
    } else if (e.isNetworkError()) {
        // Handle network errors
        System.err.println("Network error: " + e.getMessage());
    }
}
```

## Building from Source

```bash
# Clone the repository
git clone https://github.com/offbit-ai/zeal.git
cd zeal/packages/zeal-java-sdk

# Build with Maven
mvn clean install

# Run tests
mvn test

# Generate JavaDoc
mvn javadoc:javadoc
```

## Requirements

- Java 11 or higher
- Maven 3.6+ or Gradle 6+

## Dependencies

- OkHttp 4.x - HTTP client
- Jackson 2.x - JSON serialization
- Jetty 11.x - Embedded HTTP server for webhooks
- SLF4J - Logging facade

## License

Apache License 2.0 - see LICENSE file for details.

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../../CONTRIBUTING.md) for details.

## Support

For support and questions:
- GitHub Issues: https://github.com/offbit-ai/zeal/issues
- Documentation: https://docs.zeal.ai