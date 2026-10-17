'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useProjectStore } from '@/stores/projectStore'
import { useAuthStore } from '@/stores/authStore'
import { projectsAPI, catalogAPI, enterpriseAPI, customerAPI } from '@/lib/api'

import BhkSelector from '@/components/BhkSelector'
import Navbar from '@/components/Navbar'
import toast from 'react-hot-toast'
import {
  ArrowRight, ArrowLeft, CheckCircle2, Home, Sparkles, Wrench,
  Layout, Check, ShieldAlert, Maximize2, X
} from 'lucide-react'
import clsx from 'clsx'
import { getColorHex } from '@/lib/colorUtils'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const STYLE_OPTIONS = [
  { id: 'modern',            label: 'Modern',            emoji: '🔲', desc: 'Clean lines, neutral tones, architectural balance', img: '/images/design_vibe/Modern.webp' },
  { id: 'scandinavian',      label: 'Scandinavian',      emoji: '🪵', desc: 'Light wood, cozy bouclé textures, airy hygge', img: '/images/design_vibe/Scandinavian.webp' },
  { id: 'japandi',           label: 'Japandi',           emoji: '🎋', desc: 'Wabi-sabi minimalism, blonde oak, calm organic serenity', img: '/images/design_vibe/Japandi.webp' },
  { id: 'indo_minimalistic', label: 'Indo-Minimalistic', emoji: '🪔', desc: 'Warm limewash, handcrafted teak joinery, understated brass accents', img: '/images/design_vibe/Indo_Minimalistic.webp' },
]

const MATERIAL_IMAGES: Record<string, string> = {
  'Oak Laminate': `${BACKEND_URL}/static/assets/catalog/wardrobes-warm_beige-oak-laminated-front_view.webp`,
  'Teak Laminate': `${BACKEND_URL}/static/assets/catalog/wardrobes-golden_brown-teak-laminated-front_view.webp`,
  'Walnut Laminate': `${BACKEND_URL}/static/assets/catalog/wardrobes-dark_brown-walnut-laminated-front_view.webp`,
}

