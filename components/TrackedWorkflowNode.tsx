'use client'

import { useEffect, useRef } from 'react'
import { WorkflowNode } from './WorkflowNode'
import type { NodeMetadata } from '@/types/workflow'

interface TrackedWorkflowNodeProps {
  metadata: NodeMetadata
  position: { x: number; y: number }
  onBoundsChange?: (id: string, bounds: { x: number; y: number; width: number; height: number }) => void
}

export function TrackedWorkflowNode({ metadata, position, onBoundsChange }: TrackedWorkflowNodeProps) {
  const nodeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!nodeRef.current || !onBoundsChange) return

    const updateBounds = () => {
      const element = nodeRef.current
      if (!element) return

      const rect = element.getBoundingClientRect()
      onBoundsChange(metadata.id, {
        x: position.x,
        y: position.y,
        width: rect.width,
        height: rect.height
      })
    }

    // Initial measurement
    updateBounds()

    // Create ResizeObserver to track size changes
    const resizeObserver = new ResizeObserver(updateBounds)
    resizeObserver.observe(nodeRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [metadata.id, position.x, position.y, onBoundsChange])

  return (
    <div
      ref={nodeRef}
      className="absolute"
      style={{
        left: position.x,
        top: position.y
      }}
    >
      <WorkflowNode metadata={metadata} />
    </div>
  )
}