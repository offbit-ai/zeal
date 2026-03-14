import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Monitor, AlertCircle, Loader2 } from 'lucide-react'

interface ImageStreamDisplayProps {
  /** Display mode for the rendered image */
  displayMode: 'contain' | 'cover' | 'fill'
  /** Canvas height in pixels */
  previewHeight: number
  /** Node ID for stream identification */
  nodeId?: string
  /** Workflow ID for WebSocket filtering */
  workflowId?: string
  /** Callback when stream metadata is received */
  onDataChange?: (data: { url?: string; metadata?: any }) => void
}

type StreamState = 'idle' | 'connecting' | 'streaming' | 'complete' | 'error'

interface StreamMeta {
  width: number
  height: number
  contentType: string
  totalBytes?: number
}

export function ImageStreamDisplay({
  displayMode = 'contain',
  previewHeight = 300,
  nodeId,
  onDataChange,
}: ImageStreamDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bufferRef = useRef<Uint8Array[]>([])
  const metaRef = useRef<StreamMeta | null>(null)
  const bytesReceivedRef = useRef(0)
  const onDataChangeRef = useRef(onDataChange)

  const [streamState, setStreamState] = useState<StreamState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [bytesReceived, setBytesReceived] = useState(0)
  const [streamMeta, setStreamMeta] = useState<StreamMeta | null>(null)

  useEffect(() => {
    onDataChangeRef.current = onDataChange
  }, [onDataChange])

  const handleStreamOpened = useCallback(
    (event: any) => {
      if (event.nodeId !== nodeId) return

      const meta: StreamMeta = {
        width: event.metadata?.width || 0,
        height: event.metadata?.height || 0,
        contentType: event.contentType || 'image/raw-rgba',
        totalBytes: event.sizeHint,
      }

      metaRef.current = meta
      bufferRef.current = []
      bytesReceivedRef.current = 0
      setStreamMeta(meta)
      setStreamState('streaming')
      setError(null)
      setBytesReceived(0)

      // Allocate canvas
      const canvas = canvasRef.current
      if (canvas && meta.width > 0 && meta.height > 0) {
        canvas.width = meta.width
        canvas.height = meta.height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.fillStyle = '#1a1a2e'
          ctx.fillRect(0, 0, meta.width, meta.height)
        }
      }
    },
    [nodeId]
  )

  const handleStreamFrame = useCallback(
    (frame: any) => {
      // frame: { type, streamId, payload, metadata?, message? }
      if (!metaRef.current) return

      const meta = metaRef.current
      const canvas = canvasRef.current
      if (!canvas) return

      if (frame.type === 'data' && frame.payload) {
        const payload =
          frame.payload instanceof Uint8Array ? frame.payload : new Uint8Array(frame.payload)

        bufferRef.current.push(payload)
        bytesReceivedRef.current += payload.length
        setBytesReceived(bytesReceivedRef.current)

        // Write RGBA pixel rows to canvas
        if (meta.width > 0 && meta.height > 0) {
          const ctx = canvas.getContext('2d')
          if (!ctx) return

          const bytesPerRow = meta.width * 4 // RGBA
          const rowsInChunk = Math.floor(payload.length / bytesPerRow)
          const completedRows = Math.floor(
            (bytesReceivedRef.current - payload.length) / bytesPerRow
          )

          for (let i = 0; i < rowsInChunk; i++) {
            const rowOffset = i * bytesPerRow
            const rowData = payload.slice(rowOffset, rowOffset + bytesPerRow)
            const imageData = new ImageData(new Uint8ClampedArray(rowData), meta.width, 1)
            const y = completedRows + i
            if (y < meta.height) {
              ctx.putImageData(imageData, 0, y)
            }
          }
        }
      } else if (frame.type === 'begin' && frame.metadata) {
        // Update meta if begin frame carries dimensions
        if (frame.metadata.width && frame.metadata.height) {
          const updatedMeta = {
            ...meta,
            width: frame.metadata.width,
            height: frame.metadata.height,
          }
          metaRef.current = updatedMeta
          setStreamMeta(updatedMeta)

          canvas.width = updatedMeta.width
          canvas.height = updatedMeta.height
        }
      }
    },
    []
  )

  const handleStreamClosed = useCallback(
    (event: any) => {
      if (event.nodeId !== nodeId) return

      setStreamState('complete')

      // Export canvas as data URL for downstream ports
      const canvas = canvasRef.current
      if (canvas) {
        try {
          const dataUrl = canvas.toDataURL('image/png')
          onDataChangeRef.current?.({
            url: dataUrl,
            metadata: {
              ...metaRef.current,
              totalBytes: bytesReceivedRef.current,
              streamComplete: true,
            },
          })
        } catch {
          // Canvas may be tainted in some contexts
        }
      }
    },
    [nodeId]
  )

  const handleStreamError = useCallback(
    (event: any) => {
      if (event.nodeId !== nodeId) return
      setStreamState('error')
      setError(event.error || 'Stream error')
    },
    [nodeId]
  )

  // Register global stream event listeners
  useEffect(() => {
    const win = window as any
    if (!win.__zealStreamHandlers) {
      win.__zealStreamHandlers = new Map()
    }

    const handlers = {
      onStreamOpened: handleStreamOpened,
      onStreamFrame: handleStreamFrame,
      onStreamClosed: handleStreamClosed,
      onStreamError: handleStreamError,
    }

    win.__zealStreamHandlers.set(nodeId, handlers)

    return () => {
      win.__zealStreamHandlers.delete(nodeId)
    }
  }, [nodeId, handleStreamOpened, handleStreamFrame, handleStreamClosed, handleStreamError])

  const objectFit =
    displayMode === 'contain' ? 'contain' : displayMode === 'cover' ? 'cover' : 'fill'

  const progress =
    streamMeta?.totalBytes && streamMeta.totalBytes > 0
      ? Math.min(100, Math.round((bytesReceived / streamMeta.totalBytes) * 100))
      : null

  return (
    <div className="w-full rounded-lg overflow-hidden bg-black/30" style={{ minHeight: 80 }}>
      {streamState === 'idle' && (
        <div
          className="flex flex-col items-center justify-center text-gray-500 gap-2"
          style={{ height: previewHeight }}
        >
          <Monitor className="w-8 h-8 opacity-40" />
          <span className="text-xs">Waiting for stream...</span>
        </div>
      )}

      {streamState === 'connecting' && (
        <div
          className="flex flex-col items-center justify-center text-gray-400 gap-2"
          style={{ height: previewHeight }}
        >
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-xs">Connecting...</span>
        </div>
      )}

      {(streamState === 'streaming' || streamState === 'complete') && (
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

          {/* Overlay stats */}
          <div className="absolute bottom-1 right-1 flex gap-1">
            {streamState === 'streaming' && progress !== null && (
              <span className="bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                {progress}%
              </span>
            )}
            {streamState === 'streaming' && (
              <span className="bg-green-600/80 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </span>
            )}
            {streamState === 'complete' && (
              <span className="bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                {streamMeta?.width}×{streamMeta?.height} &middot;{' '}
                {formatBytes(bytesReceived)}
              </span>
            )}
          </div>
        </div>
      )}

      {streamState === 'error' && (
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
