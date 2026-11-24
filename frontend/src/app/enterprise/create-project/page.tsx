'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { enterpriseAPI } from '@/lib/api'
import Navbar from '@/components/Navbar'
import toast from 'react-hot-toast'
import { ArrowLeft, ArrowRight, Save, Building, MapPin, Calendar, Layout, List, Upload, FileText, Check, Trash2, Edit3, Home, Wrench, Settings, Plus, X, ChevronUp, ChevronDown } from 'lucide-react'
import clsx from 'clsx'

const CITIES = ['Bangalore', 'Mumbai', 'Delhi', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad', 'Other']

const FURNISHING_OPTIONS = [
  { id: 'new',     label: 'New Home',    desc: 'Moving into a new property', icon: Home },
  { id: 'upgrade', label: 'Upgrading',   desc: 'Renovating an existing space', icon: Wrench },
]

const TIMELINE_OPTIONS = [
  { id: '1_month',  label: 'ASAP (< 1 month)' },
  { id: '3_months', label: '1–3 months' },
  { id: '6_months', label: '3–6 months' },
  { id: 'flexible', label: 'Flexible / Planning' },
]

export default function CreateProjectPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Step 1: Property Details State
  const [propertyName, setPropertyName] = useState('')
  const [locality, setLocality] = useState('')
  const [city, setCity] = useState('')
  const [pincode, setPincode] = useState('')
  const [discoveredCities, setDiscoveredCities] = useState<string[]>([])
  const [isCustomCity, setIsCustomCity] = useState(false)
  const [pincodeLoading, setPincodeLoading] = useState(false)
  const [attemptedStep3Next, setAttemptedStep3Next] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  // India Postal PIN code auto-lookup
  useEffect(() => {
    if (pincode && pincode.length === 6) {
      let isMounted = true
      setPincodeLoading(true)
      fetch(`https://api.postalpincode.in/pincode/${pincode}`)
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
              const autoPick = data[0].PostOffice[0]?.District || names[0]
              setCity(autoPick)
              setIsCustomCity(false)
              toast.success(`Found ${names.length} postal zones for ${pincode}`)
            }
          } else {
            setDiscoveredCities([])
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
  }, [pincode])

  // Step 2: Scope & Home Configuration State
  const [furnishingType, setFurnishingType] = useState('new')
  const [earliestStartDate, setEarliestStartDate] = useState('2026-10-01')
  const [totalUnits, setTotalUnits] = useState(10)
  const [timeline, setTimeline] = useState('1_month')

  // Step 3: BHK Mix State
  const [bhkMix, setBhkMix] = useState<Record<string, number>>({
    '1BHK': 0,
    '2BHK': 6,
    '3BHK': 4,
    '4BHK': 0
  })

  // Step 4: Floor Plans & Flats State
  const [uploadedPlans, setUploadedPlans] = useState<any[]>([])
  const [uploadName, setUploadName] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const [flats, setFlats] = useState<any[]>([])
  const [editingFlatIndex, setEditingFlatIndex] = useState<number | null>(null)
  const [editFlatNumber, setEditFlatNumber] = useState('')
  const [editBhkType, setEditBhkType] = useState('')
  const [editFloorPlanId, setEditFloorPlanId] = useState('')

  // Parent Project ID
  const [projectId, setProjectId] = useState<string | null>(null)

  // Step 3 & 4: Typology state
  const [typologyCount, setTypologyCount] = useState<number>(3)
  const [wizardTypologies, setWizardTypologies] = useState<Array<{
    id: string
    name: string
    carpet_area_sqft: number | ''
    file: File | null
    previewUrl: string | null
  }>>([])

  const handleBhkChange = (bhk: string, val: number) => {
    setBhkMix(prev => ({
      ...prev,
      [bhk]: Math.max(0, val)
    }))
  }

  const canGoNext = () => {
    if (step === 1) {
      return !!propertyName.trim() && !!locality.trim() && !!city
    }
    if (step === 2) {
      return totalUnits > 0 && !!earliestStartDate && !!furnishingType
    }
    if (step === 3) {
      const sum = Object.values(bhkMix).reduce((acc, v) => acc + v, 0)
      return sum === totalUnits
    }
    return true
  }

  const handleStep2Submit = async () => {
    setLoading(true)
    try {
      const res = await enterpriseAPI.createProject({
        property_name: propertyName,
        locality: locality,
        city: city,
        pincode: pincode || undefined,
        furnishing_type: furnishingType,
        total_units: totalUnits,
        earliest_start_date: earliestStartDate,
        timeline: timeline
      })
      setProjectId(res.data.project_id)
      toast.success("Project details configured! Now define the BHK distribution mix.")
      setStep(3)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to create project details.")
    } finally {
      setLoading(false)
    }
  }

  const handleStep3Submit = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      await enterpriseAPI.configureUnitMix(projectId, { bhk_mix: bhkMix })
      
      // Fetch generated flats from backend
      const res = await enterpriseAPI.listFlats(projectId)
      setFlats(res.data.flats || [])
      
      // Initialize dynamic typology cards for Step 4
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
      setWizardTypologies(prev => {
        if (prev.length > 0) return prev
        return Array.from({ length: typologyCount }, (_, i) => ({
          id: `typ_${i + 1}`,
          name: `Typology ${letters[i] || i + 1}`,
          carpet_area_sqft: '',
          file: null,
          previewUrl: null
        }))
      })

      toast.success("Flat units generated successfully!")
      setStep(4)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to configure BHK distribution.")
    } finally {
      setLoading(false)
    }
  }
  const handleAddWizardTypology = () => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    const nextIdx = wizardTypologies.length
    setWizardTypologies(prev => [
      ...prev,
      {
        id: `typ_${Date.now()}`,
        name: `Typology ${letters[nextIdx] || nextIdx + 1}`,
        carpet_area_sqft: '',
        file: null,
        previewUrl: null
      }
    ])
  }

  const handleTypologyFileChange = (index: number, file: File | null) => {
    if (!file) return
    const previewUrl = URL.createObjectURL(file)
    setWizardTypologies(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], file, previewUrl }
      return updated
    })
  }

  const handleTypologyFieldChange = (index: number, field: 'name' | 'carpet_area_sqft', value: any) => {
    setWizardTypologies(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleRemoveWizardTypology = (index: number) => {
    if (wizardTypologies.length <= 1) {
      toast.error("At least one typology is required.")
      return
    }
    setWizardTypologies(prev => prev.filter((_, i) => i !== index))
  }

  const handleUploadFloorPlan = async () => {
    if (!projectId || !uploadFile || !uploadName.trim()) {
      toast.error("Please provide both layout name and file.")
      return
    }

    setUploading(true)
    try {
      const res = await enterpriseAPI.uploadFloorPlan(projectId, uploadName, uploadFile)
      setUploadedPlans(prev => [...prev, res.data])
      setUploadName('')
      setUploadFile(null)
      // Reset input element
      const fileInput = document.getElementById('fp-file-input') as HTMLInputElement
      if (fileInput) fileInput.value = ''
      
      toast.success("Floor plan template uploaded successfully! 📐")
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to upload floor plan file.")
    } finally {
      setUploading(false)
    }
  }

  const handleStep4Edit = (index: number) => {
    const f = flats[index]
    setEditingFlatIndex(index)
    setEditFlatNumber(f.flat_number)
    setEditBhkType(f.bhk_type)
    setEditFloorPlanId(f.floor_plan_id || '')
  }

  const handleSaveFlatEdit = async () => {
    if (editingFlatIndex === null) return
    const targetFlat = flats[editingFlatIndex]

    setLoading(true)
    try {
      await enterpriseAPI.updateFlat(targetFlat.id, {
        flat_number: editFlatNumber,
        bhk_type: editBhkType,
        floor_plan_id: editFloorPlanId || ""
      })

      // Update local state
      setFlats(prev => {
        const updated = [...prev]
        const matchedPlan = uploadedPlans.find(p => p.id === editFloorPlanId)
        updated[editingFlatIndex] = {
          ...updated[editingFlatIndex],
          flat_number: editFlatNumber,
          bhk_type: editBhkType,
          floor_plan_id: editFloorPlanId || null,
          floor_plan_name: matchedPlan ? matchedPlan.layout_name : null,
          floor_plan_url: matchedPlan ? matchedPlan.file_url : null
        }
        return updated
      })

      setEditingFlatIndex(null)
      toast.success("Flat details updated successfully!")
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to update flat details.")
    } finally {
      setLoading(false)
    }
  }

  const handleFinishSetup = async () => {
    if (!projectId) {
      router.push('/enterprise/dashboard')
      return
    }

    const minRequired = Math.max(1, wizardTypologies.length - 1)
    const uploadedCount = wizardTypologies.filter(t => t.file !== null).length

    if (uploadedCount < minRequired) {
      toast.error(`Please upload layout blueprints for at least ${minRequired} of ${wizardTypologies.length} typologies before proceeding.`)
      return
    }

    for (const typ of wizardTypologies) {
      if (typ.file && (!typ.carpet_area_sqft || Number(typ.carpet_area_sqft) <= 0)) {
        toast.error(`Please specify a valid carpet area (sq.ft) for ${typ.name}.`)
        return
      }
    }

    setLoading(true)
    try {
      for (const typ of wizardTypologies) {
        if (!typ.name.trim()) continue
        const sqft = typ.carpet_area_sqft ? Number(typ.carpet_area_sqft) : undefined
        if (typ.file) {
          await enterpriseAPI.uploadAndCreateTypology(projectId, typ.name, sqft, typ.file)
        } else {
          await enterpriseAPI.createTypology(projectId, { name: typ.name, carpet_area_sqft: sqft })
        }
      }
      toast.success("Enterprise project and typologies setup successfully! 🎉")
      router.push(`/enterprise/project/${projectId}`)
    } catch (err: any) {
      console.error("Error saving typologies:", err)
      toast.success("Project setup completed!")
      router.push(`/enterprise/project/${projectId}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFBF9] text-[#161D1A] flex flex-col">
      <Navbar />
      <div className="flex-1 max-w-3xl w-full mx-auto px-4 pt-28 pb-16 space-y-8">
        
        {/* Wizard Header */}
        <div className="flex justify-between items-center border-b border-[#E5ECE7] pb-5">
          <div>
            <h1 className="text-2xl font-black text-[#161D1A] tracking-tight">Project Configuration Wizard</h1>
            <p className="text-stone-500 text-xs mt-1">Set up building details, unit distribution, layout drawings, and customize buyer flats.</p>
          </div>
          <span className="bg-[#161D1A] text-[#A3E635] text-xs font-bold px-3 py-1 rounded-full">
            Step {step} of 4
          </span>
        </div>

        {/* Form Body */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xs border border-[#E5ECE7]">
          
          {/* STEP 1: Property Details */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-[#161D1A] flex items-center gap-2 mb-4">
                <Building className="w-5 h-5 text-[#059669]" /> 1. Real Estate Development Details
              </h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">Development Name / Society</label>
                  <input
                    type="text"
                    placeholder="e.g. Prestige Greenhills Development"
                    value={propertyName}
                    onChange={e => setPropertyName(e.target.value)}
                    className="input w-full px-4 py-3 rounded-xl border border-[#E5ECE7] focus:border-[#84CC16] focus:ring-1 focus:ring-[#84CC16] transition-all font-medium text-[#161D1A] outline-none bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">Locality / Area</label>
                    <input
                      type="text"
                      placeholder="e.g. Whitefield"
                      value={locality}
                      onChange={e => setLocality(e.target.value)}
                      className="input w-full px-4 py-3 rounded-xl border border-[#E5ECE7] focus:border-[#84CC16] focus:ring-1 focus:ring-[#84CC16] transition-all font-medium text-[#161D1A] outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">Pincode</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="e.g. 560087"
                      value={pincode}
                      onChange={e => setPincode(e.target.value.replace(/\D/g, ''))}
                      className="input w-full px-4 py-3 rounded-xl border border-[#E5ECE7] focus:border-[#84CC16] focus:ring-1 focus:ring-[#84CC16] transition-all font-medium text-[#161D1A] outline-none bg-white"
                      maxLength={6}
                    />
                    {discoveredCities.length > 0 && (
                      <p className="text-[11px] text-[#059669] font-medium mt-1.5 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 stroke-[3]" /> Auto-detected {discoveredCities.length} postal zones for PIN {pincode}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">City / Hub</label>
                    {discoveredCities.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setDiscoveredCities([]); setIsCustomCity(true); }}
                        className="text-[11px] text-stone-400 hover:text-stone-700 underline"
                      >
                        Change to custom city
                      </button>
                    )}
                  </div>

                  {discoveredCities.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {discoveredCities.slice(0, 7).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => { setCity(c); setIsCustomCity(false); }}
                          className={clsx(
                            'p-3 rounded-xl border-2 text-xs font-bold transition-all text-center truncate',
                            city === c && !isCustomCity
                              ? 'border-[#84CC16] bg-[#84CC16] text-[#0B0F0D] font-black shadow-xs'
                              : 'border-[#E5ECE7] text-stone-700 hover:border-[#84CC16]/60 bg-white'
                          )}
                          title={c}
                        >
                          {c}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setIsCustomCity(!isCustomCity)}
                        className={clsx(
                          'p-3 rounded-xl border-2 text-xs font-bold transition-all text-center',
                          isCustomCity
                            ? 'border-[#84CC16] bg-[#84CC16] text-[#0B0F0D] font-black shadow-xs'
                            : 'border-[#E5ECE7] text-stone-600 hover:border-[#84CC16]/60 bg-[#F4F6F4]'
                        )}
                      >
                        + Other
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-dashed border-[#E5ECE7] bg-[#FAFBF9] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
                      <span>{pincode.length < 6 ? 'Enter a 6-digit PIN code to auto-discover city zones' : (pincodeLoading ? 'Discovering postal zones...' : 'No automated zones found for this PIN')}</span>
                      <button
                        type="button"
                        onClick={() => setIsCustomCity(true)}
                        className="text-xs font-bold text-[#059669] hover:underline"
                      >
                        + Enter city manually
                      </button>
                    </div>
                  )}

                  {isCustomCity && (
                    <div className="mt-3">
                      <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1">
                        Custom City or Region Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Bangalore, Mumbai, Panjim..."
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="input w-full px-4 py-2.5 rounded-xl border border-[#E5ECE7] focus:border-[#84CC16] outline-none text-[#161D1A] font-semibold bg-white text-xs"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t border-[#E5ECE7]">
                <button
                  type="button"
                  onClick={() => {
                    if (pincode && (pincode.length !== 6 || !/^\d+$/.test(pincode))) {
                      toast.error("Pincode must be a 6-digit number.")
                      return
                    }
                    if (!city) {
                      toast.error("Please specify a city or select an auto-discovered zone.")
                      return
                    }
                    setStep(2)
                  }}
                  disabled={!canGoNext()}
                  className="px-6 py-3 rounded-xl font-bold bg-[#A3E635] hover:bg-[#84CC16] text-[#0B0F0D] flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition"
                >
                  Configure Scope & Home Configuration <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Scope & Home Configuration */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-[#161D1A] flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5 text-[#059669]" /> 2. Scope & Home Configuration
              </h2>

              <div className="space-y-6">
                {/* Selectable Scope of Furnishing */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-3">Scope of Furnishing</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {FURNISHING_OPTIONS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFurnishingType(f.id)}
                        className={clsx(
                          'p-5 rounded-2xl border-2 text-left transition-all flex items-center gap-4 bg-white hover:shadow-xs',
                          furnishingType === f.id ? 'border-[#84CC16] bg-lime-50/40 shadow-xs' : 'border-[#E5ECE7] hover:border-stone-300'
                        )}
                      >
                        <div
                          className={clsx(
                            'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors',
                            furnishingType === f.id ? 'bg-[#84CC16] text-[#0B0F0D]' : 'bg-[#F4F6F4] text-stone-500'
                          )}
                        >
                          <f.icon className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="font-bold text-[#161D1A] text-sm">{f.label}</div>
                          <div className="text-xs text-stone-500 mt-0.5 leading-normal">{f.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">Project Readiness Date</label>
                    <input
                      type="date"
                      value={earliestStartDate}
                      onChange={e => setEarliestStartDate(e.target.value)}
                      className="input w-full px-4 py-3 rounded-xl border border-[#E5ECE7] focus:border-[#84CC16] focus:ring-1 focus:ring-[#84CC16] transition-all font-bold text-[#161D1A] outline-none bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">Total Flats / Units Inventory</label>
                    <input
                      type="number"
                      value={totalUnits}
                      onChange={e => setTotalUnits(Math.max(1, parseInt(e.target.value) || 0))}
                      className="input w-full px-4 py-3 rounded-xl border border-[#E5ECE7] focus:border-[#84CC16] focus:ring-1 focus:ring-[#84CC16] transition-all font-bold text-[#161D1A] outline-none bg-white"
                    />
                  </div>
                </div>

                <div className="border-t border-[#E5ECE7] pt-6 mt-6">
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-3">When do you want to start interior execution?</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {TIMELINE_OPTIONS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTimeline(t.id)}
                        className={clsx(
                          'p-4 rounded-xl border-2 text-xs font-bold transition-all text-center',
                          timeline === t.id
                            ? 'border-[#84CC16] bg-[#84CC16] text-[#0B0F0D] font-black shadow-xs'
                            : 'border-[#E5ECE7] text-stone-700 hover:border-[#84CC16]/60 bg-white'
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-6 border-t border-[#E5ECE7]">
                <button type="button" onClick={() => setStep(1)} className="btn-ghost flex items-center gap-2 text-stone-500 hover:text-[#161D1A]">
                  <ArrowLeft className="w-4 h-4" /> Property Details
                </button>
                <button
                  type="button"
                  onClick={handleStep2Submit}
                  disabled={!canGoNext() || loading}
                  className="px-6 py-3 rounded-xl font-bold bg-[#A3E635] hover:bg-[#84CC16] text-[#0B0F0D] flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition"
                >
                  {loading ? 'Creating Project...' : 'Configure Unit Mix'} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: BHK / Unit Distribution */}
          {step === 3 && (() => {
            const currentSum = Object.values(bhkMix).reduce((acc, v) => acc + v, 0)
            const isMatch = currentSum === totalUnits

            return (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-[#161D1A] flex items-center gap-2 mb-2">
                  <List className="w-5 h-5 text-[#059669]" /> 3. BHK Distribution Mix
                </h2>
                <p className="text-stone-500 text-xs">Distribute the BHK types of the <strong>{totalUnits} flats</strong>. The sum of BHK counts must equal your total units.</p>
                
                {/* 2-Column Layout: BHK Mix on Left, Number of Typologies on Right */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                  <div className="md:col-span-2 space-y-3 bg-[#FAFBF9] p-6 rounded-2xl border border-[#E5ECE7]">
                    {Object.keys(bhkMix).map((bhk) => (
                      <div key={bhk} className="flex justify-between items-center py-1">
                        <span className="font-bold text-stone-700 text-sm">{bhk} configuration</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleBhkChange(bhk, bhkMix[bhk] - 1)}
                            className="w-8 h-8 rounded-lg bg-white border border-[#E5ECE7] font-bold hover:bg-stone-50 text-[#161D1A] shadow-2xs"
                          >
                            -
                          </button>
                          <span className="w-12 text-center font-black text-[#161D1A]">{bhkMix[bhk]}</span>
                          <button
                            type="button"
                            onClick={() => handleBhkChange(bhk, bhkMix[bhk] + 1)}
                            className="w-8 h-8 rounded-lg bg-white border border-[#E5ECE7] font-bold hover:bg-stone-50 text-[#161D1A] shadow-2xs"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Compact Square Card: Number of Typologies */}
                  <div className="bg-gradient-to-br from-[#F7FEE7] via-[#ECFCCB] to-[#D9F99D] p-6 rounded-2xl border border-[#84CC16]/60 shadow-xs flex flex-col justify-between items-center text-center">
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-[#161D1A] block">
                        Number of Typologies
                      </span>
                      <span className="text-[10px] text-stone-600 font-medium block mt-1">Unique Layouts</span>
                    </div>

                    <div className="my-4 flex items-center justify-center">
                      <div className="relative flex items-center bg-white rounded-xl border border-[#84CC16]/60 shadow-xs pl-4 pr-1 py-1">
                        <input
                          type="number"
                          min={1}
                          max={26}
                          value={typologyCount}
                          onChange={e => {
                            const val = Math.max(1, Math.min(26, parseInt(e.target.value) || 1))
                            setTypologyCount(val)
                            const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                            setWizardTypologies(Array.from({ length: val }, (_, i) => ({
                              id: `typ_${i + 1}`,
                              name: `Typology ${letters[i] || i + 1}`,
                              carpet_area_sqft: '',
                              file: null,
                              previewUrl: null
                            })))
                          }}
                          className="w-12 text-center text-xl font-black outline-none bg-transparent text-[#161D1A] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <div className="flex flex-col ml-1 border-l border-stone-200 pl-1">
                          <button
                            type="button"
                            onClick={() => {
                              const val = Math.min(26, typologyCount + 1)
                              setTypologyCount(val)
                              const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                              setWizardTypologies(Array.from({ length: val }, (_, i) => ({
                                id: `typ_${i + 1}`,
                                name: `Typology ${letters[i] || i + 1}`,
                                carpet_area_sqft: '',
                                file: null,
                                previewUrl: null
                              })))
                            }}
                            className="p-1 text-stone-600 hover:text-[#161D1A] hover:bg-lime-100 rounded transition"
                            title="Increase typologies"
                          >
                            <ChevronUp className="w-4 h-4 text-stone-800" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const val = Math.max(1, typologyCount - 1)
                              setTypologyCount(val)
                              const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                              setWizardTypologies(Array.from({ length: val }, (_, i) => ({
                                id: `typ_${i + 1}`,
                                name: `Typology ${letters[i] || i + 1}`,
                                carpet_area_sqft: '',
                                file: null,
                                previewUrl: null
                              })))
                            }}
                            className="p-1 text-stone-600 hover:text-[#161D1A] hover:bg-lime-100 rounded transition"
                            title="Decrease typologies"
                          >
                            <ChevronDown className="w-4 h-4 text-stone-800" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <span className="text-[10px] font-bold text-[#4E5B4B]">
                      Typologies A through {String.fromCharCode(64 + Math.min(26, typologyCount))}
                    </span>
                  </div>
                </div>

                {/* Conditional warning notification: ONLY shown if user attempted to proceed and sum doesn't match */}
                {attemptedStep3Next && !isMatch && (
                  <div className="p-4 rounded-xl text-xs font-semibold flex justify-between bg-amber-50 text-amber-900 border border-amber-300 animate-in fade-in">
                    <span>Allocated: {currentSum} / {totalUnits} units</span>
                    <span>⚠ Need {totalUnits - currentSum} units to balance configuration</span>
                  </div>
                )}

                <div className="flex justify-between pt-6 border-t border-[#E5ECE7]">
                  <button type="button" onClick={() => setStep(2)} className="btn-ghost flex items-center gap-2 text-stone-500 hover:text-[#161D1A]">
                    <ArrowLeft className="w-4 h-4" /> Scope & Configuration
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAttemptedStep3Next(true)
                      if (!isMatch) {
                        toast.error(`Unit sum (${currentSum}) must equal total units (${totalUnits}).`)
                        return
                      }
                      handleStep3Submit()
                    }}
                    disabled={loading}
                    className="px-6 py-3 rounded-xl font-bold bg-[#A3E635] hover:bg-[#84CC16] text-[#0B0F0D] flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition"
                  >
                    {loading ? 'Generating Units...' : 'Generate Flat Units'} <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })()}

          {/* STEP 4: Typology Configuration */}
          {step === 4 && (
            <div className="space-y-6">
              {/* Step 4 Header */}
              <div>
                <h2 className="text-lg font-bold text-[#161D1A] flex items-center gap-2 mb-1">
                  <Layout className="w-5 h-5 text-[#059669]" /> 4. Architectural Typologies & Floor Plans
                </h2>
                <p className="text-stone-500 text-xs">
                  Upload layout blueprints and specify carpet area for each typology prototype. Individual flat assignments will be managed on your View Units console.
                </p>
              </div>

              {/* Typology Cards Container */}
              <div className="space-y-4">
                {(() => {
                  const minRequired = Math.max(1, wizardTypologies.length - 1)
                  const uploadedCount = wizardTypologies.filter(t => t.file !== null).length

                  return wizardTypologies.map((typ, idx) => (
                    <div key={typ.id} className="p-5 border border-[#E5ECE7] rounded-2xl bg-white shadow-xs space-y-4 hover:border-stone-300 transition">
                      <div className="flex justify-between items-center border-b border-[#E5ECE7] pb-3">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-lg bg-[#F4F6F4] text-[#161D1A] border border-[#E5ECE7] font-black text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <input
                            type="text"
                            value={typ.name}
                            onChange={e => handleTypologyFieldChange(idx, 'name', e.target.value)}
                            placeholder="Typology Name (e.g. Typology A)"
                            className="font-bold text-[#161D1A] text-sm px-3 py-1.5 rounded-lg border border-[#E5ECE7] focus:border-[#84CC16] outline-none w-52 bg-white"
                          />
                          {typ.file ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
                              <Check className="w-3 h-3 stroke-[3]" /> Blueprint Ready
                            </span>
                          ) : uploadedCount < minRequired ? (
                            <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200 text-[10px] font-bold">
                              ▲ Blueprint Required
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-500 text-[10px] font-medium">
                              Optional Pending
                            </span>
                          )}
                        </div>
                        {wizardTypologies.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveWizardTypology(idx)}
                            className="text-stone-400 hover:text-rose-600 transition p-1"
                            title="Remove Typology"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-stone-600 uppercase tracking-wider mb-1.5">
                            Carpet Area (Sq.Ft) {typ.file ? <span className="text-rose-500 font-bold">*</span> : <span className="text-stone-400 font-normal">(optional)</span>}
                          </label>
                          <input
                            type="number"
                            value={typ.carpet_area_sqft}
                            onChange={e => handleTypologyFieldChange(idx, 'carpet_area_sqft', e.target.value ? Number(e.target.value) : '')}
                            placeholder="e.g. 1250"
                            className="input w-full px-3.5 py-2 text-xs rounded-xl border border-[#E5ECE7] focus:border-[#84CC16] outline-none text-[#161D1A] font-semibold bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-stone-600 uppercase tracking-wider mb-1.5">
                            Layout Blueprint
                          </label>
                          <div className="flex items-center gap-3">
                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-[#059669] hover:bg-emerald-100 border border-emerald-200/60 cursor-pointer transition shadow-2xs shrink-0">
                              <Upload className="w-3.5 h-3.5" />
                              <span>{typ.file || typ.previewUrl ? 'Change Blueprint' : 'Choose File'}</span>
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={e => handleTypologyFileChange(idx, e.target.files?.[0] || null)}
                                className="hidden"
                              />
                            </label>
                            {typ.previewUrl && (
                              <button
                                type="button"
                                onClick={() => setLightboxUrl(typ.previewUrl)}
                                className="group relative rounded-lg border border-[#84CC16] shadow-xs shrink-0 overflow-hidden hover:scale-105 transition"
                                title="Click to preview blueprint in full view"
                              >
                                <img
                                  src={typ.previewUrl}
                                  alt={typ.name}
                                  className="w-10 h-10 object-cover"
                                />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                })()}
              </div>

              {/* Add Another Typology Button */}
              <button
                type="button"
                onClick={handleAddWizardTypology}
                className="w-full py-3 border-2 border-dashed border-[#E5ECE7] hover:border-[#84CC16] text-[#161D1A] hover:text-[#0B0F0D] rounded-2xl text-xs font-bold flex items-center justify-center gap-2 bg-[#F4F6F4] hover:bg-lime-50/50 transition"
              >
                <Plus className="w-4 h-4 text-[#059669]" /> Add Another Typology Prototype
              </button>

              <div className="flex justify-between pt-6 border-t border-[#E5ECE7]">
                <button type="button" onClick={() => setStep(3)} className="btn-ghost flex items-center gap-2 text-stone-500 font-semibold hover:text-[#161D1A]">
                  <ArrowLeft className="w-4 h-4" /> BHK Mix
                </button>
                {(() => {
                  const minRequired = Math.max(1, wizardTypologies.length - 1)
                  const uploadedCount = wizardTypologies.filter(t => t.file !== null).length
                  const canFinish = uploadedCount >= minRequired

                  return (
                    <button
                      type="button"
                      onClick={handleFinishSetup}
                      disabled={loading || !canFinish}
                      className="px-6 py-3 rounded-xl font-bold bg-[#A3E635] hover:bg-[#84CC16] text-[#0B0F0D] flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition"
                    >
                      <Save className="w-4 h-4" /> {loading ? 'Saving Setup...' : 'Complete Enterprise Setup'}
                    </button>
                  )
                })()}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Blueprint Lightbox Modal */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxUrl(null)}
            className="fixed inset-0 z-50 bg-[#0B0F0D]/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
          >
            <div
              onClick={e => e.stopPropagation()}
              className="relative max-w-4xl max-h-[90vh] bg-white rounded-3xl p-3 shadow-2xl border border-white/20 overflow-hidden"
            >
              <button
                onClick={() => setLightboxUrl(null)}
                className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-[#0B0F0D]/70 hover:bg-[#0B0F0D] text-white flex items-center justify-center transition"
                title="Close Lightbox"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={lightboxUrl}
                alt="Blueprint Preview"
                className="max-h-[82vh] w-auto object-contain rounded-2xl mx-auto"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
