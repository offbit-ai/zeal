# Event Integration Journey: Reflow → Zeal Embed SDK

## Overview
This document explains how events flow from the Reflow runtime through the Zeal Embed SDK to the user application.

## Event Flow Architecture

```
[Reflow Network] → [Worker Thread] → [Message Protocol] → [Main Thread Runtime] → [Execution Handle] → [User Application]
```

## 1. Reflow NetworkEvent Types (Source)

Reflow emits NetworkEvents with camelCase `_type` values:

- **Network Lifecycle:**
  - `NetworkStarted` - Network begins execution
  - `NetworkIdle` - Network has no active actors
  - `NetworkShutdown` - Network terminates

- **Actor Events:**
  - `ActorStarted` - Actor begins execution
  - `ActorCompleted` - Actor finishes successfully
  - `ActorFailed` - Actor encounters an error
  - `ActorEmit` - Actor emits custom event

- **Message Events:**
  - `MessageSent` - Message sent between actors
  - `MessageReceived` - Actor receives message

## 2. Worker Thread Translation Layer

The worker (`reflow-runtime.worker.ts`) receives Reflow events and translates them to MessageProtocol messages:

```typescript
// Reflow Event → MessageProtocol Type
'NetworkStarted'  → MessageType.EXECUTION_STARTED
'ActorStarted'    → MessageType.NODE_EXECUTE  
'ActorCompleted'  → MessageType.NODE_RESULT
'ActorFailed'     → MessageType.NODE_ERROR
'NetworkShutdown' → MessageType.EXECUTION_COMPLETE
```

## 3. Message Protocol Bridge

The MessageProtocol handles bidirectional communication between worker and main thread:

```typescript
// Worker broadcasts:
this.broadcastMessage(MessageType.NODE_EXECUTE, {
  executionId,
  actorId: networkEvent.actorId,
  component: networkEvent.component,
  timestamp: networkEvent.timestamp
});
```

## 4. Main Thread Runtime

The main runtime (`reflow-runtime.ts`) receives protocol messages and routes them to execution handles:

```typescript
// MessageProtocol Type → ExecutionHandle Event
MessageType.EXECUTION_STARTED → 'start'
MessageType.NODE_EXECUTE      → 'actor-started'
MessageType.NODE_RESULT       → 'actor-completed'
MessageType.NODE_ERROR        → 'actor-failed'
MessageType.EXECUTION_COMPLETE → 'complete'
MessageType.EXECUTION_FAILED  → 'error'
```

## 5. Execution Handle

The ExecutionHandle maintains workflow and actor states, emitting events to the user:

```typescript
// Internal Event → User Event
'start'           → emit('start')
'actor-started'   → emit('actor:started')
'actor-completed' → emit('actor:completed')
'actor-failed'    → emit('actor:failed')
'complete'        → emit('complete')
'error'           → emit('error')
```

## 6. State Management

### Workflow States (`WorkflowState`)
- `idle` - Not started
- `running` - Active (long-running)
- `failed` - One or more actors failed
- `shutdown` - Network terminated

### Actor States (`ActorExecutionState`)
- `pending` - Not yet started
- `running` - Currently executing
- `completed` - Finished successfully
- `failed` - Encountered error

## Event Translation Example

When an actor starts in Reflow:

1. **Reflow emits:** `{ _type: "ActorStarted", actorId: "123", component: "transformer", timestamp: 1234567890 }`

2. **Worker translates:** Sends `MessageType.NODE_EXECUTE` with payload

3. **Main runtime routes:** Calls `handle.handleEvent('actor-started', payload)`

4. **Execution handle updates:** 
   - Updates actor state to `'running'`
   - Emits `'actor:started'` event

5. **User receives:** Event listener for `'actor:started'` is triggered

## Key Design Decisions

1. **Long-Running Workflows:** Reflow networks run continuously until shutdown, not completing when actors finish

2. **Actor-Centric Tracking:** Individual actor execution is tracked separately from workflow state

3. **Event Translation:** CamelCase Reflow events are translated to hyphenated events for consistency with JavaScript conventions

4. **State Derivation:** Workflow failure is derived from actor failures, not explicitly tracked

5. **Connection Tracking:** Message passing between actors is tracked to determine data flow completion

## Debugging Event Flow

To debug event flow, trace through these key points:

1. Worker event handler: `reflow-runtime.worker.ts:setupNetworkEventHandlers()`
2. Message broadcasting: `reflow-runtime.worker.ts:broadcastMessage()`
3. Main thread routing: `reflow-runtime.ts:setupPortHandlers()`
4. Handle event processing: `execution-handle.ts:handleEvent()`
5. User event emission: `execution-handle.ts:emit()`