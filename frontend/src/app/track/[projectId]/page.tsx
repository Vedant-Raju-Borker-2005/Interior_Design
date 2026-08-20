'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { projectsAPI, trackingAPI, customerExtrasAPI, customerAPI } from '@/lib/api'
import Navbar from '@/components/Navbar'
import toast from 'react-hot-toast'
import {
  CheckCircle2, Clock, Sparkles, ArrowLeft,
  CalendarDays, User2, FileText, Phone, Wrench, Map, CreditCard,
  ChevronRight, AlertCircle, Building2, MapPin
} from 'lucide-react'
import clsx from 'clsx'
import Link from 'next/link'

const STAGES = [
  { id: 'design', label: 'Design Finalized', weight: 10, desc: 'Final design and quotation approved by customer.' },
  { id: 'procurement', label: 'Procurement & Production', weight: 25, desc: 'Components are being processed by vendors.' },
  { id: 'site_prep', label: 'Site Preparation', weight: 15, desc: 'Civil work, false ceiling, and electrical groundwork.' },
  { id: 'installation', label: 'Installation', weight: 30, desc: 'Furniture, modular kitchen, and fixtures installation.' },
  { id: 'quality', label: 'Quality Inspection', weight: 10, desc: 'Full site inspection and punch-list completion.' },
  { id: 'handover', label: 'Project Handover', weight: 10, desc: 'Keys and warranty documents handed over to customer.' }
]

