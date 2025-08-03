import { Pool, PoolClient } from 'pg'

// PostgreSQL connection pool
let pool: Pool | null = null

// Initialize database connection
export async function getDatabase(): Promise<Pool> {
  if (pool) {
    return pool
  }

  // Create a new pool using the DATABASE_URL environment variable
  const connectionString = process.env.DATABASE_URL
  
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  pool = new Pool({
    connectionString,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
    connectionTimeoutMillis: 2000, // How long to wait for a connection
  })

  // Test the connection
  try {
    const client = await pool.connect()
    await client.query('SELECT 1')
    client.release()
    // console.log removed
  } catch (error) {
    console.error('Failed to connect to PostgreSQL:', error)
    throw error
  }

  // Initialize schema on first connection
  await initializeSchema()
  
  return pool
}

async function initializeSchema() {
  if (!pool) {
    throw new Error('Database pool not initialized')
  }

  const client = await pool.connect()
  
  try {
    // Start a transaction
    await client.query('BEGIN')
    
    // Workflows table - stores workflow metadata
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        "userId" TEXT NOT NULL,
        "publishedVersionId" TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // Workflow versions table - stores complete workflow snapshots with multiple graphs
    await client.query(`
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
    `)

    // Add foreign key for publishedVersionId after workflow_versions table exists
    await client.query(`
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
    `)

    // Workflow executions table - stores execution history
    await client.query(`
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
    `)

    // Workflow snapshots table - stores automatic saves/drafts with multiple graphs
    await client.query(`
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
    `)

    // Environment variables table
    await client.query(`
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
    `)

    // Flow trace tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS flow_trace_sessions (
        id TEXT PRIMARY KEY,
        "workflowId" TEXT NOT NULL,
        "workflowVersionId" TEXT,
        "workflowName" TEXT NOT NULL,
        "startTime" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "endTime" TIMESTAMP,
        status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
        summary TEXT, -- JSON string of summary stats
        "userId" TEXT NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("workflowId") REFERENCES workflows(id) ON DELETE CASCADE
      );
    `)

    await client.query(`
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
    `)

    // Create indexes for better performance
    await client.query(`
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
    `)

    // Commit the transaction
    await client.query('COMMIT')
    // console.log removed
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK')
    console.error('Failed to initialize database schema:', error)
    throw error
  } finally {
    client.release()
  }
}

export async function closeDatabase() {
  if (pool) {
    await pool.end()
    pool = null
    // console.log removed
  }
}

// Transaction helper
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const db = await getDatabase()
  const client = await db.connect()
  
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// Utility function to generate UUIDs
export function generateId(): string {
  return 'wf_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 15)
}

export function generateVersionId(): string {
  return 'wfv_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 15)
}

export function generateExecutionId(): string {
  return 'wfe_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 15)
}

export function generateSnapshotId(): string {
  return 'wfs_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 15)
}

export function generateEnvVarId(): string {
  return 'env_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 15)
}

export function generateTraceSessionId(): string {
  return 'fts_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 15)
}

export function generateTraceId(): string {
  return 'ft_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 15)
}