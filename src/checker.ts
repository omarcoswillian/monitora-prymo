import type { CheckResult, PageConfig, StatusLabel, ErrorType } from './types.js';
import { DEFAULT_SOFT_404_PATTERNS } from './types.js';

const SLOW_THRESHOLD_MS = 1500;
const MAX_BODY_SIZE = 50000; // 50KB limit for soft 404 detection

function detectSoft404(html: string, customPatterns?: string[]): boolean {
  const lowerHtml = html.toLowerCase();
  const patterns = [...DEFAULT_SOFT_404_PATTERNS, ...(customPatterns || [])];

  return patterns.some(pattern => lowerHtml.includes(pattern.toLowerCase()));
}

function determineErrorType(
  status: number | null,
  error?: string,
  isSoft404?: boolean
): ErrorType | undefined {
  if (isSoft404) return 'SOFT_404';
  if (status === null) {
    if (error?.includes('timeout') || error?.includes('Timeout')) return 'TIMEOUT';
    if (error?.includes('ECONNREFUSED') || error?.includes('ENOTFOUND') || error?.includes('fetch failed')) {
      return 'CONNECTION_ERROR';
    }
    return 'UNKNOWN';
  }
  if (status === 404) return 'HTTP_404';
  if (status >= 500 && status < 600) return 'HTTP_500';
  return undefined;
}

function determineStatusLabel(
  success: boolean,
  status: number | null,
  responseTime: number,
  isSoft404: boolean
): StatusLabel {
  if (isSoft404) return 'Soft 404';
  if (!success || status === null || status >= 400) return 'Offline';
  if (responseTime > SLOW_THRESHOLD_MS) return 'Lento';
  return 'Online';
}

export async function checkPage(page: Required<PageConfig>): Promise<CheckResult> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), page.timeout);

    const response = await fetch(page.url, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseTime = Date.now() - startTime;
    const httpStatus = response.status;
    let isSoft404 = false;

    // Check for soft 404 only if status is 200
    if (response.ok && httpStatus === 200) {
      try {
        const text = await response.text();
        const bodySnippet = text.slice(0, MAX_BODY_SIZE);
        isSoft404 = detectSoft404(bodySnippet, page.soft404Patterns);
      } catch {
        // If we can't read the body, assume it's fine
      }
    }

    const success = response.ok && !isSoft404;
    const statusLabel = determineStatusLabel(success, httpStatus, responseTime, isSoft404);
    const errorType = determineErrorType(httpStatus, undefined, isSoft404);

    return {
      url: page.url,
      name: page.name,
      status: httpStatus,
      responseTime,
      success,
      timestamp: new Date(),
      statusLabel,
      errorType,
      httpStatus,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage =
      error instanceof Error
        ? error.name === 'AbortError'
          ? 'Request timeout'
          : error.message
        : 'Unknown error';

    const errorType = determineErrorType(null, errorMessage, false);
    const statusLabel = determineStatusLabel(false, null, responseTime, false);

    return {
      url: page.url,
      name: page.name,
      status: null,
      responseTime,
      success: false,
      error: errorMessage,
      timestamp: new Date(),
      statusLabel,
      errorType,
      httpStatus: null,
    };
  }
}
