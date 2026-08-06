'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { catalogAPI, projectsAPI, recommendationsAPI } from '@/lib/api'
import Navbar from '@/components/Navbar'
import { useProjectStore } from '@/stores/projectStore'
import toast from 'react-hot-toast'
import { Star, ArrowRight, CheckCircle2, Sparkles, Filter, Brain } from 'lucide-react'
import clsx from 'clsx'

const TIERS = ['all', 'basic', 'premium', 'luxury'] as const
type Tier = typeof TIERS[number]

const TIER_COLOR: Record<string, string> = {
  basic:   'bg-slate-100 text-slate-600',
  premium: 'bg-amber-100 text-amber-700',
  luxury:  'bg-indigo-100 text-indigo-700',
}
const TIER_BADGE: Record<string, string> = {
  basic:   'border-slate-300 text-slate-500',
  premium: 'border-amber-400 text-amber-600',
  luxury:  'border-indigo-500 text-indigo-600',
}

function PackagesContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { setSelectedPackage } = useProjectStore()

  const projectId = searchParams.get('projectId') || ''
  const bhk = searchParams.get('bhk') || ''
  const budget = Number(searchParams.get('budget') || '1000000')
  const styleTags = searchParams.get('style') || ''

  const [packages, setPackages] = useState<any[]>([])
  const [filteredTier, setFilteredTier] = useState<Tier>('all')
  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState<string | null>(null)
  const [isAIRanked, setIsAIRanked] = useState(false)

  useEffect(() => {
    const fetch = async () => {
      try {
        if (styleTags) {
          // Use AI recommendations if style tags available
          const res = await recommendationsAPI.packages({ bhk, budget, style_tags: styleTags, project_id: projectId })
          const recs = res.data.recommendations || []
          const pkgs = recs.map((r: any) => ({
            ...r.package,
            _score: r.score,
            _match_pct: r.match_pct,
            _recommended: r.recommended,
            _label: r.label,
          }))
          setPackages(pkgs)
          setIsAIRanked(true)
        } else {
          const res = await catalogAPI.packages({ bhk, budget })
          setPackages(res.data.packages || [])
          setIsAIRanked(false)
        }
      } catch {
        toast.error('Failed to load packages')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [bhk, budget, styleTags])

  const filtered = packages.filter(
    (p) => filteredTier === 'all' || p.tier === filteredTier
  )

  const handleSelect = async (pkg: any) => {
    setSelecting(pkg.id)
    try {
      await projectsAPI.update(projectId, { package_id: pkg.id })
      setSelectedPackage(pkg.id)
      const projRes = await projectsAPI.get(projectId)
      const { setCurrentProject } = useProjectStore.getState()
      setCurrentProject(projRes.data)
      toast.success(`${pkg.name} selected! Let's customise.`)
      router.push(`/customize/${projectId}`)
    } catch {
      toast.error('Failed to select package')
    } finally {
      setSelecting(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm font-medium mb-2">
            {isAIRanked
              ? <span className="flex items-center gap-1.5 text-indigo-600"><Brain className="w-4 h-4" /> AI-Ranked for your style & budget</span>
              : <span className="flex items-center gap-1.5 text-indigo-600"><Sparkles className="w-4 h-4" /> Packages for your {bhk}</span>
            }
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Choose Your Design Package</h1>
          <p className="text-slate-500">
            {isAIRanked
              ? `Smart-ranked by style compatibility for your ${bhk} — budget up to ₹${(budget / 100000).toFixed(1)}L`
              : `Packages filtered for your ${bhk} — budget up to ₹${(budget / 100000).toFixed(1)}L`
            }
          </p>
        </div>

        {/* Tier filter */}
        <div className="flex items-center gap-3 mb-8">
          <Filter className="w-4 h-4 text-slate-400" />
          {TIERS.map((tier) => (
            <button
              key={tier}
              onClick={() => setFilteredTier(tier)}
              className={clsx(
                'px-4 py-2 rounded-xl text-sm font-medium border-2 capitalize transition-all duration-200',
                filteredTier === tier
                  ? 'border-indigo-500 bg-indigo-600 text-white'
                  : 'border-slate-200 text-slate-600 hover:border-indigo-300 bg-white'
              )}
            >
              {tier}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl overflow-hidden bg-white shadow-card">
                <div className="shimmer h-52" />
                <div className="p-5 space-y-3">
                  <div className="shimmer h-5 rounded w-2/3" />
                  <div className="shimmer h-4 rounded w-full" />
                  <div className="shimmer h-8 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">😔</div>
            <p className="text-slate-500 text-lg">No packages found for this filter.</p>
            <button onClick={() => setFilteredTier('all')} className="btn-primary mt-4">Show All Packages</button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((pkg, i) => (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={clsx(
                  'bg-white rounded-2xl shadow-card overflow-hidden card-hover group relative',
                  pkg._recommended && 'ring-2 ring-indigo-500'
                )}
              >
                {/* AI recommended badge */}
                {pkg._recommended && (
                  <div className="absolute top-0 left-0 right-0 bg-indigo-600 text-white text-xs font-bold py-1.5 text-center z-10">
                    ⭐ {pkg._label || 'Best Match for You'}
                  </div>
                )}

                {/* Image */}
                <div className={clsx('relative h-52 overflow-hidden', pkg._recommended && 'mt-7')}>
                  <img
                    src={pkg.thumbnail_url}
                    alt={pkg.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

                  {/* Tier badge */}
                  <div className={clsx(
                    'absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold border capitalize',
                    TIER_BADGE[pkg.tier] || '', 'bg-white/90 backdrop-blur-sm'
                  )}>
                    {pkg.tier}
                  </div>

                  {pkg.featured && (
                    <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-amber-400 text-white text-xs font-bold flex items-center gap-1">
                      <Star className="w-3 h-3 fill-white" /> Featured
                    </div>
                  )}

                  {/* AI match score */}
                  {isAIRanked && pkg._match_pct !== undefined && (
                    <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur text-white text-xs font-bold flex items-center gap-1">
                      <Brain className="w-3 h-3" /> {pkg._match_pct}% match
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="p-5">
                  <h3 className="font-bold text-lg text-slate-900 mb-1">{pkg.name}</h3>
                  <p className="text-sm text-slate-500 mb-3 leading-relaxed line-clamp-2">{pkg.description}</p>

                  {/* Style tags */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {(pkg.style_tags || []).map((tag: string) => (
                      <span key={tag} className={clsx('badge', TIER_COLOR[pkg.tier] || 'bg-slate-100 text-slate-600')}>
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Price */}
                  <div className="flex items-end justify-between mb-4">
                    <div>
                      <div className="text-xs text-slate-400 mb-1">Starting from</div>
                      <div className="text-3xl font-black text-indigo-600">
                        ₹{(pkg.base_price / 100000).toFixed(1)}L
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 text-right">
                      <div>All rooms</div>
                      <div>incl. installation</div>
                    </div>
                  </div>

                  {/* CTA */}
                  <button
                    id={`select-pkg-${pkg.tier}`}
                    onClick={() => handleSelect(pkg)}
                    disabled={selecting === pkg.id}
                    className={clsx(
                      'w-full justify-center py-3',
                      pkg._recommended ? 'btn-primary' : 'btn-secondary'
                    )}
                  >
                    {selecting === pkg.id ? (
                      <div className="spinner w-5 h-5" />
                    ) : (
                      <><CheckCircle2 className="w-4 h-4" /> Select & Customise <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PackagesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <PackagesContent />
    </Suspense>
  )
}
