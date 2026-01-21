import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MonitorConfig, PageConfig } from './types.js';

const DEFAULT_INTERVAL = 30000;
const DEFAULT_TIMEOUT = 10000;

export function loadConfig(configPath?: string): MonitorConfig {
  const path = configPath || join(process.cwd(), 'config.json');

  const fileContent = readFileSync(path, 'utf-8');
  const config = JSON.parse(fileContent) as MonitorConfig;

  validateConfig(config);

  return config;
}

function validateConfig(config: MonitorConfig): void {
  if (!config.pages || !Array.isArray(config.pages)) {
    throw new Error('Config must have a "pages" array');
  }

  if (config.pages.length === 0) {
    throw new Error('Config must have at least one page to monitor');
  }

  for (const page of config.pages) {
    if (!page.url) {
      throw new Error('Each page must have a "url" property');
    }

    if (!page.name) {
      throw new Error('Each page must have a "name" property');
    }

    try {
      new URL(page.url);
    } catch {
      throw new Error(`Invalid URL: ${page.url}`);
    }
  }
}

export function getPageConfig(
  page: PageConfig,
  defaults?: MonitorConfig['defaults']
): Required<PageConfig> {
  return {
    name: page.name,
    url: page.url,
    interval: page.interval ?? defaults?.interval ?? DEFAULT_INTERVAL,
    timeout: page.timeout ?? defaults?.timeout ?? DEFAULT_TIMEOUT,
    soft404Patterns: page.soft404Patterns ?? [],
  };
}
