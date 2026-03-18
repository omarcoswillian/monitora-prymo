import * as cron from 'node-cron';
import { logger } from '../logger.js';

interface UptimeSchedulerConfig {
  dashboardUrl: string;
  cronSecret: string;
  timezone?: string;
  intervalMinutes?: number;
}

let scheduledTask: cron.ScheduledTask | null = null;
let isRunning = false;
let config: UptimeSchedulerConfig;

/**
 * Call the dashboard's /api/cron/uptime endpoint which handles
 * the full pipeline: check → history → status → incidents → alerts
 */
async function runUptimeCheck(): Promise<void> {
  const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  logger.info(`[Uptime] Running check at ${timeStr}`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 2 min timeout

    const res = await fetch(`${config.dashboardUrl}/api/cron/uptime`, {
      headers: { Authorization: `Bearer ${config.cronSecret}` },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      logger.error(`[Uptime] API returned ${res.status}: ${text}`);
      return;
    }

    const data = await res.json() as Record<string, unknown>;
    logger.info(`[Uptime] Done in ${data.duration}: ${data.online} OK, ${data.failed} FAIL, ${data.incidentsCreated} incidents created, ${data.incidentsResolved} resolved`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[Uptime] Failed to call dashboard API: ${msg}`);
  }
}

/**
 * Start the uptime scheduler
 */
export function startUptimeScheduler(cfg: UptimeSchedulerConfig): void {
  if (isRunning) {
    logger.warn('[Uptime] Already running');
    return;
  }

  config = cfg;
  isRunning = true;

  const tz = cfg.timezone || 'America/Sao_Paulo';
  const interval = cfg.intervalMinutes || 5;
  const cronExpr = `*/${interval} * * * *`;

  logger.info(`[Uptime] Scheduler starting — every ${interval}min (${cronExpr}), timezone: ${tz}`);
  logger.info(`[Uptime] Dashboard: ${cfg.dashboardUrl}`);

  scheduledTask = cron.schedule(cronExpr, () => {
    runUptimeCheck().catch(err => {
      logger.error(`[Uptime] Check failed: ${err}`);
    });
  }, { timezone: tz });

  // Initial check after short delay (wait for Next.js to be ready in dev)
  const startupDelay = process.env.NODE_ENV === 'production' ? 2000 : 8000;
  logger.info(`[Uptime] First check in ${startupDelay / 1000}s...`);
  setTimeout(() => {
    runUptimeCheck().catch(err => {
      logger.error(`[Uptime] Initial check failed: ${err}`);
    });
  }, startupDelay);
}

/**
 * Stop the uptime scheduler
 */
export function stopUptimeScheduler(): void {
  if (!isRunning) return;

  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }

  isRunning = false;
  logger.info('[Uptime] Scheduler stopped');
}
