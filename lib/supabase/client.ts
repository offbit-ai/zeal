import { createClient } from '@supabase/supabase-js'

// Create a Supabase client for client-side usage
export function createBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })
}

// Create a Supabase client for server-side usage with service role
export function createServerClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceRole) {
    throw new Error('Missing Supabase server environment variables')
  }

  return createClient(supabaseUrl, supabaseServiceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

// Type definitions for Supabase database
export type Database = {
  public: {
    Tables: {
      workflows: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
          owner_id: string | null
          is_public: boolean
          snapshot_data: any
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
          owner_id?: string | null
          is_public?: boolean
          snapshot_data?: any
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
          owner_id?: string | null
          is_public?: boolean
          snapshot_data?: any
        }
      }
      workflow_versions: {
        Row: {
          id: string
          workflow_id: string
          version_number: number
          snapshot_data: any
          created_at: string
          created_by: string | null
          is_published: boolean
          change_summary: string | null
        }
        Insert: {
          id?: string
          workflow_id: string
          version_number: number
          snapshot_data: any
          created_at?: string
          created_by?: string | null
          is_published?: boolean
          change_summary?: string | null
        }
        Update: {
          id?: string
          workflow_id?: string
          version_number?: number
          snapshot_data?: any
          created_at?: string
          created_by?: string | null
          is_published?: boolean
          change_summary?: string | null
        }
      }
    }
  }
}