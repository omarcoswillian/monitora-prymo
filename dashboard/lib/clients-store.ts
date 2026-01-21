import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { randomUUID } from 'node:crypto'

export interface Client {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export type ClientInput = Omit<Client, 'id' | 'createdAt' | 'updatedAt'>

const CLIENTS_FILE = join(process.cwd(), '..', 'data', 'clients.json')

function ensureDataDir(): void {
  const dir = dirname(CLIENTS_FILE)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function readClients(): Client[] {
  ensureDataDir()

  if (!existsSync(CLIENTS_FILE)) {
    writeClients([])
    return []
  }

  try {
    const content = readFileSync(CLIENTS_FILE, 'utf-8')
    return JSON.parse(content) as Client[]
  } catch {
    return []
  }
}

function writeClients(clients: Client[]): void {
  ensureDataDir()

  const json = JSON.stringify(clients, null, 2)
  const tmpFile = CLIENTS_FILE + '.tmp'

  writeFileSync(tmpFile, json, 'utf-8')
  renameSync(tmpFile, CLIENTS_FILE)
}

export function getAllClients(): Client[] {
  return readClients()
}

export function getClientById(id: string): Client | undefined {
  const clients = readClients()
  return clients.find(c => c.id === id)
}

export function getClientByName(name: string): Client | undefined {
  const clients = readClients()
  return clients.find(c => c.name.toLowerCase() === name.toLowerCase())
}

export function createClient(input: ClientInput): Client {
  const clients = readClients()
  const now = new Date().toISOString()

  // Check if client with same name exists
  const existing = clients.find(c => c.name.toLowerCase() === input.name.toLowerCase())
  if (existing) {
    return existing
  }

  const newClient: Client = {
    id: randomUUID(),
    ...input,
    createdAt: now,
    updatedAt: now,
  }

  clients.push(newClient)
  writeClients(clients)

  return newClient
}

export function updateClient(id: string, input: Partial<ClientInput>): Client | null {
  const clients = readClients()
  const index = clients.findIndex(c => c.id === id)

  if (index === -1) {
    return null
  }

  const updated: Client = {
    ...clients[index],
    ...input,
    updatedAt: new Date().toISOString(),
  }

  clients[index] = updated
  writeClients(clients)

  return updated
}

export function deleteClient(id: string): boolean {
  const clients = readClients()
  const index = clients.findIndex(c => c.id === id)

  if (index === -1) {
    return false
  }

  clients.splice(index, 1)
  writeClients(clients)

  return true
}

export function ensureClientExists(name: string): Client {
  const existing = getClientByName(name)
  if (existing) return existing

  return createClient({ name })
}

export function getOrCreateClientsFromPages(pages: Array<{ client: string }>): Client[] {
  const uniqueNames = Array.from(new Set(pages.map(p => p.client).filter(Boolean)))

  for (let i = 0; i < uniqueNames.length; i++) {
    ensureClientExists(uniqueNames[i])
  }

  return getAllClients()
}
