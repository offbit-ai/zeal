# API Documentation

## Overview

Zeal provides a comprehensive REST API for managing workflows, nodes, and related resources. All API endpoints are prefixed with `/api` and return JSON responses.

## Authentication

Most API endpoints require authentication. Include the authentication token in the Authorization header:

```http
Authorization: Bearer <your-token>
```

## Base URL

```
https://your-domain.com/api
```

## Common Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {} // Optional additional details
  }
}
```

## Endpoints

### Workflows

#### List Workflows

```http
GET /workflows
```

Query Parameters:
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `search` (string): Search term
- `namespace` (string): Filter by namespace

Response:
```json
{
  "success": true,
  "data": {
    "workflows": [
      {
        "id": "workflow-123",
        "name": "My Workflow",
        "description": "Workflow description",
        "namespace": "default",
        "isPublished": false,
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "pages": 5
    }
  }
}
```

#### Get Workflow

```http
GET /workflows/:id
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "workflow-123",
    "name": "My Workflow",
    "description": "Workflow description",
    "namespace": "default",
    "version": 1,
    "isPublished": false,
    "data": {
      "nodes": [...],
      "connections": [...],
      "groups": [...],
      "metadata": {...}
    },
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

#### Create Workflow

```http
POST /workflows
```

Request Body:
```json
{
  "name": "New Workflow",
  "description": "Description",
  "namespace": "default",
  "data": {
    "nodes": [],
    "connections": [],
    "groups": []
  }
}
```

#### Update Workflow

```http
PUT /workflows/:id
```

Request Body:
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "data": {
    "nodes": [...],
    "connections": [...],
    "groups": [...]
  }
}
```

#### Delete Workflow

```http
DELETE /workflows/:id
```

#### Publish Workflow

```http
POST /workflows/:id/publish
```

Request Body:
```json
{
  "version": "1.0.0",
  "changelog": "Initial release"
}
```

#### Execute Workflow

```http
POST /workflows/:id/execute
```

Request Body:
```json
{
  "inputs": {
    "param1": "value1",
    "param2": "value2"
  },
  "options": {
    "timeout": 30000,
    "trace": true
  }
}
```

### Nodes

#### List Node Templates

```http
GET /nodes
```

Query Parameters:
- `category` (string): Filter by category
- `search` (string): Search term

Response:
```json
{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": "node-template-1",
        "category": "data-sources",
        "type": "api-request",
        "title": "API Request",
        "description": "Make HTTP requests",
        "metadata": {...}
      }
    ]
  }
}
```

#### Get Node Categories

```http
GET /nodes/categories
```

Response:
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": "data-sources",
        "name": "Data Sources",
        "description": "Input nodes for data",
        "icon": "Database",
        "count": 15
      }
    ]
  }
}
```

#### Validate Node Configuration

```http
POST /nodes/validate
```

Request Body:
```json
{
  "nodeType": "api-request",
  "configuration": {
    "url": "https://api.example.com",
    "method": "GET"
  }
}
```

### Environment Variables

#### List Environment Variables

```http
GET /env-vars
```

Response:
```json
{
  "success": true,
  "data": {
    "variables": [
      {
        "id": "var-123",
        "key": "API_KEY",
        "value": "***hidden***",
        "description": "API key for external service",
        "isEncrypted": true
      }
    ]
  }
}
```

#### Create Environment Variable

```http
POST /env-vars
```

Request Body:
```json
{
  "key": "NEW_VAR",
  "value": "value",
  "description": "Description",
  "isEncrypted": false
}
```

#### Update Environment Variable

```http
PUT /env-vars/:id
```

#### Delete Environment Variable

```http
DELETE /env-vars/:id
```

### Flow Traces

#### List Flow Traces

```http
GET /flow-traces
```

Query Parameters:
- `workflowId` (string): Filter by workflow
- `sessionId` (string): Filter by session
- `status` (string): Filter by status (running, completed, failed)
- `startDate` (string): ISO date string
- `endDate` (string): ISO date string

#### Get Flow Trace

```http
GET /flow-traces/:id
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "trace-123",
    "workflowId": "workflow-123",
    "sessionId": "session-456",
    "startedAt": "2024-01-01T00:00:00Z",
    "completedAt": "2024-01-01T00:01:00Z",
    "status": "completed",
    "nodes": [
      {
        "nodeId": "node-1",
        "startedAt": "2024-01-01T00:00:00Z",
        "completedAt": "2024-01-01T00:00:10Z",
        "status": "completed",
        "inputData": {...},
        "outputData": {...}
      }
    ]
  }
}
```

#### Create Flow Trace Session

```http
POST /flow-traces/sessions
```

Request Body:
```json
{
  "workflowId": "workflow-123",
  "metadata": {
    "triggeredBy": "manual",
    "user": "user-123"
  }
}
```

#### Get Flow Trace Session

```http
GET /flow-traces/sessions/:sessionId
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "session-456",
    "workflowId": "workflow-123",
    "workflowVersion": 5,
    "startedAt": "2024-01-01T00:00:00Z",
    "completedAt": "2024-01-01T00:01:00Z",
    "duration": 60000,
    "status": "completed",
    "metadata": {
      "triggeredBy": "schedule",
      "user": "system"
    },
    "stats": {
      "totalNodes": 15,
      "executedNodes": 15,
      "failedNodes": 0,
      "averageNodeDuration": 4000
    }
  }
}
```

