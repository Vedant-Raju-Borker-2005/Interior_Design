'use client'

/**
 * Product image that actually loads — stakeholder feedback 1.6.
 *
 * Two things were breaking product images while customers finalised
 * selections: catalog files were 6–10 MB each, and vendor uploads are stored as
 * relative `/static/...` paths that the browser resolved against the frontend
 * origin (a 404). This resolves paths against the API, lazy-loads, and walks a
 * list of fallbacks before showing a neutral placeholder.
 */
import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Package } from 'lucide-react'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export function resolveAssetUrl(url?: string | null): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed
  return `${API_BASE_URL}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`
}

export default function ProductImage({
  src,
  fallbacks = [],
  alt,
  className,
  iconClassName = 'w-6 h-6',
  eager = false,
}: {
  src?: string | null
  /** Tried in order if `src` fails, e.g. the product's other images. */
  fallbacks?: (string | null | undefined)[]
  alt: string
  className?: string
  iconClassName?: string
  eager?: boolean
}) {
  // Keyed on the URLs themselves: callers often pass a fresh array each render,
  // and resetting on identity would retry the same broken image forever.
  const candidateKey = [src, ...fallbacks].map((u) => u || '').join('\n')
  const candidates = useMemo(() => {
    const seen = new Set<string>()
    return candidateKey
      .split('\n')
      .map(resolveAssetUrl)
      .filter((u): u is string => !!u && !seen.has(u) && (seen.add(u), true))
  }, [candidateKey])

  const [index, setIndex] = useState(0)

  // A different product in the same slot starts again from its first image.
  useEffect(() => { setIndex(0) }, [candidateKey])

  const current = candidates[index]

  if (!current) {
    return (
      <div className={clsx('flex items-center justify-center bg-slate-100 text-slate-300', className)} role="img" aria-label={alt}>
        <Package className={iconClassName} />
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={current}
      src={current}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setIndex((i) => i + 1)}
      className={clsx(className, 'bg-slate-100')}
    />
  )
}
