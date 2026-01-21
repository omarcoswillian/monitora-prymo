import type { AuditScores, AuditResult } from '../types.js';

const PAGESPEED_API_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

export interface PageSpeedOptions {
  apiKey?: string;
  strategy?: 'mobile' | 'desktop';
  categories?: Array<'performance' | 'accessibility' | 'best-practices' | 'seo'>;
}

export async function runPageSpeedAudit(
  url: string,
  options: PageSpeedOptions = {}
): Promise<AuditResult> {
  const {
    apiKey = process.env.PAGESPEED_API_KEY,
    strategy = 'mobile',
    categories = ['performance', 'accessibility', 'best-practices', 'seo'],
  } = options;

  const params = new URLSearchParams({
    url,
    strategy,
  });

  if (apiKey) {
    params.append('key', apiKey);
  }

  for (const category of categories) {
    params.append('category', category);
  }

  const requestUrl = `${PAGESPEED_API_URL}?${params.toString()}`;

  try {
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PageSpeed API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as Record<string, unknown>;

    const scores: AuditScores = {
      performance: extractScore(data, 'performance'),
      accessibility: extractScore(data, 'accessibility'),
      bestPractices: extractScore(data, 'best-practices'),
      seo: extractScore(data, 'seo'),
    };

    return {
      url,
      timestamp: new Date().toISOString(),
      scores,
      strategy,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      url,
      timestamp: new Date().toISOString(),
      scores: null,
      strategy,
      success: false,
      error: errorMessage,
    };
  }
}

function extractScore(data: Record<string, unknown>, category: string): number | null {
  try {
    const lighthouse = data.lighthouseResult as Record<string, unknown> | undefined;
    if (!lighthouse) return null;

    const categories = lighthouse.categories as Record<string, unknown> | undefined;
    if (!categories) return null;

    const cat = categories[category] as { score?: number } | undefined;
    if (!cat || typeof cat.score !== 'number') return null;

    return Math.round(cat.score * 100);
  } catch {
    return null;
  }
}

export function isApiKeyConfigured(): boolean {
  return !!process.env.PAGESPEED_API_KEY;
}
