/**
 * Calculate actual node dimensions based on DOM measurements
 * Returns null if DOM measurement fails - caller should handle gracefully
 */
export const calculateNodeDimensions = (
  metadata: any
): { width: number; height: number } | null => {
  // Try to get actual DOM measurements from the draggable node
  const nodeElement = document.querySelector(`[data-node-id="${metadata.id}"]`)
  if (nodeElement) {
    const rect = nodeElement.getBoundingClientRect()
    // Only return if we got valid dimensions
    if (rect.width > 0 && rect.height > 0) {
      return { width: rect.width, height: rect.height }
    }
  }

  // Return null if we can't get actual measurements - let caller decide what to do
  return null
}
