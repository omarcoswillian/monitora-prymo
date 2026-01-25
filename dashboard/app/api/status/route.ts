import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Get all pages with their latest check
    const { data: pages, error: pagesError } = await supabase
      .from('pages')
      .select('id, name, url, enabled, client_id, clients(name)')
      .eq('enabled', true)

    if (pagesError) {
      console.error('Error fetching pages:', pagesError)
      return NextResponse.json([])
    }

    // Get latest check for each page
    const statusList = await Promise.all(
      (pages || []).map(async (page) => {
        const { data: latestCheck } = await supabase
          .from('check_history')
          .select('status, response_time, checked_at, error')
          .eq('page_id', page.id)
          .order('checked_at', { ascending: false })
          .limit(1)
          .single()

        const clientData = page.clients as { name: string } | { name: string }[] | null
        const clientName = Array.isArray(clientData) ? clientData[0]?.name : clientData?.name

        return {
          pageId: page.id,
          name: page.name,
          url: page.url,
          client: clientName || '',
          status: latestCheck?.status || null,
          responseTime: latestCheck?.response_time || 0,
          success: latestCheck ? latestCheck.status >= 200 && latestCheck.status < 400 : false,
          lastCheck: latestCheck?.checked_at || null,
          error: latestCheck?.error || null,
        }
      })
    )

    return NextResponse.json(statusList)
  } catch (error) {
    console.error('Error in status API:', error)
    return NextResponse.json([])
  }
}
