/**
 * Database operations for node categories
 */

import { Pool } from 'pg'
import { SupabaseClient } from '@supabase/supabase-js'

export interface NodeCategory {
  id?: string
  name: string
  displayName: string
  description: string
  icon: string
  isActive: boolean
  sortOrder?: number
  createdAt?: Date
  updatedAt?: Date
  createdBy?: string
  updatedBy?: string
}

export interface NodeSubcategory {
  id?: string
  categoryId?: string
  name: string
  displayName: string
  description: string
  sortOrder?: number
  createdAt?: Date
  updatedAt?: Date
}

export interface CategoryWithCounts extends NodeCategory {
  totalNodes: number
  subcategories: Array<NodeSubcategory & { nodeCount: number }>
}

export interface CategoryOperations {
  // Category CRUD
  createCategory(category: NodeCategory): Promise<NodeCategory>
  getCategory(id: string): Promise<NodeCategory | null>
  getCategoryByName(name: string): Promise<NodeCategory | null>
  updateCategory(id: string, updates: Partial<NodeCategory>): Promise<NodeCategory>
  deleteCategory(id: string): Promise<boolean>
  listCategories(options?: { includeInactive?: boolean }): Promise<NodeCategory[]>

  // Subcategory CRUD
  createSubcategory(categoryId: string, subcategory: NodeSubcategory): Promise<NodeSubcategory>
  updateSubcategory(id: string, updates: Partial<NodeSubcategory>): Promise<NodeSubcategory>
  deleteSubcategory(id: string): Promise<boolean>

  // Category with counts
  getCategoriesWithCounts(options?: { includeInactive?: boolean }): Promise<CategoryWithCounts[]>

  // Bulk operations
  bulkCreateCategories(categories: NodeCategory[]): Promise<NodeCategory[]>
  bulkCreateSubcategories(
    categoryId: string,
    subcategories: NodeSubcategory[]
  ): Promise<NodeSubcategory[]>
}

/**
 * PostgreSQL implementation
 */
export class PostgresCategoryOperations implements CategoryOperations {
  constructor(private pool: Pool) {}

  async createCategory(category: NodeCategory): Promise<NodeCategory> {
    const query = `
      INSERT INTO node_categories 
      (name, display_name, description, icon, is_active, sort_order, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `

    const values = [
      category.name,
      category.displayName,
      category.description || '',
      category.icon || 'folder',
      category.isActive !== false,
      category.sortOrder || 0,
      category.createdBy || 'system',
      category.updatedBy || category.createdBy || 'system',
    ]

    const result = await this.pool.query(query, values)
    return this.mapCategory(result.rows[0])
  }

  async getCategory(id: string): Promise<NodeCategory | null> {
    const query = 'SELECT * FROM node_categories WHERE id = $1'
    const result = await this.pool.query(query, [id])
    return result.rows[0] ? this.mapCategory(result.rows[0]) : null
  }

  async getCategoryByName(name: string): Promise<NodeCategory | null> {
    const query = 'SELECT * FROM node_categories WHERE name = $1'
    const result = await this.pool.query(query, [name])
    return result.rows[0] ? this.mapCategory(result.rows[0]) : null
  }

