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

/**
 * Load all page entries (for scheduler use)
 * Returns full PageEntry objects with id and enabled status
 */
export function loadAllPageEntries(): PageEntry[] {
  ensureDataDir();

  if (!existsSync(PAGES_FILE)) {
    writeFileSync(PAGES_FILE, '[]', 'utf-8');
    return [];
  }

  try {
    const content = readFileSync(PAGES_FILE, 'utf-8');
    return JSON.parse(content) as PageEntry[];
  } catch {
    return [];
  }
}

/**
 * Load page entries formatted for scheduler (with name including client)
 */
export function loadPagesForScheduler() {
  const entries = loadAllPageEntries();
  return entries.map(entry => ({
    id: entry.id,
    name: `[${entry.client}] ${entry.name}`,
    url: entry.url,
    interval: entry.interval,
    timeout: entry.timeout,
    enabled: entry.enabled,
    soft404Patterns: entry.soft404Patterns,
  }));
}
