'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCustomerStore } from '@/stores/customerStore'
import Navbar from '@/components/Navbar'
import { 
  ArrowLeft, ChevronDown, ChevronUp, Camera, Calendar, 
  ChevronLeft, ChevronRight, AlertCircle, Sparkles, MapPin, 
  Building2, ClipboardList, Info, HelpCircle, FileText, Download,
  CheckCircle2, Clock, Trash2, Send, Folder
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import Link from 'next/link'
import { projectsAPI } from '@/lib/api'

export default function ProjectExecutionPage() {
  const { projectId } = useParams() as { projectId: string }
  const router = useRouter()
  const {
    tracking,
    photos,
    issues,
    isLoading,
    fetchTracking,
    fetchPhotos,
    uploadPhoto,
    fetchIssues,
    createIssue,
    updateIssue,
    fetchTrackingHistory,
  } = useCustomerStore()

  // Routing View States
  const [view, setView] = useState<'overview' | 'component' | 'issue'>('overview')
  const [selectedComp, setSelectedComp] = useState<any>(null)
  const [selectedIssue, setSelectedIssue] = useState<any>(null)
  
  // Page Local states
  const [project, setProject] = useState<any>(null)
  const [expandedRooms, setExpandedRooms] = useState<Record<string, boolean>>({})
  const [compHistory, setCompHistory] = useState<any[]>([])

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRoomFilter, setSelectedRoomFilter] = useState('ALL')
  const [selectedVendorFilter, setSelectedVendorFilter] = useState('ALL')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL')

  // Photo uploads context
  const [photoRoom, setPhotoRoom] = useState('')
  const [photoCaption, setPhotoCaption] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)

  // Glassmorphic site gallery modal states
  const [activeGalleryRoom, setActiveGalleryRoom] = useState<string | null>(null)
  const [activeGalleryPhotoIdx, setActiveGalleryPhotoIdx] = useState(0)

  // Issue creation/edit fields
  const [issueType, setIssueType] = useState('FUNCTIONAL')
  const [issuePriority, setIssuePriority] = useState('MEDIUM')
  const [issueDescription, setIssueDescription] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [issuePhotos, setIssuePhotos] = useState<File[]>([])
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false)
  const [issuePhotoPreviews, setIssuePhotoPreviews] = useState<string[]>([])
  const [isEditingIssue, setIsEditingIssue] = useState(false)

  // Load project meta, tracking checklist, photos, and issues
  useEffect(() => {
    projectsAPI.get(projectId).then(res => setProject(res.data)).catch(() => {})
    fetchTracking(projectId)
    fetchPhotos(projectId)
    fetchIssues(projectId)
  }, [projectId, fetchTracking, fetchPhotos, fetchIssues])

  // Automatically expand all folders/rooms on initial load
  useEffect(() => {
    if (tracking.length > 0) {
      const rooms = Array.from(new Set(tracking.map(t => t.room_name)))
      const initial: Record<string, boolean> = {}
      rooms.forEach(r => { initial[r] = true })
      setExpandedRooms(initial)
    }
  }, [tracking])

  // Dynamic Expected Completion Date: Farthest (latest) date from all components
  const expectedCompletionDate = useMemo(() => {
    if (tracking.length === 0) return 'Pending'
    const dates = tracking
      .map(t => t.expected_date)
      .filter(d => !!d)
      .map(d => new Date(d))
      .filter(d => !isNaN(d.getTime()))
    if (dates.length === 0) return 'Pending'
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))
    return maxDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }, [tracking])

  // Component Counts for Execution Overview Grid
  const overviewStats = useMemo(() => {
    const total = tracking.length
    const accepted = tracking.filter(t => t.status.toLowerCase() === 'accepted').length
    const inProduction = tracking.filter(t => t.status.toLowerCase() === 'production').length
    const dispatched = tracking.filter(t => t.status.toLowerCase() === 'dispatched').length
    const delivered = tracking.filter(t => t.status.toLowerCase() === 'delivered').length
    const installed = tracking.filter(t => t.status.toLowerCase() === 'installed').length
    const activeIssues = issues.filter(i => i.status.toLowerCase() !== 'resolved').length
    return { total, accepted, inProduction, dispatched, delivered, installed, activeIssues }
  }, [tracking, issues])

  // Filter and Search components
  const filteredTracking = useMemo(() => {
    return tracking.filter(t => {
      const matchesSearch = t.item_name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesRoom = selectedRoomFilter === 'ALL' || t.room_name === selectedRoomFilter
      const matchesVendor = selectedVendorFilter === 'ALL' || t.vendor_name === selectedVendorFilter
      const matchesStatus = selectedStatusFilter === 'ALL' || t.status.toLowerCase() === selectedStatusFilter.toLowerCase()
      return matchesSearch && matchesRoom && matchesVendor && matchesStatus
    })
  }, [tracking, searchQuery, selectedRoomFilter, selectedVendorFilter, selectedStatusFilter])

  // Grouped tracking items for room-wise folder view
  const groupedTracking = useMemo(() => {
    return filteredTracking.reduce((acc: Record<string, any[]>, item) => {
      const room = item.room_name || 'General'
      if (!acc[room]) acc[room] = []
      acc[room].push(item)
      return acc
    }, {})
  }, [filteredTracking])

  // List of unique room names for folder previews
  const uniqueRooms = useMemo(() => {
    return Array.from(new Set(tracking.map(t => t.room_name)))
  }, [tracking])

  // List of unique vendors
  const uniqueVendors = useMemo(() => {
    return Array.from(new Set(tracking.map(t => t.vendor_name).filter(Boolean)))
  }, [tracking])

  // Group photos by room for Amazon-style folder gallery
  const photosByRoom = useMemo(() => {
    return photos.reduce((acc: Record<string, any[]>, photo) => {
      const room = photo.room_name || 'General'
      if (!acc[room]) acc[room] = []
      acc[room].push(photo)
      return acc
    }, {})
  }, [photos])

  // Recent Activity Feed: Delivered components + resolved issues only
  const recentActivities = useMemo(() => {
    const activities: { id: string; text: string; date: string; isSuccess: boolean }[] = []
    
    // 1. Delivered/Installed Components
    tracking.forEach(t => {
      if (t.status === 'delivered' || t.status === 'installed') {
        activities.push({
          id: `del-${t.id}`,
          text: `Component "${t.item_name}" has been ${t.status}.`,
          date: t.actual_date || 'Recently',
          isSuccess: true
        })
      }
    })

    // 2. Resolved Issues
    issues.forEach(i => {
      if (i.status.toLowerCase() === 'resolved') {
        const comp = tracking.find(t => t.id === i.item_id)
        activities.push({
          id: `issue-${i.id}`,
          text: `Issue for "${comp?.item_name || 'Component'}" has been resolved.`,
          date: i.resolved_at ? new Date(i.resolved_at).toLocaleDateString('en-IN') : 'Recently',
          isSuccess: true
        })
      }
    })

    return activities.sort((a, b) => b.date.localeCompare(a.date))
  }, [tracking, issues])

  // Handle opening Component Details Subpage
  const handleOpenComponent = async (comp: any) => {
    setSelectedComp(comp)
    setView('component')
    setCompHistory([])
    try {
      const historyData = await fetchTrackingHistory(projectId, comp.id)
      setCompHistory(historyData)
    } catch (e) {
      console.error(e)
    }
  }

  // Handle Photo Upload inside Site Verification card
  const handlePhotoUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!photoRoom) {
      toast.error('Please enter a room folder name')
      return
    }
    setIsUploadingPhoto(true)
    try {
      await uploadPhoto(projectId, photoRoom, photoCaption, photoFile || undefined)
      toast.success('Site verification photo uploaded')
      setPhotoRoom('')
      setPhotoCaption('')
      setPhotoFile(null)
    } catch {
      toast.error('Failed to upload photo')
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  // Handle Issue file inputs
  const handleIssueFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArr = Array.from(e.target.files)
      setIssuePhotos(prev => [...prev, ...filesArr])

      // Generate previews
      const previews = filesArr.map(file => URL.createObjectURL(file))
      setIssuePhotoPreviews(prev => [...prev, ...previews])
    }
  }

  // Handle navigation to Issue Details for creation
  const handleNewIssueInit = () => {
    setIssueType('FUNCTIONAL')
    setIssuePriority('MEDIUM')
    setIssueDescription('')
    setIssueDate(new Date().toISOString().substring(0, 10))
    setIssuePhotos([])
    setIssuePhotoPreviews([])
    setSelectedIssue(null)
    setIsEditingIssue(false)
    setView('issue')
  }

  // Handle navigation to Issue Details for editing
  const handleEditIssueInit = (issue: any) => {
    setSelectedIssue(issue)
    setIssueType(issue.type)
    setIssuePriority(issue.priority)
    setIssueDescription(issue.description)
    setIssueDate(issue.date_encountered || '')
    setIssuePhotos([])
    setIssuePhotoPreviews(issue.attachments?.map((a: any) => a.url.startsWith('http') ? a.url : `http://localhost:8000${a.url}`) || [])
    setIsEditingIssue(true)
    setView('issue')
  }

  // Submit/Update Issue Form Handler
  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!issueDescription.trim()) {
      toast.error('Please provide an issue description')
      return
    }
    setIsSubmittingIssue(true)
    try {
      if (isEditingIssue && selectedIssue) {
        await updateIssue(projectId, selectedIssue.id, {
          type: issueType,
          priority: issuePriority,
          description: issueDescription,
          dateEncountered: issueDate,
          files: issuePhotos
        })
        toast.success('Issue updated successfully')
      } else {
        await createIssue(projectId, {
          type: issueType,
          priority: issuePriority,
          description: issueDescription,
          itemId: selectedComp.id,
          dateEncountered: issueDate,
          files: issuePhotos
        })
        toast.success('Issue logged successfully')
      }
      setView('component')
      // Refresh selected component details
      const historyData = await fetchTrackingHistory(projectId, selectedComp.id)
      setCompHistory(historyData)
      fetchIssues(projectId)
    } catch {
      toast.error('Failed to submit issue')
    } finally {
      setIsSubmittingIssue(false)
    }
  }

  // Render priority badge helpers
  const renderPriorityBadge = (p: string) => {
    const colors: Record<string, string> = {
      CRITICAL: 'bg-red-100 text-red-700 border-red-200',
      HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
      MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      LOW: 'bg-blue-100 text-blue-700 border-blue-200',
    }
    return (
      <span className={clsx('px-2.5 py-0.5 rounded-full text-[10px] font-bold border capitalize tracking-wide', colors[p.toUpperCase()] || colors.LOW)}>
        {p}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 pt-24 space-y-8">
        
        {/* Navigation Head */}
        {view === 'overview' ? (
          <button
            onClick={() => router.push(`/track/${projectId}`)}
            className="flex items-center gap-2 text-indigo-700 hover:text-indigo-900 transition font-bold text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Project Progress
          </button>
        ) : view === 'component' ? (
          <button
            onClick={() => setView('overview')}
            className="flex items-center gap-2 text-indigo-700 hover:text-indigo-900 transition font-bold text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Project Execution
          </button>
        ) : (
          <button
            onClick={() => setView('component')}
            className="flex items-center gap-2 text-indigo-700 hover:text-indigo-900 transition font-bold text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Component Details
          </button>
        )}

        {/* VIEW A: PROJECT OVERVIEW DASHBOARD */}
        {view === 'overview' && (
          <>
            {/* Project Header ID Card Format (Replacing blue gradient block) */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <span className="text-[10px] font-black text-indigo-650 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full uppercase tracking-wider">
                  Project Execution
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
                <span className="text-lg font-black text-indigo-650">{expectedCompletionDate}</span>
              </div>
            </div>

            {/* Layout Grid: 75% Left (col-span-3) & 25% Right (col-span-1) */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
              
              {/* Left Column (75% Width): Overview counters + Room Checklists */}
              <div className="lg:col-span-3 space-y-6">

                {/* Execution Overview Status Counts */}
                <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-card">
                  <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Execution Overview</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
                    {[
                      { label: 'Total Components', val: overviewStats.total, color: 'text-slate-850' },
                      { label: 'Accepted', val: overviewStats.accepted, color: 'text-indigo-600' },
                      { label: 'In Production', val: overviewStats.inProduction, color: 'text-purple-600' },
                      { label: 'Dispatched', val: overviewStats.dispatched, color: 'text-blue-600' },
                      { label: 'Delivered', val: overviewStats.delivered, color: 'text-emerald-600' },
                      { label: 'Installed', val: overviewStats.installed, color: 'text-teal-600' },
                      { label: 'Active Issues', val: overviewStats.activeIssues, color: 'text-rose-605' },
                    ].map((stat, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 text-center hover:scale-[1.02] transition duration-250 flex flex-col justify-center min-h-[96px]">
                        <span className={clsx('text-2xl font-black block leading-none mb-1.5', stat.color)}>{stat.val}</span>
                        <span className="text-[10px] font-bold text-slate-450 leading-tight uppercase block tracking-wide">{stat.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Component Execution Table Card */}
                <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-card space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                      <h2 className="text-lg font-black text-slate-800 tracking-tight">Component Execution</h2>
                      <p className="text-xs text-slate-500 font-medium">Track progress of all components</p>
                    </div>

                    {/* Filter fields */}
                    <div className="flex flex-wrap gap-2.5">
                      <select
                        value={selectedRoomFilter}
                        onChange={(e) => setSelectedRoomFilter(e.target.value)}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 outline-none font-semibold text-slate-700 focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="ALL">All Rooms</option>
                        {uniqueRooms.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <select
                        value={selectedVendorFilter}
                        onChange={(e) => setSelectedVendorFilter(e.target.value)}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 outline-none font-semibold text-slate-700 focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="ALL">All Vendors</option>
                        {uniqueVendors.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                      <select
                        value={selectedStatusFilter}
                        onChange={(e) => setSelectedStatusFilter(e.target.value)}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 outline-none font-semibold text-slate-700 focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="ALL">All Statuses</option>
                        {['ordered', 'accepted', 'production', 'ready', 'dispatched', 'delivered', 'installed'].map(st => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Search query input */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search component name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700"
                    />
                  </div>

                  {/* Room accordion checklists */}
                  <div className="space-y-4">
                    {Object.keys(groupedTracking).map(roomName => {
                      const isExpanded = expandedRooms[roomName] !== false
                      const items = groupedTracking[roomName]

                      return (
                        <div key={roomName} className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50">
                          <button
                            onClick={() => setExpandedRooms(prev => ({ ...prev, [roomName]: !isExpanded }))}
                            className="w-full flex justify-between items-center p-4 bg-slate-150 hover:bg-slate-200/50 transition text-left"
                          >
                            <span className="font-extrabold text-sm text-slate-800 capitalize tracking-tight">
                              {roomName.replace(/_/g, ' ')} — {items.length} Component{items.length === 1 ? '' : 's'}
                            </span>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-505" /> : <ChevronDown className="w-4 h-4 text-slate-505" />}
                          </button>

                          {isExpanded && (
                            <div className="p-4 space-y-4 divide-y divide-slate-150">
                              {items.map(item => {
                                const phases = ['ordered', 'accepted', 'production', 'ready', 'dispatched', 'delivered', 'installed']
                                const curStatus = (item.status || 'ordered').toLowerCase()
                                const activeIdx = phases.indexOf(curStatus)

                                return (
                                  <div key={item.id} className="pt-4 first:pt-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div className="space-y-1">
                                      <h4 className="font-extrabold text-sm text-indigo-950">{item.item_name}</h4>
                                      <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">
                                        Vendor: {item.vendor_name || 'Pending assignment'}
                                      </p>
                                    </div>

                                    {/* Inline Status Lifecycle Dots */}
                                    <div className="flex items-center gap-5">
                                      <div className="flex items-center gap-1.5">
                                        {phases.map((ph, idx) => {
                                          const isDone = idx <= activeIdx
                                          const isCur = curStatus === ph
                                          return (
                                            <div
                                              key={ph}
                                              className={clsx(
                                                'w-2 h-2 rounded-full transition duration-300',
                                                isCur ? 'bg-indigo-650 ring-4 ring-indigo-100 scale-125' :
                                                isDone ? 'bg-emerald-500' : 'bg-slate-200'
                                              )}
                                              title={ph.toUpperCase()}
                                            />
                                          )
                                        })}
                                      </div>

                                      <div className="text-right text-[10px] text-slate-500 font-medium">
                                        <div>Exp: {item.expected_date || 'Pending'}</div>
                                        <div className="text-[8px] text-slate-400 mt-0.5">{item.remarks || 'Updated recently'}</div>
                                      </div>

                                      {/* Arrow navigation to Component Details */}
                                      <button 
                                        onClick={() => handleOpenComponent(item)}
                                        className="p-1.5 hover:bg-slate-200 rounded-lg transition"
                                      >
                                        <ChevronRight className="w-4 h-4 text-indigo-600" />
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {Object.keys(groupedTracking).length === 0 && (
                      <div className="text-center py-10 text-slate-400 font-bold text-sm">
                        No components match your search filters.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column (25% Width): Recent Activity (top) & Site Verification Gallery (below) */}
              <div className="lg:col-span-1 space-y-8">
                
                {/* Recent Activity Card (Moved to top of sidebar) */}
                <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-card space-y-6">
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Recent Activity</h3>
                    <p className="text-[10px] text-slate-400 font-medium mt-1">Track key delivery status and resolved issues.</p>
                  </div>

                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                    {recentActivities.map(act => (
                      <div key={act.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-3">
                        <div className="p-1 bg-emerald-50 rounded-lg border border-emerald-100 mt-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-750 leading-relaxed">{act.text}</p>
                          <span className="text-[9px] text-slate-400 font-bold block mt-1">{act.date}</span>
                        </div>
                      </div>
                    ))}

                    {recentActivities.length === 0 && (
                      <div className="text-center py-8 text-slate-400 text-xs font-semibold bg-slate-50/50 rounded-xl">
                        No recent updates in deliveries or resolutions yet.
                      </div>
                    )}
                  </div>
                </div>

                {/* Site Verification Gallery Card (Moved below Recent Activity) */}
                <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-card space-y-6">
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Site Verification Gallery</h3>
                    <p className="text-[10px] text-slate-400 font-medium mt-1">Room verification folders & component proof.</p>
                  </div>

                  {/* Folder based galleries grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {uniqueRooms.map(room => {
                      const roomPhotos = photosByRoom[room] || []
                      
                      return (
                        <button
                          key={room}
                          onClick={() => {
                            if (roomPhotos.length === 0) {
                              toast.error(`No site verification photos uploaded for ${room.replace(/_/g, ' ')}`)
                              return
                            }
                            setActiveGalleryRoom(room)
                            setActiveGalleryPhotoIdx(0)
                          }}
                          className="aspect-square bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-2xl flex flex-col items-center justify-center p-3 text-center transition"
                        >
                          <Folder className="w-8 h-8 text-indigo-500 mb-1.5" />
                          <span className="text-xs font-bold text-slate-800 capitalize leading-tight truncate w-full">{room.replace(/_/g, ' ')}</span>
                          <span className="text-[10px] text-slate-450 font-bold mt-1 uppercase leading-none">{roomPhotos.length} Photo{roomPhotos.length === 1 ? '' : 's'}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

              </div>
            </div>
          </>
        )}

        {/* VIEW B: COMPONENT DETAILS SUBPAGE */}
        {view === 'component' && selectedComp && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Left Column: Image and specifications about block */}
            <div className="space-y-6">
              <div className="bg-white border border-slate-200/60 rounded-3xl overflow-hidden shadow-card p-4">
                <div className="aspect-video w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/60">
                  <img
                    src={selectedComp.image_url.startsWith('http') ? selectedComp.image_url : `http://localhost:8000${selectedComp.image_url}`}
                    alt={selectedComp.item_name}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Status Header Outside About container */}
              <div className="bg-indigo-50 border border-indigo-150 p-4 rounded-2xl flex justify-between items-center">
                <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Current Status</span>
                <span className="px-3 py-1 bg-indigo-600 text-white rounded-full text-xs font-black uppercase tracking-wider shadow-sm">
                  {selectedComp.status}
                </span>
              </div>

              {/* Specifications About Block */}
              <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-card space-y-4">
                <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-100 pb-3">About Component</h3>
                {selectedComp.about_details && Object.keys(selectedComp.about_details).length > 0 ? (
                  <div className="space-y-2.5 text-xs">
                    {[
                      { label: 'Dimensions (WxHxD)', val: selectedComp.about_details.width ? `${selectedComp.about_details.width} x ${selectedComp.about_details.height} x ${selectedComp.about_details.depth} cm` : null },
                      { label: 'Mounting Type', val: selectedComp.about_details.mounting_type },
                      { label: 'Suitable Room', val: selectedComp.about_details.suitable_room },
                      { label: 'Finish Preference', val: selectedComp.about_details.finish },
                      { label: 'Style Vibe', val: selectedComp.about_details.style },
                      { label: 'Assembly Required', val: selectedComp.about_details.assembly_required ? 'Yes' : 'No' }
                    ].map((spec, sidx) => spec.val && (
                      <div key={sidx} className="flex justify-between py-1.5 border-b border-slate-50 last:border-0 font-semibold text-slate-700">
                        <span className="text-slate-400">{spec.label}</span>
                        <span className="text-slate-800 text-right capitalize">{spec.val}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 font-semibold italic">No specifications loaded for this component.</p>
                )}
              </div>

              {/* Component specific site verification images */}
              <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-card space-y-4">
                <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-100 pb-3">Installation verification</h3>
                {/* Search photos uploaded for this component name */}
                {photos.filter(p => p.caption?.toLowerCase().includes(selectedComp.item_name.toLowerCase())).length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {photos
                      .filter(p => p.caption?.toLowerCase().includes(selectedComp.item_name.toLowerCase()))
                      .map(p => (
                        <div key={p.id} className="relative rounded-xl overflow-hidden aspect-video bg-slate-50 border">
                          <img
                            src={p.image_url.startsWith('http') ? p.image_url : `http://localhost:8000${p.image_url}`}
                            alt="Verification"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400 text-xs font-semibold border border-dashed rounded-xl">
                    Verification photos will appear here after site installation.
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Tracking progress, history logs, vendor docs and issues */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Component Details Card Header */}
              <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-card flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedComp.room_name.replace(/_/g, ' ')}</span>
                  <h2 className="text-2xl font-black text-indigo-950 mt-1 tracking-tight">{selectedComp.item_name}</h2>
                  <p className="text-xs text-slate-505 font-medium mt-1">Vendor: {selectedComp.vendor_name || 'Pending assignment'}</p>
                </div>
                <div className="text-left sm:text-right text-xs text-slate-505 font-medium">
                  <div>Expected Delivery Date</div>
                  <div className="text-lg font-black text-indigo-650 mt-0.5">{selectedComp.expected_date || 'Pending'}</div>
                  <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-extrabold">{selectedComp.component_id}</div>
                </div>
              </div>

              {/* Horizontal dot step indicator */}
              <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-card space-y-4">
                <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-100 pb-3">Component Progress</h3>
                <div className="relative py-4 flex items-center justify-between w-full">
                  <div className="absolute inset-x-2.5 top-1/2 -translate-y-1/2 h-1 bg-slate-100 rounded z-0" />
                  {['assigned', 'accepted', 'production', 'ready', 'dispatched', 'delivered', 'installed'].map((st, idx) => {
                    const phases = ['assigned', 'accepted', 'production', 'ready', 'dispatched', 'delivered', 'installed']
                    const cur = (selectedComp.status || 'ordered').toLowerCase()
                    let curIdx = phases.indexOf(cur)
                    if (curIdx === -1 && cur === 'ordered') curIdx = 0 // map ordered -> assigned
                    const isActive = idx <= curIdx
                    const isCur = cur === st || (cur === 'ordered' && st === 'assigned')

                    return (
                      <div key={st} className="relative z-10 flex flex-col items-center flex-1">
                        <div
                          className={clsx(
                            'w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300 font-extrabold text-xs',
                            isCur ? 'bg-indigo-650 border-indigo-700 text-white ring-4 ring-indigo-155 scale-110 shadow-sm' :
                            isActive ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-405'
                          )}
                        >
                          {isActive ? '✓' : idx + 1}
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-2.5 text-center capitalize">{st}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Status history timeline logs */}
              <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-card space-y-4">
                <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-100 pb-3">Status History</h3>
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                  {compHistory.map((h, hidx) => (
                    <div key={h.id || hidx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-start text-xs font-semibold">
                      <div className="space-y-1">
                        <div className="text-slate-850 capitalize">Status changed to <span className="text-indigo-600 font-extrabold">{h.status}</span></div>
                        <p className="text-[10px] text-slate-400 font-bold">Updated by: {h.updatedBy}</p>
                        {h.remarks && <p className="text-[10px] text-slate-500 font-medium italic mt-1 bg-white p-2 rounded-lg border border-slate-100">"{h.remarks}"</p>}
                      </div>
                      <span className="text-[10px] text-slate-400">{new Date(h.changedAt).toLocaleString('en-IN', { hour12: true })}</span>
                    </div>
                  ))}

                  {compHistory.length === 0 && (
                    <div className="text-center py-6 text-slate-400 text-xs font-semibold bg-slate-50/50 rounded-xl">
                      No status logs created yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Vendor documents card */}
              <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-card space-y-4">
                <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-100 pb-3">Documents</h3>
                <div className="text-slate-400 text-xs font-semibold py-4 bg-slate-50/50 rounded-xl text-center border border-dashed">
                  No documents shared. Vendor updates will appear here.
                </div>
              </div>

              {/* Issues logged section - Only displayed when 1 or more issues exist for component */}
              {issues.filter(i => i.item_id === selectedComp.id).length > 0 && (
                <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-card space-y-4">
                  <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-100 pb-3">Logged Issues</h3>
                  <div className="space-y-3">
                    {issues.filter(i => i.item_id === selectedComp.id).map(issue => (
                      <div
                        key={issue.id}
                        onClick={() => handleEditIssueInit(issue)}
                        className="p-4 bg-rose-50/40 border border-rose-100 hover:bg-rose-50 transition rounded-xl flex justify-between items-center cursor-pointer"
                      >
                        <div className="space-y-1">
                          <span className="text-[9px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 uppercase tracking-widest">
                            {issue.type.replace(/_/g, ' ')}
                          </span>
                          <h4 className="font-extrabold text-xs text-slate-800 mt-1">{issue.description.substring(0, 100)}...</h4>
                          <span className="text-[10px] text-slate-400 block font-medium">Status: {issue.status}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-rose-500" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Bottom centered link to report issues */}
          <div className="flex flex-col items-center justify-center text-center py-8 border-t border-slate-200/60 space-y-2 max-w-md mx-auto mt-6">
            <span className="text-sm font-semibold text-slate-500">Have any issues?</span>
            <button
              onClick={handleNewIssueInit}
              className="text-xs font-black text-slate-800 hover:text-blue-600 hover:underline uppercase tracking-wider transition-colors duration-200 cursor-pointer"
            >
              Raise new Issue / complaint
            </button>
          </div>
        </>
      )}

        {/* VIEW C: ISSUE DETAILS (CREATE & EDIT) */}
        {view === 'issue' && selectedComp && (
          <div className="max-w-4xl mx-auto bg-white border border-slate-200/60 rounded-3xl shadow-xl overflow-hidden p-6 space-y-6">
            
            {/* Header info */}
            <div>
              <span className="text-[10px] font-black text-rose-700 bg-rose-50 px-3 py-1 rounded-full border border-rose-200 uppercase tracking-widest">
                {isEditingIssue ? 'Edit Issue Detail' : 'Raise component issue'}
              </span>
              <h2 className="text-2xl font-black text-slate-800 mt-3.5 tracking-tight">Report an issue related to this component</h2>
            </div>

            {/* Component Summary Card */}
            <div className="p-4 bg-slate-50 rounded-2xl flex items-center gap-4 border border-slate-100">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-200 border">
                <img
                  src={selectedComp.image_url.startsWith('http') ? selectedComp.image_url : `http://localhost:8000${selectedComp.image_url}`}
                  alt={selectedComp.item_name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1 text-xs">
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] block">Component</span>
                  <span className="font-extrabold text-slate-800">{selectedComp.item_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] block">Room</span>
                  <span className="font-extrabold text-slate-800 capitalize">{selectedComp.room_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] block">Vendor</span>
                  <span className="font-extrabold text-slate-800">{selectedComp.vendor_name || 'ABC Furnitures'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] block">Expected Date</span>
                  <span className="font-extrabold text-slate-800">{selectedComp.expected_date || '31 Aug 2026'}</span>
                </div>
              </div>
            </div>

            {/* Issue log Form */}
            <form onSubmit={handleIssueSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Issue Type *</label>
                  <select
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none text-slate-800 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="FUNCTIONAL">Functional Issue</option>
                    <option value="MECHANICAL">Mechanical Issue</option>
                    <option value="STRUCTURAL">Structural Issue</option>
                    <option value="COSMETIC">Cosmetic Issue</option>
                    <option value="DAMAGE">Product Damage</option>
                    <option value="DELAY">Vendor Delay</option>
                    <option value="INSTALLATION">Installation Problem</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Priority *</label>
                  <select
                    value={issuePriority}
                    onChange={(e) => setIssuePriority(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none text-slate-800 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Date Encountered *</label>
                  <input
                    type="date"
                    required
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none text-slate-800 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-505 uppercase tracking-widest mb-1.5">Issue Description *</label>
                <textarea
                  placeholder="Describe the issue in detail..."
                  required
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  rows={4}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none text-slate-800 focus:ring-1 focus:ring-indigo-500 resize-none font-medium"
                />
              </div>

              {/* Photos & Evidence uploads */}
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-505 uppercase tracking-widest">Photos / Evidence</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center bg-slate-50 hover:bg-slate-100/50 transition cursor-pointer relative">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleIssueFilesChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <Camera className="w-8 h-8 text-slate-400 mb-2" />
                    <span className="text-xs font-bold text-indigo-700">Choose Files</span>
                    <span className="text-[10px] text-slate-450 mt-1 font-semibold">JPG, PNG up to 5 files</span>
                  </div>

                  {/* Thumbnail previews */}
                  <div className="grid grid-cols-3 gap-2 border border-slate-100 rounded-2xl p-4 bg-slate-50/30 overflow-y-auto max-h-[140px]">
                    {issuePhotoPreviews.map((preview, previewIdx) => (
                      <div key={previewIdx} className="relative rounded-xl overflow-hidden aspect-video bg-slate-200 border">
                        <img src={preview} alt="preview" className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {issuePhotoPreviews.length === 0 && (
                      <div className="col-span-3 text-center text-slate-400 text-xs font-semibold py-8 italic">
                        No files uploaded yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions footer */}
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setView('component')}
                  className="px-5 py-2.5 border border-slate-250 hover:bg-slate-50 text-slate-505 font-bold rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingIssue}
                  className="px-6 py-2.5 bg-indigo-650 hover:bg-indigo-700 disabled:bg-indigo-800 text-white font-bold rounded-xl text-xs transition shadow-sm"
                >
                  {isSubmittingIssue ? 'Submitting...' : isEditingIssue ? 'Save Issue' : 'Submit Issue'}
                </button>
              </div>
            </form>
          </div>
        )}

      </div>

      {/* Glassmorphic site gallery modal overlay */}
      {activeGalleryRoom && (
        <div 
          onClick={() => setActiveGalleryRoom(null)}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="relative max-w-4xl w-full aspect-video bg-black/85 rounded-3xl overflow-hidden border border-white/10 flex items-center justify-center group"
          >
            {(() => {
              const roomPhotos = photosByRoom[activeGalleryRoom] || []
              const activePhoto = roomPhotos[activeGalleryPhotoIdx]
              if (!activePhoto) return null

              return (
                <>
                  <img
                    src={activePhoto.image_url.startsWith('http') ? activePhoto.image_url : `http://localhost:8000${activePhoto.image_url}`}
                    alt={activeGalleryRoom}
                    className="max-h-full max-w-full object-contain"
                  />
                  {/* Caption banner at bottom */}
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm p-4 text-white text-xs font-bold text-center">
                    {activePhoto.caption || `${activeGalleryRoom.replace(/_/g, ' ')} Verification Photo`}
                  </div>

                  {/* Left and Right navigation arrow buttons */}
                  {roomPhotos.length > 1 && (
                    <>
                      <button
                        onClick={() => {
                          setActiveGalleryPhotoIdx(prev => prev === 0 ? roomPhotos.length - 1 : prev - 1)
                        }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 text-white hover:bg-black/80 transition border border-white/15 shadow-md"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => {
                          setActiveGalleryPhotoIdx(prev => prev === roomPhotos.length - 1 ? 0 : prev + 1)
                        }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 text-white hover:bg-black/80 transition border border-white/15 shadow-md"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}

    </div>
  )
}
