import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { randomUUID } from 'node:crypto'

export interface PageEntry {
  id: string
  client: string
  name: string
  url: string
  interval: number
  timeout: number
  enabled: boolean
  createdAt: string
  updatedAt: string
  soft404Patterns?: string[]
}

export type PageInput = Omit<PageEntry, 'id' | 'createdAt' | 'updatedAt'>

const PAGES_FILE = join(process.cwd(), '..', 'data', 'pages.json')

function ensureDataDir(): void {
  const dir = dirname(PAGES_FILE)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function readPages(): PageEntry[] {
  ensureDataDir()

  if (!existsSync(PAGES_FILE)) {
    writePages([])
    return []
  }

  try {
    const content = readFileSync(PAGES_FILE, 'utf-8')
    return JSON.parse(content) as PageEntry[]
  } catch {
    return []
  }
}

function writePages(pages: PageEntry[]): void {
  ensureDataDir()

  const json = JSON.stringify(pages, null, 2)
  const tmpFile = PAGES_FILE + '.tmp'

  writeFileSync(tmpFile, json, 'utf-8')
  renameSync(tmpFile, PAGES_FILE)
}

export function getAllPages(): PageEntry[] {
  return readPages()
}

export function getPageById(id: string): PageEntry | undefined {
  const pages = readPages()
  return pages.find(p => p.id === id)
}

export function createPage(input: PageInput): PageEntry {
  const pages = readPages()
  const now = new Date().toISOString()

  const newPage: PageEntry = {
    id: randomUUID(),
    ...input,
    createdAt: now,
    updatedAt: now,
  }

  pages.push(newPage)
  writePages(pages)

  return newPage
}

export function updatePage(id: string, input: Partial<PageInput>): PageEntry | null {
  const pages = readPages()
  const index = pages.findIndex(p => p.id === id)

  if (index === -1) {
    return null
  }

  const updated: PageEntry = {
    ...pages[index],
    ...input,
    updatedAt: new Date().toISOString(),
  }

  pages[index] = updated
  writePages(pages)

  return updated
}

export function deletePage(id: string): boolean {
  const pages = readPages()
  const index = pages.findIndex(p => p.id === id)

  if (index === -1) {
    return false
  }

  pages.splice(index, 1)
  writePages(pages)

  return true
}

export function validatePageInput(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid data'] }
  }

  const d = data as Record<string, unknown>

  if (typeof d.client !== 'string' || d.client.trim() === '') {
    errors.push('Client is required')
  }

  if (typeof d.name !== 'string' || d.name.trim() === '') {
    errors.push('Name is required')
  }

  if (typeof d.url !== 'string' || d.url.trim() === '') {
    errors.push('URL is required')
  } else {
    try {
      new URL(d.url as string)
    } catch {
      errors.push('Invalid URL format')
    }
  }

  if (typeof d.interval !== 'number' || d.interval < 5000) {
    errors.push('Interval must be at least 5000ms (5s)')
  }

  if (typeof d.timeout !== 'number' || d.timeout < 1000) {
    errors.push('Timeout must be at least 1000ms')
  }

  if (typeof d.enabled !== 'boolean') {
    errors.push('Enabled must be a boolean')
  }

  return { valid: errors.length === 0, errors }
}
