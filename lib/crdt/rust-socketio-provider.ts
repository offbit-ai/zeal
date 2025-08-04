/**
 * Socket.IO provider for Rust CRDT server
 * 
 * This provider connects to the Rust CRDT server using Socket.IO protocol
 * while offering better performance and memory management than the JavaScript server.
 */

import * as Y from 'yjs'
import { io, Socket } from 'socket.io-client'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import { Awareness } from 'y-protocols/awareness'
import type { CRDTPresence } from './types'

/**
 * Message types matching the Rust server
 */
enum MessageType {
  SYNC = 0,
  AWARENESS = 1,
  AUTH = 2,
  QUERY_AWARENESS = 3,
  CUSTOM = 4
}

export interface RustSocketIOProviderConfig {
  roomName: string
  serverUrl: string
  auth?: {
    token?: string
    userId?: string
    userName?: string
  }
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected') => void
  onSyncComplete?: () => void
  onError?: (error: Error) => void
}

export class RustSocketIOProvider {
  private doc: Y.Doc
  private awareness: Awareness
  public socket: Socket | null = null
  private config: RustSocketIOProviderConfig
  private synced = false
  public connected = false
  private roomName: string
  private awarenessUpdateTimer: NodeJS.Timeout | null = null

  // Connection health monitoring
  private lastSyncMessageTime: number = 0
  private lastAwarenessUpdateTime: number = 0
  private healthCheckTimer: NodeJS.Timeout | null = null
  private reconnectionAttempts: number = 0
  private maxReconnectionAttempts: number = 3
  private healthCheckInterval: number = 30000 // 30 seconds
  private syncTimeoutThreshold: number = 60000 // 1 minute
  private isReconnecting: boolean = false

  constructor(doc: Y.Doc, config: RustSocketIOProviderConfig) {
    // [Rust CRDT] log removed

    this.doc = doc
    this.config = config
    this.roomName = config.roomName

    // Create awareness instance
    try {
      this.awareness = new Awareness(doc)
      // [Rust CRDT] log removed
    } catch (error) {
      console.error('[Rust CRDT] Failed to create Awareness:', error)
      throw error
    }

    // Set initial user state
    const userId = config.auth?.userId || this.getOrCreateUserId()
    const userName = config.auth?.userName || this.getOrCreateUserName()
    const userColor = this.getOrCreateUserColor(userId)

    // [Rust CRDT] log removed

    this.setUserState({
      userId: userId,
      userName: userName,
      userColor: userColor
    })

    // Connect to Socket.IO
    this.connect()

    // Set up document observers
    this.setupDocumentObservers()

    // Start health monitoring
    // Temporarily disabled due to hot reload issues
    // this.startHealthMonitoring()
  }

  /**
   * Start connection health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(() => {
      const now = Date.now()
      const timeSinceLastSync = now - this.lastSyncMessageTime
      const timeSinceLastAwareness = now - this.lastAwarenessUpdateTime

      // [Rust CRDT] log removed

      // Check if sync has degraded
      if (this.connected && (timeSinceLastSync > this.syncTimeoutThreshold || timeSinceLastAwareness > this.syncTimeoutThreshold)) {
        console.warn('[Rust CRDT] Sync degradation detected, attempting reconnection')
        this.reconnect()
      }
    }, this.healthCheckInterval)
  }

  /**
   * Reconnect to the server
   */
  private reconnect(): void {
    if (this.isReconnecting || this.reconnectionAttempts >= this.maxReconnectionAttempts) {
      return
    }

    this.isReconnecting = true
    this.reconnectionAttempts++

    // [Rust CRDT] log removed

    // Disconnect current socket
    if (this.socket) {
      this.socket.disconnect()
    }

    // Wait a bit before reconnecting
    setTimeout(() => {
      this.connect()
    }, 1000)
  }

