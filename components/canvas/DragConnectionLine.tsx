'use client'

import { PortPosition } from '@/hooks/usePortPositions'

interface DragConnectionLineProps {
  sourcePosition: PortPosition
  currentPosition: { x: number; y: number }
}

export function DragConnectionLine({ sourcePosition, currentPosition }: DragConnectionLineProps) {
  // Simple bezier curve from source to current mouse position
  const x1 = sourcePosition.x
  const y1 = sourcePosition.y
  const x2 = currentPosition.x
  const y2 = currentPosition.y

  // Calculate control points based on source port position
  const getControlOffset = (position: 'top' | 'right' | 'bottom' | 'left') => {
    const distance = 40
    switch (position) {
      case 'top':
        return { dx: 0, dy: -distance }
      case 'right':
        return { dx: distance, dy: 0 }
      case 'bottom':
        return { dx: 0, dy: distance }
      case 'left':
        return { dx: -distance, dy: 0 }
    }
  }

  const sourceControl = getControlOffset(sourcePosition.position)
  const c1x = x1 + sourceControl.dx
  const c1y = y1 + sourceControl.dy

  // For the target, use a simple offset towards the source
  const dx = x1 - x2
  const dy = y1 - y2
  const dist = Math.sqrt(dx * dx + dy * dy)
  const normalized = dist > 0 ? { x: dx / dist, y: dy / dist } : { x: 0, y: 0 }
  const c2x = x2 + normalized.x * 40
  const c2y = y2 + normalized.y * 40

  const path = `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ overflow: 'visible', zIndex: 1000 }}
    >
      {/* Shadow */}
      <path
        d={path}
        fill="none"
        stroke="rgba(0, 0, 0, 0.2)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="5 5"
      />
      {/* Main line */}
      <path
        d={path}
        fill="none"
        stroke="#374151"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="5 5"
      />
      {/* Highlight target circle */}
      <circle
        cx={x2}
        cy={y2}
        r="8"
        fill="none"
        stroke="#374151"
        strokeWidth="2"
        strokeDasharray="2 2"
      />
    </svg>
  )
}
