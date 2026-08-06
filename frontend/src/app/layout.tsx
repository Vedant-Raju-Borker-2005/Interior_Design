import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'InteriorAI — AI-Powered Interior Design Platform',
  description: 'Design your dream home with AI. Choose packages, customize room-by-room, generate photo-realistic renders, and get instant quotations.',
  keywords: 'interior design, AI visualization, home decor, 3D rendering, modular furniture, quotation',
  openGraph: {
    title: 'InteriorAI — AI-Powered Interior Design Platform',
    description: 'Design your dream home with AI in minutes.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1e1b4b',
              color: '#fff',
              borderRadius: '12px',
              border: '1px solid rgba(129, 140, 248, 0.3)',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#818cf8', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#f87171', secondary: '#fff' },
            },
          }}
        />
      </body>
    </html>
  )
}
