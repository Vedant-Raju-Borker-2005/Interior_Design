'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { enterpriseAPI } from '@/lib/api'
import Navbar from '@/components/Navbar'
import toast from 'react-hot-toast'
import { ArrowLeft, ArrowRight, Save, Building, MapPin, Calendar, Layout, List, Upload, FileText, Check, Trash2, Edit3, Home, Wrench, Settings } from 'lucide-react'
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
      
      toast.success("Flat units generated successfully!")
      setStep(4)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to configure BHK distribution.")
    } finally {
      setLoading(false)
    }
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

  const handleFinishSetup = () => {
    toast.success("Enterprise project setup completed successfully! 🎉")
    if (projectId) {
      router.push(`/enterprise/project/${projectId}`)
    } else {
      router.push('/enterprise/dashboard')
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

          {/* STEP 4: Floor Plans & Flats Configuration */}
          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                <Layout className="w-5 h-5 text-indigo-650" /> 4. Floor Plans & Flat Setup
              </h2>
              <p className="text-slate-500 text-xs">Optional: Upload layout blueprints and configure/rename unit names and link templates.</p>

              {/* Upload controls */}
              <div className="flex flex-col sm:flex-row gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <div className="flex-1 space-y-3">
                  <input
                    type="text"
                    placeholder="Layout Label (e.g. 2 BHK Premium Type A)"
                    value={uploadName}
                    onChange={e => setUploadName(e.target.value)}
                    className="input w-full px-4 py-2 text-xs rounded-xl border border-slate-200 focus:border-indigo-500 outline-none"
                  />
                  <input
                    id="fp-file-input"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={e => setUploadFile(e.target.files?.[0] || null)}
                    className="text-xs text-slate-500 w-full"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleUploadFloorPlan}
                  disabled={uploading || !uploadFile || !uploadName.trim()}
                  className="px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl flex items-center gap-2 self-end sm:self-center"
                >
                  {uploading ? 'Uploading...' : 'Upload Template'} <Check className="w-4 h-4" />
                </button>
              </div>

              {/* Uploaded layouts list */}
              {uploadedPlans.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Uploaded Floor Plan Layouts</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {uploadedPlans.map((plan) => (
                      <div key={plan.id} className="flex items-center justify-between p-3.5 border border-slate-200 rounded-xl bg-white text-xs">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-slate-400" />
                          <span className="font-bold text-slate-700">{plan.layout_name}</span>
                        </div>
                        <a href={plan.file_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-extrabold hover:underline">
                          View plan
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Editing Modal Inside Step */}
              {editingFlatIndex !== null && (
                <div className="p-5 border border-indigo-200 rounded-2xl bg-indigo-50/30 space-y-4 mb-4">
                  <h3 className="text-xs font-extrabold text-indigo-800 uppercase tracking-wider">Edit Flat Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Flat Number / Label</label>
                      <input
                        type="text"
                        value={editFlatNumber}
                        onChange={e => setEditFlatNumber(e.target.value)}
                        className="input w-full px-3 py-2 text-xs rounded-lg border border-slate-200 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">BHK Configuration</label>
                      <select
                        value={editBhkType}
                        onChange={e => setEditBhkType(e.target.value)}
                        className="select w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white outline-none"
                      >
                        <option value="1BHK">1 BHK</option>
                        <option value="2BHK">2 BHK</option>
                        <option value="3BHK">3 BHK</option>
                        <option value="4BHK">4 BHK</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Floor Plan Layout</label>
                      <select
                        value={editFloorPlanId}
                        onChange={e => setEditFloorPlanId(e.target.value)}
                        className="select w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white outline-none"
                      >
                        <option value="">No layout linked</option>
                        {uploadedPlans.map(p => (
                          <option key={p.id} value={p.id}>{p.layout_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setEditingFlatIndex(null)}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-350 text-slate-700 font-bold rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveFlatEdit}
                      disabled={loading}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg"
                    >
                      Save Flat details
                    </button>
                  </div>
                </div>
              )}

              {/* Flats list */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-h-96 overflow-y-auto pr-1">
                {flats.map((flat, idx) => (
                  <div key={flat.id} className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col justify-between h-32 hover:border-indigo-300 relative group">
                    <div>
                      <span className="font-extrabold text-slate-800 text-sm">Flat {flat.flat_number}</span>
                      <span className="block text-[10px] font-semibold text-slate-500 mt-1 bg-slate-100 rounded px-1.5 py-0.5 inline-block">
                        {flat.bhk_type}
                      </span>
                      {flat.floor_plan_name && (
                        <span className="block text-[9px] text-indigo-700 font-bold truncate max-w-full mt-2" title={flat.floor_plan_name}>
                          Layout: {flat.floor_plan_name}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleStep4Edit(idx)}
                      className="absolute bottom-3 right-3 text-slate-400 hover:text-indigo-650 focus:outline-none"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-between pt-6 border-t border-slate-100">
                <button type="button" onClick={() => setStep(3)} className="btn-ghost flex items-center gap-2 text-slate-500">
                  <ArrowLeft className="w-4 h-4" /> BHK Mix Mix
                </button>
                <button
                  type="button"
                  onClick={handleFinishSetup}
                  className="btn-primary px-6 py-3 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-md"
                >
                  <Save className="w-4 h-4" /> Complete Enterprise Setup
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  )
}
