import { supabase } from './lib/supabase.js';
import type { CheckResult, StatusLabel } from './types.js';

/**
 * Tracks page incidents: creates an incident when a check fails,
 * resolves it when the page recovers.
 */

// In-memory cache of open incidents per page_id
const openIncidents = new Map<string, string>(); // page_id -> incident_id
let initialized = false;

/**
 * Load currently open (unresolved) incidents from Supabase
 */
async function loadOpenIncidents(): Promise<void> {
  const { data, error } = await supabase
    .from('incidents')
    .select('id, page_id')
    .is('resolved_at', null);

  if (error) {
    console.error('[Incident Tracker] Error loading open incidents:', error.message);
    return;
  }

  for (const row of data || []) {
    openIncidents.set(row.page_id, row.id);
  }

  console.log(`[Incident Tracker] Loaded ${openIncidents.size} open incident(s)`);
  initialized = true;
}

/**
 * Determine incident type/message from a failed check result.
 * type = ErrorType (TIMEOUT, HTTP_404, etc.) for the frontend.
 */
function getIncidentInfo(result: CheckResult): { type: string; message: string } {
  const errorType = result.errorType || 'UNKNOWN';

  if (result.statusLabel === 'Lento') {
    return {
      type: 'SLOW',
      message: `Slow response (${result.responseTime}ms) on ${result.url}`,
    };
  }

  if (result.statusLabel === 'Soft 404') {
    return {
      type: 'SOFT_404',
      message: `Soft 404 detected on ${result.url}`,
    };
  }

  // Offline cases
  const message = result.error
    ? `${result.error} on ${result.url}`
    : `HTTP ${result.status || 'unknown'} on ${result.url}`;

  return { type: errorType, message };
}

/**
 * Process a check result and create/resolve incidents as needed
 */
export async function trackIncident(pageId: string, result: CheckResult): Promise<void> {
  if (!initialized) {
    await loadOpenIncidents();
  }

  const hasOpenIncident = openIncidents.has(pageId);
  const isFailure = result.statusLabel !== 'Online';

  if (isFailure && !hasOpenIncident) {
    // Page just failed → create incident
    const { type, message } = getIncidentInfo(result);

    const { data, error } = await supabase
      .from('incidents')
      .insert({
        page_id: pageId,
        type,
        message,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`[Incident Tracker] Error creating incident for ${result.name}:`, error.message);
      return;
    }

    if (data) {
      openIncidents.set(pageId, data.id);
      console.log(`[Incident Tracker] Created incident for ${result.name}: ${type} - ${message}`);
    }
  } else if (!isFailure && hasOpenIncident) {
    // Page recovered → resolve incident
    const incidentId = openIncidents.get(pageId)!;

    const { error } = await supabase
      .from('incidents')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', incidentId);

    if (error) {
      console.error(`[Incident Tracker] Error resolving incident for ${result.name}:`, error.message);
      return;
    }

    openIncidents.delete(pageId);
    console.log(`[Incident Tracker] Resolved incident for ${result.name}`);
  }
}
