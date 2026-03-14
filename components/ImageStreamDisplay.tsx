import React, { useRef, useEffect } from 'react'
import { Monitor, AlertCircle } from 'lucide-react'
import { useStreamStore, type StreamMeta } from '@/store/streamStore'
import { shallow } from 'zustand/shallow'

interface ImageStreamDisplayProps {
  displayMode: 'contain' | 'cover' | 'fill'
  previewHeight: number
  nodeId?: string
  onDataChange?: (data: { url?: string; metadata?: any }) => void
}

export function ImageStreamDisplay({
  displayMode = 'contain',
  previewHeight = 300,
  nodeId,
  onDataChange,
}: ImageStreamDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rowCursorRef = useRef(0)

  // Selector: only re-render when phase, bytesReceived, error, or meta identity changes
  const { phase, bytesReceived, error, meta } = useStreamStore(
    s => s.streams[nodeId || ''] ?? idle,
    shallow
  )

  // Register imperative canvas sink — runs outside React render.
  // The sink writes RGBA rows directly to the canvas without triggering setState.
  useEffect(() => {
    if (!nodeId) return

    const { registerSink, unregisterSink } = useStreamStore.getState()

    registerSink(nodeId, (payload: Uint8Array, streamMeta: StreamMeta) => {
      const canvas = canvasRef.current
      if (!canvas || !streamMeta.width || !streamMeta.height) return

      // Lazily size the canvas on first data frame
      if (canvas.width !== streamMeta.width || canvas.height !== streamMeta.height) {
        canvas.width = streamMeta.width
        canvas.height = streamMeta.height
        rowCursorRef.current = 0
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.fillStyle = '#1a1a2e'
          ctx.fillRect(0, 0, streamMeta.width, streamMeta.height)
        }
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const bytesPerRow = streamMeta.width * 4
      const rowsInChunk = Math.floor(payload.length / bytesPerRow)

      for (let i = 0; i < rowsInChunk; i++) {
        const offset = i * bytesPerRow
        const rowData = payload.subarray(offset, offset + bytesPerRow)
        const imageData = new ImageData(new Uint8ClampedArray(rowData), streamMeta.width, 1)
        if (rowCursorRef.current < streamMeta.height) {
          ctx.putImageData(imageData, 0, rowCursorRef.current)
          rowCursorRef.current++
        }
      }
    })

    return () => {
      unregisterSink(nodeId)
    }
  }, [nodeId])

  // On completion, export canvas and notify parent
  useEffect(() => {
    if (phase !== 'complete' || !canvasRef.current) return
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png')
      onDataChange?.({
        url: dataUrl,
        metadata: { ...meta, totalBytes: bytesReceived, streamComplete: true },
      })
    } catch {
      // canvas may be tainted
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const objectFit =
    displayMode === 'contain' ? 'contain' : displayMode === 'cover' ? 'cover' : 'fill'

  const progress =
    meta?.sizeHint && meta.sizeHint > 0
      ? Math.min(100, Math.round((bytesReceived / meta.sizeHint) * 100))
      : null

  return (
    <div className="w-full rounded-lg overflow-hidden bg-black/30" style={{ minHeight: 80 }}>
      {phase === 'idle' && (
        <div
          className="flex flex-col items-center justify-center text-gray-500 gap-2"
          style={{ height: previewHeight }}
        >
          <Monitor className="w-8 h-8 opacity-40" />
          <span className="text-xs">Waiting for stream...</span>
        </div>
      )}

      {(phase === 'streaming' || phase === 'complete') && (
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="w-full rounded"
            style={{
              maxHeight: previewHeight,
              objectFit,
              display: 'block',
              imageRendering: 'pixelated',
            }}
          />

          <div className="absolute bottom-1 right-1 flex gap-1">
            {phase === 'streaming' && progress !== null && (
              <span className="bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                {progress}%
              </span>
            )}
            {phase === 'streaming' && (
              <span className="bg-green-600/80 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </span>
            )}
            {phase === 'complete' && (
              <span className="bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                {meta?.width}×{meta?.height} &middot; {formatBytes(bytesReceived)}
              </span>
            )}
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div
          className="flex flex-col items-center justify-center text-red-400 gap-2"
          style={{ height: previewHeight }}
        >
          <AlertCircle className="w-6 h-6" />
          <span className="text-xs">{error}</span>
        </div>
      )}
    </div>
  )
}

const idle = { phase: 'idle' as const, meta: null, bytesReceived: 0, error: null }

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
