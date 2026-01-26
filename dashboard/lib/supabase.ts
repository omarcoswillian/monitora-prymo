import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Log missing env vars (server-side only, once)
if (typeof window === 'undefined') {
  if (!supabaseUrl) {
    console.warn('[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL')
  }
  if (!supabaseAnonKey) {
    console.warn('[Supabase] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
}

// Create client only if both vars exist, otherwise create a dummy client
let supabase: SupabaseClient

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      // Disable Next.js fetch cache to ensure fresh data on every query
      fetch: (url, options = {}) => {
        return fetch(url, { ...options, cache: 'no-store' })
      },
    },
  })
} else {
  // Create a placeholder that returns empty results instead of crashing
  // This allows the app to boot and show a proper error message
  supabase = {
    from: () => ({
      select: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured', code: 'NOT_CONFIGURED' } }),
      insert: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured', code: 'NOT_CONFIGURED' } }),
      update: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured', code: 'NOT_CONFIGURED' } }),
      delete: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured', code: 'NOT_CONFIGURED' } }),
      eq: function() { return this },
      neq: function() { return this },
      gte: function() { return this },
      lte: function() { return this },
      order: function() { return this },
      limit: function() { return this },
      single: function() { return this },
    }),
  } as unknown as SupabaseClient
}

export { supabase }

// Helper to check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey)
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