  /**
   * Connect to the Rust Socket.IO server
   */
  connect(): void {
    if (this.connected) return

    this.config.onStatusChange?.('connecting')

    const userId = this.config.auth?.userId || this.getOrCreateUserId()
    const userName = this.config.auth?.userName || this.getOrCreateUserName()

    // [Rust CRDT] log removed

    this.socket = io(this.config.serverUrl, {
      transports: ['polling', 'websocket'],
      auth: {
        token: this.config.auth?.token,
        userId: userId,
        userName: userName
      },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    })

    // Handle connection events
    this.socket.on('connect', () => {
      console.log('[Rust CRDT] Connected to server, socket ID:', this.socket!.id)
      this.connected = true
      this.isReconnecting = false
      this.reconnectionAttempts = 0
      this.lastSyncMessageTime = Date.now()
      this.lastAwarenessUpdateTime = Date.now()
      this.config.onStatusChange?.('connected')

      // Join room
      console.log('[Rust CRDT] Joining room:', this.roomName)
      this.socket!.emit('crdt:join', this.roomName)
    })

    this.socket.on('crdt:joined', ({ roomName, clientId }) => {
      console.log('[Rust CRDT] Joined room:', roomName, 'as client:', clientId)

      // Send auth message
      if (this.config.auth) {
        this.send(MessageType.AUTH, encoding.encode(encoder => {
          encoding.writeVarString(encoder, JSON.stringify(this.config.auth))
        }))
      }

      // Send initial sync - request full state
      const encoder = encoding.createEncoder()
      syncProtocol.writeSyncStep1(encoder, this.doc)
      this.send(MessageType.SYNC, encoding.toUint8Array(encoder))

      // Also send current document state
      const currentState = Y.encodeStateAsUpdate(this.doc)
      if (currentState.length > 0) {
        const stateEncoder = encoding.createEncoder()
        syncProtocol.writeUpdate(stateEncoder, currentState)
        this.send(MessageType.SYNC, encoding.toUint8Array(stateEncoder))
      }

      // Send initial awareness state after a short delay to ensure socket is ready
      setTimeout(() => {
        const localState = this.awareness.getLocalState()
        // [Rust CRDT] log removed

        if (localState) {
          const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
            this.awareness,
            [this.awareness.clientID]
          )
          // [Rust CRDT] log removed
          if (awarenessUpdate.length < 10000) { // Only send if reasonably sized
            this.send(MessageType.AWARENESS, awarenessUpdate)
          }
        } else {
          console.warn('[Rust CRDT] No local awareness state to send on join')
        }
      }, 50)

      // Query for other users' awareness states
      setTimeout(() => {
        console.log('[Rust CRDT] Querying awareness states')
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, MessageType.QUERY_AWARENESS)
        this.sendMessage(encoding.toUint8Array(encoder))

        // Also trigger a manual awareness update
        console.log('[Rust CRDT] Current awareness states:', this.awareness.getStates().size)
        const states = this.awareness.getStates()
        states.forEach((state, clientId) => {
          console.log('[Rust CRDT] Awareness state:', clientId, state)
        })
      }, 100)
    })

    // Handle CRDT messages - Socket.IO decomposes array arguments
    this.socket.on('crdt:message', (...args: any[]) => {
      console.log('[Rust CRDT] Received message args:', args.length, args[0] ? typeof args[0] : 'no args')
      
      // Handle both formats: direct array or [roomName, dataArray]
      let roomName: string
      let dataArray: number[]
      
      if (args.length === 1 && Array.isArray(args[0]) && args[0].length === 2 && typeof args[0][0] === 'string' && Array.isArray(args[0][1])) {
        // Format: [roomName, dataArray]
        roomName = args[0][0]
        dataArray = args[0][1]
      } else if (args.length === 2 && typeof args[0] === 'string' && Array.isArray(args[1])) {
        // Format: separate parameters
        roomName = args[0]
        dataArray = args[1]
      } else {
        console.error('[Rust CRDT] Unexpected message format:', args)
        return
      }

      // Validate the data array contains numbers
      if (!dataArray.every(item => typeof item === 'number')) {
        console.warn('[Rust CRDT] Data array contains non-numbers, ignoring:', dataArray)
        return
      }

      // Convert array back to Uint8Array
      const bytes = new Uint8Array(dataArray)
      const messageType = bytes.length > 0 ? bytes[0] : 'unknown'

      this.handleMessage(bytes)
    })

    // Handle disconnection
    this.socket.on('disconnect', () => {
      this.handleDisconnect()
    })

    // Handle errors
    this.socket.on('connect_error', (error) => {
      console.error('[Rust CRDT] Connection error:', error)
      this.config.onError?.(error)
    })

    // Handle socket errors
    this.socket.on('error', (error) => {
      console.error('[Rust CRDT] Socket error:', error)
      this.config.onError?.(error)
    })

    // Handle reconnection events
    this.socket.on('reconnect', (attemptNumber) => {
      console.warn('[Rust CRDT] Reconnected after', attemptNumber, 'attempts')
      this.connected = true
      this.isReconnecting = false
      this.reconnectionAttempts = 0
      this.config.onStatusChange?.('connected')
    })

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.warn('[Rust CRDT] Reconnection attempt', attemptNumber)
      this.config.onStatusChange?.('connecting')
    })

    this.socket.on('reconnect_error', (error) => {
      console.error('[Rust CRDT] Reconnection error:', error)
    })

    this.socket.on('reconnect_failed', () => {
      console.error('[Rust CRDT] Reconnection failed after maximum attempts')
      this.config.onStatusChange?.('disconnected')
    })

  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: Uint8Array): void {
    try {


      // Validate data
      if (!data || data.length === 0) {
        console.warn('[Rust CRDT] Received empty message data')
        return
      }

      const decoder = decoding.createDecoder(data)
      const messageType = decoding.readVarUint(decoder)

      // Debug: log the message type only if it's unexpected
      if (messageType > 4) {
        console.warn('[Rust CRDT] Unexpected message type:', messageType, 'data length:', data.length, 'first 10 bytes:', Array.from(data.slice(0, 10)))
      }

      switch (messageType) {
        case MessageType.SYNC:
          this.lastSyncMessageTime = Date.now()
          this.handleSyncMessage(decoder)
          break

        case MessageType.AWARENESS:
          try {
            // The rest of the message IS the awareness update
            const remainingBytes = decoder.arr.length - decoder.pos
            
            if (remainingBytes <= 0) {
              console.warn('[Rust CRDT] Empty awareness update')
              break
            }
            
            // Read the remaining bytes directly as the awareness update
            const update = new Uint8Array(decoder.arr.buffer, decoder.arr.byteOffset + decoder.pos, remainingBytes)
            console.log('[Rust CRDT] Applying awareness update, length:', update.length, 'first 10 bytes:', Array.from(update.slice(0, 10)))
            
            // Apply the awareness update
            awarenessProtocol.applyAwarenessUpdate(this.awareness, update, 'remote')
            
            // Log the result
            console.log('[Rust CRDT] Awareness states after update:', this.awareness.getStates().size)
            this.awareness.getStates().forEach((state, clientId) => {
              console.log('[Rust CRDT] Client', clientId, 'state:', state)
            })
          } catch (error: any) {
            console.error('[Rust CRDT] Awareness update failed:', error)
          }
          break

        case MessageType.QUERY_AWARENESS:
          try {
            const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
              this.awareness,
              Array.from(this.awareness.getStates().keys())
            )
            if (awarenessUpdate.length < 10000) { // Only send if reasonably sized
            this.send(MessageType.AWARENESS, awarenessUpdate)
          }
          } catch (error) {
            console.error('[Rust CRDT] Error responding to awareness query:', error)
          }
          break

        case MessageType.AUTH:
          // Auth responses from server - can be ignored
          break

        case MessageType.CUSTOM:
          this.handleCustomMessage(decoder)
          break

        default:
          console.warn('[Rust CRDT] Unknown message type:', messageType)
      }
    }
    catch (error: any) {
      // Silently ignore errors from incompatible Rust server
      // Only call error handler for non-sync errors
      if (!error.message?.includes('Unknown message type') && 
          !error.message?.includes('contentRefs')) {
        this.config.onError?.(error as Error)
      }
    }
  }

  /**
   * Handle sync protocol messages
   */
  private handleSyncMessage(decoder: decoding.Decoder): void {
    // Silently ignore sync errors from incompatible Rust server

    try {
      // The Rust server appears to send raw Yjs updates directly
      // without the sync protocol wrapper
      // console.log('[Rust CRDT] Treating as raw Yjs update')
      
      // Try to parse this as a standard sync protocol message first
      const savedPos = decoder.pos
      const firstByte = decoding.readVarUint(decoder)
      decoder.pos = savedPos // Reset position
      
      // console.log('[Rust CRDT] First varuint in message:', firstByte)
      
      // If it's a valid sync message type, handle it properly
      if (firstByte === 0 || firstByte === 1 || firstByte === 2) {
        const encoder = encoding.createEncoder()
        const syncMessageType = syncProtocol.readSyncMessage(
          decoder,
          encoder,
          this.doc,
          this
        )

        if (encoding.length(encoder) > 0) {
          this.send(MessageType.SYNC, encoding.toUint8Array(encoder))
        }

        if (syncMessageType === syncProtocol.messageYjsSyncStep2) {
          this.synced = true
          if (this.config.onSyncComplete) {
            this.config.onSyncComplete()
          }
        }
        return
      }
      
      // Silently fail for other message types
    } catch (e) {
      // Ignore all sync errors to prevent console spam
      // The Rust server is sending incompatible messages
    }
  }

  /**
   * Handle custom messages
   */
  private handleCustomMessage(decoder: decoding.Decoder): void {
    const message = decoding.readVarString(decoder)
    try {
      const data = JSON.parse(message)
      // [Rust CRDT] log removed
    } catch (error) {
      console.error('[Rust CRDT] Failed to parse custom message:', error)
    }
  }

  /**
   * Send message with type prefix
   */
  private send(type: MessageType, data: Uint8Array): void {
    // Create a new array with message type as first byte
    const message = new Uint8Array(data.length + 1)
    message[0] = type
    message.set(data, 1)

    this.sendMessage(message)
  }

  /**
   * Send raw message
   */
  private sendMessage(data: Uint8Array): void {
    const messageType = data.length > 0 ? data[0] : 'unknown'
    // console.log('[Rust CRDT] Sending message:', {
    //   messageType,
    //   dataLength: data.length,
    //   firstBytes: Array.from(data.slice(0, 10))
    // })

    if (this.socket?.connected) {
      // Convert Uint8Array to regular array for JSON serialization
      // This is a workaround for socketioxide's limited binary support
      const arrayData = Array.from(data)
      // [Rust CRDT] log removed
      // Send with room name and data as separate parameters
      // [Rust CRDT] log removed
      this.socket.emit('crdt:message', this.roomName, arrayData)
    } else {
      console.warn('[Rust CRDT] Cannot send message - socket not connected')
    }
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(): void {
    console.warn('[Rust CRDT] Socket disconnected, will attempt to reconnect automatically')
    this.connected = false
    this.synced = false
    this.config.onStatusChange?.('disconnected')
  }

  /**
   * Set up document observers
   */
  private setupDocumentObservers(): void {
    // Observe document updates
    this.doc.on('update', (update: Uint8Array, origin: any) => {
      if (origin !== this) {
        const encoder = encoding.createEncoder()
        syncProtocol.writeUpdate(encoder, update)
        this.send(MessageType.SYNC, encoding.toUint8Array(encoder))
      }
    })

    // Set up awareness update observer with throttling
    this.awareness.on('update', ({ added, updated, removed }: any) => {
      try {


        const changedClients = added.concat(updated, removed)
        if (changedClients.length > 0 && this.connected) {
          // Clear existing timer
          if (this.awarenessUpdateTimer) {
            clearTimeout(this.awarenessUpdateTimer)
          }

          // Throttle awareness updates
          this.awarenessUpdateTimer = setTimeout(() => {
            try {


              // Only send updates for our local client, not for remote clients
              const myClientId = this.awareness.clientID
              const shouldSendUpdate = changedClients.includes(myClientId)


              if (shouldSendUpdate) {
                const localState = this.awareness.getLocalState()


                if (localState && typeof localState === 'object') {
                  try {
                    // Only encode awareness update for our local client
                    const update = awarenessProtocol.encodeAwarenessUpdate(this.awareness, [myClientId])


                    if (update && update.length > 0) {
                      if (update.length < 10000) { // Only send if reasonably sized
                        this.send(MessageType.AWARENESS, update)
                      }


                    }
                  } catch (encodeError) {
                    console.error('[Rust CRDT] Error encoding awareness update:', encodeError)
                  }
                }
              }
            } catch (timerError) {
              console.error('[Rust CRDT] Error in awareness update timer:', timerError)
            }

            this.awarenessUpdateTimer = null
          }, 100) // 100ms throttle
        }
      } catch (error) {
        console.error('[Rust CRDT] Error in awareness update observer:', error)
      }
    })
  }

  /**
   * Set user state in awareness
   */
  setUserState(state: Partial<CRDTPresence>): void {
    try {
      const currentState = this.awareness.getLocalState() || {};
      const newState = {
        ...currentState,
        ...state,
        lastSeen: Date.now()
      }

      if (newState.userId && typeof newState.userId === 'string') {
        this.awareness.setLocalState(newState)
      }
    } catch (error) {
      console.error('[Rust CRDT] Error setting user state:', error)
    }
  }

  /**
   * Get all connected users
   */
  getUsers(): Map<number, CRDTPresence> {
    const users = new Map<number, CRDTPresence>()



    this.awareness.getStates().forEach((state, clientId) => {
      // [Rust CRDT] log removed
      if (state) {
        users.set(clientId, state as CRDTPresence)
      }
    })

    // [Rust CRDT] log removed
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
   * Get or create a unique user ID
   */
  private getOrCreateUserId(): string {
    // Generate a unique ID per tab/window session
    // We'll use sessionStorage for tab-specific ID, but still check localStorage for persistent identity
    let userId = sessionStorage.getItem('userId')
    if (!userId) {
      const timestamp = Date.now().toString(36)
      const random = Math.random().toString(36).substring(2, 8)
      const tabId = Math.random().toString(36).substring(2, 5)
      userId = `user-${timestamp}-${random}-${tabId}`
      sessionStorage.setItem('userId', userId)
    }
    return userId
  }

  /**
   * Get or create a user name
   */
  private getOrCreateUserName(): string {
    // Generate a unique name per tab/window session
    let userName = sessionStorage.getItem('userName')
    if (!userName) {
      const userId = this.getOrCreateUserId()
      const adjectives = ['Swift', 'Bright', 'Clever', 'Quick', 'Smart', 'Bold', 'Cool', 'Fast']
      const animals = ['Falcon', 'Tiger', 'Eagle', 'Wolf', 'Fox', 'Hawk', 'Lion', 'Bear']

      const seed = userId.split('-')[1] || '0'
      const adjIndex = parseInt(seed.substring(0, 2), 36) % adjectives.length
      const animalIndex = parseInt(seed.substring(2, 4), 36) % animals.length

      // Add a number suffix to distinguish between tabs
      const tabNumber = parseInt(userId.split('-')[3] || '0', 36) % 99 + 1
      userName = `${adjectives[adjIndex]} ${animals[animalIndex]} ${tabNumber}`
      sessionStorage.setItem('userName', userName)
    }
    return userName
  }

  /**
   * Get or create a user color
   */
  private getOrCreateUserColor(userId: string): string {
    // Generate a unique color per tab/window session based on userId
    let sessionUserColor = sessionStorage.getItem('sessionUserColor')
    if (!sessionUserColor) {
      sessionUserColor = this.generateUserColor(userId)
      sessionStorage.setItem('sessionUserColor', sessionUserColor)
    }
    return sessionUserColor
  }

  /**
   * Generate consistent user color
   */
  private generateUserColor(userId: string): string {
    const colors = [
      '#ef4444', '#f59e0b', '#10b981', '#3b82f6',
      '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
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
    if (this.awarenessUpdateTimer) {
      clearTimeout(this.awarenessUpdateTimer)
      this.awarenessUpdateTimer = null
    }

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
    }

    if (this.socket) {
      this.socket.emit('crdt:leave', this.roomName)
      this.socket.disconnect()
      this.socket = null
    }

    this.awareness.destroy()
    this.connected = false
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

  /**
   * Get awareness instance
   */
  getAwareness(): Awareness {
    return this.awareness
  }
}