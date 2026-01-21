export type ErrorType = 'HTTP_404' | 'HTTP_500' | 'TIMEOUT' | 'SOFT_404' | 'CONNECTION_ERROR' | 'UNKNOWN';

export type StatusLabel = 'Online' | 'Offline' | 'Lento' | 'Soft 404';

export const DEFAULT_SOFT_404_PATTERNS = [
  '404',
  'not found',
  'página não encontrada',
  'page not found',
  'não encontrado',
  'oops',
  'página não existe',
  'page does not exist',
];

export interface PageConfig {
  name: string;
  url: string;
  interval?: number;
  timeout?: number;
  soft404Patterns?: string[];
}

export interface CheckResult {
  url: string;
  name: string;
  status: number | null;
  responseTime: number;
  success: boolean;
  error?: string;
  timestamp: Date;
  statusLabel: StatusLabel;
  errorType?: ErrorType;
  httpStatus: number | null;
}

export interface MonitorConfig {
  pages: PageConfig[];
  defaults?: {
    interval?: number;
    timeout?: number;
  };
}

export interface HistoryEntry {
  pageId: string;
  url: string;
  status: number | null;
  responseTime: number;
  success: boolean;
  timestamp: string; // ISO 8601
  statusLabel?: StatusLabel;
  errorType?: ErrorType;
  httpStatus?: number | null;
}

// Audit types for PageSpeed Insights
export interface AuditScores {
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
}

export interface AuditResult {
  url: string;
  timestamp: string;
  scores: AuditScores | null;
  strategy: 'mobile' | 'desktop';
  success: boolean;
  error?: string;
}

export interface PageAuditEntry {
  pageId: string;
  url: string;
  date: string; // YYYY-MM-DD
  audit: AuditResult;
}

// Client types
export interface Client {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
