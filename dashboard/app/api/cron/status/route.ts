import { NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const CRON_INTERVAL_MINUTES = 5
const HEALTHY_THRESHOLD_MINUTES = CRON_INTERVAL_MINUTES * 2.5 // ~12.5 min

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 500 }
    )
  }

  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value, updated_at')
      .eq('key', 'last_cron_execution')
      .single()

    if (error || !data) {
      return NextResponse.json({
        healthy: false,
        reason: 'Cron never executed',
        lastExecution: null,
        cronInterval: `${CRON_INTERVAL_MINUTES} minutes`,
      })
    }

    const execution = JSON.parse(data.value)
    const lastRunAt = new Date(execution.timestamp)
    const minutesSinceLastRun = (Date.now() - lastRunAt.getTime()) / (1000 * 60)
    const healthy = minutesSinceLastRun <= HEALTHY_THRESHOLD_MINUTES

    return NextResponse.json({
      healthy,
      reason: healthy
        ? `Last run ${Math.round(minutesSinceLastRun)} minutes ago`
        : `No run in ${Math.round(minutesSinceLastRun)} minutes (threshold: ${HEALTHY_THRESHOLD_MINUTES}min)`,
      lastExecution: execution,
      minutesSinceLastRun: Math.round(minutesSinceLastRun),
      cronInterval: `${CRON_INTERVAL_MINUTES} minutes`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: message, healthy: false },
      { status: 500 }
    )
  }
}
