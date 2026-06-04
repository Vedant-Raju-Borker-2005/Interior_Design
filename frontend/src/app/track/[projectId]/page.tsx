'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { customerAPI, projectsAPI } from '@/lib/api'
import Navbar from '@/components/Navbar'
import toast from 'react-hot-toast'
import {
  CheckCircle2, Clock, Circle, ArrowLeft, Sparkles,
  CalendarDays, User2, FileText, Phone, ChevronRight, Wrench, Map, CreditCard
} from 'lucide-react'
import clsx from 'clsx'
import Link from 'next/link'

const STATUS_CONFIG = {
  delivered:   { color: 'bg-emerald-500', ring: 'ring-emerald-200', text: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle2 },
  in_transit:  { color: 'bg-indigo-500',  ring: 'ring-indigo-200',  text: 'text-indigo-700',  bg: 'bg-indigo-50',  icon: Sparkles },
  ordered:     { color: 'bg-slate-300',   ring: 'ring-slate-200',   text: 'text-slate-500',   bg: 'bg-slate-50',   icon: Clock },
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
  const [trackings, setTrackings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [selectedTracking, setSelectedTracking] = useState<string | null>(null)
  const [updateForm, setUpdateForm] = useState({ status: '', remarks: '', actual_date: '' })

  useEffect(() => {
    const load = async () => {
      try {
        const [projRes, trackRes] = await Promise.all([
          projectsAPI.get(projectId),
          customerAPI.getTracking(projectId),
        ])
        setProject(projRes.data)
        setTrackings(trackRes.data)
      } catch {
        toast.error('Failed to load tracking data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [projectId])

  const handleUpdateTracking = async (trackingId: string) => {
    setUpdating(trackingId)
    try {
      await customerAPI.updateTracking(
        projectId,
        trackingId,
        updateForm.status,
        updateForm.remarks,
        updateForm.actual_date
      )
      setTrackings(trackings.map(t => 
        t.id === trackingId 
          ? { ...t, ...updateForm }
          : t
      ))
      toast.success('Tracking updated!')
      setSelectedTracking(null)
      setUpdateForm({ status: '', remarks: '', actual_date: '' })
    } catch {
      toast.error('Failed to update tracking')
    } finally {
      setUpdating(null)
    }
  }

  const deliveredCount = trackings.filter(t => t.status === 'delivered').length
  const progressPct = trackings.length > 0 ? Math.round((deliveredCount / trackings.length) * 100) : 0

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
            <p className="text-indigo-300 text-xs mt-2">{deliveredCount} of {trackings.length} items delivered</p>
          </div>
        </div>

        {/* Milestones timeline */}
        <div className="bg-white rounded-2xl shadow-card p-6 mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Delivery Tracking</h2>
          <div className="space-y-4">
            {trackings.map((track) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-50 rounded-xl p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{track.item_name}</h3>
                    <p className="text-sm text-slate-500">{track.room_name}</p>
                  </div>
                  <span className={clsx('badge text-xs capitalize', 
                    track.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                    track.status === 'in_transit' ? 'bg-indigo-100 text-indigo-700' :
                    'bg-slate-100 text-slate-600'
                  )}>
                    {track.status}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                  <div>
                    <p className="text-slate-500 text-xs mb-0.5">Expected Delivery</p>
                    <p className="text-slate-900 font-medium">{track.expected_date}</p>
                  </div>
                  {track.actual_date && (
                    <div>
                      <p className="text-slate-500 text-xs mb-0.5">Actual Delivery</p>
                      <p className="text-emerald-700 font-medium">{track.actual_date}</p>
                    </div>
                  )}
                </div>

                {track.remarks && (
                  <p className="text-sm text-slate-600 border-l-2 border-slate-200 pl-3 mb-3">{track.remarks}</p>
                )}

                {/* Update button */}
                <button
                  onClick={() => {
                    setSelectedTracking(selectedTracking === track.id ? null : track.id)
                    if (selectedTracking !== track.id) {
                      setUpdateForm({ 
                        status: track.status, 
                        remarks: track.remarks || '',
                        actual_date: track.actual_date || ''
                      })
                    }
                  }}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  {selectedTracking === track.id ? 'Cancel' : 'Update Status'}
                </button>

                {/* Update Form */}
                {selectedTracking === track.id && (
                  <div className="mt-4 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                    <div className="grid gap-3 mb-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-700">Status</label>
                        <select
                          value={updateForm.status}
                          onChange={(e) => setUpdateForm({...updateForm, status: e.target.value})}
                          className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm"
                        >
                          <option value="ordered">Ordered</option>
                          <option value="in_transit">In Transit</option>
                          <option value="delivered">Delivered</option>
                        </select>
                      </div>

                      {updateForm.status === 'delivered' && (
                        <div>
                          <label className="text-xs font-semibold text-slate-700">Delivery Date</label>
                          <input
                            type="date"
                            value={updateForm.actual_date}
                            onChange={(e) => setUpdateForm({...updateForm, actual_date: e.target.value})}
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm"
                          />
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-semibold text-slate-700">Remarks (optional)</label>
                        <textarea
                          value={updateForm.remarks}
                          onChange={(e) => setUpdateForm({...updateForm, remarks: e.target.value})}
                          placeholder="Add notes about delivery..."
                          className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm"
                          rows={2}
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => handleUpdateTracking(track.id)}
                      disabled={updating === track.id}
                      className="w-full btn-primary py-2 text-sm"
                    >
                      {updating === track.id ? 'Updating...' : 'Update Tracking'}
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>

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
