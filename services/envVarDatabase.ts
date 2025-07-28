import { getDatabase, generateEnvVarId } from '@/lib/database'
import type { EnvironmentVariableResponse, EnvVarCreateRequest, EnvVarUpdateRequest } from '@/types/api'

export class EnvVarDatabase {
  static async create(data: EnvVarCreateRequest & { userId: string }): Promise<EnvironmentVariableResponse> {
    const db = await getDatabase()
    const id = generateEnvVarId()
    const now = new Date().toISOString()
    
    // For secrets, we should hash the value in a real implementation
    // For now, we'll store it as-is for simulation purposes
    
    await db.run(
      `INSERT INTO env_vars (id, key, value, isSecret, description, category, userId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.key,
        data.value,
        data.isSecret ? 1 : 0,
        data.description || null,
        data.category || (data.isSecret ? 'secrets' : 'environment'),
        data.userId,
        now,
        now
      ]
    )
    
    return {
      id,
      key: data.key,
      value: data.isSecret ? '••••••••' : data.value, // Mask secrets in response
      isSecret: data.isSecret,
      description: data.description,
      category: data.category || (data.isSecret ? 'secrets' : 'environment'),
      createdAt: now,
      updatedAt: now
    }
  }
  
  static async update(id: string, data: EnvVarUpdateRequest): Promise<EnvironmentVariableResponse | null> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    
    // Build dynamic update query
    const updates: string[] = []
    const values: any[] = []
    
    if (data.value !== undefined) {
      updates.push('value = ?')
      values.push(data.value)
    }
    
    if (data.description !== undefined) {
      updates.push('description = ?')
      values.push(data.description)
    }
    
    if (updates.length === 0) {
      return this.getById(id)
    }
    
    updates.push('updatedAt = ?')
    values.push(now)
    
    values.push(id)
    
    await db.run(
      `UPDATE env_vars SET ${updates.join(', ')} WHERE id = ?`,
      values
    )
    
    return this.getById(id)
  }
  
  static async delete(id: string): Promise<boolean> {
    const db = await getDatabase()
    const result = await db.run('DELETE FROM env_vars WHERE id = ?', id)
    return result.changes > 0
  }
  
  static async getById(id: string): Promise<EnvironmentVariableResponse | null> {
    const db = await getDatabase()
    const row = await db.get('SELECT * FROM env_vars WHERE id = ?', id)
    
    if (!row) return null
    
    return {
      id: row.id,
      key: row.key,
      value: row.isSecret ? '••••••••' : row.value, // Mask secrets
      isSecret: Boolean(row.isSecret),
      description: row.description,
      category: row.category,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }
  }
  
  static async getByKey(key: string): Promise<EnvironmentVariableResponse | null> {
    const db = await getDatabase()
    const row = await db.get('SELECT * FROM env_vars WHERE key = ?', key)
    
    if (!row) return null
    
    return {
      id: row.id,
      key: row.key,
      value: row.isSecret ? '••••••••' : row.value, // Mask secrets
      isSecret: Boolean(row.isSecret),
      description: row.description,
      category: row.category,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }
  }
  
  static async list(params?: {
    category?: string
    limit?: number
    offset?: number
  }): Promise<{ data: EnvironmentVariableResponse[], total: number }> {
    const db = await getDatabase()
    const { category, limit = 100, offset = 0 } = params || {}
    
    let query = 'SELECT * FROM env_vars'
    let countQuery = 'SELECT COUNT(*) as total FROM env_vars'
    const queryParams: any[] = []
    
    if (category) {
      query += ' WHERE category = ?'
      countQuery += ' WHERE category = ?'
      queryParams.push(category)
    }
    
    query += ' ORDER BY key ASC LIMIT ? OFFSET ?'
    
    const rows = await db.all(query, [...queryParams, limit, offset])
    const { total } = await db.get(countQuery, queryParams)
    
    const data = rows.map(row => ({
      id: row.id,
      key: row.key,
      value: row.isSecret ? '••••••••' : row.value, // Mask secrets
      isSecret: Boolean(row.isSecret),
      description: row.description,
      category: row.category,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }))
    
    return { data, total }
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
      validationStatus: 'valid'
    }
  }
  
  static async checkSecretExists(key: string): Promise<boolean> {
    const db = await getDatabase()
    const row = await db.get('SELECT id FROM env_vars WHERE key = ? AND isSecret = 1', key)
    return row !== null
  }
  
  static async upsert(data: EnvVarCreateRequest & { userId: string }): Promise<EnvironmentVariableResponse> {
    const existing = await this.getByKey(data.key)
    
    if (existing) {
      // Update existing
      return await this.update(existing.id, {
        value: data.value,
        description: data.description
      }) as EnvironmentVariableResponse
    } else {
      // Create new
      return await this.create(data)
    }
  }
}