import { loadConfig } from './config.js';
import { Monitor } from './monitor.js';
import { logger } from './logger.js';

function main(): void {
  try {
    logger.info('Monitor Pages v1.0.0');

    const config = loadConfig();
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
