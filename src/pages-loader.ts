import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { PageConfig } from './types.js';

export interface PageEntry {
  id: string;
  client: string;
  name: string;
  url: string;
  interval: number;
  timeout: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  soft404Patterns?: string[];
}

const PAGES_FILE = join(process.cwd(), 'data', 'pages.json');

function ensureDataDir(): void {
  const dir = dirname(PAGES_FILE);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function loadPagesFromJson(): PageConfig[] {
  ensureDataDir();

  if (!existsSync(PAGES_FILE)) {
    writeFileSync(PAGES_FILE, '[]', 'utf-8');
    return [];
  }

  try {
    const content = readFileSync(PAGES_FILE, 'utf-8');
    const entries = JSON.parse(content) as PageEntry[];

    return entries
      .filter(entry => entry.enabled)
      .map(entry => ({
        name: `[${entry.client}] ${entry.name}`,
        url: entry.url,
        interval: entry.interval,
        timeout: entry.timeout,
        soft404Patterns: entry.soft404Patterns,
      }));
  } catch {
    return [];
  }
}
