import * as cron from 'node-cron';
import { checkPage } from '../checker.js';
import { appendHistory, cleanupOldHistory } from '../status-writer.js';
import { logger } from '../logger.js';

interface ScheduledPage {
  id: string;
  name: string;
  url: string;
  interval: number;
  timeout: number;
  enabled: boolean;
  soft404Patterns?: string[];
}

interface UptimeSchedulerConfig {
  timezone?: string;
  checkTimes?: string[]; // Array of HH:MM times for checks
}

const DEFAULT_CONFIG: UptimeSchedulerConfig = {
  timezone: process.env.TZ || 'America/Sao_Paulo',
  checkTimes: ['00:00', '06:00', '12:00', '18:00'],
};

let scheduledTasks: cron.ScheduledTask[] = [];
let getPagesFn: (() => Promise<ScheduledPage[]>) | null = null;
let isRunning = false;

/**
 * Convert HH:MM time to cron expression
 * e.g., "06:00" -> "0 6 * * *"
 */
function timeToCron(time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  return `${minute} ${hour} * * *`;
}

/**
 * Run uptime checks for all enabled pages
 */
async function runUptimeChecks(): Promise<void> {
  if (!getPagesFn) {
    logger.warn('[Uptime Scheduler] No pages function configured');
    return;
  }

  const pages = await getPagesFn();
  const enabledPages = pages.filter(p => p.enabled);

  if (enabledPages.length === 0) {
    logger.info('[Uptime Scheduler] No enabled pages to check');
    return;
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  logger.info(`[Uptime Scheduler] Running scheduled check at ${timeStr} for ${enabledPages.length} page(s)`);

  // Cleanup old history entries before running new checks
  await cleanupOldHistory();

  let checkedCount = 0;

  for (const page of enabledPages) {
    try {
      const result = await checkPage({
        name: page.name,
        url: page.url,
        interval: page.interval || 30000,
        timeout: page.timeout || 10000,
        soft404Patterns: page.soft404Patterns || [],
      });

      await appendHistory(page.id, result);
      checkedCount++;

      if (result.success) {
        logger.status(result.name, result.status, result.responseTime, true);
      } else {
        logger.status(result.name, result.status, result.responseTime, false);
        if (result.error) {
          logger.error(`  -> ${result.error}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[Uptime Scheduler] Error checking ${page.name}: ${message}`);
    }
  }

  logger.info(`[Uptime Scheduler] Completed check for ${checkedCount} page(s)`);
}

/**
 * Start the uptime scheduler with cron-based scheduling
 * @param getPages Async function to get the list of pages to monitor
 * @param config Optional configuration for timezone and check times
 */
export function startUptimeScheduler(
  getPages: () => Promise<ScheduledPage[]>,
  config: UptimeSchedulerConfig = {}
): void {
  if (isRunning) {
    logger.warn('[Uptime Scheduler] Already running');
    return;
  }

  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  getPagesFn = getPages;
  isRunning = true;

  logger.info(`[Uptime Scheduler] Starting with timezone: ${mergedConfig.timezone}`);
  logger.info(`[Uptime Scheduler] Check times: ${mergedConfig.checkTimes?.join(', ')}`);

  // Schedule each check time
  for (const time of mergedConfig.checkTimes || []) {
    const cronExpr = timeToCron(time);

    const task = cron.schedule(cronExpr, () => {
      runUptimeChecks().catch(err => {
        logger.error(`[Uptime Scheduler] Check failed: ${err}`);
      });
    }, {
      timezone: mergedConfig.timezone,
    });

    scheduledTasks.push(task);
    logger.info(`[Uptime Scheduler] Scheduled check at ${time} (cron: ${cronExpr})`);
  }

  // Run an initial check on startup
  logger.info('[Uptime Scheduler] Running initial check on startup...');
  runUptimeChecks().catch(err => {
    logger.error(`[Uptime Scheduler] Initial check failed: ${err}`);
  });
}

/**
 * Stop the uptime scheduler
 */
export function stopUptimeScheduler(): void {
  if (!isRunning) {
    return;
  }

  logger.info('[Uptime Scheduler] Stopping...');

  for (const task of scheduledTasks) {
    task.stop();
  }

  scheduledTasks = [];
  getPagesFn = null;
  isRunning = false;

  logger.info('[Uptime Scheduler] Stopped');
}

/**
 * Manually trigger an uptime check (for testing or on-demand)
 */
export async function runManualUptimeCheck(): Promise<void> {
  logger.info('[Uptime Scheduler] Manual check triggered');
  await runUptimeChecks();
}

/**
 * Get the next scheduled check time
 */
export function getNextCheckTime(config: UptimeSchedulerConfig = DEFAULT_CONFIG): Date | null {
  const now = new Date();
  const times = config.checkTimes || DEFAULT_CONFIG.checkTimes || [];

  for (const time of times) {
    const [hour, minute] = time.split(':').map(Number);
    const checkTime = new Date(now);
    checkTime.setHours(hour, minute, 0, 0);

    if (checkTime > now) {
      return checkTime;
    }
  }

  // Next check is tomorrow at first time
  if (times.length > 0) {
    const [hour, minute] = times[0].split(':').map(Number);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(hour, minute, 0, 0);
    return tomorrow;
  }

  return null;
}
