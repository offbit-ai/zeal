import { apiClient } from './apiClient'
import type {
  WorkflowResponse,
  WorkflowCreateRequest,
  WorkflowUpdateRequest,
  WorkflowExecutionRequest,
  WorkflowExecutionResponse,
  WorkflowNodeData,
  WorkflowConnectionData,
} from '@/types/api'
import type { WorkflowSnapshot, WorkflowGraph } from '@/types/snapshot'

export class WorkflowService {
  private static cache: Map<string, WorkflowResponse> = new Map()
  private static listCache: { data: WorkflowResponse[]; timestamp: number } | null = null
  private static CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  // Convert API response to frontend workflow format
  private static convertToWorkflow(apiWorkflow: any): WorkflowSnapshot {
    // Handle both old format (nodes/connections) and new format (graphs)
    let graphs: WorkflowGraph[]

    if (apiWorkflow.graphs) {
      graphs = apiWorkflow.graphs
    } else if (apiWorkflow.nodes && apiWorkflow.connections) {
      // Convert old format to new format
      graphs = [
        {
          id: 'main',
          name: 'Main',
          namespace: 'main',
          isMain: true,
          nodes: apiWorkflow.nodes,
          connections: apiWorkflow.connections,
          groups: apiWorkflow.groups || [],
        },
      ]
    } else {
      graphs = []
    }

    return {
      id: apiWorkflow.id,
      name: apiWorkflow.name,
      description: apiWorkflow.description,
      graphs,
      activeGraphId: apiWorkflow.activeGraphId || 'main',
      triggerConfig: apiWorkflow.triggerConfig,
      metadata: apiWorkflow.metadata || {},
      createdAt: apiWorkflow.createdAt,
      updatedAt: apiWorkflow.updatedAt,
      lastSavedAt: apiWorkflow.lastSavedAt || apiWorkflow.updatedAt,
      saveCount: apiWorkflow.saveCount || 0,
      isDraft: apiWorkflow.isDraft !== undefined ? apiWorkflow.isDraft : true,
      isPublished: apiWorkflow.isPublished || false,
      publishedAt: apiWorkflow.publishedAt,
    }
  }

  // Convert frontend workflow to API request format
  private static convertToApiRequest(workflow: Partial<WorkflowSnapshot>): any {
    // Ensure we have valid data before sending
    if (!workflow.name || !workflow.graphs) {
      console.error('[WorkflowService] Invalid workflow data for API request:', workflow)
      throw new Error('Workflow must have name and graphs')
    }

    return {
      name: workflow.name,
      description: workflow.description || '',
      graphs: workflow.graphs,
      activeGraphId: workflow.activeGraphId || 'main',
      triggerConfig: workflow.triggerConfig || null,
      metadata: workflow.metadata || {},
    }
  }

