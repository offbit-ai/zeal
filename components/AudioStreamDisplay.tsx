import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Headphones, AlertCircle, Loader2, Play, Pause } from 'lucide-react'

interface AudioStreamDisplayProps {
  /** Auto-play when stream data arrives */
  autoplay: boolean
  /** Loop the audio after stream completes */
  loop: boolean
  /** Show waveform visualization */
  showWaveform: boolean
  /** Node ID for stream identification */
  nodeId?: string
  /** Workflow ID for WebSocket filtering */
  workflowId?: string
  /** Callback when stream metadata is received */
  onDataChange?: (data: { url?: string; metadata?: any }) => void
}

type StreamState = 'idle' | 'connecting' | 'streaming' | 'complete' | 'error'

export function AudioStreamDisplay({
  autoplay = false,
  loop = false,
  showWaveform = true,
  nodeId,
  onDataChange,
}: AudioStreamDisplayProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const mediaSourceRef = useRef<MediaSource | null>(null)
  const sourceBufferRef = useRef<SourceBuffer | null>(null)
  const pendingChunksRef = useRef<Uint8Array[]>([])
  const bytesReceivedRef = useRef(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number>(0)
  const onDataChangeRef = useRef(onDataChange)

  const [streamState, setStreamState] = useState<StreamState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState<string>('')
  const [bytesReceived, setBytesReceived] = useState(0)
  const [contentType, setContentType] = useState('audio/webm')

  useEffect(() => {
    onDataChangeRef.current = onDataChange
  }, [onDataChange])

  const appendBuffer = useCallback((chunk: Uint8Array) => {
    const sb = sourceBufferRef.current
    if (sb && !sb.updating && mediaSourceRef.current?.readyState === 'open') {
      try {
        sb.appendBuffer(chunk)
      } catch {
        pendingChunksRef.current.push(chunk)
      }
    } else {
      pendingChunksRef.current.push(chunk)
    }
  }, [])

  const flushPending = useCallback(() => {
    const sb = sourceBufferRef.current
    if (!sb || sb.updating || mediaSourceRef.current?.readyState !== 'open') return
    while (pendingChunksRef.current.length > 0) {
      const chunk = pendingChunksRef.current.shift()!
      try {
        sb.appendBuffer(chunk)
        return // Wait for updateend to flush more
      } catch {
        pendingChunksRef.current.unshift(chunk)
        return
      }
    }
  }, [])

  const setupMediaSource = useCallback(
    (mimeType: string) => {
      const audio = audioRef.current
      if (!audio) return

      const ms = new MediaSource()
      mediaSourceRef.current = ms
      audio.src = URL.createObjectURL(ms)

      ms.addEventListener('sourceopen', () => {
        try {
          const sb = ms.addSourceBuffer(mimeType)
          sourceBufferRef.current = sb

          sb.addEventListener('updateend', () => {
            flushPending()
          })

          // Flush anything that arrived before sourceopen
          flushPending()

          if (autoplay) {
            audio.play().catch(() => {})
          }
        } catch (e) {
          setError(`Unsupported audio format: ${mimeType}`)
          setStreamState('error')
        }
      })
    },
    [autoplay, flushPending]
  )

  // Waveform visualization
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyser.getByteTimeDomainData(dataArray)

    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.lineWidth = 1.5
    ctx.strokeStyle = '#22c55e'
    ctx.beginPath()

    const sliceWidth = canvas.width / bufferLength
    let x = 0

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0
      const y = (v * canvas.height) / 2

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
      x += sliceWidth
    }

    ctx.lineTo(canvas.width, canvas.height / 2)
    ctx.stroke()

    animFrameRef.current = requestAnimationFrame(drawWaveform)
  }, [])

  const setupAnalyser = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !showWaveform) return

    try {
      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaElementSource(audio)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyser.connect(audioCtx.destination)
      analyserRef.current = analyser
      drawWaveform()
    } catch {
      // AudioContext may fail in some environments
    }
  }, [showWaveform, drawWaveform])

  const handleStreamOpened = useCallback(
    (event: any) => {
      if (event.nodeId !== nodeId) return

      const mime = event.contentType || 'audio/webm; codecs=opus'
      setContentType(mime)
      setStreamState('streaming')
      setError(null)
      bytesReceivedRef.current = 0
      pendingChunksRef.current = []
      setBytesReceived(0)

      setupMediaSource(mime)
    },
    [nodeId, setupMediaSource]
  )

  const handleStreamFrame = useCallback(
    (frame: any) => {
      if (frame.type === 'data' && frame.payload) {
        const payload =
          frame.payload instanceof Uint8Array ? frame.payload : new Uint8Array(frame.payload)

        bytesReceivedRef.current += payload.length
        setBytesReceived(bytesReceivedRef.current)
        appendBuffer(payload)
      }
    },
    [appendBuffer]
  )

  const handleStreamClosed = useCallback(
    (event: any) => {
      if (event.nodeId !== nodeId) return

      // Wait for all pending chunks to flush, then end the stream
      const checkAndEnd = () => {
        const sb = sourceBufferRef.current
        const ms = mediaSourceRef.current
        if (sb && !sb.updating && ms?.readyState === 'open') {
          if (pendingChunksRef.current.length === 0) {
            try {
              ms.endOfStream()
            } catch {
              // Already ended
            }
          } else {
            flushPending()
            setTimeout(checkAndEnd, 50)
            return
          }
        }
        setStreamState('complete')
        setDuration(formatDuration(audioRef.current?.duration || 0))

        onDataChangeRef.current?.({
          metadata: {
            contentType,
            totalBytes: bytesReceivedRef.current,
            duration: audioRef.current?.duration,
            streamComplete: true,
          },
        })
      }

      setTimeout(checkAndEnd, 100)
    },
    [nodeId, contentType, flushPending]
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
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [nodeId, handleStreamOpened, handleStreamFrame, handleStreamClosed, handleStreamError])

  const togglePlayback = () => {
    const audio = audioRef.current
    if (!audio) return

    if (audio.paused) {
      if (!analyserRef.current && showWaveform) {
        setupAnalyser()
      }
      audio.play().catch(() => {})
      setIsPlaying(true)
    } else {
      audio.pause()
      setIsPlaying(false)
    }
  }

  return (
    <div className="w-full rounded-lg overflow-hidden bg-black/30" style={{ minHeight: 60 }}>
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        loop={loop}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setDuration(formatDuration(audioRef.current.duration || 0))
          }
        }}
      />

      {streamState === 'idle' && (
        <div className="flex items-center justify-center text-gray-500 gap-2 py-4">
          <Headphones className="w-6 h-6 opacity-40" />
          <span className="text-xs">Waiting for audio stream...</span>
        </div>
      )}

      {streamState === 'connecting' && (
        <div className="flex items-center justify-center text-gray-400 gap-2 py-4">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-xs">Connecting...</span>
        </div>
      )}

      {(streamState === 'streaming' || streamState === 'complete') && (
        <div className="p-2">
          {/* Waveform canvas */}
          {showWaveform && (
            <canvas
              ref={canvasRef}
              width={280}
              height={48}
              className="w-full rounded mb-2"
              style={{ height: 48 }}
            />
          )}

          {/* Playback controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlayback}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 text-white" />
              ) : (
                <Play className="w-3.5 h-3.5 text-white ml-0.5" />
              )}
            </button>

            <div className="flex-1 flex items-center gap-2 text-[10px] text-gray-400">
              {streamState === 'streaming' && (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  LIVE
                </span>
              )}
              {duration && <span>{duration}</span>}
              <span className="ml-auto">{formatBytes(bytesReceived)}</span>
            </div>
          </div>
        </div>
      )}

      {streamState === 'error' && (
        <div className="flex items-center justify-center text-red-400 gap-2 py-4">
          <AlertCircle className="w-5 h-5" />
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

function formatDuration(seconds: number): string {
  if (!isFinite(seconds)) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
