-- Supabase Migration: Initial Schema for Zeal

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create workflows table
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_public BOOLEAN DEFAULT false,
    snapshot_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create workflow_versions table
CREATE TABLE IF NOT EXISTS workflow_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    snapshot_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_published BOOLEAN DEFAULT false,
    change_summary TEXT,
    UNIQUE(workflow_id, version_number)
);

-- Create workflow_executions table (for execution history)
CREATE TABLE IF NOT EXISTS workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    version_id UUID REFERENCES workflow_versions(id) ON DELETE SET NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    execution_data JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create workflow_collaborators table
CREATE TABLE IF NOT EXISTS workflow_collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workflow_id, user_id)
);

-- Create workflow_analytics table
CREATE TABLE IF NOT EXISTS workflow_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB DEFAULT '{}'::jsonb,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_workflows_owner_id ON workflows(owner_id);
CREATE INDEX idx_workflows_created_at ON workflows(created_at DESC);
CREATE INDEX idx_workflows_updated_at ON workflows(updated_at DESC);
CREATE INDEX idx_workflows_is_public ON workflows(is_public);
CREATE INDEX idx_workflow_versions_workflow_id ON workflow_versions(workflow_id);
CREATE INDEX idx_workflow_versions_created_at ON workflow_versions(created_at DESC);
CREATE INDEX idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_collaborators_user_id ON workflow_collaborators(user_id);
CREATE INDEX idx_workflow_analytics_workflow_id ON workflow_analytics(workflow_id);
CREATE INDEX idx_workflow_analytics_event_type ON workflow_analytics(event_type);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_analytics ENABLE ROW LEVEL SECURITY;

-- Workflows policies
CREATE POLICY "Users can view their own workflows" ON workflows
    FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can view public workflows" ON workflows
    FOR SELECT USING (is_public = true);

CREATE POLICY "Users can view collaborated workflows" ON workflows
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM workflow_collaborators
            WHERE workflow_collaborators.workflow_id = workflows.id
            AND workflow_collaborators.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create workflows" ON workflows
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own workflows" ON workflows
    FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own workflows" ON workflows
    FOR DELETE USING (auth.uid() = owner_id);

-- Workflow versions policies
CREATE POLICY "Users can view versions of accessible workflows" ON workflow_versions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM workflows
            WHERE workflows.id = workflow_versions.workflow_id
            AND (
                workflows.owner_id = auth.uid()
                OR workflows.is_public = true
                OR EXISTS (
                    SELECT 1 FROM workflow_collaborators
                    WHERE workflow_collaborators.workflow_id = workflows.id
                    AND workflow_collaborators.user_id = auth.uid()
                )
            )
        )
    );

CREATE POLICY "Users can create versions for their workflows" ON workflow_versions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM workflows
            WHERE workflows.id = workflow_versions.workflow_id
            AND workflows.owner_id = auth.uid()
        )
    );

-- Functions

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update updated_at on workflows
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment version number
CREATE OR REPLACE FUNCTION get_next_version_number(p_workflow_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_max_version INTEGER;
BEGIN
    SELECT COALESCE(MAX(version_number), 0) INTO v_max_version
    FROM workflow_versions
    WHERE workflow_id = p_workflow_id;
    
    RETURN v_max_version + 1;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;