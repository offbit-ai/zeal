/**
 * Resolve a workflow node's id from either the top-level `id`
 * or the legacy `metadata.id` shape.
 */
export const getNodeId = (node: any): string => {
  return node?.id || node?.metadata?.id || ''
}
