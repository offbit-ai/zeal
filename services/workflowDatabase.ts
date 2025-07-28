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
  
  // Create a new workflow
  static async createWorkflow(data: {
    name: string
    description?: string
    userId: string
    graphs: WorkflowGraph[]
    triggerConfig?: any
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
          graphs, triggerConfig, metadata, userId, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        versionId, workflowId, data.name, data.description, 1, 1, 0,
        JSON.stringify(data.graphs),
        data.triggerConfig ? JSON.stringify(data.triggerConfig) : null,
        JSON.stringify(data.metadata || {}), data.userId, now
      ])
      
      await db.run('COMMIT')
      
      // Construct the workflow and version objects directly instead of re-querying
      const workflow: WorkflowRecord = {
        id: workflowId,
        name: data.name,
        description: data.description || '',
        userId: data.userId,
        publishedVersionId: undefined,
        createdAt: now,
        updatedAt: now
      }
      
      const version: WorkflowVersionRecord = {
        id: versionId,
        workflowId: workflowId,
        name: data.name,
        description: data.description || '',
        version: 1,
        isDraft: true,
        isPublished: false,
        publishedAt: undefined,
        graphs: data.graphs,
        triggerConfig: data.triggerConfig || null,
        metadata: data.metadata || {},
        userId: data.userId,
        createdAt: now
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
      graphs: row.graphs ? JSON.parse(row.graphs) : [],
      triggerConfig: row.triggerConfig ? JSON.parse(row.triggerConfig) : null,
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
      graphs: row.graphs ? JSON.parse(row.graphs) : [],
      triggerConfig: row.triggerConfig ? JSON.parse(row.triggerConfig) : null,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      isDraft: Boolean(row.isDraft),
      isPublished: Boolean(row.isPublished)
    }))
    
    return { versions, total }
  }
  
  // Update workflow (updates existing draft or creates new version)
  static async updateWorkflow(workflowId: string, data: {
    name?: string
    description?: string
    graphs: WorkflowGraph[]
    triggerConfig?: any
    metadata?: any
    userId: string
  }): Promise<WorkflowVersionRecord> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    
    await db.run('BEGIN TRANSACTION')
    
    try {
      // Check if there's an existing draft version
      const existingDraft = await db.get(`
        SELECT id, version FROM workflow_versions 
        WHERE workflowId = ? AND isDraft = 1 AND isPublished = 0
        ORDER BY version DESC
        LIMIT 1
      `, [workflowId])
      
      let versionId: string
      let version: number
      
      if (existingDraft) {
        // Update existing draft version
        versionId = existingDraft.id
        version = existingDraft.version
        
        await db.run(`
          UPDATE workflow_versions 
          SET name = ?, description = ?, graphs = ?, triggerConfig = ?, 
              metadata = ?, userId = ?, createdAt = ?
          WHERE id = ?
        `, [
          data.name || '', 
          data.description || '', 
          JSON.stringify(data.graphs),
          data.triggerConfig ? JSON.stringify(data.triggerConfig) : null,
          JSON.stringify(data.metadata || {}), 
          data.userId, 
          now,
          versionId
        ])
      } else {
        // No draft exists - create new version
        // First, get the latest version number
        const latestVersion = await db.get(`
          SELECT MAX(version) as maxVersion FROM workflow_versions WHERE workflowId = ?
        `, [workflowId])
        
        version = (latestVersion?.maxVersion || 0) + 1
        versionId = generateVersionId()
        
        await db.run(`
          INSERT INTO workflow_versions (
            id, workflowId, name, description, version, isDraft, isPublished,
            graphs, triggerConfig, metadata, userId, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          versionId, workflowId,
          data.name || '', data.description || '', version, 1, 0,
          JSON.stringify(data.graphs),
          data.triggerConfig ? JSON.stringify(data.triggerConfig) : null,
          JSON.stringify(data.metadata || {}), data.userId, now
        ])
      }
      
      // Update workflow metadata if provided
      if (data.name || data.description) {
        await db.run(`
          UPDATE workflows 
          SET name = COALESCE(?, name), description = COALESCE(?, description), updatedAt = ?
          WHERE id = ?
        `, [data.name, data.description, now, workflowId])
      }
      
      await db.run('COMMIT')
      
      const updatedVersion = await this.getWorkflowVersion(versionId)
      if (!updatedVersion) {
        throw new ApiError('VERSION_UPDATE_FAILED', 'Failed to retrieve updated version')
      }
      
      return updatedVersion
    } catch (error) {
      await db.run('ROLLBACK')
      throw error
    }
  }
  
  // Publish a workflow version
  static async publishWorkflow(workflowId: string, versionId: string): Promise<WorkflowVersionRecord> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    
    await db.run('BEGIN TRANSACTION')
    
    try {
      // Get the version to publish
      const versionToPublish = await db.get(`
        SELECT * FROM workflow_versions WHERE id = ? AND workflowId = ?
      `, [versionId, workflowId])
      
      if (!versionToPublish) {
        throw new ApiError('VERSION_NOT_FOUND', 'Version not found', 404)
      }
      
      // Unpublish all other versions
      await db.run(`
        UPDATE workflow_versions 
        SET isPublished = 0, publishedAt = NULL 
        WHERE workflowId = ? AND id != ?
      `, [workflowId, versionId])
      
      // Publish the specified version (mark as non-draft)
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
      
      // Create a new draft version for continued editing
      const newDraftId = generateVersionId()
      const nextVersion = versionToPublish.version + 1
      
      await db.run(`
        INSERT INTO workflow_versions (
          id, workflowId, name, description, version, isDraft, isPublished,
          graphs, triggerConfig, metadata, userId, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        newDraftId, workflowId,
        versionToPublish.name, 
        versionToPublish.description, 
        nextVersion, 
        1, // isDraft = true
        0, // isPublished = false
        versionToPublish.graphs,
        versionToPublish.triggerConfig,
        versionToPublish.metadata,
        versionToPublish.userId,
        now
      ])
      
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

  // Unpublish a workflow
  static async unpublishWorkflow(workflowId: string): Promise<void> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    
    await db.run('BEGIN TRANSACTION')
    
    try {
      // Get current published version
      const workflow = await db.get('SELECT publishedVersionId FROM workflows WHERE id = ?', [workflowId])
      
      if (workflow?.publishedVersionId) {
        // Update the published version to mark as unpublished
        await db.run(`
          UPDATE workflow_versions 
          SET isPublished = 0, publishedAt = NULL 
          WHERE id = ?
        `, [workflow.publishedVersionId])
      }
      
      // Remove published version reference from workflow
      await db.run(`
        UPDATE workflows 
        SET publishedVersionId = NULL, updatedAt = ?
        WHERE id = ?
      `, [now, workflowId])
      
      await db.run('COMMIT')
    } catch (error) {
      await db.run('ROLLBACK')
      throw error
    }
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
  
  // Snapshot methods
  static async saveSnapshot(data: {
    workflowId: string
    name: string
    description?: string
    graphs: WorkflowGraph[]
    activeGraphId?: string
    triggerConfig?: any
    metadata?: any
    userId: string
  }): Promise<WorkflowSnapshot> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    const snapshotId = generateSnapshotId()
    
    // Calculate metadata
    const totalNodeCount = data.graphs.reduce((sum, g) => sum + g.nodes.length, 0)
    const totalConnectionCount = data.graphs.reduce((sum, g) => sum + g.connections.length, 0)
    const totalGroupCount = data.graphs.reduce((sum, g) => sum + (g.groups?.length || 0), 0)
    
    const metadata = {
      ...data.metadata,
      totalNodeCount,
      totalConnectionCount,
      totalGroupCount,
      graphCount: data.graphs.length
    }
    
    await db.run(`
      INSERT INTO workflow_snapshots (
        id, workflowId, name, description, graphs, activeGraphId, triggerConfig, metadata,
        isDraft, isPublished, saveCount, userId, createdAt, updatedAt, lastSavedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      snapshotId,
      data.workflowId,
      data.name,
      data.description || null,
      JSON.stringify(data.graphs),
      data.activeGraphId || 'main',
      data.triggerConfig ? JSON.stringify(data.triggerConfig) : null,
      JSON.stringify(metadata),
      1, // isDraft
      0, // isPublished
      1, // saveCount
      data.userId,
      now,
      now,
      now
    ])
    
    return {
      id: snapshotId,
      name: data.name,
      description: data.description,
      createdAt: now,
      updatedAt: now,
      lastSavedAt: now,
      saveCount: 1,
      isDraft: true,
      isPublished: false,
      graphs: data.graphs,
      activeGraphId: data.activeGraphId || 'main',
      trigger: data.triggerConfig,
      metadata
    }
  }
  
  static async updateSnapshot(snapshotId: string, data: {
    name?: string
    description?: string
    graphs?: WorkflowGraph[]
    activeGraphId?: string
    triggerConfig?: any
    metadata?: any
  }): Promise<WorkflowSnapshot | null> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    
    // Get existing snapshot
    const existing = await db.get('SELECT * FROM workflow_snapshots WHERE id = ?', snapshotId)
    if (!existing) return null
    
    // Build update query
    const updates: string[] = ['updatedAt = ?', 'lastSavedAt = ?', 'saveCount = saveCount + 1']
    const values: any[] = [now, now]
    
    if (data.name !== undefined) {
      updates.push('name = ?')
      values.push(data.name)
    }
    
    if (data.description !== undefined) {
      updates.push('description = ?')
      values.push(data.description)
    }
    
    if (data.activeGraphId !== undefined) {
      updates.push('activeGraphId = ?')
      values.push(data.activeGraphId)
    }
    
    if (data.graphs !== undefined) {
      updates.push('graphs = ?')
      values.push(JSON.stringify(data.graphs))
      
      // Update metadata
      const totalNodeCount = data.graphs.reduce((sum, g) => sum + g.nodes.length, 0)
      const totalConnectionCount = data.graphs.reduce((sum, g) => sum + g.connections.length, 0)
      const totalGroupCount = data.graphs.reduce((sum, g) => sum + (g.groups?.length || 0), 0)
      
      const existingMetadata = existing.metadata ? JSON.parse(existing.metadata) : {}
      const metadata = {
        ...existingMetadata,
        ...data.metadata,
        totalNodeCount,
        totalConnectionCount,
        totalGroupCount,
        graphCount: data.graphs.length
      }
      
      updates.push('metadata = ?')
      values.push(JSON.stringify(metadata))
    }
    
    if (data.triggerConfig !== undefined) {
      updates.push('triggerConfig = ?')
      values.push(data.triggerConfig ? JSON.stringify(data.triggerConfig) : null)
    }
    
    values.push(snapshotId)
    
    await db.run(
      `UPDATE workflow_snapshots SET ${updates.join(', ')} WHERE id = ?`,
      values
    )
    
    // Return updated snapshot
    const updated = await db.get('SELECT * FROM workflow_snapshots WHERE id = ?', snapshotId)
    
    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      lastSavedAt: updated.lastSavedAt,
      saveCount: updated.saveCount,
      isDraft: Boolean(updated.isDraft),
      isPublished: Boolean(updated.isPublished),
      publishedAt: updated.publishedAt,
      graphs: JSON.parse(updated.graphs),
      activeGraphId: updated.activeGraphId,
      trigger: updated.triggerConfig ? JSON.parse(updated.triggerConfig) : undefined,
      metadata: updated.metadata ? JSON.parse(updated.metadata) : undefined
    }
  }
  
  static async getSnapshot(snapshotId: string): Promise<WorkflowSnapshot | null> {
    const db = await getDatabase()
    const row = await db.get('SELECT * FROM workflow_snapshots WHERE id = ?', snapshotId)
    
    if (!row) return null
    
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastSavedAt: row.lastSavedAt,
      saveCount: row.saveCount,
      isDraft: Boolean(row.isDraft),
      isPublished: Boolean(row.isPublished),
      publishedAt: row.publishedAt,
      graphs: JSON.parse(row.graphs),
      activeGraphId: row.activeGraphId,
      trigger: row.triggerConfig ? JSON.parse(row.triggerConfig) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }
  }
  
  static async getWorkflowSnapshots(workflowId: string): Promise<WorkflowSnapshot[]> {
    const db = await getDatabase()
    const rows = await db.all(
      'SELECT * FROM workflow_snapshots WHERE workflowId = ? ORDER BY updatedAt DESC',
      workflowId
    )
    
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastSavedAt: row.lastSavedAt,
      saveCount: row.saveCount,
      isDraft: Boolean(row.isDraft),
      isPublished: Boolean(row.isPublished),
      publishedAt: row.publishedAt,
      graphs: JSON.parse(row.graphs),
      activeGraphId: row.activeGraphId,
      trigger: row.triggerConfig ? JSON.parse(row.triggerConfig) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }))
  }
  
  static async deleteSnapshot(snapshotId: string): Promise<boolean> {
    const db = await getDatabase()
    const result = await db.run('DELETE FROM workflow_snapshots WHERE id = ?', snapshotId)
    return (result.changes || 0) > 0
  }
}