import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'

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

// ===== PERSISTENCIA =====

const SETTINGS_FILE = join(process.cwd(), '..', 'data', 'settings.json')

function ensureDataDir(): void {
  const dir = dirname(SETTINGS_FILE)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function readSettings(): Settings {
  ensureDataDir()

  if (!existsSync(SETTINGS_FILE)) {
    writeSettings(defaultSettings)
    return defaultSettings
  }

  try {
    const content = readFileSync(SETTINGS_FILE, 'utf-8')
    const parsed = JSON.parse(content) as Partial<Settings>

    // Merge com defaults para garantir todos os campos
    return {
      monitoring: { ...defaultSettings.monitoring, ...parsed.monitoring },
      audit: {
        ...defaultSettings.audit,
        ...parsed.audit,
        metrics: { ...defaultSettings.audit.metrics, ...parsed.audit?.metrics },
      },
      reports: {
        ...defaultSettings.reports,
        ...parsed.reports,
        content: { ...defaultSettings.reports.content, ...parsed.reports?.content },
      },
      account: { ...defaultSettings.account, ...parsed.account },
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    }
  } catch {
    return defaultSettings
  }
}

function writeSettings(settings: Settings): void {
  ensureDataDir()

  const json = JSON.stringify(settings, null, 2)
  const tmpFile = SETTINGS_FILE + '.tmp'

  writeFileSync(tmpFile, json, 'utf-8')
  renameSync(tmpFile, SETTINGS_FILE)
}

// ===== API PUBLICA =====

export function getSettings(): Settings {
  return readSettings()
}

export function updateSettings(partial: Partial<Settings>): Settings {
  const current = readSettings()

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

  writeSettings(updated)
  return updated
}

export function resetSettings(): Settings {
  const reset = { ...defaultSettings, updatedAt: new Date().toISOString() }
  writeSettings(reset)
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
