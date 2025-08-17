import { Pool, PoolClient } from 'pg'
import { WorkflowOperations, TransactionOperations } from './operations'

export class PostgresOperations implements WorkflowOperations {
  constructor(private pool: Pool) {}

  // Workflow CRUD
  async createWorkflow(data: {
    id: string
    name: string
    description?: string
    userId: string
    createdAt: string
    updatedAt: string
  }) {
    const result = await this.pool.query(
      `INSERT INTO workflows (id, name, description, "userId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [data.id, data.name, data.description || '', data.userId, data.createdAt, data.updatedAt]
    )
    return result.rows[0]
  }

  async getWorkflow(id: string) {
    const result = await this.pool.query('SELECT * FROM workflows WHERE id = $1', [id])
    return result.rows[0] || null
  }

  async updateWorkflow(
    id: string,
    data: {
      name?: string
      description?: string
      publishedVersionId?: string | null
      updatedAt: string
    }
  ) {
    const updates: string[] = []
    const values: any[] = []
    let paramCount = 0

    if (data.name !== undefined) {
      values.push(data.name)
      updates.push(`name = $${++paramCount}`)
    }
    if (data.description !== undefined) {
      values.push(data.description)
      updates.push(`description = $${++paramCount}`)
    }
    if (data.publishedVersionId !== undefined) {
      values.push(data.publishedVersionId)
      updates.push(`"publishedVersionId" = $${++paramCount}`)
    }
    values.push(data.updatedAt)
    updates.push(`"updatedAt" = $${++paramCount}`)

    values.push(id)

    const result = await this.pool.query(
      `UPDATE workflows SET ${updates.join(', ')} WHERE id = $${++paramCount} RETURNING *`,
      values
    )
    return result.rows[0]
  }

  async deleteWorkflow(id: string) {
    await this.pool.query('DELETE FROM workflows WHERE id = $1', [id])
  }

  async listWorkflows(params: {
    userId?: string
    limit?: number
    offset?: number
    searchTerm?: string
  }) {
    let whereClause = 'WHERE 1=1'
    const queryParams: any[] = []
    let paramCount = 0

    if (params.userId) {
      queryParams.push(params.userId)
      whereClause += ` AND "userId" = $${++paramCount}`
    }

    if (params.searchTerm) {
      queryParams.push(`%${params.searchTerm}%`, `%${params.searchTerm}%`)
      whereClause += ` AND (name ILIKE $${++paramCount} OR description ILIKE $${++paramCount})`
    }

    // Get total count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM workflows ${whereClause}`,
      queryParams
    )
    const total = parseInt(countResult.rows[0]?.count || '0')

    // Get workflows with pagination
    let query = `SELECT * FROM workflows ${whereClause} ORDER BY "updatedAt" DESC`

    if (params.limit) {
      queryParams.push(params.limit)
      query += ` LIMIT $${++paramCount}`

      if (params.offset) {
        queryParams.push(params.offset)
        query += ` OFFSET $${++paramCount}`
      }
    }

    const result = await this.pool.query(query, queryParams)
    return { workflows: result.rows, total }
  }

