import * as cron from 'node-cron';

interface ReportSchedulerConfig {
  timezone?: string;
  reportDay?: number; // 0-6, where 0 is Sunday and 1 is Monday
  reportTime?: string; // HH:MM format
}

const DEFAULT_CONFIG: ReportSchedulerConfig = {
  timezone: process.env.TZ || 'America/Sao_Paulo',
  reportDay: parseInt(process.env.REPORT_DAY || '1', 10), // Monday
  reportTime: process.env.REPORT_TIME || '08:30',
};

let scheduledTask: cron.ScheduledTask | null = null;

function toCronExpression(day: number, time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  return `${minute} ${hour} * * ${day}`;
}

/**
 * Trigger report generation via the dashboard API
 */
async function triggerReports(): Promise<void> {
  const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
  const cronSecret = process.env.CRON_SECRET || '';

  try {
    const res = await fetch(`${dashboardUrl}/api/cron/reports`, {
      headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {},
    });

    const data = await res.json() as Record<string, unknown>;
    console.log(`[Report Scheduler] Reports generated:`, data.message || data.error);
  } catch (error) {
    console.error('[Report Scheduler] Failed to trigger reports:', error);
  }
}

/**
 * Start the weekly report scheduler
 */
export function startReportScheduler(config: ReportSchedulerConfig = {}): void {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const cronExpr = toCronExpression(
    mergedConfig.reportDay ?? 1,
    mergedConfig.reportTime ?? '08:30'
  );

  console.log(`[Report Scheduler] Starting with timezone: ${mergedConfig.timezone}`);
  console.log(`[Report Scheduler] Schedule: ${cronExpr} (day ${mergedConfig.reportDay}, time ${mergedConfig.reportTime})`);

  scheduledTask = cron.schedule(cronExpr, () => {
    console.log('[Report Scheduler] Running weekly report generation...');
    triggerReports();
  }, {
    timezone: mergedConfig.timezone,
  });

  console.log('[Report Scheduler] Scheduler started');
}

/**
 * Stop the report scheduler
 */
export function stopReportScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[Report Scheduler] Stopped');
  }
}

/**
 * Manually trigger report generation
 */
export async function runReportsNow(): Promise<void> {
  console.log('[Report Scheduler] Manual report generation triggered');
  await triggerReports();
}
