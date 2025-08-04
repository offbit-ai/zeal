/**
 * CRDT Persistence Layer
 *
 * Handles local persistence of CRDT documents using IndexedDB
 * and provides sync capabilities for offline-first functionality.
 */

import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import type { CRDTWorkflowDoc, CRDTSyncState } from './types'

export interface PersistenceConfig {
  dbName?: string
  storeName?: string
  // Auto-save interval in milliseconds
  autoSaveInterval?: number
  // Maximum number of snapshots to keep
  maxSnapshots?: number
  // Enable compression
  enableCompression?: boolean
}

const DEFAULT_CONFIG: Required<PersistenceConfig> = {
  dbName: 'zeal-crdt',
  storeName: 'workflows',
  autoSaveInterval: 1000, // 1 second
  maxSnapshots: 50,
  enableCompression: true,
}

/**
 * Manages persistence of CRDT documents
 */
export class CRDTPersistence {
  private config: Required<PersistenceConfig>
  private providers: Map<string, IndexeddbPersistence> = new Map()
  private syncStates: Map<string, CRDTSyncState> = new Map()

  constructor(config: PersistenceConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Initialize persistence for a Y.Doc
   */
  async initializeDoc(
    docName: string,
    doc: Y.Doc,
    onSynced?: () => void
  ): Promise<IndexeddbPersistence> {
    // Check if already initialized
    if (this.providers.has(docName)) {
      return this.providers.get(docName)!
    }

    // Create IndexedDB provider
    const provider = new IndexeddbPersistence(
      docName,
      doc
      // {
      //   dbName: this.config.dbName,
      //   storeName: this.config.storeName
      // }
    )

    // Set initial sync state
    this.syncStates.set(docName, {
      isSyncing: true,
      lastSyncedAt: undefined,
      pendingChanges: 0,
      peers: [],
    })

    // Handle sync events
    provider.on('synced', () => {
      this.updateSyncState(docName, {
        isSyncing: false,
        lastSyncedAt: Date.now(),
      })
      onSynced?.()
    })

    this.providers.set(docName, provider)
    return provider
  }

  /**
   * Load a document from persistence
   */
  async loadDoc(docName: string): Promise<Y.Doc | null> {
    const db = await this.openDB()
    const tx = db.transaction([this.config.storeName], 'readonly')
    const store = tx.objectStore(this.config.storeName)

    return new Promise(resolve => {
      const request = store.get(docName)

      request.onsuccess = () => {
        if (request.result) {
          const doc = new Y.Doc({ guid: docName })
          const update = request.result.update

          if (update instanceof Uint8Array) {
            Y.applyUpdate(doc, update)
            resolve(doc)
          } else {
            resolve(null)
          }
        } else {
          resolve(null)
        }
      }

      request.onerror = () => {
        console.error('Failed to load document:', request.error)
        resolve(null)
      }
    })
  }

  /**
   * Save a document snapshot
   */
  async saveSnapshot(docName: string, doc: Y.Doc, metadata?: any): Promise<void> {
    const snapshot = {
      id: `${docName}-${Date.now()}`,
      docName,
      timestamp: Date.now(),
      update: Y.encodeStateAsUpdate(doc),
      metadata: metadata || {},
      size: doc.store.clients.size,
    }

    const db = await this.openDB()
    const tx = db.transaction(['snapshots'], 'readwrite')
    const store = tx.objectStore('snapshots')

    await new Promise<void>((resolve, reject) => {
      const request = store.add(snapshot)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    // Clean up old snapshots
    await this.cleanupSnapshots(docName)
  }

  /**
   * Load document from a specific snapshot
   */
  async loadFromSnapshot(snapshotId: string): Promise<Y.Doc | null> {
    const db = await this.openDB()
    const tx = db.transaction(['snapshots'], 'readonly')
    const store = tx.objectStore('snapshots')

    return new Promise(resolve => {
      const request = store.get(snapshotId)

      request.onsuccess = () => {
        if (request.result) {
          const doc = new Y.Doc({ guid: request.result.docName })
          Y.applyUpdate(doc, request.result.update)
          resolve(doc)
        } else {
          resolve(null)
        }
      }

      request.onerror = () => {
        console.error('Failed to load snapshot:', request.error)
        resolve(null)
      }
    })
  }

  /**
   * List all snapshots for a document
   */
  async listSnapshots(docName: string): Promise<
    Array<{
      id: string
      timestamp: number
      metadata: any
    }>
  > {
    const db = await this.openDB()
    const tx = db.transaction(['snapshots'], 'readonly')
    const store = tx.objectStore('snapshots')
    const index = store.index('docName')

    return new Promise(resolve => {
      const snapshots: any[] = []
      const request = index.openCursor(IDBKeyRange.only(docName))

      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          snapshots.push({
            id: cursor.value.id,
            timestamp: cursor.value.timestamp,
            metadata: cursor.value.metadata,
          })
          cursor.continue()
        } else {
          resolve(snapshots.sort((a, b) => b.timestamp - a.timestamp))
        }
      }

      request.onerror = () => {
        console.error('Failed to list snapshots:', request.error)
        resolve([])
      }
    })
  }

  /**
   * Delete a document and all its data
   */
  async deleteDoc(docName: string): Promise<void> {
    // Remove provider
    const provider = this.providers.get(docName)
    if (provider) {
      provider.destroy()
      this.providers.delete(docName)
    }

    // Delete from IndexedDB
    const db = await this.openDB()
    const tx = db.transaction([this.config.storeName, 'snapshots'], 'readwrite')

    // Delete document
    await new Promise<void>((resolve, reject) => {
      const request = tx.objectStore(this.config.storeName).delete(docName)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    // Delete snapshots
    const snapshotStore = tx.objectStore('snapshots')
    const index = snapshotStore.index('docName')
    const range = IDBKeyRange.only(docName)

    await new Promise<void>(resolve => {
      const request = index.openCursor(range)

      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          snapshotStore.delete(cursor.primaryKey)
          cursor.continue()
        } else {
          resolve()
        }
      }
    })
  }

  /**
   * Get sync state for a document
   */
  getSyncState(docName: string): CRDTSyncState | undefined {
    return this.syncStates.get(docName)
  }

  /**
   * Update sync state
   */
  private updateSyncState(docName: string, update: Partial<CRDTSyncState>): void {
    const current = this.syncStates.get(docName) || {
      isSyncing: false,
      lastSyncedAt: undefined,
      pendingChanges: 0,
      peers: [],
    }

    this.syncStates.set(docName, { ...current, ...update })
  }

  /**
   * Clean up old snapshots
   */
  private async cleanupSnapshots(docName: string): Promise<void> {
    const snapshots = await this.listSnapshots(docName)

    if (snapshots.length > this.config.maxSnapshots) {
      const db = await this.openDB()
      const tx = db.transaction(['snapshots'], 'readwrite')
      const store = tx.objectStore('snapshots')

      // Delete oldest snapshots
      const toDelete = snapshots.slice(this.config.maxSnapshots)

      for (const snapshot of toDelete) {
        await new Promise<void>(resolve => {
          const request = store.delete(snapshot.id)
          request.onsuccess = () => resolve()
        })
      }
    }
  }

  /**
   * Open IndexedDB database
   */
  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, 2)

