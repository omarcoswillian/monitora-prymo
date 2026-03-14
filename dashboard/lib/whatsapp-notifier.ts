/**
 * WhatsApp notification via Evolution API
 *
 * Environment variables needed:
 *   EVOLUTION_API_URL      - Ex: https://evolution.suaempresa.com.br
 *   EVOLUTION_API_KEY      - API key da instância
 *   EVOLUTION_INSTANCE     - Nome da instância (ex: prymo-monitora)
 *   ADMIN_WHATSAPP_NUMBER  - Número do admin (ex: 5511999999999)
 */

const API_URL = process.env.EVOLUTION_API_URL
const API_KEY = process.env.EVOLUTION_API_KEY
const INSTANCE = process.env.EVOLUTION_INSTANCE
const ADMIN_NUMBER = process.env.ADMIN_WHATSAPP_NUMBER

export function isWhatsAppConfigured(): boolean {
  return !!(API_URL && API_KEY && INSTANCE && ADMIN_NUMBER)
}

interface SendMessageOptions {
  to?: string   // Override recipient (default: ADMIN_NUMBER)
  message: string
}

export async function sendWhatsAppMessage(options: SendMessageOptions): Promise<boolean> {
  if (!isWhatsAppConfigured()) {
    console.log('[WhatsApp] Not configured, skipping notification')
    return false
  }

  const to = options.to || ADMIN_NUMBER!
  const MAX_LENGTH = 3000

  try {
    // Split long messages into chunks
    const chunks: string[] = []
    if (options.message.length <= MAX_LENGTH) {
      chunks.push(options.message)
    } else {
      const lines = options.message.split('\n')
      let current = ''
      for (const line of lines) {
        if ((current + '\n' + line).length > MAX_LENGTH && current) {
          chunks.push(current.trim())
          current = line
        } else {
          current += (current ? '\n' : '') + line
        }
      }
      if (current.trim()) chunks.push(current.trim())
    }

    for (const chunk of chunks) {
      const res = await fetch(`${API_URL}/message/sendText/${INSTANCE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': API_KEY!,
        },
        body: JSON.stringify({
          number: to,
          textMessage: { text: chunk },
        }),
      })

      if (!res.ok) {
        const error = await res.text()
        console.error(`[WhatsApp] Error sending message: ${res.status} ${error}`)
        return false
      }

      // Small delay between chunks
      if (chunks.length > 1) {
        await new Promise(r => setTimeout(r, 1000))
      }
    }

    console.log(`[WhatsApp] Message sent to ${to}${chunks.length > 1 ? ` (${chunks.length} parts)` : ''}`)
    return true
  } catch (error) {
    console.error('[WhatsApp] Failed to send message:', error)
    return false
  }
}

// ===== Pre-built alert messages =====

export function alertPageDown(pageName: string, clientName: string, url: string, errorType: string, error?: string): string {
  return `🔴 *PAGINA OFFLINE*

*Cliente:* ${clientName}
*Pagina:* ${pageName}
*URL:* ${url}
*Erro:* ${errorType}${error ? `\n*Detalhe:* ${error}` : ''}
*Hora:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}

_Prymo Monitora_`
}

export function alertPageRecovered(pageName: string, clientName: string, url: string, downtime?: string): string {
  return `🟢 *PAGINA RECUPERADA*

*Cliente:* ${clientName}
*Pagina:* ${pageName}
*URL:* ${url}${downtime ? `\n*Tempo fora:* ${downtime}` : ''}
*Hora:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}

_Prymo Monitora_`
}

export function alertSSLExpiring(pageName: string, clientName: string, url: string, daysRemaining: number, expiresAt: string): string {
  return `⚠️ *SSL EXPIRANDO*

*Cliente:* ${clientName}
*Pagina:* ${pageName}
*URL:* ${url}
*Expira em:* ${daysRemaining} dias (${new Date(expiresAt).toLocaleDateString('pt-BR')})

_Prymo Monitora_`
}

export function alertContentMismatch(pageName: string, clientName: string, url: string, missingTexts: string[]): string {
  return `⚠️ *CONTEUDO AUSENTE*

*Cliente:* ${clientName}
*Pagina:* ${pageName}
*URL:* ${url}
*Textos ausentes:*
${missingTexts.map(t => `  - ${t}`).join('\n')}
*Hora:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}

_Prymo Monitora_`
}

export function alertPageSlow(pageName: string, clientName: string, url: string, responseTime: number): string {
  return `🟡 *PAGINA LENTA*

*Cliente:* ${clientName}
*Pagina:* ${pageName}
*URL:* ${url}
*Tempo:* ${responseTime}ms
*Hora:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}

_Prymo Monitora_`
}
