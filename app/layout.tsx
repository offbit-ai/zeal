import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/Toast'
import { ConsoleOverride } from '@/components/ConsoleOverride'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Zeal - Workflow Orchestrator',
  description: 'Visual workflow automation platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script src="/config.js" />
      </head>
      <body className={inter.className}>
        <ConsoleOverride />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
