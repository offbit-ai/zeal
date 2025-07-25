import type { NodeMetadata } from '@/types/workflow'

export interface EnvironmentVariable {
  id: string
  key: string
  value: string
  isSecret: boolean
  needsAttention?: boolean
  addedAutomatically?: boolean
}

export interface ConfigSection {
  id: string
  name: string
  description: string
  variables: EnvironmentVariable[]
}

export class EnvVarService {
  private static STORAGE_KEY = 'zeal_env_vars'
  private static WARNING_DISMISSED_KEY = 'zeal_env_warning_dismissed'

  static getConfigSections(): ConfigSection[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (error) {
      console.error('Failed to load environment variables:', error)
    }

    // Return default mock data if nothing is stored (with minimal set to test missing vars)
    return [
      {
        id: 'environment',
        name: 'Environment Variables',
        description: 'Global environment variables available to all nodes',
        variables: [
          { id: '1', key: 'NODE_ENV', value: 'development', isSecret: false },
          { id: '3', key: 'API_BASE_URL', value: 'https://api.example.com', isSecret: false }
        ]
      },
      {
        id: 'secrets',
        name: 'Secrets',
        description: 'Sensitive data like API keys, tokens, and passwords',
        variables: [
          { id: '6', key: 'STRIPE_SECRET_KEY', value: 'sk_test_1234567890', isSecret: true },
          { id: '7', key: 'AWS_ACCESS_KEY_ID', value: 'AKIAIOSFODNN7EXAMPLE', isSecret: true }
        ]
      }
    ]
  }

  static saveConfigSections(sections: ConfigSection[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sections))
    } catch (error) {
      console.error('Failed to save environment variables:', error)
    }
  }

  static getAllDefinedVars(): string[] {
    const sections = this.getConfigSections()
    const allVars: string[] = []
    
    sections.forEach(section => {
      section.variables.forEach(variable => {
        allVars.push(variable.key)
      })
    })
    
    return allVars
  }

  static getMissingEnvVars(nodes: { metadata: NodeMetadata }[]): string[] {
    const sections = this.getConfigSections()
    const configuredVars = new Map<string, string>()
    
    // Build map of variable names to their values
    sections.forEach(section => {
      section.variables.forEach(variable => {
        configuredVars.set(variable.key, variable.value)
      })
    })
    
    const requiredVars = new Set<string>()
    
    nodes.forEach(node => {
      if (node.metadata.requiredEnvVars) {
        node.metadata.requiredEnvVars.forEach(varName => {
          requiredVars.add(varName)
        })
      }
    })

    const missingVars: string[] = []
    requiredVars.forEach(varName => {
      const value = configuredVars.get(varName)
      // Variable is missing if it doesn't exist OR has empty/undefined value
      if (!value || value.trim() === '') {
        missingVars.push(varName)
      }
    })

    return missingVars
  }

  static addMissingVarsToConfig(missingVars: string[]): void {
    if (missingVars.length === 0) return

    const sections = this.getConfigSections()
    
    // Add missing vars to appropriate sections
    missingVars.forEach(varName => {
      // Determine if it should go to secrets or environment based on naming convention
      const isSecret = varName.toLowerCase().includes('key') || 
                      varName.toLowerCase().includes('secret') || 
                      varName.toLowerCase().includes('token') ||
                      varName.toLowerCase().includes('password')
      
      const targetSectionId = isSecret ? 'secrets' : 'environment'
      const targetSection = sections.find(s => s.id === targetSectionId)
      
      if (targetSection) {
        // Check if variable already exists
        const existingVar = targetSection.variables.find(v => v.key === varName)
        
        if (!existingVar) {
          const newVar: EnvironmentVariable = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            key: varName,
            value: '', // Empty value - needs attention
            isSecret,
            needsAttention: true,
            addedAutomatically: true
          }
          
          targetSection.variables.push(newVar)
        } else if (!existingVar.needsAttention && !existingVar.value) {
          // Mark existing empty variable as needing attention
          existingVar.needsAttention = true
        }
      }
    })

    this.saveConfigSections(sections)
  }

  static markVariableAsConfigured(varKey: string): void {
    const sections = this.getConfigSections()
    
    sections.forEach(section => {
      section.variables.forEach(variable => {
        if (variable.key === varKey) {
          variable.needsAttention = false
        }
      })
    })

    this.saveConfigSections(sections)
  }

  static clearAttentionFlags(): void {
    const sections = this.getConfigSections()
    
    sections.forEach(section => {
      section.variables.forEach(variable => {
        if (variable.needsAttention) {
          variable.needsAttention = false
        }
      })
    })

    this.saveConfigSections(sections)
  }

  // Warning dismissal state management
  static isWarningDismissed(): boolean {
    try {
      const dismissed = localStorage.getItem(this.WARNING_DISMISSED_KEY)
      return dismissed === 'true'
    } catch (error) {
      return false
    }
  }

  static setWarningDismissed(dismissed: boolean): void {
    try {
      localStorage.setItem(this.WARNING_DISMISSED_KEY, dismissed.toString())
    } catch (error) {
      console.error('Failed to save warning dismissed state:', error)
    }
  }

  // For testing - clear all stored data
  static clearStorage(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY)
      localStorage.removeItem(this.WARNING_DISMISSED_KEY)
      console.log('Environment variable storage cleared')
    } catch (error) {
      console.error('Failed to clear storage:', error)
    }
  }
}