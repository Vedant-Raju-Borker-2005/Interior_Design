'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { catalogAPI, projectsAPI, recommendationsAPI } from '@/lib/api'
import Navbar from '@/components/Navbar'
import { useProjectStore } from '@/stores/projectStore'
import toast from 'react-hot-toast'
import { Star, ArrowRight, CheckCircle2, Sparkles, Brain } from 'lucide-react'
import clsx from 'clsx'

const TIER_COLOR: Record<string, string> = {
  basic:   'bg-stone-100 text-stone-700 border-stone-200',
  premium: 'bg-[#faeae3] text-[#b85d3b] border-[#f4d1c3]',
  luxury:  'bg-[#f6f1e3] text-[#c5a059] border-[#e8dcb8]',
}
const TIER_BADGE: Record<string, string> = {
  basic:   'border-stone-300 text-stone-600',
  premium: 'border-[#b85d3b]/40 text-[#b85d3b]',
  luxury:  'border-[#c5a059] text-[#a68238]',
}

function PackagesContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { setSelectedPackage } = useProjectStore()

  const projectId = searchParams.get('projectId') || ''
  const bhk = searchParams.get('bhk') || ''
  const budget = Number(searchParams.get('budget') || '1000000')
  const styleTags = searchParams.get('style') || ''

  const minBudgetParam = searchParams.get('minBudget') ? Number(searchParams.get('minBudget')) : null

  const getDynamicPrice = (pkg: any) => {
    const tier = (pkg.tier || 'basic').toLowerCase()
    const normBhk = (bhk || '1BHK').replace(/\s+/g, '').toUpperCase()

    // Minimum realistic baseline packages per BHK
    const BHK_DEFAULTS: Record<string, { basic: number; premium: number; luxury: number }> = {
      '1BHK': { basic: 300000, premium: 400000, luxury: 500000 },
      '2BHK': { basic: 480000, premium: 640000, luxury: 800000 },
      '3BHK': { basic: 680000, premium: 840000, luxury: 1000000 },
      '4BHK': { basic: 950000, premium: 1225000, luxury: 1500000 },
      '5BHK': { basic: 1400000, premium: 1700000, luxury: 2000000 },
    }

    const defaultPrices = BHK_DEFAULTS[normBhk] || BHK_DEFAULTS['1BHK']

    if (minBudgetParam && budget && budget > minBudgetParam) {
      const step = (budget - minBudgetParam) / 2
      if (tier === 'basic') return Math.round(minBudgetParam)
      if (tier === 'premium') return Math.round(minBudgetParam + step)
      if (tier === 'luxury') return Math.round(budget)
    }

    if (tier === 'basic') return defaultPrices.basic
    if (tier === 'premium') return defaultPrices.premium
    if (tier === 'luxury') return defaultPrices.luxury
    return pkg.base_price || defaultPrices.basic
  }

  const [packages, setPackages] = useState<any[]>([])
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

  const handleSelect = async (pkg: any) => {
    setSelecting(pkg.id)
    try {
      const finalBudget = getDynamicPrice(pkg)
      let targetProjectId = projectId || useProjectStore.getState().currentProject?.id

      if (!targetProjectId) {
        try {
          const listRes = await projectsAPI.list()
          const projs = listRes.data?.projects || []
          if (projs.length > 0) {
            targetProjectId = projs[0].id
          }
        } catch (e) {
          console.warn('Could not fetch projects list', e)
        }
      }

      if (!targetProjectId) {
        const createRes = await projectsAPI.create({
          bhk_type: bhk || pkg.bhk || '1BHK',
          property_name: `${bhk || pkg.bhk || '1BHK'} Design Project`,
          city: searchParams.get('city') || 'Mumbai',
          budget: finalBudget,
          package_id: pkg.id,
        })
        targetProjectId = createRes.data?.project_id
      } else {
        await projectsAPI.update(targetProjectId, { package_id: pkg.id, budget: finalBudget })
      }

      if (!targetProjectId) {
        throw new Error('Could not establish active project')
      }

      setSelectedPackage(pkg.id)
      const projRes = await projectsAPI.get(targetProjectId)
      const { setCurrentProject } = useProjectStore.getState()
      setCurrentProject(projRes.data)
      toast.success(`${pkg.name} selected! Let's customise.`)
      router.push(`/customize/${targetProjectId}`)
    } catch (err: any) {
      console.error('Failed to select package', err)
      const msg = err?.response?.data?.detail || err?.message || 'Failed to select package'
      toast.error(`Failed to select package: ${msg}`)
    } finally {
      setSelecting(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">

        {/* Header */}
        <div className="mb-10 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-bold uppercase tracking-wider mb-2">
            {isAIRanked
              ? <span className="flex items-center gap-1.5 text-[#b85d3b] bg-[#faeae3] px-3 py-1 rounded-full"><Brain className="w-3.5 h-3.5" /> AI-Ranked for your style & palette</span>
              : <span className="flex items-center gap-1.5 text-[#b85d3b] bg-[#faeae3] px-3 py-1 rounded-full"><Sparkles className="w-3.5 h-3.5" /> Tailored packages for your {bhk}</span>
            }
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-stone-900 font-serif mb-2">Choose Your Design Package</h1>
          <p className="text-stone-600 text-sm max-w-2xl font-medium">
            {isAIRanked
              ? `Smart-curated packages dynamically scaled for your ${bhk} within ₹${(budget / 100000).toFixed(1)}L. Includes modular execution, site handover & customer verification.`
              : `Packages dynamically scaled for your ${bhk} within ₹${(budget / 100000).toFixed(1)}L.`
            }
          </p>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-3xl overflow-hidden bg-white border border-[#E8DFD1] shadow-sm">
                <div className="shimmer h-56 bg-stone-100" />
                <div className="p-6 space-y-3">
                  <div className="shimmer h-5 rounded w-2/3 bg-stone-200" />
                  <div className="shimmer h-4 rounded w-full bg-stone-100" />
                  <div className="shimmer h-8 rounded w-1/3 bg-stone-200" />
                </div>
              </div>
            ))}
          </div>
        ) : packages.length === 0 ? (
          <div className="text-center py-24 bg-white border border-[#E8DFD1] rounded-3xl p-8">
            <div className="text-5xl mb-4">🛋️</div>
            <p className="text-stone-600 text-lg font-serif">No packages found for {bhk}.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {packages.map((pkg, i) => (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={clsx(
                  'bg-white rounded-3xl border overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group relative flex flex-col',
                  pkg._recommended ? 'border-[#b85d3b] ring-2 ring-[#b85d3b]/20' : 'border-[#E8DFD1]'
                )}
              >
                {/* AI recommended badge */}
                {pkg._recommended && (
                  <div className="bg-[#b85d3b] text-white text-[11px] font-bold py-1.5 px-4 text-center tracking-wider uppercase z-10 flex items-center justify-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#c5a059]" />
                    <span>{pkg._label || 'Best Match for You'}</span>
                  </div>
                )}

                {/* Image */}
                <div className="relative h-56 overflow-hidden bg-stone-100">
                  <img
                    src={pkg.thumbnail_url || '/images/hero/living_room_hero.webp'}
                    alt={pkg.name}
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement
                      if (!target.dataset.tried) {
                        target.dataset.tried = 'true'
                        target.src = '/images/hero/living_room_hero.webp'
                      }
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

                  {/* Tier badge */}
                  <div className={clsx(
                    'absolute top-3 left-3 px-3 py-1 rounded-full text-[11px] font-extrabold border uppercase tracking-wider',
                    TIER_BADGE[pkg.tier] || '', 'bg-white/95 backdrop-blur-md shadow-xs'
                  )}>
                    {pkg.tier}
                  </div>

                  {pkg.featured && (
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-[#c5a059] text-white text-[10px] font-bold flex items-center gap-1 shadow-sm">
                      <Star className="w-3 h-3 fill-white" /> Featured
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-xl text-stone-900 mb-1.5 font-serif">{pkg.name}</h3>
                    <p className="text-xs text-stone-600 mb-4 leading-relaxed line-clamp-2 font-medium">{pkg.description}</p>

                    {/* Style tags */}
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {(pkg.style_tags || []).map((tag: string) => (
                        <span key={tag} className={clsx('px-2.5 py-0.5 rounded-md text-[10px] font-semibold border capitalize', TIER_COLOR[pkg.tier] || 'bg-stone-100 text-stone-700 border-stone-200')}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    {/* Price with transparent math (Lowest = Basic, Mid = Premium, Highest = Luxury) */}
                    <div className="flex items-end justify-between mb-5 pt-4 border-t border-stone-100">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-0.5">Fixed Package Total</div>
                        <div className="text-3xl font-extrabold text-[#b85d3b] font-serif">
                          ₹{(getDynamicPrice(pkg) / 100000).toFixed(1)}L
                        </div>
                      </div>
                      <div className="text-[10px] text-stone-500 text-right font-medium">
                        <div>Complete {bhk} Coverage</div>
                        <div className="text-emerald-700 font-bold">100% Price Lock</div>
                      </div>
                    </div>

                    {/* CTA */}
                    <button
                      id={`select-pkg-${pkg.tier}`}
                      onClick={() => handleSelect(pkg)}
                      disabled={selecting === pkg.id}
                      className={clsx(
                        'w-full py-3.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm',
                        pkg._recommended
                          ? 'bg-[#b85d3b] hover:bg-[#a04e30] text-white shadow-md'
                          : 'bg-white border-2 border-stone-200 hover:border-[#b85d3b] text-stone-800 hover:text-[#b85d3b]'
                      )}
                    >
                      {selecting === pkg.id ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <><CheckCircle2 className="w-4 h-4" /> Select & Begin Customising <ArrowRight className="w-4 h-4" /></>
                      )}
                    </button>
                  </div>
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
    <Suspense fallback={<div className="min-h-screen bg-[#FAF7F2]" />}>
      <PackagesContent />
    </Suspense>
  )
}
