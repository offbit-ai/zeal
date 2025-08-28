/**
 * Database operations for ZIP webhook registrations
 * These are integration webhooks, different from workflow trigger webhooks
 */

import { Pool } from 'pg'
import { createClient } from '@supabase/supabase-js'
import { getDatabaseType, getDatabase } from './database'

export interface ZipWebhook {
  id: string
  namespace: string
  url: string
  events: string[]
  headers: Record<string, string>
  isActive: boolean
  metadata: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface ZipWebhookOperations {
  saveWebhookConfiguration(webhook: Omit<ZipWebhook, 'createdAt' | 'updatedAt'>): Promise<ZipWebhook>
  getWebhookConfiguration(id: string): Promise<ZipWebhook | null>
  listWebhookConfigurations(filters?: { namespace?: string; isActive?: boolean }): Promise<ZipWebhook[]>
  updateWebhookConfiguration(id: string, updates: Partial<ZipWebhook>): Promise<ZipWebhook>
  deleteWebhookConfiguration(id: string): Promise<void>
  getWebhooksByNamespace(namespace: string): Promise<ZipWebhook[]>
  getActiveWebhooksForEvent(namespace: string, event: string): Promise<ZipWebhook[]>
}

/**
 * PostgreSQL implementation
 */
export class PostgresZipWebhookOperations implements ZipWebhookOperations {
  constructor(private pool: Pool) {}

  async saveWebhookConfiguration(webhook: Omit<ZipWebhook, 'createdAt' | 'updatedAt'>): Promise<ZipWebhook> {
    const client = await this.pool.connect()
    try {
      // First ensure the table exists
      await this.ensureTableExists(client)
      
      const result = await client.query(
        `INSERT INTO zip_webhooks (
          id, namespace, url, events, headers, is_active, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING *`,
        [
          webhook.id,
          webhook.namespace,
          webhook.url,
          JSON.stringify(webhook.events),
          JSON.stringify(webhook.headers),
          webhook.isActive,
          JSON.stringify(webhook.metadata),
        ]
      )
      
      return this.parseWebhookRow(result.rows[0])
    } finally {
      client.release()
    }
  }

  async getWebhookConfiguration(id: string): Promise<ZipWebhook | null> {
    const client = await this.pool.connect()
    try {
      await this.ensureTableExists(client)
      
      const result = await client.query(
        'SELECT * FROM zip_webhooks WHERE id = $1',
        [id]
      )
      
      if (result.rows.length === 0) {
        return null
      }
      
      return this.parseWebhookRow(result.rows[0])
    } finally {
      client.release()
    }
  }

  async listWebhookConfigurations(filters?: { namespace?: string; isActive?: boolean }): Promise<ZipWebhook[]> {
    const client = await this.pool.connect()
    try {
      await this.ensureTableExists(client)
      
      let query = 'SELECT * FROM zip_webhooks WHERE 1=1'
      const params: any[] = []
      let paramIndex = 1
      
      if (filters?.namespace) {
        query += ` AND namespace = $${paramIndex++}`
        params.push(filters.namespace)
      }
      
      if (filters?.isActive !== undefined) {
        query += ` AND is_active = $${paramIndex++}`
        params.push(filters.isActive)
      }
      
      query += ' ORDER BY created_at DESC'
      
      const result = await client.query(query, params)
      return result.rows.map(row => this.parseWebhookRow(row))
    } finally {
      client.release()
    }
  }

