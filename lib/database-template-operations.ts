/**
 * Template operations factory - supports both PostgreSQL and Supabase
 * This provides template-specific operations based on database type
 */

import { Pool } from 'pg'
import { getDatabase, getDatabaseType } from './database'
import { createClient } from '@supabase/supabase-js'
import type { TemplateOperations } from '@/services/node-template-repository/core/database-operations'

// Export a function to get template operations with the configured database
export async function getTemplateOperations(): Promise<TemplateOperations> {
  const dbType = getDatabaseType()

  if (dbType === 'supabase') {
    // Create Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        'Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required'
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { SupabaseTemplateOperations } = await import(
      '@/services/node-template-repository/core/database-operations'
    )

    return new SupabaseTemplateOperations(supabase)
  } else {
    // Use PostgreSQL
    const pool = await getDatabase()
    const { PostgresTemplateOperations } = await import(
      '@/services/node-template-repository/core/database-operations'
    )

    return new PostgresTemplateOperations(pool)
  }
}
