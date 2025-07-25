import type { NodeMetadata } from '@/types/workflow'
import { apiClient } from './apiClient'
import type { EnvironmentVariableResponse, EnvVarCreateRequest } from '@/types/api'

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
  private static cache: ConfigSection[] | null = null
  private static lastFetch: number = 0
  private static CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  static async getConfigSections(): Promise<ConfigSection[]> {
    // Check cache first
    const now = Date.now()
    if (this.cache && (now - this.lastFetch) < this.CACHE_DURATION) {
      return this.cache
    }

    try {
      // Fetch from API - no localStorage fallback
      const response = await apiClient.getPaginated<EnvironmentVariableResponse>('/env-vars', {
        limit: 100 // Get all environment variables
      })
      
      // Convert API response to ConfigSection format
      const envVars = response.data
      const sections: ConfigSection[] = [
        {
          id: 'environment',
          name: 'Environment Variables',
          description: 'Global environment variables available to all nodes',
          variables: envVars
            .filter(v => !v.isSecret)
            .map(v => ({
              id: v.id,
              key: v.key,
              value: v.value,
              isSecret: v.isSecret,
              needsAttention: !v.value || v.value.trim() === '',
              addedAutomatically: false
            }))
        },
        {
          id: 'secrets',
          name: 'Secrets',
          description: 'Sensitive data like API keys, tokens, and passwords',
          variables: envVars
            .filter(v => v.isSecret)
            .map(v => ({
              id: v.id,
              key: v.key,
              value: v.value,
              isSecret: v.isSecret,
              needsAttention: !v.value || v.value.trim() === '',
              addedAutomatically: false
            }))
        }
      ]

      // Update cache
      this.cache = sections
      this.lastFetch = now
      
      return sections
    } catch (error) {
      console.error('Failed to fetch environment variables from API:', error)
      throw error // Don't fall back to localStorage
    }
  }

  private static getConfigSectionsFromLocal(): ConfigSection[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (error) {
      console.error('Failed to load environment variables from localStorage:', error)
    }

    // Return default mock data if nothing is stored
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

  private static saveConfigSectionsToLocal(sections: ConfigSection[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sections))
    } catch (error) {
      console.error('Failed to save environment variables to localStorage:', error)
    }
  }

  static async saveConfigSections(sections: ConfigSection[]): Promise<void> {
    try {
      // Update each variable via API only
      const updatePromises: Promise<any>[] = []
      
      sections.forEach(section => {
        section.variables.forEach(variable => {
          // Only save variables that have actual values (user configured)
          if (variable.value && variable.value.trim() !== '') {
            const request: EnvVarCreateRequest = {
              key: variable.key,
              value: variable.value,
              isSecret: variable.isSecret,
              description: `Variable from ${section.name}`,
              category: variable.isSecret ? 'secrets' : 'environment'
            }
            
            updatePromises.push(
              apiClient.post<EnvironmentVariableResponse>('/env-vars', request)
                .catch(error => {
                  console.error(`Failed to save variable ${variable.key}:`, error)
                  return null
                })
            )
          }
        })
      })
      
      await Promise.all(updatePromises)
      
      // Clear cache to force refresh from backend
      this.cache = null
    } catch (error) {
      console.error('Failed to save environment variables to API:', error)
      throw error // Don't fall back to localStorage
    }
  }

  static async getAllDefinedVars(): Promise<string[]> {
    const sections = await this.getConfigSections()
    const allVars: string[] = []
    
    sections.forEach(section => {
      section.variables.forEach(variable => {
        allVars.push(variable.key)
      })
    })
    
    return allVars
  }

  static async getMissingEnvVars(nodes: { metadata: NodeMetadata }[]): Promise<string[]> {
    try {
      // Use API to validate environment variables based on template IDs
      const templateIds = nodes.map(node => node.metadata.templateId).filter(Boolean)
      
      if (templateIds.length === 0) {
        return []
      }

      const validationResponse = await apiClient.post<{
        missingVars: string[]
        configuredVars: string[]
        validationStatus: 'valid' | 'missing_vars'
      }>('/env-vars/validate', {
        templateIds: templateIds
      })

      return validationResponse.missingVars
    } catch (error) {
      console.error('Failed to validate environment variables via API:', error)
      
      // Fall back to local validation
      const sections = await this.getConfigSections()
      const configuredVars = new Map<string, string>()
      
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
        if (!value || value.trim() === '') {
          missingVars.push(varName)
        }
      })

      return missingVars
    }
  }

  // Note: We no longer auto-add missing variables to config
  // The warning system only alerts users - they must manually configure variables

  static async markVariableAsConfigured(varKey: string): Promise<void> {
    const sections = await this.getConfigSections()
    
    sections.forEach(section => {
      section.variables.forEach(variable => {
        if (variable.key === varKey) {
          variable.needsAttention = false
        }
      })
    })

    await this.saveConfigSections(sections)
  }

  static async clearAttentionFlags(): Promise<void> {
    const sections = await this.getConfigSections()
    
    sections.forEach(section => {
      section.variables.forEach(variable => {
        if (variable.needsAttention) {
          variable.needsAttention = false
        }
      })
    })

    await this.saveConfigSections(sections)
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