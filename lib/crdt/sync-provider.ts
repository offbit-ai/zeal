/**
 * WebSocket Sync Provider for CRDT
 *
 * Enables real-time collaboration by synchronizing Y.js documents
 * across multiple clients using WebSocket connections.
 */

import * as Y from 'yjs'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import type { CRDTPresence } from './types'

/**
 * Message types for WebSocket communication
 */
export enum MessageType {
  SYNC = 0,
  AWARENESS = 1,
  AUTH = 2,
  QUERY_AWARENESS = 3,
  CUSTOM = 4,
}

/**
 * WebSocket provider configuration
 */
export interface WebSocketProviderConfig {
  url: string
  roomName: string
  params?: Record<string, string>
  protocols?: string[]
  resyncInterval?: number
  maxBackoffTime?: number
  disableBc?: boolean
  auth?: {
    token?: string
    userId?: string
    userName?: string
  }
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected') => void
  onSyncComplete?: () => void
  onError?: (error: Error) => void
}

/**
 * WebSocket provider for Y.js document synchronization
 */
export class WebSocketProvider {
  private doc: Y.Doc
  private awareness: awarenessProtocol.Awareness
  private ws: WebSocket | null = null
  private config: WebSocketProviderConfig
  private synced = false
  private connected = false
  private connecting = false
  private unsuccessfulReconnects = 0
  private messageQueue: Uint8Array[] = []
  private bcChannel: BroadcastChannel | null = null

  constructor(doc: Y.Doc, config: WebSocketProviderConfig) {
    this.doc = doc
    this.config = config

    // Initialize awareness
    this.awareness = new awarenessProtocol.Awareness(doc)

    // Set up broadcast channel for local sync
    if (!config.disableBc && typeof BroadcastChannel !== 'undefined') {
      this.bcChannel = new BroadcastChannel(`yjs-${config.roomName}`)
      this.setupBroadcastChannel()
    }

    // Set initial user state
    if (config.auth) {
      this.setUserState({
        userId: config.auth.userId || 'anonymous',
        userName: config.auth.userName || 'Anonymous',
        userColor: this.generateUserColor(config.auth.userId || 'anonymous'),
      })
    }

    // Connect to WebSocket
    this.connect()

    // Set up document observers
    this.setupDocumentObservers()
  }

  /**
   * Connect to WebSocket server
   */
  private connect(): void {
    if (this.connecting || this.connected) return

    this.connecting = true
    this.config.onStatusChange?.('connecting')

    const url = new URL(this.config.url)
    url.searchParams.set('room', this.config.roomName)

    // Add auth params
    if (this.config.auth?.token) {
      url.searchParams.set('token', this.config.auth.token)
    }

    // Add custom params
    if (this.config.params) {
      Object.entries(this.config.params).forEach(([key, value]) => {
        url.searchParams.set(key, value)
      })
    }

    this.ws = new WebSocket(url.toString(), this.config.protocols)
    this.ws.binaryType = 'arraybuffer'

    this.ws.onopen = () => {
      this.connecting = false
      this.connected = true
      this.unsuccessfulReconnects = 0
      this.config.onStatusChange?.('connected')

      // Send auth message if configured
      if (this.config.auth) {
        this.send(
          MessageType.AUTH,
          encoding.encode(encoder => {
            encoding.writeVarString(encoder, JSON.stringify(this.config.auth))
          })
        )
      }

      // Send sync step 1
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, MessageType.SYNC)
      syncProtocol.writeSyncStep1(encoder, this.doc)
      this.send(MessageType.SYNC, encoding.toUint8Array(encoder))

      // Query awareness states
      if (this.awareness.getLocalState() !== null) {
        this.send(
          MessageType.AWARENESS,
          awarenessProtocol.encodeAwarenessUpdate(this.awareness, [this.doc.clientID])
        )
      }

      // Flush message queue
      this.messageQueue.forEach(message => {
        this.ws?.send(message)
      })
      this.messageQueue = []
    }

    this.ws.onmessage = event => {
      this.handleMessage(new Uint8Array(event.data))
    }

    this.ws.onclose = () => {
      this.handleDisconnect()
    }

    this.ws.onerror = event => {
      this.config.onError?.(new Error('WebSocket error'))
      this.handleDisconnect()
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: Uint8Array): void {
    const decoder = decoding.createDecoder(data)
    const messageType = decoding.readVarUint(decoder)

    switch (messageType) {
      case MessageType.SYNC:
        this.handleSyncMessage(decoder)
        break

      case MessageType.AWARENESS:
        awarenessProtocol.applyAwarenessUpdate(
          this.awareness,
          decoding.readVarUint8Array(decoder),
          this
        )
        break

      case MessageType.QUERY_AWARENESS:
        this.send(
          MessageType.AWARENESS,
          awarenessProtocol.encodeAwarenessUpdate(
            this.awareness,
            Array.from(this.awareness.getStates().keys())
          )
        )
        break

      case MessageType.CUSTOM:
        this.handleCustomMessage(decoder)
        break
    }
  }

  /**
   * Handle sync protocol messages
   */
  private handleSyncMessage(decoder: decoding.Decoder): void {
    const encoder = encoding.createEncoder()
    const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, this.doc, this)

