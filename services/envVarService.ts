import type { NodeMetadata } from '@/types/workflow'
import { apiClient } from './apiClient'
import type { EnvVarResponse, EnvVarCreateRequest } from '@/types/api'

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
    if (this.cache && now - this.lastFetch < this.CACHE_DURATION) {
      return this.cache
    }

    try {
      // Try to fetch from API first
      const response = await apiClient.getPaginated<EnvVarResponse>('/env-vars', {
        limit: 100, // Get all environment variables
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
              addedAutomatically: false,
            })),
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
              value: '••••••••', // Always mask secret values
              isSecret: v.isSecret,
              needsAttention: false, // Secrets don't show as needing attention since we can't see their values
              addedAutomatically: false,
            })),
        },
      ]

      // Update cache
      this.cache = sections
      this.lastFetch = now

      return sections
    } catch (error) {
      console.error('Failed to fetch environment variables from API:', error)

      // Fall back to localStorage since backend doesn't persist yet
      const localSections = this.getConfigSectionsFromLocal()

      // Update cache with local data
      this.cache = localSections
      this.lastFetch = now

      return localSections
    }
  }

  private static getConfigSectionsFromLocal(): ConfigSection[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        const sections = JSON.parse(stored) as ConfigSection[]

        // Ensure proper structure and separation of secrets vs env vars
        const allVariables: EnvironmentVariable[] = []

        // Collect all variables from all sections
        sections.forEach(section => {
          if (section.variables) {
            allVariables.push(...section.variables)
          }
        })

        // Reorganize into proper sections
        return [
          {
            id: 'environment',
            name: 'Environment Variables',
            description: 'Global environment variables available to all nodes',
            variables: allVariables.filter(v => !v.isSecret),
          },
          {
            id: 'secrets',
            name: 'Secrets',
            description: 'Sensitive data like API keys, tokens, and passwords',
            variables: allVariables
              .filter(v => v.isSecret)
              .map(v => ({
                ...v,
                value: '••••••••', // Ensure secrets are always masked
              })),
          },
        ]
      }
    } catch (error) {
      console.error('Failed to load environment variables from localStorage:', error)
    }

    // Return default structure if nothing is stored
    return [
      {
        id: 'environment',
        name: 'Environment Variables',
        description: 'Global environment variables available to all nodes',
        variables: [],
      },
      {
        id: 'secrets',
        name: 'Secrets',
        description: 'Sensitive data like API keys, tokens, and passwords',
        variables: [],
      },
    ]
  }

  private static saveConfigSectionsToLocal(sections: ConfigSection[]): void {
    try {
      // Ensure secrets are always masked before saving to localStorage
      const sectionsToSave = sections.map(section => ({
        ...section,
        variables: section.variables.map(v => (v.isSecret ? { ...v, value: '••••••••' } : v)),
      }))

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sectionsToSave))
    } catch (error) {
      console.error('Failed to save environment variables to localStorage:', error)
    }
  }

  static async saveSecret(secret: {
    key: string
    value: string
    isSecret: boolean
  }): Promise<EnvVarResponse | undefined> {
    try {
      const request: EnvVarCreateRequest = {
        key: secret.key,
        value: secret.value,
        isSecret: true,
        description: 'Secret variable',
        category: 'secrets',
      }

      const response = await apiClient.post<EnvVarResponse>('/env-vars', request)

      // Clear cache to force refresh from backend
      this.cache = null

      return response
    } catch (error) {
      console.error('Failed to save secret:', error)
      throw error
    }
  }

  static async saveConfigSections(sections: ConfigSection[]): Promise<void> {
    try {
      // Save to localStorage first (since backend doesn't persist yet)
      this.saveConfigSectionsToLocal(sections)

      // Update cache
      this.cache = sections
      this.lastFetch = Date.now()

      // Still try to send to API for validation
      const updatePromises: Promise<any>[] = []

      sections.forEach(section => {
        section.variables.forEach(variable => {
          // Only save variables that have actual values (user configured)
          // Skip masked secret values
          if (variable.value && variable.value.trim() !== '' && variable.value !== '••••••••') {
            const request: EnvVarCreateRequest = {
              key: variable.key,
              value: variable.value,
              isSecret: variable.isSecret,
              description: `Variable from ${section.name}`,
              category: variable.isSecret ? 'secrets' : 'environment',
            }

            updatePromises.push(
              apiClient.post<EnvVarResponse>('/env-vars', request).catch(error => {
                console.error(`Failed to save variable ${variable.key}:`, error)
                return null
              })
            )
          }
        })
      })

      await Promise.all(updatePromises)
    } catch (error) {
      console.error('Failed to save environment variables:', error)
      // Don't throw since we saved to localStorage
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
        templateIds: templateIds,
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
      // console.log removed
    } catch (error) {
      console.error('Failed to clear storage:', error)
    }
  }
}
