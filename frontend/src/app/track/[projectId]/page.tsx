'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { trackingAPI, projectsAPI, customerExtrasAPI } from '@/lib/api'
import Navbar from '@/components/Navbar'
import toast from 'react-hot-toast'
import {
  CheckCircle2, Clock, Circle, ArrowLeft, Sparkles,
  CalendarDays, User2, FileText, Phone, ChevronRight, Wrench, Map, CreditCard, Camera
} from 'lucide-react'
import clsx from 'clsx'
import Link from 'next/link'

const STATUS_CONFIG = {
  completed:   { color: 'bg-emerald-500', ring: 'ring-emerald-200', text: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle2 },
  in_progress: { color: 'bg-indigo-500',  ring: 'ring-indigo-200',  text: 'text-indigo-700',  bg: 'bg-indigo-50',  icon: Sparkles },
  pending:     { color: 'bg-slate-300',   ring: 'ring-slate-200',   text: 'text-slate-500',   bg: 'bg-slate-50',   icon: Clock },
}

const PROJECT_STATUS_COLORS: Record<string, string> = {
  draft:   'bg-slate-100 text-slate-600',
  quoted:  'bg-amber-100 text-amber-700',
  ordered: 'bg-blue-100 text-blue-700',
  done:    'bg-emerald-100 text-emerald-700',
}

