-- Supabase-compliant schema for Zeal
-- Uses snake_case naming convention and Supabase best practices

-- Drop existing tables if they exist
DROP TABLE IF EXISTS flow_traces CASCADE;
DROP TABLE IF EXISTS flow_trace_sessions CASCADE;
DROP TABLE IF EXISTS env_vars CASCADE;
DROP TABLE IF EXISTS workflow_snapshots CASCADE;
DROP TABLE IF EXISTS workflow_executions CASCADE;
DROP TABLE IF EXISTS workflow_versions CASCADE;
DROP TABLE IF EXISTS workflows CASCADE;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Workflows table
CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  user_id TEXT NOT NULL,
  published_version_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for user_id
CREATE INDEX idx_workflows_user_id ON workflows(user_id);

-- Workflow versions table
CREATE TABLE workflow_versions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL,
  is_draft BOOLEAN NOT NULL DEFAULT true,
  is_published BOOLEAN NOT NULL DEFAULT false,
  graphs JSONB NOT NULL,
  trigger_config JSONB,
  metadata JSONB,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  UNIQUE(workflow_id, version)
);

-- Create indexes
CREATE INDEX idx_workflow_versions_workflow_id ON workflow_versions(workflow_id);
CREATE INDEX idx_workflow_versions_is_published ON workflow_versions(is_published);

-- Add foreign key for published_version_id after workflow_versions table exists
ALTER TABLE workflows 
ADD CONSTRAINT workflows_published_version_id_fkey 
FOREIGN KEY (published_version_id) REFERENCES workflow_versions(id);

-- Workflow executions table
CREATE TABLE workflow_executions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  workflow_version_id TEXT NOT NULL REFERENCES workflow_versions(id),
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration INTEGER,
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  user_id TEXT NOT NULL
);

-- Create indexes
CREATE INDEX idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);

-- Workflow snapshots table
CREATE TABLE workflow_snapshots (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  version_id TEXT NOT NULL REFERENCES workflow_versions(id),
  user_id TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_workflow_snapshots_workflow_id ON workflow_snapshots(workflow_id);
CREATE INDEX idx_workflow_snapshots_version_id ON workflow_snapshots(version_id);

-- Environment variables table
CREATE TABLE env_vars (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  is_encrypted BOOLEAN DEFAULT false,
  encrypted_value TEXT,
  metadata JSONB,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, user_id)
);

-- Create index
CREATE INDEX idx_env_vars_user_id ON env_vars(user_id);

-- Flow trace sessions table
CREATE TABLE flow_trace_sessions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT REFERENCES workflows(id) ON DELETE SET NULL,
  execution_id TEXT REFERENCES workflow_executions(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_flow_trace_sessions_workflow_id ON flow_trace_sessions(workflow_id);
CREATE INDEX idx_flow_trace_sessions_execution_id ON flow_trace_sessions(execution_id);
CREATE INDEX idx_flow_trace_sessions_status ON flow_trace_sessions(status);

-- Flow traces table
CREATE TABLE flow_traces (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES flow_trace_sessions(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  graph_id TEXT NOT NULL DEFAULT 'main',
  event TEXT NOT NULL,
  input JSONB,
  output JSONB,
  error TEXT,
  metadata JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  parent_trace_id TEXT REFERENCES flow_traces(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX idx_flow_traces_session_id ON flow_traces(session_id);
CREATE INDEX idx_flow_traces_node_id ON flow_traces(node_id);
CREATE INDEX idx_flow_traces_timestamp ON flow_traces(timestamp);

-- Create update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_env_vars_updated_at BEFORE UPDATE ON env_vars
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE env_vars ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_trace_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_traces ENABLE ROW LEVEL SECURITY;

-- Create roles if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN SUPERUSER;
  END IF;
  -- Also create the typo version that's in the JWT
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_srole') THEN
    CREATE ROLE service_srole NOLOGIN SUPERUSER;
  END IF;
END$$;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, service_srole;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role, service_srole;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role, service_srole;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role, service_srole;

-- For anon and authenticated, grant basic CRUD
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Create RLS policies for service_role to bypass RLS
CREATE POLICY "Service role has full access" ON workflows
    FOR ALL TO service_role, service_srole USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access" ON workflow_versions
    FOR ALL TO service_role, service_srole USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access" ON workflow_executions
    FOR ALL TO service_role, service_srole USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access" ON workflow_snapshots
    FOR ALL TO service_role, service_srole USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access" ON env_vars
    FOR ALL TO service_role, service_srole USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access" ON flow_trace_sessions
    FOR ALL TO service_role, service_srole USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access" ON flow_traces
    FOR ALL TO service_role, service_srole USING (true) WITH CHECK (true);

-- For development, create permissive policies for anon role
-- In production, these should check auth.uid()
CREATE POLICY "Anon has full access (dev only)" ON workflows
    FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon has full access (dev only)" ON workflow_versions
    FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon has full access (dev only)" ON workflow_executions
    FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon has full access (dev only)" ON workflow_snapshots
    FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon has full access (dev only)" ON env_vars
    FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon has full access (dev only)" ON flow_trace_sessions
    FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon has full access (dev only)" ON flow_traces
    FOR ALL TO anon USING (true) WITH CHECK (true);