export default function TrackPage() {
  const { projectId } = useParams() as { projectId: string }
  const router = useRouter()
  const [project, setProject] = useState<any>(null)
  const [trackingItems, setTrackingItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [projRes, trackRes] = await Promise.all([
          projectsAPI.get(projectId),
          customerAPI.getTracking(projectId)
        ])
        setProject(projRes.data)
        setTrackingItems(trackRes.data || [])
      } catch {
        toast.error('Failed to load tracking data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [projectId])

  // Weighted Progress Bar and Stage Timeline Calculations
  const timelineData = useMemo(() => {
    let totalProgress = 0
    let currentStageIndex = 0
    let previousStagesMaxed = true
    const total = trackingItems.length || 1

    const calculatedStages = STAGES.map((stage, idx) => {
      let completedCount = 0

      // Count how many components have completed this stage
      trackingItems.forEach(item => {
        const status = (item.status || 'ordered').toLowerCase()
        let completed = false
        if (idx === 0) {
          completed = true
        } else if (idx === 1) {
          completed = ['production', 'ready', 'dispatched', 'delivered', 'installed'].includes(status)
        } else if (idx === 2) {
          completed = ['ready', 'dispatched', 'delivered', 'installed'].includes(status)
        } else if (idx === 3) {
          completed = ['delivered', 'installed'].includes(status)
        } else if (idx === 4) {
          completed = ['installed'].includes(status)
        } else if (idx === 5) {
          completed = ['installed'].includes(status) && project?.status === 'done'
        }
        if (completed) completedCount++
      })

      const isAllCompleted = completedCount === total && total > 0
      
      let contribution = 0
      if (previousStagesMaxed) {
        contribution = (completedCount / total) * stage.weight
        totalProgress += contribution
        if (!isAllCompleted) {
          previousStagesMaxed = false
          currentStageIndex = idx
        }
      }

      // Determine stage display status:
      // - "completed" (Green) if all components completed it
      // - "in_progress" (Purple) if it is the current active stage
      // - "pending" (Gray) if it is a future stage
      let displayStatus: 'completed' | 'in_progress' | 'pending' = 'pending'
      if (isAllCompleted) {
        displayStatus = 'completed'
      } else if (idx === currentStageIndex && !previousStagesMaxed) {
        displayStatus = 'in_progress'
      } else if (idx === 0 && !isAllCompleted) {
        displayStatus = 'in_progress'
      }

      return {
        ...stage,
        completedCount,
        totalCount: total,
        displayStatus,
        contribution
      }
    })

    return {
      progressPct: Math.round(totalProgress),
      stages: calculatedStages
    }
  }, [trackingItems, project])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="spinner w-12 h-12" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 pt-24 pb-16 space-y-6">

        {/* Back Button */}
        <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-indigo-700 hover:text-indigo-900 transition font-bold text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        {/* Header ID Card Format (Replacing blue block) */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <span className="text-[10px] font-black text-indigo-650 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full uppercase tracking-wider">
              Project Execution Status
            </span>
            <h1 className="text-2xl font-black text-slate-850 mt-3 tracking-tight">{project?.property_name || 'Reliance'}</h1>
            <div className="flex items-center gap-3 text-slate-400 text-xs mt-2 font-semibold">
              <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {project?.bhk_type || '3BHK'}</span>
              <span>•</span>
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {project?.city || 'Hyderabad'}</span>
              <span>•</span>
              <span>Project ID: PRJ-2026-{(project?.id || '').substring(0, 4).toUpperCase()}</span>
            </div>
          </div>
          <div className="text-left md:text-right flex flex-col md:items-end gap-1 bg-slate-50 border border-slate-100 p-4 rounded-2xl min-w-[200px]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expected Completion</span>
            <span className="text-lg font-black text-indigo-650">31 Aug 2026</span>
          </div>
        </div>

        {/* Three Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">

          {/* Left Sidebar: View Quotation, AI Visualize, Floor Plans (25% width) */}
          <div className="lg:col-span-1 space-y-4">
            
            <Link href={`/quotation/${projectId}`}
              className="bg-white border border-slate-200/60 rounded-3xl p-5 flex flex-col gap-4 hover:shadow-card hover:border-slate-300 transition-all cursor-pointer group block">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">View Quotation</h3>
                <p className="text-xs text-slate-450 mt-1">View and download your approved quotation.</p>
              </div>
            </Link>

            <Link href={`/visualize/${projectId}?from=track`}
              className="bg-white border border-slate-200/60 rounded-3xl p-5 flex flex-col gap-4 hover:shadow-card hover:border-slate-300 transition-all cursor-pointer group block">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">AI Visualize</h3>
                <p className="text-xs text-slate-450 mt-1">Explore your AI generated interior designs.</p>
              </div>
            </Link>

            <Link href={`/track/${projectId}/floorplans`}
              className="bg-white border border-slate-200/60 rounded-3xl p-5 flex flex-col gap-4 hover:shadow-card hover:border-slate-300 transition-all cursor-pointer group block">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Map className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Floor Plans</h3>
                <p className="text-xs text-slate-450 mt-1">View your uploaded and generated floor plans.</p>
              </div>
            </Link>

          </div>

          {/* Center Column: Progress bar & Execution Timeline (50% width) */}
          <div className="lg:col-span-2 space-y-6 bg-indigo-600 rounded-[32px] p-6 shadow-glow-indigo border border-indigo-750/30">

            {/* Progress Bar Card */}
            <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center text-sm font-extrabold text-slate-800">
                <span className="text-slate-500 text-xs uppercase tracking-wider">Project Progress</span>
                <span className="text-indigo-650 text-base">{timelineData.progressPct}%</span>
              </div>
              <div className="h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/50">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${timelineData.progressPct}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-indigo-500 to-indigo-750 rounded-full"
                />
              </div>
              <p className="text-slate-450 text-[10px] font-bold uppercase tracking-wider">
                Weighted calculation across all room components
              </p>
            </div>

            {/* Execution Timeline Card */}
            <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-6">
              <h2 className="text-xs font-black text-slate-450 uppercase tracking-widest border-b border-slate-100 pb-3">Execution Timeline</h2>
              
              <div className="relative pl-6 space-y-6">
                
                {/* Timeline connector line */}
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-100" />

                {timelineData.stages.map((st, idx) => {
                  const isCompleted = st.displayStatus === 'completed'
                  const isInProgress = st.displayStatus === 'in_progress'

                  return (
                    <div key={st.id} className="relative flex gap-5 items-start">
                      
                      {/* Timeline dot */}
                      <div className={clsx(
                        'absolute -left-[20px] w-3 h-3 rounded-full border-2 z-10 top-1.5 transition-all duration-300',
                        isCompleted ? 'bg-emerald-500 border-emerald-600 scale-110' :
                        isInProgress ? 'bg-indigo-600 border-indigo-700 ring-4 ring-indigo-100 scale-125' :
                        'bg-white border-slate-350'
                      )} />

                      {/* Timeline details content */}
                      <div className={clsx(
                        'flex-1 rounded-2xl p-4 border transition duration-300',
                        isCompleted ? 'bg-emerald-50/40 border-emerald-100/60' :
                        isInProgress ? 'bg-indigo-50/50 border-indigo-100' :
                        'bg-slate-50/30 border-slate-100'
                      )}>
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <h3 className={clsx(
                            'font-extrabold text-sm',
                            isCompleted ? 'text-emerald-700' :
                            isInProgress ? 'text-indigo-950' : 'text-slate-500'
                          )}>
                            {st.label}
                          </h3>
                          <span className={clsx(
                            'px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider',
                            isCompleted ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                            isInProgress ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                            'bg-slate-100 text-slate-400 border border-slate-200/60'
                          )}>
                            {st.displayStatus.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">{st.desc}</p>
                        <div className="flex items-center gap-2 mt-3 text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                          <span>Progress: {st.completedCount} / {st.totalCount} Components</span>
                          <span>•</span>
                          <span>Weight: {st.weight}%</span>
                        </div>
                      </div>

                    </div>
                  )
                })}

              </div>
            </div>

          </div>

          {/* Right Sidebar: Execution, Payments, Support Center (25% width) */}
          <div className="lg:col-span-1 space-y-4">
            
            <Link href={`/track/${projectId}/execution`}
              className="bg-white border border-slate-200/60 rounded-3xl p-5 flex flex-col gap-4 hover:shadow-card hover:border-slate-300 transition-all cursor-pointer group block">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Wrench className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Execution</h3>
                <p className="text-xs text-slate-450 mt-1">Track real-time progress of all components and tasks.</p>
              </div>
            </Link>

            <Link href={`/track/${projectId}/payments`}
              className="bg-white border border-slate-200/60 rounded-3xl p-5 flex flex-col gap-4 hover:shadow-card hover:border-slate-300 transition-all cursor-pointer group block">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center group-hover:scale-105 transition-transform">
                <CreditCard className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Payments</h3>
                <p className="text-xs text-slate-450 mt-1">View invoices, payments, and receipt details.</p>
              </div>
            </Link>

            <Link href="/support"
              className="bg-white border border-slate-200/60 rounded-3xl p-5 flex flex-col gap-4 hover:shadow-card hover:border-slate-300 transition-all cursor-pointer group block">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Phone className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Support Center</h3>
                <p className="text-xs text-slate-450 mt-1">Raise a ticket or get help from our support team.</p>
              </div>
            </Link>

          </div>

        </div>

      </div>
    </div>
  )
}
