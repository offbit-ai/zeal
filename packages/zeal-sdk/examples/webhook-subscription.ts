/**
 * Examples of using webhook subscriptions in the Zeal SDK
 */

import ZealClient, { WebhookEvent } from '../src'

async function main() {
  const client = new ZealClient({
    baseUrl: 'http://localhost:3000'
  })

  // Example 1: Simple callback-based subscription
  await example1_CallbackSubscription(client)
  
  // Example 2: Observable-based subscription with filtering
  await example2_ObservableSubscription(client)
  
  // Example 3: Subscribe to specific event types
  await example3_EventTypeFiltering(client)
  
  // Example 4: Advanced observable operations
  await example4_AdvancedObservables(client)
  
  // Example 5: Multiple subscribers and event processing
  await example5_MultipleSubscribers(client)
}

/**
 * Example 1: Simple callback-based subscription
 */
async function example1_CallbackSubscription(client: ZealClient) {
  console.log('\n=== Example 1: Callback-based Subscription ===\n')
  
  // Create a webhook subscription
  const subscription = client.createSubscription({
    port: 3001,
    namespace: 'my-integration',
    events: ['workflow.*', 'node.*'], // Subscribe to workflow and node events
  })
  
  // Subscribe to events with a callback
  const unsubscribe = subscription.onEvent(async (event: WebhookEvent) => {
    console.log('Received event:', {
      type: event.type,
      source: event.source,
      workflowId: event.workflowId,
      timestamp: event.timestamp
    })
    
    // Process the event
    if (event.type === 'workflow.created') {
      console.log('New workflow created:', event.data)
    } else if (event.type === 'node.added') {
      console.log('Node added to workflow:', event.nodeId)
    }
  })
  
  // Start the webhook server
  await subscription.start()
  console.log('Webhook subscription started')
  
  // Run for 30 seconds then cleanup
  setTimeout(async () => {
    unsubscribe() // Remove the callback
    await subscription.stop() // Stop the server
    console.log('Webhook subscription stopped')
  }, 30000)
}

/**
 * Example 2: Observable-based subscription with filtering
 */
async function example2_ObservableSubscription(client: ZealClient) {
  console.log('\n=== Example 2: Observable-based Subscription ===\n')
  
  const subscription = client.createSubscription({
    port: 3002,
    namespace: 'observable-demo',
    events: ['*'], // Subscribe to all events
  })
  
  // Get the observable
  const observable = subscription.asObservable()
  
  // Filter for only error events
  const errorEvents = observable.filter(event => 
    event.type.includes('error') || event.type.includes('failed')
  )
  
  // Subscribe to filtered events
  const sub = errorEvents.subscribe(
    (event) => {
      console.error('Error event received:', event.type, event.data)
      // Could send alerts, log to monitoring system, etc.
    },
    (error) => {
      console.error('Subscription error:', error)
    },
    () => {
      console.log('Error event subscription completed')
    }
  )
  
  await subscription.start()
  
  // Cleanup after 30 seconds
  setTimeout(async () => {
    sub.unsubscribe()
    await subscription.stop()
  }, 30000)
}

/**
 * Example 3: Subscribe to specific event types
 */
async function example3_EventTypeFiltering(client: ZealClient) {
  console.log('\n=== Example 3: Event Type Filtering ===\n')
  
  const subscription = client.createSubscription({
    port: 3003,
    namespace: 'filtered-events',
  })
  
  // Subscribe to specific event types
  subscription.onEventType(['node.executed', 'execution.completed'], (event) => {
    console.log(`Execution event: ${event.type}`, {
      nodeId: event.nodeId,
      sessionId: event.sessionId,
      duration: event.data?.duration
    })
  })
  
  // Subscribe to events from specific sources
  subscription.onEventSource('crdt', (event) => {
    console.log('CRDT event:', event.type, {
      workflowId: event.workflowId,
      graphId: event.graphId
    })
  })
  
  await subscription.start()
  
  setTimeout(async () => {
    await subscription.stop()
  }, 30000)
}

/**
 * Example 4: Advanced observable operations
 */
async function example4_AdvancedObservables(client: ZealClient) {
  console.log('\n=== Example 4: Advanced Observable Operations ===\n')
  
  const subscription = client.createSubscription({
    port: 3004,
    namespace: 'advanced-observables',
  })
  
  const observable = subscription.asObservable()
  
  // Chain operations: filter and map
  const processedEvents = observable
    .filter(event => event.source === 'execution')
    .map(event => ({
      id: event.id,
      timestamp: new Date(event.timestamp),
      duration: event.data?.duration || 0,
      status: event.type === 'execution.completed' ? 'success' : 'failed'
    }))
  
  // Subscribe to processed events
  processedEvents.subscribe(
    (processed) => {
      console.log('Processed execution:', processed)
    }
  )
  
  // Create another filtered stream for monitoring
  const longRunningExecutions = observable
    .filter(event => 
      event.source === 'execution' && 
      event.data?.duration > 5000 // More than 5 seconds
    )
  
  longRunningExecutions.subscribe(
    (event) => {
      console.warn('Long-running execution detected:', {
        workflowId: event.workflowId,
        duration: event.data.duration
      })
    }
  )
  
  await subscription.start()
  
  setTimeout(async () => {
    await subscription.stop()
  }, 30000)
}

/**
 * Example 5: Multiple subscribers and event processing
 */
async function example5_MultipleSubscribers(client: ZealClient) {
  console.log('\n=== Example 5: Multiple Subscribers ===\n')
  
  const subscription = client.createSubscription({
    port: 3005,
    namespace: 'multi-subscriber',
    autoRegister: true, // Automatically register with Zeal
  })
  
  // Analytics subscriber
  subscription.onEvent(async (event) => {
    // Track event metrics
    console.log('[Analytics] Event:', event.type)
  })
  
  // Logging subscriber
  subscription.onEvent(async (event) => {
    // Log to external system
    console.log('[Logger] Event:', event.id, event.timestamp)
  })
  
  // Alert subscriber for errors
  subscription.onEventType(['execution.failed', 'error.occurred'], async (event) => {
    console.error('[Alert] Error detected:', event.type, event.data)
    // Send alerts via email, Slack, etc.
  })
  
  // Process full deliveries (multiple events at once)
  subscription.onDelivery(async (delivery) => {
    console.log(`[Delivery] Received ${delivery.events.length} events in batch`)
    
    // Process batch of events
    for (const event of delivery.events) {
      // Batch processing logic
    }
  })
  
  // Get observable for reactive programming
  const observable = subscription.asObservable()
  
  // Create execution metrics stream
  const executionMetrics = observable
    .filter(e => e.source === 'execution')
    .map(e => ({
      type: e.type,
      timestamp: Date.now(),
      workflowId: e.workflowId
    }))
  
  const metricsSub = executionMetrics.subscribe(
    (metrics) => {
      console.log('[Metrics]', metrics)
    }
  )
  
  await subscription.start()
  
  // Demonstrate manual webhook registration if needed
  if (!subscription['webhookId']) {
    await subscription.register()
  }
  
  setTimeout(async () => {
    metricsSub.unsubscribe()
    await subscription.stop()
    console.log('All subscriptions stopped')
  }, 30000)
}

// Run examples
if (require.main === module) {
  main().catch(console.error)
}