  // Workflow Version CRUD
  async createWorkflowVersion(data: {
    id: string
    workflowId: string
    name: string
    description?: string
    version: number
    isDraft: boolean
    isPublished: boolean
    graphs: string
    triggerConfig?: string
    metadata?: string
    userId: string
    createdAt: string
    publishedAt?: string
  }) {
    const result = await this.pool.query(
      `INSERT INTO workflow_versions (
        id, "workflowId", name, description, version, "isDraft", "isPublished",
        graphs, "triggerConfig", metadata, "userId", "createdAt", "publishedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        data.id,
        data.workflowId,
        data.name,
        data.description,
        data.version,
        data.isDraft,
        data.isPublished,
        data.graphs,
        data.triggerConfig || null,
        data.metadata || null,
        data.userId,
        data.createdAt,
        data.publishedAt || null,
      ]
    )
    return result.rows[0]
  }

  async getWorkflowVersion(id: string) {
    const result = await this.pool.query('SELECT * FROM workflow_versions WHERE id = $1', [id])
    return result.rows[0] || null
  }

  async updateWorkflowVersion(
    id: string,
    data: {
      name?: string
      description?: string
      graphs?: string
      triggerConfig?: string
      metadata?: string
      isDraft?: boolean
      isPublished?: boolean
      publishedAt?: string | null
      createdAt?: string
    }
  ) {
    const updates: string[] = []
    const values: any[] = []
    let paramCount = 0

    if (data.name !== undefined) {
      values.push(data.name)
      updates.push(`name = $${++paramCount}`)
    }
    if (data.description !== undefined) {
      values.push(data.description)
      updates.push(`description = $${++paramCount}`)
    }
    if (data.graphs !== undefined) {
      values.push(data.graphs)
      updates.push(`graphs = $${++paramCount}`)
    }
    if (data.triggerConfig !== undefined) {
      values.push(data.triggerConfig)
      updates.push(`"triggerConfig" = $${++paramCount}`)
    }
    if (data.metadata !== undefined) {
      values.push(data.metadata)
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
    if (data.publishedAt !== undefined) {
      values.push(data.publishedAt)
      updates.push(`"publishedAt" = $${++paramCount}`)
    }
    if (data.createdAt !== undefined) {
      values.push(data.createdAt)
      updates.push(`"createdAt" = $${++paramCount}`)
    }

    values.push(id)

    const result = await this.pool.query(
      `UPDATE workflow_versions SET ${updates.join(', ')} WHERE id = $${++paramCount} RETURNING *`,
      values
    )
    return result.rows[0]
  }

  async listWorkflowVersions(
    workflowId: string,
    params?: {
      limit?: number
      offset?: number
      includePublished?: boolean
    }
  ) {
    let whereClause = 'WHERE "workflowId" = $1'
    const queryParams: any[] = [workflowId]
    let paramCount = 1

    if (params?.includePublished === false) {
      queryParams.push(false)
      whereClause += ` AND "isPublished" = $${++paramCount}`
    }

    // Get total count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM workflow_versions ${whereClause}`,
      queryParams
    )
    const total = parseInt(countResult.rows[0]?.count || '0')

    // Get versions with pagination
    let query = `SELECT * FROM workflow_versions ${whereClause} ORDER BY version DESC`

    if (params?.limit) {
      queryParams.push(params.limit)
      query += ` LIMIT $${++paramCount}`

      if (params.offset) {
        queryParams.push(params.offset)
        query += ` OFFSET $${++paramCount}`
      }
    }

    const result = await this.pool.query(query, queryParams)
    return { versions: result.rows, total }
  }

  async getMaxVersionNumber(workflowId: string): Promise<number> {
    const result = await this.pool.query(
      'SELECT MAX(version) as "maxVersion" FROM workflow_versions WHERE "workflowId" = $1',
      [workflowId]
    )
    return result.rows[0]?.maxVersion || 0
  }

  async unpublishAllVersions(workflowId: string, exceptId?: string) {
    if (exceptId) {
      await this.pool.query(
        `UPDATE workflow_versions 
         SET "isPublished" = $1, "publishedAt" = NULL 
         WHERE "workflowId" = $2 AND id != $3`,
        [false, workflowId, exceptId]
      )
    } else {
      await this.pool.query(
        `UPDATE workflow_versions 
         SET "isPublished" = $1, "publishedAt" = NULL 
         WHERE "workflowId" = $2`,
        [false, workflowId]
      )
    }
  }

