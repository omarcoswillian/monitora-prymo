import * as cron from 'node-cron';
import { generateAllWeeklyReports } from './report-generator.js';

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

/**
 * Convert day and time to cron expression
 * @param day 0-6 (Sunday-Saturday)
 * @param time HH:MM
 */
function toCronExpression(day: number, time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  return `${minute} ${hour} * * ${day}`;
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

    try {
      // Generate reports for the previous week
      const previousWeek = new Date();
      previousWeek.setDate(previousWeek.getDate() - 7);

      const reports = generateAllWeeklyReports(previousWeek);
      console.log(`[Report Scheduler] Generated ${reports.length} report(s)`);
    } catch (error) {
      console.error('[Report Scheduler] Failed to generate reports:', error);
    }
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
export function runReportsNow(): string[] {
  console.log('[Report Scheduler] Manual report generation triggered');
  return generateAllWeeklyReports();
}
