import { writeFileSync, readFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { CheckResult, HistoryEntry, StatusLabel, ErrorType } from './types.js';

export interface StatusEntry {
  name: string;
  url: string;
  status: number | null;
  responseTime: number;
  success: boolean;
  error?: string;
  timestamp: string;
  statusLabel: StatusLabel;
  errorType?: ErrorType;
  httpStatus: number | null;
  lastCheckedAt: string;
}

const STATUS_FILE = join(process.cwd(), 'data', 'status.json');
const HISTORY_FILE = join(process.cwd(), 'data', 'history.json');
const HISTORY_RETENTION_DAYS = 7;

function ensureDataDir(): void {
  const dir = dirname(STATUS_FILE);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function resultToEntry(result: CheckResult): StatusEntry {
  return {
    name: result.name,
    url: result.url,
    status: result.status,
    responseTime: result.responseTime,
    success: result.success,
    error: result.error,
    timestamp: result.timestamp.toISOString(),
    statusLabel: result.statusLabel,
    errorType: result.errorType,
    httpStatus: result.httpStatus,
    lastCheckedAt: result.timestamp.toISOString(),
  };
}

export function writeStatus(results: Map<string, CheckResult>): void {
  ensureDataDir();

  const entries: StatusEntry[] = Array.from(results.values()).map(resultToEntry);
  const json = JSON.stringify(entries, null, 2);

  const tmpFile = STATUS_FILE + '.tmp';
  writeFileSync(tmpFile, json, 'utf-8');
  renameSync(tmpFile, STATUS_FILE);
}

function readHistory(): HistoryEntry[] {
  if (!existsSync(HISTORY_FILE)) {
    return [];
  }
  try {
    const content = readFileSync(HISTORY_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

function writeHistory(entries: HistoryEntry[]): void {
  ensureDataDir();
  const json = JSON.stringify(entries, null, 2);
  const tmpFile = HISTORY_FILE + '.tmp';
  writeFileSync(tmpFile, json, 'utf-8');
  renameSync(tmpFile, HISTORY_FILE);
}

export function appendHistory(result: CheckResult): void {
  const history = readHistory();

  const entry: HistoryEntry = {
    pageId: result.name,
    url: result.url,
    status: result.status,
    responseTime: result.responseTime,
    success: result.success,
    timestamp: result.timestamp.toISOString(),
    statusLabel: result.statusLabel,
    errorType: result.errorType,
    httpStatus: result.httpStatus,
  };

  history.push(entry);
  writeHistory(history);
}

export function cleanupOldHistory(): void {
  const history = readHistory();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - HISTORY_RETENTION_DAYS);

  const filtered = history.filter(entry => {
    const entryDate = new Date(entry.timestamp);
    return entryDate >= cutoffDate;
  });

  if (filtered.length !== history.length) {
    writeHistory(filtered);
  }
}
