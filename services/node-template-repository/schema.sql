-- Node Template Repository Schema
-- This schema supports the Node Template Repository Service

-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

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
  
  -- Metadata
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  UNIQUE(template_id, version)
);

-- Template repository with embeddings
CREATE TABLE IF NOT EXISTS template_repository (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT UNIQUE NOT NULL REFERENCES node_templates(template_id),
  
  -- Embeddings (using pgvector)
  title_embedding vector(1536),
  description_embedding vector(1536),
  combined_embedding vector(1536),
  capability_embedding vector(1536),
  use_case_embedding vector(1536),
  
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

-- Dynamic templates
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_templates_category ON node_templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_tags ON node_templates USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_templates_status ON node_templates(status);
CREATE INDEX IF NOT EXISTS idx_templates_created_at ON node_templates(created_at DESC);

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

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_search_text ON template_repository USING GIN(search_text);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_usage_template_id ON template_usage(template_id);
CREATE INDEX IF NOT EXISTS idx_usage_created_at ON template_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_action ON template_usage(action);

-- Update timestamp trigger for dynamic_templates
CREATE TRIGGER update_dynamic_templates_updated_at BEFORE UPDATE ON dynamic_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();