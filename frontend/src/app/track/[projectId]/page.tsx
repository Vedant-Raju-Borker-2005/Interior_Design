'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { projectsAPI, customerAPI, customerExtrasAPI, quotationsAPI } from '@/lib/api'
import { useCustomerStore } from '@/stores/customerStore'
import { useAuthStore } from '@/stores/authStore'
import Navbar from '@/components/Navbar'
import toast from 'react-hot-toast'
import {
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowLeft,
  Building2,
  MapPin,
  ChevronDown,
  ChevronUp,
  FileText,
  CreditCard,
  Layers,
  Eye,
  Camera,
  Search,
  Filter,
  AlertTriangle,
  ExternalLink,
  Download,
  X,
  ChevronRight,
  ShieldCheck,
  Wrench,
  Package,
  Truck,
  History,
  Upload,
  Trash2,
  Image as ImageIcon,
  Calendar,
  Info,
} from 'lucide-react'
import clsx from 'clsx'
import Link from 'next/link'

// 6 Core Progress Stages - STRICTLY NO DATES
const CORE_STAGES = [
  { id: 'design', label: 'Design Finalized', weight: 10, desc: 'Design selections and architectural layout confirmed' },
  { id: 'procurement', label: 'Procurement', weight: 20, desc: 'Raw materials and component orders placed with suppliers' },
  { id: 'production', label: 'Production', weight: 25, desc: 'Factory manufacturing and precision joinery in progress' },
  { id: 'dispatch', label: 'Dispatch & Logistics', weight: 15, desc: 'Items quality-inspected, packed, and en route to site' },
  { id: 'installation', label: 'Site Installation', weight: 20, desc: 'Field technicians executing assembly and fitting' },
  { id: 'handover', label: 'Final Handover', weight: 10, desc: 'Snag resolution, final cleanup, and key handover' },
]

const STATUS_FILTERS = [
  { key: 'ALL', label: 'All Items' },
  { key: 'ordered', label: 'Ordered' },
  { key: 'production', label: 'In Production' },
  { key: 'quality', label: 'Quality Check' },
  { key: 'dispatched', label: 'Dispatched' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'installed', label: 'Installation' },
  { key: 'completed', label: 'Completed' },
]