      request.onupgradeneeded = event => {
        const db = request.result

        // Main document store
        if (!db.objectStoreNames.contains(this.config.storeName)) {
          db.createObjectStore(this.config.storeName, { keyPath: 'name' })
        }

        // Snapshots store
        if (!db.objectStoreNames.contains('snapshots')) {
          const snapshotStore = db.createObjectStore('snapshots', {
            keyPath: 'id',
          })
          snapshotStore.createIndex('docName', 'docName', { unique: false })
          snapshotStore.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Export document as JSON
   */
  async exportDoc(docName: string, doc: Y.Doc): Promise<any> {
    const state = doc.toJSON()
    const update = Y.encodeStateAsUpdate(doc)

    return {
      version: '1.0',
      docName,
      timestamp: Date.now(),
      state,
      update: Array.from(update), // Convert to array for JSON
      metadata: {
        clientsCount: doc.store.clients.size,
        updatesCount: 0,
      },
    }
  }

  /**
   * Import document from JSON
   */
  async importDoc(data: any): Promise<Y.Doc> {
    const doc = new Y.Doc({ guid: data.docName })

    if (data.update && Array.isArray(data.update)) {
      const update = new Uint8Array(data.update)
      Y.applyUpdate(doc, update)
    }

    return doc
  }

  /**
   * Destroy persistence manager
   */
  destroy(): void {
    this.providers.forEach(provider => provider.destroy())
    this.providers.clear()
    this.syncStates.clear()
  }
}
