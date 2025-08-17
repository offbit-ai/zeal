/**
 * Factory for category database operations
 */

import { getDatabaseType, getDatabase } from './database'
import {
  CategoryOperations,
  PostgresCategoryOperations,
  SupabaseCategoryOperations,
} from '@/services/node-template-repository/core/category-operations'

let categoryOperations: CategoryOperations | null = null

export async function getCategoryOperations(): Promise<CategoryOperations> {
  if (categoryOperations) {
    return categoryOperations
  }

  const dbType = getDatabaseType()

  if (dbType === 'postgres') {
    const pool = await getDatabase()
    categoryOperations = new PostgresCategoryOperations(pool)
  } else if (dbType === 'supabase') {
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration missing')
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    categoryOperations = new SupabaseCategoryOperations(supabase)
  } else {
    throw new Error(`Unsupported database type: ${dbType}`)
  }

  return categoryOperations
}