const FABRIC_OPTIONS = [
  { id: 'Linen', name: 'Linen', emoji: '🧵', desc: 'Breathable, natural, crisp texture.', img: `${BACKEND_URL}/static/assets/catalog/fabric_preference/Linen.webp` },
  { id: 'Velvet', name: 'Velvet', emoji: '✨', desc: 'Plush, soft, rich plush texture.', img: `${BACKEND_URL}/static/assets/catalog/fabric_preference/Velvet.webp` },
  { id: 'Woven Fabric', name: 'Woven Fabric', emoji: '🪡', desc: 'Versatile woven upholstery fabric.', img: `${BACKEND_URL}/static/assets/catalog/fabric_preference/Woven Fabric.webp` },
  { id: 'Leatherette', name: 'Leatherette', emoji: '🛋️', desc: 'Sleek, spill-resistant leather finish.', img: `${BACKEND_URL}/static/assets/catalog/fabric_preference/Leatherette.webp` },
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

const FURNISHING_OPTIONS = [
  { id: 'new',     label: 'New Home',    desc: 'Moving into a new property', icon: Home },
  { id: 'upgrade', label: 'Upgrading',   desc: 'Renovating an existing space', icon: Wrench },
]

const DEFAULT_CITIES = ['Panjim', 'Margao', 'Vasco', 'Mapusa', 'Ponda', 'Bangalore', 'Mumbai', 'Pune', 'Chennai']

const STEPS = [
  'Property Details',
  'Home Configuration',
  'Budget & Timeline',
  'Design Vibe',
  'Material & Fabric',
  'Colors'
]

const S_PROPERTY = 0
const S_CONFIG   = 1
const S_BUDGET   = 2
const S_VIBE     = 3
const S_MATERIAL = 4
const S_COLORS   = 5

const FALLBACK_COLORS = [
  'White', 'Beige', 'Cream', 'Grey', 'Off White',
  'Walnut', 'Oak', 'Teak', 'Terracotta', 'Warm Honey',
  'Charcoal', 'Champagne Gold', 'Sage Green', 'Navy Blue', 'Burnt Orange'
]

const STEP_BACKGROUNDS: Record<number, string> = {
  0: '/images/onboarding/step_property.webp',
  1: '/images/onboarding/step_config.webp',
  2: '/images/onboarding/step_budget.webp',
  3: '/images/onboarding/step_vibe.webp',
  4: '/images/onboarding/step_material.webp',
  5: '/images/onboarding/step_colors.webp',
}

export default function OnboardingPage() {
  const router = useRouter()
  const { setOnboarding } = useProjectStore()
  const { isLoggedIn } = useAuthStore()

  const [step, setStep] = useState(0)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  const [loading, setLoading] = useState(false)
  const [availableColors, setAvailableColors] = useState<any>(null)
  const [availableMaterials, setAvailableMaterials] = useState<string[]>([])

  // B2B2C states
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [earliestStartDate, setEarliestStartDate] = useState<string | null>(null)
  const [isB2B2C, setIsB2B2C] = useState(false)
  const [childProjectId, setChildProjectId] = useState<string | null>(null)

  // Architectural Floor Plans (Integrated into Step 1)
  const [typologies, setTypologies] = useState<any[]>([])
  const [typologyLoading, setTypologyLoading] = useState(false)
  const [lightboxPlan, setLightboxPlan] = useState<any | null>(null)

  const [local, setLocal] = useState({
    typology_id:                 '',
    style_tags:                  [] as string[],
    color_preferences:           [] as string[],
    bhk:                         '',
    budget:                      '',
    timeline:                    '',
    material_preference:         'standard',
    interior_material_preference: '',
    fabric_preference:           '',
    furnishing_type:             '',
    city:                        '',
    property_name:               '',
    pincode:                     '',
  })

  // Postal PIN code auto-lookup and dynamic recent cities states
  const [pincodeLoading, setPincodeLoading] = useState(false)
  const [discoveredCities, setDiscoveredCities] = useState<string[]>([])
  const [isCustomCity, setIsCustomCity] = useState(false)
  const [recentCities, setRecentCities] = useState<string[]>(DEFAULT_CITIES)

  // Load recently searched/selected cities from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('recent_cities_searched')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRecentCities(parsed)
          }
        }
      } catch (e) {
        console.warn('Failed to parse recent cities from storage', e)
      }
    }
  }, [])

  const addRecentCity = (cityName: string) => {
    if (!cityName || !cityName.trim()) return
    const trimmed = cityName.trim()
    setRecentCities((prev) => {
      const updated = [trimmed, ...prev.filter((c) => c.toLowerCase() !== trimmed.toLowerCase())].slice(0, 9)
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('recent_cities_searched', JSON.stringify(updated))
        }
      } catch (e) {
        console.warn('Failed to save recent cities', e)
      }
      return updated
    })
  }

  // India Postal PIN code auto-lookup (Option 1)
  useEffect(() => {
    if (local.pincode && local.pincode.length === 6) {
      let isMounted = true
      setPincodeLoading(true)
      fetch(`https://api.postalpincode.in/pincode/${local.pincode}`)
        .then(res => res.json())
        .then(data => {
          if (!isMounted) return
          setPincodeLoading(false)
          if (Array.isArray(data) && data[0]?.Status === 'Success' && Array.isArray(data[0]?.PostOffice)) {
            const names: string[] = []
            data[0].PostOffice.forEach((po: any) => {
              if (po.Name && !names.includes(po.Name)) names.push(po.Name)
              if (po.District && !names.includes(po.District)) names.push(po.District)
            })
            if (names.length > 0) {
              setDiscoveredCities(names)
              // Auto-select first discovered district or office if city not set or not in list
              if (!local.city || !names.includes(local.city)) {
                const autoPick = data[0].PostOffice[0]?.District || names[0]
                setLocal(s => ({ ...s, city: autoPick }))
                addRecentCity(autoPick)
              }
              toast.success(`Found ${names.length} postal zones for ${local.pincode}`)
            }
          }
        })
        .catch(err => {
          if (!isMounted) return
          setPincodeLoading(false)
          console.warn('Pincode lookup offline/unavailable:', err)
        })
      return () => { isMounted = false }
    } else {
      setDiscoveredCities([])
    }
  }, [local.pincode])

  // Parse inviteToken or projectId from URL (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const token = params.get('inviteToken')
      const pid = params.get('projectId')

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
              city: data.city || 'Panjim',
              furnishing_type: data.furnishing_type || 'new',
              timeline: data.timeline || '',
              typology_id: data.typology_id || s.typology_id,
            }))
            if (data.customer_project_id) {
              setChildProjectId(data.customer_project_id)
            }
            // For enterprise invited buyers, steps 0-2 are locked; start at Design Vibe
            setStep(S_VIBE)
          })
          .catch(err => {
            console.error("Invalid token details:", err)
            toast.error("Invalid or expired invitation token.")
            router.push('/login')
          })
      } else if (pid) {
        projectsAPI.get(pid).then((res) => {
          const p = res.data
          setChildProjectId(p.id)
          const isEnt = !!p.parent_project_id || !!p.flat_id
          setIsB2B2C(isEnt)

          let budgetId = '1000000'
          if (p.budget) {
            const foundRange = BUDGET_RANGES.find(b => p.budget >= b.min && p.budget <= b.max)
            if (foundRange) budgetId = foundRange.id
          }

          setLocal(s => ({
            ...s,
            bhk: p.bhk_type || s.bhk,
            property_name: p.property_name || s.property_name,
            city: p.city || s.city,
            budget: budgetId,
            timeline: p.timeline || s.timeline,
            material_preference: p.material_preference || 'standard',
            interior_material_preference: p.interior_material_preference || s.interior_material_preference,
            fabric_preference: p.fabric_preference || s.fabric_preference,
            color_preferences: p.color_preferences || s.color_preferences,
            style_tags: p.style_tags || s.style_tags,
            typology_id: p.typology_id || s.typology_id,
          }))

          if (isEnt) {
            if (!p.style_tags || p.style_tags.length === 0) setStep(S_VIBE)
            else if (!p.interior_material_preference) setStep(S_MATERIAL)
            else if (!p.color_preferences || p.color_preferences.length === 0) setStep(S_COLORS)
            else router.push(`/packages?projectId=${p.id}&bhk=${p.bhk_type || '2BHK'}&budget=${p.budget || 1000000}`)
          } else {
            if (!p.property_name) setStep(S_PROPERTY)
            else if (!p.bhk_type || !p.typology_id) setStep(S_CONFIG)
            else if (!p.budget) setStep(S_BUDGET)
            else if (!p.style_tags || p.style_tags.length === 0) setStep(S_VIBE)
            else if (!p.interior_material_preference) setStep(S_MATERIAL)
            else if (!p.color_preferences || p.color_preferences.length === 0) setStep(S_COLORS)
            else router.push(`/packages?projectId=${p.id}&bhk=${p.bhk_type || '2BHK'}&budget=${p.budget || 1000000}`)
          }
        }).catch(err => {
          console.error("Failed to load project for onboarding resume:", err)
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

  // Fetch typologies automatically whenever BHK changes
  useEffect(() => {
    if (!local.bhk) {
      setTypologies([])
      return
    }
    let cancelled = false
    setTypologyLoading(true)
    customerAPI
      .listTypologies({ bhk: local.bhk, projectId: childProjectId || undefined })
      .then((res) => {
        if (cancelled) return
        const list = res.data?.typologies || []
        setTypologies(list)
        const already = res.data?.selected?.id
        if (already && list.some((t: any) => t.id === already)) {
          setLocal((s) => (s.typology_id ? s : { ...s, typology_id: already }))
        }
      })
      .catch(() => { if (!cancelled) setTypologies([]) })
      .finally(() => { if (!cancelled) setTypologyLoading(false) })
    return () => { cancelled = true }
  }, [local.bhk, childProjectId])

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
      // Single-select vibe: clicking same deselects; clicking another replaces selection
      style_tags: s.style_tags.includes(id) ? [] : [id],
    }))
  }

  const saveTypology = async (typologyId: string | null) => {
    if (!childProjectId || !typologyId) return
    try {
      await customerAPI.setProjectTypology(childProjectId, typologyId)
    } catch (err) {
      console.error('Could not save the chosen layout:', err)
    }
  }

  const canNext = () => {
    if (step === S_PROPERTY) return !!local.city && !!local.property_name
    // Scope & Config: BHK, Furnishing Type, and exactly one Floor Plan selected
    if (step === S_CONFIG)   return !!local.bhk && !!local.furnishing_type && !!local.typology_id
    if (step === S_BUDGET)   return !!local.budget && !!local.timeline
    if (step === S_VIBE)     return local.style_tags.length > 0
    if (step === S_MATERIAL) return !!local.interior_material_preference && !!local.fabric_preference
    if (step === S_COLORS)   return local.color_preferences.length > 0
    return false
  }

  const handleNext = () => {
    if (step === S_PROPERTY) {
      if (local.pincode && (local.pincode.length !== 6 || !/^\d+$/.test(local.pincode))) {
        toast.error("Pincode must be a 6-digit number.")
        return
      }
      if (local.city) {
        addRecentCity(local.city)
      }
    }

    const currentStep = step
    // Optimistic immediate transition for 0ms perceptible latency
    setStep((s) => s + 1)

    // Direct B2C: Auto-create draft project at Step 1 if not created yet
    if (!isB2B2C && currentStep === S_CONFIG && !childProjectId) {
      (async () => {
        try {
          const budgetObj = BUDGET_RANGES.find((b) => b.id === local.budget)
          const res = await projectsAPI.create({
            bhk_type: local.bhk,
            property_name: local.property_name,
            city: local.city,
            budget: budgetObj?.max || 1000000,
            furnishing_type: local.furnishing_type,
            pincode: local.pincode || undefined,
            status: 'onboarding'
          })
          const newPid = res.data.project_id
          setChildProjectId(newPid)
          if (local.typology_id && newPid) {
            try {
              await customerAPI.setProjectTypology(newPid, local.typology_id)
            } catch (planErr) {
              console.error("Failed to associate floor plan layout:", planErr)
            }
          }
        } catch (err) {
          console.error("Failed to auto-create draft project at Step 1:", err)
        }
      })()
    } else if (childProjectId && !isB2B2C) {
      // Auto-update project fields on step advance in background
      (async () => {
        try {
          const budgetObj = BUDGET_RANGES.find((b) => b.id === local.budget)
          await projectsAPI.update(childProjectId, {
            bhk_type: local.bhk,
            property_name: local.property_name,
            city: local.city,
            budget: budgetObj?.max,
            material_preference: local.material_preference,
            interior_material_preference: local.interior_material_preference,
            fabric_preference: local.fabric_preference,
            furnishing_type: local.furnishing_type,
            style_tags: local.style_tags,
            color_preferences: local.color_preferences
          })
          if (currentStep === S_CONFIG && local.typology_id) {
            await saveTypology(local.typology_id)
          }
        } catch (err) {
          console.error("Failed to update draft project step:", err)
        }
      })()
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const budgetObj = BUDGET_RANGES.find((b) => b.id === local.budget)

      if (isB2B2C && childProjectId) {
        await enterpriseAPI.updateOnboarding(childProjectId, {
          budget: budgetObj?.max || 1000000,
          material_preference: local.material_preference,
          style_tags: local.style_tags,
          interior_material_preference: local.interior_material_preference,
          fabric_preference: local.fabric_preference,
          color_preferences: local.color_preferences
        })

        if (local.typology_id) {
          await saveTypology(local.typology_id)
        }

        setOnboarding({
          bhk: local.bhk,
          style_tags: local.style_tags,
          interior_material_preference: local.interior_material_preference,
          color_preferences: local.color_preferences,
          budget: budgetObj?.max,
          city: local.city,
        })

        toast.success('Preferences saved successfully! 🎉')
        router.push(`/packages?projectId=${childProjectId}&bhk=${local.bhk}&budget=${budgetObj?.max || 1000000}&style=${local.style_tags.join(',')}`)
      } else if (childProjectId) {
        await projectsAPI.update(childProjectId, {
          bhk_type: local.bhk,
          property_name: local.property_name,
          city: local.city,
          budget: budgetObj?.max || 1000000,
          material_preference: local.material_preference,
          interior_material_preference: local.interior_material_preference,
          fabric_preference: local.fabric_preference,
          furnishing_type: local.furnishing_type,
          pincode: local.pincode || undefined,
          style_tags: local.style_tags,
          color_preferences: local.color_preferences,
        })

        if (local.typology_id) {
          await saveTypology(local.typology_id)
        }

        setOnboarding({
          bhk: local.bhk,
          style_tags: local.style_tags,
          interior_material_preference: local.interior_material_preference,
          color_preferences: local.color_preferences,
          budget: budgetObj?.max,
          city: local.city,
        })

        toast.success("Home preferences finalized! Loading your curated packages. 🛋️")
        router.push(`/packages?projectId=${childProjectId}&bhk=${local.bhk}&budget=${budgetObj?.max || 1000000}&style=${local.style_tags.join(',')}`)
      } else {
        const res = await projectsAPI.create({
          bhk_type: local.bhk,
          property_name: local.property_name,
          city: local.city,
          budget: budgetObj?.max || 1000000,
          material_preference: local.material_preference,
          interior_material_preference: local.interior_material_preference,
          fabric_preference: local.fabric_preference,
          style_tags: local.style_tags,
          furnishing_type: local.furnishing_type,
          pincode: local.pincode || undefined,
          color_preferences: local.color_preferences,
        })

        const createdProjId = res.data.project_id
        if (local.typology_id && createdProjId) {
          await customerAPI.setProjectTypology(createdProjId, local.typology_id)
        }

        setOnboarding({
          bhk: local.bhk,
          style_tags: local.style_tags,
          interior_material_preference: local.interior_material_preference,
          color_preferences: local.color_preferences,
          budget: budgetObj?.max,
          city: local.city,
        })

        toast.success("Home preferences finalized! Loading your curated packages. 🛋️")
        router.push(`/packages?projectId=${createdProjId}&bhk=${local.bhk}&budget=${budgetObj?.max || 1000000}&style=${local.style_tags.join(',')}`)
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to submit onboarding details')
    } finally {
      setLoading(false)
    }
  }

  // Extract all unique color swatches from categories
  const allAvailableColors: string[] = availableColors ? (
    Array.from(new Set([
      ...(availableColors.recommended || []),
      ...Object.values(availableColors.categories || {}).flat().map((c: any) => typeof c === 'string' ? c : c?.name)
    ])).filter(Boolean) as string[]
  ) : FALLBACK_COLORS

  const selectedVibeLabel = local.style_tags[0]
    ? STYLE_OPTIONS.find(o => o.id === local.style_tags[0])?.label
    : 'All Styles'

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#FAF7F2]">
      <Navbar />

      {/* Full-bleed cross-fading architectural background images */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.img
            key={step}
            src={STEP_BACKGROUNDS[step] || STEP_BACKGROUNDS[0]}
            alt="Architectural space background"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 0.78, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="w-full h-full object-cover"
          />
        </AnimatePresence>
      </div>

      {/* Light Morning-Sun Scrim Overlay (Lightened to 15-20% for 80% background visibility) */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-br from-[#FAF7F2]/25 via-[#F5EDE2]/20 to-[#FAF7F2]/30 backdrop-blur-[0.5px]" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 pt-28 pb-16">
        <div className="backdrop-blur-xl bg-white/90 sm:bg-white/92 border border-white/80 shadow-2xl shadow-stone-900/10 rounded-3xl p-6 sm:p-10">

        {/* Progress Timeline */}
        <div className="flex items-center justify-between mb-10 px-1 border-b border-stone-200 pb-5 overflow-hidden">
          {STEPS.map((s, i) => {
            const isCompleted = isB2B2C ? (i < step || i < 2) : (i < step)
            const isActive = i === step

            if (isB2B2C && i < 2) return null

            return (
              <div key={s} className={clsx("flex items-center flex-1 justify-center", i === STEPS.length - 1 ? "flex-none" : "")}>
                <div className="flex items-center gap-1 md:gap-1.5 flex-shrink-0">
                  <div className={clsx(
                    'w-6 h-6 md:w-8 h-8 rounded-full flex items-center justify-center text-[10px] md:text-sm font-bold transition-all flex-shrink-0',
                    isCompleted ? 'bg-[#4e5b4b] text-white' :
                    isActive ? 'bg-[#b85d3b] text-white ring-4 ring-[#faeae3]' :
                    'bg-stone-200 text-stone-500'
                  )}>
                    {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : (isB2B2C ? i - 1 : i + 1)}
                  </div>
                  <span className={clsx('text-[9px] md:text-xs font-bold leading-none hidden xs:inline', (i <= step || isCompleted) ? 'text-[#b85d3b]' : 'text-stone-400')}>
                    {s}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={clsx('flex-1 h-[2px] mx-2 md:mx-4 min-w-[12px]', isCompleted ? 'bg-[#4e5b4b]' : 'bg-stone-200')} />
                )}
              </div>
            )
          })}
        </div>

        <AnimatePresence mode="wait">

          {/* Step 0: Property Details */}
          {step === S_PROPERTY && (
            <motion.div key="details" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <h2 className="text-3xl font-extrabold text-stone-900 mb-2 tracking-tight font-serif">Property Details</h2>
              <p className="text-stone-600 mb-8">Let's locate your property to customize modular delivery and logistics constraints.</p>
              <div className="space-y-6 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-card">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">Property Name</label>
                  <input id="property-name" type="text" placeholder="e.g. Prestige Lakeside"
                    value={local.property_name} onChange={(e) => setLocal((s) => ({ ...s, property_name: e.target.value }))}
                    className="input w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-[#b85d3b] focus:ring-1 focus:ring-[#b85d3b] transition-all font-medium text-stone-800 outline-none" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                      Pincode
                    </label>
                    {pincodeLoading && (
                      <span className="text-[11px] font-semibold text-[#b85d3b] animate-pulse">
                        Searching India Post...
                      </span>
                    )}
                  </div>
                  <input id="pincode" type="text" placeholder="e.g. 403001"
                    value={local.pincode} onChange={(e) => { const numericVal = e.target.value.replace(/\D/g, ''); setLocal((s) => ({ ...s, pincode: numericVal })); }}
                    className="input w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-[#b85d3b] focus:ring-1 focus:ring-[#b85d3b] transition-all font-medium text-stone-800 outline-none" maxLength={6} />
                  {discoveredCities.length > 0 && (
                    <p className="text-[11px] text-[#4e5b4b] font-medium mt-1.5 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 stroke-[3px]" /> Auto-detected {discoveredCities.length} postal zones for PIN {local.pincode}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">City / Hub</label>
                    {discoveredCities.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setDiscoveredCities([]); setIsCustomCity(false); setLocal(s => ({ ...s, city: 'Panjim' })); }}
                        className="text-[11px] text-stone-400 hover:text-stone-700 underline"
                      >
                        Reset to default hubs
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {(discoveredCities.length > 0 ? discoveredCities.slice(0, 9) : recentCities.slice(0, 9)).map((city) => (
                      <button key={city} onClick={() => { setIsCustomCity(false); setLocal((s) => ({ ...s, city })); addRecentCity(city); }}
                        className={clsx('p-3 rounded-xl border-2 text-xs font-bold transition-all text-center truncate',
                          local.city === city && !isCustomCity
                            ? 'border-[#b85d3b] bg-[#faeae3] text-[#b85d3b] font-black shadow-sm'
                            : 'border-stone-200 text-stone-700 hover:border-[#c5a059] bg-white')}
                        title={city}
                      >
                        {city}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setIsCustomCity(!isCustomCity)}
                      className={clsx('p-3 rounded-xl border-2 text-xs font-bold transition-all text-center',
                        isCustomCity || (!recentCities.includes(local.city) && !discoveredCities.includes(local.city) && local.city)
                          ? 'border-[#b85d3b] bg-[#faeae3] text-[#b85d3b] font-black shadow-sm'
                          : 'border-stone-200 text-stone-500 hover:border-[#c5a059] bg-stone-50')}
                    >
                      + Other
                    </button>
                  </div>

                  {(isCustomCity || (!recentCities.includes(local.city) && !discoveredCities.includes(local.city) && local.city)) && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mt-3">
                      <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1">
                        Custom City or Region Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Porvorim, Calangute, Hyderabad..."
                        value={local.city}
                        onChange={(e) => {
                          const val = e.target.value
                          setLocal(s => ({ ...s, city: val }))
                        }}
                        onBlur={() => {
                          if (local.city) addRecentCity(local.city)
                        }}
                        className="input w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:border-[#b85d3b] focus:ring-1 focus:ring-[#b85d3b] font-medium text-stone-800 outline-none"
                      />
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 1: Scope & Home Configuration with Integrated Floor Plan Selection */}
          {step === S_CONFIG && (
            <motion.div key="bhk" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-8">
              <div>
                <h2 className="text-3xl font-extrabold text-stone-900 mb-2 tracking-tight font-serif">Scope & Home Configuration</h2>
                <p className="text-stone-600 mb-4">Select your BHK structure and floor plan. We will calibrate room dimensions and modular designs accordingly.</p>
                <BhkSelector selected={local.bhk} onSelect={(bhk) => setLocal((s) => ({ ...s, bhk, typology_id: '' }))} />
              </div>

              {/* Integrated "Your Plan" Floor Plan Selection */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-2">
                    <Layout className="w-4 h-4 text-[#b85d3b]" />
                    <span>Your Plan</span>
                    <span className="text-[#b85d3b] text-xs font-bold">*</span>
                  </div>
                  {local.bhk && (
                    <span className="text-[11px] text-[#b85d3b] font-semibold bg-[#faeae3] px-2.5 py-1 rounded-md">
                      Showing plans for {local.bhk}
                    </span>
                  )}
                </div>

                {!local.bhk ? (
                  <div className="bg-stone-50/80 border-2 border-dashed border-stone-200 rounded-2xl p-8 text-center">
                    <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center mx-auto mb-3">
                      <Layout className="w-6 h-6 text-stone-400" />
                    </div>
                    <div className="text-sm font-bold text-stone-700">No BHK Selected Yet</div>
                    <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                      Please select a BHK configuration above to view and choose your architectural floor plan.
                    </p>
                  </div>
                ) : typologyLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm animate-pulse">
                        <div className="h-40 bg-stone-100 rounded-xl mb-3" />
                        <div className="h-4 bg-stone-100 rounded w-1/2 mb-2" />
                        <div className="h-3 bg-stone-100 rounded w-3/4" />
                      </div>
                    ))}
                  </div>
                ) : typologies.length === 0 ? (
                  <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-6 text-center">
                    <Layout className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                    <p className="text-sm font-bold text-amber-900">Standard Architectural Layout will be applied for {local.bhk}</p>
                    <p className="text-xs text-amber-700 mt-1">Our system will proceed with standard spatial planning for this unit size.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {typologies.map((t, index) => {
                      const isSelected = local.typology_id === t.id
                      const planLabel = `Plan ${String.fromCharCode(65 + index)}`
                      return (
                        <div
                          key={t.id}
                          onClick={() => setLocal((s) => ({ ...s, typology_id: t.id }))}
                          className={clsx(
                            'group cursor-pointer rounded-2xl border-2 p-3.5 transition-all duration-200 bg-white relative flex flex-col justify-between shadow-sm hover:shadow-md',
                            isSelected
                              ? 'border-[#b85d3b] ring-2 ring-[#b85d3b]/20 bg-[#faeae3]/15'
                              : 'border-stone-200 hover:border-[#c5a059]/60'
                          )}
                        >
                          <div className="relative h-44 rounded-xl overflow-hidden bg-stone-50 border border-stone-100 mb-3 flex items-center justify-center">
                            {t.image_url ? (
                              <img
                                src={t.image_url}
                                alt={planLabel}
                                className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="text-center px-3">
                                <Layout className="w-8 h-8 text-stone-300 mx-auto mb-1" />
                                <span className="text-[11px] text-stone-400">Blueprint available</span>
                              </div>
                            )}

                            {t.image_url && (
                              <button
                                type="button"
                                title="Click to view full screen"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setLightboxPlan(t)
                                }}
                                className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition-all opacity-80 group-hover:opacity-100 shadow"
                              >
                                <Maximize2 className="w-4 h-4" />
                              </button>
                            )}

                            {isSelected && (
                              <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#b85d3b] text-white flex items-center justify-center shadow">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </span>
                            )}
                          </div>

                          <div>
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <span className="font-bold text-stone-900 text-sm leading-tight">{planLabel}</span>
                              {t.bhk_type && (
                                <span className="text-[10px] font-bold text-[#b85d3b] bg-[#faeae3] px-2 py-0.5 rounded-md whitespace-nowrap">
                                  {t.bhk_type}
                                </span>
                              )}
                            </div>

                            {t.carpet_area_sqft ? (
                              <div className="flex items-center gap-1.5 text-xs text-stone-600 font-medium mt-1">
                                <Maximize2 className="w-3.5 h-3.5 text-stone-400" />
                                {Math.round(t.carpet_area_sqft)} sq ft carpet area
                              </div>
                            ) : null}

                            {t.description && (
                              <p className="text-[11px] text-stone-500 mt-1.5 line-clamp-2 leading-relaxed">{t.description}</p>
                            )}
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (t.image_url) setLightboxPlan(t)
                              }}
                              className="text-[11px] font-semibold text-stone-500 hover:text-stone-800 flex items-center gap-1"
                            >
                              <Maximize2 className="w-3 h-3" /> Full View
                            </button>
                            <span className={clsx(
                              "text-xs font-bold",
                              isSelected ? "text-[#b85d3b]" : "text-stone-400 group-hover:text-stone-600"
                            )}>
                              {isSelected ? "Selected ✓" : "Select Plan"}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Scope of Furnishing */}
              <div>
                <div className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-3">Scope of Furnishing</div>
                <div className="grid grid-cols-2 gap-4">
                  {FURNISHING_OPTIONS.map((f) => (
                    <button key={f.id} onClick={() => setLocal((s) => ({ ...s, furnishing_type: f.id }))}
                      className={clsx('p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-4 bg-white card-hover',
                        local.furnishing_type === f.id
                          ? 'border-[#b85d3b] bg-[#faeae3]/30 shadow-sm'
                          : 'border-stone-200 hover:border-[#c5a059]/60')}>
                      <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                        local.furnishing_type === f.id ? 'bg-[#b85d3b] text-white' : 'bg-stone-100 text-stone-500')}>
                        <f.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-stone-900 text-sm">{f.label}</div>
                        <div className="text-xs text-stone-500 mt-0.5 leading-normal">{f.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: Budget & Timeline (Material Quality Preference Removed) */}
          {step === S_BUDGET && (
            <motion.div key="budget" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-6">
              <h2 className="text-3xl font-extrabold text-stone-900 mb-2 tracking-tight font-serif">Budget & Timeline</h2>
              <p className="text-stone-600 mb-4">Helps us curate modular package price tiers and delivery schedules aligned with your preference.</p>

              {isB2B2C && earliestStartDate && (
                <div className="flex gap-3 bg-[#faeae3]/50 border border-[#b85d3b]/20 p-4 rounded-xl text-stone-800 text-xs font-semibold items-start leading-relaxed shadow-sm">
                  <ShieldAlert className="w-4 h-4 mt-0.5 text-[#b85d3b] flex-shrink-0" />
                  <div>
                    <span>Project Readiness Constraint: The property <strong>{local.property_name}</strong> will be available for interior execution starting from <strong>{earliestStartDate}</strong>. Timeline selections are constrained accordingly.</span>
                  </div>
                </div>
              )}

              {/* Total Interior Budget */}
              <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-card">
                <div className="text-xs font-bold text-stone-700 mb-3.5 uppercase tracking-wider">Total Interior Budget</div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {BUDGET_RANGES.map((b) => (
                    <button key={b.id} onClick={() => setLocal((s) => ({ ...s, budget: b.id }))}
                      className={clsx('p-3 rounded-xl border-2 text-xs font-bold transition-all text-center',
                        local.budget === b.id
                          ? 'border-[#b85d3b] bg-[#faeae3] text-[#b85d3b] font-black shadow-sm'
                          : 'border-stone-200 text-stone-700 hover:border-[#c5a059] bg-white')}>
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timeline Selection */}
              <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-card">
                <div className="text-xs font-bold text-stone-700 mb-3.5 uppercase tracking-wider">When do you want to start?</div>
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
                          local.timeline === t.id && !isChoiceDisabled ? 'border-[#b85d3b] bg-[#faeae3] text-[#b85d3b] shadow-sm' :
                          isChoiceDisabled ? 'border-stone-100 bg-stone-50 text-stone-300 cursor-not-allowed opacity-40' :
                          'border-stone-200 text-stone-700 hover:border-[#c5a059] bg-white'
                        )}
                      >
                        <span>{t.label}</span>
                        {isChoiceDisabled && (
                          <span className="block text-[8px] font-medium text-stone-400 mt-0.5">Unavailable before readiness date</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Design Vibe */}
          {step === S_VIBE && (
            <motion.div key="style" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <h2 className="text-3xl font-extrabold text-stone-900 mb-2 tracking-tight font-serif">What's your design vibe?</h2>
              <p className="text-stone-600 mb-8">Select one interior style. Visual representations guide our design engine and modular catalog filters.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
                          ? 'border-[#b85d3b] ring-2 ring-[#b85d3b]/20 shadow-md'
                          : 'border-stone-200 hover:border-[#c5a059]/60'
                      )}
                    >
                      <div className="h-44 w-full overflow-hidden relative bg-stone-100 flex-shrink-0">
                        <img
                          src={opt.img}
                          alt={opt.label}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        {isSelected && (
                          <div className="absolute top-3 right-3 bg-[#b85d3b] text-white rounded-full p-1 shadow-md z-10">
                            <Check className="w-4 h-4 stroke-[3px]" />
                          </div>
                        )}
                      </div>
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="font-extrabold text-stone-900 text-base">{opt.label}</div>
                          <div className="text-xs text-stone-500 mt-1 leading-relaxed">{opt.desc}</div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* Step 4: Material & Fabric Preferences */}
          {step === S_MATERIAL && (
            <motion.div key="material-pref" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-8">
              <div>
                <h2 className="text-3xl font-extrabold text-stone-900 mb-2 tracking-tight font-serif">Material & Fabric Preferences</h2>
                <p className="text-stone-600 mb-6">Select your preferred interior wood laminate finish and upholstery fabric texture.</p>

                <h3 className="text-xs font-extrabold text-[#b85d3b] uppercase tracking-wider mb-3">🪵 INTERIOR WOOD LAMINATE FINISH</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {(availableMaterials.length > 0 ? availableMaterials : ['Oak Laminate', 'Teak Laminate', 'Walnut Laminate']).map((m) => {
                    const descriptions: Record<string, string> = {
                      'Oak Laminate': 'Light, modern, and warm wood grain finish.',
                      'Teak Laminate': 'Classic golden-brown look with rich textures.',
                      'Walnut Laminate': 'Deep, dark, and sophisticated premium finish.'
                    }
                    const imageUrl = MATERIAL_IMAGES[m] || `${BACKEND_URL}/static/assets/catalog/wardrobes-warm_beige-oak-laminated-front_view.webp`
                    const isSelected = local.interior_material_preference === m
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setLocal((s) => ({ ...s, interior_material_preference: m }))}
                        className={clsx(
                          'group rounded-2xl border-2 bg-white overflow-hidden text-left transition-all duration-200 shadow-sm hover:shadow-md flex flex-col h-full relative',
                          isSelected
                            ? 'border-[#b85d3b] ring-2 ring-[#b85d3b]/20 shadow-md'
                            : 'border-stone-200 hover:border-[#c5a059]/60'
                        )}
                      >
                        <div className="h-36 w-full overflow-hidden relative bg-stone-100 flex-shrink-0">
                          <img
                            src={imageUrl}
                            alt={m}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          {isSelected && (
                            <div className="absolute top-3 right-3 bg-[#b85d3b] text-white rounded-full p-1 shadow-md z-10">
                              <Check className="w-3.5 h-3.5 stroke-[3px]" />
                            </div>
                          )}
                        </div>
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="font-extrabold text-stone-900 text-sm">{m}</div>
                            <div className="text-xs text-stone-500 mt-1 leading-relaxed">{descriptions[m] || 'Premium interior wood laminate.'}</div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-extrabold text-[#b85d3b] uppercase tracking-wider mb-3">🪡 UPHOLSTERY & FABRIC PREFERENCE</h3>
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
                            ? 'border-[#b85d3b] ring-2 ring-[#b85d3b]/20 shadow-md'
                            : 'border-stone-200 hover:border-[#c5a059]/60'
                        )}
                      >
                        <div className="h-32 w-full overflow-hidden relative bg-stone-100 flex-shrink-0">
                          <img
                            src={f.img}
                            alt={f.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          {isSelected && (
                            <div className="absolute top-3 right-3 bg-[#b85d3b] text-white rounded-full p-1 shadow-md z-10">
                              <Check className="w-3.5 h-3.5 stroke-[3px]" />
                            </div>
                          )}
                        </div>
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="font-extrabold text-stone-900 text-sm">{f.name}</div>
                            <div className="text-xs text-stone-500 mt-1 leading-normal">{f.desc}</div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 5: Colors (Pure 3D Glossy Liquid Paint Droplets) */}
          {step === S_COLORS && (
            <motion.div key="colors" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-6">
              <div className="text-center max-w-lg mx-auto">
                <h2 className="text-2xl md:text-3xl font-extrabold text-stone-900 mb-1.5 tracking-tight font-serif">Curated Color Droplets</h2>
                <p className="text-stone-600 text-xs md:text-sm">Select liquid paint swatches for your bespoke home aesthetic. Hover to view the shade name.</p>
              </div>

              {/* Recommended for Selected Style */}
              {availableColors?.recommended?.length > 0 && (
                <div className="max-w-2xl mx-auto bg-stone-100/80 border border-stone-200/80 rounded-2xl p-4 sm:p-5 shadow-xs">
                  <div className="text-xs font-bold text-[#b85d3b] uppercase tracking-wider mb-3 flex items-center gap-1.5 justify-center sm:justify-start">
                    <Sparkles className="w-4 h-4 text-[#c5a059]" />
                    <span>Recommended for {selectedVibeLabel}</span>
                  </div>
                  <div className="flex flex-wrap justify-center sm:justify-start gap-3">
                    {availableColors.recommended.map((c: string) => {
                      const active = local.color_preferences.includes(c)
                      const hex = getColorHex(c)
                      const isLight = ['white', 'beige', 'cream', 'off white', 'off-white', 'clear glass', 'frosted', 'ivory', 'blush pink'].includes(c.toLowerCase())
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
                            }))
                          }}
                          className="group relative flex items-center justify-center focus:outline-none p-0.5"
                          title={c}
                        >
                          {/* Compact Tooltip on Hover */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 bg-stone-900/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-md whitespace-nowrap z-30 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full border border-white/40 flex-shrink-0" style={{ backgroundColor: hex }} />
                            <span>{c}</span>
                          </div>

                          {/* 3D Glossy Liquid Paint Droplet (Compact) */}
                          <div
                            className={clsx(
                              "w-8 h-8 rounded-full relative transition-all duration-200 flex items-center justify-center cursor-pointer select-none",
                              active
                                ? "scale-110 ring-2 ring-[#b85d3b] ring-offset-2 ring-offset-stone-100 shadow-md"
                                : "hover:scale-110 hover:shadow-md active:scale-95 shadow-sm shadow-stone-900/10"
                            )}
                            style={{
                              backgroundColor: hex,
                              boxShadow: active
                                ? '0 6px 14px -2px rgba(184,93,59,0.4), inset 0 -3px 6px rgba(0,0,0,0.28), inset 0 2px 4px rgba(255,255,255,0.65)'
                                : '0 4px 10px -2px rgba(0,0,0,0.15), inset 0 -3px 6px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.5)'
                            }}
                          >
                            {/* Curved Liquid Specular Highlight */}
                            <div className="absolute top-1 left-1.5 w-2.5 h-1.5 rounded-[50%] bg-gradient-to-br from-white/95 via-white/40 to-transparent blur-[0.2px] -rotate-45 pointer-events-none" />
                            {/* Glint */}
                            <div className="absolute top-1 left-1.5 w-0.5 h-0.5 rounded-full bg-white/95 pointer-events-none" />
                            {/* Ambient Spherical Liquid Gradient */}
                            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-black/20 via-transparent to-white/30 pointer-events-none" />
                            {active && (
                              <Check className={clsx("w-3 h-3 stroke-[3.5] z-10 drop-shadow", isLight ? "text-stone-900" : "text-white")} />
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* All Curated Paint Droplets */}
              <div className="max-w-2xl mx-auto pt-2">
                <div className="flex items-center justify-between pb-2 mb-4 border-b border-stone-200/60">
                  <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">All Paint Swatches</span>
                  <span className="text-xs font-semibold text-[#b85d3b] bg-[#faeae3] px-3 py-0.5 rounded-full">
                    {local.color_preferences.length} selected
                  </span>
                </div>

                <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-y-5 gap-x-3 py-2 place-items-center">
                  {allAvailableColors.map((colorName) => {
                    const isSelected = local.color_preferences.includes(colorName)
                    const hex = getColorHex(colorName)
                    const isLight = ['white', 'beige', 'cream', 'off white', 'off-white', 'clear glass', 'frosted', 'ivory', 'blush pink'].includes(colorName.toLowerCase())

                    return (
                      <button
                        key={colorName}
                        type="button"
                        onClick={() => {
                          setLocal((s) => ({
                            ...s,
                            color_preferences: s.color_preferences.includes(colorName)
                              ? s.color_preferences.filter((x) => x !== colorName)
                              : [...s.color_preferences, colorName],
                          }))
                        }}
                        className="group relative flex flex-col items-center justify-center p-1 focus:outline-none"
                        title={colorName}
                      >
                        {/* Tooltip on Hover */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 bg-stone-900/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-lg whitespace-nowrap z-30 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full border border-white/40 flex-shrink-0" style={{ backgroundColor: hex }} />
                          <span>{colorName}</span>
                        </div>

                        {/* 3D Glossy Liquid Paint Droplet */}
                        <div
                          className={clsx(
                            "w-12 h-12 sm:w-14 sm:h-14 rounded-full relative transition-all duration-300 transform",
                            "flex items-center justify-center cursor-pointer select-none",
                            isSelected
                              ? "scale-110 ring-4 ring-[#b85d3b] ring-offset-2 ring-offset-[#FAF7F2] shadow-xl"
                              : "hover:scale-110 hover:shadow-lg active:scale-95 shadow-md shadow-stone-900/15"
                          )}
                          style={{
                            backgroundColor: hex,
                            boxShadow: isSelected
                              ? '0 10px 22px -3px rgba(184,93,59,0.4), 0 4px 6px -2px rgba(0,0,0,0.1), inset 0 -4px 8px rgba(0,0,0,0.28), inset 0 3px 6px rgba(255,255,255,0.65)'
                              : '0 6px 14px -2px rgba(0,0,0,0.18), 0 2px 4px -1px rgba(0,0,0,0.08), inset 0 -4px 8px rgba(0,0,0,0.22), inset 0 2.5px 5px rgba(255,255,255,0.55)'
                          }}
                        >
                          {/* Curved Liquid Specular Highlight (sheen of wet paint) */}
                          <div className="absolute top-1.5 left-2 w-4 h-3 rounded-[50%] bg-gradient-to-br from-white/95 via-white/40 to-transparent blur-[0.4px] -rotate-45 pointer-events-none" />
                          
                          {/* Pinpoint Specular Glint */}
                          <div className="absolute top-2 left-2.5 w-1 h-1 rounded-full bg-white/95 pointer-events-none" />

                          {/* Ambient Spherical Liquid Dome Gradient */}
                          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-black/20 via-transparent to-white/30 pointer-events-none" />

                          {/* Selection Checkmark */}
                          {isSelected && (
                            <Check className={clsx(
                              "w-5 h-5 stroke-[3.5] z-10 drop-shadow",
                              isLight ? "text-stone-900" : "text-white"
                            )} />
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Selected Swatches Summary */}
                {local.color_preferences.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-stone-200/60 flex flex-wrap items-center justify-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mr-1">Selected:</span>
                    {local.color_preferences.map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/90 border border-stone-200 text-stone-800 shadow-sm"
                      >
                        <span className="w-2.5 h-2.5 rounded-full border border-stone-300" style={{ backgroundColor: getColorHex(c) }} />
                        {c}
                        <button
                          type="button"
                          onClick={() => setLocal((s) => ({ ...s, color_preferences: s.color_preferences.filter((x) => x !== c) }))}
                          className="text-stone-400 hover:text-stone-700 font-bold ml-1"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-between mt-10">
          <button
            onClick={() => setStep((s) => Math.max(isB2B2C ? S_VIBE : S_PROPERTY, s - 1))}
            disabled={(isB2B2C && step <= S_VIBE) || step === S_PROPERTY}
            className="btn-ghost flex items-center gap-2 disabled:opacity-30 text-stone-600 hover:text-stone-900"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          {step < STEPS.length - 1 ? (
            <button onClick={handleNext} disabled={!canNext()}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-bold bg-[#b85d3b] hover:bg-[#a04e30] shadow-md text-white flex items-center gap-1.5">
              Next <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={!canNext() || loading}
              className="btn-primary disabled:opacity-50 px-6 py-3 rounded-xl font-bold bg-[#b85d3b] hover:bg-[#a04e30] shadow-md text-white flex items-center gap-1.5">
              {loading
                ? <div className="spinner w-5 h-5 border-white" />
                : <><Sparkles className="w-4 h-4" /> Find Packages <ArrowRight className="w-4 h-4" /></>
              }
            </button>
          )}
        </div>
        </div>
      </div>

      {/* Full Screen Lightbox Modal for Architectural Floor Plans */}
      {lightboxPlan && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
          onClick={() => setLightboxPlan(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-[#181614] border border-stone-700 rounded-2xl p-5 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white font-serif">{lightboxPlan.name}</h3>
                  {lightboxPlan.bhk_type && (
                    <span className="text-xs font-semibold text-[#c5a059] bg-[#c5a059]/10 border border-[#c5a059]/20 px-2 py-0.5 rounded">
                      {lightboxPlan.bhk_type}
                    </span>
                  )}
                </div>
                {lightboxPlan.carpet_area_sqft && (
                  <p className="text-xs text-stone-400 mt-0.5">
                    Carpet Area: <span className="text-[#c5a059] font-medium">{Math.round(lightboxPlan.carpet_area_sqft)} sq ft</span>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setLightboxPlan(null)}
                className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-white flex items-center justify-center transition-colors"
                aria-label="Close preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 bg-[#0f0e0d] rounded-xl flex items-center justify-center p-3 overflow-hidden border border-stone-800">
              <img
                src={lightboxPlan.image_url}
                alt={lightboxPlan.name}
                className="max-h-[65vh] w-auto max-w-full object-contain"
              />
            </div>

            <div className="flex items-center justify-between pt-3 mt-3 border-t border-stone-800 text-xs text-stone-400">
              <span>Click anywhere outside the frame to close</span>
              <button
                type="button"
                onClick={() => {
                  setLocal((s) => ({ ...s, typology_id: lightboxPlan.id }))
                  setLightboxPlan(null)
                  toast.success(`Selected ${lightboxPlan.name}`)
                }}
                className={clsx(
                  "px-4 py-1.5 rounded-lg font-bold transition-all",
                  local.typology_id === lightboxPlan.id
                    ? "bg-[#4e5b4b] text-white"
                    : "bg-[#b85d3b] hover:bg-[#a04e30] text-white"
                )}
              >
                {local.typology_id === lightboxPlan.id ? "Plan Selected ✓" : "Select This Plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
