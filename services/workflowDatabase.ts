import { getDatabase, generateId, generateVersionId, generateExecutionId, generateSnapshotId } from '@/lib/database'
import { ApiError } from '@/types/api'

export interface WorkflowRecord {
  id: string
  name: string
  description?: string
  userId: string
  publishedVersionId?: string
  createdAt: string
  updatedAt: string
}

export interface WorkflowVersionRecord {
  id: string
  workflowId: string
  name: string
  description?: string
  version: number
  isDraft: boolean
  isPublished: boolean
  nodes: any[] // Parsed JSON
  connections: any[] // Parsed JSON
  metadata?: any // Parsed JSON
  userId: string
  createdAt: string
  publishedAt?: string
}

export interface WorkflowExecutionRecord {
  id: string
  workflowId: string
  workflowVersionId: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt: string
  completedAt?: string
  duration?: number
  inputData?: any // Parsed JSON
  outputData?: any // Parsed JSON
  errorMessage?: string
  userId: string
}

export interface WorkflowSnapshotRecord {
  id: string
  workflowId: string
  name: string
  nodes: any[] // Parsed JSON
  connections: any[] // Parsed JSON
  metadata?: any // Parsed JSON
  userId: string
  createdAt: string
}

export class WorkflowDatabase {
  
  // Create a new workflow
  static async createWorkflow(data: {
    name: string
    description?: string
    userId: string
    nodes: any[]
    connections: any[]
    metadata?: any
  }): Promise<{ workflow: WorkflowRecord; version: WorkflowVersionRecord }> {
    const db = await getDatabase()
    
    const workflowId = generateId()
    const versionId = generateVersionId()
    const now = new Date().toISOString()
    
    await db.run('BEGIN TRANSACTION')
    
    try {
      // Create workflow record
      await db.run(`
        INSERT INTO workflows (id, name, description, userId, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [workflowId, data.name, data.description, data.userId, now, now])
      
      // Create initial draft version
      await db.run(`
        INSERT INTO workflow_versions (
          id, workflowId, name, description, version, isDraft, isPublished,
          nodes, connections, metadata, userId, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        versionId, workflowId, data.name, data.description, 1, 1, 0,
        JSON.stringify(data.nodes), JSON.stringify(data.connections),
        JSON.stringify(data.metadata || {}), data.userId, now
      ])
      
      await db.run('COMMIT')
      
      const workflow = await this.getWorkflow(workflowId)
      const version = await this.getWorkflowVersion(versionId)
      
      if (!workflow || !version) {
        throw new ApiError('WORKFLOW_CREATION_FAILED', 'Failed to retrieve created workflow')
      }
      
      return { workflow, version }
    } catch (error) {
      await db.run('ROLLBACK')
      throw error
    }
  }
  
  // Get workflow by ID
  static async getWorkflow(id: string): Promise<WorkflowRecord | null> {
    const db = await getDatabase()
    const row = await db.get('SELECT * FROM workflows WHERE id = ?', [id])
    return row || null
  }
  
  // Get workflow version by ID
  static async getWorkflowVersion(id: string): Promise<WorkflowVersionRecord | null> {
    const db = await getDatabase()
    const row = await db.get('SELECT * FROM workflow_versions WHERE id = ?', [id])
    
    if (!row) return null
    
    return {
      ...row,
      nodes: JSON.parse(row.nodes),
      connections: JSON.parse(row.connections),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      isDraft: Boolean(row.isDraft),
      isPublished: Boolean(row.isPublished)
    }
  }
  
