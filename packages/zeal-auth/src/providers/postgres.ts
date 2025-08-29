/**
 * PostgreSQL provider with tenant isolation for Zeal Authorization
 */

import { Pool, Client, PoolConfig } from 'pg';
import { Policy } from '../types';

/**
 * PostgreSQL configuration with tenant isolation
 */
export interface PostgresAuthConfig {
  // Use existing workflow DB or separate auth DB
  useWorkflowDb?: boolean;
  
  // Connection settings
  connectionString?: string;
  poolConfig?: PoolConfig;
  
  // Schema configuration for multi-tenant isolation
  schema?: {
    // Use separate schemas per tenant for complete isolation
    perTenant?: boolean;
    // Base schema name (e.g., 'auth' or 'zeal_auth')
    baseName?: string;
  };
  
  // Table prefix for shared schema approach
  tablePrefix?: string;
  
  // Enable row-level security
  enableRLS?: boolean;
}

/**
 * Main PostgreSQL provider for the authorization framework
 */
export class PostgresAuthProvider {
  private pool: Pool;
  private config: PostgresAuthConfig;
  private schemaName: string;
  
  constructor(config: PostgresAuthConfig) {
    this.config = config;
    this.schemaName = config.schema?.baseName || 'zeal_auth';
    
    // Create connection pool
    if (config.connectionString) {
      this.pool = new Pool({ connectionString: config.connectionString });
    } else if (config.poolConfig) {
      this.pool = new Pool(config.poolConfig);
    } else {
      // Default to environment variables
      this.pool = new Pool({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: process.env.POSTGRES_DB || 'zeal',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    }
  }
  
  /**
   * Initialize database schema and tables
   */
  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Create schema if it doesn't exist
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${this.schemaName}`);
      
      // Create tables
      await this.createPoliciesTable(client);
      await this.createHierarchyTables(client);
      await this.createAuditTable(client);
      await this.createCacheTable(client);
      
      // Enable row-level security if configured
      if (this.config.enableRLS) {
        await this.enableRowLevelSecurity(client);
      }
      
      console.log('PostgreSQL auth provider initialized successfully');
    } finally {
      client.release();
    }
  }
  
  /**
   * Create policies table with tenant isolation
   */
  private async createPoliciesTable(client: any): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${this.schemaName}.policies (
        id VARCHAR(255) PRIMARY KEY,
        tenant_id VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        enabled BOOLEAN DEFAULT true,
        priority INTEGER DEFAULT 0,
        effect VARCHAR(10) NOT NULL CHECK (effect IN ('allow', 'deny')),
        conditions JSONB NOT NULL,
        constraints JSONB,
        metadata JSONB,
        created_by VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        version INTEGER DEFAULT 1,
        
        -- Indexes for performance
        CONSTRAINT policies_unique_name_per_tenant UNIQUE(tenant_id, name)
      );
      
      CREATE INDEX IF NOT EXISTS idx_policies_tenant_enabled 
        ON ${this.schemaName}.policies(tenant_id, enabled);
      CREATE INDEX IF NOT EXISTS idx_policies_priority 
        ON ${this.schemaName}.policies(priority DESC);
      CREATE INDEX IF NOT EXISTS idx_policies_conditions 
        ON ${this.schemaName}.policies USING GIN (conditions);
    `);
  }
  
  /**
   * Create hierarchy tables with tenant isolation
   */
  private async createHierarchyTables(client: any): Promise<void> {
    // Organizations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${this.schemaName}.organizations (
        id VARCHAR(255) PRIMARY KEY,
        tenant_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        parent_id VARCHAR(255) REFERENCES ${this.schemaName}.organizations(id) ON DELETE CASCADE,
        permissions TEXT[],
        metadata JSONB,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT org_unique_name_per_tenant UNIQUE(tenant_id, name)
      );
      
      CREATE INDEX IF NOT EXISTS idx_orgs_tenant 
        ON ${this.schemaName}.organizations(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_orgs_parent 
        ON ${this.schemaName}.organizations(parent_id);
    `);
    
    // Teams table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${this.schemaName}.teams (
        id VARCHAR(255) PRIMARY KEY,
        tenant_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        organization_id VARCHAR(255) REFERENCES ${this.schemaName}.organizations(id) ON DELETE CASCADE,
        parent_team_id VARCHAR(255) REFERENCES ${this.schemaName}.teams(id) ON DELETE CASCADE,
        permissions TEXT[],
        metadata JSONB,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT team_unique_name_per_org UNIQUE(organization_id, name)
      );
      
      CREATE INDEX IF NOT EXISTS idx_teams_tenant 
        ON ${this.schemaName}.teams(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_teams_org 
        ON ${this.schemaName}.teams(organization_id);
      CREATE INDEX IF NOT EXISTS idx_teams_parent 
        ON ${this.schemaName}.teams(parent_team_id);
    `);
    
