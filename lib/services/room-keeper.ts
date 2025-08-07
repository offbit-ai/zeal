/**
 * Service to keep CRDT rooms alive by periodically calling the keep-alive API
 */

class RoomKeeperService {
  private keepAliveInterval: NodeJS.Timeout | null = null
  private currentWorkflowId: string | null = null
  private isActive = false

  /**
   * Start keeping a workflow room alive
   */
  start(workflowId: string) {
    // Stop any existing keep-alive
    this.stop()

    if (!workflowId || !workflowId.startsWith('wf_')) {
      console.warn('Invalid workflow ID for room keeper:', workflowId)
      return
    }

    this.currentWorkflowId = workflowId
    this.isActive = true

    // Call keep-alive immediately
    this.callKeepAlive()

    // Then call every 5 minutes (well within the 7-day TTL)
    this.keepAliveInterval = setInterval(
      () => {
        if (this.isActive && this.currentWorkflowId) {
          this.callKeepAlive()
        }
      },
      5 * 60 * 1000
    ) // 5 minutes

    console.log('Started room keeper for workflow:', workflowId)
  }

  /**
   * Stop keeping rooms alive
   */
  stop() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval)
      this.keepAliveInterval = null
    }
    this.currentWorkflowId = null
    this.isActive = false
    console.log('Stopped room keeper')
  }

  /**
   * Check if keeper is active for a specific workflow
   */
  isActiveFor(workflowId: string): boolean {
    return this.isActive && this.currentWorkflowId === workflowId
  }

  /**
   * Call the keep-alive API endpoint
   */
  private async callKeepAlive() {
    if (!this.currentWorkflowId) return

    try {
      const response = await fetch(`/api/workflows/${this.currentWorkflowId}/keep-alive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        console.error('Keep-alive failed:', response.status, response.statusText)
        return
      }

      const data = await response.json()

      if (data.success) {
        console.log('Room keep-alive successful:', {
          workflowId: this.currentWorkflowId,
          roomActive: data.data.roomActive,
          ttlExtended: data.data.ttlExtended,
        })
      } else {
        console.error('Keep-alive returned error:', data.error)
      }
    } catch (error) {
      console.error('Failed to call keep-alive:', error)
    }
  }

  /**
   * Handle page visibility changes to pause/resume keep-alive
   */
  handleVisibilityChange() {
    if (document.hidden) {
      // Page is hidden, pause keep-alive
      this.isActive = false
      console.log('Page hidden, pausing room keeper')
    } else {
      // Page is visible again, resume if we have a workflow
      if (this.currentWorkflowId) {
        this.isActive = true
        // Call keep-alive immediately on resume
        this.callKeepAlive()
        console.log('Page visible, resuming room keeper')
      }
    }
  }
}

// Export singleton instance
export const roomKeeper = new RoomKeeperService()

// Listen for page visibility changes
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    roomKeeper.handleVisibilityChange()
  })
}