    if (encoding.length(encoder) > 0) {
      this.send(MessageType.SYNC, encoding.toUint8Array(encoder))
    }

    if (syncMessageType === syncProtocol.messageYjsSyncStep2) {
      this.synced = true
      this.config.onSyncComplete?.()
    }
  }

  /**
   * Handle custom messages
   */
  private handleCustomMessage(decoder: decoding.Decoder): void {
    const message = decoding.readVarString(decoder)
    try {
      const data = JSON.parse(message)
      // Handle custom message types
      // console.log removed
    } catch (error) {
      console.error('Failed to parse custom message:', error)
    }
  }

  /**
   * Send message to WebSocket server
   */
  private send(type: MessageType, data: Uint8Array): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, type)
      encoding.writeUint8Array(encoder, data)
      this.ws.send(encoding.toUint8Array(encoder))
    } else {
      this.messageQueue.push(data)
    }
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(): void {
    this.connected = false
    this.connecting = false
    this.synced = false
    this.config.onStatusChange?.('disconnected')

    // Clean up WebSocket
    if (this.ws) {
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onclose = null
      this.ws.onerror = null
      this.ws = null
    }

    // Schedule reconnection
    this.scheduleReconnect()
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    const backoffTime = Math.min(
      Math.pow(2, this.unsuccessfulReconnects) * 1000,
      this.config.maxBackoffTime || 30000
    )

    this.unsuccessfulReconnects++

    setTimeout(() => {
      if (!this.connected && !this.connecting) {
        this.connect()
      }
    }, backoffTime)
  }

  /**
   * Set up document observers
   */
  private setupDocumentObservers(): void {
    // Observe document updates
    this.doc.on('update', (update: Uint8Array, origin: any) => {
      if (origin !== this) {
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, MessageType.SYNC)
        syncProtocol.writeUpdate(encoder, update)
        this.send(MessageType.SYNC, encoding.toUint8Array(encoder))
      }
    })

    // Observe awareness updates
    this.awareness.on('update', ({ added, updated, removed }: any) => {
      const changedClients = added.concat(updated, removed)
      if (changedClients.length > 0) {
        this.send(
          MessageType.AWARENESS,
          awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
        )
      }
    })

    // Periodic resync
    if (this.config.resyncInterval) {
      setInterval(() => {
        if (this.connected) {
          const encoder = encoding.createEncoder()
          encoding.writeVarUint(encoder, MessageType.SYNC)
          syncProtocol.writeSyncStep1(encoder, this.doc)
          this.send(MessageType.SYNC, encoding.toUint8Array(encoder))
        }
      }, this.config.resyncInterval)
    }
  }

  /**
   * Set up broadcast channel for local sync
   */
  private setupBroadcastChannel(): void {
    if (!this.bcChannel) return

    this.bcChannel.onmessage = event => {
      if (event.data.type === 'update') {
        Y.applyUpdate(this.doc, event.data.update, this)
      } else if (event.data.type === 'awareness') {
        awarenessProtocol.applyAwarenessUpdate(this.awareness, event.data.update, this)
      }
    }

    // Broadcast local updates
    this.doc.on('update', (update: Uint8Array, origin: any) => {
      if (origin !== this && this.bcChannel) {
        this.bcChannel.postMessage({
          type: 'update',
          update,
        })
      }
    })

    this.awareness.on('update', ({ added, updated, removed }: any) => {
      if (this.bcChannel) {
        const update = awarenessProtocol.encodeAwarenessUpdate(
          this.awareness,
          added.concat(updated, removed)
        )
        this.bcChannel.postMessage({
          type: 'awareness',
          update,
        })
      }
    })
  }

  /**
   * Set user state in awareness
   */
  setUserState(state: Partial<CRDTPresence>): void {
    const currentState = this.awareness.getLocalState() || {}
    this.awareness.setLocalState({
      ...currentState,
      ...state,
      lastSeen: Date.now(),
    })
  }

  /**
   * Get all connected users
   */
  getUsers(): Map<number, CRDTPresence> {
    const users = new Map<number, CRDTPresence>()

    this.awareness.getStates().forEach((state, clientId) => {
      if (state) {
        users.set(clientId, state as CRDTPresence)
      }
    })

    return users
  }

  /**
   * Send custom message
   */
  sendCustomMessage(data: any): void {
    const encoder = encoding.createEncoder()
    encoding.writeVarString(encoder, JSON.stringify(data))
    this.send(MessageType.CUSTOM, encoding.toUint8Array(encoder))
  }

  /**
   * Generate consistent user color
   */
  private generateUserColor(userId: string): string {
    const colors = [
      '#ef4444',
      '#f59e0b',
      '#10b981',
      '#3b82f6',
      '#8b5cf6',
      '#ec4899',
      '#06b6d4',
      '#84cc16',
    ]

    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash)
    }

    return colors[Math.abs(hash) % colors.length]
  }

  /**
   * Disconnect and clean up
   */
  disconnect(): void {
    this.connected = false

    if (this.ws) {
      this.ws.close()
    }

    if (this.bcChannel) {
      this.bcChannel.close()
    }

    this.awareness.destroy()
  }

  /**
   * Get connection status
   */
  get isConnected(): boolean {
    return this.connected
  }

  /**
   * Get sync status
   */
  get isSynced(): boolean {
    return this.synced
  }
}
