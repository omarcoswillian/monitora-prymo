import type { Metadata } from 'next'
import SessionProvider from '@/components/SessionProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'Prymo Monitora',
  description: 'Dashboard de monitoramento de paginas web',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}

// Note: The AppShell component with Sidebar is imported in the pages that need it
// Login page does not use AppShell to allow full-page layout