  // Get all workflows for a user
  static async getWorkflows(userId: string, options?: {
    limit?: number
    offset?: number
    search?: string
  }): Promise<{ workflows: WorkflowRecord[]; total: number }> {
    const db = await getDatabase()
    
    let whereClause = 'WHERE userId = ?'
    let params: any[] = [userId]
    
    if (options?.search) {
      whereClause += ' AND (name LIKE ? OR description LIKE ?)'
      params.push(`%${options.search}%`, `%${options.search}%`)
    }
    
    // Get total count
    const countResult = await db.get(`SELECT COUNT(*) as count FROM workflows ${whereClause}`, params)
    const total = countResult?.count || 0
    
    // Get workflows with pagination
    let query = `SELECT * FROM workflows ${whereClause} ORDER BY updatedAt DESC`
    
    if (options?.limit) {
      query += ` LIMIT ${options.limit}`
      if (options?.offset) {
        query += ` OFFSET ${options.offset}`
      }
    }
    
    const rows = await db.all(query, params)
    
    return { workflows: rows || [], total }
  }
  
  // Get workflow versions (history)
  static async getWorkflowVersions(workflowId: string, options?: {
    limit?: number
    offset?: number
    includePublishedOnly?: boolean
  }): Promise<{ versions: WorkflowVersionRecord[]; total: number }> {
    const db = await getDatabase()
    
    let whereClause = 'WHERE workflowId = ?'
    let params: any[] = [workflowId]
    
    if (options?.includePublishedOnly) {
      whereClause += ' AND isPublished = 1'
    }
    
    // Get total count
    const countResult = await db.get(`SELECT COUNT(*) as count FROM workflow_versions ${whereClause}`, params)
    const total = countResult?.count || 0
    
    // Get versions with pagination
    let query = `SELECT * FROM workflow_versions ${whereClause} ORDER BY version DESC`
    
    if (options?.limit) {
      query += ` LIMIT ${options.limit}`
      if (options?.offset) {
        query += ` OFFSET ${options.offset}`
      }
    }
    
    const rows = await db.all(query, params)
    
    const versions = rows.map(row => ({
      ...row,
      nodes: JSON.parse(row.nodes),
      connections: JSON.parse(row.connections),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      isDraft: Boolean(row.isDraft),
      isPublished: Boolean(row.isPublished)
    }))
    
    return { versions, total }
  }
  
