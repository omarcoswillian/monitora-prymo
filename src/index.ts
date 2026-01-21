import { loadPagesFromJson } from './pages-loader.js';
import { Monitor } from './monitor.js';
import { logger } from './logger.js';
import type { MonitorConfig } from './types.js';

function main(): void {
  try {
    logger.info('Monitor Pages v1.0.0');

    const pages = loadPagesFromJson();

    if (pages.length === 0) {
      logger.warn('No enabled pages found in data/pages.json. Waiting for pages to be added...');
    }

    const config: MonitorConfig = {
      pages,
      defaults: {
        interval: 30000,
        timeout: 10000,
      },
    };

    const monitor = new Monitor(config);

    process.on('SIGINT', () => {
      logger.info('Received SIGINT');
      monitor.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM');
      monitor.stop();
      process.exit(0);
    });

    monitor.start();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to start: ${message}`);
    process.exit(1);
  }
}

main();
