/**
 * Utility functions for generating storage keys
 */

/**
 * Generate a workflow-scoped storage key
 * Format: workflowId/graphId/nodeId/timestamp-sanitizedName.extension
 * 
 * @param workflowId - The workflow ID
 * @param graphId - The graph ID
 * @param nodeId - The node ID
 * @param fileName - The original file name
 * @returns The generated storage key
 */
export function generateWorkflowScopedKey(
  workflowId: string,
  graphId: string,
  nodeId: string,
  fileName: string
): string {
  const timestamp = Date.now()
  const extension = fileName.split('.').pop()
  const sanitizedName = fileName
    .split('.')[0]
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .substring(0, 50) // Limit filename length
  
  return `${workflowId}/${graphId}/${nodeId}/${timestamp}-${sanitizedName}.${extension}`
}

/**
 * Generate a simple category-based storage key
 * Format: category/timestamp-random.extension
 * 
 * @param category - The file category (e.g., 'image', 'audio', 'video')
 * @param fileName - The original file name
 * @returns The generated storage key
 */
export function generateCategoryKey(category: string, fileName: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const extension = fileName.split('.').pop()
  return `${category}/${timestamp}-${random}.${extension}`
}

/**
 * Extract workflow context from a storage key
 * 
 * @param key - The storage key
 * @returns Object with workflowId, graphId, nodeId, and fileName (or null if not a workflow key)
 */
export function extractWorkflowContext(key: string): {
  workflowId: string
  graphId: string
  nodeId: string
  fileName: string
} | null {
  const parts = key.split('/')
  
  if (parts.length !== 4) {
    return null
  }
  
  return {
    workflowId: parts[0],
    graphId: parts[1],
    nodeId: parts[2],
    fileName: parts[3],
  }
}