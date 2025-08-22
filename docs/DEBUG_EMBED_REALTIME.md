# Debugging Embed Real-Time Sync

## Quick Checklist

To enable real-time CRDT sync in embed mode:

1. ✅ **Add `collaborative=true` to embed URL**

   ```
   /embed/workflow-id?collaborative=true
   ```

2. ✅ **Ensure CRDT server is running**

   ```bash
   npm run crdt:dev
   ```

3. ✅ **Check environment configuration**

   ```
   NEXT_PUBLIC_ENABLE_COLLABORATION=true
   NEXT_PUBLIC_RUST_CRDT_URL="ws://localhost:8080"
   ```

4. ✅ **Use same workflow ID in both views**
   - Main: `/workflow?id=test-workflow-123`
   - Embed: `/embed/test-workflow-123?collaborative=true`

## Testing Real-Time Sync

Use the test page at `/test-embed-sync.html` to verify:

1. Both views load with the same workflow ID
2. Changes in one view appear in the other
3. No presence indicators (cursors) appear in embed view

## Common Issues and Solutions

### 1. Changes Not Syncing

**Check WebSocket Connection**:

1. Open DevTools → Network → WS tab
2. Look for connection to `ws://localhost:8080`
3. Should see `crdt:join` and `crdt:sync` messages

**Verify in Console**:

```javascript
// In browser console of embed page
document.querySelector('iframe').contentWindow.useWorkflowStore.getState()
```

Check:

- `workflowId` matches between views
- `isConnected` is true
- `provider` is not null

### 2. Embed Creates New Workflow

**Symptom**: Embed view shows empty workflow instead of syncing

**Fix**: Ensure workflow ID is properly passed:

```javascript
// Check embed URL has workflowId
console.log(window.location.pathname) // Should be /embed/actual-workflow-id
```

### 3. "Collaborative Mode Disabled" Behavior

Without `collaborative=true`, embed creates isolated instance:

- Doc ID: `workflow-id-embed-1234567890`
- No sync with other views
- Each embed is independent

With `collaborative=true`:

- Doc ID: `workflow-id` (same as main)
- Real-time sync enabled
- Presence still disabled

### 4. CRDT Server Connection Issues

**Check server logs**:

```bash
# In terminal running CRDT server
[Rust CRDT] Client connected: client-id
[Rust CRDT] Client joined room: workflow-id
```

**Common errors**:

- `WebSocket connection failed` - CRDT server not running
- `Room not found` - Workflow ID mismatch
- `Auth failed` - Check if API keys are required

## Implementation Details

### How Sync Works

1. **Embed page** passes `collaborative` param to workflow page
2. **Workflow store** checks embed mode + collaborative:
   ```typescript
   const docId =
     options?.embedMode && !options?.collaborative
       ? `${workflowId}-embed-${Date.now()}` // Isolated
       : workflowId // Shared
   ```
3. **CRDT Provider** connects with `skipPresence: true` for embed
4. **Y.Doc** syncs data but not awareness/presence

### What Syncs

- ✅ Nodes (add, update, delete)
- ✅ Connections
- ✅ Groups
- ✅ Graph structure
- ✅ Metadata

### What Doesn't Sync (Presence)

- ❌ Cursor positions
- ❌ User selections
- ❌ User avatars/names
- ❌ Active user list

## Advanced Debugging

### Check Y.Doc State

```javascript
// In console of either view
const store = useWorkflowStore.getState()
const doc = store.doc
console.log('Doc ID:', doc.guid)
console.log('Nodes:', Array.from(doc.getMap('nodes-main').values()))
```

### Monitor CRDT Events

```javascript
// Add to console to see all CRDT updates
const doc = useWorkflowStore.getState().doc
doc.on('update', (update, origin) => {
  console.log('CRDT Update:', {
    origin,
    size: update.length,
    timestamp: new Date().toISOString(),
  })
})
```

### Force Sync

```javascript
// If sync seems stuck
const provider = useWorkflowStore.getState().provider
provider.disconnect()
setTimeout(() => provider.connect(), 1000)
```

## Summary

For real-time updates in embed mode:

1. Always include `collaborative=true` in embed URL
2. Ensure CRDT infrastructure is running
3. Use same workflow ID across views
4. Check WebSocket connections in DevTools

The system is designed to provide real-time data sync while maintaining privacy through disabled presence features in embed mode.
