import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export const dynamic = 'force-dynamic'

export async function GET() {
  const statusFile = join(process.cwd(), '..', 'data', 'status.json')

  if (!existsSync(statusFile)) {
    return NextResponse.json([])
  }

  try {
    const content = readFileSync(statusFile, 'utf-8')
    const data = JSON.parse(content)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json([])
  }
}
