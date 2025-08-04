/**
 * Runtime configuration that can be set via window object
 * This allows configuration after the build is complete
 */

export interface RuntimeConfig {
  CRDT_SERVER_URL?: string
  ENABLE_COLLABORATION?: boolean
}

declare global {
  interface Window {
    __ZEAL_CONFIG__?: RuntimeConfig
  }
}

export function getRuntimeConfig(): RuntimeConfig {
  // First check window config (for runtime overrides)
  if (typeof window !== 'undefined' && window.__ZEAL_CONFIG__) {
    return window.__ZEAL_CONFIG__
  }

  // Fall back to environment variables
  return {
    CRDT_SERVER_URL: process.env.NEXT_PUBLIC_CRDT_SERVER_URL,
    ENABLE_COLLABORATION: process.env.NEXT_PUBLIC_ENABLE_COLLABORATION === 'true',
  }
}

export function getCRDTServerUrl(): string {
  // During SSR, always use env variable or default
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_CRDT_SERVER_URL || 'ws://localhost:8080'
  }

  const config = getRuntimeConfig()
  return config.CRDT_SERVER_URL || 'ws://localhost:8080'
}

export function isCollaborationEnabled(): boolean {
  // During SSR, always use env variable or default
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_ENABLE_COLLABORATION === 'true'
  }

  const config = getRuntimeConfig()
  return config.ENABLE_COLLABORATION ?? true
}
