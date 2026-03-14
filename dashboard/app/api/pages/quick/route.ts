import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabase } from '@/lib/supabase'
import { getUserContext } from '@/lib/auth'
import { slugify } from '@/lib/slugify'
import { checkAndRecord } from '@/lib/page-checker'
import { enqueueAudit, triggerWorker } from '@/lib/audit-queue'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const SALT_ROUNDS = 12

interface QuickPageRequest {
  clientName: string
  specialistName: string
  pageName: string
  url: string
  pageType?: string
}

export async function POST(request: Request) {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!ctx.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = (await request.json()) as QuickPageRequest
    const { clientName, specialistName, pageName, url, pageType } = body

    if (!clientName?.trim() || !specialistName?.trim() || !pageName?.trim() || !url?.trim()) {
      return NextResponse.json(
        { error: 'Todos os campos sao obrigatorios: clientName, specialistName, pageName, url' },
        { status: 400 }
      )
    }

    try { new URL(url.trim()) } catch {
      return NextResponse.json({ error: 'URL invalida' }, { status: 400 })
    }

    let clientCreated = false
    let loginCredentials: { login: string; password: string } | null = null

    // 1. Get or create client
    let { data: client } = await supabase
      .from('clients')
      .select('id, name')
      .ilike('name', clientName.trim())
      .single()

    if (!client) {
      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({ name: clientName.trim() })
        .select('id, name')
        .single()

      if (error || !newClient) {
        return NextResponse.json({ error: `Erro ao criar cliente: ${error?.message}` }, { status: 500 })
      }
      client = newClient
      clientCreated = true

      // Auto-create login for new client
      const password = clientName.trim().toLowerCase().replace(/\s+/g, '') + '123'
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

      const { data: user, error: userError } = await supabase
        .from('users')
        .insert({
          email: slugify(clientName.trim()) + '@cliente.prymo',
          password_hash: passwordHash,
          name: clientName.trim(),
          role: 'CLIENT',
          is_active: true,
        })
        .select('id')
        .single()

      if (user && !userError) {
        await supabase.from('user_clients').insert({
          user_id: user.id,
          client_id: client.id,
          role: 'owner',
        })

        loginCredentials = {
          login: clientName.trim(),
          password,
        }
      }
    }

    // 2. Get or create specialist
    let { data: specialist } = await supabase
      .from('specialists')
      .select('id, name')
      .eq('client_id', client.id)
      .ilike('name', specialistName.trim())
      .single()

    if (!specialist) {
      const { data: newSpec, error } = await supabase
        .from('specialists')
        .insert({
          client_id: client.id,
          name: specialistName.trim(),
          slug: slugify(specialistName.trim()),
          status: 'active',
        })
        .select('id, name')
        .single()

      if (error || !newSpec) {
        return NextResponse.json({ error: `Erro ao criar especialista: ${error?.message}` }, { status: 500 })
      }
      specialist = newSpec
    }

    // 3. Get or create default product for specialist
    let { data: product } = await supabase
      .from('products')
      .select('id')
      .eq('specialist_id', specialist.id)
      .limit(1)
      .single()

    if (!product) {
      const { data: newProd, error } = await supabase
        .from('products')
        .insert({
          client_id: client.id,
          specialist_id: specialist.id,
          name: 'Geral',
          slug: 'geral',
          status: 'active',
        })
        .select('id')
        .single()

      if (error || !newProd) {
        return NextResponse.json({ error: `Erro ao criar produto: ${error?.message}` }, { status: 500 })
      }
      product = newProd
    }

    // 4. Create page
    const { data: page, error: pageError } = await supabase
      .from('pages')
      .insert({
        client_id: client.id,
        specialist_id: specialist.id,
        product_id: product.id,
        name: pageName.trim(),
        url: url.trim(),
        interval: 30000,
        timeout: 10000,
        enabled: true,
        page_type: pageType || 'site',
      })
      .select('id, name, url')
      .single()

    if (pageError || !page) {
      return NextResponse.json({ error: `Erro ao criar pagina: ${pageError?.message}` }, { status: 500 })
    }

    // 5. Run immediate check (non-blocking for response)
    try {
      await checkAndRecord({
        id: page.id,
        name: page.name,
        clientName: client.name,
        url: page.url,
        timeout: 10000,
      })
    } catch {}

    // 6. Enqueue audit
    try {
      await enqueueAudit(page.id, page.url)
      triggerWorker()
    } catch {}

    return NextResponse.json({
      success: true,
      page: { id: page.id, name: page.name, url: page.url },
      client: { id: client.id, name: client.name, isNew: clientCreated },
      specialist: { id: specialist.id, name: specialist.name },
      credentials: loginCredentials,
    }, { status: 201 })
  } catch (error) {
    console.error('Error in quick page creation:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
