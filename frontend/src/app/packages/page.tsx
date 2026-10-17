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

  const getDynamicPrice = (pkg: any) => {
    if (!budget) return pkg.base_price
    
    let minBudget = 300000;
    let maxBudget = 500000;
    
    if (budget <= 500000) { minBudget = 300000; maxBudget = 500000; }
    else if (budget <= 800000) { minBudget = 500000; maxBudget = 800000; }
    else if (budget <= 1200000) { minBudget = 800000; maxBudget = 1200000; }
    else if (budget <= 2000000) { minBudget = 1200000; maxBudget = 2000000; }
    else { minBudget = 2000000; maxBudget = 3000000; }

    const step = (maxBudget - minBudget) / 2;

    if (pkg.tier === 'basic') return minBudget
    if (pkg.tier === 'premium') return minBudget + step
    if (pkg.tier === 'luxury') return maxBudget
    return pkg.base_price
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
      await projectsAPI.update(projectId, { package_id: pkg.id, budget: finalBudget })
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

                  {/* AI match score */}
                  {isAIRanked && pkg._match_pct !== undefined && (
                    <div className="absolute bottom-3 right-3 px-3 py-1 rounded-full bg-stone-900/75 backdrop-blur text-white text-[10px] font-bold flex items-center gap-1.5 border border-white/20">
                      <Brain className="w-3 h-3 text-[#c5a059]" /> {pkg._match_pct}% Match
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
