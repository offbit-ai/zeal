'use client'

import { ZoomIn, ZoomOut, Maximize } from 'lucide-react'

interface ZoomControlsProps {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  minZoom?: number
  maxZoom?: number
}

export function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  minZoom = 0.1,
  maxZoom = 3,
}: ZoomControlsProps) {
  const zoomPercentage = Math.round(zoom * 100)

  return (
    <div className="absolute bottom-6 right-56 flex items-center gap-1 bg-white rounded-lg shadow-sm border border-gray-200 p-1 z-20">
      <button
        onClick={onZoomOut}
        disabled={zoom <= minZoom}
        className="p-2 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Zoom Out (Ctrl + Scroll)"
      >
        <ZoomOut className="w-4 h-4 text-gray-600" strokeWidth={1.5} />
      </button>

      <button
        onClick={onZoomReset}
        className="px-3 py-2 hover:bg-gray-100 rounded-md transition-colors text-xs font-medium text-gray-700 min-w-[3rem]"
        title="Reset Zoom (100%)"
      >
        {zoomPercentage}%
      </button>

      <button
        onClick={onZoomIn}
        disabled={zoom >= maxZoom}
        className="p-2 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Zoom In (Ctrl + Scroll)"
      >
        <ZoomIn className="w-4 h-4 text-gray-600" strokeWidth={1.5} />
      </button>

      <div className="w-px h-4 bg-gray-200 mx-1" />

      <button
        onClick={onZoomReset}
        className="p-2 hover:bg-gray-100 rounded-md transition-colors"
        title="Fit to View"
      >
        <Maximize className="w-4 h-4 text-gray-600" strokeWidth={1.5} />
      </button>
    </div>
  )
}
