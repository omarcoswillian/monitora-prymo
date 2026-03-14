import * as tls from 'tls'
import * as net from 'net'

export interface SSLCheckResult {
  valid: boolean
  expiresAt: string | null
  daysRemaining: number | null
  status: 'valid' | 'expiring_soon' | 'expired' | 'error' | 'no_ssl'
  issuer?: string
  error?: string
}

const SSL_WARNING_DAYS = 30

/**
 * Check SSL certificate for a given URL.
 * Connects via TLS and extracts certificate expiration info.
 */
export async function checkSSL(pageUrl: string): Promise<SSLCheckResult> {
  try {
    const url = new URL(pageUrl)

    // Only check HTTPS URLs
    if (url.protocol !== 'https:') {
      return { valid: false, expiresAt: null, daysRemaining: null, status: 'no_ssl' }
    }

    const host = url.hostname
    const port = url.port ? parseInt(url.port) : 443

    const cert = await getCertificate(host, port)

    if (!cert || !cert.valid_to) {
      return { valid: false, expiresAt: null, daysRemaining: null, status: 'error', error: 'Could not read certificate' }
    }

    const expiresAt = new Date(cert.valid_to)
    const now = new Date()
    const diffMs = expiresAt.getTime() - now.getTime()
    const daysRemaining = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    let status: SSLCheckResult['status']
    if (daysRemaining <= 0) {
      status = 'expired'
    } else if (daysRemaining <= SSL_WARNING_DAYS) {
      status = 'expiring_soon'
    } else {
      status = 'valid'
    }

    return {
      valid: daysRemaining > 0,
      expiresAt: expiresAt.toISOString(),
      daysRemaining,
      status,
      issuer: cert.issuer?.O || cert.issuer?.CN || undefined,
    }
  } catch (error) {
    return {
      valid: false,
      expiresAt: null,
      daysRemaining: null,
      status: 'error',
      error: error instanceof Error ? error.message : 'SSL check failed',
    }
  }
}

interface CertInfo {
  valid_to: string
  valid_from: string
  issuer: { O?: string; CN?: string }
}

function getCertificate(host: string, port: number): Promise<CertInfo | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      socket.destroy()
      resolve(null)
    }, 10000)

    const socket = tls.connect(
      { host, port, servername: host, rejectUnauthorized: false },
      () => {
        clearTimeout(timeout)
        try {
          const cert = socket.getPeerCertificate()
          if (cert && cert.valid_to) {
            resolve({
              valid_to: cert.valid_to,
              valid_from: cert.valid_from,
              issuer: cert.issuer || {},
            })
          } else {
            resolve(null)
          }
        } catch {
          resolve(null)
        }
        socket.end()
      }
    )

    socket.on('error', () => {
      clearTimeout(timeout)
      resolve(null)
    })
  })
}
