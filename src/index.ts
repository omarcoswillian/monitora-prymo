import { loadPagesForScheduler, loadAllPageEntries } from './pages-loader.js';
import { startUptimeScheduler, stopUptimeScheduler } from './services/uptime-scheduler.js';
import { startAuditScheduler, stopAuditScheduler } from './services/audit-scheduler.js';
import { startReportScheduler, stopReportScheduler } from './services/report-scheduler.js';
import { logger } from './logger.js';

function main(): void {
  try {
    logger.info('Prymo Monitora v1.0.0');
    logger.info(`Timezone: ${process.env.TZ || 'America/Sao_Paulo'}`);

    // Get initial page count
    const pages = loadPagesForScheduler();

    if (pages.length === 0) {
      logger.warn('No pages found in data/pages.json. Waiting for pages to be added...');
    } else {
      logger.info(`Found ${pages.length} page(s) to monitor`);
    }

    // Configure uptime scheduler (4x/day at fixed times)
    const uptimeConfig = {
      timezone: process.env.TZ || 'America/Sao_Paulo',
      checkTimes: process.env.UPTIME_CHECK_TIMES?.split(',') || ['00:00', '06:00', '12:00', '18:00'],
    };

    // Start uptime scheduler
    startUptimeScheduler(loadPagesForScheduler, uptimeConfig);

    // Start audit scheduler (PageSpeed)
    const auditPages = loadAllPageEntries;
    startAuditScheduler(() =>
      auditPages().map(p => ({
        id: p.id,
        name: p.name,
        url: p.url,
        enabled: p.enabled,
      }))
    );

    // Start report scheduler (weekly reports)
    startReportScheduler({
      timezone: process.env.TZ || 'America/Sao_Paulo',
      reportDay: parseInt(process.env.REPORT_DAY || '1', 10), // Monday
      reportTime: process.env.REPORT_TIME || '08:30',
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Received SIGINT');
      stopUptimeScheduler();
      stopAuditScheduler();
      stopReportScheduler();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM');
      stopUptimeScheduler();
      stopAuditScheduler();
      stopReportScheduler();
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