export default function TrackPage() {
  const { projectId } = useParams() as { projectId: string }
  const router = useRouter()
  const [project, setProject] = useState<any>(null)
  const [milestones, setMilestones] = useState<any[]>([])
  const [proofPhotos, setProofPhotos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [projRes, trackRes, proofsRes] = await Promise.all([
          projectsAPI.get(projectId),
          trackingAPI.getMilestones(projectId),
          customerExtrasAPI.getProofPhotos(projectId),
        ])
        setProject(projRes.data)
        setMilestones(trackRes.data.milestones || [])
        setProofPhotos(proofsRes.data.proof_photos || [])
      } catch {
        toast.error('Failed to load tracking data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [projectId])

  const completedCount = milestones.filter(m => m.status === 'completed').length
  const progressPct = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="spinner w-12 h-12" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-16">

        {/* Back */}
        <button onClick={() => router.back()} className="btn-ghost mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Project header card */}
        <div className="bg-gradient-to-br from-indigo-700 to-indigo-950 rounded-2xl p-8 text-white mb-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-indigo-300 text-sm mb-1">{project?.bhk_type} • {project?.city}</p>
              <h1 className="text-2xl font-bold">{project?.property_name}</h1>
              <p className="text-indigo-200 text-sm mt-1">Budget: ₹{((project?.budget || 0)/100000).toFixed(1)}L</p>
            </div>
            <span className={clsx('badge text-sm font-semibold capitalize', PROJECT_STATUS_COLORS[project?.status] || '')}>
              {project?.status}
            </span>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-indigo-300">Project Progress</span>
              <span className="text-white font-bold">{progressPct}%</span>
            </div>
            <div className="h-2.5 bg-indigo-900/60 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-indigo-400 to-emerald-400 rounded-full"
              />
            </div>
            <p className="text-indigo-300 text-xs mt-2">{completedCount} of {milestones.length} milestones completed</p>
          </div>
        </div>

        {/* Milestones timeline */}
        <div className="bg-white rounded-2xl shadow-card p-6 mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Execution Timeline</h2>
          <div className="relative">
            {milestones.map((ms, i) => {
              const cfg = STATUS_CONFIG[ms.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending
              const Icon = cfg.icon
              const isLast = i === milestones.length - 1

              return (
                <motion.div
                  key={ms.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="relative flex gap-5 pb-8"
                >
                  {/* Vertical line */}
                  {!isLast && (
                    <div className={clsx(
                      'absolute left-5 top-10 bottom-0 w-0.5',
                      ms.status === 'completed' ? 'bg-emerald-300' : 'bg-slate-200'
                    )} />
                  )}

                  {/* Icon + ring */}
                  <div className={clsx('relative flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ring-4 z-10', cfg.color, cfg.ring)}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>

                  {/* Content */}
                  <div className={clsx('flex-1 rounded-xl p-4 border', ms.status === 'completed' ? 'bg-emerald-50 border-emerald-100' : ms.status === 'in_progress' ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-100')}>
                    <div className="flex items-start justify-between mb-1">
                      <h3 className={clsx('font-semibold', cfg.text)}>{ms.title}</h3>
                      <span className={clsx('badge text-xs capitalize', cfg.bg, cfg.text)}>{ms.status.replace('_', ' ')}</span>
                    </div>
                    <p className="text-slate-500 text-sm mb-3">{ms.description}</p>
                    <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                      {ms.due_date && (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          Due: {ms.due_date}
                        </span>
                      )}
                      {ms.completed_date && (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="w-3 h-3" />
                          Completed: {ms.completed_date}
                        </span>
                      )}
                      {ms.vendor_name && (
                        <span className="flex items-center gap-1">
                          <User2 className="w-3 h-3" />
                          {ms.vendor_name}
                        </span>
                      )}
                    </div>
                    {ms.notes && (
                      <p className="mt-2 text-xs text-slate-500 italic border-t border-slate-200 pt-2">{ms.notes}</p>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Vendor Photo Proofs Gallery */}
        {proofPhotos && proofPhotos.length > 0 && (
          <div className="bg-white rounded-2xl shadow-card p-6 mb-8">
            <h2 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Camera className="w-5 h-5 text-indigo-650" /> Vendor Execution Photo Proofs
            </h2>
            <p className="text-xs text-slate-400 mb-6">Real-time photos uploaded by our verified vendors during manufacturing, transit, and installation.</p>
            
            <div className="space-y-6">
              {proofPhotos.map((item) => (
                <div key={item.assignment_id} className="border-t border-slate-100 pt-4 first:border-0 first:pt-0">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-slate-800 text-sm">{item.product_name}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-150">
                      Status: {item.status?.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {item.proofs.map((proof: any) => {
                      const fullUrl = proof.image_url.startsWith('/') 
                        ? `http://localhost:8000${proof.image_url}` 
                        : proof.image_url;
                      return (
                        <div key={proof.id} className="relative group border border-slate-100 rounded-xl overflow-hidden bg-slate-50">
                          <img
                            src={fullUrl}
                            alt={proof.caption || "Proof"}
                            className="w-full h-28 object-cover"
                          />
                          <div className="absolute inset-0 bg-slate-900/70 opacity-0 group-hover:opacity-100 flex flex-col justify-end p-2.5 transition duration-200">
                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block">{proof.image_type}</span>
                            <span className="text-[10px] text-white font-medium truncate block mt-0.5">{proof.caption}</span>
                            <a
                              href={fullUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 text-center py-1 bg-indigo-600 hover:bg-indigo-750 text-white rounded-lg text-[9px] font-bold transition"
                            >
                              Open Full Photo
                            </a>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Link href={`/quotation/${projectId}`}
            className="bg-white rounded-2xl shadow-card p-5 flex flex-col gap-4 hover:shadow-card-hover transition-all card-hover">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <div className="font-semibold text-slate-800 text-sm">View Quotation</div>
              <div className="text-xs text-slate-400">Download PDF</div>
            </div>
          </Link>

          <Link href={`/visualize/${projectId}`}
            className="bg-white rounded-2xl shadow-card p-5 flex flex-col gap-4 hover:shadow-card-hover transition-all card-hover">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="font-semibold text-slate-800 text-sm">AI Visualise</div>
              <div className="text-xs text-slate-400">Renders</div>
            </div>
          </Link>

          <Link href={`/track/${projectId}/payments`}
            className="bg-white rounded-2xl shadow-card p-5 flex flex-col gap-4 hover:shadow-card-hover transition-all card-hover">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <div className="font-semibold text-slate-800 text-sm">Payments</div>
              <div className="text-xs text-slate-400">Invoices & Receipts</div>
            </div>
          </Link>

          <Link href={`/track/${projectId}/execution`}
            className="bg-white rounded-2xl shadow-card p-5 flex flex-col gap-4 hover:shadow-card-hover transition-all card-hover">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="font-semibold text-slate-800 text-sm">Execution</div>
              <div className="text-xs text-slate-400">Status & Photos</div>
            </div>
          </Link>

          <Link href={`/track/${projectId}/floorplans`}
            className="bg-white rounded-2xl shadow-card p-5 flex flex-col gap-4 hover:shadow-card-hover transition-all card-hover">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Map className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="font-semibold text-slate-800 text-sm">Floor Plans</div>
              <div className="text-xs text-slate-400">Upload & Manage</div>
            </div>
          </Link>

          <Link href="/support"
            className="bg-white rounded-2xl shadow-card p-5 flex flex-col gap-4 hover:shadow-card-hover transition-all card-hover">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Phone className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="font-semibold text-slate-800 text-sm">Support Center</div>
              <div className="text-xs text-slate-400">Tickets & Help</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