  // Update workflow (creates new version)
  static async updateWorkflow(workflowId: string, data: {
    name?: string
    description?: string
    nodes: any[]
    connections: any[]
    metadata?: any
    userId: string
  }): Promise<WorkflowVersionRecord> {
    const db = await getDatabase()
    
    // Get current latest version number
    const latestVersion = await db.get(`
      SELECT MAX(version) as maxVersion FROM workflow_versions WHERE workflowId = ?
    `, [workflowId])
    
    const nextVersion = (latestVersion?.maxVersion || 0) + 1
    const versionId = generateVersionId()
    const now = new Date().toISOString()
    
    await db.run('BEGIN TRANSACTION')
    
    try {
      // Update workflow metadata if provided
      if (data.name || data.description) {
        await db.run(`
          UPDATE workflows 
          SET name = COALESCE(?, name), description = COALESCE(?, description), updatedAt = ?
          WHERE id = ?
        `, [data.name, data.description, now, workflowId])
      }
      
      // Create new version
      await db.run(`
        INSERT INTO workflow_versions (
          id, workflowId, name, description, version, isDraft, isPublished,
          nodes, connections, metadata, userId, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        versionId, workflowId,
        data.name || '', data.description || '', nextVersion, 1, 0,
        JSON.stringify(data.nodes), JSON.stringify(data.connections),
        JSON.stringify(data.metadata || {}), data.userId, now
      ])
      
      await db.run('COMMIT')
      
      const version = await this.getWorkflowVersion(versionId)
      if (!version) {
        throw new ApiError('VERSION_CREATION_FAILED', 'Failed to retrieve created version')
      }
      
      return version
    } catch (error) {
      await db.run('ROLLBACK')
      throw error
    }
  }
  
  // Publish a workflow version
  static async publishWorkflow(workflowId: string, versionId: string, userId: string): Promise<WorkflowVersionRecord> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    
    await db.run('BEGIN TRANSACTION')
    
    try {
      // Unpublish all other versions
      await db.run(`
        UPDATE workflow_versions 
        SET isPublished = 0, publishedAt = NULL 
        WHERE workflowId = ? AND id != ?
      `, [workflowId, versionId])
      
      // Publish the specified version
      await db.run(`
        UPDATE workflow_versions 
        SET isPublished = 1, isDraft = 0, publishedAt = ?
        WHERE id = ? AND workflowId = ?
      `, [now, versionId, workflowId])
      
      // Update workflow's published version reference
      await db.run(`
        UPDATE workflows 
        SET publishedVersionId = ?, updatedAt = ?
        WHERE id = ?
      `, [versionId, now, workflowId])
      
      await db.run('COMMIT')
      
      const version = await this.getWorkflowVersion(versionId)
      if (!version) {
        throw new ApiError('PUBLISH_FAILED', 'Failed to retrieve published version')
      }
      
      return version
    } catch (error) {
      await db.run('ROLLBACK')
      throw error
    }
  }
  
  // Delete workflow and all its versions
  static async deleteWorkflow(workflowId: string, userId: string): Promise<void> {
    const db = await getDatabase()
    
    // Verify ownership
    const workflow = await db.get('SELECT userId FROM workflows WHERE id = ?', [workflowId])
    if (!workflow) {
      throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow not found', 404)
    }
    if (workflow.userId !== userId) {
      throw new ApiError('FORBIDDEN', 'Not authorized to delete this workflow', 403)
    }
    
    // Foreign key constraints will handle cascading deletes
    await db.run('DELETE FROM workflows WHERE id = ?', [workflowId])
  }
  
  // Create workflow execution record
  static async createExecution(data: {
    workflowId: string
    workflowVersionId: string
    inputData?: any
    userId: string
  }): Promise<WorkflowExecutionRecord> {
    const db = await getDatabase()
    
    const executionId = generateExecutionId()
    const now = new Date().toISOString()
    
    await db.run(`
      INSERT INTO workflow_executions (
        id, workflowId, workflowVersionId, status, startedAt, inputData, userId
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      executionId, data.workflowId, data.workflowVersionId, 'running',
      now, JSON.stringify(data.inputData || {}), data.userId
    ])
    
    const execution = await this.getExecution(executionId)
    if (!execution) {
      throw new ApiError('EXECUTION_CREATION_FAILED', 'Failed to retrieve created execution')
    }
    
    return execution
  }
  
  // Get execution by ID
  static async getExecution(id: string): Promise<WorkflowExecutionRecord | null> {
    const db = await getDatabase()
    const row = await db.get('SELECT * FROM workflow_executions WHERE id = ?', [id])
    
    if (!row) return null
    
    return {
      ...row,
      inputData: row.inputData ? JSON.parse(row.inputData) : undefined,
      outputData: row.outputData ? JSON.parse(row.outputData) : undefined
    }
  }
  
  // Get executions for a workflow
  static async getExecutions(workflowId: string, options?: {
    limit?: number
    offset?: number
    status?: string
  }): Promise<{ executions: WorkflowExecutionRecord[]; total: number }> {
    const db = await getDatabase()
    
    let whereClause = 'WHERE workflowId = ?'
    let params: any[] = [workflowId]
    
    if (options?.status) {
      whereClause += ' AND status = ?'
      params.push(options.status)
    }
    
    // Get total count
    const countResult = await db.get(`SELECT COUNT(*) as count FROM workflow_executions ${whereClause}`, params)
    const total = countResult?.count || 0
    
    // Get executions with pagination
    let query = `SELECT * FROM workflow_executions ${whereClause} ORDER BY startedAt DESC`
    
    if (options?.limit) {
      query += ` LIMIT ${options.limit}`
      if (options?.offset) {
        query += ` OFFSET ${options.offset}`
      }
    }
    
    const rows = await db.all(query, params)
    
    const executions = rows.map(row => ({
      ...row,
      inputData: row.inputData ? JSON.parse(row.inputData) : undefined,
      outputData: row.outputData ? JSON.parse(row.outputData) : undefined
    }))
    
    return { executions, total }
  }
}