// User-specific preferences that should not be synced across users
interface UserWorkflowPreferences {
  activeGraphId: string
  graphCanvasStates: Record<string, { offset: { x: number; y: number }; zoom: number }>
}

export class UserPreferencesService {
  private static readonly STORAGE_KEY_PREFIX = 'zeal_user_prefs_'

  // Get the storage key for a specific workflow
  private static getStorageKey(workflowId: string): string {
    return `${this.STORAGE_KEY_PREFIX}${workflowId}`
  }

  // Save user preferences for a workflow
  static savePreferences(workflowId: string, preferences: UserWorkflowPreferences): void {
    try {
      const key = this.getStorageKey(workflowId)
      localStorage.setItem(key, JSON.stringify(preferences))
    } catch (error) {
      console.error('Failed to save user preferences:', error)
    }
  }

  // Load user preferences for a workflow
  static loadPreferences(workflowId: string): UserWorkflowPreferences | null {
    try {
      const key = this.getStorageKey(workflowId)
      const stored = localStorage.getItem(key)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (error) {
      console.error('Failed to load user preferences:', error)
    }
    return null
  }

  // Update only the active graph ID
  static updateActiveGraphId(workflowId: string, graphId: string): void {
    const prefs = this.loadPreferences(workflowId) || {
      activeGraphId: graphId,
      graphCanvasStates: {},
    }
    prefs.activeGraphId = graphId
    this.savePreferences(workflowId, prefs)
  }

  // Update canvas state for a specific graph
  static updateCanvasState(
    workflowId: string,
    graphId: string,
    canvasState: { offset: { x: number; y: number }; zoom: number }
  ): void {
    const prefs = this.loadPreferences(workflowId) || {
      activeGraphId: graphId,
      graphCanvasStates: {},
    }
    prefs.graphCanvasStates[graphId] = canvasState
    this.savePreferences(workflowId, prefs)
  }

  // Get canvas state for a specific graph
  static getCanvasState(
    workflowId: string,
    graphId: string
  ): { offset: { x: number; y: number }; zoom: number } | null {
    const prefs = this.loadPreferences(workflowId)
    return prefs?.graphCanvasStates[graphId] || null
  }

  // Clear preferences for a workflow
  static clearPreferences(workflowId: string): void {
    try {
      const key = this.getStorageKey(workflowId)
      localStorage.removeItem(key)
    } catch (error) {
      console.error('Failed to clear user preferences:', error)
    }
  }
}
