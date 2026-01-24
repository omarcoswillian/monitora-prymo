import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { ClientReportData, GlobalReportData } from './report-data-aggregator'

// ===== TIPOS =====

export interface AIReport {
  id: string
  type: 'client' | 'global'
  clientName: string | null
  period: {
    start: string
    end: string
  }
  content: string
  data: ClientReportData | GlobalReportData
  status: 'pending' | 'generating' | 'completed' | 'error'
  error?: string
  createdAt: string
  completedAt?: string
}

export type AIReportInput = Omit<AIReport, 'id' | 'createdAt'>

// ===== PERSISTENCIA =====

const AI_REPORTS_FILE = join(process.cwd(), '..', 'data', 'ai-reports.json')

function ensureDataDir(): void {
  const dir = dirname(AI_REPORTS_FILE)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function readReports(): AIReport[] {
  ensureDataDir()

  if (!existsSync(AI_REPORTS_FILE)) {
    writeReports([])
    return []
  }

  try {
    const content = readFileSync(AI_REPORTS_FILE, 'utf-8')
    return JSON.parse(content) as AIReport[]
  } catch {
    return []
  }
}

function writeReports(reports: AIReport[]): void {
  ensureDataDir()

  const json = JSON.stringify(reports, null, 2)
  const tmpFile = AI_REPORTS_FILE + '.tmp'

  writeFileSync(tmpFile, json, 'utf-8')
  renameSync(tmpFile, AI_REPORTS_FILE)
}

// ===== API PUBLICA =====

export function getAllAIReports(): AIReport[] {
  return readReports().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export function getAIReportById(id: string): AIReport | undefined {
  const reports = readReports()
  return reports.find(r => r.id === id)
}

export function getAIReportsByClient(clientName: string): AIReport[] {
  const reports = readReports()
  return reports
    .filter(r => r.clientName === clientName)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function createAIReport(input: AIReportInput): AIReport {
  const reports = readReports()
  const now = new Date().toISOString()

  const newReport: AIReport = {
    id: randomUUID(),
    ...input,
    createdAt: now,
  }

  reports.push(newReport)
  writeReports(reports)

  return newReport
}

export function updateAIReport(id: string, updates: Partial<AIReport>): AIReport | null {
  const reports = readReports()
  const index = reports.findIndex(r => r.id === id)

  if (index === -1) {
    return null
  }

  const updated: AIReport = {
    ...reports[index],
    ...updates,
  }

  reports[index] = updated
  writeReports(reports)

  return updated
}

export function deleteAIReport(id: string): boolean {
  const reports = readReports()
  const index = reports.findIndex(r => r.id === id)

  if (index === -1) {
    return false
  }

  reports.splice(index, 1)
  writeReports(reports)

  return true
}

export function getRecentAIReports(limit: number = 10): AIReport[] {
  const reports = readReports()
  return reports
    .filter(r => r.status === 'completed')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
}

export function cleanOldReports(daysToKeep: number = 30): number {
  const reports = readReports()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysToKeep)

  const filtered = reports.filter(r => new Date(r.createdAt) >= cutoff)
  const removed = reports.length - filtered.length

  if (removed > 0) {
    writeReports(filtered)
  }

  return removed
}
