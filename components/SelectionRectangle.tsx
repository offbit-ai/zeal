'use client'

import React from 'react'

interface SelectionRectangleProps {
  startPoint: { x: number; y: number }
  endPoint: { x: number; y: number }
  visible: boolean
}

export function SelectionRectangle({ startPoint, endPoint, visible }: SelectionRectangleProps) {
  if (!visible) return null

  // Calculate rectangle dimensions
  const x = Math.min(startPoint.x, endPoint.x)
  const y = Math.min(startPoint.y, endPoint.y)
  const width = Math.abs(endPoint.x - startPoint.x)
  const height = Math.abs(endPoint.y - startPoint.y)

  // Don't render if the rectangle is too small
  if (width < 5 || height < 5) return null

  return (
    <div
      className="absolute pointer-events-none z-50"
      style={{
        left: x,
        top: y,
        width,
        height,
        border: '2px dashed #3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        animation: 'selection-pulse 1.5s ease-in-out infinite'
      }}
    >
      {/* Corner indicators */}
      <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 rounded-full" />
      <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
      <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-500 rounded-full" />
      <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
      
      {/* Selection info */}
      <div className="absolute -top-8 left-0 bg-blue-500 text-white px-2 py-1 rounded text-xs whitespace-nowrap">
        {width.toFixed(0)} × {height.toFixed(0)}
      </div>
      
      <style jsx>{`
        @keyframes selection-pulse {
          0%, 100% { 
            border-color: #3b82f6;
            background-color: rgba(59, 130, 246, 0.1);
          }
          50% { 
            border-color: #1d4ed8;
            background-color: rgba(59, 130, 246, 0.2);
          }
        }
      `}</style>
    </div>
  )
}