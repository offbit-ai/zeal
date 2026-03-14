/**
 * Zeal API Bridge for Web Components
 *
 * Provides a constrained, stable API surface that WebComponentHost attaches
 * to each custom element as `element.zeal`. This lets external Web Components
 * read/write properties, receive stream data, and subscribe to store changes
 * without direct access to Zustand internals.
 *
 * The bridge is created per-node and automatically cleans up subscriptions
 * when the node unmounts.
 */

import { useStreamStore, type StreamState, type StreamMeta, type FrameSink } from '@/store/streamStore'

// ---------------------------------------------------------------------------
// Public API exposed to Web Components as `element.zeal`
// ---------------------------------------------------------------------------

export interface ZealBridgeAPI {
  /** Read a single property value. */
  getProperty(name: string): any

  /** Write a property value back to the workflow store. */
  setProperty(name: string, value: any): void

  /** Get all current property values. */
  getProperties(): Record<string, any>

  /** Get the current stream state for this node. */
  getStreamState(): StreamState | null

  /**
   * Register a binary frame sink for stream data.
   * Called synchronously outside React render — ideal for canvas/MediaSource writes.
   * Returns an unsubscribe function.
   */
  onStreamFrame(sink: FrameSink): () => void

  /**
   * Subscribe to stream state changes (phase, bytesReceived, error).
   * Returns an unsubscribe function.
   */
  onStreamStateChange(callback: (state: StreamState) => void): () => void

  /**
   * Subscribe to property value changes.
   * Called whenever any property changes (from side panel, other nodes, etc.).
   * Returns an unsubscribe function.
   */
  onPropertyChange(callback: (values: Record<string, any>) => void): () => void

  /** Node ID this bridge is bound to. */
  readonly nodeId: string
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function createBridgeAPI(
  nodeId: string,
  getPropertyValues: () => Record<string, any>,
  setPropertyFn: (name: string, value: any) => void,
): ZealBridgeAPI {
  const cleanups: Array<() => void> = []

  const api: ZealBridgeAPI = {
    nodeId,

    getProperty(name: string): any {
      return getPropertyValues()[name]
    },

    setProperty(name: string, value: any): void {
      setPropertyFn(name, value)
    },

    getProperties(): Record<string, any> {
      return { ...getPropertyValues() }
    },

    getStreamState(): StreamState | null {
      const streams = useStreamStore.getState().streams
      return streams[nodeId] ?? null
    },

    onStreamFrame(sink: FrameSink): () => void {
      const { registerSink, unregisterSink } = useStreamStore.getState()
      registerSink(nodeId, sink)

      const unsub = () => unregisterSink(nodeId)
      cleanups.push(unsub)
      return unsub
    },

    onStreamStateChange(callback: (state: StreamState) => void): () => void {
      const unsub = useStreamStore.subscribe(
        s => s.streams[nodeId],
        (state) => {
          if (state) callback(state)
        }
      )
      cleanups.push(unsub)
      return unsub
    },

    onPropertyChange(callback: (values: Record<string, any>) => void): () => void {
      // We use a polling-free approach: the WebComponentHost calls
      // notifyPropertyChange() whenever React detects a change,
      // which triggers all registered callbacks.
      propertyCallbacks.add(callback)
      const unsub = () => { propertyCallbacks.delete(callback) }
      cleanups.push(unsub)
      return unsub
    },
  }

  // Property change callbacks (driven by WebComponentHost effect)
  const propertyCallbacks = new Set<(values: Record<string, any>) => void>()

  return Object.assign(api, {
    /** Called by WebComponentHost when propertyValues change. Not part of public API. */
    _notifyPropertyChange(values: Record<string, any>): void {
      for (const cb of propertyCallbacks) {
        try { cb(values) } catch { /* isolate callback errors */ }
      }
    },

    /** Called by WebComponentHost on unmount. Tears down all subscriptions. */
    _destroy(): void {
      for (const fn of cleanups) {
        try { fn() } catch { /* best-effort cleanup */ }
      }
      cleanups.length = 0
      propertyCallbacks.clear()
    },
  })
}

/** Internal bridge type including lifecycle methods not exposed to WC authors. */
export type BridgeInternal = ZealBridgeAPI & {
  _notifyPropertyChange(values: Record<string, any>): void
  _destroy(): void
}
