import * as cron from 'node-cron';
import { runPageSpeedAudit, isApiKeyConfigured } from './pagespeed.js';
import { saveAudit, needsAuditToday } from '../storage/auditsStore.js';

interface ScheduledPage {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

interface AuditSchedulerConfig {
  timezone?: string;
  auditTime?: string; // HH:MM format
  manualRateLimitMinutes?: number;
}

const DEFAULT_CONFIG: AuditSchedulerConfig = {
  timezone: process.env.TZ || 'America/Sao_Paulo',
  auditTime: process.env.AUDIT_TIME || '08:00',
  manualRateLimitMinutes: parseInt(process.env.AUDIT_RATE_LIMIT_MINUTES || '5', 10),
};

let scheduledTask: cron.ScheduledTask | null = null;
let getPagesFn: (() => ScheduledPage[]) | null = null;
const manualAuditTimestamps = new Map<string, number>();

/**
 * Convert HH:MM time to cron expression
 */
function timeToCron(time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  return `${minute} ${hour} * * *`;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run daily audits for all enabled pages
 */
async function runDailyAudits(): Promise<void> {
  if (!getPagesFn) {
    console.log('[Audit Scheduler] No pages function configured');
    return;
  }

  if (!isApiKeyConfigured()) {
    console.log('[Audit Scheduler] PageSpeed API key not configured - skipping');
    return;
  }

  const pages = getPagesFn();
  const enabledPages = pages.filter(p => p.enabled);

  if (enabledPages.length === 0) {
    console.log('[Audit Scheduler] No enabled pages to audit');
    return;
  }

  console.log(`[Audit Scheduler] Running daily audits for ${enabledPages.length} pages`);

  for (const page of enabledPages) {
    // Check if we already have an audit for today
    if (!needsAuditToday(page.id)) {
      console.log(`[Audit Scheduler] Skipping ${page.name} - already audited today`);
      continue;
    }

    try {
      console.log(`[Audit Scheduler] Running audit for: ${page.name}`);
      const result = await runPageSpeedAudit(page.url);
      saveAudit(page.id, page.url, result);

      if (result.success && result.scores) {
        console.log(`[Audit Scheduler] OK ${page.name}: P:${result.scores.performance} A:${result.scores.accessibility} BP:${result.scores.bestPractices} SEO:${result.scores.seo}`);
      } else {
        console.log(`[Audit Scheduler] FAIL ${page.name}: ${result.error}`);
      }

      // Wait between requests to avoid rate limiting
      await sleep(5000);
    } catch (error) {
      console.error(`[Audit Scheduler] Error auditing ${page.name}:`, error);
    }
  }

  console.log('[Audit Scheduler] Daily audits completed');
}

/**
 * Start the audit scheduler
 */
export function startAuditScheduler(
  getPages: () => ScheduledPage[],
  config: AuditSchedulerConfig = {}
): void {
  if (!isApiKeyConfigured()) {
    console.log('[Audit Scheduler] PageSpeed API key not configured - scheduler disabled');
    return;
  }

  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  getPagesFn = getPages;

  const cronExpr = timeToCron(mergedConfig.auditTime || '08:00');

  console.log(`[Audit Scheduler] Starting with timezone: ${mergedConfig.timezone}`);
  console.log(`[Audit Scheduler] Audit time: ${mergedConfig.auditTime} (cron: ${cronExpr})`);
  console.log(`[Audit Scheduler] Manual rate limit: ${mergedConfig.manualRateLimitMinutes} minutes`);

  scheduledTask = cron.schedule(cronExpr, () => {
    runDailyAudits().catch(err => {
      console.error('[Audit Scheduler] Daily audit failed:', err);
    });
  }, {
    timezone: mergedConfig.timezone,
  });

  console.log('[Audit Scheduler] Scheduler started');
}

/**
 * Stop the audit scheduler
 */
export function stopAuditScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[Audit Scheduler] Stopped');
  }
}

/**
 * Check if manual audit is rate limited for a page
 */
export function isManualAuditRateLimited(pageId: string): { limited: boolean; remainingSeconds: number } {
  const lastRun = manualAuditTimestamps.get(pageId);
  if (!lastRun) {
    return { limited: false, remainingSeconds: 0 };
  }

  const rateLimitMs = (DEFAULT_CONFIG.manualRateLimitMinutes || 5) * 60 * 1000;
  const elapsed = Date.now() - lastRun;

  if (elapsed < rateLimitMs) {
    const remainingMs = rateLimitMs - elapsed;
    return {
      limited: true,
      remainingSeconds: Math.ceil(remainingMs / 1000),
    };
  }

  return { limited: false, remainingSeconds: 0 };
}

/**
 * Manual trigger for running audits on demand
 * Includes rate limiting per page
 */
export async function runAuditForPage(pageId: string, url: string): Promise<{ success: boolean; error?: string }> {
  if (!isApiKeyConfigured()) {
    return { success: false, error: 'PageSpeed API key not configured' };
  }

  const rateLimit = isManualAuditRateLimited(pageId);
  if (rateLimit.limited) {
    return {
      success: false,
      error: `Rate limited. Try again in ${rateLimit.remainingSeconds} seconds`,
    };
  }

  try {
    const result = await runPageSpeedAudit(url);
    saveAudit(pageId, url, result);

    // Update rate limit timestamp
    manualAuditTimestamps.set(pageId, Date.now());

    if (result.success) {
      return { success: true };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Run all audits manually (admin function)
 */
export async function runAllAuditsNow(): Promise<void> {
  await runDailyAudits();
}
