# CRDT Node Deletion Persistence Fix

## Problem
Deleted nodes were reappearing after page refresh because CRDT data was taking precedence over the database state, even when the database had newer deletion updates.

## Root Cause
When loading a workflow:
1. The system checked if CRDT had data
2. If it did, it would load from CRDT without checking timestamps
3. Deleted nodes persisted in CRDT and would override the database state

## Solution Implemented

### 1. Added Timestamp Tracking
- Added `lastModified` timestamp to CRDT metadata
- This timestamp is updated whenever operations modify the workflow:
  - `addNode`
  - `removeNode` 
  - `addConnection`
  - `removeConnection`
  - `saveToAPI`

### 2. Timestamp Comparison on Load
In the `initialize` function, added logic to compare timestamps:
```typescript
if (enableCRDT && hasData) {
  const snapshot = await WorkflowStorageService.getWorkflow(workflowId)
  if (snapshot) {
    const crdtLastModified = metadataMap.get('lastModified') as number
    const dbLastModified = new Date(snapshot.updatedAt || snapshot.lastSavedAt).getTime()
    
    // If database is newer or CRDT has no timestamp, load from database
    if (!crdtLastModified || dbLastModified > crdtLastModified) {
      // Load from database instead of CRDT
    } else {
      // CRDT is newer, load from CRDT
    }
  }
}
```

### 3. Key Changes Made

#### store/workflow-store.ts
- `removeNode`: Added timestamp update before deletion
- `addNode`: Added timestamp update when creating nodes  
- `addConnection`: Added timestamp update when creating connections
- `removeConnection`: Added timestamp update when removing connections
- `initialize`: Added timestamp comparison logic to prefer newer data source
- `saveToAPI`: Already had timestamp update logic

#### services/workflowStorage.ts
- Removed all localStorage fallback code
- Fixed errors from removed STORAGE_KEY references

## How It Works Now

1. **On Node Deletion**:
   - Updates CRDT `lastModified` timestamp
   - Deletes node from CRDT maps
   - Saves to database via API (which updates database timestamp)

2. **On Page Refresh**:
   - Checks both CRDT and database timestamps
   - Loads from the source with the newer timestamp
   - If database is newer (e.g., after deletion), it takes precedence
   - CRDT data is overwritten with database state

3. **Result**:
   - Deleted nodes stay deleted across refreshes
   - Database acts as the source of truth for persistent state
   - CRDT provides real-time collaboration but respects database authority

## Testing
To verify the fix:
1. Create a workflow with nodes
2. Delete a node
3. Verify deletion saves to database (check network tab)
4. Refresh the page
5. Deleted node should not reappear