#### Get Flow Trace Replay Data

```http
GET /flow-traces/sessions/:sessionId/replay
```

Query Parameters:
- `search` (string): Filter traces by node/port names
- `status` (string): Filter by trace status

Response includes filtered traces with timing information for replay visualization.

#### Get Flow Trace Report

```http
GET /flow-traces/sessions/:sessionId/report
```

Query Parameters:
- `search` (string): Filter traces by node/port names
- `status` (string): Filter by trace status
- `format` (string): Output format - "json" or "text" (default: json)

Generates a detailed report of the trace session.

#### Get Flow Trace Analytics

```http
GET /flow-traces/analytics
```

Query Parameters:
- `workflowId` (string): Filter by workflow
- `startDate` (string): Start date
- `endDate` (string): End date

Response:
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalTraces": 1543,
      "totalSessions": 234,
      "totalWorkflows": 15,
      "successRate": 0.95,
      "avgDuration": 45000,
      "totalDataProcessed": 1048576
    },
    "performance": {
      "slowestTraces": [...],
      "fastestTraces": [...],
      "avgDurationByNode": {
        "node-1": 5000,
        "node-2": 3000
      },
      "avgDurationByWorkflow": {
        "workflow-1": 45000
      }
    },
    "errors": {
      "errorsByType": {
        "TIMEOUT": 45,
        "INVALID_INPUT": 12
      },
      "errorsByNode": {...},
      "errorsByWorkflow": {...},
      "recentErrors": [...]
    },
    "trends": {
      "last7Days": [...],
      "last30Days": [...],
      "topNodes": [...],
      "topWorkflows": [...]
    }
  }
}
```

#### Clean Up Old Flow Traces

```http
POST /flow-traces/cleanup
```

Request Body:
```json
{
  "olderThan": "30d",
  "keepFailed": true,
  "keepSnapshots": true
}
```

### Workflow History

#### Get Workflow History

```http
GET /workflows/:id/history
```

Query Parameters:
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)

Response:
```json
{
  "success": true,
  "data": {
    "versions": [
      {
        "id": "version-123",
        "version": 2,
        "createdAt": "2024-01-01T00:00:00Z",
        "createdBy": "user-123",
        "workflowId": "workflow-123"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 15
    }
  }
}
```

#### Create Workflow Snapshot

```http
POST /workflows/:id/snapshots
```

Request Body:
```json
{
  "name": "Pre-refactor backup",
  "description": "Snapshot before major refactoring"
}
```

#### Get Workflow Snapshot

```http
GET /workflows/:id/snapshots/:snapshotId
```

Response includes the complete workflow data at that snapshot.

#### Rollback Workflow

```http
POST /workflows/:id/rollback
```

Request Body:
```json
{
  "versionId": "version-123"
}
```

Note: Can only rollback to published versions. Returns the updated workflow after rollback.

## WebSocket API

### CRDT Synchronization

Connect to the CRDT server for real-time synchronization:

```javascript
const socket = io('wss://your-domain.com', {
  auth: {
    userId: 'user-123',
    userName: 'John Doe'
  }
});

// Join a workflow room
socket.emit('join-room', 'workflow-123');

// Listen for updates
socket.on('crdt:update', (data) => {
  // Handle CRDT updates
});

// Send updates
socket.emit('crdt:message', roomId, crdtMessage);
```

### Events

#### Client to Server

- `join-room`: Join a workflow room
- `leave-room`: Leave a workflow room
- `crdt:message`: Send CRDT update
- `cursor:update`: Update cursor position

#### Server to Client

- `crdt:update`: Receive CRDT updates
- `presence:update`: User presence changes
- `cursor:position`: Other users' cursor positions
- `room:user-joined`: User joined the room
- `room:user-left`: User left the room

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **General endpoints**: 30 requests per minute
- **API endpoints**: 10 requests per minute
- **Execute endpoint**: 5 requests per minute

Rate limit headers:
```http
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 25
X-RateLimit-Reset: 1640995200
```

## Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Missing or invalid authentication |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Invalid request data |
| `RATE_LIMITED` | Too many requests |
| `INTERNAL_ERROR` | Server error |
| `WORKFLOW_EXECUTION_ERROR` | Error during workflow execution |
| `RESOURCE_LOCKED` | Resource is being edited by another user |

## SDK Examples

### JavaScript/TypeScript

```typescript
import { ZealClient } from '@zeal/sdk';

const client = new ZealClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://your-domain.com/api'
});

// List workflows
const workflows = await client.workflows.list({
  page: 1,
  limit: 20
});

// Execute workflow
const result = await client.workflows.execute('workflow-123', {
  inputs: { data: 'test' }
});
```

### Python

```python
from zeal_sdk import ZealClient

client = ZealClient(
    api_key='your-api-key',
    base_url='https://your-domain.com/api'
)

# List workflows
workflows = client.workflows.list(page=1, limit=20)

# Execute workflow
result = client.workflows.execute(
    'workflow-123',
    inputs={'data': 'test'}
)
```

### cURL

```bash
# List workflows
curl -X GET https://your-domain.com/api/workflows \
  -H "Authorization: Bearer your-token"

# Execute workflow
curl -X POST https://your-domain.com/api/workflows/workflow-123/execute \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"inputs": {"data": "test"}}'
```