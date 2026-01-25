import { supabase, isSupabaseConfigured } from './supabase'

// ===== TIPOS =====

export interface MonitoringSettings {
  checkFrequency: '1x' | '2x' | '4x' // por dia
  httpTimeout: 5000 | 8000 | 10000 // ms
  slowThreshold: number // ms
  soft404Detection: boolean
  errorsToOpenIncident: 1 | 2 | 3
  autoResolveIncidents: boolean
}

export interface AuditSettings {
  frequency: 'manual' | 'daily'
  scheduledTime: string // HH:mm
  analysisType: 'mobile' | 'desktop' | 'both'
  metrics: {
    performance: boolean
    accessibility: boolean
    bestPractices: boolean
    seo: boolean
  }
  pauseOnApiFailure: boolean
}

export interface ReportSettings {
  autoReportsEnabled: boolean
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = domingo
  scheduledTime: string // HH:mm
  scope: 'client' | 'global'
  content: {
    uptimeSummary: boolean
    weekIncidents: boolean
    pageSpeedAvg: boolean
    weekComparison: boolean
  }
  tone: 'executive' | 'technical' | 'marketing'
}

export interface AccountSettings {
  organizationName: string
  timezone: string
  environment: 'production' | 'staging'
  authRequired: boolean
}

export interface Settings {
  monitoring: MonitoringSettings
  audit: AuditSettings
  reports: ReportSettings
  account: AccountSettings
  updatedAt: string
}

// ===== VALORES DEFAULT =====

export const defaultSettings: Settings = {
  monitoring: {
    checkFrequency: '4x',
    httpTimeout: 8000,
    slowThreshold: 1500,
    soft404Detection: true,
    errorsToOpenIncident: 2,
    autoResolveIncidents: true,
  },
  audit: {
    frequency: 'daily',
    scheduledTime: '08:00',
    analysisType: 'mobile',
    metrics: {
      performance: true,
      accessibility: true,
      bestPractices: true,
      seo: true,
    },
    pauseOnApiFailure: true,
  },
  reports: {
    autoReportsEnabled: true,
    dayOfWeek: 1, // Segunda-feira
    scheduledTime: '08:30',
    scope: 'client',
    content: {
      uptimeSummary: true,
      weekIncidents: true,
      pageSpeedAvg: true,
      weekComparison: true,
    },
    tone: 'executive',
  },
  account: {
    organizationName: 'Prymo',
    timezone: 'America/Sao_Paulo',
    environment: 'production',
    authRequired: true,
  },
  updatedAt: new Date().toISOString(),
}

// ===== SUPABASE STORAGE =====

// Settings are stored as key-value pairs in the settings table
// Keys: 'monitoring', 'audit', 'reports', 'account'

async function getSettingValue<T>(key: string): Promise<T | null> {
  if (!isSupabaseConfigured()) {
    console.warn('[Settings] Supabase not configured, using defaults')
    return null
  }

  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .single()

  if (error || !data) {
    return null
  }

  try {
    return JSON.parse(data.value) as T
  } catch {
    return null
  }
}

async function setSettingValue(key: string, value: unknown): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.warn('[Settings] Supabase not configured, cannot save')
    return
  }

  const jsonValue = JSON.stringify(value)

  const { error } = await supabase
    .from('settings')
    .upsert(
      { key, value: jsonValue, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )

  if (error) {
    console.error(`[Settings] Error saving ${key}:`, error)
  }
}

// ===== API PUBLICA =====

export async function getSettings(): Promise<Settings> {
  if (!isSupabaseConfigured()) {
    return defaultSettings
  }

  try {
    const [monitoring, audit, reports, account] = await Promise.all([
      getSettingValue<MonitoringSettings>('monitoring'),
      getSettingValue<AuditSettings>('audit'),
      getSettingValue<ReportSettings>('reports'),
      getSettingValue<AccountSettings>('account'),
    ])

    // Merge with defaults to ensure all fields exist
    return {
      monitoring: monitoring
        ? { ...defaultSettings.monitoring, ...monitoring }
        : defaultSettings.monitoring,
      audit: audit
        ? {
            ...defaultSettings.audit,
            ...audit,
            metrics: { ...defaultSettings.audit.metrics, ...audit.metrics },
          }
        : defaultSettings.audit,
      reports: reports
        ? {
            ...defaultSettings.reports,
            ...reports,
            content: { ...defaultSettings.reports.content, ...reports.content },
          }
        : defaultSettings.reports,
      account: account
        ? { ...defaultSettings.account, ...account }
        : defaultSettings.account,
      updatedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error('[Settings] Error loading settings:', error)
    return defaultSettings
  }
}

export async function updateSettings(partial: Partial<Settings>): Promise<Settings> {
  const current = await getSettings()

  const updated: Settings = {
    monitoring: partial.monitoring
      ? { ...current.monitoring, ...partial.monitoring }
      : current.monitoring,
    audit: partial.audit
      ? {
          ...current.audit,
          ...partial.audit,
          metrics: partial.audit.metrics
            ? { ...current.audit.metrics, ...partial.audit.metrics }
            : current.audit.metrics,
        }
      : current.audit,
    reports: partial.reports
      ? {
          ...current.reports,
          ...partial.reports,
          content: partial.reports.content
            ? { ...current.reports.content, ...partial.reports.content }
            : current.reports.content,
        }
      : current.reports,
    account: partial.account
      ? { ...current.account, ...partial.account }
      : current.account,
    updatedAt: new Date().toISOString(),
  }

  // Save each section to Supabase
  await Promise.all([
    partial.monitoring && setSettingValue('monitoring', updated.monitoring),
    partial.audit && setSettingValue('audit', updated.audit),
    partial.reports && setSettingValue('reports', updated.reports),
    partial.account && setSettingValue('account', updated.account),
  ])

  return updated
}

export async function resetSettings(): Promise<Settings> {
  const reset = { ...defaultSettings, updatedAt: new Date().toISOString() }

  await Promise.all([
    setSettingValue('monitoring', reset.monitoring),
    setSettingValue('audit', reset.audit),
    setSettingValue('reports', reset.reports),
    setSettingValue('account', reset.account),
  ])

  return reset
}

// ===== HELPERS =====

export function getCheckIntervalMs(frequency: MonitoringSettings['checkFrequency']): number {
  const hoursMap = {
    '1x': 24,
    '2x': 12,
    '4x': 6,
  }
  return hoursMap[frequency] * 60 * 60 * 1000
}

export function getDayOfWeekLabel(day: number): string {
  const days = [
    'Domingo',
    'Segunda-feira',
    'Terca-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sabado',
  ]
  return days[day] || 'Desconhecido'
}

export const timezones = [
  'America/Sao_Paulo',
  'America/Fortaleza',
  'America/Manaus',
  'America/Cuiaba',
  'America/Rio_Branco',
  'America/Noronha',
  'UTC',
]
