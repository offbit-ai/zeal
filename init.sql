-- Initialize Zeal Database Schema

-- Enable UUID extension (optional, we use custom IDs)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Workflows table - stores workflow metadata
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  "userId" TEXT NOT NULL,
  "publishedVersionId" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workflow versions table - stores complete workflow snapshots with multiple graphs
CREATE TABLE IF NOT EXISTS workflow_versions (
  id TEXT PRIMARY KEY,
  "workflowId" TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL,
  "isDraft" BOOLEAN NOT NULL DEFAULT true,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  graphs TEXT NOT NULL, -- JSON string of graphs array (includes nodes, connections, groups per graph)
  "triggerConfig" TEXT, -- JSON string of trigger configuration
  metadata TEXT, -- JSON string of additional metadata
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP,
  FOREIGN KEY ("workflowId") REFERENCES workflows(id) ON DELETE CASCADE,
  UNIQUE("workflowId", version)
);

-- Add foreign key for publishedVersionId after workflow_versions table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'workflows_publishedversionid_fkey'
  ) THEN
    ALTER TABLE workflows 
    ADD CONSTRAINT workflows_publishedversionid_fkey 
    FOREIGN KEY ("publishedVersionId") REFERENCES workflow_versions(id);
  END IF;
END $$;

-- Workflow executions table - stores execution history
CREATE TABLE IF NOT EXISTS workflow_executions (
  id TEXT PRIMARY KEY,
  "workflowId" TEXT NOT NULL,
  "workflowVersionId" TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  "startedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP,
  duration INTEGER, -- execution time in milliseconds
  "inputData" TEXT, -- JSON string of input data
  "outputData" TEXT, -- JSON string of output data
  "errorMessage" TEXT,
  "userId" TEXT NOT NULL,
  FOREIGN KEY ("workflowId") REFERENCES workflows(id) ON DELETE CASCADE,
  FOREIGN KEY ("workflowVersionId") REFERENCES workflow_versions(id) ON DELETE CASCADE
);

-- Workflow snapshots table - stores automatic saves/drafts with multiple graphs
CREATE TABLE IF NOT EXISTS workflow_snapshots (
  id TEXT PRIMARY KEY,
  "workflowId" TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  graphs TEXT NOT NULL, -- JSON string of graphs array (includes nodes, connections, groups per graph)
  "activeGraphId" TEXT, -- Currently active graph tab
  "triggerConfig" TEXT, -- JSON string of trigger configuration
  metadata TEXT, -- JSON string of additional metadata
  "isDraft" BOOLEAN NOT NULL DEFAULT true,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP,
  "saveCount" INTEGER DEFAULT 0,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "lastSavedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("workflowId") REFERENCES workflows(id) ON DELETE CASCADE
);

-- Environment variables table
CREATE TABLE IF NOT EXISTS env_vars (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  "isSecret" BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  category TEXT CHECK (category IN ('environment', 'secrets')),
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Flow trace tables
CREATE TABLE IF NOT EXISTS flow_trace_sessions (
  id TEXT PRIMARY KEY,
  "workflowId" TEXT NOT NULL,
  "workflowVersionId" TEXT,
  "workflowName" TEXT NOT NULL,
  "startTime" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "endTime" TIMESTAMP,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  summary TEXT, -- JSON string of summary stats
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("workflowId") REFERENCES workflows(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS flow_traces (
  id TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  duration INTEGER NOT NULL, -- milliseconds
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'warning')),
  
  -- Source node information
  "sourceNodeId" TEXT NOT NULL,
  "sourceNodeName" TEXT NOT NULL,
  "sourceNodeType" TEXT NOT NULL,
  "sourcePortId" TEXT NOT NULL,
  "sourcePortName" TEXT NOT NULL,
  "sourcePortType" TEXT NOT NULL CHECK ("sourcePortType" IN ('input', 'output')),
  
  -- Target node information  
  "targetNodeId" TEXT NOT NULL,
  "targetNodeName" TEXT NOT NULL,
  "targetNodeType" TEXT NOT NULL,
  "targetPortId" TEXT NOT NULL,
  "targetPortName" TEXT NOT NULL,
  "targetPortType" TEXT NOT NULL CHECK ("targetPortType" IN ('input', 'output')),
  
  -- Data payload
  "dataPayload" TEXT, -- JSON string
  "dataSize" INTEGER NOT NULL, -- bytes
  "dataType" TEXT NOT NULL,
  "dataPreview" TEXT,
  
  -- Error information
  "errorMessage" TEXT,
  "errorCode" TEXT,
  "errorStack" TEXT,
  
  -- Subgraph support
  "graphId" TEXT, -- Which graph this trace belongs to
  "graphName" TEXT,
  "parentTraceId" TEXT, -- If this is inside a subgraph, link to parent trace
  depth INTEGER DEFAULT 0, -- Nesting depth for subgraphs
  
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("sessionId") REFERENCES flow_trace_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY ("parentTraceId") REFERENCES flow_traces(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow_id ON workflow_versions("workflowId");
CREATE INDEX IF NOT EXISTS idx_workflow_versions_published ON workflow_versions("isPublished");
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions("workflowId");
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_snapshots_workflow_id ON workflow_snapshots("workflowId");
CREATE INDEX IF NOT EXISTS idx_env_vars_key ON env_vars(key);
CREATE INDEX IF NOT EXISTS idx_env_vars_category ON env_vars(category);
CREATE INDEX IF NOT EXISTS idx_flow_trace_sessions_workflow_id ON flow_trace_sessions("workflowId");
CREATE INDEX IF NOT EXISTS idx_flow_trace_sessions_status ON flow_trace_sessions(status);
CREATE INDEX IF NOT EXISTS idx_flow_trace_sessions_start_time ON flow_trace_sessions("startTime");
CREATE INDEX IF NOT EXISTS idx_flow_traces_session_id ON flow_traces("sessionId");
CREATE INDEX IF NOT EXISTS idx_flow_traces_timestamp ON flow_traces(timestamp);
CREATE INDEX IF NOT EXISTS idx_flow_traces_status ON flow_traces(status);
CREATE INDEX IF NOT EXISTS idx_flow_traces_parent_trace_id ON flow_traces("parentTraceId");
CREATE INDEX IF NOT EXISTS idx_flow_traces_graph_id ON flow_traces("graphId");

-- Create update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to tables with updatedAt column
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_snapshots_updated_at BEFORE UPDATE ON workflow_snapshots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_env_vars_updated_at BEFORE UPDATE ON env_vars
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();