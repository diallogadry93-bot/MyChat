import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MyChat — Privacy-first messaging',
  description: 'A privacy-first, AI-enhanced messaging app',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased">
        {children}
      </body>
    </html>
  )
}
