-- Zeal Authorization Framework - Initial Schema Migration
-- Version: 1.0.0
-- Description: Creates the initial schema for the authorization framework with tenant isolation

-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS zeal_auth;

-- Set search path
SET search_path TO zeal_auth, public;

-- Create extension for UUID generation if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- POLICIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS policies (
    id VARCHAR(255) PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    tenant_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    effect VARCHAR(10) NOT NULL CHECK (effect IN ('allow', 'deny')),
    conditions JSONB NOT NULL DEFAULT '[]'::JSONB,
    constraints JSONB,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    version INTEGER DEFAULT 1,
    
    CONSTRAINT policies_unique_name_per_tenant UNIQUE(tenant_id, name)
);

-- Indexes for policies
CREATE INDEX idx_policies_tenant_enabled ON policies(tenant_id, enabled);
CREATE INDEX idx_policies_priority ON policies(priority DESC);
CREATE INDEX idx_policies_conditions ON policies USING GIN (conditions);
CREATE INDEX idx_policies_created_at ON policies(created_at);

-- ============================================
-- ORGANIZATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR(255) PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    parent_id VARCHAR(255) REFERENCES organizations(id) ON DELETE CASCADE,
    permissions TEXT[],
    metadata JSONB DEFAULT '{}'::JSONB,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT org_unique_name_per_tenant UNIQUE(tenant_id, name)
);

-- Indexes for organizations
CREATE INDEX idx_orgs_tenant ON organizations(tenant_id);
CREATE INDEX idx_orgs_parent ON organizations(parent_id);
CREATE INDEX idx_orgs_active ON organizations(active);

-- ============================================
-- TEAMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS teams (
    id VARCHAR(255) PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    organization_id VARCHAR(255) REFERENCES organizations(id) ON DELETE CASCADE,
    parent_team_id VARCHAR(255) REFERENCES teams(id) ON DELETE CASCADE,
    permissions TEXT[],
    metadata JSONB DEFAULT '{}'::JSONB,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT team_unique_name_per_org UNIQUE(organization_id, name)
);

-- Indexes for teams
CREATE INDEX idx_teams_tenant ON teams(tenant_id);
CREATE INDEX idx_teams_org ON teams(organization_id);
CREATE INDEX idx_teams_parent ON teams(parent_team_id);
CREATE INDEX idx_teams_active ON teams(active);

-- ============================================
-- GROUPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS groups (
    id VARCHAR(255) PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    organization_id VARCHAR(255) REFERENCES organizations(id) ON DELETE CASCADE,
    permissions TEXT[],
    metadata JSONB DEFAULT '{}'::JSONB,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT group_unique_name_per_org UNIQUE(organization_id, name)
);

-- Indexes for groups
CREATE INDEX idx_groups_tenant ON groups(tenant_id);
CREATE INDEX idx_groups_org ON groups(organization_id);
CREATE INDEX idx_groups_active ON groups(active);

-- ============================================
-- ROLES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(255) PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    organization_id VARCHAR(255) REFERENCES organizations(id) ON DELETE CASCADE,
    permissions TEXT[],
    metadata JSONB DEFAULT '{}'::JSONB,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT role_unique_name_per_tenant UNIQUE(tenant_id, name)
);

-- Indexes for roles
CREATE INDEX idx_roles_tenant ON roles(tenant_id);
CREATE INDEX idx_roles_org ON roles(organization_id);
CREATE INDEX idx_roles_active ON roles(active);

-- ============================================
-- USER MEMBERSHIPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_memberships (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('organization', 'team', 'group', 'role')),
    entity_id VARCHAR(255) NOT NULL,
    role VARCHAR(100),
    permissions TEXT[],
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT membership_unique UNIQUE(tenant_id, user_id, entity_type, entity_id)
);

