/**
 * Stream Store — render-independent stream event bus
 *
 * Manages binary stream lifecycle outside React's render cycle.
 * Components subscribe to per-stream slices via selectors;
 * event dispatch is synchronous and never triggers unnecessary re-renders.
 *
 * Usage from anywhere (no hooks required):
 *   useStreamStore.getState().dispatch({ type: 'stream.opened', ... })
 *
 * Usage from React:
 *   const state = useStreamStore(s => s.streams[streamKey])
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StreamMeta {
  nodeId: string
  port: string
  streamId: number
  contentType: string
  width?: number
  height?: number
  sizeHint?: number
}

export type StreamPhase = 'idle' | 'streaming' | 'complete' | 'error'

export interface StreamState {
  phase: StreamPhase
  meta: StreamMeta | null
  bytesReceived: number
  error: string | null
}

/** Externally posted events — can come from WebSocket handler, SDK, or test harness. */
export type StreamAction =
  | { type: 'stream.opened'; nodeId: string; port: string; streamId: number; contentType?: string; sizeHint?: number; metadata?: Record<string, any> }
  | { type: 'stream.data'; nodeId: string; streamId: number; payload: Uint8Array }
  | { type: 'stream.closed'; nodeId: string; streamId: number; totalBytes: number }
  | { type: 'stream.error'; nodeId: string; streamId: number; error: string }

/** Imperative callback registered by a renderer (canvas / MediaSource). */
export type FrameSink = (payload: Uint8Array, meta: StreamMeta) => void

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface StreamStore {
  /** Per-node stream state keyed by nodeId. */
  streams: Record<string, StreamState>

  // -- Imperative (non-React) frame sinks --
  /** Register a sink that receives raw binary payloads outside React render. */
  registerSink: (nodeId: string, sink: FrameSink) => void
  /** Remove a previously registered sink. */
  unregisterSink: (nodeId: string) => void

  /** Dispatch a stream event. Safe to call from any context. */
  dispatch: (action: StreamAction) => void

  /** Reset a single stream back to idle. */
  reset: (nodeId: string) => void
}

/** Frame sinks live outside Zustand state to avoid serialization / proxy overhead. */
const sinks = new Map<string, FrameSink>()

const defaultStreamState: StreamState = {
  phase: 'idle',
  meta: null,
  bytesReceived: 0,
  error: null,
}

export const useStreamStore = create<StreamStore>()(
  subscribeWithSelector((set, get) => ({
    streams: {},

    registerSink: (nodeId, sink) => {
      sinks.set(nodeId, sink)
    },

    unregisterSink: (nodeId) => {
      sinks.delete(nodeId)
    },

    dispatch: (action) => {
      const { streams } = get()

      switch (action.type) {
        case 'stream.opened': {
          const meta: StreamMeta = {
            nodeId: action.nodeId,
            port: action.port,
            streamId: action.streamId,
            contentType: action.contentType || 'application/octet-stream',
            sizeHint: action.sizeHint,
            ...(action.metadata as Pick<StreamMeta, 'width' | 'height'>),
          }
          set({
            streams: {
              ...streams,
              [action.nodeId]: { phase: 'streaming', meta, bytesReceived: 0, error: null },
            },
          })
          break
        }

        case 'stream.data': {
          // Hot path — update bytesReceived in state, push payload to sink imperatively.
          const current = streams[action.nodeId]
          if (!current || current.phase !== 'streaming') return

          const newBytes = current.bytesReceived + action.payload.length
          set({
            streams: {
              ...streams,
              [action.nodeId]: { ...current, bytesReceived: newBytes },
            },
          })

          // Deliver to sink synchronously — this bypasses React entirely.
          const sink = sinks.get(action.nodeId)
          if (sink && current.meta) {
            sink(action.payload, current.meta)
          }
          break
        }

        case 'stream.closed': {
          const current = streams[action.nodeId]
          if (!current) return
          set({
            streams: {
              ...streams,
              [action.nodeId]: {
                ...current,
                phase: 'complete',
                bytesReceived: action.totalBytes || current.bytesReceived,
              },
            },
          })
          break
        }

        case 'stream.error': {
          const current = streams[action.nodeId]
          set({
            streams: {
              ...streams,
              [action.nodeId]: {
                ...(current || defaultStreamState),
                phase: 'error',
                error: action.error,
              },
            },
          })
          break
        }
      }
    },

    reset: (nodeId) => {
      const { streams } = get()
      const next = { ...streams }
      delete next[nodeId]
      set({ streams: next })
    },
  }))
)

// ---------------------------------------------------------------------------
// Bridge: connect the WebSocket handler → store
// ---------------------------------------------------------------------------

/**
 * Call once at app startup to wire incoming WebSocket stream events
 * into the store. Works outside React.
 */
export function bridgeStreamEvents(socket: any) {
  const { dispatch } = useStreamStore.getState()

  socket.on('zip.event', (event: any) => {
    if (event?.type === 'stream.opened') {
      dispatch({
        type: 'stream.opened',
        nodeId: event.nodeId,
        port: event.port,
        streamId: event.streamId,
        contentType: event.contentType,
        sizeHint: event.sizeHint,
        metadata: event.metadata,
      })
    } else if (event?.type === 'stream.closed') {
      dispatch({
        type: 'stream.closed',
        nodeId: event.nodeId,
        streamId: event.streamId,
        totalBytes: event.totalBytes,
      })
    } else if (event?.type === 'stream.error') {
      dispatch({
        type: 'stream.error',
        nodeId: event.nodeId,
        streamId: event.streamId,
        error: event.error,
      })
    }
  })

  // Binary frames
  socket.on('stream.frame', (data: ArrayBuffer) => {
    if (!data || (data as any).byteLength < 9) return
    const view = new DataView(data)
    const frameType = view.getUint8(0)
    const streamIdLow = view.getUint32(1, true)
    const streamIdHigh = view.getUint32(5, true)
    const streamId = streamIdLow + streamIdHigh * 0x100000000
    const payload = new Uint8Array((data as ArrayBuffer).slice(9))

    if (frameType === 0x02) {
      // Data frame — find which node owns this streamId
      const { streams } = useStreamStore.getState()
      const nodeId = Object.keys(streams).find(
        id => streams[id].meta?.streamId === streamId
      )
      if (nodeId) {
        dispatch({ type: 'stream.data', nodeId, streamId, payload })
      }
    }
  })
}
