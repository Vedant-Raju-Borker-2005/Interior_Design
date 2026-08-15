import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'InteriorAI — Designed & Delivered in a Week',
  description: 'Get your home interiors designed and executed in a week. Select packages starting from ₹3L, customize details in real-time, and get instant quotes.',
  keywords: 'interior design, modular furniture, home decor, 3D rendering, site delivery, quotation',
  openGraph: {
    title: 'InteriorAI — Designed & Delivered in a Week',
    description: 'Guaranteed design and execution in a week starting from ₹3L.',
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
          containerStyle={{ top: '75px' }}
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
