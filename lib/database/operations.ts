// Clean database operations interface
// No SQL parsing - just specific methods that each provider implements natively

export interface WorkflowOperations {
  // Workflow CRUD
  createWorkflow(data: {
    id: string
    name: string
    description?: string
    userId: string
    createdAt: string
    updatedAt: string
  }): Promise<any>

  getWorkflow(id: string): Promise<any | null>

  updateWorkflow(id: string, data: {
    name?: string
    description?: string
    publishedVersionId?: string | null
    updatedAt: string
  }): Promise<any>

  deleteWorkflow(id: string): Promise<void>

  listWorkflows(params: {
    userId?: string
    limit?: number
    offset?: number
    searchTerm?: string
  }): Promise<{ workflows: any[]; total: number }>

  // Workflow Version CRUD
  createWorkflowVersion(data: {
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
  }): Promise<any>

  getWorkflowVersion(id: string): Promise<any | null>

  updateWorkflowVersion(id: string, data: {
    name?: string
    description?: string
    graphs?: string
    triggerConfig?: string
    metadata?: string
    isDraft?: boolean
    isPublished?: boolean
    publishedAt?: string | null
    createdAt?: string
  }): Promise<any>

  listWorkflowVersions(workflowId: string, params?: {
    limit?: number
    offset?: number
    includePublished?: boolean
  }): Promise<{ versions: any[]; total: number }>

  getMaxVersionNumber(workflowId: string): Promise<number>

  unpublishAllVersions(workflowId: string, exceptId?: string): Promise<void>

  publishWorkflowVersion(workflowId: string, versionId: string, userId: string): Promise<{
    workflow: any
    version: any
    newDraftVersion: any
  }>

  unpublishWorkflow(workflowId: string): Promise<void>

  // Workflow Execution CRUD
  createWorkflowExecution(data: {
    id: string
    workflowId: string
    workflowVersionId: string
    status: string
    startedAt: string
    inputData?: string
    userId: string
  }): Promise<any>

  getWorkflowExecution(id: string): Promise<any | null>

  updateWorkflowExecution(id: string, data: {
    status?: string
    completedAt?: string
    duration?: number
    outputData?: string
    errorMessage?: string
  }): Promise<any>

  listWorkflowExecutions(params: {
    workflowId?: string
    status?: string
    limit?: number
    offset?: number
  }): Promise<{ executions: any[]; total: number }>

  // Workflow Snapshot CRUD
  createWorkflowSnapshot(data: {
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
  }): Promise<any>

  getWorkflowSnapshot(id: string): Promise<any | null>

  updateWorkflowSnapshot(id: string, updates: any): Promise<any | null>

  deleteWorkflowSnapshot(id: string): Promise<boolean>

  listWorkflowSnapshots(workflowId: string): Promise<any[]>

  // Environment Variables CRUD
  createEnvVar(data: {
    id: string
    key: string
    value: string
    isSecret: boolean
    description?: string
    category: string
    userId: string
    createdAt: string
    updatedAt: string
  }): Promise<any>

  getEnvVar(id: string): Promise<any | null>

  getEnvVarByKey(key: string): Promise<any | null>

  updateEnvVar(id: string, data: {
    key?: string
    value?: string
    isSecret?: boolean
    description?: string
    category?: string
    updatedAt: string
  }): Promise<any>

  deleteEnvVar(id: string): Promise<boolean>

  listEnvVars(params?: {
    category?: string
    limit?: number
    offset?: number
  }): Promise<{ data: any[]; total: number }>

  checkSecretExists(key: string): Promise<boolean>

  // Flow Trace CRUD
  createFlowTraceSession(data: {
    id: string
    workflowId: string
    workflowVersionId?: string
    workflowName: string
    startTime: string
    status: string
    summary?: string
    userId: string
    createdAt: string
  }): Promise<any>

  getFlowTraceSession(id: string): Promise<any | null>

  updateFlowTraceSession(id: string, data: {
    endTime?: string
    status?: string
    summary?: string
  }): Promise<any>

  createFlowTrace(data: any): Promise<any>

  getFlowTrace(id: string): Promise<any | null>

  listFlowTraces(sessionId: string, params?: {
    status?: string
    limit?: number
    offset?: number
  }): Promise<{ traces: any[]; total: number }>

  // Transaction support
  beginTransaction(): Promise<TransactionOperations>
}

export interface TransactionOperations extends WorkflowOperations {
  commit(): Promise<void>
  rollback(): Promise<void>
  release(): void
  // For legacy compatibility with withTransaction
  query?(text: string, params?: any[]): Promise<{ rows: any[]; rowCount?: number }>
}

// Helper to check if we should use Supabase
export function useSupabase(): boolean {
  return process.env.USE_SUPABASE === 'true'
}