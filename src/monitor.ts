import type { MonitorConfig } from './types.js';
import { getPageConfig } from './config.js';
import { checkPage } from './checker.js';
import { logger } from './logger.js';

export class Monitor {
  private config: MonitorConfig;
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private running = false;

  constructor(config: MonitorConfig) {
    this.config = config;
  }

  start(): void {
    if (this.running) {
      logger.warn('Monitor is already running');
      return;
    }

    this.running = true;
    logger.info(`Starting monitor for ${this.config.pages.length} page(s)`);

    for (const page of this.config.pages) {
      const pageConfig = getPageConfig(page, this.config.defaults);
      this.scheduleCheck(pageConfig);
    }
  }

  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;
    logger.info('Stopping monitor...');

    for (const [name, timer] of this.timers) {
      clearInterval(timer);
      this.timers.delete(name);
    }

    logger.info('Monitor stopped');
  }

  private scheduleCheck(page: Required<(typeof this.config.pages)[0]>): void {
    const check = async () => {
      const result = await checkPage(page);

      if (result.success) {
        logger.status(result.name, result.status, result.responseTime, true);
      } else {
        logger.status(result.name, result.status, result.responseTime, false);
        if (result.error) {
          logger.error(`  └─ ${result.error}`);
        }
      }
    };

    check();

    const timer = setInterval(check, page.interval);
    this.timers.set(page.name, timer);

    logger.info(`Scheduled "${page.name}" every ${page.interval / 1000}s`);
  }
}
