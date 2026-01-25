import { supabase } from './lib/supabase.js';
import type { CheckResult } from './types.js';

const HISTORY_RETENTION_DAYS = 7;

/**
 * Write status for all checked pages.
 * In Supabase mode this is a no-op because each result is already
 * inserted individually via appendHistory. The "current status" is
 * derived by querying the latest check_history entry per page.
 */
export function writeStatus(): void {
  // No-op: status is derived from check_history in Supabase
}

/**
 * Append a check result to the check_history table in Supabase
 */
export async function appendHistory(pageId: string, result: CheckResult): Promise<void> {
  const { error } = await supabase.from('check_history').insert({
    page_id: pageId,
    status: result.status ?? 0,
    response_time: result.responseTime,
    error: result.error || null,
    checked_at: result.timestamp.toISOString(),
  });

  if (error) {
    console.error(`[Status Writer] Error inserting check_history for page ${pageId}:`, error.message);
  }
}

/**
 * Delete check_history entries older than HISTORY_RETENTION_DAYS
 */
export async function cleanupOldHistory(): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - HISTORY_RETENTION_DAYS);

  const { error, count } = await supabase
    .from('check_history')
    .delete()
    .lt('checked_at', cutoffDate.toISOString());

  if (error) {
    console.error('[Status Writer] Error cleaning old history:', error.message);
  } else if (count && count > 0) {
    console.log(`[Status Writer] Cleaned up ${count} old history entries`);
  }
}
