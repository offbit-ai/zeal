import { getDatabase, generateId, generateVersionId, generateExecutionId, generateSnapshotId, withTransaction } from '@/lib/database'
import { ApiError } from '@/types/api'
import { Pool } from 'pg'

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
  graphs: any[] // Parsed JSON - array of graphs
  triggerConfig?: any // Parsed JSON
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

import type { WorkflowSnapshot, WorkflowGraph } from '@/types/snapshot'

export class WorkflowDatabase {
  
  // Create a new workflow with a specific ID
  static async createWorkflowWithId(workflowId: string, data: {
    name: string
    description?: string
    userId: string
  }): Promise<WorkflowRecord> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    
    try {
      // Create workflow record with the specified ID
      await db.query(`
        INSERT INTO workflows (id, name, description, "userId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [workflowId, data.name, data.description || '', data.userId, now, now])
      
      // Return the created workflow
      const workflow: WorkflowRecord = {
        id: workflowId,
        name: data.name,
        description: data.description || '',
        userId: data.userId,
        publishedVersionId: undefined,
        createdAt: now,
        updatedAt: now
      }
      
      return workflow
    } catch (error) {
      console.error('Error creating workflow with ID:', error)
      throw error
    }
  }

  // Create a new workflow
  static async createWorkflow(data: {
    name: string
    description?: string
    userId: string
    graphs: WorkflowGraph[]
    triggerConfig?: any
    metadata?: any
  }): Promise<{ workflow: WorkflowRecord; version: WorkflowVersionRecord }> {
    const workflowId = generateId()
    const versionId = generateVersionId()
    const now = new Date().toISOString()
    
    return withTransaction(async (client) => {
      // Create workflow record
      await client.query(`
        INSERT INTO workflows (id, name, description, "userId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [workflowId, data.name, data.description, data.userId, now, now])
      
      // Create initial draft version
      await client.query(`
        INSERT INTO workflow_versions (
          id, "workflowId", name, description, version, "isDraft", "isPublished",
          graphs, "triggerConfig", metadata, "userId", "createdAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        versionId, workflowId, data.name, data.description, 1, true, false,
        JSON.stringify(data.graphs), data.triggerConfig ? JSON.stringify(data.triggerConfig) : null,
        data.metadata ? JSON.stringify(data.metadata) : null, data.userId, now
      ])
      
      // Construct the workflow and version objects directly instead of re-querying
      const workflow: WorkflowRecord = {
        id: workflowId,
        name: data.name,
        description: data.description,
        userId: data.userId,
        publishedVersionId: undefined,
        createdAt: now,
        updatedAt: now
      }
      
      const version: WorkflowVersionRecord = {
        id: versionId,
        workflowId: workflowId,
        name: data.name,
        description: data.description,
        version: 1,
        isDraft: true,
        isPublished: false,
        graphs: data.graphs,
        triggerConfig: data.triggerConfig || null,
        metadata: data.metadata || null,
        userId: data.userId,
        createdAt: now,
        publishedAt: undefined
      }
      
      return { workflow, version }
    })
  }
  
  // Get workflow by ID
  static async getWorkflow(id: string): Promise<WorkflowRecord | null> {
    const db = await getDatabase()
    const result = await db.query('SELECT * FROM workflows WHERE id = $1', [id])
    return result.rows[0] || null
  }
  
  // Get workflow version by ID
  static async getWorkflowVersion(id: string): Promise<WorkflowVersionRecord | null> {
    const db = await getDatabase()
    const result = await db.query('SELECT * FROM workflow_versions WHERE id = $1', [id])
    const row = result.rows[0]
    
    if (!row) return null
    
    return {
      ...row,
      graphs: row.graphs ? JSON.parse(row.graphs) : [],
      triggerConfig: row.triggerConfig ? JSON.parse(row.triggerConfig) : null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    }
  }
  
  // List workflows with pagination
  static async listWorkflows(params: {
    userId?: string
    limit?: number
    offset?: number
    searchTerm?: string
  }): Promise<{ workflows: WorkflowRecord[]; total: number }> {
    const db = await getDatabase()
    const { userId, limit = 20, offset = 0, searchTerm } = params
    
    let whereClause = 'WHERE 1=1'
    const queryParams: any[] = []
    let paramCount = 0
    
    if (userId) {
      queryParams.push(userId)
      whereClause += ` AND "userId" = $${++paramCount}`
    }
    
    if (searchTerm) {
      queryParams.push(`%${searchTerm}%`, `%${searchTerm}%`)
      whereClause += ` AND (name ILIKE $${++paramCount} OR description ILIKE $${++paramCount})`
    }
    
    // Get total count
    const countResult = await db.query(`SELECT COUNT(*) as count FROM workflows ${whereClause}`, queryParams)
    const total = parseInt(countResult.rows[0]?.count || '0')
    
    // Get workflows with pagination
    let query = `SELECT * FROM workflows ${whereClause} ORDER BY "updatedAt" DESC`
    
    if (limit) {
      queryParams.push(limit)
      query += ` LIMIT $${++paramCount}`
      
      if (offset) {
        queryParams.push(offset)
        query += ` OFFSET $${++paramCount}`
      }
    }
    
    const result = await db.query(query, queryParams)
    
    return { workflows: result.rows || [], total }
  }
  
  // Get workflow versions (history)
  static async getWorkflowVersions(workflowId: string, params?: {
    limit?: number
    offset?: number
    includePublished?: boolean
  }): Promise<{ versions: WorkflowVersionRecord[]; total: number }> {
    const db = await getDatabase()
    const { limit = 50, offset = 0, includePublished = true } = params || {}
    
    let whereClause = 'WHERE "workflowId" = $1'
    const queryParams: any[] = [workflowId]
    let paramCount = 1
    
    if (!includePublished) {
      queryParams.push(false)
      whereClause += ` AND "isPublished" = $${++paramCount}`
    }
    
    // Get total count
    const countResult = await db.query(`SELECT COUNT(*) as count FROM workflow_versions ${whereClause}`, queryParams)
    const total = parseInt(countResult.rows[0]?.count || '0')
    
    // Get versions with pagination
    let query = `SELECT * FROM workflow_versions ${whereClause} ORDER BY version DESC`
    
    if (limit) {
      queryParams.push(limit)
      query += ` LIMIT $${++paramCount}`
      
      if (offset) {
        queryParams.push(offset)
        query += ` OFFSET $${++paramCount}`
      }
    }
    
    const result = await db.query(query, queryParams)
    
    const versions = result.rows.map(row => ({
      ...row,
      graphs: row.graphs ? JSON.parse(row.graphs) : [],
      triggerConfig: row.triggerConfig ? JSON.parse(row.triggerConfig) : null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    }))
    
    return { versions, total }
  }
  
  // Update workflow draft version
  static async updateWorkflowDraft(workflowId: string, data: {
    name?: string
    description?: string
    graphs: WorkflowGraph[]
    triggerConfig?: any
    metadata?: any
    userId: string
  }): Promise<WorkflowVersionRecord> {
    const now = new Date().toISOString()
    
    return withTransaction(async (client) => {
      // Check if there's an existing draft version
      const existingDraftResult = await client.query(`
        SELECT id, version FROM workflow_versions 
        WHERE "workflowId" = $1 AND "isDraft" = $2 AND "isPublished" = $3
        ORDER BY version DESC
        LIMIT 1
      `, [workflowId, true, false])
      
      const existingDraft = existingDraftResult.rows[0]
      
      let versionId: string
      let version: number
      
      if (existingDraft) {
        // Update existing draft
        versionId = existingDraft.id
        version = existingDraft.version
        
        await client.query(`
          UPDATE workflow_versions 
          SET name = $1, description = $2, graphs = $3, "triggerConfig" = $4, 
              metadata = $5, "userId" = $6, "createdAt" = $7
          WHERE id = $8
        `, [
          data.name || '', 
          data.description || null,
          JSON.stringify(data.graphs),
          data.triggerConfig ? JSON.stringify(data.triggerConfig) : null,
          data.metadata ? JSON.stringify(data.metadata) : null,
          data.userId,
          now,
          versionId
        ])
      } else {
        // No draft exists - create new version
        // First, get the latest version number
        const latestVersionResult = await client.query(`
          SELECT MAX(version) as "maxVersion" FROM workflow_versions WHERE "workflowId" = $1
        `, [workflowId])
        
        version = (latestVersionResult.rows[0]?.maxVersion || 0) + 1
        versionId = generateVersionId()
        
        await client.query(`
          INSERT INTO workflow_versions (
            id, "workflowId", name, description, version, "isDraft", "isPublished",
            graphs, "triggerConfig", metadata, "userId", "createdAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          versionId, workflowId, data.name || '', data.description || null,
          version, true, false, JSON.stringify(data.graphs),
          data.triggerConfig ? JSON.stringify(data.triggerConfig) : null,
          data.metadata ? JSON.stringify(data.metadata) : null,
          data.userId, now
        ])
      }
      
      // Update workflow metadata if provided
      if (data.name || data.description) {
        await client.query(`
          UPDATE workflows 
          SET name = COALESCE($1, name), description = COALESCE($2, description), "updatedAt" = $3
          WHERE id = $4
        `, [data.name, data.description, now, workflowId])
      }
      
      // Return the version data directly instead of querying again
      const updatedVersion: WorkflowVersionRecord = {
        id: versionId,
        workflowId: workflowId,
        name: data.name || '',
        description: data.description || undefined,
        version: version,
        isDraft: true,
        isPublished: false,
        graphs: data.graphs,
        triggerConfig: data.triggerConfig || null,
        metadata: data.metadata || null,
        userId: data.userId,
        createdAt: now,
        publishedAt: undefined
      }
      
      return updatedVersion
    })
  }
  
  // Publish a workflow version
  static async publishWorkflowVersion(workflowId: string, versionId: string, userId: string): Promise<WorkflowVersionRecord> {
    // const db = await getDatabase()
    const now = new Date().toISOString()
    
    return withTransaction(async (client) => {
      // Get the version to publish
      const versionResult = await client.query(`
        SELECT * FROM workflow_versions WHERE id = $1 AND "workflowId" = $2
      `, [versionId, workflowId])
      
      const versionToPublish = versionResult.rows[0]
      
      if (!versionToPublish) {
        throw new ApiError('VERSION_NOT_FOUND', 'Version not found', 404)
      }
      
      // Unpublish all other versions
      await client.query(`
        UPDATE workflow_versions 
        SET "isPublished" = $1, "publishedAt" = NULL 
        WHERE "workflowId" = $2 AND id != $3
      `, [false, workflowId, versionId])
      
      // Publish the specified version (mark as non-draft)
      await client.query(`
        UPDATE workflow_versions 
        SET "isPublished" = $1, "isDraft" = $2, "publishedAt" = $3
        WHERE id = $4 AND "workflowId" = $5
      `, [true, false, now, versionId, workflowId])
      
      // Update workflow's published version reference
      await client.query(`
        UPDATE workflows 
        SET "publishedVersionId" = $1, "updatedAt" = $2
        WHERE id = $3
      `, [versionId, now, workflowId])
      
      // Create a new draft version with the same content
      const newDraftId = generateVersionId()
      const nextVersion = versionToPublish.version + 1
      
      await client.query(`
        INSERT INTO workflow_versions (
          id, "workflowId", name, description, version, "isDraft", "isPublished",
          graphs, "triggerConfig", metadata, "userId", "createdAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        newDraftId,
        workflowId,
        versionToPublish.name,
        versionToPublish.description,
        nextVersion,
        true,
        false,
        versionToPublish.graphs,
        versionToPublish.triggerConfig,
        versionToPublish.metadata,
        userId,
        now
      ])
      
      const version = await this.getWorkflowVersion(versionId)
      if (!version) {
        throw new ApiError('PUBLISH_FAILED', 'Failed to retrieve published version')
      }
      
      return version
    })
  }
  
  // Delete workflow and all its versions
  static async deleteWorkflow(workflowId: string, userId: string): Promise<void> {
    const db = await getDatabase()
    
    // Verify ownership
    const result = await db.query('SELECT "userId" FROM workflows WHERE id = $1', [workflowId])
    const workflow = result.rows[0]
    
    if (!workflow) {
      throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow not found', 404)
    }
    if (workflow.userId !== userId) {
      throw new ApiError('FORBIDDEN', 'Not authorized to delete this workflow', 403)
    }
    
    // Foreign key constraints will handle cascading deletes
    await db.query('DELETE FROM workflows WHERE id = $1', [workflowId])
  }

  // Unpublish a workflow
  static async unpublishWorkflow(workflowId: string): Promise<void> {
    const now = new Date().toISOString()
    
    return withTransaction(async (client) => {
      // Get current published version
      const workflowResult = await client.query('SELECT "publishedVersionId" FROM workflows WHERE id = $1', [workflowId])
      const workflow = workflowResult.rows[0]
      
      if (workflow?.publishedVersionId) {
        // Update the published version to mark as unpublished
        await client.query(`
          UPDATE workflow_versions 
          SET "isPublished" = $1, "publishedAt" = NULL 
          WHERE id = $2
        `, [false, workflow.publishedVersionId])
      }
      
      // Remove published version reference from workflow
      await client.query(`
        UPDATE workflows 
        SET "publishedVersionId" = NULL, "updatedAt" = $1
        WHERE id = $2
      `, [now, workflowId])
    })
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
    
    await db.query(`
      INSERT INTO workflow_executions (
        id, "workflowId", "workflowVersionId", status, "startedAt", "inputData", "userId"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      executionId, data.workflowId, data.workflowVersionId, 'running',
      now, data.inputData ? JSON.stringify(data.inputData) : null, data.userId
    ])
    
    return {
      id: executionId,
      workflowId: data.workflowId,
      workflowVersionId: data.workflowVersionId,
      status: 'running',
      startedAt: now,
      inputData: data.inputData,
      userId: data.userId
    }
  }
  
  // Get execution by ID
  static async getExecution(id: string): Promise<WorkflowExecutionRecord | null> {
    const db = await getDatabase()
    const result = await db.query('SELECT * FROM workflow_executions WHERE id = $1', [id])
    const row = result.rows[0]
    
    if (!row) return null
    
    return {
      ...row,
      inputData: row.inputData ? JSON.parse(row.inputData) : undefined,
      outputData: row.outputData ? JSON.parse(row.outputData) : undefined
    }
  }
  
  // List executions with pagination
  static async listExecutions(params: {
    workflowId?: string
    status?: string
    limit?: number
    offset?: number
  }): Promise<{ executions: WorkflowExecutionRecord[]; total: number }> {
    const db = await getDatabase()
    const { workflowId, status, limit = 20, offset = 0 } = params
    
    let whereClause = 'WHERE 1=1'
    const queryParams: any[] = []
    let paramCount = 0
    
    if (workflowId) {
      queryParams.push(workflowId)
      whereClause += ` AND "workflowId" = $${++paramCount}`
    }
    
    if (status) {
      queryParams.push(status)
      whereClause += ` AND status = $${++paramCount}`
    }
    
    // Get total count
    const countResult = await db.query(`SELECT COUNT(*) as count FROM workflow_executions ${whereClause}`, queryParams)
    const total = parseInt(countResult.rows[0]?.count || '0')
    
    // Get executions with pagination
    let query = `SELECT * FROM workflow_executions ${whereClause} ORDER BY "startedAt" DESC`
    
    if (limit) {
      queryParams.push(limit)
      query += ` LIMIT $${++paramCount}`
      
      if (offset) {
        queryParams.push(offset)
        query += ` OFFSET $${++paramCount}`
      }
    }
    
    const result = await db.query(query, queryParams)
    
    const executions = result.rows.map(row => ({
      ...row,
      inputData: row.inputData ? JSON.parse(row.inputData) : undefined,
      outputData: row.outputData ? JSON.parse(row.outputData) : undefined
    }))
    
    return { executions, total }
  }
  
  // Create workflow snapshot
  static async createSnapshot(data: WorkflowSnapshot): Promise<string> {
    const db = await getDatabase()
    const snapshotId = data.id || generateSnapshotId()
    const now = new Date().toISOString()
    
    // Convert graphs to the expected format
    const firstGraph = data.graphs?.[0]
    const graphs = data.graphs || [{
      id: 'main',
      name: 'Main',
      namespace: 'main',
      isMain: true,
      nodes: firstGraph?.nodes || [],
      connections: firstGraph?.connections || [],
      groups: firstGraph?.groups || []
    }]
    
    await db.query(`
      INSERT INTO workflow_snapshots (
        id, "workflowId", name, description, graphs, "activeGraphId", "triggerConfig", metadata,
        "isDraft", "isPublished", "saveCount", "userId", "createdAt", "updatedAt", "lastSavedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `, [
      snapshotId,
      data.id,
      data.name,
      data.description || null,
      JSON.stringify(graphs),
      data.activeGraphId || 'main',
      data.triggerConfig ? JSON.stringify(data.triggerConfig) : null,
      data.metadata ? JSON.stringify(data.metadata) : null,
      data.isDraft !== false,
      data.isPublished || false,
      data.saveCount || 0,
      'system', // userId is not part of WorkflowSnapshot
      data.createdAt || now,
      data.updatedAt || now,
      data.lastSavedAt || now
    ])
    
    return snapshotId
  }
  
  // Update workflow snapshot
  static async updateSnapshot(snapshotId: string, data: Partial<WorkflowSnapshot>): Promise<WorkflowSnapshot | null> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    
    // Get existing snapshot
    const existingResult = await db.query('SELECT * FROM workflow_snapshots WHERE id = $1', [snapshotId])
    const existing = existingResult.rows[0]
    
    if (!existing) return null
    
    // Build update query
    const updates: string[] = ['"updatedAt" = $1', '"lastSavedAt" = $2', '"saveCount" = "saveCount" + 1']
    const values: any[] = [now, now]
    let paramCount = 2
    
    if (data.name !== undefined) {
      values.push(data.name)
      updates.push(`name = $${++paramCount}`)
    }
    
    if (data.description !== undefined) {
      values.push(data.description)
      updates.push(`description = $${++paramCount}`)
    }
    
    if (data.graphs !== undefined) {
      values.push(JSON.stringify(data.graphs))
      updates.push(`graphs = $${++paramCount}`)
    }
    
    if (data.activeGraphId !== undefined) {
      values.push(data.activeGraphId)
      updates.push(`"activeGraphId" = $${++paramCount}`)
    }
    
    if (data.triggerConfig !== undefined) {
      values.push(data.triggerConfig ? JSON.stringify(data.triggerConfig) : null)
      updates.push(`"triggerConfig" = $${++paramCount}`)
    }
    
    if (data.metadata !== undefined) {
      values.push(data.metadata ? JSON.stringify(data.metadata) : null)
      updates.push(`metadata = $${++paramCount}`)
    }
    
    if (data.isDraft !== undefined) {
      values.push(data.isDraft)
      updates.push(`"isDraft" = $${++paramCount}`)
    }
    
    if (data.isPublished !== undefined) {
      values.push(data.isPublished)
      updates.push(`"isPublished" = $${++paramCount}`)
    }
    
    values.push(snapshotId)
    
    await db.query(
      `UPDATE workflow_snapshots SET ${updates.join(', ')} WHERE id = $${++paramCount}`,
      values
    )
    
    // Return updated snapshot
    const updatedResult = await db.query('SELECT * FROM workflow_snapshots WHERE id = $1', [snapshotId])
    const updated = updatedResult.rows[0]
    
    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      graphs: JSON.parse(updated.graphs),
      activeGraphId: updated.activeGraphId,
      triggerConfig: updated.triggerConfig ? JSON.parse(updated.triggerConfig) : null,
      metadata: updated.metadata ? JSON.parse(updated.metadata) : null,
      isDraft: updated.isDraft,
      isPublished: updated.isPublished,
      publishedAt: updated.publishedAt,
      saveCount: updated.saveCount,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      lastSavedAt: updated.lastSavedAt
    }
  }
  
  // Get workflow snapshot by ID
  static async getSnapshot(snapshotId: string): Promise<WorkflowSnapshot | null> {
    const db = await getDatabase()
    const result = await db.query('SELECT * FROM workflow_snapshots WHERE id = $1', [snapshotId])
    const row = result.rows[0]
    
    if (!row) return null
    
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      graphs: JSON.parse(row.graphs),
      activeGraphId: row.activeGraphId,
      triggerConfig: row.triggerConfig ? JSON.parse(row.triggerConfig) : null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      isDraft: row.isDraft,
      isPublished: row.isPublished,
      publishedAt: row.publishedAt,
      saveCount: row.saveCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastSavedAt: row.lastSavedAt
    }
  }
  
  // Get all snapshots for a workflow
  static async getWorkflowSnapshots(workflowId: string): Promise<WorkflowSnapshot[]> {
    const db = await getDatabase()
    const result = await db.query(
      'SELECT * FROM workflow_snapshots WHERE "workflowId" = $1 ORDER BY "updatedAt" DESC',
      [workflowId]
    )
    
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      graphs: JSON.parse(row.graphs),
      activeGraphId: row.activeGraphId,
      triggerConfig: row.triggerConfig ? JSON.parse(row.triggerConfig) : null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      isDraft: row.isDraft,
      isPublished: row.isPublished,
      publishedAt: row.publishedAt,
      saveCount: row.saveCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastSavedAt: row.lastSavedAt
    }))
  }
  
  // Delete a workflow snapshot
  static async deleteSnapshot(snapshotId: string): Promise<boolean> {
    const db = await getDatabase()
    const result = await db.query('DELETE FROM workflow_snapshots WHERE id = $1', [snapshotId])
    return (result.rowCount || 0) > 0
  }
}