  async publishWorkflowVersion(workflowId: string, versionId: string, userId: string) {
    const now = new Date().toISOString()

    // Start a transaction
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')

      // Get the version to publish
      const versionResult = await client.query(
        'SELECT * FROM workflow_versions WHERE id = $1 AND "workflowId" = $2',
        [versionId, workflowId]
      )
      const versionToPublish = versionResult.rows[0]

      if (!versionToPublish) {
        throw new Error('Version not found')
      }

      // Unpublish all other versions
      await client.query(
        `UPDATE workflow_versions 
         SET "isPublished" = $1, "publishedAt" = NULL 
         WHERE "workflowId" = $2 AND id != $3`,
        [false, workflowId, versionId]
      )

      // Publish the specified version
      await client.query(
        `UPDATE workflow_versions 
         SET "isPublished" = $1, "isDraft" = $2, "publishedAt" = $3
         WHERE id = $4 AND "workflowId" = $5`,
        [true, false, now, versionId, workflowId]
      )

      // Update workflow's published version reference
      await client.query(
        `UPDATE workflows 
         SET "publishedVersionId" = $1, "updatedAt" = $2
         WHERE id = $3`,
        [versionId, now, workflowId]
      )

      // Create a new draft version
      const newDraftId =
        'wfv_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 15)
      const nextVersion = versionToPublish.version + 1

      await client.query(
        `INSERT INTO workflow_versions (
          id, "workflowId", name, description, version, "isDraft", "isPublished",
          graphs, "triggerConfig", metadata, "userId", "createdAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
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
          now,
        ]
      )

      await client.query('COMMIT')

      // Get updated data
      const workflowResult = await this.pool.query('SELECT * FROM workflows WHERE id = $1', [
        workflowId,
      ])
      const publishedVersionResult = await this.pool.query(
        'SELECT * FROM workflow_versions WHERE id = $1',
        [versionId]
      )
      const newDraftResult = await this.pool.query(
        'SELECT * FROM workflow_versions WHERE id = $1',
        [newDraftId]
      )

      return {
        workflow: workflowResult.rows[0],
        version: publishedVersionResult.rows[0],
        newDraftVersion: newDraftResult.rows[0],
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async unpublishWorkflow(workflowId: string) {
    const now = new Date().toISOString()
    const client = await this.pool.connect()

    try {
      await client.query('BEGIN')

      // Get current published version
      const workflowResult = await client.query(
        'SELECT "publishedVersionId" FROM workflows WHERE id = $1',
        [workflowId]
      )
      const workflow = workflowResult.rows[0]

      if (workflow?.publishedVersionId) {
        // Mark version as unpublished
        await client.query(
          `UPDATE workflow_versions 
           SET "isPublished" = $1, "publishedAt" = NULL 
           WHERE id = $2`,
          [false, workflow.publishedVersionId]
        )
      }

      // Remove published version reference
      await client.query(
        `UPDATE workflows 
         SET "publishedVersionId" = NULL, "updatedAt" = $1
         WHERE id = $2`,
        [now, workflowId]
      )

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  // Workflow Execution CRUD
  async createWorkflowExecution(data: {
    id: string
    workflowId: string
    workflowVersionId: string
    status: string
    startedAt: string
    inputData?: string
    userId: string
  }) {
    const result = await this.pool.query(
      `INSERT INTO workflow_executions (
        id, "workflowId", "workflowVersionId", status, "startedAt", "inputData", "userId"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        data.id,
        data.workflowId,
        data.workflowVersionId,
        data.status,
        data.startedAt,
        data.inputData || null,
        data.userId,
      ]
    )
    return result.rows[0]
  }

  async getWorkflowExecution(id: string) {
    const result = await this.pool.query('SELECT * FROM workflow_executions WHERE id = $1', [id])
    return result.rows[0] || null
  }

  async updateWorkflowExecution(
    id: string,
    data: {
      status?: string
      completedAt?: string
      duration?: number
      outputData?: string
      errorMessage?: string
    }
  ) {
    const updates: string[] = []
    const values: any[] = []
    let paramCount = 0

    if (data.status !== undefined) {
      values.push(data.status)
      updates.push(`status = $${++paramCount}`)
    }
    if (data.completedAt !== undefined) {
      values.push(data.completedAt)
      updates.push(`"completedAt" = $${++paramCount}`)
    }
    if (data.duration !== undefined) {
      values.push(data.duration)
      updates.push(`duration = $${++paramCount}`)
    }
    if (data.outputData !== undefined) {
      values.push(data.outputData)
      updates.push(`"outputData" = $${++paramCount}`)
    }
    if (data.errorMessage !== undefined) {
      values.push(data.errorMessage)
      updates.push(`"errorMessage" = $${++paramCount}`)
    }

    values.push(id)

    const result = await this.pool.query(
      `UPDATE workflow_executions SET ${updates.join(', ')} WHERE id = $${++paramCount} RETURNING *`,
      values
    )
    return result.rows[0]
  }

  async listWorkflowExecutions(params: {
    workflowId?: string
    status?: string
    limit?: number
    offset?: number
  }) {
    let whereClause = 'WHERE 1=1'
    const queryParams: any[] = []
    let paramCount = 0

    if (params.workflowId) {
      queryParams.push(params.workflowId)
      whereClause += ` AND "workflowId" = $${++paramCount}`
    }

    if (params.status) {
      queryParams.push(params.status)
      whereClause += ` AND status = $${++paramCount}`
    }

    // Get total count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM workflow_executions ${whereClause}`,
      queryParams
    )
    const total = parseInt(countResult.rows[0]?.count || '0')

