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

-- Try to enable pgvector extension for semantic search (optional)
-- This is only needed for real AI embeddings, not for mock embeddings
DO $$
BEGIN
  -- Check if vector extension is available before trying to create it
  IF EXISTS (
    SELECT 1 FROM pg_available_extensions WHERE name = 'vector'
  ) THEN
    CREATE EXTENSION IF NOT EXISTS vector;
    RAISE NOTICE 'pgvector extension installed successfully';
  ELSE
    RAISE NOTICE 'pgvector extension not available - semantic search will use fallback methods';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not install pgvector extension - continuing without it';
END $$;

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

-- Embed API keys table
CREATE TABLE embed_api_keys (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL, -- Hashed API key
  name TEXT NOT NULL,
  description TEXT,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  rate_limits JSONB
);

-- Embed sessions table for tracking API key usage
CREATE TABLE embed_sessions (
  id TEXT PRIMARY KEY,
  api_key_id TEXT NOT NULL REFERENCES embed_api_keys(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- Create indexes for embed tables
CREATE INDEX idx_embed_api_keys_workflow_id ON embed_api_keys(workflow_id);
CREATE INDEX idx_embed_api_keys_is_active ON embed_api_keys(is_active);
CREATE INDEX idx_embed_sessions_api_key_id ON embed_sessions(api_key_id);
CREATE INDEX idx_embed_sessions_started_at ON embed_sessions(started_at);

-- Create update trigger function for snake_case columns (Supabase standard)
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

CREATE TRIGGER update_embed_api_keys_updated_at BEFORE UPDATE ON embed_api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- NODE TEMPLATE REPOSITORY TABLES
-- ============================================================================

-- Node Categories table for organizing templates
CREATE TABLE IF NOT EXISTS node_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(200) NOT NULL,
  description TEXT,
  icon VARCHAR(100) NOT NULL DEFAULT 'box',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(255) DEFAULT 'system',
  updated_by VARCHAR(255) DEFAULT 'system'
);

-- Node Subcategories table
CREATE TABLE IF NOT EXISTS node_subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES node_categories(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  display_name VARCHAR(200) NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category_id, name)
);

-- Main template storage
CREATE TABLE IF NOT EXISTS node_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT UNIQUE NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  template_data JSONB NOT NULL,
  source_type TEXT NOT NULL,
  source_location TEXT,
  
  -- Denormalized fields for queries
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  tags TEXT[],
  
  -- Foreign key references
  category_id UUID REFERENCES node_categories(id),
  subcategory_id UUID REFERENCES node_subcategories(id),
  
  -- Metadata
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  UNIQUE(template_id, version)
);

-- Template repository with embeddings and metadata
CREATE TABLE IF NOT EXISTS template_repository (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT UNIQUE NOT NULL REFERENCES node_templates(template_id),
  
  -- Embeddings will be added conditionally after table creation
  
  -- Extracted metadata
  capabilities TEXT[],
  input_types JSONB,
  output_types JSONB,
  use_cases TEXT[],
  
  -- Relationships
  commonly_used_with TEXT[],
  alternatives TEXT[],
  required_templates TEXT[],
  
  -- Statistics
  usage_count INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2),
  last_used TIMESTAMPTZ,
  error_rate DECIMAL(5,4) DEFAULT 0,
  
  -- Search optimization
  search_text TSVECTOR,
  keywords TEXT[],
  
  -- Timestamps
  indexed_at TIMESTAMPTZ DEFAULT NOW(),
  last_validated TIMESTAMPTZ,
  
  -- Foreign key
  FOREIGN KEY (template_id) REFERENCES node_templates(template_id) ON DELETE CASCADE
);

-- Template versions
CREATE TABLE IF NOT EXISTS template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT NOT NULL,
  version TEXT NOT NULL,
  changes JSONB,
  release_notes TEXT,
  is_breaking BOOLEAN DEFAULT FALSE,
  is_deprecated BOOLEAN DEFAULT FALSE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  FOREIGN KEY (template_id) REFERENCES node_templates(template_id) ON DELETE CASCADE,
  UNIQUE(template_id, version)
);

-- Template relationships
CREATE TABLE IF NOT EXISTS template_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_template_id TEXT NOT NULL,
  target_template_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL, -- 'compatible', 'alternative', 'upgrade', 'requires'
  confidence DECIMAL(3,2),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  FOREIGN KEY (source_template_id) REFERENCES node_templates(template_id),
  FOREIGN KEY (target_template_id) REFERENCES node_templates(template_id),
  UNIQUE(source_template_id, target_template_id, relationship_type)
);

-- Template usage analytics
CREATE TABLE IF NOT EXISTS template_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT NOT NULL,
  workflow_id TEXT,
  user_id TEXT,
  action TEXT NOT NULL, -- 'search', 'view', 'add', 'execute'
  success BOOLEAN,
  error_message TEXT,
  execution_time_ms INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  FOREIGN KEY (template_id) REFERENCES node_templates(template_id)
);

