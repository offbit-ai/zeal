# Orchestrator Agent Response Phases

## Response Types (StreamingAgentResponse)

The agent yields different response types during workflow creation/modification. The ChatInterface component handles each type differently:

### 1. `status` - Progress Updates
```typescript
yield { type: 'status', content: 'Analyzing your request...' }
```
- **Purpose**: Show progress/activity to user
- **UI**: Updates the assistant message content
- **Examples**:
  - "Understanding your workflow requirements..."
  - "Creating workflow: {name}..."
  - "Planning workflow structure..."
  - "Adding nodes to workflow..."

### 2. `message` - Informational Messages
```typescript
yield { 
  type: 'message', 
  content: 'Created workflow "Data Pipeline"',
  workflowId: 'wf_abc123' 
}
```
- **Purpose**: Permanent messages showing what was done
- **UI**: Updates assistant message, accumulates content
- **Examples**:
  - "Created workflow {name}"
  - "✓ Found template: {template}"
  - "✓ Added {node}"

### 3. `action` - Background Actions
```typescript
yield { type: 'action', action: { tool: 'add_node', arguments: {...} } }
```
- **Purpose**: Track actions performed (optional)
- **UI**: Increments action counter, shown in summary

### 4. `question` - User Input Required
```typescript
yield {
  type: 'question',
  content: 'I need some information:',
  questions: [...PropertyQuestion],
  requiresInput: true,
  workflowId: 'wf_abc123'
}
```
- **Purpose**: Request configuration values from user
- **UI**: Shows questions, stops processing until answered
- **Flow**: Agent waits for user response before continuing

### 5. `error` - Error Messages
```typescript
yield { 
  type: 'error', 
  content: 'Failed to create workflow' 
}
```
- **Purpose**: Show errors to user
- **UI**: Updates message with error content
- **Flow**: Usually terminates processing

### 6. `crdt_sync_required` - Force Sync
```typescript
yield {
  type: 'crdt_sync_required',
  content: 'Workflow finalized, syncing...',
  metadata: { connectionCount: 5 }
}
```
- **Purpose**: Trigger CRDT sync for connections
- **UI**: Sends message to embed frame to force poll
- **When**: After adding connections

### 7. `workflow_ready` - Final State
```typescript
yield {
  type: 'workflow_ready',
  content: 'Workflow complete! Added 5 nodes and 4 connections.',
  metadata: { nodeCount: 5, connectionCount: 4 }
}
```
- **Purpose**: Indicate workflow is complete and ready
- **UI**: Final message with summary
- **Metadata**: Sets `workflowReady: true`

### 8. `complete` - Processing Complete
```typescript
yield { 
  type: 'complete', 
  workflowId: 'wf_abc123',
  metadata: { nodeCount: 5, connectionCount: 4 }
}
```
- **Purpose**: Signal end of processing
- **UI**: Final update with metadata
- **Flow**: Last response from agent

## Correct Phase Sequence

### New Workflow Creation
```
1. status: "Analyzing your request..."
2. status: "Understanding your workflow requirements..."
3. [extractIntent - LLM call]
4. status: "Creating workflow: {name}..."
5. message: "Created workflow {name}" (with workflowId)
6. status: "Planning workflow structure..."
7. status: "Finding relevant nodes..." (if GraphRAG)
8. status: "Adding nodes to workflow..."
9. message: "✓ Found template: {template}" (for each node)
10. status: "Adding node: {title}..."
11. message: "✓ Added {node}" (for each successful add)
12. [Optional] question: "I need some information..." (if config needed)
13. status: "Creating connections..."
14. message: "Created {n} connections"
15. crdt_sync_required: "Workflow finalized, syncing..."
16. workflow_ready: "Workflow complete! Added {n} nodes..."
17. complete: (with final metadata)
```

### Workflow Modification
```
1. status: "Analyzing current workflow..."
2. status: "Understanding your modification..."
3. [Determine modification type]
4. status: "Adding new nodes..." / "Updating properties..." / etc.
5. message: "✓ Added {node}" / "✓ Updated {property}"
6. [Optional] question: "Need configuration..."
7. crdt_sync_required: (if connections changed)
8. complete: "Workflow updated successfully"
```

### Question/Answer Flow
```
1. [User provides input]
2. status: "Processing your configuration..."
3. [Process answers]
4. message: "Updated {n} properties"
5. [Continue with workflow or ask more questions]
6. complete: (when all questions answered)
```

## Implementation Guidelines

### For Optimized Agent

When optimizing the agent, ensure all phases are maintained:

```typescript
// Start with status
yield { type: 'status', content: 'Analyzing your request...' }

// After combined analysis (single LLM call)
yield { type: 'status', content: `Creating workflow: ${analysis.intent.suggestedName}...` }

// After workflow creation
yield { 
  type: 'message', 
  content: `Created workflow "${analysis.intent.suggestedName}"`,
  workflowId 
}

// During node addition
yield { type: 'status', content: 'Selecting components...' }

// After nodes added
yield {
  type: 'message',
  content: `Added ${nodeCount} nodes to the workflow`,
  metadata: { nodeCount }
}

// After connections
yield {
  type: 'message',
  content: `Created ${connectionCount} connections`,
  metadata: { connectionCount }
}

// If questions needed
if (needsConfig) {
  yield {
    type: 'question',
    content: 'I need some additional information:',
    questions: [...],
    requiresInput: true
  }
  return // Stop here, wait for user input
}

// Force sync if needed
if (connectionCount > 0) {
  yield {
    type: 'crdt_sync_required',
    content: 'Syncing workflow...',
    metadata: { connectionCount }
  }
}

// Final summary
yield {
  type: 'workflow_ready',
  content: summary,
  metadata: { nodeCount, connectionCount }
}

// Always end with complete
yield {
  type: 'complete',
  workflowId,
  metadata: { nodeCount, connectionCount, confidence: analysis.confidence.score }
}
```

## Important Notes

1. **Order Matters**: Status updates should come before the action
2. **WorkflowId**: Include in messages after workflow is created
3. **Questions Stop Flow**: When yielding 'question', return immediately
4. **CRDT Sync**: Only needed when connections are added/modified
5. **Complete is Final**: Always the last response
6. **Metadata**: Include counts and relevant info for UI updates

## Error Handling

```typescript
try {
  // ... workflow creation logic
} catch (error) {
  yield { 
    type: 'error', 
    content: `Failed: ${error.message}` 
  }
  return // Stop processing
}
```

## Testing Checklist

- [ ] Status messages appear during processing
- [ ] Messages accumulate properly
- [ ] Questions pause execution
- [ ] CRDT sync triggers for connections
- [ ] workflow_ready shows summary
- [ ] complete always comes last
- [ ] Errors terminate gracefully
- [ ] Metadata includes correct counts