-- Migration: Add Tenant Isolation Support to Zeal Database
-- This migration adds tenant_id columns to all relevant tables for multi-tenancy support
-- Run this AFTER the initial schema setup (init.sql)

-- ============================================================================
-- ADD TENANT_ID TO MAIN TABLES
-- ============================================================================

-- Workflows table
ALTER TABLE workflows 
ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- Workflow versions table
ALTER TABLE workflow_versions 
ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- Workflow executions table
ALTER TABLE workflow_executions 
ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- Workflow snapshots table
ALTER TABLE workflow_snapshots 
ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- Environment variables table
ALTER TABLE env_vars 
ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- Flow trace sessions table
ALTER TABLE flow_trace_sessions 
ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- Flow traces table
ALTER TABLE flow_traces 
ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- Embed API keys table
ALTER TABLE embed_api_keys 
ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- Embed sessions table
ALTER TABLE embed_sessions 
ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- Node templates table (for custom templates per tenant)
ALTER TABLE node_templates 
ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
ADD COLUMN IF NOT EXISTS "organizationId" TEXT,
ADD COLUMN IF NOT EXISTS "visibility" TEXT DEFAULT 'private';

-- Template usage table
ALTER TABLE template_usage 
ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- Dynamic templates table
ALTER TABLE dynamic_templates 
ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- ZIP webhooks table
ALTER TABLE zip_webhooks 
ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- ============================================================================
-- ADD INDEXES FOR TENANT QUERIES
-- ============================================================================

-- Create indexes for tenant isolation performance
CREATE INDEX IF NOT EXISTS idx_workflows_tenant ON workflows("tenantId");
CREATE INDEX IF NOT EXISTS idx_workflows_org ON workflows("organizationId");
CREATE INDEX IF NOT EXISTS idx_workflows_tenant_user ON workflows("tenantId", "userId");

CREATE INDEX IF NOT EXISTS idx_workflow_versions_tenant ON workflow_versions("tenantId");
CREATE INDEX IF NOT EXISTS idx_workflow_executions_tenant ON workflow_executions("tenantId");
CREATE INDEX IF NOT EXISTS idx_workflow_snapshots_tenant ON workflow_snapshots("tenantId");

CREATE INDEX IF NOT EXISTS idx_env_vars_tenant ON env_vars("tenantId");
CREATE INDEX IF NOT EXISTS idx_env_vars_tenant_key ON env_vars("tenantId", key);

CREATE INDEX IF NOT EXISTS idx_flow_trace_sessions_tenant ON flow_trace_sessions("tenantId");
CREATE INDEX IF NOT EXISTS idx_flow_traces_tenant ON flow_traces("tenantId");

CREATE INDEX IF NOT EXISTS idx_embed_api_keys_tenant ON embed_api_keys("tenantId");
CREATE INDEX IF NOT EXISTS idx_embed_sessions_tenant ON embed_sessions("tenantId");

CREATE INDEX IF NOT EXISTS idx_node_templates_tenant ON node_templates("tenantId");
CREATE INDEX IF NOT EXISTS idx_template_usage_tenant ON template_usage("tenantId");
CREATE INDEX IF NOT EXISTS idx_dynamic_templates_tenant ON dynamic_templates("tenantId");

CREATE INDEX IF NOT EXISTS idx_zip_webhooks_tenant ON zip_webhooks("tenantId");

-- ============================================================================
-- UPDATE EXISTING DATA (for migration from single-tenant to multi-tenant)
-- ============================================================================

-- Set a default tenant for existing data (customize this based on your needs)
-- You can either:
-- 1. Set all to a default tenant
-- 2. Map users to tenants based on some logic
-- 3. Leave NULL for single-tenant mode

-- Example: Set default tenant for existing data (uncomment if needed)
-- UPDATE workflows SET "tenantId" = 'default-tenant' WHERE "tenantId" IS NULL;
-- UPDATE workflow_versions SET "tenantId" = 'default-tenant' WHERE "tenantId" IS NULL;
-- UPDATE workflow_executions SET "tenantId" = 'default-tenant' WHERE "tenantId" IS NULL;
-- UPDATE workflow_snapshots SET "tenantId" = 'default-tenant' WHERE "tenantId" IS NULL;
-- UPDATE env_vars SET "tenantId" = 'default-tenant' WHERE "tenantId" IS NULL;
-- UPDATE flow_trace_sessions SET "tenantId" = 'default-tenant' WHERE "tenantId" IS NULL;
-- UPDATE flow_traces SET "tenantId" = 'default-tenant' WHERE "tenantId" IS NULL;
-- UPDATE embed_api_keys SET "tenantId" = 'default-tenant' WHERE "tenantId" IS NULL;
-- UPDATE embed_sessions SET "tenantId" = 'default-tenant' WHERE "tenantId" IS NULL;

