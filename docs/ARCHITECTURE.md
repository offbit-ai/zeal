# Zeal Architecture Overview

## System Architecture

Zeal is built as a modern, scalable web application with real-time collaboration features. The architecture consists of several key components working together to provide a seamless workflow editing experience.

```
┌─────────────────────────────────────────────────────────────────┐
│                          Client Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  Next.js Application (React + TypeScript)                        │
│  - Workflow Editor UI                                            │
│  - Real-time Collaboration                                       │
│  - State Management (Zustand + CRDT)                           │
└───────────────┬─────────────────────────┬───────────────────────┘
                │                         │
                │ HTTP/REST API           │ WebSocket
                │                         │
┌───────────────▼─────────────┐ ┌────────▼────────────────────────┐
│     Next.js API Routes      │ │    Rust CRDT Server             │
│  - Workflow Management      │ │  - Real-time Sync               │
│  - User Authentication      │ │  - Conflict Resolution          │
│  - Environment Variables    │ │  - Presence Management          │
│  - Flow Tracing            │ │  - Room-based Architecture     │
└───────────────┬─────────────┘ └─────────────────────────────────┘
                │
┌───────────────▼─────────────────────────┬───────────────────────┐
│            Data Layer                   │    Cache Layer        │
├─────────────────────────────────────────┼───────────────────────┤
│         PostgreSQL                      │      Redis            │
│  - Workflows                           │  - Session Data       │
│  - User Preferences                    │  - API Cache          │
│  - Environment Variables               │  - Temporary Data     │
│  - Flow Traces                        │                       │
│  - Node Repository                    │                       │
└─────────────────────────────────────────┴───────────────────────┘
```

## Core Components

### 1. Frontend (Next.js Application)

The frontend is a React-based single-page application built with Next.js 14 and TypeScript.

#### Key Features:

- **Workflow Canvas**: Interactive drag-and-drop interface for creating workflows
- **Node System**: Extensible node architecture with various node types
- **Real-time Sync**: CRDT-based synchronization for collaborative editing
- **State Management**: Zustand for local state, Yjs for distributed state

#### Directory Structure:

```
app/                    # Next.js 14 app directory
├── api/               # API routes
├── page.tsx           # Main workflow editor
└── layout.tsx         # Root layout

components/            # React components
├── WorkflowCanvas.tsx # Main canvas component
├── WorkflowNode.tsx   # Node component
├── ConnectionLines.tsx # Connection rendering
└── ...

store/                 # State management
├── workflow-store.ts  # Main workflow store (Zustand + CRDT)
└── ...

hooks/                 # Custom React hooks
services/             # API and service layers
utils/                # Utility functions
types/                # TypeScript type definitions
```

### 2. CRDT Server (Rust)

A high-performance WebSocket server built in Rust that handles real-time synchronization using Yjs CRDT.

#### Key Features:

- **Room-based Architecture**: Isolated collaboration spaces
- **Yjs Protocol Support**: Full compatibility with Yjs WebSocket protocol
- **Presence Tracking**: Real-time user presence and cursor positions
- **Efficient Binary Protocol**: Optimized for minimal bandwidth usage

#### Architecture:

```rust
// Simplified structure
Server
  ├── Rooms (HashMap<String, Room>)
  │   └── Room
  │       ├── Clients (HashMap<ClientId, Client>)
  │       ├── Document State (Yjs Doc)
  │       └── Awareness States
  └── WebSocket Handler
```

### 3. Database Layer (PostgreSQL)

PostgreSQL serves as the primary data store for persistent data.

#### Key Tables:

- **workflows**: Stores workflow definitions and metadata
- **workflow_versions**: Version history for workflows
- **env_vars**: Environment variables for workflows
- **flow_traces**: Execution traces for debugging
- **node_repository**: Available node types and their configurations
- **user_preferences**: User-specific settings

### 4. Cache Layer (Redis)

Redis provides high-performance caching and temporary data storage.

#### Usage:

- API response caching
- Session management
- Temporary workflow states
- Rate limiting

## Data Flow

### 1. Workflow Creation/Editing