  async updateWebhookConfiguration(id: string, updates: Partial<ZipWebhook>): Promise<ZipWebhook> {
    const client = await this.pool.connect()
    try {
      await this.ensureTableExists(client)
      
      const updateFields: string[] = []
      const params: any[] = []
      let paramIndex = 1
      
      if (updates.url !== undefined) {
        updateFields.push(`url = $${paramIndex++}`)
        params.push(updates.url)
      }
      
      if (updates.events !== undefined) {
        updateFields.push(`events = $${paramIndex++}`)
        params.push(JSON.stringify(updates.events))
      }
      
      if (updates.headers !== undefined) {
        updateFields.push(`headers = $${paramIndex++}`)
        params.push(JSON.stringify(updates.headers))
      }
      
      if (updates.isActive !== undefined) {
        updateFields.push(`is_active = $${paramIndex++}`)
        params.push(updates.isActive)
      }
      
      if (updates.metadata !== undefined) {
        updateFields.push(`metadata = $${paramIndex++}`)
        params.push(JSON.stringify(updates.metadata))
      }
      
      updateFields.push(`updated_at = NOW()`)
      params.push(id)
      
      const result = await client.query(
        `UPDATE zip_webhooks SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        params
      )
      
      if (result.rows.length === 0) {
        throw new Error(`Webhook ${id} not found`)
      }
      
      return this.parseWebhookRow(result.rows[0])
    } finally {
      client.release()
    }
  }

  async deleteWebhookConfiguration(id: string): Promise<void> {
    const client = await this.pool.connect()
    try {
      await this.ensureTableExists(client)
      
      await client.query('DELETE FROM zip_webhooks WHERE id = $1', [id])
    } finally {
      client.release()
    }
  }

  async getWebhooksByNamespace(namespace: string): Promise<ZipWebhook[]> {
    return this.listWebhookConfigurations({ namespace })
  }

  async getActiveWebhooksForEvent(namespace: string, event: string): Promise<ZipWebhook[]> {
    const client = await this.pool.connect()
    try {
      await this.ensureTableExists(client)
      
      const result = await client.query(
        `SELECT * FROM zip_webhooks 
        WHERE namespace = $1 
        AND is_active = true 
        AND (events @> $2 OR events @> '["*"]'::jsonb)
        ORDER BY created_at DESC`,
        [namespace, JSON.stringify([event])]
      )
      
      return result.rows.map(row => this.parseWebhookRow(row))
    } finally {
      client.release()
    }
  }

  private async ensureTableExists(client: any): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS zip_webhooks (
        id VARCHAR(255) PRIMARY KEY,
        namespace VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        events JSONB NOT NULL DEFAULT '["*"]'::jsonb,
        headers JSONB NOT NULL DEFAULT '{}'::jsonb,
        is_active BOOLEAN NOT NULL DEFAULT true,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        INDEX idx_zip_webhooks_namespace (namespace),
        INDEX idx_zip_webhooks_active (is_active)
      )
    `).catch(() => {
      // Table might already exist, ignore error
    })
  }

  private parseWebhookRow(row: any): ZipWebhook {
    return {
      id: row.id,
      namespace: row.namespace,
      url: row.url,
      events: typeof row.events === 'string' ? JSON.parse(row.events) : row.events,
      headers: typeof row.headers === 'string' ? JSON.parse(row.headers) : row.headers,
      isActive: row.is_active,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}

/**
 * Supabase implementation
 */
export class SupabaseZipWebhookOperations implements ZipWebhookOperations {
  constructor(private supabase: any) {}

  async saveWebhookConfiguration(webhook: Omit<ZipWebhook, 'createdAt' | 'updatedAt'>): Promise<ZipWebhook> {
    const { data, error } = await this.supabase
      .from('zip_webhooks')
      .insert({
        id: webhook.id,
        namespace: webhook.namespace,
        url: webhook.url,
        events: webhook.events,
        headers: webhook.headers,
        is_active: webhook.isActive,
        metadata: webhook.metadata,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()
    
    if (error) {
      throw new Error(`Failed to save webhook: ${error.message}`)
    }
    
    return this.parseSupabaseWebhook(data)
  }

  async getWebhookConfiguration(id: string): Promise<ZipWebhook | null> {
    const { data, error } = await this.supabase
      .from('zip_webhooks')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') { // Not found
        return null
      }
      throw new Error(`Failed to get webhook: ${error.message}`)
    }
    
    return this.parseSupabaseWebhook(data)
  }

  async listWebhookConfigurations(filters?: { namespace?: string; isActive?: boolean }): Promise<ZipWebhook[]> {
    let query = this.supabase.from('zip_webhooks').select('*')
    
    if (filters?.namespace) {
      query = query.eq('namespace', filters.namespace)
    }
    
    if (filters?.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive)
    }
    
    const { data, error } = await query.order('created_at', { ascending: false })
    
    if (error) {
      throw new Error(`Failed to list webhooks: ${error.message}`)
    }
    
    return data.map((row: any) => this.parseSupabaseWebhook(row))
  }

  async updateWebhookConfiguration(id: string, updates: Partial<ZipWebhook>): Promise<ZipWebhook> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }
    
    if (updates.url !== undefined) updateData.url = updates.url
    if (updates.events !== undefined) updateData.events = updates.events
    if (updates.headers !== undefined) updateData.headers = updates.headers
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata
    
    const { data, error } = await this.supabase
      .from('zip_webhooks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      throw new Error(`Failed to update webhook: ${error.message}`)
    }
    
    return this.parseSupabaseWebhook(data)
  }

  async deleteWebhookConfiguration(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('zip_webhooks')
      .delete()
      .eq('id', id)
    
    if (error) {
      throw new Error(`Failed to delete webhook: ${error.message}`)
    }
  }

  async getWebhooksByNamespace(namespace: string): Promise<ZipWebhook[]> {
    return this.listWebhookConfigurations({ namespace })
  }

  async getActiveWebhooksForEvent(namespace: string, event: string): Promise<ZipWebhook[]> {
    const { data, error } = await this.supabase
      .from('zip_webhooks')
      .select('*')
      .eq('namespace', namespace)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    
    if (error) {
      throw new Error(`Failed to get webhooks for event: ${error.message}`)
    }
    
    // Filter by event in application logic
    return data
      .filter((webhook: any) => 
        webhook.events.includes(event) || webhook.events.includes('*')
      )
      .map((row: any) => this.parseSupabaseWebhook(row))
  }

  private parseSupabaseWebhook(data: any): ZipWebhook {
    return {
      id: data.id,
      namespace: data.namespace,
      url: data.url,
      events: data.events,
      headers: data.headers,
      isActive: data.is_active,
      metadata: data.metadata,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  }
}

/**
 * Get ZIP webhook operations with the configured database
 */
export async function getZipWebhookOperations(): Promise<ZipWebhookOperations> {
  const dbType = getDatabaseType()
  
  if (dbType === 'supabase') {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
    
    return new SupabaseZipWebhookOperations(supabase)
  } else {
    const pool = await getDatabase()
    return new PostgresZipWebhookOperations(pool)
  }
}