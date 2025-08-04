/**
 * Console wrapper that can be disabled in production
 * This provides a centralized way to control logging
 */

const isDevelopment = process.env.NODE_ENV === 'development'

// Store original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
  info: console.info,
}

// Create a no-op function for production
const noop = () => {}

// Export wrapped console that respects environment
export const devConsole = {
  log: isDevelopment ? originalConsole.log : noop,
  warn: isDevelopment ? originalConsole.warn : noop,
  error: originalConsole.error, // Always keep errors
  debug: isDevelopment ? originalConsole.debug : noop,
  info: isDevelopment ? originalConsole.info : noop,
}

// Override global console in production
if (!isDevelopment) {
  console.log = noop
  console.warn = noop
  console.debug = noop
  console.info = noop
  // Keep console.error for production error tracking
}
