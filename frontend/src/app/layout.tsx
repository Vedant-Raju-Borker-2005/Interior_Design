import type { Metadata } from 'next'
import './globals.css'
import DynamicIslandToaster from '@/components/DynamicIslandToaster'

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
        <DynamicIslandToaster />
      </body>
    </html>
  )
}
