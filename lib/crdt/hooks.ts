/**
 * React Hooks for CRDT Integration
 *
 * Provides easy-to-use hooks for integrating CRDT functionality
 * into React components with automatic cleanup and state management.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import * as Y from 'yjs'
import { RustSocketIOProvider } from './rust-socketio-provider'
import { CRDTPersistence } from './persistence'
import type { CRDTPresence, CRDTSyncState } from './types'

/**
 * Hook configuration options
 */
export interface UseCRDTOptions {
  roomName: string
  enableWebSocket?: boolean
  webSocketUrl?: string
  enablePersistence?: boolean
  enablePresence?: boolean
  auth?: {
    userId: string
    userName: string
    token?: string
  }
}

/**
 * Main CRDT hook that provides document and collaboration features
 */
export function useCRDT(options: UseCRDTOptions) {
  const [doc] = useState(() => new Y.Doc({ guid: options.roomName }))
  const [syncState, setSyncState] = useState<CRDTSyncState>({
    isSyncing: false,
    lastSyncedAt: undefined,
    pendingChanges: 0,
    peers: [],
  })
  const [presence, setPresence] = useState<Map<number, CRDTPresence>>(new Map())
  const [isInitialized, setIsInitialized] = useState(false)

  const socketProviderRef = useRef<RustSocketIOProvider | null>(null)
  const persistenceRef = useRef<CRDTPersistence | null>(null)

  // Initialize providers
  useEffect(() => {
    let cleanup: (() => void)[] = []

    const init = async () => {
      // Initialize persistence
      if (options.enablePersistence) {
        persistenceRef.current = new CRDTPersistence()
        await persistenceRef.current.initializeDoc(options.roomName, doc)

        cleanup.push(() => {
          persistenceRef.current?.destroy()
        })
      }

      // Initialize Socket.IO provider
      if (options.enableWebSocket) {
        socketProviderRef.current = new RustSocketIOProvider(doc, {
          roomName: options.roomName,
          serverUrl: options.webSocketUrl || 'ws://localhost:8080',
          auth: options.auth,
          onStatusChange: status => {
            setSyncState(prev => ({
              ...prev,
              isSyncing: status === 'connecting',
              lastSyncedAt: status === 'connected' ? Date.now() : prev.lastSyncedAt,
            }))
          },
          onSyncComplete: () => {
            // console.log removed
          },
        })

        // Set up presence tracking
        if (options.enablePresence) {
          const awareness = socketProviderRef.current.getAwareness()

          awareness.on('change', () => {
            const states = new Map<number, CRDTPresence>()
            awareness.getStates().forEach((state, clientId) => {
              // Only include states that have the required fields
              if (state && (state.userId || state.user?.userId)) {
                states.set(clientId, {
                  userId: state.userId || state.user?.userId || `client-${clientId}`,
                  userName: state.userName || state.user?.userName || 'Anonymous',
                  userColor: state.userColor || state.user?.userColor || '#3b82f6',
                  cursor: state.cursor,
                  lastSeen: state.lastSeen || Date.now(),
                  isActive: state.isActive !== undefined ? state.isActive : true,
                } as CRDTPresence)
              }
            })
            setPresence(states)
          })

          // Set initial presence
          socketProviderRef.current.setUserState({
            userId: options.auth?.userId || 'anonymous',
            userName: options.auth?.userName || 'Anonymous',
            isActive: true,
          })
        }

        cleanup.push(() => {
          socketProviderRef.current?.disconnect()
        })
      }

      setIsInitialized(true)
    }

    init()

    return () => {
      cleanup.forEach(fn => fn())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update presence
  const updatePresence = useCallback(
    (update: Partial<CRDTPresence>) => {
      if (socketProviderRef.current && options.enablePresence) {
        socketProviderRef.current.setUserState(update)
      }
    },
    [options.enablePresence]
  )

  // Send custom message
  const sendMessage = useCallback((data: any) => {
    if (socketProviderRef.current) {
      socketProviderRef.current.sendCustomMessage(data)
    }
  }, [])

  return {
    doc,
    syncState,
    presence,
    isInitialized,
    updatePresence,
    sendMessage,
  }
}

/**
 * Hook for using Y.js arrays with React state
 */
export function useYArray<T>(
  yArray: Y.Array<T> | undefined
): [T[], (index: number, items: T[]) => void, (index: number, length: number) => void] {
  const [items, setItems] = useState<T[]>(() => yArray?.toArray() || [])

  useEffect(() => {
    if (!yArray) return

    const observer = () => {
      setItems(yArray.toArray())
    }

    yArray.observe(observer)
    observer() // Initial sync

    return () => {
      yArray.unobserve(observer)
    }
  }, [yArray])

  const insert = useCallback(
    (index: number, newItems: T[]) => {
      yArray?.insert(index, newItems)
    },
    [yArray]
  )

  const deleteItems = useCallback(
    (index: number, length: number) => {
      yArray?.delete(index, length)
    },
    [yArray]
  )

  return [items, insert, deleteItems]
}

/**
 * Hook for using Y.js maps with React state
 */
export function useYMap<T extends Record<string, any>>(
  yMap: Y.Map<any> | undefined
): [T, (key: keyof T, value: T[keyof T]) => void, (key: keyof T) => void] {
  const [state, setState] = useState<T>(() => {
    if (!yMap) return {} as T

    const obj: any = {}
    yMap.forEach((value, key) => {
      obj[key] = value
    })
    return obj
  })

  useEffect(() => {
    if (!yMap) return

    const observer = () => {
      const obj: any = {}
      yMap.forEach((value, key) => {
        obj[key] = value
      })
      setState(obj)
    }

    yMap.observe(observer)
    observer() // Initial sync

    return () => {
      yMap.unobserve(observer)
    }
  }, [yMap])

  const set = useCallback(
    (key: keyof T, value: T[keyof T]) => {
      yMap?.set(key as string, value)
    },
    [yMap]
  )

  const deleteKey = useCallback(
    (key: keyof T) => {
      yMap?.delete(key as string)
    },
    [yMap]
  )

  return [state, set, deleteKey]
}

/**
 * Hook for tracking user cursor position
 */
export function useCursorTracking(
  enabled: boolean = true,
  updatePresence?: (update: Partial<CRDTPresence>) => void
) {
  const rafRef = useRef<number>(0)
  const lastPositionRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!enabled || !updatePresence) return

    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e

      // Throttle updates using RAF
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }

      rafRef.current = requestAnimationFrame(() => {
        // Only update if position changed significantly
        const dx = Math.abs(clientX - lastPositionRef.current.x)
        const dy = Math.abs(clientY - lastPositionRef.current.y)

        if (dx > 5 || dy > 5) {
          lastPositionRef.current = { x: clientX, y: clientY }

          updatePresence({
            cursor: {
              x: clientX,
              y: clientY,
              graphId: 'current', // You'd get this from your app state
            },
          })
        }
      })
    }

    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [enabled, updatePresence])
}

/**
 * Hook for undo/redo functionality
 */
export function useUndoRedo(doc: Y.Doc) {
  const [undoManager] = useState(
    () =>
      new Y.UndoManager([], {
        captureTimeout: 300,
        trackedOrigins: new Set(['user']),
      })
  )

  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  useEffect(() => {
    const updateState = () => {
      setCanUndo(undoManager.canUndo())
      setCanRedo(undoManager.canRedo())
    }

    undoManager.on('stack-item-added', updateState)
    undoManager.on('stack-item-popped', updateState)
    updateState()

    return () => {
      undoManager.destroy()
    }
  }, [undoManager])

  const undo = useCallback(() => {
    undoManager.undo()
  }, [undoManager])

  const redo = useCallback(() => {
    undoManager.redo()
  }, [undoManager])

  return { undo, redo, canUndo, canRedo }
}
