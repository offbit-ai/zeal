-- Supabase-specific functions for Node Template Repository

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
    COALESCE(r.combined_embedding <=> query_embedding::vector, 1.0) as distance
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

-- Enable Row Level Security on all template tables
ALTER TABLE node_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_repository ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE dynamic_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for templates - allow read access to all, write access to authenticated users
CREATE POLICY "Templates are viewable by all users" ON node_templates
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create templates" ON node_templates
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update templates" ON node_templates
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete templates" ON node_templates
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS Policies for repository
CREATE POLICY "Repository entries are viewable by all users" ON template_repository
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create repository entries" ON template_repository
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update repository entries" ON template_repository
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- RLS Policies for versions
CREATE POLICY "Template versions are viewable by all users" ON template_versions
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create versions" ON template_versions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for relationships
CREATE POLICY "Template relationships are viewable by all users" ON template_relationships
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage relationships" ON template_relationships
  FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS Policies for usage tracking
CREATE POLICY "Usage records are viewable by all users" ON template_usage
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can record usage" ON template_usage
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for dynamic templates
CREATE POLICY "Dynamic templates are viewable by all users" ON dynamic_templates
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage dynamic templates" ON dynamic_templates
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_template_repository_search ON template_repository USING gin(search_text);
CREATE INDEX IF NOT EXISTS idx_template_repository_template_id ON template_repository(template_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_template_id ON template_usage(template_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_created_at ON template_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_template_relationships_source ON template_relationships(source_template_id);
CREATE INDEX IF NOT EXISTS idx_template_relationships_target ON template_relationships(target_template_id);

-- Create full-text search configuration if it doesn't exist
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