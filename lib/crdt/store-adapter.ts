/**
 * CRDT-Zustand Store Adapter
 * 
 * This adapter bridges Y.js CRDTs with Zustand stores, enabling
 * real-time collaboration while maintaining the existing store API.
 */

import * as Y from 'yjs'
import { StoreApi, StateCreator } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { CRDTWorkflowDoc } from './types'

export interface CRDTStoreOptions {
  docName: string
  gcEnabled?: boolean
  gcInterval?: number
}

/**
 * Middleware that adds CRDT capabilities to a Zustand store
 */
export function withCRDT<T extends object>(
  options: CRDTStoreOptions
) {
  return <TState extends T>(
    config: StateCreator<
      TState,
      [],
      [],
      TState
    >
  ): StateCreator<
    TState & {
      doc: Y.Doc
      undoManager: Y.UndoManager
      syncState: {
        isSyncing: boolean
        lastSyncedAt: number | null
        peers: string[]
      }
      undo: () => void
      redo: () => void
      canUndo: () => boolean
      canRedo: () => boolean
      getCRDTState: () => any
      applyUpdate: (update: Uint8Array) => void
      getUpdatesSince: (stateVector?: Uint8Array) => Uint8Array
    },
    [],
    [['zustand/subscribeWithSelector', never]],
    TState & {
      doc: Y.Doc
      undoManager: Y.UndoManager
      syncState: {
        isSyncing: boolean
        lastSyncedAt: number | null
        peers: string[]
      }
      undo: () => void
      redo: () => void
      canUndo: () => boolean
      canRedo: () => boolean
      getCRDTState: () => any
      applyUpdate: (update: Uint8Array) => void
      getUpdatesSince: (stateVector?: Uint8Array) => Uint8Array
    }
  > => {
    return subscribeWithSelector((set, get, api) => {
      // Create Y.Doc instance
      const doc = new Y.Doc({
        gc: options.gcEnabled ?? true,
        gcFilter: () => true,
        guid: options.docName
      })

      // Create undo manager
      const undoManager = new Y.UndoManager([], {
        captureTimeout: 300,
        trackedOrigins: new Set(['user'])
      })

      // Initial sync state
      const syncState = {
        isSyncing: false,
        lastSyncedAt: null as number | null,
        peers: [] as string[]
      }

      // Create the base store
      const baseStore = config(
        (partial) => {
          // Wrap set to also update Y.Doc
          const ydocTransaction = () => {
            doc.transact(() => {
              // Update Y.Doc based on state changes
              const state = typeof partial === 'function' 
                ? partial(get() as TState)
                : partial
              
              updateYDocFromState(doc, state)
            }, 'user')
          }

          // Update local state and Y.Doc
          set(partial as any)
          ydocTransaction()
        },
        get,
        api
      ) as TState

      // Sync Y.Doc changes back to store
      doc.on('update', (update: Uint8Array, origin: any) => {
        if (origin !== 'user') {
          // Update from remote, sync to local store
          const newState = getStateFromYDoc<TState>(doc)
          set({ ...get(), ...newState })
        }
      })

      // Track sync state
      doc.on('sync', (isSyncing: boolean) => {
        set((state) => ({
          ...state,
          syncState: {
            ...state.syncState,
            isSyncing,
            lastSyncedAt: isSyncing ? null : Date.now()
          }
        }))
      })

      return {
        ...baseStore,
        doc,
        undoManager,
        syncState,

        // Additional CRDT methods
        undo: () => {
          undoManager.undo()
        },
        
        redo: () => {
          undoManager.redo()
        },

        canUndo: () => undoManager.canUndo(),
        canRedo: () => undoManager.canRedo(),

        // Get CRDT-specific data
        getCRDTState: () => doc.toJSON(),
        
        // Apply remote updates
        applyUpdate: (update: Uint8Array) => {
          Y.applyUpdate(doc, update)
        },

        // Get updates since a specific state
        getUpdatesSince: (stateVector?: Uint8Array) => {
          if (stateVector) {
            return Y.encodeStateAsUpdate(doc, stateVector)
          }
          return Y.encodeStateAsUpdate(doc)
        }
      }
    })
  }
}

/**
 * Helper to update Y.Doc from state changes
 */
function updateYDocFromState(doc: Y.Doc, state: any) {
  const stateMap = doc.getMap('state')
  
  Object.entries(state).forEach(([key, value]) => {
    if (key === 'doc' || key === 'undoManager' || key === 'syncState') {
      return // Skip CRDT internals
    }

    if (value === null || value === undefined) {
      stateMap.delete(key)
    } else if (Array.isArray(value)) {
      const yArray = new Y.Array()
      yArray.push(value)
      stateMap.set(key, yArray)
    } else if (typeof value === 'object') {
      const yMap = new Y.Map()
      Object.entries(value).forEach(([k, v]) => {
        yMap.set(k, v)
      })
      stateMap.set(key, yMap)
    } else {
      stateMap.set(key, value)
    }
  })
}

/**
 * Helper to get state from Y.Doc
 */
function getStateFromYDoc<T>(doc: Y.Doc): Partial<T> {
  const stateMap = doc.getMap('state')
  const state: any = {}

  stateMap.forEach((value, key) => {
    if (value instanceof Y.Array) {
      state[key] = value.toArray()
    } else if (value instanceof Y.Map) {
      const obj: any = {}
      value.forEach((v, k) => {
        obj[k] = v
      })
      state[key] = obj
    } else {
      state[key] = value
    }
  })

  return state
}

/**
 * Create a Y.js document from existing state
 */
export function createYDocFromState<T extends object>(
  state: T,
  docName: string
): Y.Doc {
  const doc = new Y.Doc({ guid: docName })
  
  doc.transact(() => {
    updateYDocFromState(doc, state)
  })

  return doc
}

/**
 * Merge two Y.Docs
 */
export function mergeYDocs(target: Y.Doc, source: Y.Doc): void {
  const update = Y.encodeStateAsUpdate(source)
  Y.applyUpdate(target, update)
}

/**
 * Create a snapshot of current Y.Doc state
 */
export function createYDocSnapshot(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc)
}

/**
 * Restore Y.Doc from snapshot
 */
export function restoreYDocFromSnapshot(
  doc: Y.Doc,
  snapshot: Uint8Array
): void {
  Y.applyUpdate(doc, snapshot)
}