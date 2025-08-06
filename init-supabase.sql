-- Initialize Zeal Database Schema for Supabase
-- This version includes RLS policies and Supabase-specific features

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create tables in auth schema context
SET search_path TO public;

-- Workflows table - stores workflow metadata
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  "userId" TEXT NOT NULL DEFAULT auth.uid()::text,
  "publishedVersionId" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

-- Workflow versions table
CREATE TABLE IF NOT EXISTS workflow_versions (
  id TEXT PRIMARY KEY,
  "workflowId" TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL,
  "isDraft" BOOLEAN NOT NULL DEFAULT true,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  graphs TEXT NOT NULL,
  "triggerConfig" TEXT,
  metadata TEXT,
  "userId" TEXT NOT NULL DEFAULT auth.uid()::text,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "publishedAt" TIMESTAMP WITH TIME ZONE,
  FOREIGN KEY ("workflowId") REFERENCES workflows(id) ON DELETE CASCADE,
  UNIQUE("workflowId", version)
);

-- Enable RLS
ALTER TABLE workflow_versions ENABLE ROW LEVEL SECURITY;

-- Add foreign key for publishedVersionId
ALTER TABLE workflows 
ADD CONSTRAINT workflows_publishedversionid_fkey 
FOREIGN KEY ("publishedVersionId") REFERENCES workflow_versions(id);

-- Workflow executions table
CREATE TABLE IF NOT EXISTS workflow_executions (
  id TEXT PRIMARY KEY,
  "workflowId" TEXT NOT NULL,
  "workflowVersionId" TEXT NOT NULL,
  status TEXT NOT NULL,
  "startedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "completedAt" TIMESTAMP WITH TIME ZONE,
  duration INTEGER,
  "inputData" TEXT,
  "outputData" TEXT,
  "errorMessage" TEXT,
  "userId" TEXT NOT NULL DEFAULT auth.uid()::text,
  FOREIGN KEY ("workflowId") REFERENCES workflows(id) ON DELETE CASCADE,
  FOREIGN KEY ("workflowVersionId") REFERENCES workflow_versions(id)
);

-- Enable RLS
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

-- Workflow snapshots table
CREATE TABLE IF NOT EXISTS workflow_snapshots (
  id TEXT PRIMARY KEY,
  "workflowId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL DEFAULT auth.uid()::text,
  snapshot TEXT NOT NULL,
  metadata TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY ("workflowId") REFERENCES workflows(id) ON DELETE CASCADE,
  FOREIGN KEY ("versionId") REFERENCES workflow_versions(id)
);

-- Enable RLS
ALTER TABLE workflow_snapshots ENABLE ROW LEVEL SECURITY;

-- Environment variables table
CREATE TABLE IF NOT EXISTS env_vars (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  "isEncrypted" BOOLEAN DEFAULT false,
  "encryptedValue" TEXT,
  metadata TEXT,
  "userId" TEXT NOT NULL DEFAULT auth.uid()::text,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, "userId")
);

-- Enable RLS
ALTER TABLE env_vars ENABLE ROW LEVEL SECURITY;

