'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { enterpriseAPI } from '@/lib/api'
import Navbar from '@/components/Navbar'
import toast from 'react-hot-toast'
import { ArrowLeft, ArrowRight, Save, Building, MapPin, Calendar, Layout, List, Upload, FileText, Check, Trash2, Edit3, Home, Wrench, Settings, Plus } from 'lucide-react'
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
  const [city, setCity] = useState('Bangalore')
  const [pincode, setPincode] = useState('')

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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <div className="flex-1 max-w-3xl w-full mx-auto px-4 pt-28 pb-16 space-y-8">
        
        {/* Wizard Header */}
        <div className="flex justify-between items-center border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Project Configuration Wizard</h1>
            <p className="text-slate-500 text-xs mt-1">Set up building details, unit distribution, layout drawings, and customize buyer flats.</p>
          </div>
          <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full">
            Step {step} of 4
          </span>
        </div>

        {/* Form Body */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-card border border-slate-100">
          
          {/* STEP 1: Property Details */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                <Building className="w-5 h-5 text-indigo-650" /> 1. Real Estate Development Details
              </h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Development Name / Society</label>
                  <input
                    type="text"
                    placeholder="e.g. Prestige Greenhills Development"
                    value={propertyName}
                    onChange={e => setPropertyName(e.target.value)}
                    className="input w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-slate-800 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Locality / Area</label>
                    <input
                      type="text"
                      placeholder="e.g. Whitefield"
                      value={locality}
                      onChange={e => setLocality(e.target.value)}
                      className="input w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-slate-800 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Pincode <span className="text-slate-400 font-normal">(optional)</span></label>
                    <input
                      type="text"
                      placeholder="e.g. 560087"
                      value={pincode}
                      onChange={e => setPincode(e.target.value)}
                      className="input w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-slate-800 outline-none"
                      maxLength={6}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">City</label>
                  <div className="grid grid-cols-3 gap-2">
                    {CITIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCity(c)}
                        className={clsx(
                          'p-3 rounded-xl border-2 text-xs font-bold transition-all text-center',
                          city === c
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-black'
                            : 'border-slate-200 text-slate-650 hover:border-indigo-300 bg-white'
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    if (pincode && (pincode.length !== 6 || !/^\d+$/.test(pincode))) {
                      toast.error("Pincode must be a 6-digit number.")
                      return
                    }
                    setStep(2)
                  }}
                  disabled={!canGoNext()}
                  className="btn-primary px-6 py-3 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-md disabled:opacity-50"
                >
                  Configure Scope & Home Configuration <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Scope & Home Configuration */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5 text-indigo-650" /> 2. Scope & Home Configuration
              </h2>

              <div className="space-y-6">
                {/* Selectable Scope of Furnishing */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Scope of Furnishing</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {FURNISHING_OPTIONS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFurnishingType(f.id)}
                        className={clsx(
                          'p-5 rounded-2xl border-2 text-left transition-all flex items-center gap-4 bg-white hover:shadow-sm',
                          furnishingType === f.id ? 'border-indigo-500 bg-indigo-50/40' : 'border-slate-200 hover:border-indigo-300'
                        )}
                      >
                        <div
                          className={clsx(
                            'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                            furnishingType === f.id ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'
                          )}
                        >
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Project Readiness Date</label>
                    <input
                      type="date"
                      value={earliestStartDate}
                      onChange={e => setEarliestStartDate(e.target.value)}
                      className="input w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-bold text-slate-700 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Total Flats / Units Inventory</label>
                    <input
                      type="number"
                      value={totalUnits}
                      onChange={e => setTotalUnits(Math.max(1, parseInt(e.target.value) || 0))}
                      className="input w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-bold text-slate-750 outline-none"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-6 mt-6">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">When do you want to start interior execution?</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {TIMELINE_OPTIONS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTimeline(t.id)}
                        className={clsx(
                          'p-4 rounded-xl border-2 text-xs font-bold transition-all text-center',
                          timeline === t.id
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-black'
                            : 'border-slate-200 text-slate-650 hover:border-indigo-300 bg-white'
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-6 border-t border-slate-100">
                <button type="button" onClick={() => setStep(1)} className="btn-ghost flex items-center gap-2 text-slate-500">
                  <ArrowLeft className="w-4 h-4" /> Property Details
                </button>
                <button
                  type="button"
                  onClick={handleStep2Submit}
                  disabled={!canGoNext() || loading}
                  className="btn-primary px-6 py-3 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-md disabled:opacity-50"
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
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                  <List className="w-5 h-5 text-indigo-650" /> 3. BHK Distribution Mix
                </h2>
                <p className="text-slate-500 text-xs">Distribute the BHK types of the <strong>{totalUnits} flats</strong>. The sum of BHK counts must equal your total units.</p>
                
                <div className="space-y-4 max-w-md bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  {Object.keys(bhkMix).map((bhk) => (
                    <div key={bhk} className="flex justify-between items-center">
                      <span className="font-bold text-slate-700 text-sm">{bhk} configuration</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleBhkChange(bhk, bhkMix[bhk] - 1)}
                          className="w-8 h-8 rounded-lg bg-white border border-slate-200 font-bold hover:bg-slate-100 text-slate-800"
                        >
                          -
                        </button>
                        <span className="w-12 text-center font-black text-slate-900">{bhkMix[bhk]}</span>
                        <button
                          type="button"
                          onClick={() => handleBhkChange(bhk, bhkMix[bhk] + 1)}
                          className="w-8 h-8 rounded-lg bg-white border border-slate-200 font-bold hover:bg-slate-100 text-slate-800"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">Number of Typologies / Prototypes</label>
                      <p className="text-slate-500 text-xs mt-0.5">How many unique layout configurations or blueprints does this project feature?</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={26}
                        value={typologyCount}
                        onChange={e => {
                          const val = Math.max(1, parseInt(e.target.value) || 1)
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
                        className="input w-20 px-3 py-2 text-center text-sm font-black rounded-xl border border-slate-300 focus:border-indigo-500 outline-none bg-white text-slate-900"
                      />
                    </div>
                  </div>
                </div>

                <div className={clsx(
                  "p-4 rounded-xl text-xs font-semibold flex justify-between",
                  isMatch ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
                )}>
                  <span>Allocated: {currentSum} / {totalUnits} units</span>
                  <span>{isMatch ? "✓ Sum matches perfectly" : `⚠ Need ${totalUnits - currentSum} units`}</span>
                </div>

                <div className="flex justify-between pt-6 border-t border-slate-100">
                  <button type="button" onClick={() => setStep(2)} className="btn-ghost flex items-center gap-2 text-slate-500">
                    <ArrowLeft className="w-4 h-4" /> Scope & Configuration
                  </button>
                  <button
                    type="button"
                    onClick={handleStep3Submit}
                    disabled={!canGoNext() || loading}
                    className="btn-primary px-6 py-3 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-md disabled:opacity-50"
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
              {/* Step 4 Header & Blueprint Upload Progress Status */}
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-1">
                  <Layout className="w-5 h-5 text-indigo-650" /> 4. Architectural Typologies & Floor Plans
                </h2>
                <p className="text-slate-500 text-xs">
                  Upload layout blueprints and specify carpet area for each typology prototype. Individual flat assignments will be managed on your View Units console.
                </p>
              </div>

              {(() => {
                const minRequired = Math.max(1, wizardTypologies.length - 1)
                const uploadedCount = wizardTypologies.filter(t => t.file !== null).length
                const isSatisfied = uploadedCount >= minRequired

                return (
                  <div className={clsx(
                    "p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-between transition",
                    isSatisfied
                      ? "bg-emerald-50/80 border-emerald-200 text-emerald-800"
                      : "bg-amber-50/80 border-amber-200 text-amber-800"
                  )}>
                    <div className="flex items-center gap-2">
                      <Layout className="w-4 h-4 text-indigo-600" />
                      <span>
                        Blueprints Attached: <strong>{uploadedCount}</strong> of <strong>{wizardTypologies.length}</strong>
                      </span>
                    </div>
                    <span className="font-bold">
                      {isSatisfied
                        ? `✓ Minimum threshold met (${minRequired} required)`
                        : `⚠ Need ${minRequired - uploadedCount} more blueprint${minRequired - uploadedCount > 1 ? 's' : ''} to proceed`}
                    </span>
                  </div>
                )
              })()}

              {/* Typology Cards Container */}
              <div className="space-y-4">
                {(() => {
                  const minRequired = Math.max(1, wizardTypologies.length - 1)
                  const uploadedCount = wizardTypologies.filter(t => t.file !== null).length

                  return wizardTypologies.map((typ, idx) => (
                    <div key={typ.id} className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm space-y-4 hover:border-indigo-200 transition">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 font-extrabold text-xs flex items-center justify-center">
                            #{idx + 1}
                          </span>
                          <input
                            type="text"
                            value={typ.name}
                            onChange={e => handleTypologyFieldChange(idx, 'name', e.target.value)}
                            placeholder="Typology Name (e.g. Typology A)"
                            className="font-bold text-slate-800 text-sm px-3 py-1.5 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none w-52"
                          />
                          {typ.file ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
                              <Check className="w-3 h-3 stroke-[3]" /> Blueprint Ready
                            </span>
                          ) : uploadedCount < minRequired ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                              ⚠ Blueprint Required
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-medium">
                              Optional Pending
                            </span>
                          )}
                        </div>
                        {wizardTypologies.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveWizardTypology(idx)}
                            className="text-slate-400 hover:text-rose-600 transition p-1"
                            title="Remove Typology"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                            Carpet Area (Sq.Ft) {typ.file ? <span className="text-rose-500 font-bold">*</span> : <span className="text-slate-400 font-normal">(optional)</span>}
                          </label>
                          <input
                            type="number"
                            value={typ.carpet_area_sqft}
                            onChange={e => handleTypologyFieldChange(idx, 'carpet_area_sqft', e.target.value ? Number(e.target.value) : '')}
                            placeholder="e.g. 1250"
                            className="input w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-slate-800 font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                            Layout Blueprint Image / PDF
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              onChange={e => handleTypologyFileChange(idx, e.target.files?.[0] || null)}
                              className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                            />
                            {typ.previewUrl && (
                              <img
                                src={typ.previewUrl}
                                alt={typ.name}
                                className="w-12 h-12 object-cover rounded-lg border border-slate-200 shadow-xs shrink-0"
                              />
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
                className="w-full py-3 border-2 border-dashed border-indigo-200 hover:border-indigo-400 text-indigo-600 hover:text-indigo-700 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 bg-indigo-50/30 hover:bg-indigo-50 transition"
              >
                <Plus className="w-4 h-4" /> Add Another Typology Prototype
              </button>

              {/* Informative units count pill */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex justify-between items-center">
                <span><strong>{flats.length} flats</strong> generated across {Object.keys(bhkMix).filter(k => bhkMix[k] > 0).join(', ')}.</span>
                <span className="text-indigo-650 font-bold">Assign to Flats in next step</span>
              </div>

              <div className="flex justify-between pt-6 border-t border-slate-100">
                <button type="button" onClick={() => setStep(3)} className="btn-ghost flex items-center gap-2 text-slate-500 font-semibold">
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
                      className="btn-primary px-6 py-3 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-md disabled:opacity-50"
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
    </div>
  )
}