export default function TrackPage() {
  const { projectId } = useParams() as { projectId: string }
  const router = useRouter()
  const { user } = useAuthStore()
  const {
    tracking,
    photos,
    issues,
    projectPayments,
    fetchTracking,
    fetchPhotos,
    fetchIssues,
    fetchProjectPayments,
    createIssue,
    fetchTrackingHistory,
    payMilestone,
  } = useCustomerStore()

  // Routing View States
  const [view, setView] = useState<'overview' | 'component' | 'issue'>('overview')
  const [selectedComp, setSelectedComp] = useState<any>(null)
  const [compHistory, setCompHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Snag Reporting State
  const [snagCategory, setSnagCategory] = useState('DEFECT')
  const [snagPriority, setSnagPriority] = useState('HIGH')
  const [snagDate, setSnagDate] = useState(() => new Date().toISOString().split('T')[0])
  const [snagDescription, setSnagDescription] = useState('')
  const [snagPhotos, setSnagPhotos] = useState<File[]>([])
  const [snagPhotoPreviews, setSnagPhotoPreviews] = useState<string[]>([])
  const [isSubmittingSnag, setIsSubmittingSnag] = useState(false)

  // Page States
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isStagesExpanded, setIsStagesExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeStatusFilter, setActiveStatusFilter] = useState('ALL')
  const [activeRoomTab, setActiveRoomTab] = useState('ALL')
  const [expandedRooms, setExpandedRooms] = useState<Record<string, boolean>>({})

  // Modals for 2x2 Utility Grid
  const [showQuotationModal, setShowQuotationModal] = useState(false)
  const [showVisualizerModal, setShowVisualizerModal] = useState(false)
  const [showFloorPlanModal, setShowFloorPlanModal] = useState(false)
  const [showPaymentsModal, setShowPaymentsModal] = useState(false)
  const [lightboxPhoto, setLightboxPhoto] = useState<any | null>(null)
  const [quotationData, setQuotationData] = useState<any>(null)
  const [rendersData, setRendersData] = useState<any[]>([])

  // Load project meta, tracking, photos, issues, payments
  useEffect(() => {
    const loadAll = async () => {
      try {
        const [projRes] = await Promise.all([
          projectsAPI.get(projectId),
          fetchTracking(projectId),
          fetchPhotos(projectId),
          fetchIssues(projectId),
          fetchProjectPayments(projectId),
        ])
        setProject(projRes.data)
      } catch (err) {
        toast.error('Failed to load project execution data')
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [projectId, fetchTracking, fetchPhotos, fetchIssues, fetchProjectPayments])

  // Expand rooms by default once tracking loads
  useEffect(() => {
    if (tracking.length > 0) {
      const roomMap: Record<string, boolean> = {}
      tracking.forEach((t) => {
        const r = t.room_name || 'General'
        roomMap[r] = true
      })
      setExpandedRooms(roomMap)
    }
  }, [tracking])

  // Lazy load quotation & render details for modals
  const handleOpenQuotation = async () => {
    setShowQuotationModal(true)
    if (!quotationData) {
      try {
        const res = await quotationsAPI.get(projectId)
        setQuotationData(res.data)
      } catch (err) {
        // Fallback
      }
    }
  }

  const handleOpenVisualizer = () => {
    setShowVisualizerModal(true)
    if (rendersData.length === 0 && project?.renders) {
      setRendersData(Array.isArray(project.renders) ? project.renders : [])
    }
  }

  // Weighted Progress Calculation & Milestone States (NO DATES)
  const progressMetrics = useMemo(() => {
    const total = tracking.length || 1
    let totalProgress = 0
    let currentStageIndex = 0
    let previousStagesMaxed = true

    const stages = CORE_STAGES.map((stg, idx) => {
      let completedCount = 0
      tracking.forEach((item) => {
        const s = (item.status || 'ordered').toLowerCase()
        let isDone = false
        if (idx === 0) isDone = true
        else if (idx === 1) isDone = ['production', 'ready', 'dispatched', 'delivered', 'installed'].includes(s)
        else if (idx === 2) isDone = ['ready', 'dispatched', 'delivered', 'installed'].includes(s)
        else if (idx === 3) isDone = ['dispatched', 'delivered', 'installed'].includes(s)
        else if (idx === 4) isDone = ['delivered', 'installed'].includes(s)
        else if (idx === 5) isDone = ['installed'].includes(s) && project?.status === 'done'
        if (isDone) completedCount++
      })

      const isAllDone = completedCount === total && total > 0
      let contrib = 0
      if (previousStagesMaxed) {
        contrib = (completedCount / total) * stg.weight
        totalProgress += contrib
        if (!isAllDone) {
          previousStagesMaxed = false
          currentStageIndex = idx
        }
      }

      let state: 'completed' | 'active' | 'upcoming' = 'upcoming'
      if (isAllDone) {
        state = 'completed'
      } else if (idx === currentStageIndex) {
        state = 'active'
      } else if (idx === 0 && !isAllDone) {
        state = 'active'
      }

      return {
        ...stg,
        completedCount,
        totalCount: total,
        state,
        contribution: contrib,
      }
    })

    const finalPct = Math.min(100, Math.max(0, Math.round(totalProgress)))
    const activeStage = stages[currentStageIndex] || stages[0]

    return {
      progressPct: finalPct,
      stages,
      currentStageIndex,
      activeStage,
    }
  }, [tracking, project])

  // Status Filter Counts for the 7 Counters
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: tracking.length,
      ordered: 0,
      production: 0,
      quality: 0,
      dispatched: 0,
      delivered: 0,
      installed: 0,
      completed: 0,
    }
    tracking.forEach((t) => {
      const s = (t.status || 'ordered').toLowerCase()
      if (s.includes('order')) counts.ordered++
      else if (s.includes('prod')) counts.production++
      else if (s.includes('qual') || s.includes('ready')) counts.quality++
      else if (s.includes('disp')) counts.dispatched++
      else if (s.includes('deliv')) counts.delivered++
      else if (s.includes('instal')) counts.installed++
      else if (s.includes('done') || s.includes('complete')) counts.completed++
      else counts.ordered++
    })
    return counts
  }, [tracking])

  // Unique Room Tabs
  const roomTabs = useMemo(() => {
    const rooms = Array.from(new Set(tracking.map((t) => t.room_name || 'General'))).filter(Boolean)
    return ['ALL', ...rooms]
  }, [tracking])

  // Filtered Tracking Items
  const filteredTracking = useMemo(() => {
    return tracking.filter((item) => {
      const nameMatch = (item.item_name || '').toLowerCase().includes(searchQuery.toLowerCase())
      const roomMatch = activeRoomTab === 'ALL' || (item.room_name || 'General') === activeRoomTab
      
      let statusMatch = true
      if (activeStatusFilter !== 'ALL') {
        const s = (item.status || 'ordered').toLowerCase()
        if (activeStatusFilter === 'ordered') statusMatch = s.includes('order')
        else if (activeStatusFilter === 'production') statusMatch = s.includes('prod')
        else if (activeStatusFilter === 'quality') statusMatch = s.includes('qual') || s.includes('ready')
        else if (activeStatusFilter === 'dispatched') statusMatch = s.includes('disp')
        else if (activeStatusFilter === 'delivered') statusMatch = s.includes('deliv')
        else if (activeStatusFilter === 'installed') statusMatch = s.includes('instal')
        else if (activeStatusFilter === 'completed') statusMatch = s.includes('done') || s.includes('complete')
      }
      return nameMatch && roomMatch && statusMatch
    })
  }, [tracking, searchQuery, activeRoomTab, activeStatusFilter])

  // Grouped by Room
  const groupedTracking = useMemo(() => {
    return filteredTracking.reduce((acc: Record<string, any[]>, item) => {
      const r = item.room_name || 'General'
      if (!acc[r]) acc[r] = []
      acc[r].push(item)
      return acc
    }, {})
  }, [filteredTracking])

  const toggleRoomAccordion = (room: string) => {
    setExpandedRooms((prev) => ({ ...prev, [room]: !prev[room] }))
  }

  // Switch to component details
  const handleSelectComponent = async (comp: any) => {
    setSelectedComp(comp)
    setView('component')
    setLoadingHistory(true)
    try {
      const hist = await fetchTrackingHistory(projectId, comp.id)
      setCompHistory(hist || [])
    } catch {
      setCompHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  // Switch to snag report
  const handleOpenSnag = (comp: any) => {
    setSelectedComp(comp)
    resetSnagForm()
    setView('issue')
  }

  // Snag form upload handlers
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const filesArray = Array.from(e.target.files)
    const newPreviews = filesArray.map((f) => URL.createObjectURL(f))
    setSnagPhotos((prev) => [...prev, ...filesArray])
    setSnagPhotoPreviews((prev) => [...prev, ...newPreviews])
  }

  const handleRemoveSnagPhoto = (idx: number) => {
    setSnagPhotos((prev) => prev.filter((_, i) => i !== idx))
    setSnagPhotoPreviews((prev) => {
      URL.revokeObjectURL(prev[idx])
      return prev.filter((_, i) => i !== idx)
    })
  }

  const resetSnagForm = () => {
    setSnagCategory('DEFECT')
    setSnagPriority('HIGH')
    setSnagDate(new Date().toISOString().split('T')[0])
    setSnagDescription('')
    snagPhotoPreviews.forEach((url) => URL.revokeObjectURL(url))
    setSnagPhotos([])
    setSnagPhotoPreviews([])
  }

  const handleSubmitSnag = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedComp) return
    if (!snagDescription.trim()) {
      toast.error('Please describe the issue in detail')
      return
    }

    setIsSubmittingSnag(true)
    try {
      await createIssue(projectId, {
        type: snagCategory,
        priority: snagPriority,
        description: snagDescription,
        itemId: selectedComp.id,
        dateEncountered: snagDate,
        files: snagPhotos,
      })
      toast.success('Snag ticket submitted successfully! Our site team has been notified.')
      resetSnagForm()
      setView('overview')
      await fetchIssues(projectId)
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit snag ticket')
    } finally {
      setIsSubmittingSnag(false)
    }
  }

  // Dual-Track Progress Determination
  const dualTrackStatus = useMemo(() => {
    if (!selectedComp) return { sourcingStep: 1, installStep: 0 }
    const s = (selectedComp.status || 'ordered').toLowerCase()

    let sourcingStep = 1 // 1: PO Approved, 2: In Production, 3: Quality Check, 4: Dispatched
    if (s.includes('prod')) sourcingStep = 2
    else if (s.includes('qual') || s.includes('ready')) sourcingStep = 3
    else if (
      s.includes('disp') ||
      s.includes('deliv') ||
      s.includes('instal') ||
      s.includes('done') ||
      s.includes('complete')
    ) {
      sourcingStep = 4
    }

    let installStep = 0 // 0: Pending Transit, 1: Arrived at Site, 2: Installed, 3: Completed & Handover
    if (s.includes('deliv')) installStep = 1
    else if (s.includes('instal')) installStep = 2
    else if (s.includes('done') || s.includes('complete')) installStep = 3

    return { sourcingStep, installStep }
  }, [selectedComp])

  // Component-specific or room-specific proof photos
  const compProofPhotos = useMemo(() => {
    if (!selectedComp) return []
    return photos.filter((p) => {
      if (p.item_id && p.item_id === selectedComp.id) return true
      if (
        p.room_name &&
        selectedComp.room_name &&
        p.room_name.toLowerCase() === selectedComp.room_name.toLowerCase()
      ) {
        return true
      }
      return false
    })
  }, [photos, selectedComp])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  const isConvertedByAdmin = Boolean(
    project?.is_converted ||
    project?.status === 'execution' ||
    project?.status === 'converted' ||
    (project?.defaults && project?.defaults.converted_from_project_id)
  );

  if (project && !isConvertedByAdmin && user?.role === 'customer') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
        <Navbar />
        <div className="max-w-md mx-auto pt-32 text-center space-y-4">
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-6 shadow-sm space-y-3">
            <Clock className="w-12 h-12 text-amber-500 mx-auto animate-pulse" />
            <h2 className="text-base font-black uppercase tracking-wider text-amber-800">Tracking Pending Admin Conversion</h2>
            <p className="text-xs text-amber-700 font-semibold leading-relaxed">
              Your quotation is currently under review by our Admin Team. Progress tracking will unlock as soon as an Administrator converts your quotation into an active execution project.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition shadow-sm"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-2 text-xs font-extrabold text-indigo-650 hover:text-indigo-800 transition py-1.5 px-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </button>
          <div className="text-right">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Project Identifier
            </span>
            <span className="text-xs font-mono font-bold text-slate-700">{project?.id?.slice(0, 13)}...</span>
          </div>
        </div>

        {/* ── TOP FULL-WIDTH HERO PROGRESS BANNER (NO DATES) ── */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-50/60 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Real-Time Execution Tracker
                </span>
                <span className="px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-emerald-50 text-emerald-700 border border-emerald-100">
                  {progressMetrics.activeStage.label}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {project?.property_name || 'My Interior Project'}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-semibold">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Building2 className="w-4 h-4 text-indigo-500" /> {project?.bhk_type || 'Custom BHK'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5 text-slate-700">
                  <MapPin className="w-4 h-4 text-indigo-500" /> {project?.city || 'Local Site'} ({project?.pincode || 'Pincode'})
                </span>
                <span>•</span>
                <span className="text-slate-700">
                  Budget: <strong className="font-extrabold text-slate-900">₹{(project?.budget || 0).toLocaleString('en-IN')}</strong>
                </span>
              </div>
            </div>

            {/* Overall Progress Gauge */}
            <div className="flex items-center gap-5 sm:self-end md:self-center bg-slate-50/80 border border-slate-100 p-4 rounded-2xl">
              <div className="text-right">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                  Overall Completion
                </span>
                <span className="text-3xl font-black text-indigo-650 tracking-tight">
                  {progressMetrics.progressPct}%
                </span>
              </div>
              <div className="w-16 h-16 rounded-full border-4 border-slate-200 border-t-indigo-600 border-r-indigo-600 flex items-center justify-center font-black text-xs text-indigo-700 bg-white shadow-2xs">
                {progressMetrics.progressPct}%
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-6 space-y-2">
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressMetrics.progressPct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-emerald-500 h-full rounded-full"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span>Stage {progressMetrics.currentStageIndex + 1} of 6: {progressMetrics.activeStage.label}</span>
              <button
                type="button"
                onClick={() => setIsStagesExpanded(!isStagesExpanded)}
                className="text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1 underline"
              >
                {isStagesExpanded ? 'Collapse Stages ▲' : 'View All 6 Stages ▼'}
              </button>
            </div>
          </div>

          {/* Expandable 6 Core Stages Timeline - STRICTLY NO DATES */}
          <AnimatePresence>
            {isStagesExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
              >
                {progressMetrics.stages.map((stg, idx) => {
                  const isDone = stg.state === 'completed'
                  const isActive = stg.state === 'active'

                  return (
                    <div
                      key={stg.id}
                      className={clsx(
                        'p-3.5 rounded-2xl border transition-all flex flex-col justify-between space-y-2',
                        isDone
                          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                          : isActive
                          ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950 shadow-2xs'
                          : 'bg-slate-50/50 border-slate-200/60 text-slate-400'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider">
                          0{idx + 1}
                        </span>
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : isActive ? (
                          <Clock className="w-4 h-4 text-indigo-600 animate-spin-slow" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-black leading-snug">{stg.label}</div>
                        <p className="text-[10px] leading-tight mt-1 opacity-80 line-clamp-2">{stg.desc}</p>
                      </div>
                      <div className="text-[9px] font-extrabold uppercase tracking-wider pt-1 border-t border-black/5">
                        {isDone ? 'Completed' : isActive ? 'Active Now' : 'Upcoming'}
                      </div>
                    </div>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── STRICT 2-COLUMN DESKTOP LAYOUT (2/3 LEFT, 1/3 RIGHT) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* ══════════════ LEFT COLUMN (2/3) ══════════════ */}
          <div className="lg:col-span-2 space-y-6">
            {/* View State Router: Overview vs Component Details vs Issue Snag Form */}
            {view === 'component' && selectedComp ? (
              /* Component Tracking Details View */
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                {/* Header breadcrumb & quick actions */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <button
                    onClick={() => setView('overview')}
                    className="inline-flex items-center gap-1.5 text-xs font-extrabold text-indigo-650 hover:text-indigo-800 transition"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to Components List
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-black uppercase tracking-wider bg-indigo-50 text-indigo-700">
                      {selectedComp.component_id || 'CMP-SPEC'}
                    </span>
                    <button
                      onClick={() => handleOpenSnag(selectedComp)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 transition border border-rose-100"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" /> Report Snag
                    </button>
                  </div>
                </div>

                {/* Hero / Component Summary Banner */}
                <div className="flex flex-col sm:flex-row gap-6 items-start">
                  <div
                    className="relative group cursor-pointer w-full sm:w-44 h-44 flex-shrink-0"
                    onClick={() =>
                      setLightboxPhoto({
                        image_url:
                          selectedComp.image_url ||
                          'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace',
                        caption: selectedComp.item_name,
                      })
                    }
                  >
                    <img
                      src={
                        selectedComp.image_url ||
                        'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace'
                      }
                      alt={selectedComp.item_name}
                      className="w-full h-full object-cover rounded-2xl border border-slate-100 shadow-2xs group-hover:brightness-95 transition"
                    />
                    <div className="absolute inset-0 bg-black/30 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                      <Eye className="w-4 h-4" /> Click to Zoom
                    </div>
                  </div>

                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-slate-500 bg-slate-100 uppercase tracking-wider">
                        {selectedComp.room_name?.replace('_', ' ') || 'General'}
                      </span>
                      {selectedComp.category && (
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          • {selectedComp.category}
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      {selectedComp.item_name}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={clsx(
                          'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border',
                          (selectedComp.status || '').toLowerCase().includes('instal') ||
                            (selectedComp.status || '').toLowerCase().includes('done')
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : (selectedComp.status || '').toLowerCase().includes('disp') ||
                              (selectedComp.status || '').toLowerCase().includes('deliv')
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        )}
                      >
                        Status: {selectedComp.status || 'Ordered'}
                      </span>
                      {selectedComp.vendor_name && (
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          Supplier: {selectedComp.vendor_name}
                        </span>
                      )}
                      {selectedComp.assigned_technician && (
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          Technician: {selectedComp.assigned_technician}
                        </span>
                      )}
                    </div>
                    {selectedComp.remarks && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600">
                        <strong className="font-bold text-slate-800">Technician Remarks:</strong>{' '}
                        {selectedComp.remarks}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── DUAL-TRACK STATUS PROGRESSION BARS ── */}
                <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/70 space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-indigo-600" /> Dual-Track Sourcing & Site Execution Bar
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">Synchronized with supplier & site ops</span>
                  </div>

                  {/* Track 1: Sourcing / Factory Fulfillment */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                      <span>1. Supplier & Factory Track</span>
                      <span className="text-indigo-600">
                        {dualTrackStatus.sourcingStep === 4
                          ? 'Dispatched from Factory'
                          : `Step ${dualTrackStatus.sourcingStep} of 4`}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { label: 'PO Confirmed', desc: 'Order placed' },
                        { label: 'In Production', desc: 'CNC cutting & joinery' },
                        { label: 'Quality Check', desc: 'Factory QA passed' },
                        { label: 'Dispatched', desc: 'In-transit to site hub' },
                      ].map((st, i) => {
                        const stepNum = i + 1
                        const isDone =
                          dualTrackStatus.sourcingStep > stepNum ||
                          (dualTrackStatus.sourcingStep === stepNum && dualTrackStatus.sourcingStep === 4)
                        const isCurrent =
                          dualTrackStatus.sourcingStep === stepNum && dualTrackStatus.sourcingStep !== 4
                        return (
                          <div
                            key={st.label}
                            className={clsx(
                              'p-2.5 rounded-xl border text-left transition',
                              isDone
                                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                                : isCurrent
                                ? 'bg-indigo-50/80 border-indigo-200 text-indigo-950 shadow-2xs'
                                : 'bg-white border-slate-200/60 text-slate-400'
                            )}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] font-black uppercase">0{stepNum}</span>
                              {isDone ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              ) : isCurrent ? (
                                <Clock className="w-3.5 h-3.5 text-indigo-600 animate-spin-slow" />
                              ) : (
                                <div className="w-2.5 h-2.5 rounded-full border border-slate-300" />
                              )}
                            </div>
                            <div className="text-[11px] font-black leading-tight">{st.label}</div>
                            <div className="text-[9px] opacity-75 mt-0.5 truncate">{st.desc}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Track 2: Site Installation & Customer Verification */}
                  <div className="space-y-2 pt-2 border-t border-slate-200/50">
                    <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                      <span>2. Site Installation & Handover Track</span>
                      <span className="text-emerald-600">
                        {dualTrackStatus.installStep === 3
                          ? 'Completed & Handed Over'
                          : dualTrackStatus.installStep === 0
                          ? 'Awaiting Dispatch to Site'
                          : `Step ${dualTrackStatus.installStep} of 3`}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { label: 'Arrived at Site', desc: 'Inspected at flat' },
                        { label: 'Site Fitting', desc: 'Technician assembled' },
                        { label: 'Customer Handover', desc: 'Ready & accepted' },
                      ].map((st, i) => {
                        const stepNum = i + 1
                        const isDone = dualTrackStatus.installStep >= stepNum
                        const isCurrent =
                          dualTrackStatus.installStep === stepNum - 1 && dualTrackStatus.sourcingStep >= 4
                        return (
                          <div
                            key={st.label}
                            className={clsx(
                              'p-2.5 rounded-xl border text-left transition',
                              isDone
                                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                                : isCurrent
                                ? 'bg-amber-50/80 border-amber-200 text-amber-950 shadow-2xs'
                                : 'bg-white border-slate-200/60 text-slate-400'
                            )}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] font-black uppercase">0{stepNum}</span>
                              {isDone ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              ) : isCurrent ? (
                                <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin-slow" />
                              ) : (
                                <div className="w-2.5 h-2.5 rounded-full border border-slate-300" />
                              )}
                            </div>
                            <div className="text-[11px] font-black leading-tight">{st.label}</div>
                            <div className="text-[9px] opacity-75 mt-0.5 truncate">{st.desc}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* ── COMPONENT PROOF PHOTOS GALLERY ── */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-indigo-500" /> Component Proof & Inspection Photos
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400">
                      {compProofPhotos.length} Site Photo{compProofPhotos.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {compProofPhotos.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {compProofPhotos.map((photo, pIdx) => (
                        <div
                          key={photo.id || pIdx}
                          onClick={() => setLightboxPhoto(photo)}
                          className="relative aspect-video rounded-xl overflow-hidden cursor-pointer group border border-slate-100 bg-slate-100 shadow-2xs"
                        >
                          <img
                            src={photo.image_url}
                            alt={photo.caption || 'Proof Photo'}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Eye className="w-4 h-4" />
                          </div>
                          {photo.caption && (
                            <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] font-semibold px-1.5 py-0.5 truncate">
                              {photo.caption}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-400 flex items-center gap-2">
                      <Info className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span>
                        Technician proof photos and factory packaging snapshots will appear here once uploaded by field supervisors.
                      </span>
                    </div>
                  )}
                </div>

                {/* ── TECHNICAL SPECIFICATIONS & DETAILS ── */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Component Specifications
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/80">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                        Room Location
                      </span>
                      <span className="font-extrabold text-slate-800 mt-0.5 block truncate capitalize">
                        {selectedComp.room_name?.replace('_', ' ') || 'Living Room'}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/80">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                        Material / Finish
                      </span>
                      <span className="font-extrabold text-slate-800 mt-0.5 block truncate">
                        {selectedComp.material_finish || selectedComp.finish || 'Factory Engineered Wood'}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/80">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                        Dimensions
                      </span>
                      <span className="font-extrabold text-slate-800 mt-0.5 block truncate">
                        {selectedComp.dimensions || selectedComp.size || 'Custom Modular Spec'}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/80">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                        Color Family
                      </span>
                      <span className="font-extrabold text-slate-800 mt-0.5 block truncate">
                        {selectedComp.color || 'Standard Palette'}
                      </span>
                    </div>
                    {selectedComp.about_details &&
                      Object.entries(selectedComp.about_details).map(([k, v]: [string, any]) => (
                        <div key={k} className="p-3 bg-slate-50 rounded-xl border border-slate-100/80">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                            {k.replace('_', ' ')}
                          </span>
                          <span className="font-extrabold text-slate-800 mt-0.5 block truncate">
                            {String(v) || 'Standard'}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* ── LOGISTICS & SHIPMENT TRACKING ── */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-indigo-500" /> Logistics & Transit Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/80">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                        Carrier / Fleet
                      </span>
                      <span className="font-extrabold text-slate-800 mt-0.5 block truncate">
                        {selectedComp.carrier || 'Dedicated Surface Freight'}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/80">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                        Waybill / Tracking No
                      </span>
                      <span className="font-mono font-extrabold text-indigo-650 mt-0.5 block truncate">
                        {selectedComp.tracking_number ||
                          `WB-${(selectedComp.id || 'TRK').slice(0, 8).toUpperCase()}`}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/80">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                        Warranty Protection
                      </span>
                      <span className="font-extrabold text-slate-800 mt-0.5 block truncate">
                        {selectedComp.warranty || '10-Year Modular Warranty'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── STATUS AUDIT HISTORY LOG ── */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-indigo-500" /> Milestone Audit Trail
                  </h3>
                  {loadingHistory ? (
                    <div className="py-6 text-center text-xs text-slate-400">Loading audit trail...</div>
                  ) : compHistory.length === 0 ? (
                    <div className="p-4 bg-slate-50 rounded-2xl text-xs text-slate-500 font-medium">
                      No status transitions recorded yet. Tracking updates logged by suppliers and technicians will appear here.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {compHistory.map((h: any, i: number) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs font-medium"
                        >
                          <div>
                            <span className="font-bold text-slate-800 uppercase text-[10px]">{h.status}</span>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {h.remarks || 'Status logged by site team'}
                            </p>
                          </div>
                          <span className="text-[10px] text-slate-400">{h.updated_by || 'Coordinator'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenSnag(selectedComp)}
                    className="py-2.5 px-4 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 transition flex items-center gap-1.5 border border-rose-100"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Report Issue on this Component
                  </button>
                  <button
                    onClick={() => setView('overview')}
                    className="py-2.5 px-5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm"
                  >
                    Done & Return
                  </button>
                </div>
              </div>
            ) : view === 'issue' && selectedComp ? (
              /* Snag Reporting Form View */
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <button
                    onClick={() => {
                      resetSnagForm()
                      setView('overview')
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-extrabold text-indigo-650 hover:text-indigo-800 transition"
                  >
                    <ArrowLeft className="w-4 h-4" /> Cancel & Return
                  </button>
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-100">
                    Defect / Snag Filing
                  </span>
                </div>

                {/* Context Target Banner */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center gap-4">
                  <img
                    src={
                      selectedComp.image_url ||
                      'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace'
                    }
                    alt={selectedComp.item_name}
                    className="w-16 h-16 object-cover rounded-xl border border-slate-200 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                      Reporting Issue on {selectedComp.room_name?.replace('_', ' ') || 'Room Item'}
                    </span>
                    <h3 className="text-sm font-black text-slate-800 truncate mt-0.5">
                      {selectedComp.item_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-mono text-slate-500 font-bold">
                        {selectedComp.component_id || 'CMP-SPEC'}
                      </span>
                      <span className="text-[10px] text-slate-400">•</span>
                      <span className="text-[10px] font-bold text-slate-600">
                        Status: {selectedComp.status || 'Ordered'}
                      </span>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmitSnag} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                        Issue Category
                      </label>
                      <select
                        value={snagCategory}
                        onChange={(e) => setSnagCategory(e.target.value)}
                        className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                      >
                        <option value="DEFECT">Defect / Finish Damage (Scratch, Dent, Chip)</option>
                        <option value="INCORRECT_SPEC">Incorrect Color / Fabric / Material Mismatch</option>
                        <option value="MISSING_PARTS">Missing Parts / Hardware / Handles</option>
                        <option value="ALIGNMENT">Alignment / Fitment / Door Misalignment</option>
                        <option value="DELAY">Installation or Delivery Delay</option>
                        <option value="FUNCTIONAL">Functional Failure / Sticking Drawer</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                        Severity / Priority
                      </label>
                      <select
                        value={snagPriority}
                        onChange={(e) => setSnagPriority(e.target.value)}
                        className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                      >
                        <option value="LOW">Low (Minor cosmetic touchup)</option>
                        <option value="MEDIUM">Medium (Noticeable flaw, needs adjustment)</option>
                        <option value="HIGH">High (Blocks room acceptance)</option>
                        <option value="CRITICAL">Critical (Immediate replacement required)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                      Date Discovered / Encountered
                    </label>
                    <input
                      type="date"
                      value={snagDate}
                      onChange={(e) => setSnagDate(e.target.value)}
                      className="w-full sm:w-64 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                      Detailed Snag Description
                    </label>
                    <textarea
                      value={snagDescription}
                      onChange={(e) => setSnagDescription(e.target.value)}
                      required
                      rows={4}
                      placeholder="Describe what is damaged or mismatched, where the defect is located, and any specific resolution requested..."
                      className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-1 focus:ring-indigo-500 resize-none text-slate-800"
                    />
                  </div>

                  {/* Multi-photo upload section */}
                  <div className="space-y-3">
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Proof Photos / Defect Images ({snagPhotos.length} attached)
                    </label>

                    <div className="border-2 border-dashed border-slate-200 hover:border-indigo-300 rounded-2xl p-5 text-center transition bg-slate-50/50">
                      <input
                        type="file"
                        id="snag-photo-upload"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoSelect}
                        className="hidden"
                      />
                      <label htmlFor="snag-photo-upload" className="cursor-pointer block space-y-2">
                        <Upload className="w-6 h-6 text-indigo-500 mx-auto" />
                        <div className="text-xs font-extrabold text-indigo-650 hover:text-indigo-800">
                          Click to upload defect proof photos
                        </div>
                        <p className="text-[10px] text-slate-400">
                          Attach clear photos of the defect, overall component, or finish issue (JPG, PNG, WebP)
                        </p>
                      </label>
                    </div>

                    {/* Image Previews Grid with Remove Button */}
                    {snagPhotoPreviews.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                        {snagPhotoPreviews.map((previewUrl, pIdx) => (
                          <div
                            key={pIdx}
                            className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 group bg-slate-100 shadow-2xs"
                          >
                            <img src={previewUrl} alt="Snag upload preview" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => handleRemoveSnagPhoto(pIdx)}
                              className="absolute top-1.5 right-1.5 p-1 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                            <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] font-bold px-2 py-0.5 truncate">
                              {snagPhotos[pIdx]?.name || `Photo ${pIdx + 1}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        resetSnagForm()
                        setView('overview')
                      }}
                      className="py-2.5 px-4 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingSnag}
                      className="py-2.5 px-5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition shadow-sm flex items-center gap-1.5"
                    >
                      {isSubmittingSnag ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Submitting Ticket...
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5" /> Submit Snag Ticket
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* Overview List Mode */
              <>
                {/* 7 Stage Counters Filter Bar */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5 text-indigo-500" /> Sourcing & Execution Stages
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">Click a status to filter components</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                    {STATUS_FILTERS.map((f) => {
                      const count = statusCounts[f.key] ?? 0
                      const isSelected = activeStatusFilter === f.key

                      return (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => setActiveStatusFilter(f.key)}
                          className={clsx(
                            'p-2.5 rounded-2xl border text-center transition-all flex flex-col justify-between gap-1',
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                              : 'bg-slate-50/70 border-slate-100 hover:border-indigo-200 text-slate-700'
                          )}
                        >
                          <span className={clsx('text-base font-black block', isSelected ? 'text-white' : 'text-slate-900')}>
                            {count}
                          </span>
                          <span className={clsx('text-[9px] font-bold uppercase tracking-wider truncate block', isSelected ? 'text-indigo-100' : 'text-slate-400')}>
                            {f.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Search Bar & Room Filter Tabs */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                    <div className="relative w-full sm:w-72">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search component or material..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 font-medium"
                      />
                    </div>

                    {/* Room Filter Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                      {roomTabs.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setActiveRoomTab(r)}
                          className={clsx(
                            'px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider whitespace-nowrap transition',
                            activeRoomTab === r
                              ? 'bg-indigo-650 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          )}
                        >
                          {r === 'ALL' ? 'All Rooms' : r.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Room Accordions & Item Cards */}
                <div className="space-y-4">
                  {Object.keys(groupedTracking).length === 0 ? (
                    <div className="bg-white border border-slate-200/80 rounded-3xl p-12 text-center text-slate-400 text-xs font-semibold">
                      No components found matching your current filter criteria.
                    </div>
                  ) : (
                    Object.entries(groupedTracking).map(([room, items]) => {
                      const isExpanded = expandedRooms[room] ?? true

                      return (
                        <div key={room} className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
                          {/* Accordion Room Header */}
                          <div
                            onClick={() => toggleRoomAccordion(room)}
                            className="p-4 sm:p-5 flex items-center justify-between cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition border-b border-slate-100"
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs">
                                🏛️
                              </span>
                              <div>
                                <h3 className="text-sm font-black text-slate-800 capitalize tracking-tight">
                                  {room.replace('_', ' ')}
                                </h3>
                                <span className="text-[10px] font-bold text-slate-400">
                                  {items.length} Component{items.length !== 1 ? 's' : ''} in tracking
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider">
                                {isExpanded ? 'Collapse' : 'Expand'}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-slate-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                          </div>

                          {/* Accordion Body: Item Cards Grid */}
                          {isExpanded && (
                            <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {items.map((item) => {
                                const status = (item.status || 'ordered').toLowerCase()
                                const isInstalled = status.includes('instal') || status.includes('done')

                                return (
                                  <div
                                    key={item.id}
                                    className="p-4 rounded-2xl border border-slate-100 bg-white hover:border-indigo-200 transition shadow-2xs flex flex-col justify-between space-y-3"
                                  >
                                    <div className="flex items-start gap-3.5">
                                      <img
                                        src={item.image_url || 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace'}
                                        alt={item.item_name}
                                        className="w-16 h-16 object-cover rounded-xl border border-slate-100 flex-shrink-0"
                                      />
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="text-[9px] font-mono text-slate-400 font-bold block truncate">
                                            {item.component_id || 'CMP-SPEC'}
                                          </span>
                                          <span
                                            className={clsx(
                                              'text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border',
                                              isInstalled
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : status.includes('disp') || status.includes('deliv')
                                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                : 'bg-amber-50 text-amber-700 border-amber-200'
                                            )}
                                          >
                                            {item.status}
                                          </span>
                                        </div>
                                        <h4 className="text-xs font-black text-slate-800 truncate mt-1">
                                          {item.item_name}
                                        </h4>
                                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                                          {item.vendor_name ? `By ${item.vendor_name}` : 'Modular Factory Execution'}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-50">
                                      <button
                                        type="button"
                                        onClick={() => handleSelectComponent(item)}
                                        className="text-[10px] font-extrabold text-indigo-650 hover:text-indigo-800 transition py-1 px-2.5 rounded-lg bg-indigo-50/70"
                                      >
                                        View Details →
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenSnag(item)}
                                        className="text-[10px] font-bold text-rose-600 hover:text-rose-800 transition py-1 px-2.5 rounded-lg bg-rose-50"
                                      >
                                        Report Snag ⚠️
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </>
            )}
          </div>

          {/* ══════════════ RIGHT COLUMN (1/3) ══════════════ */}
          <div className="lg:col-span-1 space-y-6">
            {/* 1. PROJECT UTILITIES 2x2 GRID */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-850 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-500" /> Project Utilities
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Quick access to documentation, renders, and payments</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* 1. Quotation & Invoices */}
                <button
                  type="button"
                  onClick={handleOpenQuotation}
                  className="p-3.5 bg-slate-50/80 hover:bg-indigo-50/60 border border-slate-100 hover:border-indigo-200 rounded-2xl text-left transition group shadow-2xs"
                >
                  <FileText className="w-5 h-5 text-indigo-600 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-black text-slate-850 block leading-tight">Quotation & Invoices</span>
                  <span className="text-[9px] text-slate-400 block mt-1 font-semibold">PDFs & Receipts</span>
                </button>

                {/* 2. AI Visualizer */}
                <button
                  type="button"
                  onClick={handleOpenVisualizer}
                  className="p-3.5 bg-slate-50/80 hover:bg-purple-50/60 border border-slate-100 hover:border-purple-200 rounded-2xl text-left transition group shadow-2xs"
                >
                  <Sparkles className="w-5 h-5 text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-black text-slate-850 block leading-tight">AI Visualizer</span>
                  <span className="text-[9px] text-slate-400 block mt-1 font-semibold">3D Renders Studio</span>
                </button>

                {/* 3. Floor Plans */}
                <button
                  type="button"
                  onClick={() => setShowFloorPlanModal(true)}
                  className="p-3.5 bg-slate-50/80 hover:bg-emerald-50/60 border border-slate-100 hover:border-emerald-200 rounded-2xl text-left transition group shadow-2xs"
                >
                  <Building2 className="w-5 h-5 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-black text-slate-850 block leading-tight">Floor Plans</span>
                  <span className="text-[9px] text-slate-400 block mt-1 font-semibold">Blueprint Layout</span>
                </button>

                {/* 4. Milestone Payments */}
                <button
                  type="button"
                  onClick={() => setShowPaymentsModal(true)}
                  className="p-3.5 bg-slate-50/80 hover:bg-amber-50/60 border border-slate-100 hover:border-amber-200 rounded-2xl text-left transition group shadow-2xs"
                >
                  <CreditCard className="w-5 h-5 text-amber-600 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-black text-slate-850 block leading-tight">Payments</span>
                  <span className="text-[9px] text-slate-400 block mt-1 font-semibold">Milestones & Balance</span>
                </button>
              </div>
            </div>

            {/* 2. RECENT ACTIVITY FEED */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-850 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-indigo-500" /> Recent Activity Feed
                </h3>
                <span className="text-[10px] font-bold text-slate-400">Live Sync</span>
              </div>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {issues.length > 0 ? (
                  issues.slice(0, 3).map((iss) => (
                    <div key={iss.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-100/80 text-xs font-medium space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">
                          {iss.type || 'Snag Ticket'}
                        </span>
                        <span className="text-[9px] text-slate-400">{iss.priority}</span>
                      </div>
                      <p className="font-bold text-slate-800 text-[11px] mt-1">{iss.description}</p>
                    </div>
                  ))
                ) : (
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100/80 text-xs font-medium text-slate-500">
                    Project execution initiated. Active updates from site supervisors and vendors will be logged here.
                  </div>
                )}

                <div className="p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100 text-xs font-medium text-emerald-900 space-y-0.5">
                  <div className="font-bold text-[11px]">Design Scope Approved</div>
                  <p className="text-[10px] text-emerald-700">Contract finalized & components routed to approved vendors.</p>
                </div>
              </div>
            </div>

            {/* 3. SITE VERIFICATION GALLERY */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-850 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-indigo-500" /> Site Verification Gallery
                </h3>
                <span className="text-[10px] font-bold text-slate-400">{photos.length} Photos</span>
              </div>

              {photos.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 font-medium">
                  No site visit or installation photos uploaded yet. Proof photos will appear here as work progresses.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setLightboxPhoto(p)}
                      className="relative aspect-square rounded-xl overflow-hidden cursor-pointer group border border-slate-100 bg-slate-100"
                    >
                      <img
                        src={p.image_url}
                        alt={p.caption || 'Site Photo'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Eye className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ── MODALS FOR UTILITIES ── */}

      {/* 1. Quotation & Invoices Modal */}
      {showQuotationModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" /> Quotation & Financial Invoices
              </h3>
              <button onClick={() => setShowQuotationModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl space-y-2">
                <div className="flex justify-between font-bold">
                  <span className="text-slate-500">Quotation No:</span>
                  <span className="font-mono text-slate-800">{quotationData?.quotation_no || 'QTN-CURRENT'}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-slate-500">Contract Total:</span>
                  <span className="text-indigo-650 font-black">₹{(quotationData?.total || project?.budget || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <a
                  href={quotationsAPI.download(projectId)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-center flex items-center justify-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" /> Download Quotation PDF
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. AI Visualizer Studio Modal */}
      {showVisualizerModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" /> AI Visualizer & 3D Studio Renders
              </h3>
              <button onClick={() => setShowVisualizerModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4 text-xs">
              <p className="text-slate-500">Photorealistic 4-wall AI perspectives and design renders generated for your flat.</p>
              {rendersData.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                  {rendersData.map((r, i) => (
                    <img key={i} src={r.image_url} alt="Render" className="w-full h-36 object-cover rounded-xl border border-slate-100" />
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 rounded-2xl text-slate-400 font-semibold">
                  No preview renders saved yet. Open the Customizer to generate full AI renders.
                </div>
              )}
              <Link
                href={`/customize/${projectId}`}
                className="block py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-center transition"
              >
                Launch Visualizer Customizer Studio →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 3. Floor Plans Modal */}
      {showFloorPlanModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600" /> Architectural Floor Plan
              </h3>
              <button onClick={() => setShowFloorPlanModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {project?.floor_plan_url ? (
                <img
                  src={project.floor_plan_url}
                  alt="Floor Plan"
                  className="w-full max-h-96 object-contain rounded-2xl border border-slate-100 bg-slate-50"
                />
              ) : (
                <div className="p-12 text-center bg-slate-50 rounded-2xl text-slate-400 font-semibold text-xs">
                  Standard architectural layout mapped to your {project?.bhk_type || 'BHK'} configuration.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Milestone Payments Modal */}
      {showPaymentsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-600" /> Milestone Payments
              </h3>
              <button onClick={() => setShowPaymentsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-2xl font-bold">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Total Paid</span>
                  <span className="text-emerald-600 font-black text-sm">₹{(projectPayments?.totalPaid || 0).toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Pending Balance</span>
                  <span className="text-rose-600 font-black text-sm">₹{(projectPayments?.pendingAmount || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {projectPayments?.milestones?.map((m: any, i: number) => (
                  <div key={i} className="p-3 bg-white border border-slate-100 rounded-xl flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-800">{m.name}</div>
                      <div className="text-[10px] text-slate-400">₹{(m.amount || 0).toLocaleString('en-IN')}</div>
                    </div>
                    <span className={clsx(
                      'text-[9px] font-bold px-2 py-0.5 rounded-full uppercase',
                      m.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    )}>
                      {m.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Preview */}
      {lightboxPhoto && (
        <div
          onClick={() => setLightboxPhoto(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-3xl w-full max-h-[85vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxPhoto.image_url}
              alt="Verification Proof"
              className="max-h-[75vh] w-auto object-contain rounded-2xl shadow-2xl"
            />
            {lightboxPhoto.caption && (
              <p className="text-white text-xs font-bold mt-3 text-center bg-black/40 px-4 py-2 rounded-full">
                {lightboxPhoto.caption}
              </p>
            )}
            <button
              onClick={() => setLightboxPhoto(null)}
              className="absolute top-2 right-2 text-white bg-black/50 p-2 rounded-full hover:bg-black/80"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
