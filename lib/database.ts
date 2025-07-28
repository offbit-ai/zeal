import sqlite3 from 'sqlite3'
import { open, Database } from 'sqlite'
import path from 'path'

let db: Database<sqlite3.Database, sqlite3.Statement> | null = null
let initializationPromise: Promise<Database<sqlite3.Database, sqlite3.Statement>> | null = null

export async function getDatabase(): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
  if (db) {
    return db
  }

  // If initialization is already in progress, wait for it
  if (initializationPromise) {
    return initializationPromise
  }

  // Start initialization
  initializationPromise = (async () => {
    try {
      // Create database file in the project root
      const dbPath = path.join(process.cwd(), 'zeal.db')
      
      const database = await open({
        filename: dbPath,
        driver: sqlite3.Database
      })

      // Initialize database schema
      await initializeSchema(database)
      
      db = database
      return database
    } catch (error) {
      // Reset on error so it can be retried
      initializationPromise = null
      throw error
    }
  })()

  return initializationPromise
}

async function initializeSchema(db: Database<sqlite3.Database, sqlite3.Statement>) {
  // Enable foreign keys
  await db.exec('PRAGMA foreign_keys = ON;')
  
  // Workflows table - stores workflow metadata
  await db.exec(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      userId TEXT NOT NULL,
      publishedVersionId TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (publishedVersionId) REFERENCES workflow_versions(id)
    );
  `)

  // Workflow versions table - stores complete workflow snapshots with multiple graphs
  await db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_versions (
      id TEXT PRIMARY KEY,
      workflowId TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      version INTEGER NOT NULL,
      isDraft BOOLEAN NOT NULL DEFAULT 1,
      isPublished BOOLEAN NOT NULL DEFAULT 0,
      graphs TEXT NOT NULL, -- JSON string of graphs array (includes nodes, connections, groups per graph)
      triggerConfig TEXT, -- JSON string of trigger configuration
      metadata TEXT, -- JSON string of additional metadata
      userId TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      publishedAt DATETIME,
      FOREIGN KEY (workflowId) REFERENCES workflows(id) ON DELETE CASCADE,
      UNIQUE(workflowId, version)
    );
  `)

  // Workflow executions table - stores execution history
  await db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_executions (
      id TEXT PRIMARY KEY,
      workflowId TEXT NOT NULL,
      workflowVersionId TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
      startedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      completedAt DATETIME,
      duration INTEGER, -- execution time in milliseconds
      inputData TEXT, -- JSON string of input data
      outputData TEXT, -- JSON string of output data
      errorMessage TEXT,
      userId TEXT NOT NULL,
      FOREIGN KEY (workflowId) REFERENCES workflows(id) ON DELETE CASCADE,
      FOREIGN KEY (workflowVersionId) REFERENCES workflow_versions(id) ON DELETE CASCADE
    );
  `)

  // Workflow snapshots table - stores automatic saves/drafts with multiple graphs
  await db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_snapshots (
      id TEXT PRIMARY KEY,
      workflowId TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      graphs TEXT NOT NULL, -- JSON string of graphs array (includes nodes, connections, groups per graph)
      activeGraphId TEXT, -- Currently active graph tab
      triggerConfig TEXT, -- JSON string of trigger configuration
      metadata TEXT, -- JSON string of additional metadata
      isDraft BOOLEAN NOT NULL DEFAULT 1,
      isPublished BOOLEAN NOT NULL DEFAULT 0,
      publishedAt DATETIME,
      saveCount INTEGER DEFAULT 0,
      userId TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      lastSavedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workflowId) REFERENCES workflows(id) ON DELETE CASCADE
    );
  `)

  // Environment variables table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS env_vars (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      isSecret BOOLEAN NOT NULL DEFAULT 0,
      description TEXT,
      category TEXT CHECK (category IN ('environment', 'secrets')),
      userId TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  // Flow trace tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS flow_trace_sessions (
      id TEXT PRIMARY KEY,
      workflowId TEXT NOT NULL,
      workflowVersionId TEXT,
      workflowName TEXT NOT NULL,
      startTime DATETIME DEFAULT CURRENT_TIMESTAMP,
      endTime DATETIME,
      status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
      summary TEXT, -- JSON string of summary stats
      userId TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workflowId) REFERENCES workflows(id) ON DELETE CASCADE
    );
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS flow_traces (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      duration INTEGER NOT NULL, -- milliseconds
      status TEXT NOT NULL CHECK (status IN ('success', 'error', 'warning')),
      
      -- Source node information
      sourceNodeId TEXT NOT NULL,
      sourceNodeName TEXT NOT NULL,
      sourceNodeType TEXT NOT NULL,
      sourcePortId TEXT NOT NULL,
      sourcePortName TEXT NOT NULL,
      sourcePortType TEXT NOT NULL CHECK (sourcePortType IN ('input', 'output')),
      
      -- Target node information  
      targetNodeId TEXT NOT NULL,
      targetNodeName TEXT NOT NULL,
      targetNodeType TEXT NOT NULL,
      targetPortId TEXT NOT NULL,
      targetPortName TEXT NOT NULL,
      targetPortType TEXT NOT NULL CHECK (targetPortType IN ('input', 'output')),
      
      -- Data payload
      dataPayload TEXT, -- JSON string
      dataSize INTEGER NOT NULL, -- bytes
      dataType TEXT NOT NULL,
      dataPreview TEXT,
      
      -- Error information
      errorMessage TEXT,
      errorCode TEXT,
      errorStack TEXT,
      
      -- Subgraph support
      graphId TEXT, -- Which graph this trace belongs to
      graphName TEXT,
      parentTraceId TEXT, -- If this is inside a subgraph, link to parent trace
      depth INTEGER DEFAULT 0, -- Nesting depth for subgraphs
      
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sessionId) REFERENCES flow_trace_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (parentTraceId) REFERENCES flow_traces(id) ON DELETE CASCADE
    );
  `)

  // Create indexes for better performance
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow_id ON workflow_versions(workflowId);
    CREATE INDEX IF NOT EXISTS idx_workflow_versions_published ON workflow_versions(isPublished);
    CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflowId);
    CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
    CREATE INDEX IF NOT EXISTS idx_workflow_snapshots_workflow_id ON workflow_snapshots(workflowId);
    CREATE INDEX IF NOT EXISTS idx_env_vars_key ON env_vars(key);
    CREATE INDEX IF NOT EXISTS idx_env_vars_category ON env_vars(category);
    CREATE INDEX IF NOT EXISTS idx_flow_trace_sessions_workflow_id ON flow_trace_sessions(workflowId);
    CREATE INDEX IF NOT EXISTS idx_flow_trace_sessions_status ON flow_trace_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_flow_trace_sessions_start_time ON flow_trace_sessions(startTime);
    CREATE INDEX IF NOT EXISTS idx_flow_traces_session_id ON flow_traces(sessionId);
    CREATE INDEX IF NOT EXISTS idx_flow_traces_timestamp ON flow_traces(timestamp);
    CREATE INDEX IF NOT EXISTS idx_flow_traces_status ON flow_traces(status);
    CREATE INDEX IF NOT EXISTS idx_flow_traces_parent_trace_id ON flow_traces(parentTraceId);
    CREATE INDEX IF NOT EXISTS idx_flow_traces_graph_id ON flow_traces(graphId);
  `)

  // Run migrations
  await runMigrations(db)
  
  console.log('Database schema initialized successfully')
}

