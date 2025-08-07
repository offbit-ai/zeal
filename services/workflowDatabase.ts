import {
  getDatabaseOperations,
  generateId,
  generateVersionId,
  generateExecutionId,
  generateSnapshotId,
} from '@/lib/database'
import { ApiError } from '@/types/api'
import type { WorkflowOperations } from '@/lib/database/operations'

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
  static async createWorkflowWithId(
    workflowId: string,
    data: {
      name: string
      description?: string
      userId: string
    }
  ): Promise<WorkflowRecord> {
    const ops = await getDatabaseOperations()
    const now = new Date().toISOString()

    try {
      const created = await ops.createWorkflow({
        id: workflowId,
        name: data.name,
        description: data.description,
        userId: data.userId,
        createdAt: now,
        updatedAt: now,
      })

      // Return the created workflow
      const workflow: WorkflowRecord = {
        id: created.id,
        name: created.name,
        description: created.description || '',
        userId: created.userId,
        publishedVersionId: created.publishedVersionId || undefined,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
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

    const ops = await getDatabaseOperations()
    const transaction = await ops.beginTransaction()

    try {
      // Create workflow record
      const createdWorkflow = await transaction.createWorkflow({
        id: workflowId,
        name: data.name,
        description: data.description,
        userId: data.userId,
        createdAt: now,
        updatedAt: now,
      })

      // Create initial draft version
      const createdVersion = await transaction.createWorkflowVersion({
        id: versionId,
        workflowId: workflowId,
        name: data.name,
        description: data.description,
        version: 1,
        isDraft: true,
        isPublished: false,
        graphs: JSON.stringify(data.graphs),
        triggerConfig: data.triggerConfig ? JSON.stringify(data.triggerConfig) : undefined,
        metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
        userId: data.userId,
        createdAt: now,
      })

      await transaction.commit()

      // Construct the workflow and version objects
      const workflow: WorkflowRecord = {
        id: createdWorkflow.id,
        name: createdWorkflow.name,
        description: createdWorkflow.description,
        userId: createdWorkflow.userId,
        publishedVersionId: createdWorkflow.publishedVersionId,
        createdAt: createdWorkflow.createdAt,
        updatedAt: createdWorkflow.updatedAt,
      }

      const version: WorkflowVersionRecord = {
        id: createdVersion.id,
        workflowId: createdVersion.workflowId,
        name: createdVersion.name,
        description: createdVersion.description,
        version: createdVersion.version,
        isDraft: createdVersion.isDraft,
        isPublished: createdVersion.isPublished,
        graphs: data.graphs, // Already parsed
        triggerConfig: data.triggerConfig || null,
        metadata: data.metadata || null,
        userId: createdVersion.userId,
        createdAt: createdVersion.createdAt,
        publishedAt: createdVersion.publishedAt,
      }

      return { workflow, version }
    } catch (error) {
      await transaction.rollback()
      throw error
    } finally {
      transaction.release()
    }
  }

  // Get workflow by ID
  static async getWorkflow(id: string): Promise<WorkflowRecord | null> {
    const ops = await getDatabaseOperations()
    const workflow = await ops.getWorkflow(id)
    if (!workflow) return null

    return {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      userId: workflow.userId,
      publishedVersionId: workflow.publishedVersionId,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    }
  }

  // Get workflow version by ID
  static async getWorkflowVersion(id: string): Promise<WorkflowVersionRecord | null> {
    const ops = await getDatabaseOperations()
    const version = await ops.getWorkflowVersion(id)

    if (!version) return null

    return {
      id: version.id,
      workflowId: version.workflowId,
      name: version.name,
      description: version.description,
      version: version.version,
      isDraft: version.isDraft,
      isPublished: version.isPublished,
      graphs: version.graphs ? JSON.parse(version.graphs) : [],
      triggerConfig: version.triggerConfig ? JSON.parse(version.triggerConfig) : null,
      metadata: version.metadata ? JSON.parse(version.metadata) : null,
      userId: version.userId,
      createdAt: version.createdAt,
      publishedAt: version.publishedAt,
    }
  }

  // List workflows with pagination
  static async listWorkflows(params: {
    userId?: string
    limit?: number
    offset?: number
    searchTerm?: string
  }): Promise<{ workflows: WorkflowRecord[]; total: number }> {
    const ops = await getDatabaseOperations()
    const { userId, limit = 20, offset = 0, searchTerm } = params

    const result = await ops.listWorkflows({
      userId,
      limit,
      offset,
      searchTerm,
    })

    const workflows = result.workflows.map(w => ({
      id: w.id,
      name: w.name,
      description: w.description,
      userId: w.userId,
      publishedVersionId: w.publishedVersionId,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }))

    return { workflows, total: result.total }
  }

  // Get workflow versions (history)
  static async getWorkflowVersions(
    workflowId: string,
    params?: {
      limit?: number
      offset?: number
      includePublished?: boolean
    }
  ): Promise<{ versions: WorkflowVersionRecord[]; total: number }> {
    const ops = await getDatabaseOperations()
    const { limit = 50, offset = 0, includePublished = true } = params || {}

    const result = await ops.listWorkflowVersions(workflowId, {
      limit,
      offset,
      includePublished,
    })

    const versions = result.versions.map(row => ({
      id: row.id,
      workflowId: row.workflowId,
      name: row.name,
      description: row.description,
      version: row.version,
      isDraft: row.isDraft,
      isPublished: row.isPublished,
      graphs: row.graphs ? JSON.parse(row.graphs) : [],
      triggerConfig: row.triggerConfig ? JSON.parse(row.triggerConfig) : null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      userId: row.userId,
      createdAt: row.createdAt,
      publishedAt: row.publishedAt,
    }))

    return { versions, total: result.total }
  }

  // Update workflow draft version
  static async updateWorkflowDraft(
    workflowId: string,
    data: {
      name?: string
      description?: string
      graphs: WorkflowGraph[]
      triggerConfig?: any
      metadata?: any
      userId: string
    }
  ): Promise<WorkflowVersionRecord> {
    const now = new Date().toISOString()
    const ops = await getDatabaseOperations()
    const transaction = await ops.beginTransaction()

    try {
      // Check if there's an existing draft version
      const { versions } = await transaction.listWorkflowVersions(workflowId, {
        limit: 1,
        includePublished: false,
      })

      const existingDraft = versions.find(v => v.isDraft && !v.isPublished)

      let versionId: string
      let version: number
      let updatedVersion: any

      if (existingDraft) {
        // Update existing draft
        versionId = existingDraft.id
        version = existingDraft.version

        updatedVersion = await transaction.updateWorkflowVersion(versionId, {
          name: data.name,
          description: data.description,
          graphs: JSON.stringify(data.graphs),
          triggerConfig: data.triggerConfig ? JSON.stringify(data.triggerConfig) : undefined,
          metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
          createdAt: now,
        })
      } else {
        // No draft exists - create new version
        const maxVersion = await transaction.getMaxVersionNumber(workflowId)
        version = maxVersion + 1
        versionId = generateVersionId()

        updatedVersion = await transaction.createWorkflowVersion({
          id: versionId,
          workflowId: workflowId,
          name: data.name || '',
          description: data.description,
          version: version,
          isDraft: true,
          isPublished: false,
          graphs: JSON.stringify(data.graphs),
          triggerConfig: data.triggerConfig ? JSON.stringify(data.triggerConfig) : undefined,
          metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
          userId: data.userId,
          createdAt: now,
        })
      }

      // Update workflow metadata if provided
      if (data.name || data.description) {
        await transaction.updateWorkflow(workflowId, {
          name: data.name,
          description: data.description,
          updatedAt: now,
        })
      }

      await transaction.commit()

      // Return the version data
      const result: WorkflowVersionRecord = {
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
        publishedAt: undefined,
      }

      return result
    } catch (error) {
      await transaction.rollback()
      throw error
    } finally {
      transaction.release()
    }
  }

  // Publish a workflow version
  static async publishWorkflowVersion(
    workflowId: string,
    versionId: string,
    userId: string
  ): Promise<WorkflowVersionRecord> {
    const ops = await getDatabaseOperations()

    try {
      const result = await ops.publishWorkflowVersion(workflowId, versionId, userId)

      // Transform the published version to our expected format
      const version = await this.getWorkflowVersion(versionId)
      if (!version) {
        throw new ApiError('PUBLISH_FAILED', 'Failed to retrieve published version')
      }

      return version
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw new ApiError('PUBLISH_FAILED', 'Failed to publish workflow version', 500)
    }
  }

  // Delete workflow and all its versions
  static async deleteWorkflow(workflowId: string, userId: string): Promise<void> {
    const ops = await getDatabaseOperations()

    // Verify ownership
    const workflow = await ops.getWorkflow(workflowId)

    if (!workflow) {
      throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow not found', 404)
    }
    if (workflow.userId !== userId) {
      throw new ApiError('FORBIDDEN', 'Not authorized to delete this workflow', 403)
    }

    // Foreign key constraints will handle cascading deletes
    await ops.deleteWorkflow(workflowId)
  }

  // Unpublish a workflow
  static async unpublishWorkflow(workflowId: string): Promise<void> {
    const ops = await getDatabaseOperations()
    await ops.unpublishWorkflow(workflowId)
  }

  // Create workflow execution record
  static async createExecution(data: {
    workflowId: string
    workflowVersionId: string
    inputData?: any
    userId: string
  }): Promise<WorkflowExecutionRecord> {
    const ops = await getDatabaseOperations()
    const executionId = generateExecutionId()
    const now = new Date().toISOString()

    const execution = await ops.createWorkflowExecution({
      id: executionId,
      workflowId: data.workflowId,
      workflowVersionId: data.workflowVersionId,
      status: 'running',
      startedAt: now,
      inputData: data.inputData ? JSON.stringify(data.inputData) : undefined,
      userId: data.userId,
    })

    return {
      id: execution.id,
      workflowId: execution.workflowId,
      workflowVersionId: execution.workflowVersionId,
      status: execution.status as 'running' | 'completed' | 'failed' | 'cancelled',
      startedAt: execution.startedAt,
      inputData: data.inputData,
      userId: execution.userId,
    }
  }

  // Get execution by ID
  static async getExecution(id: string): Promise<WorkflowExecutionRecord | null> {
    const ops = await getDatabaseOperations()
    const execution = await ops.getWorkflowExecution(id)

    if (!execution) return null

    return {
      id: execution.id,
      workflowId: execution.workflowId,
      workflowVersionId: execution.workflowVersionId,
      status: execution.status,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      duration: execution.duration,
      inputData: execution.inputData ? JSON.parse(execution.inputData) : undefined,
      outputData: execution.outputData ? JSON.parse(execution.outputData) : undefined,
      errorMessage: execution.errorMessage,
      userId: execution.userId,
    }
  }

  // List executions with pagination
  static async listExecutions(params: {
    workflowId?: string
    status?: string
    limit?: number
    offset?: number
  }): Promise<{ executions: WorkflowExecutionRecord[]; total: number }> {
    const ops = await getDatabaseOperations()
    const { workflowId, status, limit = 20, offset = 0 } = params

    const result = await ops.listWorkflowExecutions({
      workflowId,
      status,
      limit,
      offset,
    })

    const executions = result.executions.map((row: any) => ({
      id: row.id,
      workflowId: row.workflowId,
      workflowVersionId: row.workflowVersionId,
      status: row.status,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      duration: row.duration,
      inputData: row.inputData ? JSON.parse(row.inputData) : undefined,
      outputData: row.outputData ? JSON.parse(row.outputData) : undefined,
      errorMessage: row.errorMessage,
      userId: row.userId,
    }))

    return { executions, total: result.total }
  }

  // Create workflow snapshot
  static async createSnapshot(data: WorkflowSnapshot): Promise<string> {
    const ops = await getDatabaseOperations()
    const snapshotId = data.id || generateSnapshotId()
    const now = new Date().toISOString()

    // Convert graphs to the expected format
    const firstGraph = data.graphs?.[0]
    const graphs = data.graphs || [
      {
        id: 'main',
        name: 'Main',
        namespace: 'main',
        isMain: true,
        nodes: firstGraph?.nodes || [],
        connections: firstGraph?.connections || [],
        groups: firstGraph?.groups || [],
      },
    ]

    await ops.createWorkflowSnapshot({
      id: snapshotId,
      workflowId: data.id,
      name: data.name,
      description: data.description,
      graphs: JSON.stringify(graphs),
      activeGraphId: data.activeGraphId || 'main',
      triggerConfig: data.triggerConfig ? JSON.stringify(data.triggerConfig) : undefined,
      metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
      isDraft: data.isDraft !== false,
      isPublished: data.isPublished || false,
      saveCount: data.saveCount || 0,
      userId: 'system', // userId is not part of WorkflowSnapshot
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
      lastSavedAt: data.lastSavedAt || now,
    })

    return snapshotId
  }

  // Update workflow snapshot
  static async updateSnapshot(
    snapshotId: string,
    data: Partial<WorkflowSnapshot>
  ): Promise<WorkflowSnapshot | null> {
    const ops = await getDatabaseOperations()

    // Prepare update data
    const updateData: any = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.graphs !== undefined) updateData.graphs = JSON.stringify(data.graphs)
    if (data.activeGraphId !== undefined) updateData.activeGraphId = data.activeGraphId
    if (data.triggerConfig !== undefined)
      updateData.triggerConfig = data.triggerConfig ? JSON.stringify(data.triggerConfig) : null
    if (data.metadata !== undefined)
      updateData.metadata = data.metadata ? JSON.stringify(data.metadata) : null
    if (data.isDraft !== undefined) updateData.isDraft = data.isDraft
    if (data.isPublished !== undefined) updateData.isPublished = data.isPublished

    const updated = await ops.updateWorkflowSnapshot(snapshotId, updateData)

    if (!updated) return null

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      graphs: JSON.parse(updated.graphs),
      activeGraphId: updated.activeGraphId,
      triggerConfig: updated.triggerConfig ? JSON.parse(updated.triggerConfig) : undefined,
      metadata: updated.metadata ? JSON.parse(updated.metadata) : undefined,
      isDraft: updated.isDraft,
      isPublished: updated.isPublished,
      publishedAt: updated.publishedAt,
      saveCount: updated.saveCount,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      lastSavedAt: updated.lastSavedAt,
    }
  }

  // Get workflow snapshot by ID
  static async getSnapshot(snapshotId: string): Promise<WorkflowSnapshot | null> {
    const ops = await getDatabaseOperations()
    const snapshot = await ops.getWorkflowSnapshot(snapshotId)

    if (!snapshot) return null

    return {
      id: snapshot.id,
      name: snapshot.name,
      description: snapshot.description,
      graphs: JSON.parse(snapshot.graphs),
      activeGraphId: snapshot.activeGraphId,
      triggerConfig: snapshot.triggerConfig ? JSON.parse(snapshot.triggerConfig) : null,
      metadata: snapshot.metadata ? JSON.parse(snapshot.metadata) : null,
      isDraft: snapshot.isDraft,
      isPublished: snapshot.isPublished,
      publishedAt: snapshot.publishedAt,
      saveCount: snapshot.saveCount,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
      lastSavedAt: snapshot.lastSavedAt,
    }
  }

  // Get all snapshots for a workflow
  static async getWorkflowSnapshots(workflowId: string): Promise<WorkflowSnapshot[]> {
    const ops = await getDatabaseOperations()
    const snapshots = await ops.listWorkflowSnapshots(workflowId)

    return snapshots.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      graphs: JSON.parse(row.graphs),
      activeGraphId: row.activeGraphId,
      triggerConfig: row.triggerConfig ? JSON.parse(row.triggerConfig) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      isDraft: row.isDraft,
      isPublished: row.isPublished,
      publishedAt: row.publishedAt,
      saveCount: row.saveCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastSavedAt: row.lastSavedAt,
    }))
  }

  // Delete a workflow snapshot
  static async deleteSnapshot(snapshotId: string): Promise<boolean> {
    const ops = await getDatabaseOperations()
    return await ops.deleteWorkflowSnapshot(snapshotId)
  }
}
