# Orchestrator Real-Time Updates

This document explains how real-time updates work in the Zeal Orchestrator, allowing the embedded workflow view to update in real-time as the AI agent makes changes.

## Architecture Overview

The orchestrator uses a combination of technologies to achieve real-time updates:

1. **CRDT (Conflict-free Replicated Data Type)** - For real-time data synchronization
2. **WebSocket Connection** - Via Socket.IO to the CRDT server
3. **Embed Mode with Collaboration** - Special configuration that enables sync without presence

## How It Works

### 1. Embed View Configuration

The orchestrator's embed view is configured with special parameters:

```typescript
// In EmbedView.tsx
const embedUrl = `/embed/${workflowId}?hideHeader=true&collaborative=true`
```

This enables:

- `collaborative=true` - Enables CRDT synchronization
- `embedMode=true` - Disables presence features (cursors, user indicators)

### 2. CRDT Store Behavior

When initialized with both `embedMode: true` and `collaborative: true`:

```typescript
// In workflow-store.ts
const docId =
  options?.embedMode && !options?.collaborative
    ? `${workflowId}-embed-${Date.now()}` // Unique ID for non-collaborative embed
    : workflowId // Same ID for collaborative embed (real-time sync)
```

- Uses the same workflow ID as other clients (enables sync)
- Sets `skipPresence: true` in the provider configuration
- Presence features remain disabled

### 3. Provider Configuration

The RustSocketIOProvider is configured with:

```typescript
provider = new RustSocketIOProvider(doc, {
  roomName: workflowId,
  serverUrl: serverUrl,
  autoConnect: false,
  skipPresence: options?.embedMode, // This is true for embed mode
  // ...
})
```

When `skipPresence: true`:

- No user state is set in awareness
- No cursor position updates are sent
- No presence information is broadcast
- Data synchronization still works normally

### 4. Real-Time Update Flow

```
Orchestrator Agent → API Endpoint → Database Update → CRDT Broadcast
                                                            ↓
                                                     Embed View Updates
```

1. Agent calls API to add node/connection
2. API updates the database
3. API triggers CRDT update via WorkflowOperations
4. CRDT server broadcasts changes to all connected clients
5. Embed view receives updates and renders changes

## Implementation Details

### Enabling Real-Time Updates

The key changes to enable real-time updates:

1. **EmbedView Component**: Added `collaborative=true` parameter
2. **Embed Page**: Respects the collaborative parameter from URL
3. **Workflow Store**: Uses same workflow ID when collaborative is enabled

### Presence Isolation

Even with collaborative mode enabled, presence features remain disabled:

- No cursor positions are shared
- No user avatars or names appear
- No selection highlights from other users
- The embed view is essentially "invisible" to other users

### Benefits

1. **Instant Feedback**: Users see nodes and connections appear as the agent works
2. **No Polling Required**: WebSocket connection provides push-based updates
3. **Efficient**: Only data changes are synchronized, not UI state
4. **Clean Separation**: Presence and data sync are independent

## Testing Real-Time Updates

To test real-time updates:

1. Open the orchestrator at `/orchestrator`
2. Create a new workflow through natural language
3. Watch the embed view update in real-time as nodes are added
4. Open the same workflow in a separate tab - changes should sync
5. Verify no presence indicators appear in embed view

## Troubleshooting

### Updates Not Appearing

1. Check CRDT server is running: `npm run crdt:dev`
2. Verify WebSocket connection in browser DevTools
3. Check for errors in console
4. Ensure `NEXT_PUBLIC_ENABLE_COLLABORATION=true` in `.env.local`

### Presence Appearing in Embed

If you see cursors or user indicators:

1. Verify `embedMode=true` is set
2. Check that `skipPresence` is being passed to provider
3. Ensure no presence setup code is running

## Future Enhancements

1. **Optimistic Updates**: Show changes immediately before server confirms
2. **Update Batching**: Group multiple rapid changes into single update
3. **Selective Sync**: Only sync the specific graph being modified
4. **Event System**: Allow parent window to listen for workflow changes
