import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Create a placeholder client for build time, real client for runtime
let supabaseInstance: SupabaseClient | null = null

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    if (!supabaseInstance) {
      if (!supabaseUrl || !supabaseAnonKey) {
        // During build, return a mock that won't be called
        if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
          console.warn('Supabase client not initialized - missing environment variables')
          return () => Promise.resolve({ data: null, error: null })
        }
        throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
      }
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey)
    }
    return supabaseInstance[prop as keyof SupabaseClient]
  }
})

// ============================================
// Database Types (match your Supabase tables)
// ============================================

export interface DbClient {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface DbPage {
  id: string
  client_id: string
  name: string
  url: string
  interval: number
  timeout: number
  enabled: boolean
  soft_404_patterns: string[] | null
  created_at: string
  updated_at: string
}

export interface DbCheckHistory {
  id: string
  page_id: string
  status: number
  response_time: number
  error: string | null
  checked_at: string
}

export interface DbIncident {
  id: string
  page_id: string
  type: string
  message: string
  started_at: string
  resolved_at: string | null
}

export interface DbSettings {
  id: string
  key: string
  value: string
  updated_at: string
}

export interface DbAuditHistory {
  id: string
  page_id: string
  performance_score: number
  accessibility_score: number
  best_practices_score: number
  seo_score: number
  pwa_score: number | null
  fcp: number | null
  lcp: number | null
  tbt: number | null
  cls: number | null
  speed_index: number | null
  audited_at: string
}
