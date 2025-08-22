# CRDT Embed Mode Troubleshooting

## Problem: Changes in main workflow view not reflecting in embed view

### Root Cause

The embed view creates an isolated Y.Doc instance when `collaborative` parameter is not set to `true`.

### How to Fix

1. **Add `collaborative=true` to embed URL**:

   ```
   /embed/workflow-id?collaborative=true
   ```

2. **Full example URL with all parameters**:
   ```
   /embed/workflow-id?collaborative=true&minimap=true&zoom=true&tabs=true
   ```

### Understanding the Behavior

When the embed view loads, it checks the `collaborative` parameter:

- **Without `collaborative=true`**: Creates unique doc ID: `workflowId-embed-timestamp`
- **With `collaborative=true`**: Uses same doc ID as main view: `workflowId`

Only when both views use the same doc ID will they sync through CRDT.

## Testing CRDT Sync

### Setup

1. Open main workflow view: `/workflow?id=test-workflow-123`
2. Open embed view in another tab: `/embed/test-workflow-123?collaborative=true`
3. Ensure CRDT server is running: `npm run crdt:dev`

### Expected Behavior

- Add a node in main view → Should appear instantly in embed view
- Move a node in main view → Should update position in embed view
- Delete a node in main view → Should disappear from embed view

### What Won't Sync (Presence Features)

- Cursor positions
- User selection highlights
- User avatars/names
- Active user list

## Common Issues

### 1. Still Not Syncing After Adding collaborative=true

**Check WebSocket Connection**:

- Open browser DevTools → Network → WS tab
- Look for socket.io connection to CRDT server
- Should see messages being exchanged

**Verify Same Workflow ID**:

- Main view and embed view must use exact same workflow ID
- Check URL parameters in both tabs

### 2. Delayed or Intermittent Sync

**Possible Causes**:

- Network latency
- CRDT server under load
- Browser throttling background tabs

**Solutions**:

- Keep both tabs in foreground during testing
- Check CRDT server logs for errors
- Restart CRDT server if needed

### 3. Presence Features Appearing in Embed

If you see cursors or user indicators in embed view:

- Verify `embedMode=true` is being passed to WorkflowPage
- Check that `skipPresence: true` is set in RustSocketIOProvider
- Clear browser cache and reload

## Debug Checklist

1. **URL Parameters**:
   - [ ] Embed URL includes `collaborative=true`
   - [ ] Workflow ID matches exactly between views

2. **Environment**:
   - [ ] CRDT server is running (`npm run crdt:dev`)
   - [ ] `NEXT_PUBLIC_ENABLE_COLLABORATION=true` in `.env.local`
   - [ ] No console errors in browser

3. **Network**:
   - [ ] WebSocket connection established
   - [ ] No firewall blocking WebSocket traffic
   - [ ] Both tabs can reach CRDT server

## Implementation Details

The key code paths for CRDT sync in embed mode:

1. **URL Parameter Processing** (`/app/embed/[id]/page.tsx`):

   ```typescript
   collaborative: searchParams.get('collaborative') === 'true'
   ```

2. **Doc ID Selection** (`/store/workflow-store.ts`):

   ```typescript
   const docId =
     options?.embedMode && !options?.collaborative
       ? `${workflowId}-embed-${Date.now()}` // Isolated
       : workflowId // Shared
   ```

3. **Provider Configuration**:
   ```typescript
   skipPresence: options?.embedMode // Always true in embed
   ```

## Summary

For CRDT sync between main and embed views:

- **Required**: Add `collaborative=true` to embed URL
- **Result**: Real-time data sync without presence features
- **Default**: Isolated view (no sync) for privacy/performance
