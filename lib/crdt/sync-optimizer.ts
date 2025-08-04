/**
 * CRDT Sync Optimizer V2
 * 
 * Optimizes sync behavior based on presence:
 * - Reduces awareness update frequency when user is alone
 * - Maintains full CRDT functionality for local changes
 * - Re-enables full sync when other users join
 */

// import type { SocketIOProvider } from './socketio-provider'
import { RustSocketIOProvider } from './rust-socketio-provider'
import type { CRDTPresence } from './types'

export interface SyncOptimizerConfig {
  onOptimizationChange?: (isOptimized: boolean) => void
  minUsersForFullSync?: number // Default: 2 (self + 1 other)
  optimizedInterval?: number // Default: 30000ms (30s)
  normalInterval?: number // Default: 200ms
}

export class SyncOptimizerV2 {
  private provider: RustSocketIOProvider | null = null
  private config: SyncOptimizerConfig
  private isOptimized = false
  private presenceCheckInterval: NodeJS.Timeout | null = null
  private lastUserCount = 0
  private awarenessInterval: NodeJS.Timeout | null = null

  constructor(config: SyncOptimizerConfig = {}) {
    this.config = {
      minUsersForFullSync: 2,
      optimizedInterval: 30000, // 30 seconds when alone
      normalInterval: 200, // 200ms when with others
      ...config
    }
  }

  /**
   * Attach optimizer to a provider
   */
  attach(provider: RustSocketIOProvider): void {
    this.provider = provider
    if (provider.isConnected) {
      // Start monitoring presence
      this.startPresenceMonitoring()
    } else {
      // Wait for connection     
      const checkConnection = () => {
        if (this.provider && this.provider.isConnected) {
          this.startPresenceMonitoring()
        } else {
          setTimeout(checkConnection, 1000) // Check every second
        }
      }
      setTimeout(checkConnection, 100)
    }
  }

  /**
   * Detach optimizer and restore normal behavior
   */
  detach(): void {
    this.stopPresenceMonitoring()
    this.stopAwarenessInterval()
    this.provider = null
  }

  /**
   * Start monitoring presence changes
   */
  private startPresenceMonitoring(): void {
    if (!this.provider || this.presenceCheckInterval) return

    // Check presence after a short delay to allow initial sync
    setTimeout(() => {
      this.checkPresenceAndOptimize()
    }, 1000)

    // Check periodically
    this.presenceCheckInterval = setInterval(() => {
      this.checkPresenceAndOptimize()
    }, 3000) // Check every 3 seconds
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
    const localClientId = awareness.clientID



    // Get local user ID - add safety check
    const localUserId = states.get(localClientId)?.userId

    if (!localUserId) {
      console.warn('[SyncOptimizer] No local user ID found yet, skipping optimization check')
      return
    }

    // Count only other actual users (exclude local client and other tabs from same user)
    let actualRemoteUserCount = 0
    const remoteUsers: Array<{ clientId: number, userId: string, userName?: string }> = []
    const sameUserTabs: Array<{ clientId: number, userName?: string }> = []

    states.forEach((state, clientId) => {
      if (clientId !== localClientId && state && state.userId) {
        // [SyncOptimizer] log removed

        if (state.userId === localUserId) {
          // Same user, different tab/window
          sameUserTabs.push({
            clientId,
            userName: state.userName || 'Unknown'
          })
        } else {
          // Different user
          actualRemoteUserCount++
          remoteUsers.push({
            clientId,
            userId: state.userId,
            userName: state.userName || 'Unknown'
          })
        }
      }
    })

    // Log presence information
    // [SyncOptimizer] log removed

    if (sameUserTabs.length > 0) {
      // [SyncOptimizer] log removed
    }

    if (actualRemoteUserCount > 0) {
      // [SyncOptimizer] log removed
    }

    // Always check optimization state, not just on count change
    this.lastUserCount = actualRemoteUserCount + 1 // Count unique users, not connections

    // Enable optimization when alone (no other actual users, only same-user tabs)
    if (actualRemoteUserCount === 0) {
      if (!this.isOptimized) {
        this.enableOptimizedSync()
      }
    } else {
      if (this.isOptimized) {
        this.disableOptimizedSync()
      }
    }
  }

  /**
   * Enable optimized sync (reduced awareness frequency)
   */
  private enableOptimizedSync(): void {
    if (this.isOptimized) return

    // [SyncOptimizer] log removed

    // Set up slower awareness updates
    this.setupAwarenessInterval(this.config.optimizedInterval!)

    this.isOptimized = true
    this.config.onOptimizationChange?.(true)
  }

  /**
   * Disable optimized sync (restore normal frequency)
   */
  private disableOptimizedSync(): void {
    if (!this.isOptimized) return

    // [SyncOptimizer] log removed

    // Set up normal awareness updates
    this.setupAwarenessInterval(this.config.normalInterval!)

    // Send immediate awareness update
    this.sendAwarenessUpdate()

    this.isOptimized = false
    this.config.onOptimizationChange?.(false)
  }

  /**
   * Set up awareness update interval
   */
  private setupAwarenessInterval(interval: number): void {
    // Clear existing interval
    this.stopAwarenessInterval()

    // Send immediate update
    this.sendAwarenessUpdate()

    // Set up new interval
    this.awarenessInterval = setInterval(() => {
      this.sendAwarenessUpdate()
    }, interval)
  }

  /**
   * Stop awareness interval
   */
  private stopAwarenessInterval(): void {
    if (this.awarenessInterval) {
      clearInterval(this.awarenessInterval)
      this.awarenessInterval = null
    }
  }

  /**
   * Send awareness update
   */
  private sendAwarenessUpdate(): void {
    if (!this.provider) return

    const store = (window as any).__zealStore
    if (store && typeof store === 'function') {
      const state = store()

      // Update presence with current timestamp
      if (state.updatePresence) {
        state.updatePresence({
          lastSeen: Date.now(),
          cursor: state.presence.get(state.doc?.clientID)?.cursor
        })
      }
    }
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