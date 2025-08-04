/**
 * CRDT Module Exports
 *
 * Provides all necessary components for implementing
 * local-first architecture with real-time collaboration.
 */

export * from './types'
export * from './persistence'
export * from './workflow-crdt'
// export * from './socketio-provider'
export * from './hooks'

// Re-export Y.js essentials
export { Doc as YDoc, Map as YMap, Array as YArray, Text as YText } from 'yjs'
