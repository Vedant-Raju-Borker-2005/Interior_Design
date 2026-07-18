'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useProjectStore } from '@/stores/projectStore'
import { useAuthStore } from '@/stores/authStore'
import { projectsAPI, catalogAPI } from '@/lib/api'

import BhkSelector from '@/components/BhkSelector'
import Navbar from '@/components/Navbar'
import toast from 'react-hot-toast'
import { ArrowRight, ArrowLeft, CheckCircle2, Home, Sparkles, Wrench, Upload, FileText, Layout, Check, ShieldAlert } from 'lucide-react'
import clsx from 'clsx'
import { getColorHex, getColorFamily } from '@/lib/colorUtils'

const STYLE_OPTIONS = [
  { id: 'modern',              label: 'Modern',              emoji: '🔲', desc: 'Clean lines, neutral tones' },
  { id: 'scandinavian',        label: 'Scandinavian',        emoji: '🪵', desc: 'Light wood, cozy textures' },
  { id: 'indian_contemporary', label: 'Indian Contemporary', emoji: '🪔', desc: 'Warm tones, brass accents' },
  { id: 'luxury',              label: 'Luxury',              emoji: '💎', desc: 'Marble, velvet, bespoke' },
  { id: 'mediterranean',       label: 'Mediterranean',       emoji: '🌊', desc: 'Arches, terracotta, sea palette' },
  { id: 'boho',                label: 'Boho',                emoji: '🪴', desc: 'Rattan, macramé, warm amber' },
]

const BUDGET_RANGES = [
  { id: '300000',  label: '₹3L – ₹5L',   min: 300000,  max: 500000 },
  { id: '500000',  label: '₹5L – ₹8L',   min: 500000,  max: 800000 },
  { id: '800000',  label: '₹8L – ₹12L',  min: 800000,  max: 1200000 },
  { id: '1200000', label: '₹12L – ₹20L', min: 1200000, max: 2000000 },
  { id: '2000000', label: '₹20L+',        min: 2000000, max: 9999999 },
]

const TIMELINE_OPTIONS = [
  { id: '1_month',  label: 'ASAP (< 1 month)' },
  { id: '3_months', label: '1–3 months' },
  { id: '6_months', label: '3–6 months' },
  { id: 'flexible', label: 'Flexible / Planning' },
]

const MATERIAL_OPTIONS = [
  { id: 'budget',   label: 'Budget',   desc: 'Durable & affordable finishes',       emoji: '💡' },
  { id: 'standard', label: 'Standard', desc: 'Quality materials, great value',       emoji: '⭐' },
  { id: 'premium',  label: 'Premium',  desc: 'High-end materials & craftsmanship', emoji: '💎' },
]

const FURNISHING_OPTIONS = [
  { id: 'new',     label: 'New Home',    desc: 'Moving into a new property', icon: Home },
  { id: 'upgrade', label: 'Upgrading',   desc: 'Renovating an existing space', icon: Wrench },
]

