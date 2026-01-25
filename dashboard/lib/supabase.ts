import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Create client - will be empty strings during build, but that's ok
// because the actual API calls only happen at runtime
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper to check if env vars are loaded
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

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
