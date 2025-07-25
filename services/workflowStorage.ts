import type { WorkflowSnapshot } from '@/types/snapshot'

const STORAGE_KEY = 'zeal_workflows'
const CURRENT_WORKFLOW_KEY = 'zeal_current_workflow_id'

export class WorkflowStorageService {
  // Get all workflows from localStorage
  static getAllWorkflows(): WorkflowSnapshot[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.error('Error loading workflows:', error)
      return []
    }
  }

  // Get a specific workflow by ID
  static getWorkflow(id: string): WorkflowSnapshot | null {
    const workflows = this.getAllWorkflows()
    return workflows.find(w => w.id === id) || null
  }

  // Save or update a workflow
  static saveWorkflow(workflow: WorkflowSnapshot): void {
    try {
      const workflows = this.getAllWorkflows()
      
      // When saving a published workflow, we keep both the draft and published versions
      if (workflow.isPublished) {
        // Add as a new published version (keep the same ID)
        workflows.push(workflow)
      } else {
        // For drafts, update the existing draft or add new
        const existingDraftIndex = workflows.findIndex(w => 
          w.id === workflow.id && w.isDraft && !w.isPublished
        )
        
        if (existingDraftIndex >= 0) {
          // Update existing draft
          workflows[existingDraftIndex] = {
            ...workflow,
            updatedAt: new Date().toISOString()
          }
        } else {
          // Add new draft
          workflows.push(workflow)
        }
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workflows))
      
      // Set as current workflow
      this.setCurrentWorkflowId(workflow.id)
    } catch (error) {
      console.error('Error saving workflow:', error)
      throw new Error('Failed to save workflow')
    }
  }

  // Delete a workflow
  static deleteWorkflow(id: string): void {
    try {
      const workflows = this.getAllWorkflows()
      const filtered = workflows.filter(w => w.id !== id)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
      
      // Clear current workflow if it was deleted
      if (this.getCurrentWorkflowId() === id) {
        this.clearCurrentWorkflowId()
      }
    } catch (error) {
      console.error('Error deleting workflow:', error)
      throw new Error('Failed to delete workflow')
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
  static createDraftWorkflow(name: string = 'Untitled Workflow'): WorkflowSnapshot {
    const now = new Date().toISOString()
    const workflow: WorkflowSnapshot = {
      id: crypto.randomUUID(),
      name,
      description: '',
      createdAt: now,
      updatedAt: now,
      lastSavedAt: now,
      saveCount: 0,
      isDraft: true,
      isPublished: false,
      nodes: [],
      connections: [],
      metadata: {
        version: '1.0.0',
        tags: ['draft'],
        nodeCount: 0,
        connectionCount: 0
      }
    }
    
    this.saveWorkflow(workflow)
    return workflow
  }

  // Get workflow history (for future use)
  static getWorkflowHistory(limit: number = 10): WorkflowSnapshot[] {
    const workflows = this.getAllWorkflows()
    // Sort by updatedAt descending and return limited results
    return workflows
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit)
  }

  // Search workflows by name or description
  static searchWorkflows(query: string): WorkflowSnapshot[] {
    const workflows = this.getAllWorkflows()
    const lowerQuery = query.toLowerCase()
    
    return workflows.filter(w => 
      w.name.toLowerCase().includes(lowerQuery) ||
      (w.description && w.description.toLowerCase().includes(lowerQuery))
    )
  }

  // Export workflow as JSON
  static exportWorkflow(id: string): string | null {
    const workflow = this.getWorkflow(id)
    if (!workflow) return null
    
    return JSON.stringify(workflow, null, 2)
  }

  // Import workflow from JSON
  static importWorkflow(jsonString: string): WorkflowSnapshot {
    try {
      const workflow = JSON.parse(jsonString) as WorkflowSnapshot
      // Generate new ID to avoid conflicts
      workflow.id = crypto.randomUUID()
      workflow.createdAt = new Date().toISOString()
      workflow.updatedAt = new Date().toISOString()
      workflow.name = `${workflow.name} (Imported)`
      
      this.saveWorkflow(workflow)
      return workflow
    } catch (error) {
      console.error('Error importing workflow:', error)
      throw new Error('Invalid workflow JSON')
    }
  }

  // Publish a workflow (creates a published version)
  static publishWorkflow(workflowId: string): WorkflowSnapshot | null {
    const workflow = this.getWorkflow(workflowId)
    if (!workflow) return null
    
    const now = new Date().toISOString()
    const publishedWorkflow: WorkflowSnapshot = {
      ...workflow,
      isDraft: false,
      isPublished: true,
      publishedAt: now,
      updatedAt: now,
      lastSavedAt: now,
      saveCount: workflow.saveCount + 1
    }
    
    this.saveWorkflow(publishedWorkflow)
    return publishedWorkflow
  }

  // Get version history for a workflow (all versions with same ID)
  static getWorkflowVersions(workflowId: string): WorkflowSnapshot[] {
    const workflows = this.getAllWorkflows()
    return workflows
      .filter(w => w.id === workflowId)
      .sort((a, b) => {
        // Sort by updatedAt descending (newest first)
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      })
  }

  // Get the latest draft version of a workflow
  static getLatestDraft(workflowId: string): WorkflowSnapshot | null {
    const versions = this.getWorkflowVersions(workflowId)
    return versions.find(v => v.isDraft && !v.isPublished) || null
  }

  // Get all published versions of a workflow
  static getPublishedVersions(workflowId: string): WorkflowSnapshot[] {
    const versions = this.getWorkflowVersions(workflowId)
    return versions.filter(v => v.isPublished)
  }

  // Rollback to a specific version
  static rollbackToVersion(workflowId: string, versionTimestamp: string): WorkflowSnapshot | null {
    const versions = this.getWorkflowVersions(workflowId)
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
      name: targetVersion.name // Keep the same name
    }
    
    // Remove any existing draft for this workflow ID
    const workflows = this.getAllWorkflows()
    const filteredWorkflows = workflows.filter(w => 
      !(w.id === workflowId && w.isDraft && !w.isPublished)
    )
    filteredWorkflows.push(rolledBackWorkflow)
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredWorkflows))
    this.setCurrentWorkflowId(workflowId)
    
    return rolledBackWorkflow
  }
}