const CITIES = ['Bangalore', 'Mumbai', 'Delhi', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad', 'Other']

const STEPS = ['Style', 'Color Preference', 'BHK & Layout', 'Budget', 'Preferences', 'Details']

export default function OnboardingPage() {
  const router = useRouter()
  const { onboarding, setOnboarding } = useProjectStore()
  const { isLoggedIn } = useAuthStore()

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [availableColors, setAvailableColors] = useState<any>(null)
  const [searches, setSearches] = useState<Record<string, string>>({
    Neutral: '',
    Earthy: '',
    'Luxury / Premium': '',
    Accent: ''
  })
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  
  // Floor Plan upload states
  const [floorPlanMode, setFloorPlanMode] = useState<'select' | 'upload'>('select')
  const [selectedPlanId, setSelectedPlanId] = useState('plan-standard')
  const [uploadFile, setUploadFile] = useState<{ name: string; size: string; type: string } | null>(null)
  const [uploading, setUploading] = useState(false)

  const [local, setLocal] = useState({
    style_tags:          [] as string[],
    color_preferences:   [] as string[],
    bhk:                 '',
    budget:              '',
    timeline:            '',
    material_preference: '',
    furnishing_type:     '',
    city:                '',
    property_name:       '',
    pincode:             '',
  })

  useEffect(() => {
    const fetchColors = async () => {
      try {
        const res = await catalogAPI.colors({
          style: local.style_tags?.[0],
          grouped: true
        })
        setAvailableColors(res.data)
      } catch (err) {
        console.error("Failed to load onboarding colors:", err)
      }
    }
    if (local.style_tags?.length > 0) {
      fetchColors()
    } else {
      // Default fetch
      fetchColors()
    }
  }, [local.style_tags])


  if (!isLoggedIn) {
    if (typeof window !== 'undefined') router.push('/login')
    return null
  }

  // Visual Mock Plans list based on selected BHK
  const getMockPlans = (bhk: string) => {
    const cleanBhk = bhk || '2BHK'
    return [
      { id: 'plan-compact', name: `${cleanBhk} Compact Layout`, size: bhk === '1BHK' ? '550 sqft' : bhk === '2BHK' ? '950 sqft' : '1450 sqft', desc: 'Optimised space saving design with linear modular solutions.' },
      { id: 'plan-standard', name: `${cleanBhk} Premium Layout`, size: bhk === '1BHK' ? '680 sqft' : bhk === '2BHK' ? '1120 sqft' : '1750 sqft', desc: 'Spacious common zones, dedicated work-from-home alcove.' },
      { id: 'plan-luxury', name: `${cleanBhk} Spacious Luxury Layout`, size: bhk === '1BHK' ? '820 sqft' : bhk === '2BHK' ? '1350 sqft' : '2100 sqft', desc: 'Double balconies, master suite with walk-in wardrobe area.' }
    ]
  }

  const handleFakeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setTimeout(() => {
      setUploadFile({
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        type: file.type.includes('pdf') ? 'pdf' : 'image'
      })
      setUploading(false)
      toast.success('Floor plan parsed successfully! 📐')
    }, 1500)
  }

  const toggleStyle = (id: string) => {
    setLocal((s) => ({
      ...s,
      style_tags: s.style_tags.includes(id)
        ? s.style_tags.filter((x) => x !== id)
        : [...s.style_tags, id],
    }))
  }

  const canNext = () => {
    if (step === 0) return local.style_tags.length > 0
    if (step === 1) return local.color_preferences.length > 0
    if (step === 2) {
      if (!local.bhk) return false
      if (floorPlanMode === 'select') return !!selectedPlanId
      if (floorPlanMode === 'upload') return !!uploadFile
      return false
    }
    if (step === 3) return !!local.budget && !!local.timeline
    if (step === 4) return !!local.material_preference && !!local.furnishing_type
    if (step === 5) return !!local.city && !!local.property_name
    return false
  }


  const handleSubmit = async () => {
    setLoading(true)
    try {
      const budgetObj = BUDGET_RANGES.find((b) => b.id === local.budget)
      
      let finalPlanName = 'Standard 2D Layout Plan'
      if (floorPlanMode === 'select') {
        const selectedPlan = getMockPlans(local.bhk).find(p => p.id === selectedPlanId)
        finalPlanName = selectedPlan ? `${selectedPlan.name} (${selectedPlan.size})` : 'Selected standard plan'
      } else if (uploadFile) {
        finalPlanName = `Uploaded Plan: ${uploadFile.name} (${uploadFile.size})`
      }

      const res = await projectsAPI.create({
        bhk_type:            local.bhk,
        property_name:       local.property_name,
        city:                local.city,
        budget:              budgetObj?.max || 1000000,
        material_preference: local.material_preference,
        furnishing_type:     local.furnishing_type,
        pincode:             local.pincode || undefined,
        floor_plan_type:     floorPlanMode,
        floor_plan_name:     finalPlanName,
        color_preferences:   local.color_preferences,
      })
      
      setOnboarding({
        bhk:       local.bhk,
        style_tags: local.style_tags,
        color_preferences: local.color_preferences,
        budget:    budgetObj?.max,
        city:      local.city,
      })
      
      toast.success('Project created with floor plan! 🎉')
      router.push(`/packages?projectId=${res.data.project_id}&bhk=${local.bhk}&budget=${budgetObj?.max || 1000000}&style=${local.style_tags.join(',')}`)

    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 pt-28 pb-16">

        {/* Progress */}
        <div className="flex items-center justify-between mb-10 px-1 border-b border-slate-200 pb-5 overflow-hidden">
          {STEPS.map((s, i) => (
            <div key={s} className={clsx("flex items-center flex-1 justify-center", i === STEPS.length - 1 ? "flex-none" : "")}>
              <div className="flex items-center gap-1 md:gap-1.5 flex-shrink-0">
                <div className={clsx(
                  'w-6 h-6 md:w-8 h-8 rounded-full flex items-center justify-center text-[10px] md:text-sm font-bold transition-all flex-shrink-0',
                  i < step  ? 'bg-indigo-600 text-white' :
                  i === step ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' :
                  'bg-slate-200 text-slate-400'
                )}>
                  {i < step ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={clsx('text-[9px] md:text-xs font-bold leading-none hidden xs:inline', i <= step ? 'text-indigo-700' : 'text-slate-400')}>
                  {s}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={clsx('flex-1 h-[2px] mx-2 md:mx-4 min-w-[12px]', i < step ? 'bg-indigo-600' : 'bg-slate-200')} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* Step 0: Style */}
          {step === 0 && (
            <motion.div key="style" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <h2 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">What's your design vibe?</h2>
              <p className="text-slate-500 mb-8">Select one or more. We'll curate package suggestions that fit your aesthetic.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => toggleStyle(opt.id)}
                    className={clsx(
                      'p-5 rounded-2xl border-2 text-left transition-all duration-200 bg-white card-hover',
                      local.style_tags.includes(opt.id)
                        ? 'border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-500'
                        : 'border-slate-200 hover:border-indigo-300'
                    )}
                  >
                    <div className="text-3.5xl mb-3">{opt.emoji}</div>
                    <div className="font-bold text-slate-800 text-base">{opt.label}</div>
                    <div className="text-xs text-slate-500 mt-1.5 leading-relaxed">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 1: Color Preference (Loading view) */}
          {step === 1 && !availableColors && (
            <div className="text-center py-20">
              <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-500 text-sm">Loading color preferences catalog...</p>
            </div>
          )}

          {/* Step 1: Color Preference (Main view) */}
          {step === 1 && availableColors && (() => {
            const categoriesNames = ["Neutral", "Earthy", "Luxury / Premium", "Accent"];

            return (
              <motion.div key="colors" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-6">
                <div className="text-center max-w-lg mx-auto">
                  <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-1.5 tracking-tight">Smart Color Explorer</h2>
                  <p className="text-slate-500 text-xs md:text-sm">Personalise your home by choosing color families. Commonly selected colors appear first based on popularity.</p>
                </div>

                {/* 1. Recommended for Your Style */}
                {availableColors.recommended?.length > 0 && (
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 shadow-sm">
                    <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-650" />
                      <span>Recommended for Your Style ({local.style_tags?.[0] ? STYLE_OPTIONS.find(o => o.id === local.style_tags[0])?.label : 'General'})</span>
                    </h3>
                    <div className="flex flex-wrap gap-2.5">
                      {availableColors.recommended.map((c: string) => {
                        const active = local.color_preferences.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => {
                              setLocal((s) => ({
                                ...s,
                                color_preferences: s.color_preferences.includes(c)
                                  ? s.color_preferences.filter((x) => x !== c)
                                  : [...s.color_preferences, c],
                              }));
                            }}
                            className={clsx(
                              "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-white border transition-all duration-200 shadow-sm",
                              active 
                                ? "border-indigo-600 ring-2 ring-indigo-500 text-indigo-900 scale-105" 
                                : "border-slate-205 border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-slate-50"
                            )}
                          >
                            <span className="w-3 h-3 rounded-full border border-slate-300 flex-shrink-0" style={{ backgroundColor: getColorHex(c) }} />
                            <span>{c}</span>
                            {active && <Check className="w-3 h-3 text-indigo-600 ml-0.5 stroke-[3.5]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. Color Categories 2x2 Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {categoriesNames.map((catName) => {
                    const allColors = availableColors.categories?.[catName] || [];
                    const searchVal = searches[catName] || '';
                    
                    const filteredAll = allColors.filter((colorObj: any) => 
                      colorObj.name.toLowerCase().includes(searchVal.toLowerCase())
                    );
                    
                    const displayColors = searchVal ? filteredAll : filteredAll.slice(0, 6);

                    return (
                      <div key={catName} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card space-y-4 flex flex-col justify-between">
                        
                        <div>
                          {/* Card Header & Search */}
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-1">
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{catName}</h3>
                            <div className="relative w-1/2 max-w-[140px]">
                              <input
                                type="text"
                                placeholder="Search..."
                                value={searchVal}
                                onChange={e => setSearches(s => ({ ...s, [catName]: e.target.value }))}
                                className="w-full text-[10px] border border-slate-200 rounded-lg py-1 px-2.5 font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50"
                              />
                            </div>
                          </div>

                          {/* Horizontal Swatches Carousel */}
                          <div className="flex gap-4 overflow-x-auto py-3 px-1 scrollbar-hide select-none max-w-full">
                            {displayColors.length === 0 ? (
                              <p className="text-[10px] text-slate-450 italic py-2">No matching colors found</p>
                            ) : (
                              displayColors.map((colorObj: any) => {
                                const c = colorObj.name;
                                const active = local.color_preferences.includes(c);
                                const hex = getColorHex(c);
                                return (
                                  <div key={c} className="flex flex-col items-center flex-shrink-0 w-14">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setLocal((s) => ({
                                          ...s,
                                          color_preferences: s.color_preferences.includes(c)
                                            ? s.color_preferences.filter((x) => x !== c)
                                            : [...s.color_preferences, c],
                                        }));
                                      }}
                                      className={clsx(
                                        "w-9 h-9 rounded-full border shadow-sm relative flex items-center justify-center transition-all duration-300",
                                        "hover:scale-115 hover:shadow-[0_0_10px_rgba(79,70,229,0.3)] hover:-translate-y-0.5 active:scale-95",
                                        active 
                                          ? "border-indigo-600 ring-2 ring-indigo-500 shadow-md scale-105" 
                                          : "border-slate-300"
                                      )}
                                      style={{ backgroundColor: hex }}
                                      title={c}
                                    >
                                      {active && (
                                        <Check className={clsx(
                                          "w-3.5 h-3.5 font-black stroke-[3.5]",
                                          ['white', 'beige', 'cream', 'off white', 'off-white', 'clear glass', 'frosted'].includes(c.toLowerCase()) ? 'text-slate-800' : 'text-white'
                                        )} />
                                      )}
                                    </button>
                                    <span className={clsx(
                                      "text-[9px] font-bold tracking-wide mt-1 truncate max-w-full text-center transition-all",
                                      active ? "text-indigo-650 font-extrabold" : "text-slate-500"
                                    )}>
                                      {c}
                                    </span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                        {/* Show More */}
                        {allColors.length > 6 && !searchVal && (
                          <div className="flex justify-end pt-1 border-t border-slate-100/50">
                            <button
                              type="button"
                              onClick={() => setExpandedCategory(catName)}
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 transition"
                            >
                              Show More ({allColors.length}) &rarr;
                            </button>
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>

                {/* 3. Selected Palette summary list */}
                <div className="bg-slate-100/50 p-4 rounded-xl border border-slate-200/60 max-w-lg mx-auto">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">Selected Colors</h3>
                  {local.color_preferences.length === 0 ? (
                    <p className="text-xs text-slate-450 italic">No colors selected yet. Pick swatches from the categories above to build your palette.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {local.color_preferences.map(c => (
                        <span key={c} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-white text-slate-800 shadow-sm border border-slate-200 hover:border-indigo-200 transition">
                          <span className="w-2.5 h-2.5 rounded-full border border-slate-300 flex-shrink-0" style={{ backgroundColor: getColorHex(c) }} />
                          {c}
                          <button
                            type="button"
                            onClick={() => {
                              setLocal(s => ({
                                ...s,
                                color_preferences: s.color_preferences.filter(x => x !== c)
                              }))
                            }}
                            className="text-slate-400 hover:text-red-500 transition font-extrabold ml-0.5 focus:outline-none"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Show More Category Colors Dialog Overlay */}
                {expandedCategory && (() => {
                  const catName = expandedCategory;
                  const allColors = availableColors.categories?.[catName] || [];
                  const searchVal = searches[catName] || '';
                  const filtered = allColors.filter((colorObj: any) => 
                    colorObj.name.toLowerCase().includes(searchVal.toLowerCase())
                  );

                  return (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
                      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-5 relative flex flex-col max-h-[80vh]">
                        <button
                          onClick={() => setExpandedCategory(null)}
                          className="absolute top-3.5 right-3.5 text-slate-400 hover:text-slate-600 text-xl font-extrabold focus:outline-none"
                        >
                          &times;
                        </button>
                        
                        <div className="border-b border-slate-100 pb-2.5 mb-3.5">
                          <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">{catName} Colors</h3>
                          <p className="text-[10px] text-slate-500 mt-0.5">Browse and select multiple color shades.</p>
                        </div>

                        {/* Search input in expanded view */}
                        <div className="mb-3.5">
                          <input
                            type="text"
                            placeholder={`Search all ${catName} colors...`}
                            value={searchVal}
                            onChange={e => setSearches(s => ({ ...s, [catName]: e.target.value }))}
                            className="w-full text-xs border border-slate-200 rounded-lg p-2 font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50"
                          />
                        </div>

                        {/* Expanded colors grid */}
                        <div className="overflow-y-auto flex-1 pr-1 py-1">
                          {filtered.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-6 text-center">No colors found matching filter.</p>
                          ) : (
                            <div className="grid grid-cols-4 gap-y-4 gap-x-2">
                              {filtered.map((colorObj: any) => {
                                const c = colorObj.name;
                                const active = local.color_preferences.includes(c);
                                const hex = getColorHex(c);
                                return (
                                  <div key={c} className="flex flex-col items-center">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setLocal((s) => ({
                                          ...s,
                                          color_preferences: s.color_preferences.includes(c)
                                            ? s.color_preferences.filter((x) => x !== c)
                                            : [...s.color_preferences, c],
                                        }));
                                      }}
                                      className={clsx(
                                        "w-9 h-9 rounded-full border shadow-sm relative flex items-center justify-center transition-all duration-300",
                                        "hover:scale-115 hover:shadow-[0_0_10px_rgba(79,70,229,0.3)] hover:-translate-y-0.5 active:scale-95",
                                        active 
                                          ? "border-indigo-600 ring-2 ring-indigo-500 shadow-md scale-105" 
                                          : "border-slate-300"
                                      )}
                                      style={{ backgroundColor: hex }}
                                      title={c}
                                    >
                                      {active && (
                                        <Check className={clsx(
                                          "w-3.5 h-3.5 font-black stroke-[3.5]",
                                          ['white', 'beige', 'cream', 'off white', 'off-white', 'clear glass', 'frosted'].includes(c.toLowerCase()) ? 'text-slate-800' : 'text-white'
                                        )} />
                                      )}
                                    </button>
                                    <span className={clsx(
                                      "text-[9px] font-bold tracking-wide mt-1 truncate max-w-full text-center transition-all",
                                      active ? "text-indigo-650 font-extrabold" : "text-slate-500"
                                    )}>
                                      {c}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="border-t border-slate-100 pt-3 mt-3 flex justify-end">
                          <button
                            type="button"
                            onClick={() => setExpandedCategory(null)}
                            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition"
                          >
                            Done
                          </button>
                        </div>

                      </div>
                    </div>
                  );
                })()}

              </motion.div>
            );
          })()}

          {/* Step 2: BHK & Floor Plan */}
          {step === 2 && (
            <motion.div key="bhk" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-8">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Home Configuration</h2>
                <p className="text-slate-500 mb-6">Select your BHK structure. We'll automatically set up rooms for rendering.</p>
                <BhkSelector selected={local.bhk} onSelect={(bhk) => setLocal((s) => ({ ...s, bhk }))} />
              </div>

              {local.bhk && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl p-6 shadow-card border border-slate-100 space-y-6"
                >
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                      <Layout className="w-5 h-5 text-indigo-600" /> Floor Plan Layout
                    </h3>
                    <p className="text-slate-400 text-xs mt-1">Select a pre-designed standard structural blueprint or upload yours.</p>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-xl max-w-sm">
                    <button
                      onClick={() => setFloorPlanMode('select')}
                      className={clsx(
                        'flex-1 py-2 rounded-lg text-xs font-bold transition-all',
                        floorPlanMode === 'select' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'
                      )}
                    >
                      Choose Standard Layout
                    </button>
                    <button
                      onClick={() => setFloorPlanMode('upload')}
                      className={clsx(
                        'flex-1 py-2 rounded-lg text-xs font-bold transition-all',
                        floorPlanMode === 'upload' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'
                      )}
                    >
                      Upload Blueprint
                    </button>
                  </div>

                  {floorPlanMode === 'select' ? (
                    <div className="grid sm:grid-cols-3 gap-4">
                      {getMockPlans(local.bhk).map((plan) => (
                        <button
                          key={plan.id}
                          onClick={() => setSelectedPlanId(plan.id)}
                          className={clsx(
                            'p-4 rounded-xl border-2 text-left transition-all relative flex flex-col justify-between h-40',
                            selectedPlanId === plan.id
                              ? 'border-indigo-500 bg-indigo-50/30'
                              : 'border-slate-200 hover:border-slate-300'
                          )}
                        >
                          <div>
                            <div className="flex justify-between items-start">
                              <span className="font-bold text-slate-800 text-sm">{plan.name}</span>
                              {selectedPlanId === plan.id && (
                                <div className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                                  <Check className="w-2.5 h-2.5 stroke-[4px]" />
                                </div>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">{plan.desc}</p>
                          </div>
                          <span className="inline-block mt-4 bg-indigo-100/60 text-indigo-700 text-xs font-extrabold px-2 py-0.5 rounded-md self-start">
                            {plan.size}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50/50 hover:bg-slate-50 transition relative">
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={handleFakeUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          disabled={uploading}
                        />
                        {uploading ? (
                          <div className="flex flex-col items-center justify-center">
                            <div className="spinner w-8 h-8 mb-2" />
                            <p className="text-slate-500 font-bold text-sm">Processing & scanning floor plan...</p>
                          </div>
                        ) : uploadFile ? (
                          <div className="flex flex-col items-center justify-center">
                            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                              {uploadFile.type === 'pdf' ? <FileText className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
                            </div>
                            <p className="text-slate-800 font-bold text-sm truncate max-w-xs">{uploadFile.name}</p>
                            <p className="text-slate-400 text-xs mt-0.5">{uploadFile.size}</p>
                            <span className="mt-3 bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Successfully Uploaded
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center">
                            <Upload className="w-8 h-8 text-slate-400 mb-2" />
                            <p className="text-slate-800 font-bold text-sm">Click or Drag blueprint here</p>
                            <p className="text-slate-400 text-xs mt-1">Supports PDF, PNG, JPG files up to 10MB</p>
                          </div>
                        )}
                      </div>
                      
                      {uploadFile && (
                        <div className="text-xs text-indigo-600 flex items-center gap-1.5 bg-indigo-50/50 p-2 rounded-lg font-medium">
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                          <span>AI will match your packages and renders to this uploaded floor plan layout!</span>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Step 3: Budget & Timeline */}
          {step === 3 && (
            <motion.div key="budget" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <h2 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Budget & Timeline</h2>
              <p className="text-slate-500 mb-6">Helps us curate package price tiers aligned with your goals.</p>
              <div className="mb-8 bg-white p-6 rounded-2xl border border-slate-100 shadow-card">
                <div className="text-sm font-bold text-slate-800 mb-3.5 uppercase tracking-wider">Total Interior Budget</div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {BUDGET_RANGES.map((b) => (
                    <button key={b.id} onClick={() => setLocal((s) => ({ ...s, budget: b.id }))}
                      className={clsx('p-3 rounded-xl border-2 text-xs font-bold transition-all text-center',
                        local.budget === b.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-black' : 'border-slate-200 text-slate-600 hover:border-indigo-300 bg-white')}>
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-card">
                <div className="text-sm font-bold text-slate-800 mb-3.5 uppercase tracking-wider">When do you want to start?</div>
                <div className="grid grid-cols-2 gap-3">
                  {TIMELINE_OPTIONS.map((t) => (
                    <button key={t.id} onClick={() => setLocal((s) => ({ ...s, timeline: t.id }))}
                      className={clsx('p-3.5 rounded-xl border-2 text-sm font-bold transition-all',
                        local.timeline === t.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-indigo-300 bg-white')}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 4: Preferences */}
          {step === 4 && (
            <motion.div key="prefs" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <h2 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Your Preferences</h2>
              <p className="text-slate-500 mb-8">Refine the build qualities and scope of works.</p>

              <div className="mb-8">
                <div className="text-sm font-bold text-slate-800 mb-3.5 uppercase tracking-wider">Material Quality Preference</div>
                <div className="grid grid-cols-3 gap-4">
                  {MATERIAL_OPTIONS.map((m) => (
                    <button key={m.id} onClick={() => setLocal((s) => ({ ...s, material_preference: m.id }))}
                      className={clsx('p-5 rounded-2xl border-2 text-center transition-all bg-white card-hover',
                        local.material_preference === m.id ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 hover:border-indigo-300')}>
                      <div className="text-3xl mb-2">{m.emoji}</div>
                      <div className="font-bold text-slate-800 text-sm">{m.label}</div>
                      <div className="text-xs text-slate-500 mt-1.5 leading-relaxed">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-bold text-slate-800 mb-3.5 uppercase tracking-wider">Scope of Furnishing</div>
                <div className="grid grid-cols-2 gap-4">
                  {FURNISHING_OPTIONS.map((f) => (
                    <button key={f.id} onClick={() => setLocal((s) => ({ ...s, furnishing_type: f.id }))}
                      className={clsx('p-5 rounded-2xl border-2 text-left transition-all flex items-center gap-4 bg-white card-hover',
                        local.furnishing_type === f.id ? 'border-indigo-500 bg-indigo-50/40' : 'border-slate-200 hover:border-indigo-300')}>
                      <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                        local.furnishing_type === f.id ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500')}>
                        <f.icon className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-sm">{f.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5 leading-normal">{f.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 5: Property Details */}
          {step === 5 && (
            <motion.div key="details" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <h2 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Property Details</h2>
              <p className="text-slate-500 mb-8">Almost there! Finalize your location and project address details.</p>
              <div className="space-y-6 bg-white p-6 rounded-2xl border border-slate-100 shadow-card">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Property Name / Society</label>
                  <input id="property-name" type="text" placeholder="e.g. Prestige Lakeside Unit 4B"
                    value={local.property_name} onChange={(e) => setLocal((s) => ({ ...s, property_name: e.target.value }))}
                    className="input w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-slate-800" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Pincode <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input id="pincode" type="text" placeholder="e.g. 560001"
                    value={local.pincode} onChange={(e) => setLocal((s) => ({ ...s, pincode: e.target.value }))}
                    className="input w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-slate-800" maxLength={6} />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">City</label>
                  <div className="grid grid-cols-3 gap-2">
                    {CITIES.map((city) => (
                      <button key={city} onClick={() => setLocal((s) => ({ ...s, city }))}
                        className={clsx('p-3 rounded-xl border-2 text-xs font-bold transition-all text-center',
                          local.city === city ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-black' : 'border-slate-200 text-slate-600 hover:border-indigo-300 bg-white')}>
                        {city}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-between mt-10">
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
            className="btn-ghost flex items-center gap-2 disabled:opacity-30">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep((s) => s + 1)} disabled={!canNext()}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 shadow-glow-indigo text-white flex items-center gap-1.5">
              Next <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={!canNext() || loading}
              className="btn-primary disabled:opacity-50 px-6 py-3 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 shadow-glow-indigo text-white flex items-center gap-1.5">
              {loading
                ? <div className="spinner w-5 h-5" />
                : <><Sparkles className="w-4 h-4 animate-pulse" /> Find Packages <ArrowRight className="w-4 h-4" /></>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
