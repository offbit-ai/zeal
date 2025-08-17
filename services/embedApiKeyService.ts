/**
 * Service for managing embed API keys
 */

import { randomBytes } from 'crypto'
import { hash, compare } from 'bcryptjs'
import { getDatabaseOperations } from '@/lib/database'
import { EmbedApiKey, EmbedPermissions } from '@/types/embed'

export class EmbedApiKeyService {
  /**
   * Generate a new API key
   */
  static generateApiKey(): string {
    // Generate a secure random key
    // Format: emb_live_[32 random characters] for production
    // Format: emb_test_[32 random characters] for testing
    const prefix = process.env.NODE_ENV === 'production' ? 'emb_live_' : 'emb_test_'
    const randomPart = randomBytes(16).toString('hex')
    return `${prefix}${randomPart}`
  }

  /**
   * Create a new API key for a workflow
   */
  static async createApiKey(
    workflowId: string,
    name: string,
    permissions: EmbedPermissions,
    options?: {
      description?: string
      expiresAt?: string
      rateLimits?: any
    }
  ): Promise<{ apiKey: EmbedApiKey; plainKey: string }> {
    const db = await getDatabaseOperations()

    // Generate the API key
    const plainKey = this.generateApiKey()

    // Hash the key for storage
    const hashedKey = await hash(plainKey, 10)

    // Create the API key record
    const apiKey: EmbedApiKey = {
      id: `apikey_${Date.now()}_${randomBytes(4).toString('hex')}`,
      key: hashedKey,
      name,
      description: options?.description,
      workflowId,
      permissions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: options?.expiresAt,
      isActive: true,
      usageCount: 0,
      rateLimits: options?.rateLimits,
    }

    // Save to database
    await db.createEmbedApiKey(apiKey)

    // Return both the record and the plain key (only shown once)
    return { apiKey, plainKey }
  }

  /**
   * Validate an API key
   */
  static async validateApiKey(plainKey: string, workflowId?: string): Promise<EmbedApiKey | null> {
    const db = await getDatabaseOperations()

    // Get all active API keys for the workflow (or all if no workflow specified)
    const apiKeys = await db.getEmbedApiKeys(workflowId)

    // Check each key
    for (const apiKey of apiKeys) {
      // Skip inactive or expired keys
      if (!apiKey.isActive) continue
      if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) continue

      // Compare the plain key with the hashed key
      const isValid = await compare(plainKey, apiKey.key)
      if (isValid) {
        // Update last used timestamp and usage count
        await db.updateEmbedApiKey(apiKey.id, {
          lastUsedAt: new Date().toISOString(),
          usageCount: apiKey.usageCount + 1,
        })

        return apiKey
      }
    }

    return null
  }

  /**
   * Check rate limits for an API key
   */
  static async checkRateLimits(apiKeyId: string): Promise<boolean> {
    const db = await getDatabaseOperations()
    const sessions = await db.getEmbedSessions(apiKeyId)

    // Get the API key to check rate limits
    const apiKey = await db.getEmbedApiKey(apiKeyId)
    if (!apiKey || !apiKey.rateLimits) return true

    const now = new Date()
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Count requests in different time windows
    let requestsLastMinute = 0
    let requestsLastHour = 0
    let requestsLastDay = 0

    sessions.forEach((session: any) => {
      session.actions.forEach((action: any) => {
        const actionTime = new Date(action.timestamp)
        if (actionTime > oneMinuteAgo) requestsLastMinute++
        if (actionTime > oneHourAgo) requestsLastHour++
        if (actionTime > oneDayAgo) requestsLastDay++
      })
    })

    // Check limits
    if (requestsLastMinute >= apiKey.rateLimits.requestsPerMinute) return false
    if (requestsLastHour >= apiKey.rateLimits.requestsPerHour) return false
    if (requestsLastDay >= apiKey.rateLimits.requestsPerDay) return false

    return true
  }

  /**
   * List API keys for a workflow
   */
  static async listApiKeys(workflowId: string): Promise<EmbedApiKey[]> {
    const db = await getDatabaseOperations()
    return db.getEmbedApiKeys(workflowId)
  }

  /**
   * Revoke an API key
   */
  static async revokeApiKey(apiKeyId: string): Promise<void> {
    const db = await getDatabaseOperations()
    await db.updateEmbedApiKey(apiKeyId, {
      isActive: false,
      updatedAt: new Date().toISOString(),
    })
  }

  /**
   * Update API key permissions
   */
  static async updateApiKeyPermissions(
    apiKeyId: string,
    permissions: Partial<EmbedPermissions>
  ): Promise<void> {
    const db = await getDatabaseOperations()
    const apiKey = await db.getEmbedApiKey(apiKeyId)

    if (!apiKey) {
      throw new Error('API key not found')
    }

    await db.updateEmbedApiKey(apiKeyId, {
      permissions: { ...apiKey.permissions, ...permissions },
      updatedAt: new Date().toISOString(),
    })
  }
}
