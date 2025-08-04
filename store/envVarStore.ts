import { create } from 'zustand'

interface EnvVarState {
  // Set of all required environment variables from nodes
  requiredVars: Set<string>
  // Set of configured environment variables
  configuredVars: Set<string>
  // Computed missing vars
  missingVars: string[]
}

interface EnvVarActions {
  // Add required vars from a node
  addRequiredVars: (vars: string[]) => void
  // Remove required vars from a node
  removeRequiredVars: (vars: string[]) => void
  // Update configured vars (called after settings changes)
  updateConfiguredVars: (vars: string[]) => void
  // Clear all data
  clear: () => void
}

type EnvVarStore = EnvVarState & EnvVarActions

export const useEnvVarStore = create<EnvVarStore>((set, get) => ({
  requiredVars: new Set(),
  configuredVars: new Set(),
  missingVars: [],

  addRequiredVars: (vars: string[]) => {
    set(state => {
      const newRequired = new Set(state.requiredVars)
      vars.forEach(v => newRequired.add(v))

      // Compute missing vars
      const missing = Array.from(newRequired).filter(v => !state.configuredVars.has(v))

      return {
        requiredVars: newRequired,
        missingVars: missing,
      }
    })
  },

  removeRequiredVars: (vars: string[]) => {
    set(state => {
      const newRequired = new Set(state.requiredVars)
      vars.forEach(v => newRequired.delete(v))

      // Compute missing vars
      const missing = Array.from(newRequired).filter(v => !state.configuredVars.has(v))

      return {
        requiredVars: newRequired,
        missingVars: missing,
      }
    })
  },

  updateConfiguredVars: (vars: string[]) => {
    set(state => {
      const newConfigured = new Set(vars)

      // Compute missing vars
      const missing = Array.from(state.requiredVars).filter(v => !newConfigured.has(v))

      return {
        configuredVars: newConfigured,
        missingVars: missing,
      }
    })
  },

  clear: () => {
    set({
      requiredVars: new Set(),
      configuredVars: new Set(),
      missingVars: [],
    })
  },
}))
