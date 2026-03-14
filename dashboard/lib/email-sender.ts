/**
 * Email sender using Resend API via raw fetch.
 * No external packages required.
 */

const RESEND_API_URL = 'https://api.resend.com/emails'
const DEFAULT_FROM = 'Prymo Monitora <reports@prymo.com.br>'

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

export async function sendEmail(options: {
  to: string
  subject: string
  html: string
  from?: string
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY not configured')
    return false
  }

  const from = options.from || process.env.RESEND_FROM_EMAIL || DEFAULT_FROM

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [options.to],
        subject: options.subject,
        html: options.html,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`[Email] Resend API error (${response.status}):`, errorBody)
      return false
    }

    const result = await response.json()
    console.log(`[Email] Sent successfully to ${options.to}, id: ${result.id}`)
    return true
  } catch (error) {
    console.error('[Email] Failed to send:', error instanceof Error ? error.message : error)
    return false
  }
}
