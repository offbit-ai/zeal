import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Headphones, AlertCircle, Play, Pause } from 'lucide-react'
import { useStreamStore, type StreamMeta } from '@/store/streamStore'
import { shallow } from 'zustand/shallow'

interface AudioStreamDisplayProps {
  autoplay: boolean
  loop: boolean
  showWaveform: boolean
  nodeId?: string
  onDataChange?: (data: { url?: string; metadata?: any }) => void
}

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
  const pendingRef = useRef<Uint8Array[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef(0)

  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState('')

  // Selector: subscribe to store-managed stream state
  const { phase, bytesReceived, error, meta } = useStreamStore(
    s => s.streams[nodeId || ''] ?? idle,
    shallow
  )

  // -- Imperative helpers (no React state) -----------------------------------

  const flushPending = useCallback(() => {
    const sb = sourceBufferRef.current
    const ms = mediaSourceRef.current
    if (!sb || sb.updating || ms?.readyState !== 'open') return
    while (pendingRef.current.length > 0) {
      const chunk = pendingRef.current.shift()!
      try {
        sb.appendBuffer(chunk)
        return // wait for updateend
      } catch {
        pendingRef.current.unshift(chunk)
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
          sb.addEventListener('updateend', flushPending)
          flushPending()
          if (autoplay) audio.play().catch(() => {})
        } catch {
          // unsupported codec — store will show error via dispatch
        }
      })
    },
    [autoplay, flushPending]
  )

  // -- Waveform drawing (requestAnimationFrame, no React) --------------------

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bufLen = analyser.frequencyBinCount
    const data = new Uint8Array(bufLen)
    analyser.getByteTimeDomainData(data)

    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.lineWidth = 1.5
    ctx.strokeStyle = '#22c55e'
    ctx.beginPath()

    const step = canvas.width / bufLen
    let x = 0
    for (let i = 0; i < bufLen; i++) {
      const y = (data[i] / 128.0) * (canvas.height / 2)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      x += step
    }
    ctx.lineTo(canvas.width, canvas.height / 2)
    ctx.stroke()

    animFrameRef.current = requestAnimationFrame(drawWaveform)
  }, [])

  const ensureAnalyser = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !showWaveform || analyserRef.current) return
    try {
      const ctx = new AudioContext()
      const src = ctx.createMediaElementSource(audio)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      src.connect(analyser)
      analyser.connect(ctx.destination)
      analyserRef.current = analyser
      drawWaveform()
    } catch {
      // AudioContext unavailable
    }
  }, [showWaveform, drawWaveform])

  // -- Register sink: delivers binary audio chunks outside React render -------

  useEffect(() => {
    if (!nodeId) return

    const { registerSink, unregisterSink } = useStreamStore.getState()

    let msInitialised = false

    registerSink(nodeId, (payload: Uint8Array, streamMeta: StreamMeta) => {
      // Lazily create MediaSource on first data chunk
      if (!msInitialised) {
        msInitialised = true
        const mime = streamMeta.contentType || 'audio/webm; codecs=opus'
        setupMediaSource(mime)
      }

      // Queue chunk for SourceBuffer
      const sb = sourceBufferRef.current
      if (sb && !sb.updating && mediaSourceRef.current?.readyState === 'open') {
        try {
          sb.appendBuffer(payload)
        } catch {
          pendingRef.current.push(payload)
        }
      } else {
        pendingRef.current.push(payload)
      }
    })

    return () => {
      unregisterSink(nodeId)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [nodeId, setupMediaSource])

  // -- React to phase transitions from store ---------------------------------

  useEffect(() => {
    if (phase !== 'complete') return

    // Flush remaining pending chunks then end stream
    const finish = () => {
      const sb = sourceBufferRef.current
      const ms = mediaSourceRef.current
      if (sb && !sb.updating && ms?.readyState === 'open') {
        if (pendingRef.current.length === 0) {
          try { ms.endOfStream() } catch { /* already ended */ }
        } else {
          flushPending()
          setTimeout(finish, 50)
          return
        }
      }
      setDuration(fmtDuration(audioRef.current?.duration || 0))
      onDataChange?.({
        metadata: {
          contentType: meta?.contentType,
          totalBytes: bytesReceived,
          duration: audioRef.current?.duration,
          streamComplete: true,
        },
      })
    }
    setTimeout(finish, 100)
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // -- Controls --------------------------------------------------------------

  const togglePlayback = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      ensureAnalyser()
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }

  // -- Render ----------------------------------------------------------------

  return (
    <div className="w-full rounded-lg overflow-hidden bg-black/30" style={{ minHeight: 60 }}>
      <audio
        ref={audioRef}
        loop={loop}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={() => setDuration(fmtDuration(audioRef.current?.duration || 0))}
      />

      {phase === 'idle' && (
        <div className="flex items-center justify-center text-gray-500 gap-2 py-4">
          <Headphones className="w-6 h-6 opacity-40" />
          <span className="text-xs">Waiting for audio stream...</span>
        </div>
      )}

      {(phase === 'streaming' || phase === 'complete') && (
        <div className="p-2">
          {showWaveform && (
            <canvas
              ref={canvasRef}
              width={280}
              height={48}
              className="w-full rounded mb-2"
              style={{ height: 48 }}
            />
          )}

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
              {phase === 'streaming' && (
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

      {phase === 'error' && (
        <div className="flex items-center justify-center text-red-400 gap-2 py-4">
          <AlertCircle className="w-5 h-5" />
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

function fmtDuration(s: number): string {
  if (!isFinite(s)) return '--:--'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}
