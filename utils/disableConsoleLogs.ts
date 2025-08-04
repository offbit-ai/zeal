/**
 * Disable console logs in production or when explicitly disabled
 * This should be imported at the top of _app.tsx or layout.tsx
 */

export function initializeConsoleOverride() {
  // Check if console logs should be disabled
  const shouldDisable = 
    process.env.NODE_ENV === 'production' || 
    process.env.NEXT_PUBLIC_DISABLE_CONSOLE_LOGS === 'true'

  if (shouldDisable && typeof window !== 'undefined') {
    // Save original console methods for critical logs
    const originalLog = window.console.log
    const originalWarn = window.console.warn
    const originalError = window.console.error
    
    // Create no-op function
    const noop = () => {}

    // Override console methods with filtering
    window.console.log = (...args: any[]) => {
      // Allow critical CRDT and connection logs
      const message = args[0]?.toString() || ''
      if (message.includes('[Rust CRDT]') && 
          (message.includes('error') || 
           message.includes('Error') || 
           message.includes('Connection') ||
           message.includes('disconnected'))) {
        originalLog(...args)
      }
    }
    
    window.console.debug = noop
    window.console.info = noop
    
    // Keep warnings for connection issues
    window.console.warn = (...args: any[]) => {
      const message = args[0]?.toString() || ''
      if (message.includes('[Rust CRDT]') || message.includes('connection') || message.includes('sync')) {
        originalWarn(...args)
      }
    }
    
    // Always keep console.error
    // window.console.error = noop

    // Also handle console.group methods
    window.console.group = noop
    window.console.groupCollapsed = noop
    window.console.groupEnd = noop
    window.console.time = noop
    window.console.timeEnd = noop
    window.console.trace = noop
  }
}