    // Groups table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${this.schemaName}.groups (
        id VARCHAR(255) PRIMARY KEY,
        tenant_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        organization_id VARCHAR(255) REFERENCES ${this.schemaName}.organizations(id) ON DELETE CASCADE,
        permissions TEXT[],
        metadata JSONB,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT group_unique_name_per_org UNIQUE(organization_id, name)
      );
      
      CREATE INDEX IF NOT EXISTS idx_groups_tenant 
        ON ${this.schemaName}.groups(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_groups_org 
        ON ${this.schemaName}.groups(organization_id);
    `);
    
    // Roles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${this.schemaName}.roles (
        id VARCHAR(255) PRIMARY KEY,
        tenant_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        organization_id VARCHAR(255) REFERENCES ${this.schemaName}.organizations(id) ON DELETE CASCADE,
        permissions TEXT[],
        metadata JSONB,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT role_unique_name_per_tenant UNIQUE(tenant_id, name)
      );
      
      CREATE INDEX IF NOT EXISTS idx_roles_tenant 
        ON ${this.schemaName}.roles(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_roles_org 
        ON ${this.schemaName}.roles(organization_id);
    `);
    
    // User memberships table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${this.schemaName}.user_memberships (
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
      
      CREATE INDEX IF NOT EXISTS idx_memberships_user 
        ON ${this.schemaName}.user_memberships(tenant_id, user_id);
      CREATE INDEX IF NOT EXISTS idx_memberships_entity 
        ON ${this.schemaName}.user_memberships(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_memberships_expires 
        ON ${this.schemaName}.user_memberships(expires_at) 
        WHERE expires_at IS NOT NULL;
    `);
  }
  
  /**
   * Create audit table with tenant isolation
   */
  private async createAuditTable(client: any): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${this.schemaName}.audit_logs (
        id BIGSERIAL PRIMARY KEY,
        tenant_id VARCHAR(255),
        event_id VARCHAR(255) UNIQUE NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        subject_id VARCHAR(255) NOT NULL,
        subject_type VARCHAR(50),
        resource_type VARCHAR(100),
        resource_id VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        result VARCHAR(20) NOT NULL,
        reason TEXT,
        duration_ms INTEGER,
        from_cache BOOLEAN DEFAULT false,
        ip_address INET,
        user_agent TEXT,
        metadata JSONB,
        
        -- Partitioning by month for better performance
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      ) PARTITION BY RANGE (created_at);
      
      -- Create partitions for current and next month
      CREATE TABLE IF NOT EXISTS ${this.schemaName}.audit_logs_${this.getCurrentMonth()} 
        PARTITION OF ${this.schemaName}.audit_logs
        FOR VALUES FROM ('${this.getCurrentMonthStart()}') 
        TO ('${this.getNextMonthStart()}');
      
      CREATE TABLE IF NOT EXISTS ${this.schemaName}.audit_logs_${this.getNextMonth()} 
        PARTITION OF ${this.schemaName}.audit_logs
        FOR VALUES FROM ('${this.getNextMonthStart()}') 
        TO ('${this.getMonthAfterNextStart()}');
      
      CREATE INDEX IF NOT EXISTS idx_audit_tenant_timestamp 
        ON ${this.schemaName}.audit_logs(tenant_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_subject 
        ON ${this.schemaName}.audit_logs(subject_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_resource 
        ON ${this.schemaName}.audit_logs(resource_type, resource_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_result 
        ON ${this.schemaName}.audit_logs(result, timestamp DESC);
    `);
  }
  
  /**
   * Create cache table for authorization decisions
   */
  private async createCacheTable(client: any): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${this.schemaName}.auth_cache (
        cache_key VARCHAR(255) PRIMARY KEY,
        tenant_id VARCHAR(255),
        result JSONB NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_cache_tenant_expires 
        ON ${this.schemaName}.auth_cache(tenant_id, expires_at);
      
      -- Create a function to automatically clean expired cache entries
      CREATE OR REPLACE FUNCTION ${this.schemaName}.clean_expired_cache() 
      RETURNS trigger AS $$
      BEGIN
        DELETE FROM ${this.schemaName}.auth_cache WHERE expires_at < CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
  }
  
  /**
   * Enable row-level security for tenant isolation
   */
  private async enableRowLevelSecurity(client: any): Promise<void> {
    const tables = ['policies', 'organizations', 'teams', 'groups', 'roles', 'user_memberships', 'audit_logs'];
    
    for (const table of tables) {
      await client.query(`
        ALTER TABLE ${this.schemaName}.${table} ENABLE ROW LEVEL SECURITY;
        
        -- Create policy for tenant isolation
        CREATE POLICY tenant_isolation_${table} ON ${this.schemaName}.${table}
          USING (tenant_id = current_setting('app.current_tenant')::VARCHAR);
        
        -- Create policy for superadmin access
        CREATE POLICY superadmin_${table} ON ${this.schemaName}.${table}
          USING (current_setting('app.is_superadmin', true)::BOOLEAN = true);
      `);
    }
  }
  
  /**
   * Set current tenant for RLS
   */
  async setCurrentTenant(tenantId: string, client?: any): Promise<void> {
    const query = `SET LOCAL app.current_tenant = $1`;
    if (client) {
      await client.query(query, [tenantId]);
    } else {
      await this.pool.query(query, [tenantId]);
    }
  }
  
  /**
   * Get or create a dedicated connection for a tenant
   */
  async getTenantConnection(tenantId: string): Promise<any> {
    const client = await this.pool.connect();
    await this.setCurrentTenant(tenantId, client);
    return client;
  }
  
  // Policy operations
  
  async loadPolicies(tenantId?: string): Promise<Policy[]> {
    let query = `
      SELECT * FROM ${this.schemaName}.policies
      WHERE enabled = true
    `;
    
    const params: any[] = [];
    if (tenantId) {
      query += ` AND (tenant_id = $1 OR tenant_id IS NULL)`;
      params.push(tenantId);
    }
    
    query += ` ORDER BY priority DESC, created_at ASC`;
    
    const result = await this.pool.query(query, params);
    return result.rows.map(this.mapRowToPolicy);
  }
  
  async savePolicy(policy: Policy, tenantId?: string): Promise<void> {
    const query = `
      INSERT INTO ${this.schemaName}.policies 
      (id, tenant_id, name, description, enabled, priority, effect, conditions, constraints, metadata, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        enabled = EXCLUDED.enabled,
        priority = EXCLUDED.priority,
        effect = EXCLUDED.effect,
        conditions = EXCLUDED.conditions,
        constraints = EXCLUDED.constraints,
        metadata = EXCLUDED.metadata,
        updated_at = CURRENT_TIMESTAMP,
        version = ${this.schemaName}.policies.version + 1
    `;
    
    await this.pool.query(query, [
      policy.id,
      tenantId,
      policy.name,
      policy.description,
      policy.enabled,
      policy.priority,
      policy.effect,
      JSON.stringify(policy.conditions),
      policy.constraints ? JSON.stringify(policy.constraints) : null,
      policy.metadata ? JSON.stringify(policy.metadata) : null,
      policy.metadata?.createdBy || 'system'
    ]);
  }
  
  async deletePolicy(policyId: string, tenantId?: string): Promise<void> {
    let query = `DELETE FROM ${this.schemaName}.policies WHERE id = $1`;
    const params: any[] = [policyId];
    
    if (tenantId) {
      query += ` AND tenant_id = $2`;
      params.push(tenantId);
    }
    
    await this.pool.query(query, params);
  }
  
  // Hierarchy operations
  
  async loadHierarchy(tenantId: string): Promise<any[]> {
    const nodes: any[] = [];
    
    // Load all hierarchy data for the tenant
    const [orgs, teams, groups, roles] = await Promise.all([
      this.pool.query(`SELECT * FROM ${this.schemaName}.organizations WHERE tenant_id = $1 AND active = true`, [tenantId]),
      this.pool.query(`SELECT * FROM ${this.schemaName}.teams WHERE tenant_id = $1 AND active = true`, [tenantId]),
      this.pool.query(`SELECT * FROM ${this.schemaName}.groups WHERE tenant_id = $1 AND active = true`, [tenantId]),
      this.pool.query(`SELECT * FROM ${this.schemaName}.roles WHERE tenant_id = $1 AND active = true`, [tenantId])
    ]);
    
    // Map to hierarchy nodes
    orgs.rows.forEach(row => nodes.push(this.mapRowToHierarchyNode(row, 'organization')));
    teams.rows.forEach(row => nodes.push(this.mapRowToHierarchyNode(row, 'team')));
    groups.rows.forEach(row => nodes.push(this.mapRowToHierarchyNode(row, 'group')));
    roles.rows.forEach(row => nodes.push(this.mapRowToHierarchyNode(row, 'role')));
    
    return nodes;
  }
  
  async getUserMemberships(tenantId: string, userId: string): Promise<any[]> {
    const query = `
      SELECT * FROM ${this.schemaName}.user_memberships
      WHERE tenant_id = $1 AND user_id = $2
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `;
    
    const result = await this.pool.query(query, [tenantId, userId]);
    return result.rows;
  }
  
  // Audit operations
  
  async logAuditEntry(entry: any): Promise<void> {
    const query = `
      INSERT INTO ${this.schemaName}.audit_logs
      (tenant_id, event_id, subject_id, subject_type, resource_type, resource_id, 
       action, result, reason, duration_ms, from_cache, ip_address, user_agent, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `;
    
    await this.pool.query(query, [
      entry.tenantId,
      entry.id,
      entry.subject.id,
      entry.subject.type,
      entry.resource?.type,
      entry.resource?.id,
      entry.action,
      entry.result.allowed ? 'allowed' : 'denied',
      entry.result.reason,
      entry.duration,
      entry.fromCache || false,
      entry.environment?.ipAddress,
      entry.environment?.userAgent,
      JSON.stringify(entry.metadata || {})
    ]);
  }
  
  async queryAuditLogs(tenantId: string, criteria: any): Promise<any[]> {
    let query = `
      SELECT * FROM ${this.schemaName}.audit_logs
      WHERE tenant_id = $1
    `;
    
    const params: any[] = [tenantId];
    let paramIndex = 2;
    
    if (criteria.subjectId) {
      query += ` AND subject_id = $${paramIndex++}`;
      params.push(criteria.subjectId);
    }
    
    if (criteria.resourceType) {
      query += ` AND resource_type = $${paramIndex++}`;
      params.push(criteria.resourceType);
    }
    
    if (criteria.startTime) {
      query += ` AND timestamp >= $${paramIndex++}`;
      params.push(criteria.startTime);
    }
    
    if (criteria.endTime) {
      query += ` AND timestamp <= $${paramIndex++}`;
      params.push(criteria.endTime);
    }
    
    query += ` ORDER BY timestamp DESC`;
    
    if (criteria.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(criteria.limit);
    }
    
    const result = await this.pool.query(query, params);
    return result.rows;
  }
  
  // Cache operations
  
  async getCachedAuth(key: string, _tenantId?: string): Promise<any | null> {
    const query = `
      SELECT result FROM ${this.schemaName}.auth_cache
      WHERE cache_key = $1 AND expires_at > CURRENT_TIMESTAMP
    `;
    
    const result = await this.pool.query(query, [key]);
    return result.rows[0]?.result || null;
  }
  
  async setCachedAuth(key: string, value: any, ttl: number, tenantId?: string): Promise<void> {
    const query = `
      INSERT INTO ${this.schemaName}.auth_cache (cache_key, tenant_id, result, expires_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '${ttl} seconds')
      ON CONFLICT (cache_key) DO UPDATE SET
        result = EXCLUDED.result,
        expires_at = EXCLUDED.expires_at
    `;
    
    await this.pool.query(query, [key, tenantId, JSON.stringify(value)]);
  }
  
  // Helper methods
  
  private mapRowToPolicy(row: any): Policy {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      enabled: row.enabled,
      priority: row.priority,
      effect: row.effect,
      conditions: row.conditions,
      constraints: row.constraints,
      metadata: row.metadata
    };
  }
  
  private mapRowToHierarchyNode(row: any, type: string): any {
    return {
      id: row.id,
      type,
      name: row.name,
      parentId: row.parent_id || row.organization_id || row.parent_team_id,
      permissions: row.permissions,
      metadata: row.metadata
    };
  }
  
  private getCurrentMonth(): string {
    const date = new Date();
    return `${date.getFullYear()}_${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
  
  private getNextMonth(): string {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return `${date.getFullYear()}_${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
  
  private getCurrentMonthStart(): string {
    const date = new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
  }
  
  private getNextMonthStart(): string {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
  }
  
  private getMonthAfterNextStart(): string {
    const date = new Date();
    date.setMonth(date.getMonth() + 2);
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
  }
  
  /**
   * Cleanup and maintenance
   */
  async cleanup(): Promise<void> {
    // Clean expired cache
    await this.pool.query(`
      DELETE FROM ${this.schemaName}.auth_cache 
      WHERE expires_at < CURRENT_TIMESTAMP
    `);
    
    // Clean expired memberships
    await this.pool.query(`
      DELETE FROM ${this.schemaName}.user_memberships 
      WHERE expires_at < CURRENT_TIMESTAMP
    `);
  }
  
  /**
   * Close connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}