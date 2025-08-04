import type { WorkflowSnapshot } from '@/types/snapshot'
import { WorkflowService } from './workflowService'

const STORAGE_KEY = 'zeal_workflows'
const CURRENT_WORKFLOW_KEY = 'zeal_current_workflow_id'

export class WorkflowStorageService {
  // Get all workflows from API (with localStorage fallback)
  static async getAllWorkflows(): Promise<WorkflowSnapshot[]> {
    try {
      const response = await WorkflowService.getWorkflows({ limit: 100 })
      return response.workflows
    } catch (error) {
      console.error('Error loading workflows from API, falling back to localStorage:', error)
      // Fallback to localStorage
      try {
        const data = localStorage.getItem(STORAGE_KEY)
        return data ? JSON.parse(data) : []
      } catch (localError) {
        console.error('Error loading workflows from localStorage:', localError)
        return []
      }
    }
  }

  // Get a specific workflow by ID from API (with localStorage fallback)
  static async getWorkflow(id: string): Promise<WorkflowSnapshot | null> {
    try {
      return await WorkflowService.getWorkflow(id)
    } catch (error) {
      console.error('Error loading workflow from API, falling back to localStorage:', error)
      // Fallback to localStorage
      try {
        const data = localStorage.getItem(STORAGE_KEY)
        const workflows: WorkflowSnapshot[] = data ? JSON.parse(data) : []
        return workflows.find(w => w.id === id) || null
      } catch (localError) {
        console.error('Error loading workflow from localStorage:', localError)
        return null
      }
    }
  }