    // Get executions with pagination
    let query = `SELECT * FROM workflow_executions ${whereClause} ORDER BY "startedAt" DESC`

    if (params.limit) {
      queryParams.push(params.limit)
      query += ` LIMIT $${++paramCount}`

      if (params.offset) {
        queryParams.push(params.offset)
        query += ` OFFSET $${++paramCount}`
      }
    }

    const result = await this.pool.query(query, queryParams)
    return { executions: result.rows, total }
  }

  // Workflow Snapshot CRUD
  async createWorkflowSnapshot(data: {
    id: string
    workflowId: string
    name: string
    description?: string
    graphs: string
    activeGraphId?: string
    triggerConfig?: string
    metadata?: string
    isDraft: boolean
    isPublished: boolean
    saveCount: number
    userId: string
    createdAt: string
    updatedAt: string
    lastSavedAt: string
  }) {
    const result = await this.pool.query(
      `INSERT INTO workflow_snapshots (
        id, "workflowId", name, description, graphs, "activeGraphId", "triggerConfig", metadata,
        "isDraft", "isPublished", "saveCount", "userId", "createdAt", "updatedAt", "lastSavedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        data.id,
        data.workflowId,
        data.name,
        data.description || null,
        data.graphs,
        data.activeGraphId || null,
        data.triggerConfig || null,
        data.metadata || null,
        data.isDraft,
        data.isPublished,
        data.saveCount,
        data.userId,
        data.createdAt,
        data.updatedAt,
        data.lastSavedAt,
      ]
    )
    return result.rows[0]
  }

  async getWorkflowSnapshot(id: string) {
    const result = await this.pool.query('SELECT * FROM workflow_snapshots WHERE id = $1', [id])
    return result.rows[0] || null
  }

  async updateWorkflowSnapshot(id: string, updates: any) {
    const now = new Date().toISOString()
    const updateClauses: string[] = [
      '"updatedAt" = $1',
      '"lastSavedAt" = $2',
      '"saveCount" = "saveCount" + 1',
    ]
    const values: any[] = [now, now]
    let paramCount = 2

    if (updates.name !== undefined) {
      values.push(updates.name)
      updateClauses.push(`name = $${++paramCount}`)
    }
    if (updates.description !== undefined) {
      values.push(updates.description)
      updateClauses.push(`description = $${++paramCount}`)
    }
    if (updates.graphs !== undefined) {
      values.push(updates.graphs)
      updateClauses.push(`graphs = $${++paramCount}`)
    }
    if (updates.activeGraphId !== undefined) {
      values.push(updates.activeGraphId)
      updateClauses.push(`"activeGraphId" = $${++paramCount}`)
    }
    if (updates.triggerConfig !== undefined) {
      values.push(updates.triggerConfig)
      updateClauses.push(`"triggerConfig" = $${++paramCount}`)
    }
    if (updates.metadata !== undefined) {
      values.push(updates.metadata)
      updateClauses.push(`metadata = $${++paramCount}`)
    }
    if (updates.isDraft !== undefined) {
      values.push(updates.isDraft)
      updateClauses.push(`"isDraft" = $${++paramCount}`)
    }
    if (updates.isPublished !== undefined) {
      values.push(updates.isPublished)
      updateClauses.push(`"isPublished" = $${++paramCount}`)
    }

    values.push(id)

    const result = await this.pool.query(
      `UPDATE workflow_snapshots SET ${updateClauses.join(', ')} WHERE id = $${++paramCount} RETURNING *`,
      values
    )
    return result.rows[0] || null
  }

  async deleteWorkflowSnapshot(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM workflow_snapshots WHERE id = $1', [id])
    return (result.rowCount ?? 0) > 0
  }

  async listWorkflowSnapshots(workflowId: string) {
    const result = await this.pool.query(
      'SELECT * FROM workflow_snapshots WHERE "workflowId" = $1 ORDER BY "updatedAt" DESC',
      [workflowId]
    )
    return result.rows
  }

  // Environment Variables CRUD
  async createEnvVar(data: {
    id: string
    key: string
    value: string
    isSecret: boolean
    description?: string
    category: string
    userId: string
    createdAt: string
    updatedAt: string
  }) {
    const result = await this.pool.query(
      `INSERT INTO env_vars (
        id, key, value, "isSecret", description, category, "userId", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        data.id,
        data.key,
        data.value,
        data.isSecret,
        data.description || null,
        data.category,
        data.userId,
        data.createdAt,
        data.updatedAt,
      ]
    )
    return result.rows[0]
  }

  async getEnvVar(id: string) {
    const result = await this.pool.query('SELECT * FROM env_vars WHERE id = $1', [id])
    return result.rows[0] || null
  }

  async getEnvVarByKey(key: string) {
    const result = await this.pool.query('SELECT * FROM env_vars WHERE key = $1', [key])
    return result.rows[0] || null
  }

  async updateEnvVar(
    id: string,
    data: {
      key?: string
      value?: string
      isSecret?: boolean
      description?: string
      category?: string
      updatedAt: string
    }
  ) {
    const updates: string[] = []
    const values: any[] = []
    let paramCount = 0

    if (data.key !== undefined) {
      values.push(data.key)
      updates.push(`key = $${++paramCount}`)
    }
    if (data.value !== undefined) {
      values.push(data.value)
      updates.push(`value = $${++paramCount}`)
    }
    if (data.isSecret !== undefined) {
      values.push(data.isSecret)
      updates.push(`"isSecret" = $${++paramCount}`)
    }
    if (data.description !== undefined) {
      values.push(data.description)
      updates.push(`description = $${++paramCount}`)
    }
    if (data.category !== undefined) {
      values.push(data.category)
      updates.push(`category = $${++paramCount}`)
    }
    values.push(data.updatedAt)
    updates.push(`"updatedAt" = $${++paramCount}`)

    values.push(id)

    const result = await this.pool.query(
      `UPDATE env_vars SET ${updates.join(', ')} WHERE id = $${++paramCount} RETURNING *`,
      values
    )
    return result.rows[0]
  }

  async deleteEnvVar(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM env_vars WHERE id = $1', [id])
    return (result.rowCount ?? 0) > 0
  }

  async listEnvVars(params?: { category?: string; limit?: number; offset?: number }) {
    let whereClause = 'WHERE 1=1'
    const queryParams: any[] = []
    let paramCount = 0

    if (params?.category) {
      queryParams.push(params.category)
      whereClause += ` AND category = $${++paramCount}`
    }

    // Get total count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM env_vars ${whereClause}`,
      queryParams
    )
    const total = parseInt(countResult.rows[0]?.count || '0')

    // Get env vars with pagination
    let query = `SELECT * FROM env_vars ${whereClause} ORDER BY key ASC`

    if (params?.limit) {
      queryParams.push(params.limit)
      query += ` LIMIT $${++paramCount}`

      if (params?.offset) {
        queryParams.push(params.offset)
        query += ` OFFSET $${++paramCount}`
      }
    }

    const result = await this.pool.query(query, queryParams)
    return { data: result.rows, total }
  }

  async checkSecretExists(key: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT id FROM env_vars WHERE key = $1 AND "isSecret" = $2',
      [key, true]
    )
    return result.rows.length > 0
  }

  // Flow Trace CRUD
  async createFlowTraceSession(data: {
    id: string
    workflowId: string
    workflowVersionId?: string
    workflowName: string
    startTime: string
    status: string
    summary?: string
    userId: string
    createdAt: string
  }) {
    const result = await this.pool.query(
      `INSERT INTO flow_trace_sessions (
        id, "workflowId", "workflowVersionId", "workflowName", "startTime", 
        status, summary, "userId", "createdAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        data.id,
        data.workflowId,
        data.workflowVersionId || null,
        data.workflowName,
        data.startTime,
        data.status,
        data.summary || null,
        data.userId,
        data.createdAt,
      ]
    )
    return result.rows[0]
  }

  async getFlowTraceSession(id: string) {
    const result = await this.pool.query('SELECT * FROM flow_trace_sessions WHERE id = $1', [id])
    return result.rows[0] || null
  }

  async updateFlowTraceSession(
    id: string,
    data: {
      endTime?: string
      status?: string
      summary?: string
    }
  ) {
    const updates: string[] = []
    const values: any[] = []
    let paramCount = 0

    if (data.endTime !== undefined) {
      values.push(data.endTime)
      updates.push(`"endTime" = $${++paramCount}`)
    }
    if (data.status !== undefined) {
      values.push(data.status)
      updates.push(`status = $${++paramCount}`)
    }
    if (data.summary !== undefined) {
      values.push(data.summary)
      updates.push(`summary = $${++paramCount}`)
    }

    values.push(id)

    const result = await this.pool.query(
      `UPDATE flow_trace_sessions SET ${updates.join(', ')} WHERE id = $${++paramCount} RETURNING *`,
      values
    )
    return result.rows[0]
  }

  async createFlowTrace(data: any) {
    const result = await this.pool.query(
      `INSERT INTO flow_traces (
        id, "sessionId", timestamp, duration, status,
        "sourceNodeId", "sourceNodeName", "sourceNodeType", "sourcePortId", "sourcePortName", "sourcePortType",
        "targetNodeId", "targetNodeName", "targetNodeType", "targetPortId", "targetPortName", "targetPortType",
        "dataPayload", "dataSize", "dataType", "dataPreview",
        "errorMessage", "errorCode", "errorStack",
        "graphId", "graphName", "parentTraceId", depth, "createdAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
      RETURNING *`,
      [
        data.id,
        data.sessionId,
        data.timestamp,
        data.duration,
        data.status,
        data.sourceNodeId,
        data.sourceNodeName,
        data.sourceNodeType,
        data.sourcePortId,
        data.sourcePortName,
        data.sourcePortType,
        data.targetNodeId,
        data.targetNodeName,
        data.targetNodeType,
        data.targetPortId,
        data.targetPortName,
        data.targetPortType,
        data.dataPayload || null,
        data.dataSize,
        data.dataType,
        data.dataPreview || null,
        data.errorMessage || null,
        data.errorCode || null,
        data.errorStack || null,
        data.graphId || null,
        data.graphName || null,
        data.parentTraceId || null,
        data.depth || 0,
        data.createdAt,
      ]
    )
    return result.rows[0]
  }

  async getFlowTrace(id: string) {
    const result = await this.pool.query('SELECT * FROM flow_traces WHERE id = $1', [id])
    return result.rows[0] || null
  }

  async listFlowTraces(
    sessionId: string,
    params?: {
      status?: string
      limit?: number
      offset?: number
    }
  ) {
    let whereClause = 'WHERE "sessionId" = $1'
    const queryParams: any[] = [sessionId]
    let paramCount = 1

    if (params?.status) {
      queryParams.push(params.status)
      whereClause += ` AND status = $${++paramCount}`
    }

    // Get total count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM flow_traces ${whereClause}`,
      queryParams
    )
    const total = parseInt(countResult.rows[0]?.count || '0')

    // Get traces with pagination
    let query = `SELECT * FROM flow_traces ${whereClause} ORDER BY timestamp ASC`

    if (params?.limit) {
      queryParams.push(params.limit)
      query += ` LIMIT $${++paramCount}`

      if (params?.offset) {
        queryParams.push(params.offset)
        query += ` OFFSET $${++paramCount}`
      }
    }

    const result = await this.pool.query(query, queryParams)
    return { traces: result.rows, total }
  }

  // Embed API Key CRUD
  async createEmbedApiKey(data: {
    id: string
    key: string
    name: string
    description?: string
    workflowId: string
    permissions: any
    createdAt: string
    updatedAt: string
    expiresAt?: string
    isActive: boolean
    usageCount: number
    rateLimits?: any
  }) {
    const result = await this.pool.query(
      `INSERT INTO embed_api_keys (
        id, key, name, description, "workflowId", permissions,
        "createdAt", "updatedAt", "expiresAt", "isActive", "usageCount", "rateLimits"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        data.id,
        data.key,
        data.name,
        data.description || null,
        data.workflowId,
        JSON.stringify(data.permissions),
        data.createdAt,
        data.updatedAt,
        data.expiresAt || null,
        data.isActive,
        data.usageCount,
        data.rateLimits ? JSON.stringify(data.rateLimits) : null,
      ]
    )
    const row = result.rows[0]
    return {
      ...row,
      permissions: JSON.parse(row.permissions),
      rateLimits: row.rateLimits ? JSON.parse(row.rateLimits) : null,
    }
  }

  async getEmbedApiKey(id: string) {
    const result = await this.pool.query('SELECT * FROM embed_api_keys WHERE id = $1', [id])
    if (result.rows.length === 0) return null
    const row = result.rows[0]
    return {
      ...row,
      permissions: JSON.parse(row.permissions),
      rateLimits: row.rateLimits ? JSON.parse(row.rateLimits) : null,
    }
  }

  async getEmbedApiKeys(workflowId?: string) {
    let query = 'SELECT * FROM embed_api_keys'
    const params: any[] = []

    if (workflowId) {
      query += ' WHERE "workflowId" = $1'
      params.push(workflowId)
    }

    query += ' ORDER BY "createdAt" DESC'

    const result = await this.pool.query(query, params)
    return result.rows.map(row => ({
      ...row,
      permissions: JSON.parse(row.permissions),
      rateLimits: row.rateLimits ? JSON.parse(row.rateLimits) : null,
    }))
  }

  async updateEmbedApiKey(
    id: string,
    data: {
      lastUsedAt?: string
      usageCount?: number
      isActive?: boolean
      updatedAt?: string
      permissions?: any
    }
  ) {
    const updates: string[] = []
    const values: any[] = []
    let paramCount = 0

    if (data.lastUsedAt !== undefined) {
      values.push(data.lastUsedAt)
      updates.push(`"lastUsedAt" = $${++paramCount}`)
    }
    if (data.usageCount !== undefined) {
      values.push(data.usageCount)
      updates.push(`"usageCount" = $${++paramCount}`)
    }
    if (data.isActive !== undefined) {
      values.push(data.isActive)
      updates.push(`"isActive" = $${++paramCount}`)
    }
    if (data.updatedAt !== undefined) {
      values.push(data.updatedAt)
      updates.push(`"updatedAt" = $${++paramCount}`)
    }
    if (data.permissions !== undefined) {
      values.push(JSON.stringify(data.permissions))
      updates.push(`permissions = $${++paramCount}`)
    }

    values.push(id)

    const result = await this.pool.query(
      `UPDATE embed_api_keys SET ${updates.join(', ')} WHERE id = $${++paramCount} RETURNING *`,
      values
    )
    const row = result.rows[0]
    return {
      ...row,
      permissions: JSON.parse(row.permissions),
      rateLimits: row.rateLimits ? JSON.parse(row.rateLimits) : null,
    }
  }

  async deleteEmbedApiKey(id: string) {
    await this.pool.query('DELETE FROM embed_api_keys WHERE id = $1', [id])
  }

  // Embed Session tracking
  async createEmbedSession(data: {
    id: string
    apiKeyId: string
    startedAt: string
    endedAt?: string
    actions: any[]
  }) {
    const result = await this.pool.query(
      `INSERT INTO embed_sessions (
        id, "apiKeyId", "startedAt", "endedAt", actions
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [data.id, data.apiKeyId, data.startedAt, data.endedAt || null, JSON.stringify(data.actions)]
    )
    const row = result.rows[0]
    return {
      ...row,
      actions: JSON.parse(row.actions),
    }
  }

  async getEmbedSessions(apiKeyId: string) {
    const result = await this.pool.query(
      'SELECT * FROM embed_sessions WHERE "apiKeyId" = $1 ORDER BY "startedAt" DESC',
      [apiKeyId]
    )
    return result.rows.map(row => ({
      ...row,
      actions: JSON.parse(row.actions),
    }))
  }

  // Transaction support
  async beginTransaction(): Promise<TransactionOperations> {
    const client = await this.pool.connect()
    await client.query('BEGIN')

    return new PostgresTransactionOperations(client)
  }
}

// Transaction implementation
class PostgresTransactionOperations extends PostgresOperations implements TransactionOperations {
  constructor(private client: PoolClient) {
    // Pass the client as if it were a pool (they have the same query interface)
    super(client as any)
  }

  async commit() {
    await this.client.query('COMMIT')
  }

  async rollback() {
    await this.client.query('ROLLBACK')
  }

  release() {
    this.client.release()
  }

  // Legacy compatibility with withTransaction
  async query(text: string, params?: any[]) {
    const result = await this.client.query(text, params)
    return {
      rows: result.rows,
      rowCount: result.rowCount ?? undefined,
    }
  }
}
