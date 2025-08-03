/**
 * CRDT Sync Optimizer
 * 
 * Optimizes sync behavior based on presence:
 * - Disables awareness updates when user is alone
 * - Reduces polling frequency when no other users
 * - Re-enables full sync when other users join
 */

import type { SocketIOProvider } from './socketio-provider'
import type { CRDTPresence } from './types'
import * as awarenessProtocol from 'y-protocols/awareness'

export interface SyncOptimizerConfig {
  onOptimizationChange?: (isOptimized: boolean) => void
  minUsersForFullSync?: number // Default: 2 (self + 1 other)
  optimizedPollingInterval?: number // Default: 10000ms (10s)
  normalPollingInterval?: number // Default: 1000ms (1s)
}

export class SyncOptimizer {
  private provider: SocketIOProvider | null = null
  private config: SyncOptimizerConfig
  private isOptimized = false
  private originalSendMethod: ((type: number, data: Uint8Array) => void) | null = null
  private presenceCheckInterval: NodeJS.Timeout | null = null
  private lastUserCount = 0
  
  constructor(config: SyncOptimizerConfig = {}) {
    this.config = {
      minUsersForFullSync: 2,
      optimizedPollingInterval: 10000,
      normalPollingInterval: 1000,
      ...config
    }
  }
  
  /**
   * Attach optimizer to a provider
   */
  attach(provider: SocketIOProvider): void {
    this.provider = provider
    
    // Start monitoring presence
    this.startPresenceMonitoring()
  }
  
  /**
   * Detach optimizer and restore normal behavior
   */
  detach(): void {
    this.stopPresenceMonitoring()
    this.restoreNormalSync()
    this.provider = null
  }
  
  /**
   * Start monitoring presence changes
   */
  private startPresenceMonitoring(): void {
    if (!this.provider || this.presenceCheckInterval) return
    
    // Check presence immediately
    this.checkPresenceAndOptimize()
    
    // Check periodically
    this.presenceCheckInterval = setInterval(() => {
      this.checkPresenceAndOptimize()
    }, 2000) // Check every 2 seconds
  }
  
  /**
   * Stop monitoring presence
   */
  private stopPresenceMonitoring(): void {
    if (this.presenceCheckInterval) {
      clearInterval(this.presenceCheckInterval)
      this.presenceCheckInterval = null
    }
  }
  
  /**
   * Check presence and optimize accordingly
   */
  private checkPresenceAndOptimize(): void {
    if (!this.provider) return
    
    const awareness = this.provider.getAwareness()
    const states = awareness.getStates()
    
    // Count active users (excluding stale ones)
    const now = Date.now()
    const activeUsers = Array.from(states.entries()).filter(([clientId, state]) => {
      const presence = state as CRDTPresence
      // Consider user active if seen in last 30 seconds
      return presence.lastSeen && (now - presence.lastSeen < 30000)
    })
    
    const userCount = activeUsers.length
    
    // Optimize if user count changes
    if (userCount !== this.lastUserCount) {
      this.lastUserCount = userCount
      
      if (userCount < this.config.minUsersForFullSync!) {
        this.enableOptimizedSync()
      } else {
        this.restoreNormalSync()
      }
    }
  }
  
  /**
   * Enable optimized sync (reduced polling, no cursor updates)
   */
  private enableOptimizedSync(): void {
    if (this.isOptimized || !this.provider) return
    
    // [SyncOptimizer] log removed
    
    // Store original awareness update handler
    const awareness = this.provider.getAwareness()
    const originalUpdate = (awareness as any)._updateHandler
    
    // Disable frequent awareness updates but keep sync working
    if (originalUpdate) {
      (awareness as any)._updateHandler = () => {
        // Skip awareness updates when optimized
      }
    }
    
    // Reduce cursor update frequency
    const store = (window as any).__zealStore
    if (store) {
      const state = store.getState()
      // Clear existing cursor update timer
      if (state.cursorUpdateTimer) {
        clearInterval(state.cursorUpdateTimer)
      }
      
      // Set slower cursor updates
      store.setState({
        cursorUpdateTimer: setInterval(() => {
          // Only update cursor position, not full presence
          const presence = state.presence.get(state.doc?.clientID)
          if (presence?.cursor) {
            // Update only cursor timestamp to keep connection alive
            store.updatePresence({ lastSeen: Date.now() })
          }
        }, this.config.optimizedPollingInterval)
      })
    }
    
    this.isOptimized = true
    this.config.onOptimizationChange?.(true)
  }
  
  /**
   * Restore normal sync behavior
   */
  private restoreNormalSync(): void {
    if (!this.isOptimized || !this.provider) return
    
    // [SyncOptimizer] log removed
    
    // Restore original send method
    if (this.originalSendMethod) {
      (this.provider as any).send = this.originalSendMethod
      this.originalSendMethod = null
    }
    
    // Restore normal cursor update frequency
    const store = (window as any).__zealStore
    if (store) {
      const state = store.getState()
      // Clear existing cursor update timer
      if (state.cursorUpdateTimer) {
        clearInterval(state.cursorUpdateTimer)
      }
      
      // Set normal cursor updates
      store.setState({
        cursorUpdateTimer: setInterval(() => {
          store.updateCursorPosition(state.presence.get(state.doc?.clientID)?.cursor || { x: 0, y: 0 })
        }, this.config.normalPollingInterval)
      })
    }
    
    // Send current awareness state to sync with others
    const awareness = this.provider.getAwareness()
    const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
      awareness,
      Array.from(awareness.getStates().keys())
    )
    if (awarenessUpdate && this.originalSendMethod) {
      this.originalSendMethod(1, awarenessUpdate) // MessageType.AWARENESS = 1
    }
    
    this.isOptimized = false
    this.config.onOptimizationChange?.(false)
  }
  
  /**
   * Get optimization status
   */
  isOptimizationEnabled(): boolean {
    return this.isOptimized
  }
  
  /**
   * Get current user count
   */
  getUserCount(): number {
    return this.lastUserCount
  }
}