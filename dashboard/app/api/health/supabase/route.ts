import { NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const envLoaded = isSupabaseConfigured()

  if (!envLoaded) {
    return NextResponse.json({
      connected: false,
      envLoaded: false,
      error: 'Environment variables not loaded: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY are missing',
      timestamp: new Date().toISOString(),
    })
  }

  try {
    // Try to select from clients table (simple query to test connection)
    const { data, error } = await supabase
      .from('clients')
      .select('id')
      .limit(1)

    if (error) {
      return NextResponse.json({
        connected: false,
        envLoaded: true,
        error: `Database error: ${error.message}`,
        errorCode: error.code,
        timestamp: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      connected: true,
      envLoaded: true,
      error: null,
      rowsFound: data?.length || 0,
      message: 'Supabase connection successful!',
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({
      connected: false,
      envLoaded: true,
      error: `Connection error: ${errorMessage}`,
      timestamp: new Date().toISOString(),
    })
  }
}