-- Dynamic templates (for AI-generated templates)
CREATE TABLE IF NOT EXISTS dynamic_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_config JSONB NOT NULL,
  generation_rules JSONB NOT NULL,
  generated_template_id TEXT,
  generated_at TIMESTAMPTZ,
  validation_status TEXT,
  validation_errors JSONB,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  FOREIGN KEY (generated_template_id) REFERENCES node_templates(template_id)
);

-- Add embedding columns based on extension availability
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    -- Add vector columns if pgvector is available
    ALTER TABLE template_repository ADD COLUMN IF NOT EXISTS title_embedding vector(1536);
    ALTER TABLE template_repository ADD COLUMN IF NOT EXISTS description_embedding vector(1536);
    ALTER TABLE template_repository ADD COLUMN IF NOT EXISTS combined_embedding vector(1536);
    ALTER TABLE template_repository ADD COLUMN IF NOT EXISTS capability_embedding vector(1536);
    ALTER TABLE template_repository ADD COLUMN IF NOT EXISTS use_case_embedding vector(1536);
  ELSE
    -- Add JSONB columns as fallback for storing embeddings
    ALTER TABLE template_repository ADD COLUMN IF NOT EXISTS title_embedding JSONB;
    ALTER TABLE template_repository ADD COLUMN IF NOT EXISTS description_embedding JSONB;
    ALTER TABLE template_repository ADD COLUMN IF NOT EXISTS combined_embedding JSONB;
    ALTER TABLE template_repository ADD COLUMN IF NOT EXISTS capability_embedding JSONB;
    ALTER TABLE template_repository ADD COLUMN IF NOT EXISTS use_case_embedding JSONB;
  END IF;
END $$;

-- ============================================================================
-- INDEXES FOR NODE TEMPLATE REPOSITORY
-- ============================================================================

-- Category indexes
CREATE INDEX IF NOT EXISTS idx_node_categories_name ON node_categories(name);
CREATE INDEX IF NOT EXISTS idx_node_categories_active ON node_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_node_subcategories_category ON node_subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_node_subcategories_name ON node_subcategories(name);

-- Template indexes
CREATE INDEX IF NOT EXISTS idx_templates_category ON node_templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_tags ON node_templates USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_templates_status ON node_templates(status);
CREATE INDEX IF NOT EXISTS idx_templates_created_at ON node_templates(created_at DESC);

