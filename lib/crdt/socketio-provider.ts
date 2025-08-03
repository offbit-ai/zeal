/**
 * Socket.IO Provider for CRDT Synchronization
 * 
 * This provider uses Socket.IO instead of native WebSockets
 * to work seamlessly with Next.js API routes.
 */

import * as Y from 'yjs'
import { io, Socket } from 'socket.io-client'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import type { CRDTPresence } from './types'

/**
 * Message types for Socket.IO communication
 */
export enum MessageType {
  SYNC = 0,
  AWARENESS = 1,
  AUTH = 2,
  QUERY_AWARENESS = 3,
  CUSTOM = 4
}

/**
 * Socket.IO provider configuration
 */
export interface SocketIOProviderConfig {
  roomName: string
  socketPath?: string
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
 * Socket.IO provider for Y.js document synchronization
 */
export class SocketIOProvider {
  private doc: Y.Doc
  private awareness: awarenessProtocol.Awareness
  private socket: Socket | null = null
  private config: SocketIOProviderConfig
  private synced = false
  private connected = false
  private roomName: string
  private awarenessUpdateTimer: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000 // Start with 1 second
  
  constructor(doc: Y.Doc, config: SocketIOProviderConfig) {
    this.doc = doc
    this.config = config
    this.roomName = config.roomName
    
    // Create a completely fresh awareness instance
    this.awareness = new awarenessProtocol.Awareness(doc)
    
    // Clear any stale awareness states from previous sessions
    this.awareness.states.forEach((state, clientId) => {
      if (clientId !== this.awareness.clientID) {
        this.awareness.states.delete(clientId)
      }
    })
    
    // Set initial user state with unique identification
    const userId = config.auth?.userId || this.getOrCreateUserId()
    const userName = config.auth?.userName || this.getOrCreateUserName()
    const userColor = this.getOrCreateUserColor(userId)
    
    // [CRDT] log removed
    
    this.setUserState({
      userId: userId,
      userName: userName,
      userColor: userColor
    })
    
    // Connect to Socket.IO
    this.connect()
    
    // Set up document observers
    this.setupDocumentObservers()
  }

  /**
   * Connect to Socket.IO server
   */
  private connect(): void {
    if (this.connected) return
    
    this.config.onStatusChange?.('connecting')
    
    // Create Socket.IO connection
    const userId = this.config.auth?.userId || this.getOrCreateUserId()
    const userName = this.config.auth?.userName || this.getOrCreateUserName()
    
    // First, ensure the Socket.IO server is initialized
    fetch('/api/crdt/socket')
      .then(res => res.json())
      .then(data => {/* Socket server status checked */})
      .catch(err => console.error('[CRDT] Failed to check socket server:', err))
    
    // // [CRDT] log removed
    
    this.socket = io({
      path: '/api/crdt/socket',
      transports: ['polling', 'websocket'], // Start with polling for reliability
      auth: {
        token: this.config.auth?.token,
        userId: userId,
        userName: userName
      }
    })
    
    // Add error handler
    this.socket.on('connect_error', (error:any) => {
      console.error('[CRDT] Socket.IO connection error:', error.message)
      console.error('[CRDT] Error type:', error.type)
      console.error('[CRDT] Error details:', error)
    })
    
    // Handle connection events
    this.socket.on('connect', () => {
      // // [SocketIOProvider] log removed
      this.connected = true
      this.config.onStatusChange?.('connected')
      
      // Join room
      this.socket!.emit('crdt:join', this.roomName)
      // // [SocketIOProvider] log removed
    })
    
    this.socket.on('crdt:joined', ({ roomName, clientId }) => {
      // // [SocketIOProvider] log removed
      
      // Send auth message
      if (this.config.auth) {
        this.send(MessageType.AUTH, encoding.encode(encoder => {
          encoding.writeVarString(encoder, JSON.stringify(this.config.auth))
        }))
      }
      
      // Send initial sync - request full state
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, MessageType.SYNC)
      syncProtocol.writeSyncStep1(encoder, this.doc)
      this.sendMessage(encoding.toUint8Array(encoder))
      
      // Also send current document state
      const currentState = Y.encodeStateAsUpdate(this.doc)
      if (currentState.length > 0) {
        const stateEncoder = encoding.createEncoder()
        encoding.writeVarUint(stateEncoder, MessageType.SYNC)
        syncProtocol.writeUpdate(stateEncoder, currentState)
        this.sendMessage(encoding.toUint8Array(stateEncoder))
      }
      
      // Send initial awareness state - only send local state
      const localState = this.awareness.getLocalState()
      if (localState) {
        const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
          this.awareness,
          [this.awareness.clientID]
        )
        this.send(MessageType.AWARENESS, awarenessUpdate)
      }
    })
    
    // Handle CRDT messages
    this.socket.on('crdt:message', (data: ArrayBuffer) => {
      // // [SocketIOProvider] log removed
      this.handleMessage(new Uint8Array(data))
    })
    