-- Indexes for user memberships
CREATE INDEX idx_memberships_user ON user_memberships(tenant_id, user_id);
CREATE INDEX idx_memberships_entity ON user_memberships(entity_type, entity_id);
CREATE INDEX idx_memberships_expires ON user_memberships(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================
-- AUDIT LOGS TABLE (Partitioned by month)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL,
    tenant_id VARCHAR(255),
    event_id VARCHAR(255) UNIQUE NOT NULL DEFAULT uuid_generate_v4()::TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    subject_id VARCHAR(255) NOT NULL,
    subject_type VARCHAR(50),
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    result VARCHAR(20) NOT NULL CHECK (result IN ('allowed', 'denied')),
    reason TEXT,
    duration_ms INTEGER,
    from_cache BOOLEAN DEFAULT false,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create initial partitions (current and next 3 months)
CREATE TABLE IF NOT EXISTS audit_logs_2025_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE IF NOT EXISTS audit_logs_2025_02 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE IF NOT EXISTS audit_logs_2025_03 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

CREATE TABLE IF NOT EXISTS audit_logs_2025_04 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');

-- Indexes for audit logs
CREATE INDEX idx_audit_tenant_timestamp ON audit_logs(tenant_id, timestamp DESC);
CREATE INDEX idx_audit_subject ON audit_logs(subject_id, timestamp DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id, timestamp DESC);
CREATE INDEX idx_audit_result ON audit_logs(result, timestamp DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, timestamp DESC);

-- ============================================
-- AUTH CACHE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS auth_cache (
    cache_key VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255),
    result JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for cache
CREATE INDEX idx_cache_tenant_expires ON auth_cache(tenant_id, expires_at);
CREATE INDEX idx_cache_expires ON auth_cache(expires_at);

-- ============================================
-- STORED PROCEDURES AND FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_policies_updated_at BEFORE UPDATE ON policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_memberships_updated_at BEFORE UPDATE ON user_memberships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache() 
RETURNS void AS $$
BEGIN
    DELETE FROM auth_cache WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired memberships
CREATE OR REPLACE FUNCTION clean_expired_memberships() 
RETURNS void AS $$
BEGIN
    DELETE FROM user_memberships 
    WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Function to create monthly partition for audit logs
CREATE OR REPLACE FUNCTION create_monthly_audit_partition()
RETURNS void AS $$
DECLARE
    partition_date DATE;
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    -- Create partition for next month
    partition_date := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
    partition_name := 'audit_logs_' || TO_CHAR(partition_date, 'YYYY_MM');
    start_date := partition_date;
    end_date := partition_date + INTERVAL '1 month';
    
    -- Check if partition exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_class 
        WHERE relname = partition_name 
        AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'zeal_auth')
    ) THEN
        EXECUTE format('CREATE TABLE IF NOT EXISTS zeal_auth.%I PARTITION OF zeal_auth.audit_logs FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert default roles
INSERT INTO roles (id, tenant_id, name, permissions, metadata) VALUES
    ('role-admin', 'system', 'admin', ARRAY['*'], '{"description": "Full system access"}'::JSONB),
    ('role-manager', 'system', 'manager', ARRAY['workflows.*', 'nodes.read', 'executions.*'], '{"description": "Manager access"}'::JSONB),
    ('role-user', 'system', 'user', ARRAY['workflows.read', 'workflows.create', 'nodes.read'], '{"description": "Standard user access"}'::JSONB),
    ('role-viewer', 'system', 'viewer', ARRAY['*.read'], '{"description": "Read-only access"}'::JSONB)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Insert default policies
INSERT INTO policies (id, tenant_id, name, description, priority, effect, conditions) VALUES
    ('policy-tenant-isolation', NULL, 'Tenant Isolation', 'Enforce tenant isolation', 1000, 'deny', 
     '[{"type": "all", "rules": [{"attribute": "resource.tenantId", "operator": "notEquals", "value": "{{subject.tenantId}}"}]}]'::JSONB),
    
    ('policy-admin-access', NULL, 'Admin Full Access', 'Admins have full access', 900, 'allow',
     '[{"type": "any", "rules": [{"attribute": "subject.roles", "operator": "contains", "value": "admin"}]}]'::JSONB),
    
    ('policy-owner-access', NULL, 'Owner Access', 'Owners can access their resources', 800, 'allow',
     '[{"type": "all", "rules": [{"attribute": "resource.ownerId", "operator": "equals", "value": "{{subject.id}}"}]}]'::JSONB)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON SCHEMA zeal_auth IS 'Zeal Authorization Framework schema with tenant isolation';
COMMENT ON TABLE policies IS 'Authorization policies with tenant isolation';
COMMENT ON TABLE organizations IS 'Organization hierarchy with tenant isolation';
COMMENT ON TABLE teams IS 'Teams within organizations';
COMMENT ON TABLE groups IS 'User groups within organizations';
COMMENT ON TABLE roles IS 'Role definitions with permissions';
COMMENT ON TABLE user_memberships IS 'User membership in entities (orgs, teams, groups, roles)';
COMMENT ON TABLE audit_logs IS 'Audit trail of authorization decisions (partitioned by month)';
COMMENT ON TABLE auth_cache IS 'Cache for authorization decisions';