async function runMigrations(db: Database<sqlite3.Database, sqlite3.Statement>) {
  // Check if we need to migrate from old schema to new schema
  try {
    // Check if old columns exist
    const snapshotColumns = await db.all(`PRAGMA table_info(workflow_snapshots)`)
    const hasOldSchema = snapshotColumns.some(col => col.name === 'nodes' || col.name === 'connections')
    
    if (hasOldSchema) {
      console.log('Migrating workflow snapshots to new schema...')
      
      // Create temporary table with new schema
      await db.exec(`
        CREATE TABLE IF NOT EXISTS workflow_snapshots_new (
          id TEXT PRIMARY KEY,
          workflowId TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          graphs TEXT NOT NULL,
          activeGraphId TEXT,
          triggerConfig TEXT,
          metadata TEXT,
          isDraft BOOLEAN NOT NULL DEFAULT 1,
          isPublished BOOLEAN NOT NULL DEFAULT 0,
          publishedAt DATETIME,
          saveCount INTEGER DEFAULT 0,
          userId TEXT NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          lastSavedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (workflowId) REFERENCES workflows(id) ON DELETE CASCADE
        );
      `)
      
      // Migrate data from old format to new format
      const oldSnapshots = await db.all(`SELECT * FROM workflow_snapshots`)
      for (const snapshot of oldSnapshots) {
        const mainGraph = {
          id: 'main',
          name: 'Main',
          namespace: 'main',
          isMain: true,
          nodes: JSON.parse(snapshot.nodes || '[]'),
          connections: JSON.parse(snapshot.connections || '[]'),
          groups: []
        }
        
        await db.run(`
          INSERT INTO workflow_snapshots_new 
          (id, workflowId, name, description, graphs, activeGraphId, metadata, userId, createdAt, updatedAt, lastSavedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          snapshot.id,
          snapshot.workflowId,
          snapshot.name,
          snapshot.description || null,
          JSON.stringify([mainGraph]),
          'main', // Default to main graph for migrated snapshots
          snapshot.metadata,
          snapshot.userId,
          snapshot.createdAt,
          snapshot.createdAt,
          snapshot.createdAt
        ])
      }
      
      // Drop old table and rename new table
      await db.exec(`DROP TABLE workflow_snapshots`)
      await db.exec(`ALTER TABLE workflow_snapshots_new RENAME TO workflow_snapshots`)
      
      console.log('Migration completed successfully')
    }
    
    // Similar migration for workflow_versions
    const versionColumns = await db.all(`PRAGMA table_info(workflow_versions)`)
    const hasOldVersionSchema = versionColumns.some(col => col.name === 'nodes' || col.name === 'connections')
    
    if (hasOldVersionSchema) {
      console.log('Migrating workflow versions to new schema...')
      
      await db.exec(`
        CREATE TABLE IF NOT EXISTS workflow_versions_new (
          id TEXT PRIMARY KEY,
          workflowId TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          version INTEGER NOT NULL,
          isDraft BOOLEAN NOT NULL DEFAULT 1,
          isPublished BOOLEAN NOT NULL DEFAULT 0,
          graphs TEXT NOT NULL,
          triggerConfig TEXT,
          metadata TEXT,
          userId TEXT NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          publishedAt DATETIME,
          FOREIGN KEY (workflowId) REFERENCES workflows(id) ON DELETE CASCADE,
          UNIQUE(workflowId, version)
        );
      `)
      
      const oldVersions = await db.all(`SELECT * FROM workflow_versions`)
      for (const version of oldVersions) {
        const mainGraph = {
          id: 'main',
          name: 'Main',
          namespace: 'main',
          isMain: true,
          nodes: JSON.parse(version.nodes || '[]'),
          connections: JSON.parse(version.connections || '[]'),
          groups: []
        }
        
        await db.run(`
          INSERT INTO workflow_versions_new 
          (id, workflowId, name, description, version, isDraft, isPublished, graphs, metadata, userId, createdAt, publishedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          version.id,
          version.workflowId,
          version.name,
          version.description,
          version.version,
          version.isDraft,
          version.isPublished,
          JSON.stringify([mainGraph]),
          version.metadata,
          version.userId,
          version.createdAt,
          version.publishedAt
        ])
      }
      
      await db.exec(`DROP TABLE workflow_versions`)
      await db.exec(`ALTER TABLE workflow_versions_new RENAME TO workflow_versions`)
      
      console.log('Version migration completed successfully')
    }
    
    // Note: activeGraphId column migration is handled in the CREATE TABLE statement above
    // No additional migration needed since fresh databases will have the column
  } catch (error) {
    console.error('Migration error (may be first run):', error)
  }
}

export async function closeDatabase() {
  if (db) {
    await db.close()
    db = null
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