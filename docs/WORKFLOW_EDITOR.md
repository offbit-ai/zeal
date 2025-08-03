# Workflow Editor User Guide

## Overview

The Zeal Workflow Editor is a powerful visual programming environment that allows you to create, edit, and manage complex workflows using a node-based interface. This guide covers all features and functionality available in the editor.

## Getting Started

### Interface Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Toolbar                                                     │
│  [Save] [Undo] [Redo] [Search] [Node Browser] [Settings]   │
├──────────────┬──────────────────────────────────┬──────────┤
│              │                                  │          │
│   Sidebar    │      Workflow Canvas            │ Property │
│              │                                  │  Panel   │
│ - Workflows  │  ┌────────┐     ┌────────┐     │          │
│ - History    │  │ Node A │────▶│ Node B │     │ - Node   │
│ - Triggers   │  └────────┘     └────────┘     │   Props  │
│              │                                  │          │
├──────────────┴──────────────────────────────────┴──────────┤
│  Status Bar  [Collaborative Mode] [Auto-save] [Zoom: 100%] │
└─────────────────────────────────────────────────────────────┘
```

### Basic Operations

#### Adding Nodes
1. **Drag and Drop**: Open the node browser and drag nodes onto the canvas
2. **Double Click**: Double-click on empty canvas space to open quick add menu
3. **Copy/Paste**: Select a node and use Ctrl+C/Ctrl+V (Cmd on Mac)

#### Connecting Nodes
1. Click and drag from an output port (right side) to an input port (left side)
2. Compatible ports will highlight when hovering
3. Release to create the connection

#### Deleting Elements
- **Nodes**: Select and press Delete key or use the delete button
- **Connections**: Click on a connection line and press Delete

## Core Features

### 1. Node System

#### Node Types

**Data Sources**
- API Request: Make HTTP/REST API calls
- Database Query: Execute SQL queries
- File Reader: Read local or remote files
- Webhook Receiver: Accept incoming webhooks

**Data Processing**
- Transform: Modify data structure
- Filter: Filter arrays or objects
- Aggregate: Perform calculations
- Join: Combine multiple data sources

**Logic & Control**
- Conditional: If/else branching
- Loop: Iterate over collections
- Delay: Add time delays
- Schedule: Time-based triggers

**AI & ML**
- LLM Query: Interface with language models
- Text Analysis: Sentiment, entity extraction
- Image Processing: Computer vision tasks

**Storage & Output**
- Database Write: Save to database
- File Writer: Export to files
- Email Sender: Send notifications
- API Response: Return data to caller

#### Node Configuration

Click on any node to open the property panel:

- **Basic Settings**: Name, description, enabled state
- **Input Configuration**: Define input parameters and validation
- **Processing Logic**: Configure node-specific behavior
- **Output Mapping**: Transform and map output data
- **Error Handling**: Define retry logic and error responses

### 2. Groups

Groups help organize complex workflows by bundling related nodes together.

#### Creating Groups
1. Select multiple nodes (drag selection box or Ctrl+Click)
2. Right-click and select "Create Group"
3. Name and configure the group

#### Group Features
- **Collapse/Expand**: Click the arrow to hide/show group contents
- **Move Together**: Dragging a group moves all contained nodes
- **Resize**: Drag corners to resize the group boundary
- **Color Coding**: Assign colors for visual organization

### 3. Real-time Collaboration

When collaborative mode is enabled:

- **Live Cursors**: See other users' cursor positions
- **Presence Indicators**: View who's currently editing
- **Synchronized Changes**: All edits appear instantly for all users
- **Conflict Resolution**: Automatic merge of concurrent edits

### 4. Flow Tracing & Debugging

Debug your workflows with the built-in flow tracer:

1. Click the "Trace" button in the toolbar
2. Execute your workflow
3. Watch as data flows through each node
4. Inspect input/output at each step
5. Identify bottlenecks and errors

### 5. Version Control & History

Track changes, replay executions, and manage versions:

#### Version History
- **Auto-save**: Changes are saved automatically every 30 seconds
- **Manual Snapshots**: Create named versions at important milestones
- **Version Browser**: Access via History panel in sidebar
- **Change Tracking**: See who made changes and when

#### Version Management
1. **View History**:
   - Click History icon in sidebar
   - Browse versions chronologically
   - See version timestamps and authors

2. **Snapshots**:
   - Create named snapshots of current state
   - Useful for marking stable versions
   - Can restore to any snapshot

3. **Rollback**:
   - Select a previous version
   - Click "Restore" to rollback
   - Creates new version (preserves history)

4. **Version Information**:
   - Version number and timestamp
   - Created by user
   - Workflow state at that version

#### Execution History & Replay

The flow tracer maintains a complete history of workflow executions:

1. **Execution Sessions**:
   - Each run creates a unique session
   - Stored with timestamp and trigger info
   - Includes all node inputs/outputs
   - Captures execution timing

2. **Replay Mode**:
   - Access via Flow Traces panel
   - Select any previous execution
   - Click "Replay" to visualize
   - Watch data flow step-by-step
   - Pause/resume/speed controls

3. **Debugging with History**:
   - Compare successful vs failed runs
   - Identify where execution diverged
   - Inspect data at each step
   - Export execution data

4. **Analytics**:
   - Execution frequency graphs
   - Performance trends over time
   - Success/failure rates
   - Node execution heatmap

Example workflow for debugging with history:
```
1. Open Flow Traces panel
2. Find the failed execution
3. Click "Replay" to watch it run
4. Pause at the failing node
5. Inspect input/output data
6. Compare with successful run
7. Identify the issue
8. Fix and test again
```

### 6. Subgraphs

Create reusable workflow components:

1. Select nodes to include in subgraph
2. Right-click → "Create Subgraph"
3. Define input/output ports
4. Save as reusable component
5. Use in other workflows via node browser

## Advanced Features

### 1. Keyboard Shortcuts

| Action | Windows/Linux | Mac |
|--------|--------------|-----|
| Save | Ctrl+S | Cmd+S |
| Undo | Ctrl+Z | Cmd+Z |
| Redo | Ctrl+Y | Cmd+Shift+Z |
| Copy | Ctrl+C | Cmd+C |
| Paste | Ctrl+V | Cmd+V |
| Delete | Delete | Delete |
| Select All | Ctrl+A | Cmd+A |
| Search | Ctrl+F | Cmd+F |
| Zoom In | Ctrl++ | Cmd++ |
| Zoom Out | Ctrl+- | Cmd+- |
| Reset Zoom | Ctrl+0 | Cmd+0 |

### 2. Canvas Navigation

- **Pan**: Click and drag on empty canvas space
- **Zoom**: Mouse wheel or pinch gesture
- **Fit to Screen**: Double-click empty space
- **Minimap**: Toggle minimap for overview

### 3. Search & Filter

Use the search feature (Ctrl+F) to:
- Find nodes by name or type
- Search within node configurations
- Filter by node category
- Locate specific connections

### 4. Import/Export

#### Export Options
- **JSON**: Complete workflow definition
- **Image**: PNG/SVG snapshot
- **Documentation**: Auto-generated markdown

#### Import Formats
- Zeal JSON format
- Compatible node-RED flows
- Custom node templates

### 5. Environment Variables

Manage configuration across environments:

1. Define variables in Settings → Environment
2. Reference in nodes using `${VAR_NAME}`
3. Override per environment (dev/staging/prod)
4. Secure storage for sensitive values

## Best Practices

### Workflow Organization

1. **Use Groups**: Organize related nodes into logical groups
2. **Naming Convention**: Use clear, descriptive names
3. **Documentation**: Add descriptions to nodes and groups
4. **Color Coding**: Use colors to indicate function or status

### Performance Optimization

1. **Limit Connections**: Avoid too many connections to a single node
2. **Use Subgraphs**: Break complex workflows into smaller pieces
3. **Efficient Queries**: Optimize database and API queries
4. **Parallel Processing**: Use parallel paths when possible

### Error Handling

1. **Try-Catch Patterns**: Wrap risky operations in error handlers
2. **Validation**: Validate inputs early in the flow
3. **Logging**: Add logging nodes for debugging
4. **Fallbacks**: Define alternative paths for failures

### Collaboration

1. **Communication**: Use comments and descriptions
2. **Locking**: Avoid editing the same area simultaneously
3. **Testing**: Test changes in a separate branch/version
4. **Documentation**: Keep workflow documentation updated

## Troubleshooting

### Common Issues

**Nodes Not Connecting**
- Check port compatibility (data types must match)
- Ensure no circular dependencies
- Verify node output is configured

**Performance Problems**
- Reduce visible node count (use groups)
- Disable flow tracing when not needed
- Check for infinite loops
- Optimize heavy computations

**Sync Issues**
- Refresh the page
- Check network connection
- Verify CRDT server is running
- Clear browser cache

### Getting Help

1. **Built-in Help**: Hover over any element for tooltips
2. **Documentation**: Access via Help menu
3. **Community**: Join our Discord/Slack
4. **Support**: Contact support for enterprise users

## Tips & Tricks

1. **Quick Duplicate**: Alt+Drag to duplicate nodes
2. **Align Nodes**: Select multiple and use alignment tools
3. **Bulk Operations**: Select multiple nodes for batch edits
4. **Templates**: Save common patterns as templates
5. **Hotkeys**: Learn keyboard shortcuts for efficiency
6. **Search Everything**: Use global search (Ctrl+Shift+F)
7. **Pin Properties**: Pin frequently used properties panel
8. **Test Mode**: Use test mode to try without saving
9. **Export Regularly**: Backup important workflows
10. **Learn Patterns**: Study example workflows