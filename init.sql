-- Initialize Zeal Database Schema

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
  metadata JSONB, -- Additional metadata for the session
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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

-- Embed API keys table
CREATE TABLE IF NOT EXISTS embed_api_keys (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL, -- Hashed API key
  name TEXT NOT NULL,
  description TEXT,
  "workflowId" TEXT NOT NULL,
  permissions TEXT NOT NULL, -- JSON string of permissions
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP,
  "expiresAt" TIMESTAMP,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "usageCount" INTEGER DEFAULT 0,
  "rateLimits" TEXT, -- JSON string of rate limits
  FOREIGN KEY ("workflowId") REFERENCES workflows(id) ON DELETE CASCADE
);

-- Embed sessions table for tracking API key usage
CREATE TABLE IF NOT EXISTS embed_sessions (
  id TEXT PRIMARY KEY,
  "apiKeyId" TEXT NOT NULL,
  "startedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP,
  actions TEXT NOT NULL DEFAULT '[]', -- JSON array of actions
  FOREIGN KEY ("apiKeyId") REFERENCES embed_api_keys(id) ON DELETE CASCADE
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
CREATE INDEX IF NOT EXISTS idx_embed_api_keys_workflow_id ON embed_api_keys("workflowId");
CREATE INDEX IF NOT EXISTS idx_embed_api_keys_is_active ON embed_api_keys("isActive");
CREATE INDEX IF NOT EXISTS idx_embed_sessions_api_key_id ON embed_sessions("apiKeyId");
CREATE INDEX IF NOT EXISTS idx_embed_sessions_started_at ON embed_sessions("startedAt");

-- Add metadata column if it doesn't exist (for existing databases)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'flow_trace_sessions' 
                AND column_name = 'metadata') THEN
    ALTER TABLE flow_trace_sessions ADD COLUMN metadata JSONB;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'flow_trace_sessions' 
                AND column_name = 'updatedAt') THEN
    ALTER TABLE flow_trace_sessions ADD COLUMN "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- Create update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create update timestamp trigger for snake_case columns
CREATE OR REPLACE FUNCTION update_updated_at_column_snake()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to tables with updatedAt column (camelCase)
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_snapshots_updated_at BEFORE UPDATE ON workflow_snapshots
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
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

-- ============================================================================
-- VIEWS FOR NODE TEMPLATE REPOSITORY
-- ============================================================================

-- View to get categories with counts
CREATE OR REPLACE VIEW node_categories_with_counts AS
SELECT 
  c.id,
  c.name,
  c.display_name,
  c.description,
  c.icon,
  c.is_active,
  c.sort_order,
  c.created_at,
  c.updated_at,
  (
    SELECT COUNT(DISTINCT t.id) 
    FROM node_templates t 
    WHERE t.category = c.name 
    AND t.status = 'active'
  ) as total_nodes,
  (
    SELECT json_agg(
      json_build_object(
        'name', sc.name,
        'displayName', sc.display_name,
        'description', sc.description,
        'nodeCount', (
          SELECT COUNT(*) 
          FROM node_templates t2 
          WHERE t2.category = c.name 
          AND t2.subcategory = sc.name 
          AND t2.status = 'active'
        )
      ) ORDER BY sc.sort_order, sc.name
    )
    FROM node_subcategories sc
    WHERE sc.category_id = c.id
  ) as subcategories
FROM node_categories c
ORDER BY c.sort_order, c.name;

-- ============================================================================
-- TRIGGERS FOR NODE TEMPLATE REPOSITORY
-- ============================================================================

-- Update triggers for timestamp fields
CREATE TRIGGER update_node_categories_updated_at BEFORE UPDATE
  ON node_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column_snake();

CREATE TRIGGER update_node_subcategories_updated_at BEFORE UPDATE
  ON node_subcategories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column_snake();

CREATE TRIGGER update_node_templates_updated_at BEFORE UPDATE
  ON node_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column_snake();

CREATE TRIGGER update_dynamic_templates_updated_at BEFORE UPDATE
  ON dynamic_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column_snake();
-- ============================================================================
-- ZIP INTEGRATION WEBHOOKS
-- ============================================================================

-- Table for storing ZIP integration webhooks
-- These are different from workflow trigger webhooks
CREATE TABLE IF NOT EXISTS zip_webhooks (
  id VARCHAR(255) PRIMARY KEY,
  namespace VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  events JSONB NOT NULL DEFAULT '["*"]'::jsonb,
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for ZIP webhooks
CREATE INDEX IF NOT EXISTS idx_zip_webhooks_namespace ON zip_webhooks(namespace);
CREATE INDEX IF NOT EXISTS idx_zip_webhooks_active ON zip_webhooks(is_active);
CREATE INDEX IF NOT EXISTS idx_zip_webhooks_namespace_active ON zip_webhooks(namespace, is_active);
CREATE INDEX IF NOT EXISTS idx_zip_webhooks_events ON zip_webhooks USING gin(events);

-- Function to update the updated_at timestamp for ZIP webhooks
CREATE OR REPLACE FUNCTION update_zip_webhooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at for ZIP webhooks
CREATE TRIGGER trigger_update_zip_webhooks_updated_at
  BEFORE UPDATE ON zip_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_zip_webhooks_updated_at();

-- Comments for documentation
COMMENT ON TABLE zip_webhooks IS 'Stores webhook configurations for ZIP integrations';
COMMENT ON COLUMN zip_webhooks.id IS 'Unique identifier for the webhook';
COMMENT ON COLUMN zip_webhooks.namespace IS 'Namespace of the integration (e.g., reflow, n8n)';
COMMENT ON COLUMN zip_webhooks.url IS 'URL to send webhook events to';
COMMENT ON COLUMN zip_webhooks.events IS 'Array of event types to send, or ["*"] for all events';
COMMENT ON COLUMN zip_webhooks.headers IS 'Custom headers to include in webhook requests';
COMMENT ON COLUMN zip_webhooks.is_active IS 'Whether the webhook is currently active';
COMMENT ON COLUMN zip_webhooks.metadata IS 'Additional metadata for the webhook';
