/**
 * Cleanup function to remove old workflow data from localStorage
 * This should be called once to migrate from localStorage to API-only storage
 */
export function cleanupWorkflowLocalStorage() {
  if (typeof window === 'undefined') return

  try {
    // Remove the old workflow storage key
    const STORAGE_KEY = 'zeal_workflows'
    if (localStorage.getItem(STORAGE_KEY)) {
      console.log('[Cleanup] Removing old workflow data from localStorage')
      localStorage.removeItem(STORAGE_KEY)
    }

    // Clean up any orphaned UI state for deleted workflows
    const keysToCheck: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('expandedGroupSizes_') || key.startsWith('groupNodePositions-'))) {
        keysToCheck.push(key)
      }
    }

    // Note: We're keeping these UI state items as they don't affect data integrity
    // They're just UI preferences that improve user experience
    console.log(`[Cleanup] Found ${keysToCheck.length} UI state keys in localStorage`)

    // Mark cleanup as complete
    localStorage.setItem('zeal_localStorage_cleanup_v1', 'true')
  } catch (error) {
    console.error('[Cleanup] Error cleaning up localStorage:', error)
  }
}

/**
 * Check if cleanup has already been performed
 */
export function hasLocalStorageBeenCleaned(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem('zeal_localStorage_cleanup_v1') === 'true'
}