  async updateCategory(id: string, updates: Partial<NodeCategory>): Promise<NodeCategory> {
    const fields = []
    const values = []
    let paramCount = 1

    if (updates.displayName !== undefined) {
      fields.push(`display_name = $${paramCount++}`)
      values.push(updates.displayName)
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${paramCount++}`)
      values.push(updates.description)
    }
    if (updates.icon !== undefined) {
      fields.push(`icon = $${paramCount++}`)
      values.push(updates.icon)
    }
    if (updates.isActive !== undefined) {
      fields.push(`is_active = $${paramCount++}`)
      values.push(updates.isActive)
    }
    if (updates.sortOrder !== undefined) {
      fields.push(`sort_order = $${paramCount++}`)
      values.push(updates.sortOrder)
    }
    if (updates.updatedBy !== undefined) {
      fields.push(`updated_by = $${paramCount++}`)
      values.push(updates.updatedBy)
    }

    values.push(id)

    const query = `
      UPDATE node_categories 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `

    const result = await this.pool.query(query, values)
    return this.mapCategory(result.rows[0])
  }

  async deleteCategory(id: string): Promise<boolean> {
    const query = 'DELETE FROM node_categories WHERE id = $1'
    const result = await this.pool.query(query, [id])
    return result.rowCount ? result.rowCount > 0 : false
  }

  async listCategories(options?: { includeInactive?: boolean }): Promise<NodeCategory[]> {
    let query = 'SELECT * FROM node_categories'
    const conditions = []

    if (!options?.includeInactive) {
      conditions.push('is_active = true')
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }

    query += ' ORDER BY sort_order, name'

    const result = await this.pool.query(query)
    return result.rows.map(row => this.mapCategory(row))
  }

  async createSubcategory(
    categoryId: string,
    subcategory: NodeSubcategory
  ): Promise<NodeSubcategory> {
    const query = `
      INSERT INTO node_subcategories 
      (category_id, name, display_name, description, sort_order)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `

    const values = [
      categoryId,
      subcategory.name,
      subcategory.displayName,
      subcategory.description || '',
      subcategory.sortOrder || 0,
    ]

    const result = await this.pool.query(query, values)
    return this.mapSubcategory(result.rows[0])
  }

  async updateSubcategory(id: string, updates: Partial<NodeSubcategory>): Promise<NodeSubcategory> {
    const fields = []
    const values = []
    let paramCount = 1

    if (updates.displayName !== undefined) {
      fields.push(`display_name = $${paramCount++}`)
      values.push(updates.displayName)
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${paramCount++}`)
      values.push(updates.description)
    }
    if (updates.sortOrder !== undefined) {
      fields.push(`sort_order = $${paramCount++}`)
      values.push(updates.sortOrder)
    }

    values.push(id)

    const query = `
      UPDATE node_subcategories 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `

    const result = await this.pool.query(query, values)
    return this.mapSubcategory(result.rows[0])
  }

  async deleteSubcategory(id: string): Promise<boolean> {
    const query = 'DELETE FROM node_subcategories WHERE id = $1'
    const result = await this.pool.query(query, [id])
    return result.rowCount ? result.rowCount > 0 : false
  }

  async getCategoriesWithCounts(options?: {
    includeInactive?: boolean
  }): Promise<CategoryWithCounts[]> {
    let query = 'SELECT * FROM node_categories_with_counts'

    if (!options?.includeInactive) {
      query += ' WHERE is_active = true'
    }

    const result = await this.pool.query(query)
    return result.rows.map(row => ({
      ...this.mapCategory(row),
      totalNodes: row.total_nodes || 0,
      subcategories: row.subcategories || [],
    }))
  }

  async bulkCreateCategories(categories: NodeCategory[]): Promise<NodeCategory[]> {
    const results: NodeCategory[] = []

    for (const category of categories) {
      try {
        const created = await this.createCategory(category)
        results.push(created)
      } catch (error) {
        console.error(`Failed to create category ${category.name}:`, error)
      }
    }

    return results
  }

  async bulkCreateSubcategories(
    categoryId: string,
    subcategories: NodeSubcategory[]
  ): Promise<NodeSubcategory[]> {
    const results: NodeSubcategory[] = []

    for (const subcategory of subcategories) {
      try {
        const created = await this.createSubcategory(categoryId, subcategory)
        results.push(created)
      } catch (error) {
        console.error(`Failed to create subcategory ${subcategory.name}:`, error)
      }
    }

    return results
  }

  private mapCategory(row: any): NodeCategory {
    return {
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      description: row.description,
      icon: row.icon,
      isActive: row.is_active,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
    }
  }

  private mapSubcategory(row: any): NodeSubcategory {
    return {
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      displayName: row.display_name,
      description: row.description,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}

/**
 * Supabase implementation
 */
export class SupabaseCategoryOperations implements CategoryOperations {
  constructor(private supabase: SupabaseClient) {}

  async createCategory(category: NodeCategory): Promise<NodeCategory> {
    const { data, error } = await this.supabase
      .from('node_categories')
      .insert({
        name: category.name,
        display_name: category.displayName,
        description: category.description || '',
        icon: category.icon || 'folder',
        is_active: category.isActive !== false,
        sort_order: category.sortOrder || 0,
        created_by: category.createdBy || 'system',
        updated_by: category.updatedBy || category.createdBy || 'system',
      })
      .select()
      .single()

    if (error) throw error
    return this.mapCategory(data)
  }

  async getCategory(id: string): Promise<NodeCategory | null> {
    const { data, error } = await this.supabase
      .from('node_categories')
      .select('*')
      .eq('id', id)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data ? this.mapCategory(data) : null
  }

  async getCategoryByName(name: string): Promise<NodeCategory | null> {
    const { data, error } = await this.supabase
      .from('node_categories')
      .select('*')
      .eq('name', name)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data ? this.mapCategory(data) : null
  }

  async updateCategory(id: string, updates: Partial<NodeCategory>): Promise<NodeCategory> {
    const updateData: any = {}

    if (updates.displayName !== undefined) updateData.display_name = updates.displayName
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.icon !== undefined) updateData.icon = updates.icon
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive
    if (updates.sortOrder !== undefined) updateData.sort_order = updates.sortOrder
    if (updates.updatedBy !== undefined) updateData.updated_by = updates.updatedBy

    const { data, error } = await this.supabase
      .from('node_categories')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return this.mapCategory(data)
  }

  async deleteCategory(id: string): Promise<boolean> {
    const { error } = await this.supabase.from('node_categories').delete().eq('id', id)

    if (error) throw error
    return true
  }

  async listCategories(options?: { includeInactive?: boolean }): Promise<NodeCategory[]> {
    let query = this.supabase.from('node_categories').select('*')

    if (!options?.includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query.order('sort_order').order('name')

    if (error) throw error
    return (data || []).map(row => this.mapCategory(row))
  }

  async createSubcategory(
    categoryId: string,
    subcategory: NodeSubcategory
  ): Promise<NodeSubcategory> {
    const { data, error } = await this.supabase
      .from('node_subcategories')
      .insert({
        category_id: categoryId,
        name: subcategory.name,
        display_name: subcategory.displayName,
        description: subcategory.description || '',
        sort_order: subcategory.sortOrder || 0,
      })
      .select()
      .single()

    if (error) throw error
    return this.mapSubcategory(data)
  }

  async updateSubcategory(id: string, updates: Partial<NodeSubcategory>): Promise<NodeSubcategory> {
    const updateData: any = {}

    if (updates.displayName !== undefined) updateData.display_name = updates.displayName
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.sortOrder !== undefined) updateData.sort_order = updates.sortOrder

    const { data, error } = await this.supabase
      .from('node_subcategories')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return this.mapSubcategory(data)
  }

  async deleteSubcategory(id: string): Promise<boolean> {
    const { error } = await this.supabase.from('node_subcategories').delete().eq('id', id)

    if (error) throw error
    return true
  }

  async getCategoriesWithCounts(options?: {
    includeInactive?: boolean
  }): Promise<CategoryWithCounts[]> {
    let query = this.supabase.from('node_categories_with_counts').select('*')

    if (!options?.includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) throw error
    return (data || []).map(row => ({
      ...this.mapCategory(row),
      totalNodes: row.total_nodes || 0,
      subcategories: row.subcategories || [],
    }))
  }

  async bulkCreateCategories(categories: NodeCategory[]): Promise<NodeCategory[]> {
    const results: NodeCategory[] = []

    for (const category of categories) {
      try {
        const created = await this.createCategory(category)
        results.push(created)
      } catch (error) {
        console.error(`Failed to create category ${category.name}:`, error)
      }
    }

    return results
  }

  async bulkCreateSubcategories(
    categoryId: string,
    subcategories: NodeSubcategory[]
  ): Promise<NodeSubcategory[]> {
    const results: NodeSubcategory[] = []

    for (const subcategory of subcategories) {
      try {
        const created = await this.createSubcategory(categoryId, subcategory)
        results.push(created)
      } catch (error) {
        console.error(`Failed to create subcategory ${subcategory.name}:`, error)
      }
    }

    return results
  }

  private mapCategory(row: any): NodeCategory {
    return {
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      description: row.description,
      icon: row.icon,
      isActive: row.is_active,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
    }
  }

  private mapSubcategory(row: any): NodeSubcategory {
    return {
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      displayName: row.display_name,
      description: row.description,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}
