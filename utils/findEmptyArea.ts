import type { NodeMetadata, NodeGroup } from '@/types/workflow'

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

interface Position {
  x: number
  y: number
}

// Check if two rectangles overlap
function rectanglesOverlap(rect1: Bounds, rect2: Bounds): boolean {
  return !(
    rect1.x + rect1.width < rect2.x ||
    rect2.x + rect2.width < rect1.x ||
    rect1.y + rect1.height < rect2.y ||
    rect2.y + rect2.height < rect1.y
  )
}

// Get bounds for a node
function getNodeBounds(node: any, position: Position): Bounds {
  // Default node dimensions
  const width = 200
  const height = 100

  return {
    x: position.x,
    y: position.y,
    width,
    height,
  }
}

// Get bounds for a group
function getGroupBounds(group: NodeGroup): Bounds {
  return {
    x: group.position.x,
    y: group.position.y,
    width: group.size.width,
    height: group.size.height,
  }
}

// Find an empty area in the canvas for placing a new node
export function findEmptyArea(
  nodes: any[],
  groups: NodeGroup[],
  nodeSize: { width: number; height: number } = { width: 200, height: 100 },
  viewportCenter?: Position,
  searchRadius: number = 1000
): Position {
  // Collect all occupied areas
  const occupiedAreas: Bounds[] = []

  // Add node bounds
  nodes.forEach(node => {
    const position = node.position || { x: 0, y: 0 }
    occupiedAreas.push(getNodeBounds(node, position))
  })

  // Add group bounds
  groups.forEach(group => {
    occupiedAreas.push(getGroupBounds(group))
  })

  // If no nodes or groups, place at center or origin
  if (occupiedAreas.length === 0) {
    return viewportCenter || { x: 400, y: 300 }
  }

  // Start from viewport center or center of all elements
  let centerX: number, centerY: number

  if (viewportCenter) {
    centerX = viewportCenter.x
    centerY = viewportCenter.y
  } else {
    // Calculate center of all elements
    const minX = Math.min(...occupiedAreas.map(area => area.x))
    const maxX = Math.max(...occupiedAreas.map(area => area.x + area.width))
    const minY = Math.min(...occupiedAreas.map(area => area.y))
    const maxY = Math.max(...occupiedAreas.map(area => area.y + area.height))

    centerX = (minX + maxX) / 2
    centerY = (minY + maxY) / 2
  }

  // Spiral search pattern
  const spiralStep = 50 // Distance between spiral points
  let angle = 0
  let radius = 0

  while (radius < searchRadius) {
    // Calculate position on spiral
    const x = centerX + radius * Math.cos(angle)
    const y = centerY + radius * Math.sin(angle)

    // Create bounds for the new node at this position
    const newNodeBounds: Bounds = {
      x: x,
      y: y,
      width: nodeSize.width,
      height: nodeSize.height,
    }

    // Check if this position overlaps with any existing element
    let hasOverlap = false
    for (const occupied of occupiedAreas) {
      if (rectanglesOverlap(newNodeBounds, occupied)) {
        hasOverlap = true
        break
      }
    }

    // If no overlap, we found an empty spot
    if (!hasOverlap) {
      // Add some padding to ensure visual separation
      return { x: x, y: y }
    }

    // Move along spiral
    angle += spiralStep / radius || 0.5
    if (angle > 2 * Math.PI) {
      angle -= 2 * Math.PI
      radius += spiralStep
    }
  }

  // Fallback: place to the right of all elements
  const maxX = Math.max(...occupiedAreas.map(area => area.x + area.width))
  return { x: maxX + 100, y: centerY }
}

// Calculate the required pan to center a position in the viewport
export function calculatePanToCenter(
  targetPosition: Position,
  viewportSize: { width: number; height: number },
  currentOffset: Position,
  currentZoom: number
): Position {
  // Calculate where the target should appear in viewport coordinates (center of viewport)
  const targetViewportX = viewportSize.width / 2
  const targetViewportY = viewportSize.height / 2

  // Calculate the required offset
  // The formula is: viewportPos = worldPos * zoom + offset
  // So: offset = viewportPos - worldPos * zoom
  const newOffsetX = targetViewportX - targetPosition.x * currentZoom
  const newOffsetY = targetViewportY - targetPosition.y * currentZoom

  return { x: newOffsetX, y: newOffsetY }
}

// Animate canvas pan smoothly
export function animateCanvasPan(
  startOffset: Position,
  endOffset: Position,
  duration: number,
  onUpdate: (offset: Position) => void,
  onComplete?: () => void
) {
  const startTime = Date.now()

  const animate = () => {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)

    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3)

    const currentOffset = {
      x: startOffset.x + (endOffset.x - startOffset.x) * eased,
      y: startOffset.y + (endOffset.y - startOffset.y) * eased,
    }

    onUpdate(currentOffset)

    if (progress < 1) {
      requestAnimationFrame(animate)
    } else {
      onComplete?.()
    }
  }

  animate()
}
