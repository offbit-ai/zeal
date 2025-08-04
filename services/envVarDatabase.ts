import { getDatabase, generateEnvVarId } from '@/lib/database'
import type { EnvVarResponse, EnvVarCreateRequest, EnvVarUpdateRequest } from '@/types/api'

export class EnvVarDatabase {
  static async create(data: EnvVarCreateRequest & { userId: string }): Promise<EnvVarResponse> {
    const db = await getDatabase()
    const id = generateEnvVarId()
    const now = new Date().toISOString()

    // For secrets, we should hash the value in a real implementation
    // For now, we'll store it as-is for simulation purposes

    await db.query(
      `INSERT INTO env_vars (id, key, value, "isSecret", description, category, "userId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        data.key,
        data.value,
        data.isSecret || false,
        data.description || null,
        data.category || (data.isSecret ? 'secrets' : 'environment'),
        data.userId,
        now,
        now,
      ]
    )

    return {
      id,
      key: data.key,
      value: data.isSecret ? '••••••••' : data.value, // Mask secrets in response
      isSecret: data.isSecret,
      description: data.description,
      category: data.category || (data.isSecret ? 'secrets' : 'environment'),
      createdBy: data.userId,
      createdAt: now,
      updatedAt: now,
    }
  }

  static async update(id: string, data: EnvVarUpdateRequest): Promise<EnvVarResponse | null> {
    const db = await getDatabase()
    const now = new Date().toISOString()

    // Build dynamic update query
    const updates: string[] = []
    const values: any[] = []
    let paramCount = 0

    if (data.value !== undefined) {
      values.push(data.value)
      updates.push(`value = $${++paramCount}`)
    }

    if (data.description !== undefined) {
      values.push(data.description)
      updates.push(`description = $${++paramCount}`)
    }

    if (updates.length === 0) {
      return this.getById(id)
    }

    values.push(now)
    updates.push(`"updatedAt" = $${++paramCount}`)

    values.push(id)

    await db.query(`UPDATE env_vars SET ${updates.join(', ')} WHERE id = $${++paramCount}`, values)

    return this.getById(id)
  }

  static async delete(id: string): Promise<boolean> {
    const db = await getDatabase()
    const result = await db.query('DELETE FROM env_vars WHERE id = $1', [id])
    return (result.rowCount || 0) > 0
  }

  static async getById(id: string): Promise<EnvVarResponse | null> {
    const db = await getDatabase()
    const result = await db.query('SELECT * FROM env_vars WHERE id = $1', [id])
    const row = result.rows[0]

    if (!row) return null

    return {
      id: row.id,
      key: row.key,
      value: row.isSecret ? '••••••••' : row.value, // Mask secrets
      isSecret: Boolean(row.isSecret),
      description: row.description,
      category: row.category,
      createdBy: row.userId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  static async getByKey(key: string): Promise<EnvVarResponse | null> {
    const db = await getDatabase()
    const result = await db.query('SELECT * FROM env_vars WHERE key = $1', [key])
    const row = result.rows[0]

    if (!row) return null

    return {
      id: row.id,
      key: row.key,
      value: row.isSecret ? '••••••••' : row.value, // Mask secrets
      isSecret: Boolean(row.isSecret),
      description: row.description,
      category: row.category,
      createdBy: row.userId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  static async list(params?: {
    category?: string
    limit?: number
    offset?: number
  }): Promise<{ data: EnvVarResponse[]; total: number }> {
    const db = await getDatabase()
    const { category, limit = 100, offset = 0 } = params || {}

    let query = 'SELECT * FROM env_vars'
    let countQuery = 'SELECT COUNT(*) as total FROM env_vars'
    const queryParams: any[] = []
    let paramCount = 0

    if (category) {
      queryParams.push(category)
      query += ` WHERE category = $${++paramCount}`
      countQuery += ' WHERE category = $1'
    }

    const countParamCount = paramCount

    queryParams.push(limit)
    query += ` ORDER BY key ASC LIMIT $${++paramCount}`
    queryParams.push(offset)
    query += ` OFFSET $${++paramCount}`

    const [rowsResult, countResult] = await Promise.all([
      db.query(query, queryParams),
      db.query(countQuery, category ? [category] : []),
    ])

    const data = rowsResult.rows.map(row => ({
      id: row.id,
      key: row.key,
      value: row.isSecret ? '••••••••' : row.value, // Mask secrets
      isSecret: Boolean(row.isSecret),
      description: row.description,
      category: row.category,
      createdBy: row.userId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }))

    return {
      data,
      total: parseInt(countResult.rows[0]?.total || '0'),
    }
  }

  static async validateTemplateVars(templateIds: string[]): Promise<{
    missingVars: string[]
    configuredVars: string[]
    validationStatus: 'valid' | 'missing_vars'
  }> {
    // For now, we'll just return all configured vars
    // In a real implementation, we'd check against template requirements
    const { data } = await this.list()
    const configuredVars = data.map(v => v.key)

    return {
      missingVars: [],
      configuredVars,
      validationStatus: 'valid',
    }
  }

  static async checkSecretExists(key: string): Promise<boolean> {
    const db = await getDatabase()
    const result = await db.query('SELECT id FROM env_vars WHERE key = $1 AND "isSecret" = $2', [
      key,
      true,
    ])
    return result.rowCount !== null && result.rowCount > 0
  }

  static async upsert(data: EnvVarCreateRequest & { userId: string }): Promise<EnvVarResponse> {
    const existing = await this.getByKey(data.key)

    if (existing) {
      // Update existing
      return (await this.update(existing.id, {
        value: data.value,
        description: data.description,
      })) as EnvVarResponse
    } else {
      // Create new
      return await this.create(data)
    }
  }
}
