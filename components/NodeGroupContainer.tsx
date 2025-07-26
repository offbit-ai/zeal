'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { NodeGroup } from '@/types/workflow'
import { useWorkflowStore } from '@/store/workflowStore'

interface NodeGroupContainerProps {
  group: NodeGroup
  children: React.ReactNode
}

export function NodeGroupContainer({ group, children }: NodeGroupContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

  const { moveGroup, resizeGroup, updateGroup, setGroupDragging } = useWorkflowStore()

  // Handle group dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    
    // Check if the click is within the header area
    const clickedElement = target.closest('.group-header')
    if (!clickedElement) return
    
    // Check if we clicked on a button or interactive element
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      return
    }
    
    e.preventDefault()
    e.stopPropagation() // Prevent canvas selection
    setIsDragging(true)
    setGroupDragging(true) // Hide connection lines during drag
    setDragStart({ x: e.clientX - group.position.x, y: e.clientY - group.position.y })
  }

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(false)
    setDragStart(null)
    setResizeStart(null)
    
    // Re-enable connection lines after a brief delay to allow DOM to update
    setTimeout(() => {
      setGroupDragging(false)
      
      // Trigger port position re-measurement for all nodes in this group
      const groupMoveEvent = new CustomEvent('groupPositionChanged', {
        bubbles: true,
        detail: { groupId: group.id }
      })
      if (containerRef.current) {
        containerRef.current.dispatchEvent(groupMoveEvent)
      }
    }, 50)
  }, [setGroupDragging])

  // Handle resize from bottom-right corner
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: group.size.width,
      height: group.size.height
    })
  }

  useEffect(() => {
    if (!isDragging && !isResizing) return

    let animationFrameId: number | null = null
    
    const handleMouseMove = (e: MouseEvent) => {
      // Cancel any pending animation frame
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
      
      // Schedule update on next animation frame for smooth movement
      animationFrameId = requestAnimationFrame(() => {
        if (isDragging && dragStart) {
          const newX = e.clientX - dragStart.x
          const newY = e.clientY - dragStart.y
          moveGroup(group.id, { x: newX, y: newY })
        }
        
        if (isResizing && resizeStart) {
          const newWidth = Math.max(200, resizeStart.width + (e.clientX - resizeStart.x))
          const newHeight = Math.max(150, resizeStart.height + (e.clientY - resizeStart.y))
          resizeGroup(group.id, { width: newWidth, height: newHeight })
        }
      })
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isResizing, dragStart, resizeStart, group.id, moveGroup, resizeGroup, handleMouseUp])

  return (
    <div
      ref={containerRef}
      className={`absolute border-2 border-dashed border-gray-400 bg-gray-50/30 rounded-lg pointer-events-auto transition-shadow ${
        group.collapsed ? 'border-gray-600' : ''
      } ${isDragging ? 'shadow-2xl border-blue-500' : ''}`}
      style={{
        left: group.position.x,
        top: group.position.y,
        width: group.size.width,
        height: group.collapsed ? 40 : group.size.height,
        zIndex: 0, // Behind nodes
        borderColor: group.color || '#9CA3AF',
        cursor: isDragging ? 'grabbing' : 'default'
      }}
      data-group-container="true"
    >
      {/* Group Header */}
      <div
        className="group-header absolute top-0 left-0 right-0 h-8 bg-white/80 backdrop-blur-sm border-b border-gray-300 rounded-t-lg cursor-move flex items-center justify-between px-3"
        onMouseDown={handleMouseDown}
      >
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-900 truncate">
            {group.title}
          </h3>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Collapse/Expand button */}
          <button
            className="text-gray-500 hover:text-gray-700 text-xs"
            onClick={(e) => {
              e.stopPropagation()
              updateGroup(group.id, { collapsed: !group.collapsed })
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {group.collapsed ? '▼' : '▲'}
          </button>
          
          {/* Node count */}
          <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
            {group.nodeIds.length}
          </span>
        </div>
      </div>

      {/* Group Content */}
      {!group.collapsed && (
        <>
          {/* Description */}
          {group.description && (
            <div className="absolute top-8 left-0 right-0 px-3 py-2 bg-white/60 backdrop-blur-sm border-b border-gray-200">
              <p className="text-xs text-gray-600 line-clamp-2">
                {group.description}
              </p>
            </div>
          )}

          {/* Children nodes will be rendered here by the parent */}
          <div className="absolute left-0 right-0 bottom-0" style={{ top: group.description ? 60 : 32 }}>
            {children}
          </div>

          {/* Resize handle */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-gray-400/50 hover:bg-gray-500 rounded-tl-md"
            onMouseDown={handleResizeMouseDown}
          >
            <div className="absolute bottom-1 right-1 w-2 h-2">
              <div className="w-full h-px bg-gray-600"></div>
              <div className="w-px h-full bg-gray-600 ml-1 -mt-px"></div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}