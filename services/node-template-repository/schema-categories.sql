-- Categories table for node template categories
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

-- Create index on name for fast lookups
CREATE INDEX idx_node_categories_name ON node_categories(name);
CREATE INDEX idx_node_categories_active ON node_categories(is_active);

-- Subcategories table
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

-- Create indexes for subcategories
CREATE INDEX idx_node_subcategories_category ON node_subcategories(category_id);
CREATE INDEX idx_node_subcategories_name ON node_subcategories(name);

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

-- Add category foreign key to templates (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'node_templates' 
    AND column_name = 'category_id'
  ) THEN
    ALTER TABLE node_templates 
    ADD COLUMN category_id UUID REFERENCES node_categories(id);
  END IF;
END $$;

-- Add subcategory foreign key to templates (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'node_templates' 
    AND column_name = 'subcategory_id'
  ) THEN
    ALTER TABLE node_templates 
    ADD COLUMN subcategory_id UUID REFERENCES node_subcategories(id);
  END IF;
END $$;

-- Row Level Security for Supabase
ALTER TABLE node_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_subcategories ENABLE ROW LEVEL SECURITY;

-- Read access for all authenticated users
CREATE POLICY "Categories are viewable by all users" ON node_categories
  FOR SELECT USING (true);

CREATE POLICY "Subcategories are viewable by all users" ON node_subcategories
  FOR SELECT USING (true);

-- Write access for authenticated users (no admin check)
CREATE POLICY "Authenticated users can create categories" ON node_categories
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update categories" ON node_categories
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create subcategories" ON node_subcategories
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update subcategories" ON node_subcategories
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_node_categories_updated_at BEFORE UPDATE
  ON node_categories FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_node_subcategories_updated_at BEFORE UPDATE
  ON node_subcategories FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();