'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCustomerStore } from '@/stores/customerStore'
import Navbar from '@/components/Navbar'
import ExecutionProgressBar from '@/components/ExecutionProgressBar'
import IssueTracker from '@/components/IssueTracker'
import TimelineView from '@/components/TimelineView'
import { ArrowLeft, ChevronDown, ChevronUp, Image as ImageIcon, Camera, Calendar, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ProjectExecutionPage() {
  const { projectId } = useParams() as { projectId: string }
  const router = useRouter()
  const {
    tracking,
    photos,
    isLoading,
    error,
    fetchTracking,
    updateTracking,
    fetchPhotos,
    uploadPhoto,
  } = useCustomerStore()

  const [expandedRooms, setExpandedRooms] = useState<Record<string, boolean>>({
    'Hall': true,
    'Bedroom': true,
    'Kitchen': true,
  })
  
  // Photo fields
  const [photoRoom, setPhotoRoom] = useState('')
  const [photoCaption, setPhotoCaption] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)

  useEffect(() => {
    fetchTracking(projectId)
    fetchPhotos(projectId)
  }, [projectId, fetchTracking, fetchPhotos])

  const toggleRoom = (roomName: string) => {
    setExpandedRooms((prev) => ({ ...prev, [roomName]: !prev[roomName] }))
  }

  // Calculate project progress percentage based on tracking items
  const calculateProgress = () => {
    if (tracking.length === 0) return 0
    const statusWeights: Record<string, number> = {
      ordered: 15,
      accepted: 30,
      production: 50,
      ready: 60,
      dispatched: 75,
      delivered: 90,
      installed: 100,
    }
    const total = tracking.reduce((sum, item) => sum + (statusWeights[item.status.toLowerCase()] || 0), 0)
    return Math.round(total / tracking.length)
  }

  const handleStatusChange = async (trackingId: string, newStatus: string) => {
    try {
      await updateTracking(projectId, trackingId, newStatus)
      toast.success('Status updated successfully')
    } catch {
      toast.error('Failed to update status')
    }
  }

  const handlePhotoUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!photoRoom) {
      toast.error('Please enter room name')
      return
    }
    setIsUploadingPhoto(true)
    try {
      await uploadPhoto(projectId, photoRoom, photoCaption, photoFile || undefined)
      toast.success('Site photo uploaded')
      setPhotoRoom('')
      setPhotoCaption('')
      setPhotoFile(null)
    } catch {
      toast.error('Failed to upload photo')
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const groupedTracking = tracking.reduce((groups: Record<string, any[]>, item) => {
    const room = item.room_name || 'Other'
    if (!groups[room]) groups[room] = []
    groups[room].push(item)
    return groups
  }, {})

  const timelineResources = tracking.map((item) => ({
    id: item.id,
    title: `${item.room_name} - ${item.item_name}`,
    status: item.status.toUpperCase(),
    createdAt: new Date(),
  }))

  const progress = calculateProgress()

  return (
    <div className="min-h-screen text-white pb-16" style={{ background: 'linear-gradient(135deg, #dfd9d4 0%, #bed4e3 20%, #6062ed 60%, #322e6b 100%)', backgroundAttachment: 'fixed' }}>
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 pt-24 space-y-8">
        {/* Back navigation */}
        <button
          onClick={() => router.push(`/track/${projectId}`)}
          className="flex items-center gap-2 text-indigo-950 hover:text-slate-900 transition-colors text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Project Tracker
        </button>

        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900">
              Project Execution Details
            </h1>
            <p className="text-sm text-indigo-950/70 mt-1 font-medium">
              Track room-by-room fabrication status and upload verification progress photos.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Progress & Accordion checklists */}
          <div className="lg:col-span-2 space-y-8">
            {/* Progress indicator */}
            <ExecutionProgressBar progress={progress} status={progress < 30 ? 'DELAYED' : 'ON_TRACK'} />

            {/* Gantt Timeline */}
            <TimelineView resources={timelineResources} />

            {/* Room-wise Accordion list */}
            <div className="bg-[#0f1129] border border-white/10 p-6 rounded-2xl shadow-card backdrop-blur-md space-y-4">
              <h2 className="text-lg font-bold text-white uppercase tracking-wider mb-2">Room-Wise Sourcing Checklist</h2>

              {Object.keys(groupedTracking).map((roomName) => {
                const isExpanded = expandedRooms[roomName]
                const items = groupedTracking[roomName]

                return (
                  <div key={roomName} className="border border-white/5 rounded-xl overflow-hidden bg-indigo-900/10">
                    <button
                      onClick={() => toggleRoom(roomName)}
                      className="w-full flex justify-between items-center p-4 bg-indigo-900/20 hover:bg-indigo-900/30 transition-colors text-left"
                    >
                      <span className="font-bold text-sm text-white">{roomName} ({items.length} Items)</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-indigo-300" /> : <ChevronDown className="w-4 h-4 text-indigo-300" />}
                    </button>

                    {isExpanded && (
                      <div className="p-4 space-y-4 divide-y divide-white/5">
                        {items.map((item) => (
                          <div key={item.id} className="pt-4 first:pt-0 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                            <div className="flex-1 min-w-[150px]">
                              <h4 className="font-bold text-xs text-white">{item.item_name}</h4>
                              {item.expected_date && (
                                <p className="text-[10px] text-indigo-300/60 mt-1 flex items-center gap-1 font-medium">
                                  <Calendar className="w-3 h-3" /> Expected: {item.expected_date}
                                </p>
                              )}
                            </div>

                            {/* Center/Right: Dual Sourcing Status Controls */}
                            <div className="flex flex-wrap items-center gap-5">
                              {/* Vendor Progress Chain */}
                              <div className="flex flex-col gap-1">
                                <span className="text-[8px] text-slate-400 uppercase tracking-widest font-extrabold">Vendor Status</span>
                                <div className="flex items-center gap-1 bg-slate-950/40 p-1 rounded-lg border border-white/5">
                                  {(() => {
                                    const phases = ['ordered', 'accepted', 'production', 'ready', 'dispatched'];
                                    const current = (item.status || 'ordered').toLowerCase();
                                    
                                    // Determine active index in vendor phases
                                    let activeIndex = phases.indexOf(current);
                                    if (activeIndex === -1 && ['delivered', 'installed'].includes(current)) {
                                      activeIndex = phases.length - 1; // Dispatched is highlighted as past phase
                                    }

                                    return phases.map((phase, idx) => {
                                      const isActive = idx <= activeIndex;
                                      const isCurrent = current === phase;
                                      return (
                                        <span
                                          key={phase}
                                          className={`px-2 py-0.5 text-[9px] font-extrabold rounded uppercase tracking-wider transition-all duration-300 ${
                                            isCurrent
                                              ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400'
                                              : isActive
                                              ? 'bg-indigo-950/70 text-indigo-300/70'
                                              : 'bg-transparent text-slate-600'
                                          }`}
                                        >
                                          {phase}
                                        </span>
                                      );
                                    });
                                  })()}
                                </div>
                              </div>

                              {/* Customer Actions / Verification Chain */}
                              <div className="flex flex-col gap-1">
                                <span className="text-[8px] text-slate-400 uppercase tracking-widest font-extrabold">Customer Verification</span>
                                <div className="flex items-center gap-1 bg-slate-950/40 p-1 rounded-lg border border-white/5">
                                  {/* Ordered (Always active customer-side baseline) */}
                                  <span className="px-2 py-0.5 text-[9px] font-extrabold rounded uppercase tracking-wider bg-slate-800 text-slate-300 ring-1 ring-slate-700 select-none">
                                    Ordered
                                  </span>

                                  {/* Delivered Button */}
                                  <button
                                    onClick={() => handleStatusChange(item.id, 'delivered')}
                                    className={`px-2.5 py-0.5 text-[9px] font-extrabold rounded uppercase tracking-wider transition-all duration-300 ${
                                      ['delivered', 'installed'].includes((item.status || '').toLowerCase())
                                        ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                                        : 'bg-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                    }`}
                                  >
                                    Delivered
                                  </button>

                                  {/* Installed Button */}
                                  <button
                                    onClick={() => handleStatusChange(item.id, 'installed')}
                                    className={`px-2.5 py-0.5 text-[9px] font-extrabold rounded uppercase tracking-wider transition-all duration-300 ${
                                      (item.status || '').toLowerCase() === 'installed'
                                        ? 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-400'
                                        : 'bg-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                    }`}
                                  >
                                    Installed
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              {Object.keys(groupedTracking).length === 0 && (
                <p className="text-sm text-indigo-300/40 text-center py-6">No item tracking data available.</p>
              )}
            </div>
          </div>

          {/* Right Column: Site Photos and Issue Tracker */}
          <div className="space-y-8">
            {/* Issue log tracker */}
            <IssueTracker projectId={projectId} />

            {/* Verification Photos */}
            <div className="bg-[#0f1129] border border-white/10 p-6 rounded-2xl shadow-card backdrop-blur-md space-y-6">
              <div>
                <h3 className="font-bold text-white text-sm uppercase tracking-wider">Site Verification Gallery</h3>
                <p className="text-[10px] text-indigo-300/60 font-medium mt-1">Upload and review on-site fabrication proof.</p>
              </div>

              {/* Upload form */}
              <form onSubmit={handlePhotoUpload} className="p-4 bg-indigo-900/20 rounded-xl border border-white/5 space-y-4">
                <div>
                  <label className="block text-[9px] font-bold text-indigo-300 uppercase tracking-wider mb-1">Room Context</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Master Bedroom, Kitchen"
                    value={photoRoom}
                    onChange={(e) => setPhotoRoom(e.target.value)}
                    className="w-full text-xs bg-indigo-950 border border-white/10 rounded-lg p-2.5 outline-none text-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-indigo-300 uppercase tracking-wider mb-1">Caption / Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Sofa fabric padding installed"
                    value={photoCaption}
                    onChange={(e) => setPhotoCaption(e.target.value)}
                    className="w-full text-xs bg-indigo-950 border border-white/10 rounded-lg p-2.5 outline-none text-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-indigo-300 uppercase tracking-wider mb-1">Photo Upload</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-indigo-200 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-gradient-to-r file:from-purple-600 file:to-indigo-600 file:text-white hover:file:from-purple-700 hover:file:to-indigo-700 cursor-pointer"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isUploadingPhoto}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-850 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <Camera className="w-3.5 h-3.5" />
                  {isUploadingPhoto ? 'Uploading...' : 'Add Verification Photo'}
                </button>
              </form>

              {/* Photos List Grid */}
              <div className="grid grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative group rounded-xl overflow-hidden shadow-sm aspect-video border border-white/10 bg-indigo-900/10">
                    <img
                      src={photo.image_url.startsWith('http') ? photo.image_url : `http://localhost:8000${photo.image_url}`}
                      alt={photo.room_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 text-white">
                      <span className="text-[10px] font-bold">{photo.room_name}</span>
                      <span className="text-[8px] opacity-75 font-semibold mt-0.5">{photo.caption}</span>
                    </div>
                  </div>
                ))}

                {photos.length === 0 && (
                  <div className="col-span-2 text-center py-8 text-indigo-300/40 text-xs font-semibold">
                    <Camera className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No site verification photos yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