```
User Action → React Component → Zustand Store → CRDT Update
     ↓                                               ↓
Canvas Update ← React Re-render ← Store Update ← Yjs Sync
                                                     ↓
                                            WebSocket → CRDT Server
                                                     ↓
                                            Broadcast to Other Clients
```

### 2. Workflow Persistence

```
Auto-save Trigger → API Call → Next.js API Route
                                      ↓
                              Validate & Transform
                                      ↓
                              PostgreSQL Update
                                      ↓
                              Redis Cache Invalidation
```

### 3. Real-time Collaboration

```
Client A Edit → Yjs Local Update → WebSocket Message → CRDT Server
                                                            ↓
                                                    Process & Merge
                                                            ↓
Client B ← Yjs Remote Update ← WebSocket Broadcast ← Distribute
```

### 4. Version History & Replay

```
Workflow Change → Version Created → Store in workflow_versions
                                           ↓
                                    Calculate Diff
                                           ↓
                                    Index Changes

Execution Start → Create Session → Capture Node I/O
                                         ↓
                                 Store Trace Data
                                         ↓
                                 Generate Timeline

Replay Request → Load Session → Reconstruct Workflow State
                                        ↓
                               Load Execution Logs
                                        ↓
                              Display in Flow Tracer
```

## History & Versioning System

### Version Control Architecture

1. **Version Storage**:
   - Every save creates a new version in `workflow_versions` table
   - Versions store complete workflow state
   - Metadata includes author and timestamp
   - Automatic versioning on each save

2. **Snapshot System**:
   - Named checkpoints for important states
   - Manual creation by users
   - Can be used as rollback points
   - Stores complete workflow state

### Execution History Architecture

1. **Trace Collection**:
   - Instrumented execution engine
   - Captures input/output for each node
   - Records timing information
   - Stores error states and stack traces

2. **Session Management**:
   - Unique session ID for each execution
   - Links to specific workflow version
   - Metadata about trigger source
   - Complete execution context

3. **Execution Review**:

   ```
   Session Data → Load Workflow Version → Display Workflow State
                                                   ↓
                                          Load Execution Logs
                                                   ↓
                                          Show in Flow Tracer Panel
   ```

4. **Analytics Pipeline**:
   - Aggregates execution data
   - Calculates performance metrics
   - Identifies failure patterns
   - Generates trend reports

## Security Considerations

### Authentication & Authorization

- NextAuth.js for authentication
- JWT tokens for API authorization
- Role-based access control (RBAC) for workflows

### Data Protection

- HTTPS/WSS for all communications
- Environment variable encryption
- SQL injection prevention via parameterized queries
- XSS protection through React's built-in escaping

### Rate Limiting

- API rate limiting with Redis
- WebSocket connection limits
- Resource usage quotas

## Performance Optimizations

### Frontend

- React component memoization
- Virtual scrolling for large workflows
- Debounced auto-save
- Lazy loading of node components
- Optimistic UI updates

### Backend

- Connection pooling for PostgreSQL
- Redis caching for frequently accessed data
- Efficient CRDT operations
- Binary protocol for WebSocket messages

### Infrastructure

- CDN for static assets
- Horizontal scaling support
- Database indexing strategies
- Query optimization

## Deployment Architecture

### Docker Containers

1. **Next.js App**: Node.js runtime with built application
2. **CRDT Server**: Rust binary with minimal dependencies
3. **PostgreSQL**: Official PostgreSQL image with custom init scripts
4. **Redis**: Official Redis image with persistence enabled
5. **Nginx**: Reverse proxy and load balancer (production)

### Scaling Strategy

- Horizontal scaling for Next.js instances
- CRDT server can handle multiple rooms per instance
- PostgreSQL read replicas for read-heavy operations
- Redis cluster for high availability

## Monitoring & Observability

### Metrics

- Application performance monitoring (APM)
- Real-time user analytics
- Resource utilization tracking
- Error rate monitoring

### Logging

- Structured logging with correlation IDs
- Centralized log aggregation
- Log levels: ERROR, WARN, INFO, DEBUG

### Health Checks

- Application health endpoints
- Database connectivity checks
- Redis availability monitoring
- CRDT server liveness probes