-- Flow trace sessions table
CREATE TABLE IF NOT EXISTS flow_trace_sessions (
  id TEXT PRIMARY KEY,
  "workflowId" TEXT,
  "executionId" TEXT,
  "startTime" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "endTime" TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active',
  metadata TEXT,
  "userId" TEXT NOT NULL DEFAULT auth.uid()::text,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY ("workflowId") REFERENCES workflows(id) ON DELETE SET NULL,
  FOREIGN KEY ("executionId") REFERENCES workflow_executions(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE flow_trace_sessions ENABLE ROW LEVEL SECURITY;

-- Flow traces table
CREATE TABLE IF NOT EXISTS flow_traces (
  id TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "nodeId" TEXT NOT NULL,
  "graphId" TEXT NOT NULL DEFAULT 'main',
  event TEXT NOT NULL,
  input TEXT,
  output TEXT,
  error TEXT,
  metadata TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "parentTraceId" TEXT,
  FOREIGN KEY ("sessionId") REFERENCES flow_trace_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY ("parentTraceId") REFERENCES flow_traces(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE flow_traces ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows("userId");
CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow_id ON workflow_versions("workflowId");
CREATE INDEX IF NOT EXISTS idx_workflow_versions_published ON workflow_versions("isPublished");
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions("workflowId");
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_snapshots_workflow_id ON workflow_snapshots("workflowId");
CREATE INDEX IF NOT EXISTS idx_workflow_snapshots_version_id ON workflow_snapshots("versionId");
CREATE INDEX IF NOT EXISTS idx_env_vars_user_id ON env_vars("userId");
CREATE INDEX IF NOT EXISTS idx_flow_trace_sessions_workflow_id ON flow_trace_sessions("workflowId");
CREATE INDEX IF NOT EXISTS idx_flow_trace_sessions_execution_id ON flow_trace_sessions("executionId");
CREATE INDEX IF NOT EXISTS idx_flow_trace_sessions_status ON flow_trace_sessions(status);
CREATE INDEX IF NOT EXISTS idx_flow_traces_session_id ON flow_traces("sessionId");
CREATE INDEX IF NOT EXISTS idx_flow_traces_node_id ON flow_traces("nodeId");
CREATE INDEX IF NOT EXISTS idx_flow_traces_timestamp ON flow_traces(timestamp);

-- Updated timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated timestamps
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_env_vars_updated_at BEFORE UPDATE ON env_vars
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies for workflows
CREATE POLICY "Users can view their own workflows" ON workflows
    FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "Users can create their own workflows" ON workflows
    FOR INSERT WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "Users can update their own workflows" ON workflows
    FOR UPDATE USING (auth.uid()::text = "userId");

CREATE POLICY "Users can delete their own workflows" ON workflows
    FOR DELETE USING (auth.uid()::text = "userId");

-- RLS Policies for workflow_versions
CREATE POLICY "Users can view versions of their workflows" ON workflow_versions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM workflows 
            WHERE workflows.id = workflow_versions."workflowId" 
            AND workflows."userId" = auth.uid()::text
        )
    );

CREATE POLICY "Users can create versions for their workflows" ON workflow_versions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM workflows 
            WHERE workflows.id = workflow_versions."workflowId" 
            AND workflows."userId" = auth.uid()::text
        )
    );

CREATE POLICY "Users can update versions of their workflows" ON workflow_versions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM workflows 
            WHERE workflows.id = workflow_versions."workflowId" 
            AND workflows."userId" = auth.uid()::text
        )
    );

-- RLS Policies for workflow_executions
CREATE POLICY "Users can view executions of their workflows" ON workflow_executions
    FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "Users can create executions for their workflows" ON workflow_executions
    FOR INSERT WITH CHECK (auth.uid()::text = "userId");

-- RLS Policies for workflow_snapshots
CREATE POLICY "Users can view their workflow snapshots" ON workflow_snapshots
    FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "Users can create their workflow snapshots" ON workflow_snapshots
    FOR INSERT WITH CHECK (auth.uid()::text = "userId");

-- RLS Policies for env_vars
CREATE POLICY "Users can view their own env vars" ON env_vars
    FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "Users can create their own env vars" ON env_vars
    FOR INSERT WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "Users can update their own env vars" ON env_vars
    FOR UPDATE USING (auth.uid()::text = "userId");

CREATE POLICY "Users can delete their own env vars" ON env_vars
    FOR DELETE USING (auth.uid()::text = "userId");

-- RLS Policies for flow_trace_sessions
CREATE POLICY "Users can view their trace sessions" ON flow_trace_sessions
    FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "Users can create their trace sessions" ON flow_trace_sessions
    FOR INSERT WITH CHECK (auth.uid()::text = "userId");

-- RLS Policies for flow_traces
CREATE POLICY "Users can view traces from their sessions" ON flow_traces
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM flow_trace_sessions 
            WHERE flow_trace_sessions.id = flow_traces."sessionId" 
            AND flow_trace_sessions."userId" = auth.uid()::text
        )
    );

CREATE POLICY "Users can create traces for their sessions" ON flow_traces
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM flow_trace_sessions 
            WHERE flow_trace_sessions.id = flow_traces."sessionId" 
            AND flow_trace_sessions."userId" = auth.uid()::text
        )
    );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;