'use client'

import { useEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { Tooltip } from './Tooltip'

interface MinimapProps {
  canvasOffset: { x: number; y: number }
  nodes: Array<{
    id: string
    position: { x: number; y: number }
    size?: { width: number; height: number }
  }>
  viewportSize: { width: number; height: number }
  onViewportChange?: (offset: { x: number; y: number }) => void
}

export function Minimap({ 
  canvasOffset, 
  nodes, 
  viewportSize,
  onViewportChange 
}: MinimapProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const minimapRef = useRef<HTMLDivElement>(null)
  
  // Calculate bounds of all nodes
  const bounds = nodes.length > 0 ? nodes.reduce((acc, node) => {
    const nodeRight = node.position.x + (node.size?.width || 200)
    const nodeBottom = node.position.y + (node.size?.height || 80)
    
    return {
      minX: Math.min(acc.minX, node.position.x),
      minY: Math.min(acc.minY, node.position.y),
      maxX: Math.max(acc.maxX, nodeRight),
      maxY: Math.max(acc.maxY, nodeBottom)
    }
  }, {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity
  }) : {
    minX: 0,
    minY: 0,
    maxX: viewportSize.width,
    maxY: viewportSize.height
  }
  
  // Add padding to bounds
  const padding = 50
  
  // Minimap dimensions
  const minimapWidth = isExpanded ? 200 : 150
  const minimapHeight = isExpanded ? 150 : 100
  
  // Define world bounds with some padding
  const worldPadding = 100
  const worldLeft = Math.min(bounds.minX - worldPadding, -canvasOffset.x - worldPadding)
  const worldTop = Math.min(bounds.minY - worldPadding, -canvasOffset.y - worldPadding)
  const worldRight = Math.max(bounds.maxX + worldPadding, -canvasOffset.x + viewportSize.width + worldPadding)
  const worldBottom = Math.max(bounds.maxY + worldPadding, -canvasOffset.y + viewportSize.height + worldPadding)
  
  const worldWidth = worldRight - worldLeft
  const worldHeight = worldBottom - worldTop
  
  // Calculate scale to fit everything in the minimap
  const scaleX = (minimapWidth - 10) / worldWidth  // -10 for padding
  const scaleY = (minimapHeight - 10) / worldHeight
  const scale = Math.min(scaleX, scaleY)
  
  // Center the content in the minimap
  const contentWidth = worldWidth * scale
  const contentHeight = worldHeight * scale
  const offsetX = (minimapWidth - contentWidth) / 2
  const offsetY = (minimapHeight - contentHeight) / 2
  
  // Viewport rectangle in minimap coordinates
  const viewportRect = {
    x: offsetX + (-canvasOffset.x - worldLeft) * scale,
    y: offsetY + (-canvasOffset.y - worldTop) * scale,
    width: viewportSize.width * scale,
    height: viewportSize.height * scale
  }
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!minimapRef.current) return
    
    const rect = minimapRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // Convert minimap coordinates to canvas offset
    const worldX = (x - offsetX) / scale + worldLeft
    const worldY = (y - offsetY) / scale + worldTop
    
    const newOffset = {
      x: -(worldX - viewportSize.width / 2),
      y: -(worldY - viewportSize.height / 2)
    }
    
    onViewportChange?.(newOffset)
    setIsDragging(true)
  }
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !minimapRef.current) return
    
    const rect = minimapRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const worldX = (x - offsetX) / scale + worldLeft
    const worldY = (y - offsetY) / scale + worldTop
    
    const newOffset = {
      x: -(worldX - viewportSize.width / 2),
      y: -(worldY - viewportSize.height / 2)
    }
    
    onViewportChange?.(newOffset)
  }
  
  const handleMouseUp = () => {
    setIsDragging(false)
  }
  
  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false)
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging || !minimapRef.current) return
      
      const rect = minimapRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      
      const worldX = (x - offsetX) / scale + worldLeft
      const worldY = (y - offsetY) / scale + worldTop
      
      const newOffset = {
        x: -(worldX - viewportSize.width / 2),
        y: -(worldY - viewportSize.height / 2)
      }
      
      onViewportChange?.(newOffset)
    }
    
    window.addEventListener('mouseup', handleGlobalMouseUp)
    window.addEventListener('mousemove', handleGlobalMouseMove)
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp)
      window.removeEventListener('mousemove', handleGlobalMouseMove)
    }
  }, [isDragging, scale, worldLeft, worldTop, offsetX, offsetY, viewportSize, onViewportChange])
  
  return (
    <div className="absolute bottom-6 bg-white/70 w-fit py-1 right-4  border border-gray-200 rounded-lg shadow-sm overflow-hidden z-20">
      {/* Header */}
      <div className="absolute right-0.5 flex items-center justify-end px-0 py-0 ">
        {/* <span className="text-xs font-medium text-gray-600">Minimap</span> */}
        <Tooltip content={isExpanded ? "Minimize" : "Maximize"} position="left">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 hover:bg-gray-50 rounded transition-colors cursor-pointer"
          >
            {isExpanded ? 
              <Minimize2 className="w-3 h-3 text-gray-500" /> : 
              <Maximize2 className="w-3 h-3 text-gray-500" />
            }
          </button>
        </Tooltip>
      </div>
      
      {/* Minimap Canvas */}
      <div 
        ref={minimapRef}
        className="relative cursor-crosshair  overflow-hidden"
        style={{ width: minimapWidth, height: minimapHeight }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* World bounds indicator (subtle) */}
        <div 
          className="absolute border border-gray-500 rounded"
          style={{
            left: offsetX,
            top: offsetY,
            width: contentWidth,
            height: contentHeight
          }}
        />
        
        {/* Nodes */}
        {nodes.map(node => {
          const nodeX = offsetX + (node.position.x - worldLeft) * scale
          const nodeY = offsetY + (node.position.y - worldTop) * scale
          const nodeWidth = (node.size?.width || 200) * scale
          const nodeHeight = (node.size?.height || 80) * scale
          
          return (
            <div
              key={node.id}
              className="absolute bg-gray-600 rounded-sm"
              style={{
                left: nodeX,
                top: nodeY,
                width: nodeWidth,
                height: nodeHeight
              }}
            />
          )
        })}
        
        {/* Viewport Rectangle */}
        <div
          className="absolute border-2 border-gray-900 bg-gray-900/10 rounded-sm pointer-events-none"
          style={{
            left: viewportRect.x,
            top: viewportRect.y,
            width: viewportRect.width,
            height: viewportRect.height
          }}
        />
      </div>
    </div>
  )
}