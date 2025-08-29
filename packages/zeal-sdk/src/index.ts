/**
 * Zeal Integration Protocol (ZIP) SDK
 * TypeScript client for integrating with Zeal workflow editor
 */

export * from './client'
export * from './templates'
export * from './orchestrator'
export * from './traces'
export * from './events'
export * from './webhooks'
export * from './webhook-subscription'
export * from './types'
export * from './auth'

// Event types will be exported from webhook-subscription
// TODO: Bundle proper event types with the SDK package

import { ZealClient } from './client'

// Default export for convenience
export default ZealClient