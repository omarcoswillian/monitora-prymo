export type ErrorType = 'HTTP_404' | 'HTTP_500' | 'TIMEOUT' | 'SOFT_404' | 'CONNECTION_ERROR' | 'UNKNOWN';

export type StatusLabel = 'Online' | 'Offline' | 'Lento' | 'Soft 404';

export const DEFAULT_SOFT_404_PATTERNS = [
  // English patterns
  'not found',
  'page not found',
  '404 error',
  '404 not found',
  'error 404',
  'page does not exist',
  'content not found',
  'resource not found',
  'the page you requested',
  'could not be found',
  'does not exist',
  'no longer available',
  'page is missing',
  'page has been removed',
  'page has been deleted',
  // Portuguese patterns
  'pagina nao encontrada',
  'página não encontrada',
  'nao encontrado',
  'não encontrado',
  'erro 404',
  'pagina nao existe',
  'página não existe',
  'pagina inexistente',
  'página inexistente',
  'conteudo nao encontrado',
  'conteúdo não encontrado',
  'recurso nao encontrado',
  'recurso não encontrado',
  'esta pagina nao existe',
  'esta página não existe',
  'pagina removida',
  'página removida',
  'pagina excluida',
  'página excluída',
  'nao foi possivel encontrar',
  'não foi possível encontrar',
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
