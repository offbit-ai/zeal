'use client'

import { useState, useRef, useEffect, MouseEvent } from 'react'
import { WorkflowNode } from './WorkflowNode'
import type { NodeMetadata } from '@/types/workflow'

interface DraggableNodeProps {
  metadata: NodeMetadata
  initialPosition: { x: number; y: number }
  onPositionChange?: (id: string, position: { x: number; y: number }) => void
  onBoundsChange?: (id: string, bounds: { x: number; y: number; width: number; height: number }) => void
  onPortPositionUpdate?: (nodeId: string, portId: string, x: number, y: number, position: 'top' | 'right' | 'bottom' | 'left') => void
  onPortDragStart?: (nodeId: string, portId: string, portType: 'input' | 'output') => void
  onPortDragEnd?: (nodeId: string, portId: string, portType: 'input' | 'output') => void
  onClick?: (nodeId: string) => void
  isHighlighted?: boolean
}

export function DraggableNode({ 
  metadata, 
  initialPosition, 
  onPositionChange,
  onBoundsChange,
  onPortPositionUpdate,
  onPortDragStart,
  onPortDragEnd,
  onClick,
  isHighlighted = false
}: DraggableNodeProps) {
  const [position, setPosition] = useState(initialPosition)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [hasDragged, setHasDragged] = useState(false)
  const nodeRef = useRef<HTMLDivElement>(null)

  // Update bounds when position changes
  useEffect(() => {
    if (nodeRef.current && onBoundsChange) {
      const rect = nodeRef.current.getBoundingClientRect()
      onBoundsChange(metadata.id, {
        x: position.x,
        y: position.y,
        width: rect.width,
        height: rect.height
      })
    }
    
    // Trigger port position updates when node moves
    if (nodeRef.current) {
      const event = new CustomEvent('nodePositionChanged', { 
        bubbles: true,
        detail: { nodeId: metadata.id, position }
      })
      nodeRef.current.dispatchEvent(event)
    }
  }, [position, metadata.id, onBoundsChange])

  const handleMouseDown = (e: MouseEvent) => {
    // Only start drag if not clicking on a port
    const target = e.target as HTMLElement
    if (target.closest('[data-port-id]') || target.hasAttribute('data-port-id')) {
      return
    }

    e.preventDefault()
    e.stopPropagation()
    
    setIsDragging(true)
    setHasDragged(false)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const newPosition = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      }
      
      // Check if we've moved enough to consider it a drag
      const dragThreshold = 3
      const deltaX = Math.abs(newPosition.x - position.x)
      const deltaY = Math.abs(newPosition.y - position.y)
      
      if (deltaX > dragThreshold || deltaY > dragThreshold) {
        setHasDragged(true)
      }
      
      setPosition(newPosition)
      onPositionChange?.(metadata.id, newPosition)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      
      // Trigger click if we haven't dragged
      if (!hasDragged && onClick) {
        onClick(metadata.id)
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStart, metadata.id, onPositionChange])

  return (
    <div
      ref={nodeRef}
      className={`absolute ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${isDragging ? 'z-50' : 'z-10'}`}
      data-node-id={metadata.id}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`
      }}
      onMouseDown={handleMouseDown}
    >
      <WorkflowNode metadata={metadata} isDragging={isDragging} isHighlighted={isHighlighted} onPortPositionUpdate={onPortPositionUpdate} onPortDragStart={onPortDragStart} onPortDragEnd={onPortDragEnd} />
    </div>
  )
}