    // Handle disconnection
    this.socket.on('disconnect', () => {
      this.handleDisconnect()
    })
    
    // Handle errors
    this.socket.on('connect_error', (error) => {
      console.error('[CRDT] Connection error:', error)
      this.config.onError?.(error)
    })
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: Uint8Array): void {
    try {
      const decoder = decoding.createDecoder(data)
      const messageType = decoding.readVarUint(decoder)
      
      switch (messageType) {
        case MessageType.SYNC:
          this.handleSyncMessage(decoder)
          break
          
        case MessageType.AWARENESS:
          try {
            const update = decoding.readVarUint8Array(decoder)
            // Awareness update received
            
            // Skip empty or invalid updates
            if (!update || update.length === 0) {
              break
            }
            
            // Skip suspiciously large updates (likely corrupted)
            if (update.length > 10000) {
              break
            }
            
            // Skip very small updates that are likely corrupted (less than 10 bytes)
            if (update.length < 10) {
              break
            }
            
            // Attempting to apply awareness update
            try {
              // Apply awareness update with better error handling
              awarenessProtocol.applyAwarenessUpdate(this.awareness, update, 'remote')
              
              // Awareness update applied successfully
            } catch (awarenessError: any) {
              // Skip detailed logging for common JSON parse errors to reduce noise
              if (!awarenessError.message?.includes('JSON.parse') && !awarenessError.message?.includes('unexpected end of data')) {
                console.error('[CRDT] ❌ Failed to apply awareness update:', awarenessError)
              }
              
              // Try the original method as fallback
              try {
                awarenessProtocol.applyAwarenessUpdate(this.awareness, update, this)
                // Applied awareness update using fallback method
              } catch (fallbackError:any) {
                // Skip detailed logging for common JSON parse errors to reduce noise
                if (!fallbackError.message?.includes('JSON.parse') && !fallbackError.message?.includes('unexpected end of data')) {
                  console.error('[CRDT] ❌ Fallback also failed:', fallbackError)
                }
                // Don't let awareness errors block sync - continue processing
              }
            }
          } catch (error) {
            console.error('[CRDT] ❌ Error processing awareness update:', error)
            // Skip corrupted awareness update and continue
          }
          break
          
        case MessageType.QUERY_AWARENESS:
          try {
            const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
              this.awareness,
              Array.from(this.awareness.getStates().keys())
            )
            this.send(MessageType.AWARENESS, awarenessUpdate)
          } catch (error) {
            console.error('[CRDT] Error responding to awareness query:', error)
          }
          break
          
        case MessageType.CUSTOM:
          this.handleCustomMessage(decoder)
          break
      }
    } catch (error:any) {
      console.error('[CRDT] Error handling message:', error)
      
      // If we have persistent corruption, destroy and recreate the document
      if (error.message?.includes('Unexpected end of array')) {
        try {
          // Clear the document
          this.doc.destroy()
          
          // Emit event to trigger store reset
          window.dispatchEvent(new CustomEvent('crdt-corruption-detected'))
        } catch (clearError) {
          console.error('[CRDT] Error clearing corrupted state:', clearError)
        }
      }
      
      this.config.onError?.(error as Error)
    }
  }

  /**
   * Handle sync protocol messages
   */
  private handleSyncMessage(decoder: decoding.Decoder): void {
    const encoder = encoding.createEncoder()
    const syncMessageType = syncProtocol.readSyncMessage(
      decoder,
      encoder,
      this.doc,
      this
    )
    
    if (encoding.length(encoder) > 0) {
      this.sendMessage(encoding.toUint8Array(encoder))
    }
    
    if (syncMessageType === syncProtocol.messageYjsSyncStep2) {
      this.synced = true
      if (this.config.onSyncComplete) {
        this.config.onSyncComplete()
      }
    }
  }

  /**
   * Handle custom messages
   */
  private handleCustomMessage(decoder: decoding.Decoder): void {
    const message = decoding.readVarString(decoder)
    try {
      const data = JSON.parse(message)
      // Custom message received
    } catch (error) {
      console.error('[CRDT] Failed to parse custom message:', error)
    }
  }

  /**
   * Send message with type prefix
   */
  private send(type: MessageType, data: Uint8Array): void {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, type)
    encoding.writeVarUint8Array(encoder, data)  // Changed from writeUint8Array to writeVarUint8Array
    const finalMessage = encoding.toUint8Array(encoder)
    
    // Send message with type
    
    this.sendMessage(finalMessage)
  }

  /**
   * Send raw message
   */
  private sendMessage(data: Uint8Array): void {
    if (this.socket?.connected) {
      // // [SocketIOProvider] log removed
      this.socket.emit('crdt:message', this.roomName, data)
    } else {
      console.warn('[SocketIOProvider] Cannot send message - socket not connected')
    }
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(): void {
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
        // // [SocketIOProvider] log removed
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, MessageType.SYNC)
        syncProtocol.writeUpdate(encoder, update)
        const message = encoding.toUint8Array(encoder)
        
        this.sendMessage(message)
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
          
          // Throttle awareness updates to reduce network traffic
          this.awarenessUpdateTimer = setTimeout(() => {
            try {
              const validClients = changedClients.filter((clientId: any) => 
                typeof clientId === 'number' && !isNaN(clientId) && clientId >= 0
              )
              
              if (validClients.length > 0) {
                const localState = this.awareness.getLocalState()
                
                if (localState && typeof localState === 'object') {
                  try {
                    const update = awarenessProtocol.encodeAwarenessUpdate(this.awareness, validClients)
                    
                    if (update && update.length > 10 && update.length < 5000) {
                      this.send(MessageType.AWARENESS, update)
                    }
                  } catch (encodeError) {
                    console.error('[CRDT] ❌ Error encoding awareness update, clearing corrupt state:', encodeError)
                    // Clear the awareness state and reinitialize without destroying
                    try {
                      // Clear all awareness states
                      this.awareness.states.clear()
                      this.awareness.meta.clear()
                      
                      // Reset local state
                      this.setUserState({
                        userId: this.getOrCreateUserId(),
                        userName: this.getOrCreateUserName(),
                        userColor: this.getOrCreateUserColor(this.getOrCreateUserId())
                      })
                    } catch (clearError) {
                      console.error('[CRDT] ❌ Error clearing awareness state:', clearError)
                      // As last resort, recreate the awareness instance
                      this.awareness = new awarenessProtocol.Awareness(this.doc)
                      this.setUserState({
                        userId: this.getOrCreateUserId(),
                        userName: this.getOrCreateUserName(),
                        userColor: this.getOrCreateUserColor(this.getOrCreateUserId())
                      })
                    }
                  }
                }
              }
            } catch (timerError) {
              console.error('[CRDT] ❌ Error in awareness update timer:', timerError)
            }
            
            this.awarenessUpdateTimer = null
          }, 100) // 100ms throttle for awareness updates
        }
      } catch (error) {
        console.error('[CRDT] ❌ Error in awareness update observer:', error)
        // Continue without crashing - just log the error
      }
    })
  }

  /**
   * Set user state in awareness
   */
  setUserState(state: Partial<CRDTPresence>): void {
    try {
      const currentState = this.awareness.getLocalState() || {}
      const newState = {
        ...currentState,
        ...state,
        lastSeen: Date.now()
      }
      
      // Validate the state before setting
      if (newState.userId && typeof newState.userId === 'string') {
        this.awareness.setLocalState(newState)
      }
    } catch (error) {
      console.error('[CRDT] Error setting user state:', error)
    }
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
   * Get or create a unique user ID
   */
  private getOrCreateUserId(): string {
    let userId = sessionStorage.getItem('userId')
    if (!userId) {
      // Generate a unique user ID with timestamp and random component
      const timestamp = Date.now().toString(36)
      const random = Math.random().toString(36).substring(2, 8)
      userId = `user-${timestamp}-${random}`
      sessionStorage.setItem('userId', userId)
    }
    // Add tab identifier to help distinguish multiple tabs from same user
    const tabId = sessionStorage.getItem('tabId') || Math.random().toString(36).substring(2, 8)
    if (!sessionStorage.getItem('tabId')) {
      sessionStorage.setItem('tabId', tabId)
    }
    return userId
  }

  /**
   * Get or create a user name
   */
  private getOrCreateUserName(): string {
    let userName = sessionStorage.getItem('userName')
    if (!userName) {
      const userId = this.getOrCreateUserId()
      // Generate a friendly name based on user ID
      const adjectives = ['Swift', 'Bright', 'Clever', 'Quick', 'Smart', 'Bold', 'Cool', 'Fast']
      const animals = ['Falcon', 'Tiger', 'Eagle', 'Wolf', 'Fox', 'Hawk', 'Lion', 'Bear']
      
      const seed = userId.split('-')[1] || '0'
      const adjIndex = parseInt(seed.substring(0, 2), 36) % adjectives.length
      const animalIndex = parseInt(seed.substring(2, 4), 36) % animals.length
      
      userName = `${adjectives[adjIndex]} ${animals[animalIndex]}`
      sessionStorage.setItem('userName', userName)
    }
    return userName
  }

  /**
   * Get or create a user color
   */
  private getOrCreateUserColor(userId: string): string {
    let userColor = sessionStorage.getItem('userColor')
    if (!userColor) {
      userColor = this.generateUserColor(userId)
      sessionStorage.setItem('userColor', userColor)
    }
    return userColor
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
  getAwareness(): awarenessProtocol.Awareness {
    return this.awareness
  }
}