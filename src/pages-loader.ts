import { supabase } from './lib/supabase.js';
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

export async function loadPagesFromJson(): Promise<PageConfig[]> {
  const { data, error } = await supabase
    .from('pages')
    .select('*, clients(name)')
    .eq('enabled', true);

  if (error) {
    console.error('[Pages Loader] Error loading pages from Supabase:', error.message);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((page: any) => ({
    name: `[${page.clients?.name || 'Unknown'}] ${page.name}`,
    url: page.url,
    interval: page.interval,
    timeout: page.timeout,
    soft404Patterns: page.soft_404_patterns || undefined,
  }));
}

/**
 * Load all page entries (for scheduler use)
 * Returns full PageEntry objects with id and enabled status
 */
export async function loadAllPageEntries(): Promise<PageEntry[]> {
  const { data, error } = await supabase
    .from('pages')
    .select('*, clients(name)');

  if (error) {
    console.error('[Pages Loader] Error loading pages from Supabase:', error.message);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((page: any) => ({
    id: page.id,
    client: page.clients?.name || 'Unknown',
    name: page.name,
    url: page.url,
    interval: page.interval,
    timeout: page.timeout,
    enabled: page.enabled,
    createdAt: page.created_at,
    updatedAt: page.updated_at,
    soft404Patterns: page.soft_404_patterns || undefined,
  }));
}

/**
 * Load page entries formatted for scheduler (with name including client)
 */
export async function loadPagesForScheduler() {
  const entries = await loadAllPageEntries();
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
