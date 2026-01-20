import type { CheckResult, PageConfig } from './types.js';

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
    const success = response.ok;

    return {
      url: page.url,
      name: page.name,
      status: response.status,
      responseTime,
      success,
      timestamp: new Date(),
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage =
      error instanceof Error
        ? error.name === 'AbortError'
          ? 'Request timeout'
          : error.message
        : 'Unknown error';

    return {
      url: page.url,
      name: page.name,
      status: null,
      responseTime,
      success: false,
      error: errorMessage,
      timestamp: new Date(),
    };
  }
}
