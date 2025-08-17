# Zeal Workflow Editor Embedding Guide

This guide explains how to embed the Zeal workflow editor into your application, allowing users to create and edit workflows within your own interface.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [API Key Setup](#api-key-setup)
4. [Embedding Methods](#embedding-methods)
5. [Configuration Options](#configuration-options)
6. [WebSocket Integration](#websocket-integration)
7. [Security Considerations](#security-considerations)
8. [Examples](#examples)

## Overview

Zeal provides multiple ways to embed the workflow editor:

- **iframe Embedding**: Simple integration with minimal setup
- **React Component**: Direct integration for React applications
- **WebSocket API**: Real-time programmatic control
- **MCP Integration**: AI agent orchestration

## Quick Start

### 1. Basic iframe Embedding

```html
<!DOCTYPE html>
<html>
  <head>
    <title>My App with Zeal Workflow</title>
  </head>
  <body>
    <h1>Workflow Editor</h1>

    <!-- Basic embed -->
    <iframe
      src="https://your-zeal-instance.com/embed/YOUR_WORKFLOW_ID"
      width="100%"
      height="600"
      frameborder="0"
      allow="fullscreen"
    >
    </iframe>
  </body>
</html>
```

### 2. Embedding with Options

```html
<iframe
  src="https://your-zeal-instance.com/embed/YOUR_WORKFLOW_ID?minimap=true&zoom=true&readonly=false"
  width="100%"
  height="600"
  frameborder="0"
  allow="fullscreen"
>
</iframe>
```

## API Key Setup

For secure embedding with permissions control:

### 1. Create an API Key

```javascript
// POST /api/workflows/{workflowId}/embed/api-keys
const response = await fetch(`/api/workflows/${workflowId}/embed/api-keys`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer YOUR_AUTH_TOKEN',
  },
  body: JSON.stringify({
    name: 'Production Embed Key',
    description: 'For customer dashboard integration',
    permissions: {
      canAddNodes: true,
      canEditNodes: true,
      canDeleteNodes: false,
      canAddGroups: true,
      canEditGroups: true,
      canDeleteGroups: false,
      canExecute: false,
      canViewWorkflow: true,
      canExportData: false,
    },
    rateLimits: {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      requestsPerDay: 10000,
      executionsPerHour: 100,
      executionsPerDay: 1000,
    },
  }),
})

const { apiKey, plainKey } = await response.json()
// Save plainKey securely - it won't be shown again!
```

### 2. Use API Key in Embed URL

```html
<iframe
  src="https://your-zeal-instance.com/embed/YOUR_WORKFLOW_ID?apiKey=YOUR_API_KEY"
  width="100%"
  height="600"
>
</iframe>
```

## Embedding Methods

### Method 1: Simple iframe

```html
<iframe
  id="zeal-workflow"
  src="https://your-zeal-instance.com/embed/WORKFLOW_ID"
  style="width: 100%; height: 600px; border: none;"
>
</iframe>
```

### Method 2: Dynamic iframe with JavaScript

```javascript
function embedWorkflow(containerId, workflowId, options = {}) {
  const container = document.getElementById(containerId)

  // Build URL with options
  const params = new URLSearchParams({
    apiKey: options.apiKey || '',
    minimap: options.showMinimap || 'true',
    zoom: options.showZoomControls || 'true',
    tabs: options.showSubgraphTabs || 'true',
    readonly: options.readonly || 'false',
  })

  const iframe = document.createElement('iframe')
  iframe.src = `https://your-zeal-instance.com/embed/${workflowId}?${params}`
  iframe.style.width = '100%'
  iframe.style.height = options.height || '600px'
  iframe.style.border = 'none'
  iframe.allow = 'fullscreen'

  container.appendChild(iframe)

  return iframe
}

// Usage
embedWorkflow('workflow-container', 'wf_123', {
  apiKey: 'emb_live_abc123',
  showMinimap: true,
  height: '800px',
})
```

### Method 3: React Component

```jsx
import React, { useEffect, useRef } from 'react'

const ZealWorkflowEmbed = ({
  workflowId,
  apiKey,
  height = '600px',
  showMinimap = true,
  showZoomControls = true,
  onNodeAdded,
  onConnectionCreated,
}) => {
  const iframeRef = useRef(null)

  useEffect(() => {
    // Listen for messages from embedded workflow
    const handleMessage = event => {
      if (event.origin !== 'https://your-zeal-instance.com') return

      const { type, data } = event.data

      switch (type) {
        case 'nodeAdded':
          onNodeAdded?.(data)
          break
        case 'connectionCreated':
          onConnectionCreated?.(data)
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onNodeAdded, onConnectionCreated])

  const params = new URLSearchParams({
    apiKey: apiKey || '',
    minimap: String(showMinimap),
    zoom: String(showZoomControls),
  })

  return (
    <iframe
      ref={iframeRef}
      src={`https://your-zeal-instance.com/embed/${workflowId}?${params}`}
      style={{ width: '100%', height, border: 'none' }}
      allow="fullscreen"
    />
  )
}

// Usage
function App() {
  return (
    <ZealWorkflowEmbed
      workflowId="wf_123"
      apiKey="emb_live_abc123"
      height="800px"
      onNodeAdded={node => console.log('Node added:', node)}
      onConnectionCreated={conn => console.log('Connection:', conn)}
    />
  )
}
```

## Configuration Options

### URL Parameters

| Parameter      | Type    | Default | Description                     |
| -------------- | ------- | ------- | ------------------------------- |
| `apiKey`       | string  | -       | API key for authentication      |
| `minimap`      | boolean | true    | Show/hide minimap               |
| `zoom`         | boolean | true    | Show/hide zoom controls         |
| `tabs`         | boolean | true    | Show/hide subgraph tabs         |
| `readonly`     | boolean | false   | Enable read-only mode           |
| `theme`        | string  | 'light' | Color theme ('light' or 'dark') |
| `nodeCreation` | boolean | true    | Allow creating new nodes        |

### Example with All Options

```html
<iframe
  src="https://your-zeal-instance.com/embed/wf_123?apiKey=emb_live_abc123&minimap=true&zoom=true&tabs=true&readonly=false&theme=dark&nodeCreation=true"
></iframe>
```

## WebSocket Integration

For real-time updates and programmatic control:

### 1. Connect to WebSocket

```javascript
class ZealWorkflowClient {
  constructor(workflowId, apiKey) {
    this.workflowId = workflowId
    this.apiKey = apiKey
    this.ws = null
  }

  connect() {
    this.ws = new WebSocket('wss://your-zeal-instance.com/embed-ws')

    this.ws.onopen = () => {
      // Join workflow
      this.send('embed:join_workflow', {
        workflowId: this.workflowId,
        apiKey: this.apiKey,
      })
    }

    this.ws.onmessage = event => {
      const { type, data } = JSON.parse(event.data)
      this.handleEvent(type, data)
    }
  }

  send(type, data) {
    this.ws.send(JSON.stringify({ type, data }))
  }

  handleEvent(type, data) {
    switch (type) {
      case 'embed:workflow_state':
        console.log('Workflow loaded:', data)
        break
      case 'embed:node_added':
        console.log('Node added:', data)
        break
      case 'embed:error':
        console.error('Error:', data.message)
        break
    }
  }

  // Add a node
  addNode(metadata, position, graphId = 'main') {
    this.send('embed:add_node', {
      graphId,
      node: {
        id: `${metadata.type}-${Date.now()}`,
        metadata,
        position,
        propertyValues: metadata.propertyValues || {},
      },
    })
  }

  // Create a group
  createGroup(title, nodeIds, graphId = 'main') {
    this.send('embed:add_group', {
      graphId,
      group: {
        id: `group-${Date.now()}`,
        title,
        nodeIds,
        color: '#3b82f6',
      },
    })
  }
}

// Usage
const client = new ZealWorkflowClient('wf_123', 'emb_live_abc123')
client.connect()

// Add a node
client.addNode(
  {
    type: 'data-transform',
    title: 'Process Data',
    category: 'data-processing',
  },
  { x: 100, y: 200 }
)
```

### 2. Drag and Drop Integration

```javascript
// Enable drag and drop of custom elements into the workflow
function setupDragAndDrop() {
  const workflow = document.getElementById('zeal-workflow')

  // Make your elements draggable
  document.querySelectorAll('.my-node-template').forEach(element => {
    element.draggable = true

    element.addEventListener('dragstart', e => {
      const nodeData = {
        type: element.dataset.nodeType,
        title: element.dataset.title,
        category: element.dataset.category,
      }

      e.dataTransfer.setData('application/zeal-node', JSON.stringify(nodeData))
    })
  })
}
```

## Security Considerations

### 1. API Key Security

- Never expose API keys in client-side code
- Use environment variables or secure key management
- Rotate keys regularly
- Set appropriate rate limits

### 2. Content Security Policy

```html
<meta
  http-equiv="Content-Security-Policy"
  content="frame-src https://your-zeal-instance.com; 
               connect-src wss://your-zeal-instance.com;"
/>
```

### 3. Domain Whitelist

Configure allowed embedding domains in your Zeal instance:

```javascript
// In your Zeal configuration
{
  embed: {
    allowedDomains: ['https://myapp.com', 'https://staging.myapp.com']
  }
}
```

## Examples

### Example 1: Customer Dashboard Integration

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Customer Workflow Dashboard</title>
    <style>
      .workflow-container {
        width: 100%;
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
      }
      .workflow-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      }
      .workflow-frame {
        width: 100%;
        height: 700px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
      }
    </style>
  </head>
  <body>
    <div class="workflow-container">
      <div class="workflow-header">
        <h1>My Workflow</h1>
        <button onclick="saveWorkflow()">Save</button>
      </div>

      <iframe
        id="workflow-editor"
        class="workflow-frame"
        src="https://zeal.example.com/embed/wf_customer_123?apiKey=emb_live_xyz"
      >
      </iframe>
    </div>

    <script>
      // Listen for workflow events
      window.addEventListener('message', event => {
        if (event.origin !== 'https://zeal.example.com') return

        console.log('Workflow event:', event.data)

        // Handle auto-save
        if (event.data.type === 'workflowChanged') {
          setTimeout(saveWorkflow, 5000)
        }
      })

      function saveWorkflow() {
        // Trigger save via API
        fetch('/api/save-customer-workflow', {
          method: 'POST',
          body: JSON.stringify({ workflowId: 'wf_customer_123' }),
        })
      }
    </script>
  </body>
</html>
```

### Example 2: SaaS Platform Integration

```javascript
// React component for SaaS workflow builder
import React, { useState, useCallback } from 'react'
import { ZealWorkflowEmbed } from './components/ZealWorkflowEmbed'

function WorkflowBuilder({ tenantId }) {
  const [workflowId, setWorkflowId] = useState(null)
  const [loading, setLoading] = useState(true)

  // Create or load workflow for tenant
  useEffect(() => {
    async function initWorkflow() {
      const response = await fetch(`/api/tenants/${tenantId}/workflow`)
      const { workflowId, apiKey } = await response.json()

      setWorkflowId(workflowId)
      setApiKey(apiKey)
      setLoading(false)
    }

    initWorkflow()
  }, [tenantId])

  const handleWorkflowChange = useCallback(
    event => {
      // Track changes for analytics
      analytics.track('workflow_modified', {
        tenantId,
        workflowId,
        changeType: event.type,
      })
    },
    [tenantId, workflowId]
  )

  if (loading) return <div>Loading workflow...</div>

  return (
    <div className="workflow-builder">
      <h2>Build Your Automation</h2>

      <ZealWorkflowEmbed
        workflowId={workflowId}
        apiKey={apiKey}
        height="800px"
        showMinimap={true}
        showZoomControls={true}
        onChange={handleWorkflowChange}
      />

      <div className="workflow-actions">
        <button onClick={() => deployWorkflow(workflowId)}>Deploy Workflow</button>
      </div>
    </div>
  )
}
```

### Example 3: AI-Powered Workflow Generation

```javascript
// Using MCP to generate workflows from natural language
async function generateWorkflowFromPrompt(prompt) {
  // Call your AI service
  const aiResponse = await callAI({
    prompt: `Generate a workflow for: ${prompt}`,
    tools: ['zeal-embed-orchestrator'],
  })

  // AI uses MCP tools to create the workflow
  // Returns the workflow ID
  return aiResponse.workflowId
}

// Embed the generated workflow
async function showGeneratedWorkflow(prompt) {
  const workflowId = await generateWorkflowFromPrompt(prompt)

  document.getElementById('result').innerHTML = `
        <h3>Generated Workflow</h3>
        <iframe 
            src="https://zeal.example.com/embed/${workflowId}?readonly=true"
            width="100%" 
            height="600">
        </iframe>
    `
}
```

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure your domain is whitelisted
2. **API Key Invalid**: Check key permissions and expiration
3. **WebSocket Connection Failed**: Verify WSS endpoint and firewall rules
4. **iframe Blocked**: Check Content Security Policy

### Debug Mode

Add `?debug=true` to enable console logging:

```html
<iframe src="https://zeal.example.com/embed/wf_123?debug=true"></iframe>
```

## Support

For additional help:

- GitHub Issues: https://github.com/offbit-ai/zeal/issues
- Documentation: https://docs.zeal.app
- Community Forum: https://community.zeal.app