  static async getWorkflows(params?: {
    page?: number
    limit?: number
    status?: 'draft' | 'published'
    search?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }): Promise<{
    workflows: WorkflowSnapshot[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }> {
    const response = await apiClient.getPaginated<WorkflowResponse>('/workflows', {
      page: params?.page || 1,
      limit: params?.limit || 20,
      status: params?.status,
      search: params?.search,
      sortBy: params?.sortBy || 'updatedAt',
      sortOrder: params?.sortOrder || 'desc',
    })

    // Update cache
    response.data.forEach(workflow => {
      this.cache.set(workflow.id, workflow)
    })

    return {
      workflows: response.data.map(this.convertToWorkflow),
      pagination: response.pagination,
    }
  }

  static async getWorkflow(id: string): Promise<WorkflowSnapshot | null> {
    try {
      // Check cache first
      const cached = this.cache.get(id)
      if (cached) {
        return this.convertToWorkflow(cached)
      }

      const workflow = await apiClient.get<WorkflowResponse>(`/workflows/${id}`)

      // Update cache
      this.cache.set(id, workflow)

      return this.convertToWorkflow(workflow)
    } catch (error) {
      console.error(`Failed to fetch workflow ${id}:`, error)

      // Fall back to localStorage
      return this.getWorkflowFromLocal(id)
    }
  }

  static async createWorkflow(workflow: Partial<WorkflowSnapshot>): Promise<WorkflowSnapshot> {
    const request = this.convertToApiRequest(workflow)
    const created = await apiClient.post<WorkflowResponse>('/workflows', request)

    // Update cache
    this.cache.set(created.id, created)
    this.listCache = null // Invalidate list cache

    return this.convertToWorkflow(created)
  }

  static async updateWorkflow(
    id: string,
    updates: Partial<WorkflowSnapshot>
  ): Promise<WorkflowSnapshot> {
    const request = this.convertToApiRequest(updates)
    const updated = await apiClient.put<WorkflowResponse>(`/workflows/${id}`, request)

    // Update cache
    this.cache.set(id, updated)
    this.listCache = null // Invalidate list cache

    return this.convertToWorkflow(updated)
  }

  static async deleteWorkflow(id: string): Promise<boolean> {
    await apiClient.delete(`/workflows/${id}`)

    // Remove from cache
    this.cache.delete(id)
    this.listCache = null // Invalidate list cache

    return true
  }

  static async publishWorkflow(id: string): Promise<WorkflowSnapshot> {
    try {
      const published = await apiClient.post<WorkflowResponse>(`/workflows/${id}/publish`)

      // Update cache
      this.cache.set(id, published)
      this.listCache = null // Invalidate list cache

      return this.convertToWorkflow(published)
    } catch (error) {
      console.error(`Failed to publish workflow ${id}:`, error)
      throw error
    }
  }

  static async unpublishWorkflow(id: string): Promise<WorkflowSnapshot> {
    try {
      const unpublished = await apiClient.delete<WorkflowResponse>(`/workflows/${id}/publish`)

      // Update cache
      this.cache.set(id, unpublished)
      this.listCache = null // Invalidate list cache

      return this.convertToWorkflow(unpublished)
    } catch (error) {
      console.error(`Failed to unpublish workflow ${id}:`, error)
      throw error
    }
  }

  static async executeWorkflow(
    id: string,
    input?: any,
    configuration?: Record<string, any>
  ): Promise<WorkflowExecutionResponse> {
    try {
      const request: WorkflowExecutionRequest = {
        workflowId: id,
        input,
        configuration,
      }

      const execution = await apiClient.post<WorkflowExecutionResponse>(
        `/workflows/${id}/execute`,
        request
      )

      return execution
    } catch (error) {
      console.error(`Failed to execute workflow ${id}:`, error)
      throw error
    }
  }

  static async getExecutionHistory(id: string, limit = 20): Promise<WorkflowExecutionResponse[]> {
    try {
      const executions = await apiClient.get<WorkflowExecutionResponse[]>(
        `/workflows/${id}/execute`,
        { limit }
      )

      return executions
    } catch (error) {
      console.error(`Failed to get execution history for workflow ${id}:`, error)
      return []
    }
  }

  // Snapshot/history methods for backward compatibility
  static async saveWorkflowSnapshot(workflow: WorkflowSnapshot): Promise<string> {
    try {
      // If workflow already exists, update it; otherwise create new
      if (workflow.id) {
        await this.updateWorkflow(workflow.id, workflow)
        return workflow.id
      } else {
        const created = await this.createWorkflow(workflow)
        return created.id
      }
    } catch (error) {
      console.error('Failed to save workflow snapshot:', error)

      // Fall back to localStorage
      return this.saveWorkflowSnapshotLocal(workflow)
    }
  }

  static async getWorkflowHistory(): Promise<WorkflowSnapshot[]> {
    try {
      const response = await this.getWorkflows({ limit: 100 })
      return response.workflows.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
    } catch (error) {
      console.error('Failed to get workflow history:', error)
      return this.getWorkflowHistoryLocal()
    }
  }

  // Local storage fallback methods
  private static getWorkflowsFromLocal(): {
    workflows: WorkflowSnapshot[]
    pagination: { page: number; limit: number; total: number; totalPages: number }
  } {
    try {
      const stored = localStorage.getItem('zeal_workflows')
      const workflows: WorkflowSnapshot[] = stored ? JSON.parse(stored) : []

      return {
        workflows,
        pagination: {
          page: 1,
          limit: workflows.length,
          total: workflows.length,
          totalPages: 1,
        },
      }
    } catch (error) {
      console.error('Failed to get workflows from localStorage:', error)
      return {
        workflows: [],
        pagination: { page: 1, limit: 0, total: 0, totalPages: 0 },
      }
    }
  }

  private static getWorkflowFromLocal(id: string): WorkflowSnapshot | null {
    try {
      const stored = localStorage.getItem('zeal_workflows')
      const workflows: WorkflowSnapshot[] = stored ? JSON.parse(stored) : []
      return workflows.find(w => w.id === id) || null
    } catch (error) {
      console.error('Failed to get workflow from localStorage:', error)
      return null
    }
  }

  private static createWorkflowLocal(workflow: Partial<WorkflowSnapshot>): WorkflowSnapshot {
    const newWorkflow: WorkflowSnapshot = {
      id: `wf_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      name: workflow.name || 'Untitled Workflow',
      description: workflow.description,
      graphs: workflow.graphs || [
        {
          id: 'main',
          name: 'Main',
          namespace: 'main',
          isMain: true,
          nodes: [],
          connections: [],
          groups: [],
        },
      ],
      triggerConfig: workflow.triggerConfig,
      metadata: workflow.metadata || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
      saveCount: 0,
      isDraft: true,
      isPublished: false,
    }

    try {
      const stored = localStorage.getItem('zeal_workflows')
      const workflows: WorkflowSnapshot[] = stored ? JSON.parse(stored) : []
      workflows.push(newWorkflow)
      localStorage.setItem('zeal_workflows', JSON.stringify(workflows))
    } catch (error) {
      console.error('Failed to save workflow to localStorage:', error)
    }

    return newWorkflow
  }

  private static updateWorkflowLocal(
    id: string,
    updates: Partial<WorkflowSnapshot>
  ): WorkflowSnapshot {
    try {
      const stored = localStorage.getItem('zeal_workflows')
      const workflows: WorkflowSnapshot[] = stored ? JSON.parse(stored) : []
      const index = workflows.findIndex(w => w.id === id)

      if (index !== -1) {
        workflows[index] = {
          ...workflows[index],
          ...updates,
          updatedAt: new Date().toISOString(),
        }
        localStorage.setItem('zeal_workflows', JSON.stringify(workflows))
        return workflows[index]
      }
    } catch (error) {
      console.error('Failed to update workflow in localStorage:', error)
    }

    throw new Error(`Workflow ${id} not found in localStorage`)
  }

  private static deleteWorkflowLocal(id: string): boolean {
    try {
      const stored = localStorage.getItem('zeal_workflows')
      const workflows: WorkflowSnapshot[] = stored ? JSON.parse(stored) : []
      const filtered = workflows.filter(w => w.id !== id)

      if (filtered.length !== workflows.length) {
        localStorage.setItem('zeal_workflows', JSON.stringify(filtered))
        return true
      }
    } catch (error) {
      console.error('Failed to delete workflow from localStorage:', error)
    }

    return false
  }

  private static saveWorkflowSnapshotLocal(workflow: WorkflowSnapshot): string {
    const id = workflow.id || `wf_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    const snapshot = {
      ...workflow,
      id,
      updatedAt: new Date().toISOString(),
    }

    try {
      const stored = localStorage.getItem('zeal_workflows')
      const workflows: WorkflowSnapshot[] = stored ? JSON.parse(stored) : []
      const index = workflows.findIndex(w => w.id === id)

      if (index !== -1) {
        workflows[index] = snapshot
      } else {
        workflows.push(snapshot)
      }

      localStorage.setItem('zeal_workflows', JSON.stringify(workflows))
    } catch (error) {
      console.error('Failed to save workflow snapshot to localStorage:', error)
    }

    return id
  }

  private static getWorkflowHistoryLocal(): WorkflowSnapshot[] {
    try {
      const stored = localStorage.getItem('zeal_workflows')
      const workflows: WorkflowSnapshot[] = stored ? JSON.parse(stored) : []
      return workflows.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
    } catch (error) {
      console.error('Failed to get workflow history from localStorage:', error)
      return []
    }
  }

  // Clear cache (useful for testing or when user logs out)
  static clearCache(): void {
    this.cache.clear()
    this.listCache = null
  }
}
