'use client'

import { useRef, useState, useEffect, MouseEvent, WheelEvent, ReactNode } from 'react'

interface InteractiveCanvasProps {
  children?: ReactNode
  gridSize?: number
  dotSize?: number
  dotColor?: string
  offset?: { x: number; y: number }
  onOffsetChange?: (offset: { x: number; y: number }) => void
  zoom?: number
  onZoomChange?: (zoom: number) => void
  minZoom?: number
  maxZoom?: number
  // Selection props
  onSelectionStart?: (point: { x: number; y: number }) => void
  onSelectionUpdate?: (point: { x: number; y: number }) => void
  onSelectionEnd?: () => void
  onSelectionClear?: () => void
}

export function InteractiveCanvas({ 
  children, 
  gridSize = 20,
  dotSize = 1,
  dotColor = '#d1d5db',
  offset: externalOffset,
  onOffsetChange,
  zoom: externalZoom,
  onZoomChange,
  minZoom = 0.1,
  maxZoom = 3,
  onSelectionStart,
  onSelectionUpdate,
  onSelectionEnd,
  onSelectionClear
}: InteractiveCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [isSelecting, setIsSelecting] = useState(false)
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 })
  const [internalOffset, setInternalOffset] = useState({ x: 0, y: 0 })
  const [internalZoom, setInternalZoom] = useState(1)
  
  const offset = externalOffset || internalOffset
  const zoom = externalZoom || internalZoom

  // Generate SVG pattern for infinite grid
  const patternId = 'dot-pattern'
  const svgPattern = `
    <svg width="${gridSize}" height="${gridSize}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="${patternId}" x="0" y="0" width="${gridSize}" height="${gridSize}" patternUnits="userSpaceOnUse">
          <circle cx="${gridSize / 2}" cy="${gridSize / 2}" r="${dotSize}" fill="${dotColor}" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#${patternId})" />
    </svg>
  `

  const handleMouseDown = (e: MouseEvent) => {
    // Detect if user is on macOS
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const hasModifier = isMac ? e.metaKey : e.ctrlKey
    
    // Check if clicking on the canvas background (not on a node or group)
    const target = e.target as HTMLElement
    const isGroupClick = target.closest('[data-group-container]') !== null
    const isNodeClick = target.closest('[data-draggable-node]') !== null
    const isCanvasClick = !isGroupClick && !isNodeClick && (target === canvasRef.current || 
                         (target.classList.contains('absolute') && target.classList.contains('inset-0')))
    
    if (isCanvasClick) {
      // Clear selection if clicking on empty space without modifier keys
      if (e.button === 0 && !e.shiftKey && !hasModifier) {
        onSelectionClear?.()
      }
      
      // Pan with middle mouse button or left button + modifier key on canvas
      if (e.button === 1 || (e.button === 0 && hasModifier)) {
        setIsPanning(true)
        setStartPoint({
          x: e.clientX - offset.x,
          y: e.clientY - offset.y
        })
        e.preventDefault()
      }
      // Start selection with left mouse button + shift or just left button on empty space
      else if (e.button === 0 && (e.shiftKey || !hasModifier)) {
        const rect = canvasRef.current?.getBoundingClientRect()
        if (rect) {
          // Convert screen coordinates to canvas coordinates
          const canvasX = (e.clientX - rect.left - offset.x) / zoom
          const canvasY = (e.clientY - rect.top - offset.y) / zoom
          
          setIsSelecting(true)
          setStartPoint({ x: canvasX, y: canvasY })
          onSelectionStart?.({ x: canvasX, y: canvasY })
          e.preventDefault()
        }
      }
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isPanning) {
      const newOffset = {
        x: e.clientX - startPoint.x,
        y: e.clientY - startPoint.y
      }
      if (onOffsetChange) {
        onOffsetChange(newOffset)
      } else {
        setInternalOffset(newOffset)
      }
    } else if (isSelecting) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect) {
        // Convert screen coordinates to canvas coordinates
        const canvasX = (e.clientX - rect.left - offset.x) / zoom
        const canvasY = (e.clientY - rect.top - offset.y) / zoom
        
        onSelectionUpdate?.({ x: canvasX, y: canvasY })
      }
    }
  }

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false)
    }
    if (isSelecting) {
      setIsSelecting(false)
      onSelectionEnd?.()
    }
  }

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault()
    
    // Detect if user is on macOS
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const hasModifier = isMac ? e.metaKey : e.ctrlKey
    
    if (hasModifier) {
      // Zoom with Cmd + wheel on Mac, Ctrl + wheel on Windows/Linux
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.max(minZoom, Math.min(maxZoom, zoom * zoomFactor))
      
      if (newZoom !== zoom) {
        // Calculate zoom point to maintain mouse position
        const zoomPointX = (mouseX - offset.x) / zoom
        const zoomPointY = (mouseY - offset.y) / zoom
        
        const newOffset = {
          x: mouseX - zoomPointX * newZoom,
          y: mouseY - zoomPointY * newZoom
        }
        
        if (onZoomChange) {
          onZoomChange(newZoom)
        } else {
          setInternalZoom(newZoom)
        }
        
        if (onOffsetChange) {
          onOffsetChange(newOffset)
        } else {
          setInternalOffset(newOffset)
        }
      }
    } else {
      // Pan with mouse wheel
      const newOffset = {
        x: offset.x - e.deltaX,
        y: offset.y - e.deltaY
      }
      if (onOffsetChange) {
        onOffsetChange(newOffset)
      } else {
        setInternalOffset(newOffset)
      }
    }
  }

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isPanning) setIsPanning(false)
      if (isSelecting) {
        setIsSelecting(false)
        // Only call onSelectionEnd once when selection ends
        if (onSelectionEnd) {
          onSelectionEnd()
        }
      }
    }
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [isPanning, isSelecting, onSelectionEnd])

  // Calculate background position for infinite scrolling effect with zoom
  const scaledGridSize = gridSize * zoom
  const backgroundPositionX = offset.x % scaledGridSize
  const backgroundPositionY = offset.y % scaledGridSize

  return (
    <div 
      ref={canvasRef}
      className="relative w-full h-full overflow-hidden bg-gray-100"
      data-canvas="true"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      style={{
        cursor: isPanning ? 'grabbing' : isSelecting ? 'crosshair' : 'default'
      }}
    >
      {/* Infinite grid background */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svgPattern)}")`,
          backgroundPosition: `${backgroundPositionX}px ${backgroundPositionY}px`,
          backgroundSize: `${scaledGridSize}px ${scaledGridSize}px`,
          opacity: 0.7
        }}
      />
      
      {/* Content container that moves with pan and scales with zoom */}
      <div 
        className="absolute inset-0"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}
      >
        {children}
      </div>
    </div>
  )
}