-- Repository indexes (only if vector extension is available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    -- Vector indexes for similarity search
    CREATE INDEX IF NOT EXISTS idx_title_embedding ON template_repository 
      USING ivfflat (title_embedding vector_cosine_ops)
      WITH (lists = 100);
      
    CREATE INDEX IF NOT EXISTS idx_combined_embedding ON template_repository 
      USING ivfflat (combined_embedding vector_cosine_ops)
      WITH (lists = 100);
      
    CREATE INDEX IF NOT EXISTS idx_capability_embedding ON template_repository 
      USING ivfflat (capability_embedding vector_cosine_ops)
      WITH (lists = 100);
  END IF;
END $$;

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_search_text ON template_repository USING GIN(search_text);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_usage_template_id ON template_usage(template_id);
CREATE INDEX IF NOT EXISTS idx_usage_created_at ON template_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_action ON template_usage(action);

-- Relationship indexes
CREATE INDEX IF NOT EXISTS idx_template_relationships_source ON template_relationships(source_template_id);
CREATE INDEX IF NOT EXISTS idx_template_relationships_target ON template_relationships(target_template_id);

-- Update triggers for template repository timestamp fields
CREATE TRIGGER update_node_categories_updated_at BEFORE UPDATE
  ON node_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_node_subcategories_updated_at BEFORE UPDATE
  ON node_subcategories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_node_templates_updated_at BEFORE UPDATE
  ON node_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dynamic_templates_updated_at BEFORE UPDATE
  ON dynamic_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE env_vars ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_trace_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE embed_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE embed_sessions ENABLE ROW LEVEL SECURITY;

-- Enable RLS for node template repository tables
ALTER TABLE node_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_repository ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE dynamic_templates ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Service role has full access" ON embed_api_keys
    FOR ALL TO service_role, service_srole USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access" ON embed_sessions
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

CREATE POLICY "Anon has full access (dev only)" ON embed_api_keys
    FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon has full access (dev only)" ON embed_sessions
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- RLS Policies for node template repository tables

-- Service role policies for template repository
CREATE POLICY "Service role has full access" ON node_categories
    FOR ALL TO service_role, service_srole USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access" ON node_subcategories
    FOR ALL TO service_role, service_srole USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access" ON node_templates
    FOR ALL TO service_role, service_srole USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access" ON template_repository
    FOR ALL TO service_role, service_srole USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access" ON template_versions
    FOR ALL TO service_role, service_srole USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access" ON template_relationships
    FOR ALL TO service_role, service_srole USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access" ON template_usage
    FOR ALL TO service_role, service_srole USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access" ON dynamic_templates
    FOR ALL TO service_role, service_srole USING (true) WITH CHECK (true);

-- Anon policies for template repository (dev only)
CREATE POLICY "Anon has full access (dev only)" ON node_categories
    FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon has full access (dev only)" ON node_subcategories
    FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon has full access (dev only)" ON node_templates
    FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon has full access (dev only)" ON template_repository
    FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon has full access (dev only)" ON template_versions
    FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon has full access (dev only)" ON template_relationships
    FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon has full access (dev only)" ON template_usage
    FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon has full access (dev only)" ON dynamic_templates
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================================
-- SUPABASE-SPECIFIC FUNCTIONS FOR NODE TEMPLATE REPOSITORY
-- ============================================================================

-- Function to search templates with full-text search
CREATE OR REPLACE FUNCTION search_templates(
  search_query TEXT,
  search_category TEXT DEFAULT NULL,
  search_tags TEXT[] DEFAULT NULL,
  include_deprecated BOOLEAN DEFAULT FALSE,
  result_limit INTEGER DEFAULT 20,
  result_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  template_id TEXT,
  template_data JSONB,
  title TEXT,
  category TEXT,
  subcategory TEXT,
  tags TEXT[],
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by TEXT,
  updated_by TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.template_id,
    t.template_data,
    t.title,
    t.category,
    t.subcategory,
    t.tags,
    t.status,
    t.created_at,
    t.updated_at,
    t.created_by,
    t.updated_by,
    ts_rank(r.search_text, plainto_tsquery(search_query)) as rank
  FROM node_templates t
  JOIN template_repository r ON t.template_id = r.template_id
  WHERE 
    r.search_text @@ plainto_tsquery(search_query)
    AND (search_category IS NULL OR t.category = search_category)
    AND (search_tags IS NULL OR t.tags && search_tags)
    AND (include_deprecated OR t.status != 'deprecated')
  ORDER BY rank DESC
  LIMIT result_limit OFFSET result_offset;
END;
$$ LANGUAGE plpgsql;

-- Function to search by embedding similarity
CREATE OR REPLACE FUNCTION search_by_embedding(
  query_embedding NUMERIC[],
  result_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  template_id TEXT,
  template_data JSONB,
  title TEXT,
  category TEXT,
  subcategory TEXT,
  tags TEXT[],
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by TEXT,
  updated_by TEXT,
  distance REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.template_id,
    t.template_data,
    t.title,
    t.category,
    t.subcategory,
    t.tags,
    t.status,
    t.created_at,
    t.updated_at,
    t.created_by,
    t.updated_by,
    -- Calculate cosine distance if pgvector is available, otherwise use placeholder
    CASE 
      WHEN pg_typeof(r.combined_embedding) = 'vector'::regtype THEN
        (r.combined_embedding::vector <=> query_embedding::vector)
      ELSE
        1.0  -- Fallback distance when using JSONB storage
    END as distance
  FROM node_templates t
  JOIN template_repository r ON t.template_id = r.template_id
  WHERE t.status = 'active'
  ORDER BY distance
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to increment usage count
CREATE OR REPLACE FUNCTION increment_usage_count(template_id_param TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE template_repository 
  SET 
    usage_count = COALESCE(usage_count, 0) + 1,
    last_used = NOW()
  WHERE template_id = template_id_param;
END;
$$ LANGUAGE plpgsql;

-- Function to get usage statistics
CREATE OR REPLACE FUNCTION get_usage_stats(template_id_param TEXT)
RETURNS TABLE (
  total_usage BIGINT,
  successful_usage BIGINT,
  avg_execution_time NUMERIC,
  last_used TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_usage,
    COUNT(CASE WHEN (metadata->>'success')::boolean = true THEN 1 END) as successful_usage,
    AVG((metadata->>'execution_time_ms')::numeric) as avg_execution_time,
    MAX(created_at) as last_used
  FROM template_usage
  WHERE template_id = template_id_param
  GROUP BY template_id;
  
  -- If no results, return zeros
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::BIGINT, 0::BIGINT, 0::NUMERIC, NULL::TIMESTAMPTZ;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create full-text search configuration
DO $$ 
BEGIN
  -- Add tsvector column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'template_repository' 
    AND column_name = 'search_text'
  ) THEN
    ALTER TABLE template_repository ADD COLUMN search_text tsvector;
  END IF;
  
  -- Create trigger to automatically update search_text
  CREATE OR REPLACE FUNCTION update_template_search_text()
  RETURNS TRIGGER AS $trig$
  BEGIN
    NEW.search_text := to_tsvector('english', 
      COALESCE(NEW.template_id, '') || ' ' ||
      COALESCE(array_to_string(NEW.capabilities, ' '), '') || ' ' ||
      COALESCE(array_to_string(NEW.use_cases, ' '), '') || ' ' ||
      COALESCE(array_to_string(NEW.keywords, ' '), '')
    );
    RETURN NEW;
  END;
  $trig$ LANGUAGE plpgsql;
  
  -- Drop trigger if exists and recreate
  DROP TRIGGER IF EXISTS template_repository_search_update ON template_repository;
  CREATE TRIGGER template_repository_search_update
    BEFORE INSERT OR UPDATE ON template_repository
    FOR EACH ROW EXECUTE FUNCTION update_template_search_text();
END $$;