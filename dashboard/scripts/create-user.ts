/**
 * Script para criar usuários no Prymo Monitora
 *
 * Uso:
 *   npx tsx dashboard/scripts/create-user.ts \
 *     --email user@example.com \
 *     --password senhasegura123 \
 *     --name "João Silva" \
 *     --role CLIENT \
 *     --client "Nome do Cliente"
 *
 * Variáveis de ambiente necessárias:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

function parseArgs(): {
  email: string
  password: string
  name: string
  role: 'ADMIN' | 'CLIENT'
  client?: string
} {
  const args = process.argv.slice(2)
  const parsed: Record<string, string> = {}

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '')
    const value = args[i + 1]
    if (key && value) {
      parsed[key] = value
    }
  }

  if (!parsed.email || !parsed.password || !parsed.name) {
    console.error('Uso: npx tsx dashboard/scripts/create-user.ts --email <email> --password <password> --name <name> [--role ADMIN|CLIENT] [--client <client_name>]')
    process.exit(1)
  }

  const role = (parsed.role?.toUpperCase() || 'CLIENT') as 'ADMIN' | 'CLIENT'
  if (role !== 'ADMIN' && role !== 'CLIENT') {
    console.error('Role deve ser ADMIN ou CLIENT')
    process.exit(1)
  }

  if (role === 'CLIENT' && !parsed.client) {
    console.error('Para role CLIENT, --client é obrigatório')
    process.exit(1)
  }

  return {
    email: parsed.email,
    password: parsed.password,
    name: parsed.name,
    role,
    client: parsed.client,
  }
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórias')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const args = parseArgs()

  console.log(`\nCriando usuário: ${args.email} (${args.role})`)

  // 1. Hash password
  const passwordHash = await bcrypt.hash(args.password, SALT_ROUNDS)

  // 2. Check if user already exists
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', args.email)
    .single()

  if (existing) {
    console.error(`Usuário com email ${args.email} já existe (id: ${existing.id})`)
    process.exit(1)
  }

  // 3. Create user
  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({
      email: args.email,
      password_hash: passwordHash,
      name: args.name,
      role: args.role,
      is_active: true,
    })
    .select('id, email, name, role')
    .single()

  if (userError || !user) {
    console.error('Erro ao criar usuário:', userError?.message)
    process.exit(1)
  }

  console.log(`Usuário criado: ${user.id}`)

  // 4. Associate with client (for CLIENT users)
  if (args.role === 'CLIENT' && args.client) {
    // Find client by name
    const { data: client } = await supabase
      .from('clients')
      .select('id, name')
      .eq('name', args.client)
      .single()

    if (!client) {
      console.error(`Cliente "${args.client}" não encontrado. Crie o cliente primeiro no dashboard.`)
      // Cleanup: delete the created user
      await supabase.from('users').delete().eq('id', user.id)
      process.exit(1)
    }

    const { error: assocError } = await supabase
      .from('user_clients')
      .insert({
        user_id: user.id,
        client_id: client.id,
        role: 'owner',
      })

    if (assocError) {
      console.error('Erro ao associar usuário ao cliente:', assocError.message)
      process.exit(1)
    }

    console.log(`Associado ao cliente: ${client.name} (${client.id})`)
  }

  console.log('\nUsuário criado com sucesso!')
  console.log(`  Email: ${user.email}`)
  console.log(`  Nome: ${user.name}`)
  console.log(`  Role: ${user.role}`)
  if (args.client) {
    console.log(`  Cliente: ${args.client}`)
  }
}

main().catch((err) => {
  console.error('Erro fatal:', err)
  process.exit(1)
})
