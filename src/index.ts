import { loadPagesForScheduler } from './pages-loader.js';
import { startUptimeScheduler, stopUptimeScheduler } from './services/uptime-scheduler.js';
import { logger } from './logger.js';

async function main(): Promise<void> {
  try {
    logger.info('Prymo Monitora v1.0.0');
    logger.info(`Timezone: ${process.env.TZ || 'America/Sao_Paulo'}`);

    // Get initial page count from Supabase
    const pages = await loadPagesForScheduler();

    if (pages.length === 0) {
      logger.warn('No pages found in Supabase. Waiting for pages to be added via dashboard...');
    } else {
      logger.info(`Found ${pages.length} page(s) to monitor from Supabase`);
    }

    // Configure uptime scheduler (4x/day at fixed times)
    const uptimeConfig = {
      timezone: process.env.TZ || 'America/Sao_Paulo',
      checkTimes: process.env.UPTIME_CHECK_TIMES?.split(',') || ['00:00', '06:00', '12:00', '18:00'],
    };

    // Start uptime scheduler (reads pages from Supabase on each check)
    startUptimeScheduler(loadPagesForScheduler, uptimeConfig);

    // Graceful shutdown
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

    logger.info('Monitor started. Press Ctrl+C to stop.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to start: ${message}`);
    process.exit(1);
  }
}

main();
