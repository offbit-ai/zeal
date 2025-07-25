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
  maxZoom = 3
}: InteractiveCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [isPanning, setIsPanning] = useState(false)
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
    // Check if clicking on the canvas background (not on a node)
    const target = e.target as HTMLElement
    const isCanvasClick = target === canvasRef.current || 
                         target.classList.contains('absolute') && target.classList.contains('inset-0')
    
    // Only pan with middle mouse button or left button + space/cmd on canvas
    if (isCanvasClick && (e.button === 1 || (e.button === 0 && (e.metaKey || e.ctrlKey)))) {
      setIsPanning(true)
      setStartPoint({
        x: e.clientX - offset.x,
        y: e.clientY - offset.y
      })
      e.preventDefault()
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
    }
  }

  const handleMouseUp = () => {
    setIsPanning(false)
  }

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault()
    
    if (e.ctrlKey || e.metaKey) {
      // Zoom with Ctrl/Cmd + wheel
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
    const handleGlobalMouseUp = () => setIsPanning(false)
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [])

  // Calculate background position for infinite scrolling effect with zoom
  const scaledGridSize = gridSize * zoom
  const backgroundPositionX = offset.x % scaledGridSize
  const backgroundPositionY = offset.y % scaledGridSize

  return (
    <div 
      ref={canvasRef}
      className="relative w-full h-full overflow-hidden bg-gray-100"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      style={{
        cursor: isPanning ? 'grabbing' : 'default'
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