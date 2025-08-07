import { createServerClient } from '@/lib/supabase/client'
import { WorkflowOperations, TransactionOperations } from './operations'
import {
  mapWorkflowToDb,
  mapWorkflowFromDb,
  mapWorkflowVersionToDb,
  mapWorkflowVersionFromDb,
  toSnakeCase,
} from './column-mapping'

export class SupabaseOperations implements WorkflowOperations {
  private supabase: ReturnType<typeof createServerClient>

  constructor() {
    this.supabase = createServerClient()
  }

  // Workflow CRUD
  async createWorkflow(data: {
    id: string
    name: string
    description?: string
    userId: string
    createdAt: string
    updatedAt: string
  }) {
    const { data: workflow, error } = await this.supabase
      .from('workflows')
      .insert(mapWorkflowToDb(data))
      .select()
      .single()

    if (error) throw error
    return mapWorkflowFromDb(workflow)
  }

  async getWorkflow(id: string) {
    const { data, error } = await this.supabase.from('workflows').select('*').eq('id', id).single()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 = not found
    return mapWorkflowFromDb(data)
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
    const updateData: any = { updated_at: data.updatedAt }

    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.publishedVersionId !== undefined)
      updateData.published_version_id = data.publishedVersionId

    const { data: workflow, error } = await this.supabase
      .from('workflows')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return mapWorkflowFromDb(workflow)
  }

  async deleteWorkflow(id: string) {
    const { error } = await this.supabase.from('workflows').delete().eq('id', id)

    if (error) throw error
  }

  async listWorkflows(params: {
    userId?: string
    limit?: number
    offset?: number
    searchTerm?: string
  }) {
    let query = this.supabase.from('workflows').select('*', { count: 'exact' })

    if (params.userId) {
      query = query.eq('user_id', params.userId)
    }

    if (params.searchTerm) {
      query = query.or(`name.ilike.%${params.searchTerm}%,description.ilike.%${params.searchTerm}%`)
    }

    query = query.order('updated_at', { ascending: false })

    if (params.limit) {
      query = query.limit(params.limit)
    }

    if (params.offset) {
      query = query.range(params.offset, params.offset + (params.limit || 100) - 1)
    }

    const { data, error, count } = await query

    if (error) throw error
    return { workflows: (data || []).map(mapWorkflowFromDb), total: count || 0 }
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
    const { data: version, error } = await this.supabase
      .from('workflow_versions')
      .insert(mapWorkflowVersionToDb(data))
      .select()
      .single()

    if (error) throw error
    return mapWorkflowVersionFromDb(version)
  }

  async getWorkflowVersion(id: string) {
    const { data, error } = await this.supabase
      .from('workflow_versions')
      .select('*')
      .eq('id', id)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data ? mapWorkflowVersionFromDb(data) : null
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
    const updateData: any = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.graphs !== undefined) updateData.graphs = data.graphs
    if (data.triggerConfig !== undefined) updateData.trigger_config = data.triggerConfig
    if (data.metadata !== undefined) updateData.metadata = data.metadata
    if (data.isDraft !== undefined) updateData.is_draft = data.isDraft
    if (data.isPublished !== undefined) updateData.is_published = data.isPublished
    if (data.publishedAt !== undefined) updateData.published_at = data.publishedAt
    if (data.createdAt !== undefined) updateData.created_at = data.createdAt

    const { data: version, error } = await this.supabase
      .from('workflow_versions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return mapWorkflowVersionFromDb(version)
  }

  async listWorkflowVersions(
    workflowId: string,
    params?: {
      limit?: number
      offset?: number
      includePublished?: boolean
    }
  ) {
    let query = this.supabase
      .from('workflow_versions')
      .select('*', { count: 'exact' })
      .eq('workflow_id', workflowId)

    if (params?.includePublished === false) {
      query = query.eq('is_published', false)
    }

    query = query.order('version', { ascending: false })

    if (params?.limit) {
      query = query.limit(params.limit)
    }

    if (params?.offset) {
      query = query.range(params.offset, params.offset + (params.limit || 100) - 1)
    }

    const { data, error, count } = await query

    if (error) throw error
    return { versions: (data || []).map(mapWorkflowVersionFromDb), total: count || 0 }
  }

  async getMaxVersionNumber(workflowId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('workflow_versions')
      .select('version')
      .eq('workflow_id', workflowId)
      .order('version', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data?.version || 0
  }

  async unpublishAllVersions(workflowId: string, exceptId?: string) {
    let query = this.supabase
      .from('workflow_versions')
      .update({ isPublished: false, publishedAt: null })
      .eq('workflow_id', workflowId)

    if (exceptId) {
      query = query.neq('id', exceptId)
    }

    const { error } = await query
    if (error) throw error
  }

  async publishWorkflowVersion(workflowId: string, versionId: string, userId: string) {
    const now = new Date().toISOString()

    // Note: Supabase doesn't support true transactions, so we'll do our best
    // to maintain consistency with sequential operations

    try {
      // Get the version to publish
      const { data: versionToPublish, error: versionError } = await this.supabase
        .from('workflow_versions')
        .select('*')
        .eq('id', versionId)
        .eq('workflow_id', workflowId)
        .single()

      if (versionError || !versionToPublish) {
        throw new Error('Version not found')
      }

      // Unpublish all other versions
      const { error: unpublishError } = await this.supabase
        .from('workflow_versions')
        .update({ is_published: false, published_at: null })
        .eq('workflow_id', workflowId)
        .neq('id', versionId)

      if (unpublishError) throw unpublishError

      // Publish the specified version
      const { error: publishError } = await this.supabase
        .from('workflow_versions')
        .update({
          is_published: true,
          is_draft: false,
          published_at: now,
        })
        .eq('id', versionId)
        .eq('workflow_id', workflowId)

      if (publishError) throw publishError

      // Update workflow's published version reference
      const { error: workflowError } = await this.supabase
        .from('workflows')
        .update({
          published_version_id: versionId,
          updated_at: now,
        })
        .eq('id', workflowId)

      if (workflowError) throw workflowError

      // Create a new draft version
      const newDraftId =
        'wfv_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 15)
      const nextVersion = versionToPublish.version + 1

      const { error: draftError } = await this.supabase.from('workflow_versions').insert({
        id: newDraftId,
        workflow_id: workflowId,
        name: versionToPublish.name,
        description: versionToPublish.description,
        version: nextVersion,
        is_draft: true,
        is_published: false,
        graphs: versionToPublish.graphs,
        trigger_config: versionToPublish.trigger_config,
        metadata: versionToPublish.metadata,
        user_id: userId,
        created_at: now,
      })

      if (draftError) throw draftError

      // Get updated data
      const { data: workflow } = await this.supabase
        .from('workflows')
        .select('*')
        .eq('id', workflowId)
        .single()

      const { data: version } = await this.supabase
        .from('workflow_versions')
        .select('*')
        .eq('id', versionId)
        .single()

      const { data: newDraftVersion } = await this.supabase
        .from('workflow_versions')
        .select('*')
        .eq('id', newDraftId)
        .single()

      return {
        workflow,
        version,
        newDraftVersion,
      }
    } catch (error) {
      // In a real Supabase implementation, you might want to implement
      // compensating transactions to rollback changes
      throw error
    }
  }

  async unpublishWorkflow(workflowId: string) {
    const now = new Date().toISOString()

    try {
      // Get current published version
      const { data: workflow } = await this.supabase
        .from('workflows')
        .select('published_version_id')
        .eq('id', workflowId)
        .single()

      if (workflow?.published_version_id) {
        // Mark version as unpublished
        const { error: versionError } = await this.supabase
          .from('workflow_versions')
          .update({
            is_published: false,
            published_at: null,
          })
          .eq('id', workflow.published_version_id)

        if (versionError) throw versionError
      }

      // Remove published version reference
      const { error: workflowError } = await this.supabase
        .from('workflows')
        .update({
          published_version_id: null,
          updated_at: now,
        })
        .eq('id', workflowId)

      if (workflowError) throw workflowError
    } catch (error) {
      throw error
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
    const { data: execution, error } = await this.supabase
      .from('workflow_executions')
      .insert({
        id: data.id,
        workflowId: data.workflowId,
        workflowVersionId: data.workflowVersionId,
        status: data.status,
        startedAt: data.startedAt,
        inputData: data.inputData || null,
        userId: data.userId,
      })
      .select()
      .single()

    if (error) throw error
    return execution
  }

  async getWorkflowExecution(id: string) {
    const { data, error } = await this.supabase
      .from('workflow_executions')
      .select('*')
      .eq('id', id)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data || null
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
    const updateData: any = {}

    if (data.status !== undefined) updateData.status = data.status
    if (data.completedAt !== undefined) updateData.completedAt = data.completedAt
    if (data.duration !== undefined) updateData.duration = data.duration
    if (data.outputData !== undefined) updateData.outputData = data.outputData
    if (data.errorMessage !== undefined) updateData.errorMessage = data.errorMessage

    const { data: execution, error } = await this.supabase
      .from('workflow_executions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return execution
  }

  async listWorkflowExecutions(params: {
    workflowId?: string
    status?: string
    limit?: number
    offset?: number
  }) {
    let query = this.supabase.from('workflow_executions').select('*', { count: 'exact' })

    if (params.workflowId) {
      query = query.eq('workflowId', params.workflowId)
    }

    if (params.status) {
      query = query.eq('status', params.status)
    }

    query = query.order('startedAt', { ascending: false })

    if (params.limit) {
      query = query.limit(params.limit)
    }

    if (params.offset) {
      query = query.range(params.offset, params.offset + (params.limit || 100) - 1)
    }

    const { data, error, count } = await query

    if (error) throw error
    return { executions: data || [], total: count || 0 }
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
    const { data: snapshot, error } = await this.supabase
      .from('workflow_snapshots')
      .insert({
        id: data.id,
        workflowId: data.workflowId,
        name: data.name,
        description: data.description || null,
        graphs: data.graphs,
        activeGraphId: data.activeGraphId || null,
        triggerConfig: data.triggerConfig || null,
        metadata: data.metadata || null,
        isDraft: data.isDraft,
        isPublished: data.isPublished,
        saveCount: data.saveCount,
        userId: data.userId,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        lastSavedAt: data.lastSavedAt,
      })
      .select()
      .single()

    if (error) throw error
    return snapshot
  }

  async getWorkflowSnapshot(id: string) {
    const { data, error } = await this.supabase
      .from('workflow_snapshots')
      .select('*')
      .eq('id', id)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data || null
  }

  async updateWorkflowSnapshot(id: string, updates: any) {
    const now = new Date().toISOString()
    const updateData: any = {
      updatedAt: now,
      lastSavedAt: now,
    }

    // Increment saveCount using RPC or by fetching first
    const { data: current } = await this.supabase
      .from('workflow_snapshots')
      .select('saveCount')
      .eq('id', id)
      .single()

    if (current) {
      updateData.saveCount = (current.saveCount || 0) + 1
    }

    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.graphs !== undefined) updateData.graphs = updates.graphs
    if (updates.activeGraphId !== undefined) updateData.activeGraphId = updates.activeGraphId
    if (updates.triggerConfig !== undefined) updateData.triggerConfig = updates.triggerConfig
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata
    if (updates.isDraft !== undefined) updateData.isDraft = updates.isDraft
    if (updates.isPublished !== undefined) updateData.isPublished = updates.isPublished

    const { data, error } = await this.supabase
      .from('workflow_snapshots')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteWorkflowSnapshot(id: string): Promise<boolean> {
    const { error } = await this.supabase.from('workflow_snapshots').delete().eq('id', id)

    if (error) throw error
    return true
  }

  async listWorkflowSnapshots(workflowId: string) {
    const { data, error } = await this.supabase
      .from('workflow_snapshots')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('updatedAt', { ascending: false })

    if (error) throw error
    return data || []
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
    const { data: envVar, error } = await this.supabase
      .from('env_vars')
      .insert({
        id: data.id,
        key: data.key,
        value: data.value,
        isSecret: data.isSecret,
        description: data.description || null,
        category: data.category,
        userId: data.userId,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      })
      .select()
      .single()

    if (error) throw error
    return envVar
  }

  async getEnvVar(id: string) {
    const { data, error } = await this.supabase.from('env_vars').select('*').eq('id', id).single()

    if (error && error.code !== 'PGRST116') throw error
    return data || null
  }

  async getEnvVarByKey(key: string) {
    const { data, error } = await this.supabase.from('env_vars').select('*').eq('key', key).single()

    if (error && error.code !== 'PGRST116') throw error
    return data || null
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
    const updateData: any = { updatedAt: data.updatedAt }

    if (data.key !== undefined) updateData.key = data.key
    if (data.value !== undefined) updateData.value = data.value
    if (data.isSecret !== undefined) updateData.isSecret = data.isSecret
    if (data.description !== undefined) updateData.description = data.description
    if (data.category !== undefined) updateData.category = data.category

    const { data: envVar, error } = await this.supabase
      .from('env_vars')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return envVar
  }

  async deleteEnvVar(id: string): Promise<boolean> {
    const { error } = await this.supabase.from('env_vars').delete().eq('id', id)

    if (error) throw error
    return true
  }

  async listEnvVars(params?: { category?: string; limit?: number; offset?: number }) {
    let query = this.supabase.from('env_vars').select('*', { count: 'exact' })

    if (params?.category) {
      query = query.eq('category', params.category)
    }

    query = query.order('key', { ascending: true })

    if (params?.limit) {
      query = query.limit(params.limit)
    }

    if (params?.offset) {
      query = query.range(params.offset, params.offset + (params.limit || 100) - 1)
    }

    const { data, error, count } = await query

    if (error) throw error
    return { data: data || [], total: count || 0 }
  }

  async checkSecretExists(key: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('env_vars')
      .select('id')
      .eq('key', key)
      .eq('isSecret', true)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return !!data
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
    const { data: session, error } = await this.supabase
      .from('flow_trace_sessions')
      .insert({
        id: data.id,
        workflowId: data.workflowId,
        workflowVersionId: data.workflowVersionId || null,
        workflowName: data.workflowName,
        startTime: data.startTime,
        status: data.status,
        summary: data.summary || null,
        userId: data.userId,
        createdAt: data.createdAt,
      })
      .select()
      .single()

    if (error) throw error
    return session
  }

  async getFlowTraceSession(id: string) {
    const { data, error } = await this.supabase
      .from('flow_trace_sessions')
      .select('*')
      .eq('id', id)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data || null
  }

  async updateFlowTraceSession(
    id: string,
    data: {
      endTime?: string
      status?: string
      summary?: string
    }
  ) {
    const updateData: any = {}

    if (data.endTime !== undefined) updateData.endTime = data.endTime
    if (data.status !== undefined) updateData.status = data.status
    if (data.summary !== undefined) updateData.summary = data.summary

    const { data: session, error } = await this.supabase
      .from('flow_trace_sessions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return session
  }

  async createFlowTrace(data: any) {
    const { data: trace, error } = await this.supabase
      .from('flow_traces')
      .insert({
        id: data.id,
        sessionId: data.sessionId,
        timestamp: data.timestamp,
        duration: data.duration,
        status: data.status,
        sourceNodeId: data.sourceNodeId,
        sourceNodeName: data.sourceNodeName,
        sourceNodeType: data.sourceNodeType,
        sourcePortId: data.sourcePortId,
        sourcePortName: data.sourcePortName,
        sourcePortType: data.sourcePortType,
        targetNodeId: data.targetNodeId,
        targetNodeName: data.targetNodeName,
        targetNodeType: data.targetNodeType,
        targetPortId: data.targetPortId,
        targetPortName: data.targetPortName,
        targetPortType: data.targetPortType,
        dataPayload: data.dataPayload || null,
        dataSize: data.dataSize,
        dataType: data.dataType,
        dataPreview: data.dataPreview || null,
        errorMessage: data.errorMessage || null,
        errorCode: data.errorCode || null,
        errorStack: data.errorStack || null,
        graphId: data.graphId || null,
        graphName: data.graphName || null,
        parentTraceId: data.parentTraceId || null,
        depth: data.depth || 0,
        createdAt: data.createdAt,
      })
      .select()
      .single()

    if (error) throw error
    return trace
  }

  async getFlowTrace(id: string) {
    const { data, error } = await this.supabase
      .from('flow_traces')
      .select('*')
      .eq('id', id)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data || null
  }

  async listFlowTraces(
    sessionId: string,
    params?: {
      status?: string
      limit?: number
      offset?: number
    }
  ) {
    let query = this.supabase
      .from('flow_traces')
      .select('*', { count: 'exact' })
      .eq('sessionId', sessionId)

    if (params?.status) {
      query = query.eq('status', params.status)
    }

    query = query.order('timestamp', { ascending: true })

    if (params?.limit) {
      query = query.limit(params.limit)
    }

    if (params?.offset) {
      query = query.range(params.offset, params.offset + (params.limit || 100) - 1)
    }

    const { data, error, count } = await query

    if (error) throw error
    return { traces: data || [], total: count || 0 }
  }

  // Transaction support - Supabase doesn't have real transactions
  async beginTransaction(): Promise<TransactionOperations> {
    // Return a wrapper that queues operations
    return new SupabaseTransactionOperations(this.supabase)
  }
}

// Supabase "transaction" implementation
// Note: This doesn't provide true ACID transactions, but simulates the interface
class SupabaseTransactionOperations extends SupabaseOperations implements TransactionOperations {
  private operations: Array<() => Promise<any>> = []

  constructor(supabase: ReturnType<typeof createServerClient>) {
    super()
  }

  async commit() {
    // Execute all queued operations
    // In a real implementation, you might want to handle rollback on failure
    for (const op of this.operations) {
      await op()
    }
  }

  async rollback() {
    // Clear operations without executing
    this.operations = []
    console.warn('Supabase does not support true transactions - rollback is a no-op')
  }

  release() {
    // No-op for Supabase
  }
}
