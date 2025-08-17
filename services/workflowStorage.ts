import type { WorkflowSnapshot } from '@/types/snapshot'
import { WorkflowService } from './workflowService'

// No more localStorage - API/Database is the single source of truth

export class WorkflowStorageService {
  // Get all workflows from API/Database
  static async getAllWorkflows(): Promise<WorkflowSnapshot[]> {
    try {
      // Use API to get workflows
      const response = await WorkflowService.getWorkflows({ limit: 100 })
      return response.workflows
    } catch (error) {
      console.error('Error loading workflows from API/Database:', error)
      // No localStorage fallback - throw error to handle upstream
      throw error
    }
  }

  // Get a specific workflow by ID from API/Database
  static async getWorkflow(id: string): Promise<WorkflowSnapshot | null> {
    try {
      // Use API to get workflow
      return await WorkflowService.getWorkflow(id)
    } catch (error) {
      console.error('Error loading workflow from API/Database:', error)
      // No localStorage fallback - throw error to handle upstream
      throw error
    }
  }

  // Save or update a workflow via API/Database
  static async saveWorkflow(workflow: WorkflowSnapshot): Promise<WorkflowSnapshot> {
    try {
      // Use API to save workflow
      let result: WorkflowSnapshot
      if (workflow.id) {
        // Update existing workflow
        result = await WorkflowService.updateWorkflow(workflow.id, workflow)
      } else {
        // Create new workflow
        result = await WorkflowService.createWorkflow(workflow)
      }

      // No need to set current workflow in localStorage anymore

      return result
    } catch (error) {
      console.error('Error saving workflow to API:', error)
      // No localStorage fallback - throw error to handle upstream
      throw error
    }
  }

  // Delete a workflow via API
  static async deleteWorkflow(id: string): Promise<void> {
    try {
      await WorkflowService.deleteWorkflow(id)

      // No need to clear localStorage anymore
    } catch (error) {
      console.error('Error deleting workflow from API:', error)
      // No localStorage fallback - throw error to handle upstream
      throw error
    }
  }

  // Removed localStorage methods - no longer storing workflow ID locally
  // API/Database is the single source of truth

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
      console.error('Error loading workflow history from API:', error)
      // No localStorage fallback - throw error to handle upstream
      throw error
    }
  }

  // Search workflows by name or description
  static async searchWorkflows(query: string): Promise<WorkflowSnapshot[]> {
    try {
      // Use API to search workflows
      const response = await WorkflowService.getWorkflows({ search: query, limit: 50 })
      return response.workflows
    } catch (error) {
      console.error('Error searching workflows from API:', error)
      // No localStorage fallback - throw error to handle upstream
      throw error
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
    // Get workflow versions from all workflows
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
    // Save the rolled back workflow via API
    const saved = await this.saveWorkflow(rolledBackWorkflow)
    return saved
  }
}
