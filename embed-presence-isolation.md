# Embed View Presence Isolation

## Summary of Changes

Successfully implemented presence isolation for embed views to prevent them from propagating presence information to CRDT clients.

### Changes Made:

1. **Added `embedMode` tracking to WorkflowStore**:
   - Added `embedMode: boolean` to store state
   - Pass embed mode during initialization
   - Store embed mode state for use in various presence-related functions

2. **Conditional Presence Setup**:
   - Modified `initialize` in workflow-store.ts to skip `setupPresence` when in embed mode
   - Presence observers are not created for embed views

3. **Disabled Cursor Tracking in Embed Mode**:
   - Updated `updateCursorPosition` to return early when `embedMode` is true
   - Prevents cursor position updates from being sent to CRDT server

4. **Enhanced RustSocketIOProvider**:
   - Added `skipPresence?: boolean` option to provider config
   - Skip setting initial user state when `skipPresence` is true
   - Skip awareness update observer setup when in embed mode
   - Pass `skipPresence: true` when creating provider in embed mode

### How It Works:

1. When workflow is loaded in embed mode:
   - `embedMode: true` is stored in workflow store state
   - Provider is created with `skipPresence: true`
   - No initial user state is set in awareness
   - No awareness update observers are created
   - `setupPresence` function is skipped entirely

2. During runtime:
   - `updateCursorPosition` checks `embedMode` and returns early
   - No cursor movements are broadcast
   - No presence updates are sent to other clients

3. Result:
   - Embed views are "invisible" to other CRDT clients
   - They can still receive updates but don't broadcast presence
   - Regular workflow views continue to have full presence features

### Testing:

To verify presence isolation:

1. Open a workflow in regular mode
2. Open the same workflow in embed mode (different browser/incognito)
3. Move cursor in embed view - should not appear in regular view
4. Move cursor in regular view - should appear for other regular views
5. Check network tab - embed view should not send awareness updates

### Code Flow:

```
Embed Page → WorkflowPage (embedMode: true)
     ↓
initialize(id, name, { embedMode: true, collaborative: true })
     ↓
Store: set({ embedMode: true })
     ↓
RustSocketIOProvider({ skipPresence: true })
     ↓
No awareness setup, no presence broadcasting
```

This ensures embed views can participate in CRDT collaboration for data synchronization while remaining invisible from a presence perspective.