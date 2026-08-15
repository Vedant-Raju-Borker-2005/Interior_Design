'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { projectsAPI } from '@/lib/api'
import Navbar from '@/components/Navbar'
import toast from 'react-hot-toast'
import { ArrowRight, CheckCircle2, Upload, FileText, Layout, Check } from 'lucide-react'
import clsx from 'clsx'
import { Suspense } from 'react'

function FloorLayoutContent() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const projectId = params?.projectId as string

  const bhk = searchParams?.get('bhk') || '2BHK'
  const budget = searchParams?.get('budget') || '1000000'
  const style = searchParams?.get('style') || ''

  const [floorPlanMode, setFloorPlanMode] = useState<'select' | 'upload'>('select')
  const [selectedPlanId, setSelectedPlanId] = useState('plan-standard')
  const [uploadFile, setUploadFile] = useState<{ name: string; size: string; type: string } | null>(null)
  const [realFile, setRealFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Visual Mock Plans list based on selected BHK
  const getMockPlans = (bhkVal: string) => {
    const cleanBhk = bhkVal || '2BHK'
    return [
      { id: 'plan-compact', name: `${cleanBhk} Compact Layout`, size: cleanBhk === '1BHK' ? '550 sqft' : cleanBhk === '2BHK' ? '950 sqft' : '1450 sqft', desc: 'Optimised space saving design with linear modular solutions.' },
      { id: 'plan-standard', name: `${cleanBhk} Premium Layout`, size: cleanBhk === '1BHK' ? '680 sqft' : cleanBhk === '2BHK' ? '1120 sqft' : '1750 sqft', desc: 'Spacious common zones, dedicated work-from-home alcove.' },
      { id: 'plan-luxury', name: `${cleanBhk} Spacious Luxury Layout`, size: cleanBhk === '1BHK' ? '820 sqft' : cleanBhk === '2BHK' ? '1350 sqft' : '2100 sqft', desc: 'Double balconies, master suite with walk-in wardrobe area.' }
    ]
  }

  const handleFakeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setRealFile(file)
    setUploadFile({
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
      type: file.type.includes('pdf') ? 'pdf' : 'image'
    })
    setUploading(false)
    toast.success('Floor plan selected! 📐')
  }

  const handleNext = async () => {
    if (floorPlanMode === 'upload' && !realFile) {
      toast.error('Please upload a floor plan blueprint file first.')
      return
    }

    setSubmitting(true)
    try {
      let finalPlanName = 'Standard 2D Layout Plan'
      if (floorPlanMode === 'select') {
        const selectedPlan = getMockPlans(bhk).find(p => p.id === selectedPlanId)
        finalPlanName = selectedPlan ? `${selectedPlan.name} (${selectedPlan.size})` : 'Selected standard plan'
      } else if (uploadFile) {
        finalPlanName = `Uploaded Plan: ${uploadFile.name} (${uploadFile.size})`
      }

      // If B2C user uploads floor plan file, send to server
      if (floorPlanMode === 'upload' && realFile && projectId) {
        await projectsAPI.uploadFloorPlan(projectId, realFile)
        toast.success('Blueprint saved on server! 💾')
      }

      toast.success('Floor plan associated!')
      router.push(`/packages?projectId=${projectId}&bhk=${bhk}&budget=${budget}&style=${style}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to submit floor plan')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 pt-28 pb-16">
        
        <div className="text-center max-w-lg mx-auto mb-8">
          <h2 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Select Floor Plan Layout</h2>
          <p className="text-slate-500 text-sm">Pick a standard pre-designed blueprint layout matching your BHK type, or upload your own architectural floor plan.</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 md:p-8 shadow-card border border-slate-100 space-y-6"
        >
          {/* Tabs */}
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl max-w-sm mx-auto">
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
            <div className="grid sm:grid-cols-3 gap-4 pt-4">
              {getMockPlans(bhk).map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={clsx(
                    'p-5 rounded-xl border-2 text-left transition-all relative flex flex-col justify-between h-44 bg-white hover:border-indigo-300 shadow-sm hover:shadow-md',
                    selectedPlanId === plan.id
                      ? 'border-indigo-500 bg-indigo-50/20'
                      : 'border-slate-200'
                  )}
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-slate-800 text-sm">{plan.name}</span>
                      {selectedPlanId === plan.id && (
                        <div className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0">
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
            <div className="space-y-4 pt-4">
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center bg-slate-50/50 hover:bg-slate-50 transition relative">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFakeUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploading}
                />
                {uploading ? (
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-2" />
                    <p className="text-slate-500 font-bold text-sm">Processing blueprint...</p>
                  </div>
                ) : uploadFile ? (
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 animate-bounce">
                      {uploadFile.type === 'pdf' ? <FileText className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
                    </div>
                    <p className="text-slate-850 font-bold text-sm truncate max-w-xs">{uploadFile.name}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{uploadFile.size}</p>
                    <span className="mt-3 bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Blueprint Selected
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
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              onClick={handleNext}
              disabled={submitting || (floorPlanMode === 'upload' && !realFile)}
              className="btn-primary disabled:opacity-50 px-6 py-3 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-md"
            >
              {submitting ? 'Associating Plan...' : 'Proceed to Packages'} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default function FloorLayoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    }>
      <FloorLayoutContent />
    </Suspense>
  )
}
