import { config } from 'dotenv';
config({ path: '.env.local' });
import { startUptimeScheduler, stopUptimeScheduler } from './services/uptime-scheduler.js';
import { logger } from './logger.js';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET || '';
const INTERVAL = parseInt(process.env.MONITOR_INTERVAL_MINUTES || '5', 10);

async function main(): Promise<void> {
  logger.info('Prymo Monitora v2.0.0');
  logger.info(`Timezone: ${process.env.TZ || 'America/Sao_Paulo'}`);

  if (!CRON_SECRET) {
    logger.warn('CRON_SECRET not set — add it to .env.local for uptime checks to work');
  }

  startUptimeScheduler({
    dashboardUrl: DASHBOARD_URL,
    cronSecret: CRON_SECRET,
    timezone: process.env.TZ || 'America/Sao_Paulo',
    intervalMinutes: INTERVAL,
  });

  logger.info('Monitor started. Press Ctrl+C to stop.');

  process.on('SIGINT', () => {
    logger.info('Received SIGINT');
    stopUptimeScheduler();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM');
    stopUptimeScheduler();
    process.exit(0);
  });
}

main().catch(err => {
  logger.error(`Failed to start: ${err}`);
  process.exit(1);
});
