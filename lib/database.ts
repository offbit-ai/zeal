import sqlite3 from 'sqlite3'
import { open, Database } from 'sqlite'
import path from 'path'

let db: Database<sqlite3.Database, sqlite3.Statement> | null = null

export async function getDatabase(): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
  if (db) {
    return db
  }

  // Create database file in the project root
  const dbPath = path.join(process.cwd(), 'zeal.db')
  
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  })

  // Initialize database schema
  await initializeSchema(db)
  
  return db
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

  // Workflow versions table - stores complete workflow snapshots
  await db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_versions (
      id TEXT PRIMARY KEY,
      workflowId TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      version INTEGER NOT NULL,
      isDraft BOOLEAN NOT NULL DEFAULT 1,
      isPublished BOOLEAN NOT NULL DEFAULT 0,
      nodes TEXT NOT NULL, -- JSON string of nodes
      connections TEXT NOT NULL, -- JSON string of connections
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

  // Workflow snapshots table - stores automatic saves/drafts
  await db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_snapshots (
      id TEXT PRIMARY KEY,
      workflowId TEXT NOT NULL,
      name TEXT NOT NULL,
      nodes TEXT NOT NULL, -- JSON string of nodes
      connections TEXT NOT NULL, -- JSON string of connections
      metadata TEXT, -- JSON string of additional metadata
      userId TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workflowId) REFERENCES workflows(id) ON DELETE CASCADE
    );
  `)

  // Create indexes for better performance
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow_id ON workflow_versions(workflowId);
    CREATE INDEX IF NOT EXISTS idx_workflow_versions_published ON workflow_versions(isPublished);
    CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflowId);
    CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
    CREATE INDEX IF NOT EXISTS idx_workflow_snapshots_workflow_id ON workflow_snapshots(workflowId);
  `)

  console.log('Database schema initialized successfully')
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