import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase'
import { getSettings } from '@/lib/supabase-settings-store'
import { getEnabledZones } from '@/lib/supabase-cloudflare-zones-store'
import { fetchZoneAnalytics, saveCloudflareAnalytics } from '@/lib/cloudflare'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const DELAY_BETWEEN_ZONES_MS = 1000

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function GET(request: Request) {
  const startTime = Date.now()

  // 1. Verify CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Verify Supabase
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  // 3. Check settings
  const settings = await getSettings()
  if (!settings.cloudflare.enabled || settings.cloudflare.frequency === 'disabled') {
    return NextResponse.json({
      success: true,
      message: 'Cloudflare analytics disabled',
      fetched: 0,
      timestamp: new Date().toISOString(),
      duration: `${Date.now() - startTime}ms`,
    })
  }

  console.log('[Cron Cloudflare] Starting analytics fetch...')

  try {
    // 4. Load enabled zones
    const zones = await getEnabledZones()

    if (zones.length === 0) {
      console.log('[Cron Cloudflare] No enabled zones configured')
      return NextResponse.json({
        success: true,
        message: 'No zones configured',
        fetched: 0,
        timestamp: new Date().toISOString(),
        duration: `${Date.now() - startTime}ms`,
      })
    }

    let successCount = 0
    let failCount = 0
    const errors: string[] = []

    console.log(`[Cron Cloudflare] Fetching ${zones.length} zone(s)`)

    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i]

      try {
        const result = await fetchZoneAnalytics(zone.zoneId, -60) // last 60 minutes

        if (result.success && result.data) {
          await saveCloudflareAnalytics(zone.id, zone.clientId, result.data)
          successCount++
          console.log(`[Cron Cloudflare] OK ${zone.zoneName} - ${result.data.requests.all} requests`)
        } else {
          failCount++
          errors.push(`${zone.zoneName}: ${result.error}`)
          console.log(`[Cron Cloudflare] FAIL ${zone.zoneName}: ${result.error}`)
        }
      } catch (error) {
        failCount++
        const msg = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`${zone.zoneName}: ${msg}`)
        console.error(`[Cron Cloudflare] ERROR ${zone.zoneName}:`, msg)
      }

      if (i < zones.length - 1) {
        await delay(DELAY_BETWEEN_ZONES_MS)
      }
    }

    const duration = Date.now() - startTime
    console.log(`[Cron Cloudflare] Done: ${successCount} ok, ${failCount} failed, ${duration}ms`)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalZones: zones.length,
      succeeded: successCount,
      failed: failCount,
      duration: `${duration}ms`,
      ...(errors.length > 0 && { errors }),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Cron Cloudflare] Fatal error: ${message}`)
    return NextResponse.json(
      { success: false, error: message, duration: `${Date.now() - startTime}ms` },
      { status: 500 }
    )
  }
}