  // Save or update a workflow via API (with localStorage fallback)
  static async saveWorkflow(workflow: WorkflowSnapshot): Promise<WorkflowSnapshot> {
    try {
      if (workflow.id) {
        // Update existing workflow
        return await WorkflowService.updateWorkflow(workflow.id, workflow)
      } else {
        // Create new workflow
        return await WorkflowService.createWorkflow(workflow)
      }
    } catch (error) {
      console.error('Error saving workflow to API, falling back to localStorage:', error)
      // Fallback to localStorage
      try {
        const data = localStorage.getItem(STORAGE_KEY)
        const workflows: WorkflowSnapshot[] = data ? JSON.parse(data) : []

        // When saving a published workflow, we keep both the draft and published versions
        if (workflow.isPublished) {
          // Add as a new published version (keep the same ID)
          workflows.push(workflow)
        } else {
          // For drafts, update the existing draft or add new
          const existingDraftIndex = workflows.findIndex(
            w => w.id === workflow.id && w.isDraft && !w.isPublished
          )

          if (existingDraftIndex >= 0) {
            // Update existing draft
            workflows[existingDraftIndex] = {
              ...workflow,
              updatedAt: new Date().toISOString(),
            }
          } else {
            // Add new draft - generate ID if needed
            if (!workflow.id) {
              workflow.id = `wf_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
            }
            workflows.push(workflow)
          }
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(workflows))

        // Set as current workflow
        this.setCurrentWorkflowId(workflow.id)

        // Return the workflow
        return workflow
      } catch (localError) {
        console.error('Error saving workflow to localStorage:', localError)
        throw new Error('Failed to save workflow')
      }
    }
  }

  // Delete a workflow via API (with localStorage fallback)
  static async deleteWorkflow(id: string): Promise<void> {
    try {
      await WorkflowService.deleteWorkflow(id)

      // Clear current workflow if it was deleted
      if (this.getCurrentWorkflowId() === id) {
        this.clearCurrentWorkflowId()
      }
    } catch (error) {
      console.error('Error deleting workflow from API, falling back to localStorage:', error)
      // Fallback to localStorage
      try {
        const data = localStorage.getItem(STORAGE_KEY)
        const workflows: WorkflowSnapshot[] = data ? JSON.parse(data) : []
        const filtered = workflows.filter(w => w.id !== id)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))

        // Clear current workflow if it was deleted
        if (this.getCurrentWorkflowId() === id) {
          this.clearCurrentWorkflowId()
        }
      } catch (localError) {
        console.error('Error deleting workflow from localStorage:', localError)
        throw new Error('Failed to delete workflow')
      }
    }
  }

  // Get the current workflow ID
  static getCurrentWorkflowId(): string | null {
    return localStorage.getItem(CURRENT_WORKFLOW_KEY)
  }

  // Set the current workflow ID
  static setCurrentWorkflowId(id: string): void {
    localStorage.setItem(CURRENT_WORKFLOW_KEY, id)
  }

  // Clear the current workflow ID
  static clearCurrentWorkflowId(): void {
    localStorage.removeItem(CURRENT_WORKFLOW_KEY)
  }

  // Create a new draft workflow
  static async createDraftWorkflow(name: string = 'Untitled Workflow'): Promise<WorkflowSnapshot> {
    const now = new Date().toISOString()
    const workflow: Partial<WorkflowSnapshot> = {
      name,
      description: '',
      createdAt: now,
      updatedAt: now,
      lastSavedAt: now,
      saveCount: 0,
      isDraft: true,
      isPublished: false,
      graphs: [
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
      metadata: {
        version: '1.0.0',
        tags: ['draft'],
        totalNodeCount: 0,
        totalConnectionCount: 0,
        totalGroupCount: 0,
        graphCount: 1,
      },
    }

    // Create new workflow via API - let backend generate ID
    const created = await WorkflowService.createWorkflow(workflow)
    return created
  }

  // Get workflow history (for future use)
  static async getWorkflowHistory(limit: number = 10): Promise<WorkflowSnapshot[]> {
    try {
      const response = await WorkflowService.getWorkflows({
        limit,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      })
      return response.workflows
    } catch (error) {
      console.error('Error loading workflow history from API, falling back to localStorage:', error)
      // Fallback to localStorage
      const data = localStorage.getItem(STORAGE_KEY)
      const workflows: WorkflowSnapshot[] = data ? JSON.parse(data) : []
      return workflows
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, limit)
    }
  }

  // Search workflows by name or description
  static async searchWorkflows(query: string): Promise<WorkflowSnapshot[]> {
    try {
      const response = await WorkflowService.getWorkflows({ search: query, limit: 50 })
      return response.workflows
    } catch (error) {
      console.error('Error searching workflows from API, falling back to localStorage:', error)
      // Fallback to localStorage
      const data = localStorage.getItem(STORAGE_KEY)
      const workflows: WorkflowSnapshot[] = data ? JSON.parse(data) : []
      const lowerQuery = query.toLowerCase()

      return workflows.filter(
        w =>
          w.name.toLowerCase().includes(lowerQuery) ||
          (w.description && w.description.toLowerCase().includes(lowerQuery))
      )
    }
  }

  // Export workflow as JSON
  static async exportWorkflow(id: string): Promise<string | null> {
    const workflow = await this.getWorkflow(id)
    if (!workflow) return null

    return JSON.stringify(workflow, null, 2)
  }

  // Import workflow from JSON
  static async importWorkflow(jsonString: string): Promise<WorkflowSnapshot> {
    try {
      const workflow = JSON.parse(jsonString) as WorkflowSnapshot
      // Generate new ID to avoid conflicts
      workflow.id = crypto.randomUUID()
      workflow.createdAt = new Date().toISOString()
      workflow.updatedAt = new Date().toISOString()
      workflow.name = `${workflow.name} (Imported)`

      await this.saveWorkflow(workflow)
      return workflow
    } catch (error) {
      console.error('Error importing workflow:', error)
      throw new Error('Invalid workflow JSON')
    }
  }

  // Publish a workflow (creates a published version)
  static async publishWorkflow(workflowId: string): Promise<WorkflowSnapshot | null> {
    try {
      return await WorkflowService.publishWorkflow(workflowId)
    } catch (error) {
      console.error('Error publishing workflow via API, falling back to localStorage:', error)
      // Fallback to localStorage
      const workflow = await this.getWorkflow(workflowId)
      if (!workflow) return null

      const now = new Date().toISOString()
      const publishedWorkflow: WorkflowSnapshot = {
        ...workflow,
        isDraft: false,
        isPublished: true,
        publishedAt: now,
        updatedAt: now,
        lastSavedAt: now,
        saveCount: workflow.saveCount + 1,
      }

      await this.saveWorkflow(publishedWorkflow)
      return publishedWorkflow
    }
  }

  // Get version history for a workflow (all versions with same ID)
  static async getWorkflowVersions(workflowId: string): Promise<WorkflowSnapshot[]> {
    const workflows = await this.getAllWorkflows()
    return workflows
      .filter(w => w.id === workflowId)
      .sort((a, b) => {
        // Sort by updatedAt descending (newest first)
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      })
  }

  // Get the latest draft version of a workflow
  static async getLatestDraft(workflowId: string): Promise<WorkflowSnapshot | null> {
    const versions = await this.getWorkflowVersions(workflowId)
    return versions.find(v => v.isDraft && !v.isPublished) || null
  }

  // Get all published versions of a workflow
  static async getPublishedVersions(workflowId: string): Promise<WorkflowSnapshot[]> {
    const versions = await this.getWorkflowVersions(workflowId)
    return versions.filter(v => v.isPublished)
  }

  // Rollback to a specific version
  static async rollbackToVersion(
    workflowId: string,
    versionTimestamp: string
  ): Promise<WorkflowSnapshot | null> {
    const versions = await this.getWorkflowVersions(workflowId)
    const targetVersion = versions.find(v => v.updatedAt === versionTimestamp)

    if (!targetVersion || !targetVersion.isPublished) {
      console.error('Can only rollback to published versions')
      return null
    }

    // Create a new draft based on the published version
    const now = new Date().toISOString()
    const rolledBackWorkflow: WorkflowSnapshot = {
      ...targetVersion,
      isDraft: true,
      isPublished: false,
      publishedAt: undefined,
      updatedAt: now,
      lastSavedAt: now,
      saveCount: 0, // Reset save count for the new draft
      name: targetVersion.name, // Keep the same name
    }

    // Remove any existing draft for this workflow ID
    const workflows = await this.getAllWorkflows()
    const filteredWorkflows = workflows.filter(
      w => !(w.id === workflowId && w.isDraft && !w.isPublished)
    )
    filteredWorkflows.push(rolledBackWorkflow)

    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredWorkflows))
    this.setCurrentWorkflowId(workflowId)

    return rolledBackWorkflow
  }
}