-- ============================================================================
-- OPTIONAL: ROW-LEVEL SECURITY POLICIES FOR TENANT ISOLATION
-- ============================================================================
-- These are PostgreSQL native RLS policies that work at the database level
-- They complement the application-level authorization

-- Enable RLS on tables (if not already enabled)
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE env_vars ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_trace_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE embed_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE embed_sessions ENABLE ROW LEVEL SECURITY;

-- Create tenant isolation policies
-- Note: These assume you're passing tenant_id as a session variable or in the JWT

-- Example policy for workflows (adjust based on your auth model)
CREATE POLICY IF NOT EXISTS workflows_tenant_isolation ON workflows
    FOR ALL 
    USING (
        -- Allow access if:
        -- 1. No tenantId (backward compatibility)
        -- 2. tenantId matches current user's tenant
        -- 3. User is a system admin (has a special role)
        "tenantId" IS NULL 
        OR "tenantId" = current_setting('app.current_tenant', true)
        OR current_setting('app.user_role', true) = 'system_admin'
    );

-- Similar policies for other tables (uncomment and adjust as needed)
-- CREATE POLICY workflow_versions_tenant_isolation ON workflow_versions
--     FOR ALL USING ("tenantId" IS NULL OR "tenantId" = current_setting('app.current_tenant', true));

-- CREATE POLICY workflow_executions_tenant_isolation ON workflow_executions
--     FOR ALL USING ("tenantId" IS NULL OR "tenantId" = current_setting('app.current_tenant', true));

-- ============================================================================
-- FUNCTIONS FOR TENANT MANAGEMENT
-- ============================================================================

-- Function to set current tenant for a session
CREATE OR REPLACE FUNCTION set_current_tenant(tenant_id TEXT)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_tenant', tenant_id, false);
END;
$$ LANGUAGE plpgsql;

-- Function to get current tenant
CREATE OR REPLACE FUNCTION get_current_tenant()
RETURNS TEXT AS $$
BEGIN
    RETURN current_setting('app.current_tenant', true);
END;
$$ LANGUAGE plpgsql;

-- Function to copy a workflow to another tenant (for templates)
CREATE OR REPLACE FUNCTION copy_workflow_to_tenant(
    source_workflow_id TEXT,
    target_tenant_id TEXT,
    target_user_id TEXT
)
RETURNS TEXT AS $$
DECLARE
    new_workflow_id TEXT;
BEGIN
    -- Generate new ID
    new_workflow_id := 'workflow_' || gen_random_uuid();
    
    -- Copy workflow
    INSERT INTO workflows (id, name, description, "userId", "tenantId", "createdAt", "updatedAt")
    SELECT 
        new_workflow_id,
        name || ' (Copy)',
        description,
        target_user_id,
        target_tenant_id,
        NOW(),
        NOW()
    FROM workflows
    WHERE id = source_workflow_id;
    
    -- Copy latest version
    INSERT INTO workflow_versions (
        id, "workflowId", name, description, version, "isDraft", 
        graphs, "triggerConfig", metadata, "userId", "tenantId", "createdAt"
    )
    SELECT 
        'version_' || gen_random_uuid(),
        new_workflow_id,
        name,
        description,
        1,
        true,
        graphs,
        "triggerConfig",
        metadata,
        target_user_id,
        target_tenant_id,
        NOW()
    FROM workflow_versions
    WHERE "workflowId" = source_workflow_id
    ORDER BY version DESC
    LIMIT 1;
    
    RETURN new_workflow_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN workflows."tenantId" IS 'Tenant identifier for multi-tenant isolation';
COMMENT ON COLUMN workflows."organizationId" IS 'Organization identifier for organizational hierarchy';
COMMENT ON COLUMN node_templates."visibility" IS 'Template visibility: private, organization, tenant, public';
COMMENT ON FUNCTION set_current_tenant(TEXT) IS 'Sets the current tenant for RLS policies in this session';
COMMENT ON FUNCTION get_current_tenant() IS 'Returns the current tenant for this session';
COMMENT ON FUNCTION copy_workflow_to_tenant(TEXT, TEXT, TEXT) IS 'Copies a workflow from one tenant to another';