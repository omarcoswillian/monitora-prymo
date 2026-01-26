import { NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { getAllPages } from '@/lib/supabase-pages-store'
import { getLatestCheck } from '@/lib/supabase-history-store'
import { checkPage, writeCheckHistory, trackIncident } from '@/lib/page-checker'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const runTest = searchParams.get('test') === '1'
  const checkMissing = searchParams.get('checkMissing') === '1'

  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    envLoaded: isSupabaseConfigured(),
  }

  try {
    // 1. Test pages query
    const pages = await getAllPages()
    diagnostics.pagesCount = pages.length
    diagnostics.pages = pages.map(p => ({
      id: p.id,
      name: p.name,
      client: p.client,
      url: p.url,
      enabled: p.enabled,
    }))

    // 2. Test getLatestCheck vs raw query for the first page
    if (pages.length > 0) {
      const testPageId = pages[0].id

      // Via getLatestCheck function
      const fnResult = await getLatestCheck(testPageId)

      // Via direct raw query (same logic but without .single())
      const { data: rawRows, error: rawError } = await supabase
        .from('check_history')
        .select('*')
        .eq('page_id', testPageId)
        .order('checked_at', { ascending: false })
        .limit(1)
      const rawResult = rawRows?.[0] || null

      // Count total entries for this page
      const { count } = await supabase
        .from('check_history')
        .select('*', { count: 'exact', head: true })
        .eq('page_id', testPageId)

      diagnostics.queryTest = {
        testPageId,
        testPageName: pages[0].name,
        getLatestCheckResult: fnResult,
        rawQueryResult: rawResult,
        rawQueryError: rawError?.message || null,
        totalEntriesForPage: count,
      }
    }

    // 3. Test check_history for each page
    const checkResults: Record<string, unknown> = {}
    for (const page of pages) {
      const latest = await getLatestCheck(page.id)
      checkResults[page.id] = latest
        ? {
            status: latest.status,
            responseTime: latest.responseTime,
            error: latest.error,
            checkedAt: latest.checkedAt,
          }
        : null
    }
    diagnostics.latestChecks = checkResults

    // 4. Test incidents query
    const { data: incidents, error: incError } = await supabase
      .from('incidents')
      .select('id, page_id, type, message, started_at, resolved_at')
      .order('started_at', { ascending: false })
      .limit(20)

    diagnostics.incidentsError = incError?.message || null
    diagnostics.incidentsCount = incidents?.length || 0
    diagnostics.incidents = (incidents || []).map(i => ({
      id: i.id,
      pageId: i.page_id,
      type: i.type,
      message: i.message,
      startedAt: i.started_at,
      resolvedAt: i.resolved_at,
    }))

    // 5. Test check_history table directly (most recent entries)
    const { data: historyRows, error: histError } = await supabase
      .from('check_history')
      .select('id, page_id, status, response_time, error, checked_at')
      .order('checked_at', { ascending: false })
      .limit(10)

    diagnostics.historyError = histError?.message || null
    diagnostics.historyCount = historyRows?.length || 0
    diagnostics.recentHistory = historyRows || []

    // 6. Test the full check pipeline (only if ?test=1)
    if (runTest && pages.length > 0) {
      const testPage = pages[0]
      const steps: Record<string, unknown> = { page: testPage.name }

      try {
        // Step A: checkPage
        const result = await checkPage({
          id: testPage.id,
          name: testPage.name,
          clientName: testPage.client,
          url: testPage.url,
          timeout: testPage.timeout,
          soft404Patterns: testPage.soft404Patterns || undefined,
        })
        steps.checkResult = {
          status: result.status,
          responseTime: result.responseTime,
          statusLabel: result.statusLabel,
          success: result.success,
          error: result.error,
          errorType: result.errorType,
        }

        // Step B: writeCheckHistory
        try {
          await writeCheckHistory(result)
          steps.writeHistory = 'OK'
        } catch (e) {
          steps.writeHistory = `ERROR: ${e instanceof Error ? e.message : 'Unknown'}`
        }

        // Step C: trackIncident
        try {
          const incResult = await trackIncident(result)
          steps.trackIncident = incResult
        } catch (e) {
          steps.trackIncident = `ERROR: ${e instanceof Error ? e.message : 'Unknown'}`
        }

        // Step D: Verify write by reading back via getLatestCheck
        const verifyCheck = await getLatestCheck(testPage.id)
        steps.verifyLatestCheck = verifyCheck
          ? {
              id: verifyCheck.id,
              status: verifyCheck.status,
              responseTime: verifyCheck.responseTime,
              checkedAt: verifyCheck.checkedAt,
            }
          : null

        // Step E: Direct query to see ALL entries for this page
        const { data: allEntries, error: allErr } = await supabase
          .from('check_history')
          .select('id, page_id, status, response_time, checked_at')
          .eq('page_id', testPage.id)
          .order('checked_at', { ascending: false })
          .limit(10)

        steps.allEntriesForPage = {
          error: allErr?.message || null,
          count: allEntries?.length || 0,
          entries: allEntries || [],
        }

        // Step F: Check if the NEW entry exists anywhere in the table
        const { data: recentAll, error: recentErr } = await supabase
          .from('check_history')
          .select('id, page_id, status, response_time, checked_at')
          .order('checked_at', { ascending: false })
          .limit(5)

        steps.mostRecentGlobal = {
          error: recentErr?.message || null,
          entries: recentAll || [],
        }

      } catch (e) {
        steps.error = e instanceof Error ? e.message : 'Unknown error'
      }

      diagnostics.fullPipelineTest = steps
    }

    // 7. Raw table audit: list ALL page IDs directly from the pages table
    const { data: rawAllPages, error: rawAllErr } = await supabase
      .from('pages')
      .select('id, name, client_id')
      .order('name')

    const rawPageIds = (rawAllPages || []).map((p: { id: string }) => p.id)
    const getAllPagesIds = pages.map(p => p.id)

    // Find discrepancies
    const inGetAllButNotRaw = getAllPagesIds.filter(id => !rawPageIds.includes(id))
    const inRawButNotGetAll = rawPageIds.filter(id => !getAllPagesIds.includes(id))

    diagnostics.rawTableAudit = {
      rawQueryError: rawAllErr?.message || null,
      rawPageCount: rawAllPages?.length || 0,
      rawPageIds: rawAllPages || [],
      getAllPagesCount: pages.length,
      getAllPagesIds,
      discrepancy_inGetAllButNotRaw: inGetAllButNotRaw,
      discrepancy_inRawButNotGetAll: inRawButNotGetAll,
    }

    // 8. Direct DB diagnostics for pages without check history
    const pagesWithoutChecks = pages.filter(p => {
      return p.enabled && !checkResults[p.id]
    })
    if (pagesWithoutChecks.length > 0) {
      const dbDiag: Record<string, unknown> = {}
      for (const page of pagesWithoutChecks) {
        // Check if page exists in raw pages table
        const { data: rawPage, error: rawErr } = await supabase
          .from('pages')
          .select('id, name, client_id')
          .eq('id', page.id)
          .limit(1)

        dbDiag[page.id] = {
          pageName: page.name,
          pageIdFromGetAll: page.id,
          pageIdLength: page.id.length,
          existsInRawList: rawPageIds.includes(page.id),
          rawPageFound: rawPage && rawPage.length > 0,
          rawPageData: rawPage?.[0] || null,
          rawPageError: rawErr?.message || null,
        }
      }
      diagnostics.dbDiagnostics = dbDiag
    }

    // 8. Check all pages without recent check history (?checkMissing=1)
    if (checkMissing) {
      const missingResults: Record<string, unknown> = {}
      for (const page of pages) {
        if (!page.enabled) continue
        const latest = await getLatestCheck(page.id)
        if (latest) continue // already has check data

        try {
          const result = await checkPage({
            id: page.id,
            name: page.name,
            clientName: page.client,
            url: page.url,
            timeout: page.timeout,
            soft404Patterns: page.soft404Patterns || undefined,
          })

          // Write check history and capture any errors
          const { error: writeErr } = await supabase.from('check_history').insert({
            page_id: result.pageId,
            status: result.status ?? 0,
            response_time: result.responseTime,
            error: result.error || null,
            checked_at: new Date().toISOString(),
          })

          await trackIncident(result)

          // Verify the write by reading back
          const verify = await getLatestCheck(page.id)

          missingResults[page.id] = {
            page: page.name,
            checkStatus: result.status,
            responseTime: result.responseTime,
            statusLabel: result.statusLabel,
            success: result.success,
            checkError: result.error,
            writeError: writeErr?.message || null,
            writeCode: writeErr?.code || null,
            verifyFound: verify !== null,
            verifyCheckedAt: verify?.checkedAt || null,
          }
        } catch (e) {
          missingResults[page.id] = {
            page: page.name,
            fatalError: e instanceof Error ? e.message : 'Unknown',
          }
        }
      }
      diagnostics.checkMissingResults = missingResults
    }

  } catch (err) {
    diagnostics.error = err instanceof Error ? err.message : 'Unknown error'
  }

  return NextResponse.json(diagnostics)
}
