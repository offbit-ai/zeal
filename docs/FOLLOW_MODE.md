# Follow Mode for Embed Views

Follow mode is a feature that automatically scrolls the embed view to center on elements as they are being added or modified, particularly useful when an AI agent is making changes to the workflow.

## Overview

When follow mode is enabled, the embed view will automatically:

- Center on newly added nodes
- Scroll to the midpoint of new connections
- Center on newly created groups

This ensures that viewers can see changes as they happen without manually navigating the canvas.

## Usage

### Enabling Follow Mode

Add the `follow=true` parameter to your embed URL:

```
/embed/workflow-id?collaborative=true&follow=true
```

Note: Follow mode requires `collaborative=true` to receive real-time updates.

### Example Embed URL

```javascript
const embedUrl = `/embed/${workflowId}?hideHeader=true&collaborative=true&follow=true`
```

## Implementation Details

### How It Works

1. **State Management**: Follow mode state is stored in the workflow store
2. **Auto-Scroll Trigger**: When nodes, connections, or groups are added, `scrollToElement` is called
3. **Center Calculation**: The view centers on:
   - Node position for new nodes
   - Midpoint between nodes for connections
   - Center of bounding box for groups

### Code Example

```typescript
// In workflow store
scrollToElement: (position: { x: number; y: number }, zoom?: number) => {
  const { followMode, currentGraphId } = get()
  if (!followMode) return

  // Calculate viewport center
  const viewportWidth = window.innerWidth * 0.8
  const viewportHeight = window.innerHeight * 0.8

  // Calculate offset to center the position
  const targetZoom = zoom || currentCanvas.zoom
  const centerX = viewportWidth / 2 / targetZoom
  const centerY = viewportHeight / 2 / targetZoom

  const newOffset = {
    x: centerX - position.x,
    y: centerY - position.y,
  }

  // Update canvas state
  updateCanvasState(currentGraphId, { offset: newOffset })
}
```

## Testing

Use the test page at `/test-follow-mode.html` to:

1. Load an embed view with follow mode enabled/disabled
2. Add nodes at different canvas positions
3. Create connections and groups
4. Observe auto-scrolling behavior

## Use Cases

### AI Agent Integration

When an AI agent is constructing a workflow:

```javascript
// Agent adds node - view auto-scrolls to show it
await addNode({
  metadata: { type: 'process', title: 'AI Generated Node' },
  position: { x: 500, y: 300 },
})

// Agent connects nodes - view centers on connection
await addConnection({
  source: { nodeId: 'node1', portId: 'output' },
  target: { nodeId: 'node2', portId: 'input' },
})
```

### Live Demonstrations

Follow mode is perfect for:

- Live coding sessions
- Tutorial walkthroughs
- AI-assisted workflow building
- Remote collaboration presentations

## Configuration

Follow mode can be toggled without reloading the workflow:

```javascript
// Enable follow mode
useWorkflowStore.setState({ followMode: true })

// Disable follow mode
useWorkflowStore.setState({ followMode: false })
```

## Limitations

- Follow mode only affects embed views (not the main workflow editor)
- Rapid changes may cause jarring transitions
- Manual navigation temporarily overrides auto-scroll until the next change

## Future Enhancements

- Smooth scroll transitions
- Configurable scroll speed
- Priority-based scrolling (e.g., follow only specific node types)
- Pause/resume follow mode via UI controls
