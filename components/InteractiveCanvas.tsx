'use client'

import { useRef, useState, useEffect, MouseEvent, WheelEvent, ReactNode } from 'react'

interface InteractiveCanvasProps {
  children?: ReactNode
  gridSize?: number
  dotSize?: number
  dotColor?: string
  offset?: { x: number; y: number }
  onOffsetChange?: (offset: { x: number; y: number }) => void
}

export function InteractiveCanvas({ 
  children, 
  gridSize = 20,
  dotSize = 1,
  dotColor = '#d1d5db',
  offset: externalOffset,
  onOffsetChange
}: InteractiveCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 })
  const [internalOffset, setInternalOffset] = useState({ x: 0, y: 0 })
  
  const offset = externalOffset || internalOffset

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

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsPanning(false)
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [])

  // Calculate background position for infinite scrolling effect
  const backgroundPositionX = offset.x % gridSize
  const backgroundPositionY = offset.y % gridSize

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
          backgroundSize: `${gridSize}px ${gridSize}px`,
          opacity: 0.7
        }}
      />
      
      {/* Content container that moves with pan */}
      <div 
        className="absolute inset-0"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px)`
        }}
      >
        {children}
      </div>
    </div>
  )
}