/**
 * Calculate actual node dimensions based on DOM measurements or fallback to type-based estimates
 */
export const calculateNodeDimensions = (metadata: any): { width: number; height: number } => {
  // Try to get actual DOM measurements from the draggable node
  const nodeElement = document.querySelector(`[data-node-id="${metadata.id}"]`)
  if (nodeElement) {
    const rect = nodeElement.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  }
  
  // Fallback based on node type for better dimension estimates
  const nodeType = metadata.type
  if (nodeType === 'script') {
    return { width: 400, height: 200 } // Script nodes are wider and taller
  } else if (['image-input', 'audio-input', 'video-input'].includes(nodeType)) {
    return { width: 350, height: 250 } // Media nodes are wider and taller  
  } else if (['text-input', 'number-input', 'range-input'].includes(nodeType)) {
    return { width: 280, height: 120 } // Input nodes are wider but not too tall
  } else {
    return { width: 200, height: 100 } // Default dimensions
  }
}