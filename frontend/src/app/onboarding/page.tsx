'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useProjectStore } from '@/stores/projectStore'
import { useAuthStore } from '@/stores/authStore'
import { projectsAPI, catalogAPI, enterpriseAPI } from '@/lib/api'

import BhkSelector from '@/components/BhkSelector'
import Navbar from '@/components/Navbar'
import toast from 'react-hot-toast'
import { ArrowRight, ArrowLeft, CheckCircle2, Home, Sparkles, Wrench, Upload, FileText, Layout, Check, ShieldAlert } from 'lucide-react'
import clsx from 'clsx'
import { getColorHex, getColorFamily } from '@/lib/colorUtils'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const STYLE_OPTIONS = [
  { id: 'modern',              label: 'Modern',              emoji: '🔲', desc: 'Clean lines, neutral tones', img: `${BACKEND_URL}/static/pdfs/catalog/Sofa Set Warm Beige.png` },
  { id: 'scandinavian',        label: 'Scandinavian',        emoji: '🪵', desc: 'Light wood, cozy textures', img: `${BACKEND_URL}/static/pdfs/catalog/Sofa Set Emerald Green.png` },
  { id: 'indian_contemporary', label: 'Indian Contemporary', emoji: '🪔', desc: 'Warm tones, brass accents', img: `${BACKEND_URL}/static/pdfs/catalog/Master Bed Set Blush Pink.png` },
  { id: 'luxury',              label: 'Luxury',              emoji: '💎', desc: 'Marble, velvet, bespoke', img: `${BACKEND_URL}/static/pdfs/catalog/Master Bed Set Royal Navy Blue.png` },
  { id: 'mediterranean',       label: 'Mediterranean',       emoji: '🌊', desc: 'Arches, terracotta, sea palette', img: `${BACKEND_URL}/static/pdfs/catalog/Sofa Set Royal Navy Blue.png` },
  { id: 'boho',                label: 'Boho',                emoji: '🪴', desc: 'Rattan, macramé, warm amber', img: `${BACKEND_URL}/static/pdfs/catalog/Sofa Set Blush Pink.png` },
]

const MATERIAL_IMAGES: Record<string, string> = {
  'Oak Laminate': `${BACKEND_URL}/static/pdfs/catalog/wardrobes-warm_beige-oak-laminated-front_view.png`,
  'Teak Laminate': `${BACKEND_URL}/static/pdfs/catalog/wardrobes-golden_brown-teak-laminated-front_view.png`,
  'Walnut Laminate': `${BACKEND_URL}/static/pdfs/catalog/wardrobes-dark_brown-walnut-laminated-front_view.png`,
}

