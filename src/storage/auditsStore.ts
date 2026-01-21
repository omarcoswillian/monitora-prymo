import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { PageAuditEntry, AuditResult, AuditScores } from '../types.js';

const AUDITS_DIR = join(process.cwd(), 'data', 'audits');

function ensureAuditsDir(): void {
  if (!existsSync(AUDITS_DIR)) {
    mkdirSync(AUDITS_DIR, { recursive: true });
  }
}

function getPageAuditFile(pageId: string): string {
  const safeId = pageId.replace(/[^a-zA-Z0-9-_]/g, '_');
  return join(AUDITS_DIR, `${safeId}.json`);
}

function readPageAudits(pageId: string): PageAuditEntry[] {
  ensureAuditsDir();
  const file = getPageAuditFile(pageId);

  if (!existsSync(file)) {
    return [];
  }

  try {
    const content = readFileSync(file, 'utf-8');
    return JSON.parse(content) as PageAuditEntry[];
  } catch {
    return [];
  }
}

function writePageAudits(pageId: string, entries: PageAuditEntry[]): void {
  ensureAuditsDir();
  const file = getPageAuditFile(pageId);
  const json = JSON.stringify(entries, null, 2);
  const tmpFile = file + '.tmp';
  writeFileSync(tmpFile, json, 'utf-8');
  renameSync(tmpFile, file);
}

export function saveAudit(pageId: string, url: string, audit: AuditResult): PageAuditEntry {
  const entries = readPageAudits(pageId);
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Check if we already have an entry for today
  const existingIndex = entries.findIndex(e => e.date === date);

  const entry: PageAuditEntry = {
    pageId,
    url,
    date,
    audit,
  };

  if (existingIndex !== -1) {
    // Update existing entry for today
    entries[existingIndex] = entry;
  } else {
    entries.push(entry);
  }

  // Keep only last 30 days
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const filtered = entries.filter(e => e.date >= cutoffStr);
  writePageAudits(pageId, filtered);

  return entry;
}

export function getLatestAudit(pageId: string): PageAuditEntry | null {
  const entries = readPageAudits(pageId);
  if (entries.length === 0) return null;

  // Sort by date desc and return most recent
  entries.sort((a, b) => b.date.localeCompare(a.date));
  return entries[0];
}

export function getAuditHistory(pageId: string, days: number = 7): PageAuditEntry[] {
  const entries = readPageAudits(pageId);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  return entries
    .filter(e => e.date >= cutoffStr)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getAllLatestAudits(): Map<string, PageAuditEntry> {
  ensureAuditsDir();
  const result = new Map<string, PageAuditEntry>();

  try {
    const files = readdirSync(AUDITS_DIR).filter(f => f.endsWith('.json'));

    for (const file of files) {
      try {
        const content = readFileSync(join(AUDITS_DIR, file), 'utf-8');
        const entries: PageAuditEntry[] = JSON.parse(content);

        if (entries.length > 0) {
          entries.sort((a, b) => b.date.localeCompare(a.date));
          result.set(entries[0].pageId, entries[0]);
        }
      } catch {
        // Skip invalid files
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return result;
}

export interface AuditAverages {
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
  trend: {
    performance: 'up' | 'down' | 'stable' | null;
    accessibility: 'up' | 'down' | 'stable' | null;
    bestPractices: 'up' | 'down' | 'stable' | null;
    seo: 'up' | 'down' | 'stable' | null;
  };
}

export function calculateAverages(pageIds: string[], days: number = 7): AuditAverages {
  const scores = {
    performance: [] as number[],
    accessibility: [] as number[],
    bestPractices: [] as number[],
    seo: [] as number[],
  };

  const prevScores = {
    performance: [] as number[],
    accessibility: [] as number[],
    bestPractices: [] as number[],
    seo: [] as number[],
  };

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const prevCutoffDate = new Date();
  prevCutoffDate.setDate(prevCutoffDate.getDate() - days * 2);
  const prevCutoffStr = prevCutoffDate.toISOString().split('T')[0];

  for (const pageId of pageIds) {
    const history = readPageAudits(pageId);

    for (const entry of history) {
      if (!entry.audit.success || !entry.audit.scores) continue;

      const s = entry.audit.scores;

      // Current period
      if (entry.date >= cutoffStr) {
        if (s.performance !== null) scores.performance.push(s.performance);
        if (s.accessibility !== null) scores.accessibility.push(s.accessibility);
        if (s.bestPractices !== null) scores.bestPractices.push(s.bestPractices);
        if (s.seo !== null) scores.seo.push(s.seo);
      }
      // Previous period for trend
      else if (entry.date >= prevCutoffStr) {
        if (s.performance !== null) prevScores.performance.push(s.performance);
        if (s.accessibility !== null) prevScores.accessibility.push(s.accessibility);
        if (s.bestPractices !== null) prevScores.bestPractices.push(s.bestPractices);
        if (s.seo !== null) prevScores.seo.push(s.seo);
      }
    }
  }

  const avg = (arr: number[]): number | null =>
    arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

  const currentAvg = {
    performance: avg(scores.performance),
    accessibility: avg(scores.accessibility),
    bestPractices: avg(scores.bestPractices),
    seo: avg(scores.seo),
  };

  const prevAvg = {
    performance: avg(prevScores.performance),
    accessibility: avg(prevScores.accessibility),
    bestPractices: avg(prevScores.bestPractices),
    seo: avg(prevScores.seo),
  };

  const getTrend = (
    current: number | null,
    prev: number | null
  ): 'up' | 'down' | 'stable' | null => {
    if (current === null || prev === null) return null;
    const diff = current - prev;
    if (diff > 2) return 'up';
    if (diff < -2) return 'down';
    return 'stable';
  };

  return {
    ...currentAvg,
    trend: {
      performance: getTrend(currentAvg.performance, prevAvg.performance),
      accessibility: getTrend(currentAvg.accessibility, prevAvg.accessibility),
      bestPractices: getTrend(currentAvg.bestPractices, prevAvg.bestPractices),
      seo: getTrend(currentAvg.seo, prevAvg.seo),
    },
  };
}

export function needsAuditToday(pageId: string): boolean {
  const latest = getLatestAudit(pageId);
  if (!latest) return true;

  const today = new Date().toISOString().split('T')[0];
  return latest.date !== today;
}
