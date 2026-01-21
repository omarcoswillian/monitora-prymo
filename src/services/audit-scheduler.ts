import { runPageSpeedAudit, isApiKeyConfigured } from './pagespeed.js';
import { saveAudit, needsAuditToday } from '../storage/auditsStore.js';
import type { PageConfig } from '../types.js';

interface ScheduledPage {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

let scheduledInterval: NodeJS.Timeout | null = null;
let lastCheckDate: string | null = null;

export function startAuditScheduler(getPages: () => ScheduledPage[]): void {
  if (!isApiKeyConfigured()) {
    console.log('[Audit Scheduler] PageSpeed API key not configured - scheduler disabled');
    return;
  }

  console.log('[Audit Scheduler] Starting daily audit scheduler');

  // Check every hour if we need to run audits
  scheduledInterval = setInterval(async () => {
    await checkAndRunDailyAudits(getPages);
  }, 60 * 60 * 1000); // Every hour

  // Run initial check
  checkAndRunDailyAudits(getPages);
}

export function stopAuditScheduler(): void {
  if (scheduledInterval) {
    clearInterval(scheduledInterval);
    scheduledInterval = null;
    console.log('[Audit Scheduler] Stopped');
  }
}

async function checkAndRunDailyAudits(getPages: () => ScheduledPage[]): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // Only run once per day
  if (lastCheckDate === today) {
    return;
  }

  // Run audits in the morning (between 6-7 AM)
  const hour = new Date().getHours();
  if (hour < 6 || hour > 7) {
    return;
  }

  lastCheckDate = today;
  const pages = getPages();

  console.log(`[Audit Scheduler] Running daily audits for ${pages.length} pages`);

  for (const page of pages) {
    if (!page.enabled) continue;

    const pageId = page.id;

    // Check if we already have an audit for today
    if (!needsAuditToday(pageId)) {
      continue;
    }

    try {
      console.log(`[Audit Scheduler] Running audit for: ${page.name}`);
      const result = await runPageSpeedAudit(page.url);
      saveAudit(pageId, page.url, result);

      if (result.success && result.scores) {
        console.log(`[Audit Scheduler] ✓ ${page.name}: P:${result.scores.performance} A:${result.scores.accessibility} BP:${result.scores.bestPractices} SEO:${result.scores.seo}`);
      } else {
        console.log(`[Audit Scheduler] ✗ ${page.name}: ${result.error}`);
      }

      // Wait between requests to avoid rate limiting
      await sleep(5000);
    } catch (error) {
      console.error(`[Audit Scheduler] Error auditing ${page.name}:`, error);
    }
  }

  console.log('[Audit Scheduler] Daily audits completed');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Manual trigger for running audits on demand
export async function runAuditForPage(pageId: string, url: string): Promise<void> {
  if (!isApiKeyConfigured()) {
    throw new Error('PageSpeed API key not configured');
  }

  const result = await runPageSpeedAudit(url);
  saveAudit(pageId, url, result);
}