const FABRIC_OPTIONS = [
  { id: 'Linen', name: 'Linen', emoji: '🧵', desc: 'Breathable, natural, crisp texture.', img: `${BACKEND_URL}/static/pdfs/catalog/Accent Chair Warm Beige.png` },
  { id: 'Velvet', name: 'Velvet', emoji: '✨', desc: 'Plush, soft, rich plush texture.', img: `${BACKEND_URL}/static/pdfs/catalog/Sofa Set Blush Pink.png` },
  { id: 'Woven Fabric', name: 'Woven Fabric', emoji: '🪡', desc: 'Versatile woven upholstery fabric.', img: `${BACKEND_URL}/static/pdfs/catalog/Area Rug Blush Pink.png` },
  { id: 'Leatherette', name: 'Leatherette', emoji: '🛋️', desc: 'Sleek, spill-resistant leather finish.', img: `${BACKEND_URL}/static/pdfs/catalog/Sofa Set Charcoal Grey.png` },
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

const STEPS = [
  'Property Details',
  'Home Configuration',
  'Budget & Timeline',
  'Design Vibe',
  'Material & Fabric',
  'Colors'
]

export default function OnboardingPage() {
  const router = useRouter()
  const { setOnboarding } = useProjectStore()
  const { isLoggedIn } = useAuthStore()

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [availableColors, setAvailableColors] = useState<any>(null)
  const [availableMaterials, setAvailableMaterials] = useState<string[]>([])
  
  // B2B2C states
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [earliestStartDate, setEarliestStartDate] = useState<string | null>(null)
  const [isB2B2C, setIsB2B2C] = useState(false)
  const [childProjectId, setChildProjectId] = useState<string | null>(null)

  const [searches, setSearches] = useState<Record<string, string>>({
    Neutral: '',
    Earthy: '',
    'Luxury / Premium': '',
    Accent: ''
  })
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  const [local, setLocal] = useState({
    style_tags:          [] as string[],
    color_preferences:   [] as string[],
    bhk:                 '',
    budget:              '',
    timeline:            '',
    material_preference: '',
    interior_material_preference: '',
    fabric_preference:   '',
    furnishing_type:     '',
    city:                '',
    property_name:       '',
    pincode:             '',
  })

  // Parse inviteToken from URL (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const token = params.get('inviteToken')
      if (token) {
        setInviteToken(token)
        setIsB2B2C(true)
        
        enterpriseAPI.validateInvitation(token)
          .then(res => {
            const data = res.data
            setEarliestStartDate(data.earliest_start_date)
            setLocal(s => ({
              ...s,
              bhk: data.bhk_type || '2BHK',
              property_name: data.project_name || '',
              city: data.city || 'Bangalore',
              furnishing_type: data.furnishing_type || 'new',
              timeline: data.timeline || ''
            }))
            if (data.customer_project_id) {
              setChildProjectId(data.customer_project_id)
            }
            // Starts directly at Step 3 (Design Vibe)
            setStep(3)
          })
          .catch(err => {
            console.error("Invalid token details:", err)
            toast.error("Invalid or expired invitation token.")
            router.push('/login')
          })
      }
    }
  }, [router])

  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const res = await catalogAPI.materials()
        setAvailableMaterials(res.data)
      } catch (err) {
        console.error("Failed to load onboarding materials:", err)
        setAvailableMaterials(["Oak Laminate", "Teak Laminate", "Walnut Laminate"])
      }
    }
    fetchMaterials()
  }, [])

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
    fetchColors()
  }, [local.style_tags])

  if (!isLoggedIn) {
    if (typeof window !== 'undefined') router.push('/login')
    return null
  }

  // Calculate disabled timeline options based on parent earliest start date constraint
  const getDisabledTimelineOptions = () => {
    if (!earliestStartDate) return []
    try {
      const today = new Date()
      const [year, month, day] = earliestStartDate.split('-').map(Number)
      const targetDate = new Date(year, month - 1, day || 1)
      const diffMonths = (targetDate.getFullYear() - today.getFullYear()) * 12 + (targetDate.getMonth() - today.getMonth())
      
      const disabled: string[] = []
      if (diffMonths >= 1) disabled.push('1_month')
      if (diffMonths >= 3) disabled.push('3_months')
      if (diffMonths >= 6) disabled.push('6_months')
      return disabled
    } catch (e) {
      return []
    }
  }

  const disabledTimelines = getDisabledTimelineOptions()

  const toggleStyle = (id: string) => {
    setLocal((s) => ({
      ...s,
      style_tags: s.style_tags.includes(id)
        ? s.style_tags.filter((x) => x !== id)
        : [...s.style_tags, id],
    }))
  }

  const canNext = () => {
    if (step === 0) return !!local.city && !!local.property_name
    if (step === 1) return !!local.bhk && !!local.furnishing_type
    if (step === 2) return !!local.budget && !!local.timeline && !!local.material_preference
    if (step === 3) return local.style_tags.length > 0
    if (step === 4) return !!local.interior_material_preference && !!local.fabric_preference
    if (step === 5) return local.color_preferences.length > 0
    return false
  }

  const handleNext = () => {
    if (step === 0) {
      if (local.pincode && (local.pincode.length !== 6 || !/^\d+$/.test(local.pincode))) {
        toast.error("Pincode must be a 6-digit number.")
        return
      }
    }
    setStep((s) => s + 1)
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const budgetObj = BUDGET_RANGES.find((b) => b.id === local.budget)
      
      if (isB2B2C && childProjectId) {
        // B2B2C onboarding submission
        await enterpriseAPI.updateOnboarding(childProjectId, {
          budget: budgetObj?.max || 1000000,
          material_preference: local.material_preference,
          style_tags: local.style_tags,
          interior_material_preference: local.interior_material_preference,
          fabric_preference: local.fabric_preference,
          color_preferences: local.color_preferences
        })

        setOnboarding({
          bhk: local.bhk,
          style_tags: local.style_tags,
          interior_material_preference: local.interior_material_preference,
          color_preferences: local.color_preferences,
          budget: budgetObj?.max,
          city: local.city,
        })

        toast.success('Preferences saved successfully! 🎉')
        // B2B2C Customer skips floor plan selector and goes straight to catalog
        router.push(`/packages?projectId=${childProjectId}&bhk=${local.bhk}&budget=${budgetObj?.max || 1000000}&style=${local.style_tags.join(',')}`)
      } else {
        // Standard B2C onboarding creation
        const res = await projectsAPI.create({
          bhk_type: local.bhk,
          property_name: local.property_name,
          city: local.city,
          budget: budgetObj?.max || 1000000,
          material_preference: local.material_preference,
          interior_material_preference: local.interior_material_preference,
          furnishing_type: local.furnishing_type,
          pincode: local.pincode || undefined,
          floor_plan_type: 'select',
          floor_plan_name: 'Standard 2D Layout Plan',
          color_preferences: local.color_preferences,
        })

        const createdProjId = res.data.project_id
        setOnboarding({
          bhk: local.bhk,
          style_tags: local.style_tags,
          interior_material_preference: local.interior_material_preference,
          color_preferences: local.color_preferences,
          budget: budgetObj?.max,
          city: local.city,
        })

        toast.success("Welcome details saved! Let's choose your pricing package. 📦")
        // B2C Customer goes straight to packages selection page
        router.push(`/packages?projectId=${createdProjId}&bhk=${local.bhk}&budget=${budgetObj?.max || 1000000}&style=${local.style_tags.join(',')}`)
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to submit onboarding details')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 pt-28 pb-16">

        {/* Progress Timeline */}
        <div className="flex items-center justify-between mb-10 px-1 border-b border-slate-200 pb-5 overflow-hidden">
          {STEPS.map((s, i) => {
            // In B2B2C, step 0 and 1 are preset and skipped, so mark them as complete
            const isCompleted = isB2B2C ? (i < step || i < 2) : (i < step)
            const isActive = i === step
            
            // Do not show step 0 and 1 in B2B2C progress bar to avoid confusing customer
            if (isB2B2C && i < 2) return null;

            return (
              <div key={s} className={clsx("flex items-center flex-1 justify-center", i === STEPS.length - 1 ? "flex-none" : "")}>
                <div className="flex items-center gap-1 md:gap-1.5 flex-shrink-0">
                  <div className={clsx(
                    'w-6 h-6 md:w-8 h-8 rounded-full flex items-center justify-center text-[10px] md:text-sm font-bold transition-all flex-shrink-0',
                    isCompleted ? 'bg-indigo-600 text-white' :
                    isActive ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' :
                    'bg-slate-200 text-slate-400'
                  )}>
                    {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : (isB2B2C ? i - 1 : i + 1)}
                  </div>
                  <span className={clsx('text-[9px] md:text-xs font-bold leading-none hidden xs:inline', (i <= step || isCompleted) ? 'text-indigo-700' : 'text-slate-400')}>
                    {s}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={clsx('flex-1 h-[2px] mx-2 md:mx-4 min-w-[12px]', isCompleted ? 'bg-indigo-600' : 'bg-slate-200')} />
                )}
              </div>
            )
          })}
        </div>

        <AnimatePresence mode="wait">

          {/* Step 0: Property Details */}
          {step === 0 && (
            <motion.div key="details" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <h2 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Property Details</h2>
              <p className="text-slate-500 mb-8">Let's locate your property to customize delivery constraints.</p>
              <div className="space-y-6 bg-white p-6 rounded-2xl border border-slate-100 shadow-card">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Property Name / Society</label>
                  <input id="property-name" type="text" placeholder="e.g. Prestige Lakeside Unit 4B"
                    value={local.property_name} onChange={(e) => setLocal((s) => ({ ...s, property_name: e.target.value }))}
                    className="input w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-slate-800 outline-none" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Pincode <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input id="pincode" type="text" placeholder="e.g. 560001"
                    value={local.pincode} onChange={(e) => { const numericVal = e.target.value.replace(/\D/g, ''); setLocal((s) => ({ ...s, pincode: numericVal })); }}
                    className="input w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-slate-800 outline-none" maxLength={6} />
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

          {/* Step 1: Preferences + Home Configuration */}
          {step === 1 && (
            <motion.div key="bhk" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-8">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Scope & Home Configuration</h2>
                <p className="text-slate-500 mb-6">Select your BHK structure and project type. We'll automatically set up rooms for rendering.</p>
                <BhkSelector selected={local.bhk} onSelect={(bhk) => setLocal((s) => ({ ...s, bhk }))} />
              </div>

              <div>
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3.5">Scope of Furnishing</div>
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

          {/* Step 2: Budget & Timeline */}
          {step === 2 && (
            <motion.div key="budget" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-6">
              <h2 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Budget & Timeline</h2>
              <p className="text-slate-500 mb-4">Helps us curate package price tiers aligned with your preference.</p>

              {/* Show date availability banner for B2B2C */}
              {isB2B2C && earliestStartDate && (
                <div className="flex gap-3 bg-indigo-50 border border-indigo-150 p-4 rounded-xl text-indigo-900 text-xs font-semibold items-start leading-relaxed shadow-sm">
                  <ShieldAlert className="w-4 h-4 mt-0.5 text-indigo-700 flex-shrink-0" />
                  <div>
                    <span>Project Readiness Constraint: The property <strong>{local.property_name}</strong> will be available for modular interior execution starting from <strong>{earliestStartDate}</strong>. Timeline selections are constrained accordingly.</span>
                  </div>
                </div>
              )}

              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-card">
                <div className="text-xs font-bold text-slate-700 mb-3.5 uppercase tracking-wider">Total Interior Budget</div>
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
                <div className="text-xs font-bold text-slate-700 mb-3.5 uppercase tracking-wider">Material Quality Preference</div>
                <div className="grid grid-cols-3 gap-4">
                  {MATERIAL_OPTIONS.map((m) => (
                    <button key={m.id} onClick={() => setLocal((s) => ({ ...s, material_preference: m.id }))}
                      className={clsx('p-4 rounded-2xl border-2 text-center transition-all bg-white card-hover',
                        local.material_preference === m.id ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 hover:border-indigo-300')}>
                      <div className="text-2xl mb-1">{m.emoji}</div>
                      <div className="font-bold text-slate-800 text-xs">{m.label}</div>
                      <div className="text-[10px] text-slate-500 mt-1 leading-tight">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-card">
                <div className="text-xs font-bold text-slate-700 mb-3.5 uppercase tracking-wider">When do you want to start?</div>
                <div className="grid grid-cols-2 gap-3">
                  {TIMELINE_OPTIONS.map((t) => {
                    const isChoiceDisabled = disabledTimelines.includes(t.id)
                    return (
                      <button
                        key={t.id}
                        disabled={isChoiceDisabled}
                        onClick={() => {
                          if (!isChoiceDisabled) {
                            setLocal((s) => ({ ...s, timeline: t.id }))
                          }
                        }}
                        className={clsx(
                          'p-3.5 rounded-xl border-2 text-sm font-bold transition-all relative',
                          local.timeline === t.id && !isChoiceDisabled ? 'border-indigo-500 bg-indigo-50 text-indigo-700' :
                          isChoiceDisabled ? 'border-slate-100 bg-slate-50 text-slate-350 cursor-not-allowed opacity-40' :
                          'border-slate-200 text-slate-600 hover:border-indigo-300 bg-white'
                        )}
                      >
                        <span>{t.label}</span>
                        {isChoiceDisabled && (
                          <span className="block text-[8px] font-medium text-slate-400 mt-0.5">Unavailable before readiness date</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Design Vibe */}
          {step === 3 && (
            <motion.div key="style" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <h2 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">What's your design vibe?</h2>
              <p className="text-slate-500 mb-8">Select one or more interior styles. Visual representations guide our design engine.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {STYLE_OPTIONS.map((opt) => {
                  const isSelected = local.style_tags.includes(opt.id)
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleStyle(opt.id)}
                      className={clsx(
                        'group rounded-2xl border-2 bg-white overflow-hidden text-left transition-all duration-200 shadow-sm hover:shadow-md flex flex-col h-full relative',
                        isSelected
                          ? 'border-indigo-650 ring-1 ring-indigo-650'
                          : 'border-slate-200 hover:border-indigo-300'
                      )}
                    >
                      <div className="h-44 w-full overflow-hidden relative bg-slate-100 flex-shrink-0">
                       <img
                          src={opt.img}
                          alt={opt.label}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        {isSelected && (
                          <div className="absolute top-3 right-3 bg-indigo-600 text-white rounded-full p-1 shadow-md z-10">
                            <Check className="w-4 h-4 stroke-[3px]" />
                          </div>
                        )}
                      </div>
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="font-extrabold text-slate-900 text-base">{opt.label}</div>
                          <div className="text-xs text-slate-500 mt-1 leading-relaxed">{opt.desc}</div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* Step 4: Material & Fabric Preferences */}
          {step === 4 && (
            <motion.div key="material-pref" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-8">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Material & Fabric Preferences</h2>
                <p className="text-slate-500 mb-6">Select your preferred interior wood laminate finish and upholstery fabric texture.</p>
                
                <h3 className="text-xs font-extrabold text-indigo-700 uppercase tracking-wider mb-3">🪵 INTERIOR WOOD LAMINATE FINISH</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {(availableMaterials.length > 0 ? availableMaterials : ['Oak Laminate', 'Teak Laminate', 'Walnut Laminate']).map((m) => {
                    const descriptions: Record<string, string> = {
                      'Oak Laminate': 'Light, modern, and warm wood grain finish.',
                      'Teak Laminate': 'Classic golden-brown look with rich textures.',
                      'Walnut Laminate': 'Deep, dark, and sophisticated premium finish.'
                    }
                    const imageUrl = MATERIAL_IMAGES[m] || `${BACKEND_URL}/static/pdfs/catalog/wardrobes-warm_beige-oak-laminated-front_view.png`
                    const isSelected = local.interior_material_preference === m
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setLocal((s) => ({ ...s, interior_material_preference: m }))}
                        className={clsx(
                          'group rounded-2xl border-2 bg-white overflow-hidden text-left transition-all duration-200 shadow-sm hover:shadow-md flex flex-col h-full relative',
                          isSelected
                            ? 'border-indigo-650 ring-1 ring-indigo-650'
                            : 'border-slate-200 hover:border-indigo-300'
                        )}
                      >
                        <div className="h-36 w-full overflow-hidden relative bg-slate-100 flex-shrink-0">
                          <img
                            src={imageUrl}
                            alt={m}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          {isSelected && (
                            <div className="absolute top-3 right-3 bg-indigo-600 text-white rounded-full p-1 shadow-md z-10">
                              <Check className="w-3.5 h-3.5 stroke-[3px]" />
                            </div>
                          )}
                        </div>
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="font-extrabold text-slate-800 text-sm">{m}</div>
                            <div className="text-xs text-slate-500 mt-1 leading-relaxed">{descriptions[m] || 'Premium interior wood laminate.'}</div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-extrabold text-indigo-700 uppercase tracking-wider mb-3">🪡 UPHOLSTERY & FABRIC PREFERENCE</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                  {FABRIC_OPTIONS.map((f) => {
                    const isSelected = local.fabric_preference === f.name
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setLocal((s) => ({ ...s, fabric_preference: f.name }))}
                        className={clsx(
                          'group rounded-2xl border-2 bg-white overflow-hidden text-left transition-all duration-200 shadow-sm hover:shadow-md flex flex-col h-full relative',
                          isSelected
                            ? 'border-indigo-650 ring-1 ring-indigo-650'
                            : 'border-slate-200 hover:border-indigo-300'
                        )}
                      >
                        <div className="h-32 w-full overflow-hidden relative bg-slate-100 flex-shrink-0">
                          <img
                            src={f.img}
                            alt={f.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          {isSelected && (
                            <div className="absolute top-3 right-3 bg-indigo-600 text-white rounded-full p-1 shadow-md z-10">
                              <Check className="w-3.5 h-3.5 stroke-[3px]" />
                            </div>
                          )}
                        </div>
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="font-extrabold text-slate-800 text-sm">{f.name}</div>
                            <div className="text-xs text-slate-500 mt-1 leading-normal">{f.desc}</div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 5: Colors */}
          {step === 5 && !availableColors && (
            <div className="text-center py-20">
              <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-500 text-sm">Loading color preferences catalog...</p>
            </div>
          )}

          {step === 5 && availableColors && (() => {
            const categoriesNames = ["Neutral", "Earthy", "Luxury / Premium", "Accent"];

            return (
              <motion.div key="colors" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-6">
                <div className="text-center max-w-lg mx-auto">
                  <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-1.5 tracking-tight">Smart Color Explorer</h2>
                  <p className="text-slate-500 text-xs md:text-sm">Personalise your home by choosing color families. Commonly selected colors appear first based on popularity.</p>
                </div>

                {/* Recommended */}
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
                                : "border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-slate-50"
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

                {/* Categories Grid */}
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

                          <div className="flex gap-4 overflow-x-auto py-3 px-1 scrollbar-hide select-none max-w-full">
                            {displayColors.length === 0 ? (
                              <p className="text-[10px] text-slate-400 italic py-2">No matching colors found</p>
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
                                        "hover:scale-110 active:scale-95",
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

                {/* Selected Swatches list */}
                <div className="bg-slate-100/50 p-4 rounded-xl border border-slate-200/60 max-w-lg mx-auto">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">Selected Colors</h3>
                  {local.color_preferences.length === 0 ? (
                    <p className="text-xs text-slate-450 italic">No colors selected yet. Pick swatches from the categories above.</p>
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

                {/* Color overlay dialog */}
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
                        </div>

                        <div className="mb-3.5">
                          <input
                            type="text"
                            placeholder={`Search all ${catName} colors...`}
                            value={searchVal}
                            onChange={e => setSearches(s => ({ ...s, [catName]: e.target.value }))}
                            className="w-full text-xs border border-slate-200 rounded-lg p-2 font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50"
                          />
                        </div>

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
                                        active ? "border-indigo-600 ring-2 ring-indigo-500 shadow-md scale-105" : "border-slate-300"
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
                                    <span className="text-[9px] font-bold text-slate-500 mt-1 truncate max-w-full text-center">
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

        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-between mt-10">
          <button 
            onClick={() => setStep((s) => Math.max(0, s - 1))} 
            disabled={step === 0 || (isB2B2C && step === 2)}
            className="btn-ghost flex items-center gap-2 disabled:opacity-30"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          {step < STEPS.length - 1 ? (
            <button onClick={handleNext} disabled={!canNext()}
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
