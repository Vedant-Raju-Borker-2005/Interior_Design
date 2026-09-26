'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { enterpriseAPI } from '@/lib/api'
import Navbar from '@/components/Navbar'
import BulkPricingCard from '@/components/BulkPricingCard'
import toast from 'react-hot-toast'
import { ArrowLeft, User, Mail, Phone, Link2, Copy, Trash2, Calendar, MapPin, Building, Activity, Layout, Eye, CheckCircle2, Plus } from 'lucide-react'
import clsx from 'clsx'

const STATUS_FILTERS = [
  'All',
  'Unassigned',
  'Not Invited',
  'Invited',
  'Onboarding',
  'Onboarding Complete',
  'Customization',
  'AI Rendering',
  'Completed'
]

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Unassigned': { bg: 'bg-slate-50', text: 'text-slate-650', border: 'border-slate-200' },
  'Not Invited': { bg: 'bg-amber-50/50', text: 'text-amber-800', border: 'border-amber-200' },
  'Invited': { bg: 'bg-blue-50/50', text: 'text-blue-800', border: 'border-blue-200' },
  'Onboarding': { bg: 'bg-orange-50/50', text: 'text-orange-850 text-orange-800', border: 'border-orange-200' },
  'Onboarding Complete': { bg: 'bg-teal-50/50', text: 'text-teal-850 text-teal-800', border: 'border-teal-200' },
  'Customization': { bg: 'bg-purple-50/50', text: 'text-purple-800', border: 'border-purple-200' },
  'AI Rendering': { bg: 'bg-pink-50/50', text: 'text-pink-850 text-pink-850', border: 'border-pink-200' },
  'Completed': { bg: 'bg-emerald-50/50', text: 'text-emerald-800', border: 'border-emerald-200' }
}

export default function EnterpriseProjectPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params?.projectId as string

  const [project, setProject] = useState<any>(null)
  const [flats, setFlats] = useState<any[]>([])
  const [floorPlans, setFloorPlans] = useState<any[]>([])
  const [typologies, setTypologies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('All')

  // Typology Modals & Active state
  const [showAddTypologyModal, setShowAddTypologyModal] = useState(false)
  const [showViewAssignedModal, setShowViewAssignedModal] = useState(false)
  const [showAssignFlatsModal, setShowAssignFlatsModal] = useState(false)
  const [activeTypologyId, setActiveTypologyId] = useState<string | null>(null)

  // Add Typology Form state
  const [newTypName, setNewTypName] = useState('')
  const [newTypSqft, setNewTypSqft] = useState<number | ''>('')
  const [newTypFile, setNewTypFile] = useState<File | null>(null)
  const [newTypPreview, setNewTypPreview] = useState<string | null>(null)
  const [submittingTypology, setSubmittingTypology] = useState(false)

  // Modal states
  const [selectedFlat, setSelectedFlat] = useState<any>(null)
  const [assignName, setAssignName] = useState('')
  const [assignPhone, setAssignPhone] = useState('')
  const [assignEmail, setAssignEmail] = useState('')
  
  // Inline edit state inside Modal
  const [editFlatNumber, setEditFlatNumber] = useState('')
  const [editBhkType, setEditBhkType] = useState('')
  const [editFloorPlanId, setEditFloorPlanId] = useState('')
  const [editTypologyId, setEditTypologyId] = useState('')
  const [isEditingFlat, setIsEditingFlat] = useState(false)
  const [submittingFlatEdit, setSubmittingFlatEdit] = useState(false)

  const fetchData = async () => {
    try {
      const [projRes, flatsRes, fpRes, typRes] = await Promise.all([
        enterpriseAPI.getProject(projectId),
        enterpriseAPI.listFlats(projectId),
        enterpriseAPI.listFloorPlans(projectId),
        enterpriseAPI.listTypologies(projectId)
      ])
      setProject(projRes.data)
      setFlats(flatsRes.data.flats || [])
      setFloorPlans(fpRes.data || [])
      const list = typRes.data || []
      setTypologies(list)
      if (list.length > 0 && !activeTypologyId) {
        setActiveTypologyId(list[0].id)
      }
      setLoading(false)
    } catch (err: any) {
      console.error("Failed to load project details:", err)
      toast.error("Failed to fetch project details.")
      router.push('/enterprise/dashboard')
    }
  }

  useEffect(() => {
    if (projectId) {
      fetchData()
    }
  }, [projectId])

  const handleCreateTypology = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTypName.trim()) {
      toast.error("Typology prototype name is required.")
      return
    }

    setSubmittingTypology(true)
    try {
      const sqft = newTypSqft ? Number(newTypSqft) : undefined
      if (newTypFile) {
        await enterpriseAPI.uploadAndCreateTypology(projectId, newTypName.trim(), sqft, newTypFile)
      } else {
        await enterpriseAPI.createTypology(projectId, { name: newTypName.trim(), carpet_area_sqft: sqft })
      }
      toast.success("New typology prototype created!")
      setNewTypName('')
      setNewTypSqft('')
      setNewTypFile(null)
      setNewTypPreview(null)
      setShowAddTypologyModal(false)

      const [freshTyps, freshFlats] = await Promise.all([
        enterpriseAPI.listTypologies(projectId),
        enterpriseAPI.listFlats(projectId)
      ])
      const list = freshTyps.data || []
      setTypologies(list)
      setFlats(freshFlats.data.flats || [])
      if (!activeTypologyId && list.length > 0) {
        setActiveTypologyId(list[0].id)
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to create typology.")
    } finally {
      setSubmittingTypology(false)
    }
  }

  const handleToggleAssignFlat = async (flatId: string, targetTypologyId: string) => {
    const targetFlat = flats.find(f => f.id === flatId)
    if (!targetFlat) return

    const isCurrent = targetFlat.typology_id === targetTypologyId
    const newTypId = isCurrent ? "" : targetTypologyId
    const targetTyp = typologies.find(t => t.id === newTypId)

    // Immediate optimistic update
    setFlats(prev => prev.map(f => {
      if (f.id === flatId) {
        return {
          ...f,
          typology_id: newTypId || null,
          typology_name: targetTyp ? targetTyp.name : null,
          floor_plan_name: targetTyp?.floor_plan ? targetTyp.floor_plan.layout_name : f.floor_plan_name,
          floor_plan_url: targetTyp?.floor_plan ? targetTyp.floor_plan.file_url : f.floor_plan_url,
        }
      }
      return f
    }))

    try {
      await enterpriseAPI.updateFlat(flatId, { typology_id: newTypId })
      if (newTypId) {
        toast.success(`Flat ${targetFlat.flat_number} assigned to ${targetTyp?.name || 'typology'}`)
      } else {
        toast.success(`Flat ${targetFlat.flat_number} unassigned from typology`)
      }
    } catch (err: any) {
      toast.error("Failed to update flat allocation.")
      const fresh = await enterpriseAPI.listFlats(projectId)
      setFlats(fresh.data.flats || [])
    }
  }

  const handleAssignCustomer = async () => {
    if (!selectedFlat || !assignName.trim() || !assignEmail.trim()) {
      toast.error("Name and Email are required fields.")
      return
    }

    try {
      await enterpriseAPI.assignCustomer(selectedFlat.id, {
        name: assignName,
        phone: assignPhone || undefined,
        email: assignEmail || undefined
      })
      toast.success("Customer assigned to flat!")
      setAssignName('')
      setAssignPhone('')
      setAssignEmail('')
      
      // Refresh flat details
      const freshFlats = await enterpriseAPI.listFlats(projectId)
      setFlats(freshFlats.data.flats || [])
      
      // Update selected flat in modal
      const updated = freshFlats.data.flats.find((f: any) => f.id === selectedFlat.id)
      setSelectedFlat(updated)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to assign customer.")
    }
  }

  const handleGenerateInvite = async () => {
    if (!selectedFlat) return
    try {
      const res = await enterpriseAPI.inviteCustomer(selectedFlat.id)
      toast.success("Invitation generated successfully!")
      
      const freshFlats = await enterpriseAPI.listFlats(projectId)
      setFlats(freshFlats.data.flats || [])
      
      const updated = freshFlats.data.flats.find((f: any) => f.id === selectedFlat.id)
      setSelectedFlat(updated)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to generate invite.")
    }
  }

  const handleRevokeInvite = async () => {
    if (!selectedFlat) return
    try {
      await enterpriseAPI.revokeInvitation(selectedFlat.id)
      toast.success("Invitation link revoked.")
      
      const freshFlats = await enterpriseAPI.listFlats(projectId)
      setFlats(freshFlats.data.flats || [])
      
      const updated = freshFlats.data.flats.find((f: any) => f.id === selectedFlat.id)
      setSelectedFlat(updated)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to revoke invite.")
    }
  }

  const handleCopyLink = (token: string) => {
    const inviteUrl = `${window.location.origin}/invite?token=${token}`
    navigator.clipboard.writeText(inviteUrl)
    toast.success("Invitation link copied to clipboard! 📋")
  }

  const handleFlatEditStart = () => {
    setEditFlatNumber(selectedFlat.flat_number)
    setEditBhkType(selectedFlat.bhk_type)
    setEditFloorPlanId(selectedFlat.floor_plan_id || '')
    setEditTypologyId(selectedFlat.typology_id || '')
    setIsEditingFlat(true)
  }

  const handleSaveFlatConfig = async () => {
    if (!selectedFlat) return
    setSubmittingFlatEdit(true)
    try {
      await enterpriseAPI.updateFlat(selectedFlat.id, {
        flat_number: editFlatNumber,
        bhk_type: editBhkType,
        floor_plan_id: editFloorPlanId || "",
        typology_id: editTypologyId || ""
      })
      toast.success("Flat layout configuration updated!")
      setIsEditingFlat(false)
      
      // Refresh details
      const freshFlats = await enterpriseAPI.listFlats(projectId)
      setFlats(freshFlats.data.flats || [])
      
      const updated = freshFlats.data.flats.find((f: any) => f.id === selectedFlat.id)
      setSelectedFlat(updated)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to save configuration.")
    } finally {
      setSubmittingFlatEdit(false)
    }
  }

  // Filtering flats
  const filteredFlats = flats.filter(f => {
    if (activeFilter === 'All') return true
    return f.status === activeFilter
  })

  // Group flats by BHK
  const bhkGroups: Record<string, any[]> = {}
  filteredFlats.forEach(f => {
    if (!bhkGroups[f.bhk_type]) {
      bhkGroups[f.bhk_type] = []
    }
    bhkGroups[f.bhk_type].push(f)
  })

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 pt-28 pb-16 space-y-8">
        
        {/* Header section */}
        {project && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <button
                onClick={() => router.push('/enterprise/dashboard')}
                className="flex items-center gap-1.5 text-xs text-slate-500 font-bold hover:text-indigo-650 transition"
              >
                <ArrowLeft className="w-4 h-4" /> Developments Dashboard
              </button>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">{project.property_name}</h1>
              <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-400">
                <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400" /> {project.city}</span>
                <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-slate-400" /> Ready starting: {project.earliest_start_date}</span>
                <span className="flex items-center gap-1.5"><Activity className="w-4 h-4 text-slate-400" /> Total inventory: {project.total_units} units</span>
              </div>
            </div>

            {/* Quick stats view */}
            <div className="flex gap-4">
              <div className="px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-center">
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Active</span>
                <span className="font-extrabold text-indigo-700 text-sm">{project.stats?.started || 0} units</span>
              </div>
              <div className="px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
                <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Completed</span>
                <span className="font-extrabold text-emerald-700 text-sm">{project.stats?.completed || 0} units</span>
              </div>
            </div>
          </div>
        )}

        {/* Unit-wise pricing with original vs discounted (feedback 2.2 / 2.3) */}
        {project && <BulkPricingCard projectId={projectId as string} />}

        {/* Project Typologies Shelf */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
                <Layout className="w-5 h-5 text-indigo-650" /> Project Typologies & Prototypes
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                  {typologies.length} Defined
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Standardized architectural prototypes with layout blueprints and flat allocations.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowAddTypologyModal(true)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add New Typology
              </button>
              <button
                type="button"
                onClick={() => {
                  if (typologies.length > 0 && !activeTypologyId) setActiveTypologyId(typologies[0].id)
                  setShowViewAssignedModal(true)
                }}
                disabled={typologies.length === 0}
                className="px-3.5 py-2 bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-650 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition disabled:opacity-40"
              >
                <Eye className="w-3.5 h-3.5" /> View Assigned Typologies
              </button>
              <button
                type="button"
                onClick={() => {
                  if (typologies.length > 0 && !activeTypologyId) setActiveTypologyId(typologies[0].id)
                  setShowAssignFlatsModal(true)
                }}
                disabled={typologies.length === 0}
                className="px-3.5 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-40"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Assign to Flats
              </button>
            </div>
          </div>

          {/* Typologies Horizontal Scrollable Shelf */}
          {typologies.length === 0 ? (
            <div className="text-center py-8 px-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <p className="text-slate-500 text-xs font-medium">No typologies defined yet for this development.</p>
              <button
                type="button"
                onClick={() => setShowAddTypologyModal(true)}
                className="mt-3 text-xs font-bold text-indigo-600 hover:underline inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add your first typology prototype
              </button>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 pt-1 scrollbar-hide">
              {typologies.map((typ) => {
                const assignedCount = flats.filter(f => f.typology_id === typ.id).length
                const imgUrl = typ.floor_plan?.file_url
                return (
                  <div
                    key={typ.id}
                    className="min-w-[260px] max-w-[280px] p-4 rounded-2xl border border-slate-200 bg-slate-50/40 hover:bg-white hover:border-indigo-300 transition-all flex flex-col justify-between shrink-0 shadow-xs"
                  >
                    <div className="flex gap-3 items-start">
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={typ.name}
                          className="w-14 h-14 rounded-xl object-cover border border-slate-200 shadow-2xs shrink-0 bg-white"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 text-indigo-500">
                          <Layout className="w-6 h-6" />
                        </div>
                      )}
                      <div className="overflow-hidden">
                        <span className="font-extrabold text-slate-800 text-sm block truncate" title={typ.name}>
                          {typ.name}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 block mt-0.5">
                          {typ.carpet_area_sqft ? `${typ.carpet_area_sqft.toLocaleString()} sq.ft` : 'Carpet Area: N/A'}
                        </span>
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full inline-block mt-1.5">
                          {assignedCount} {assignedCount === 1 ? 'Flat' : 'Flats'} Assigned
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-200/60 flex justify-between items-center text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTypologyId(typ.id)
                          setShowViewAssignedModal(true)
                        }}
                        className="text-slate-500 hover:text-indigo-650 font-bold text-[11px] flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" /> Check Flats
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTypologyId(typ.id)
                          setShowAssignFlatsModal(true)
                        }}
                        className="text-indigo-600 hover:text-indigo-800 font-extrabold text-[11px] flex items-center gap-1"
                      >
                        Assign <CheckCircle2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Filter bar */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide select-none">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={clsx(
                'px-4 py-2 rounded-xl text-xs font-bold transition flex-shrink-0',
                activeFilter === filter
                  ? 'bg-indigo-650 text-white shadow-sm font-black'
                  : 'bg-white text-slate-650 hover:bg-slate-100 border border-slate-200'
              )}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* BHK Group lists */}
        {loading ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-500 text-sm">Fetching units list...</p>
          </div>
        ) : Object.keys(bhkGroups).length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-150 shadow-sm">
            <p className="text-slate-400 text-xs italic">No flats found matching selected status filter.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.keys(bhkGroups).sort().map((bhkKey) => (
              <div key={bhkKey} className="space-y-4">
                <h3 className="text-xs font-extrabold text-indigo-700 uppercase tracking-wider border-l-4 border-indigo-600 pl-2">
                  {bhkKey} Units ({bhkGroups[bhkKey].length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                  {bhkGroups[bhkKey].map((flat) => {
                    const col = STATUS_COLORS[flat.status] || { bg: 'bg-slate-50', text: 'text-slate-800', border: 'border-slate-200' }
                    return (
                      <div
                        key={flat.id}
                        onClick={() => setSelectedFlat(flat)}
                        className={clsx(
                          'p-4 rounded-xl border-2 text-left cursor-pointer transition flex flex-col justify-between h-32 hover:scale-[1.02] shadow-sm hover:shadow-md bg-white',
                          col.border,
                          'hover:border-indigo-400'
                        )}
                      >
                        <div>
                          <div className="flex justify-between items-center">
                            <span className="font-extrabold text-slate-850 text-slate-800 text-sm">Flat {flat.flat_number}</span>
                            <span className={clsx("w-2 h-2 rounded-full", col.bg.replace('bg-', 'bg-').replace('/50', ''))} style={{ backgroundColor: flat.status === 'Completed' ? '#10B981' : flat.status === 'Unassigned' ? '#94A3B8' : '#F59E0B' }} />
                          </div>
                          
                          {flat.customer_name ? (
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold mt-2 truncate">
                              <User className="w-3 h-3 text-slate-400" />
                              <span>{flat.customer_name}</span>
                            </div>
                          ) : (
                            <span className="block text-[9px] text-slate-400 italic mt-2">Unassigned</span>
                          )}
                        </div>

                        <div>
                          {flat.typology_name ? (
                            <span className="block text-[8px] font-bold text-indigo-700 bg-indigo-50/80 px-1.5 py-0.5 rounded truncate mb-1" title={flat.typology_name}>
                              📐 {flat.typology_name}
                            </span>
                          ) : flat.floor_plan_name ? (
                            <span className="block text-[8px] text-indigo-700 font-medium truncate mb-1" title={flat.floor_plan_name}>
                              Plan: {flat.floor_plan_name}
                            </span>
                          ) : (
                            <span className="block text-[8px] text-slate-400 italic mb-1">
                              No Typology
                            </span>
                          )}
                          <span className={clsx('inline-block text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider', col.bg, col.text)}>
                            {flat.status}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Flat Details Overlay Modal */}
      {selectedFlat && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-slate-100 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-slate-800 text-base">Flat {selectedFlat.flat_number} Details</h3>
                <span className="text-[10px] font-semibold text-slate-500">BHK Structure: {selectedFlat.bhk_type}</span>
              </div>
              <button
                onClick={() => {
                  setSelectedFlat(null)
                  setIsEditingFlat(false)
                }}
                className="text-slate-400 hover:text-slate-600 text-xl font-extrabold focus:outline-none"
              >
                &times;
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              
              {/* Configuration edit fields toggled */}
              {isEditingFlat ? (
                <div className="bg-indigo-50/20 border border-indigo-150 rounded-2xl p-4 space-y-4">
                  <h4 className="font-bold text-indigo-850 uppercase text-[10px]">Edit Configuration</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1">Unit Number</label>
                      <input
                        type="text"
                        value={editFlatNumber}
                        onChange={e => setEditFlatNumber(e.target.value)}
                        className="input w-full px-2.5 py-2 rounded-lg border border-slate-200 text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1">BHK</label>
                      <select
                        value={editBhkType}
                        onChange={e => setEditBhkType(e.target.value)}
                        className="select w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white"
                      >
                        <option value="1BHK">1 BHK</option>
                        <option value="2BHK">2 BHK</option>
                        <option value="3BHK">3 BHK</option>
                        <option value="4BHK">4 BHK</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1">Floor Plan</label>
                      <select
                        value={editFloorPlanId}
                        onChange={e => setEditFloorPlanId(e.target.value)}
                        className="select w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white"
                      >
                        <option value="">No layout linked</option>
                        {floorPlans.map(p => (
                          <option key={p.id} value={p.id}>{p.layout_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1">Typology</label>
                      <select
                        value={editTypologyId}
                        onChange={e => setEditTypologyId(e.target.value)}
                        className="select w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white"
                      >
                        <option value="">No typology</option>
                        {typologies.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setIsEditingFlat(false)} className="px-3 py-1 bg-slate-200 hover:bg-slate-350 text-slate-700 font-bold rounded-lg">
                      Cancel
                    </button>
                    <button onClick={handleSaveFlatConfig} disabled={submittingFlatEdit} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg">
                      {submittingFlatEdit ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-center bg-slate-50 border border-slate-100 p-3.5 rounded-xl">
                    <div>
                      <span className="text-slate-450 block text-[9px] uppercase font-bold tracking-wider">Assigned Typology Prototype</span>
                      <span className="font-bold text-slate-800 text-xs">
                        {selectedFlat.typology_name ? `📐 ${selectedFlat.typology_name}` : 'No typology prototype assigned'}
                      </span>
                    </div>
                    <button onClick={handleFlatEditStart} className="text-indigo-600 hover:text-indigo-800 font-bold">
                      Edit unit setup
                    </button>
                  </div>
                  {selectedFlat.floor_plan_name && (
                    <div className="bg-slate-50/50 border border-slate-100 px-3.5 py-2 rounded-xl text-[11px] text-slate-600">
                      <span className="text-slate-400 font-semibold mr-1">Floor Plan Drawing:</span>
                      <span className="font-medium text-slate-700">{selectedFlat.floor_plan_name}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Status Section */}
              <div className="space-y-1">
                <span className="text-slate-450 block text-[9px] uppercase font-bold tracking-wider">Operational Status</span>
                <span className={clsx(
                  'inline-block text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm border border-slate-150',
                  STATUS_COLORS[selectedFlat.status]?.bg,
                  STATUS_COLORS[selectedFlat.status]?.text
                )}>
                  {selectedFlat.status}
                </span>
              </div>

              {/* Cost Variation detail if Onboarding completed */}
              {selectedFlat.customer_project_id && (
                <div className="bg-slate-50/50 p-4 border border-slate-200 rounded-2xl space-y-2">
                  <h4 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5"><Activity className="w-4 h-4 text-slate-450" /> Project Financials</h4>
                  <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                    <div>
                      <span className="text-slate-450 block text-[9px]">Customized Cost</span>
                      <span className="font-bold text-slate-800">₹{(selectedFlat.current_cost || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-slate-450 block text-[9px]">Price Variation</span>
                      <span className={clsx("font-bold", selectedFlat.cost_variation >= 0 ? "text-slate-800" : "text-emerald-700")}>
                        {selectedFlat.cost_variation >= 0 ? "+" : ""}
                        ₹{(selectedFlat.cost_variation || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Customer assignment flow */}
              <div className="space-y-4 border-t border-slate-100 pt-4">
                <h4 className="font-extrabold text-slate-850 text-sm">Customer Allocation</h4>
                {selectedFlat.customer_name ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <User className="w-4 h-4 text-slate-400" />
                      <div>
                        <span className="text-[9px] uppercase text-slate-400 block">Assigned Buyer</span>
                        <span className="font-extrabold text-slate-700">{selectedFlat.customer_name}</span>
                      </div>
                    </div>
                    
                    {selectedFlat.customer_phone && (
                      <div className="flex items-center gap-2.5">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <div>
                          <span className="text-[9px] uppercase text-slate-400 block">Phone</span>
                          <span className="font-bold text-slate-700">{selectedFlat.customer_phone}</span>
                        </div>
                      </div>
                    )}

                    {selectedFlat.customer_email && (
                      <div className="flex items-center gap-2.5">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <div>
                          <span className="text-[9px] uppercase text-slate-400 block">Email</span>
                          <span className="font-bold text-slate-700">{selectedFlat.customer_email}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-50 p-4 border border-slate-150 rounded-2xl space-y-3.5">
                    <p className="text-slate-400 text-[11px] leading-relaxed">No customer has been associated with this unit yet. Provide customer name to assign flat.</p>
                    <div className="space-y-2.5">
                      <input
                        type="text"
                        placeholder="Buyer's Full Name *"
                        value={assignName}
                        onChange={e => setAssignName(e.target.value)}
                        className="input w-full px-3 py-2 rounded-lg border border-slate-200 outline-none"
                      />
                      <input
                        type="email"
                        placeholder="Buyer's Email *"
                        value={assignEmail}
                        onChange={e => setAssignEmail(e.target.value)}
                        className="input w-full px-3 py-2 rounded-lg border border-slate-200 outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Buyer's Phone (optional)"
                        value={assignPhone}
                        onChange={e => setAssignPhone(e.target.value)}
                        className="input w-full px-3 py-2 rounded-lg border border-slate-200 outline-none"
                      />
                      <button
                        onClick={handleAssignCustomer}
                        disabled={!assignName.trim() || !assignEmail.trim()}
                        className={clsx(
                          "w-full py-2.5 rounded-xl font-extrabold text-xs transition-all duration-200 shadow-sm flex items-center justify-center gap-1.5",
                          (assignName.trim() && assignEmail.trim())
                            ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 shadow-md cursor-pointer hover:scale-[1.01]"
                            : "bg-slate-200 text-slate-500 border border-slate-300 cursor-not-allowed"
                        )}
                      >
                        <User className="w-3.5 h-3.5" />
                        <span>{(assignName.trim() && assignEmail.trim()) ? "Assign Buyer" : "Fill Name & Email to Assign"}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Invitation Token controls */}
              {selectedFlat.customer_name && (
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <h4 className="font-extrabold text-slate-850 text-sm">Invitation Management</h4>
                  {selectedFlat.status === 'Not Invited' ? (
                    <button
                      onClick={handleGenerateInvite}
                      className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm"
                    >
                      Generate Invitation Link
                    </button>
                  ) : selectedFlat.invitation_token ? (
                    <div className="space-y-2">
                      <span className="text-[9px] uppercase text-slate-450 block font-bold tracking-wider">Invitation Link</span>
                      <div className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <Link2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="text-[10px] text-slate-600 truncate flex-1 font-medium">
                          {window.location.origin}/invite?token={selectedFlat.invitation_token}
                        </span>
                        <button
                          onClick={() => handleCopyLink(selectedFlat.invitation_token)}
                          className="p-1.5 bg-white hover:bg-slate-100 rounded border border-slate-200 text-slate-650"
                          title="Copy invitation link"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        onClick={handleRevokeInvite}
                        className="text-red-500 font-bold hover:underline flex items-center gap-1 mt-1 text-[11px]"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Revoke invitation link
                      </button>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 text-emerald-850 p-3.5 rounded-xl border border-emerald-200 flex gap-2.5 items-center leading-normal">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                      <div>
                        <span className="font-bold">Invitation Accepted</span>
                        <span className="block text-[10px] text-emerald-700 mt-0.5">The buyer has accepted the invitation, linked their account, and initiated space customization.</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

          </div>
        </div>
      )}

      {/* 1. Add New Typology Modal */}
      {showAddTypologyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-650" /> Add New Typology Prototype
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddTypologyModal(false)
                  setNewTypName('')
                  setNewTypSqft('')
                  setNewTypFile(null)
                  setNewTypPreview(null)
                }}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateTypology} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold uppercase tracking-wider text-[10px] mb-1.5">
                  Typology Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Typology D or Penthouse Elite"
                  value={newTypName}
                  onChange={e => setNewTypName(e.target.value)}
                  className="input w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 font-semibold text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase tracking-wider text-[10px] mb-1.5">
                  Carpet Area (Sq.Ft) <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="number"
                  placeholder="e.g. 1350"
                  value={newTypSqft}
                  onChange={e => setNewTypSqft(e.target.value ? Number(e.target.value) : '')}
                  className="input w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 font-semibold text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold uppercase tracking-wider text-[10px] mb-1.5">
                  Blueprint / Floor Plan Drawing
                </label>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={e => {
                      const file = e.target.files?.[0] || null
                      setNewTypFile(file)
                      setNewTypPreview(file ? URL.createObjectURL(file) : null)
                    }}
                    className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer w-full"
                  />
                  {newTypPreview && (
                    <img
                      src={newTypPreview}
                      alt="Preview"
                      className="w-20 h-20 rounded-xl object-cover border border-slate-200"
                    />
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddTypologyModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTypology || !newTypName.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {submittingTypology ? 'Saving...' : 'Create Typology'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. View Assigned Typologies 2-Column Modal */}
      {showViewAssignedModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                  <Eye className="w-4 h-4 text-indigo-650" /> View Assigned Typologies
                </h3>
                <p className="text-[11px] text-slate-500">Inspect prototype specifications and units assigned to each layout.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowViewAssignedModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-100">
              {/* Left Column: Typology Selector & Preview (5 cols) */}
              <div className="md:col-span-5 p-5 overflow-y-auto space-y-4 bg-slate-50/50">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Select Typology Prototype
                </label>
                <div className="space-y-2">
                  {typologies.map((t) => {
                    const count = flats.filter(f => f.typology_id === t.id).length
                    const isSelected = (activeTypologyId || typologies[0]?.id) === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setActiveTypologyId(t.id)}
                        className={clsx(
                          'w-full p-3 rounded-xl border text-left transition flex items-center gap-3',
                          isSelected
                            ? 'bg-white border-indigo-600 shadow-sm ring-1 ring-indigo-600'
                            : 'bg-white/60 border-slate-200 hover:border-slate-300 text-slate-700'
                        )}
                      >
                        {t.floor_plan?.file_url ? (
                          <img
                            src={t.floor_plan.file_url}
                            alt={t.name}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                            <Layout className="w-5 h-5" />
                          </div>
                        )}
                        <div className="overflow-hidden flex-1">
                          <span className="font-extrabold text-slate-800 text-xs block truncate">{t.name}</span>
                          <span className="text-[10px] text-slate-500 block">
                            {t.carpet_area_sqft ? `${t.carpet_area_sqft.toLocaleString()} sq.ft` : 'Area N/A'}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Selected typology spec summary */}
                {(() => {
                  const current = typologies.find(t => t.id === (activeTypologyId || typologies[0]?.id))
                  if (!current) return null
                  const count = flats.filter(f => f.typology_id === current.id).length
                  return (
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 mt-4">
                      {current.floor_plan?.file_url && (
                        <img
                          src={current.floor_plan.file_url}
                          alt={current.name}
                          className="w-full h-32 object-contain bg-slate-50 rounded-xl border border-slate-100 p-1"
                        />
                      )}
                      <div>
                        <span className="font-black text-slate-900 text-sm block">{current.name}</span>
                        <div className="flex justify-between items-center mt-1 text-xs">
                          <span className="text-slate-500">Total Units:</span>
                          <span className="font-bold text-slate-800">{count} flats</span>
                        </div>
                        <div className="flex justify-between items-center mt-1 text-xs">
                          <span className="text-slate-500">Carpet Area:</span>
                          <span className="font-bold text-slate-800">
                            {current.carpet_area_sqft ? `${current.carpet_area_sqft.toLocaleString()} sq.ft` : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Right Column: Assigned Flats List (7 cols) */}
              <div className="md:col-span-7 p-5 overflow-y-auto space-y-3">
                {(() => {
                  const current = typologies.find(t => t.id === (activeTypologyId || typologies[0]?.id))
                  if (!current) return null
                  const assignedFlats = flats.filter(f => f.typology_id === current.id)

                  return (
                    <>
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                          Flats linked to {current.name} ({assignedFlats.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowViewAssignedModal(false)
                            setShowAssignFlatsModal(true)
                          }}
                          className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          Modify Allocations <ArrowLeft className="w-3 h-3 rotate-180" />
                        </button>
                      </div>

                      {assignedFlats.length === 0 ? (
                        <div className="text-center py-16 px-4">
                          <Layout className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                          <p className="text-xs text-slate-500 font-semibold">No flats assigned to {current.name} yet.</p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Click 'Modify Allocations' or 'Assign to Flats' to assign units to this prototype.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
                          {assignedFlats.map(flat => (
                            <div
                              key={flat.id}
                              className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1.5"
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-extrabold text-slate-800 text-xs">Flat {flat.flat_number}</span>
                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                                  {flat.bhk_type}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">
                                {flat.customer_name ? (
                                  <span className="font-semibold text-slate-700">{flat.customer_name}</span>
                                ) : (
                                  <span className="italic text-slate-400">Buyer Unassigned</span>
                                )}
                              </div>
                              <span className={clsx(
                                "inline-block text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
                                STATUS_COLORS[flat.status]?.bg,
                                STATUS_COLORS[flat.status]?.text
                              )}>
                                {flat.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowViewAssignedModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Assign to Flats Multi-Column BHK Modal */}
      {showAssignFlatsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-indigo-650" /> Assign Flats to Typologies
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Pick an active typology below, then click any flat row to link or unassign it.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignFlatsModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            {/* Typology Pill Selector Header */}
            <div className="bg-slate-100/70 px-6 py-3 border-b border-slate-200 flex items-center gap-2 overflow-x-auto scrollbar-hide">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
                Active Typology:
              </span>
              {typologies.map((t) => {
                const isSelected = (activeTypologyId || typologies[0]?.id) === t.id
                const count = flats.filter(f => f.typology_id === t.id).length
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTypologyId(t.id)}
                    className={clsx(
                      "px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-xs",
                      isSelected
                        ? "bg-indigo-600 text-white shadow-indigo-200"
                        : "bg-white text-slate-700 hover:bg-slate-200 border border-slate-200"
                    )}
                  >
                    <span>{t.name}</span>
                    <span className={clsx("px-1.5 py-0.2 rounded-full text-[10px]", isSelected ? "bg-indigo-700 text-white" : "bg-slate-100 text-slate-600")}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Multi-Column BHK Flats Grid */}
            <div className="p-6 overflow-y-auto flex-1">
              {(() => {
                const currentActiveTyp = typologies.find(t => t.id === (activeTypologyId || typologies[0]?.id))
                // Extract unique BHK types present in flats
                const uniqueBhks = Array.from(new Set(flats.map(f => f.bhk_type))).sort()

                if (uniqueBhks.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      No flats generated yet for this project.
                    </div>
                  )
                }

                return (
                  <div className={clsx(
                    "grid gap-6",
                    uniqueBhks.length === 1 ? "grid-cols-1" :
                    uniqueBhks.length === 2 ? "grid-cols-1 sm:grid-cols-2" :
                    "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                  )}>
                    {uniqueBhks.map((bhk) => {
                      const bhkFlats = flats.filter(f => f.bhk_type === bhk)
                      return (
                        <div key={bhk} className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200 space-y-3 flex flex-col">
                          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                            <span className="font-black text-slate-800 text-xs uppercase tracking-wider">
                              {bhk} Flats
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                              {bhkFlats.length} Units
                            </span>
                          </div>

                          <div className="space-y-2 overflow-y-auto max-h-[50vh] pr-1">
                            {bhkFlats.map((flat) => {
                              const isCurrentTyp = currentActiveTyp && flat.typology_id === currentActiveTyp.id
                              const isOtherTyp = flat.typology_id && (!currentActiveTyp || flat.typology_id !== currentActiveTyp.id)

                              return (
                                <div
                                  key={flat.id}
                                  onClick={() => currentActiveTyp && handleToggleAssignFlat(flat.id, currentActiveTyp.id)}
                                  className={clsx(
                                    "p-3 rounded-xl border text-xs cursor-pointer transition-all duration-150 flex items-center justify-between select-none shadow-2xs hover:scale-[1.01]",
                                    isCurrentTyp
                                      ? "border-emerald-500 bg-emerald-50/80 text-emerald-950 font-bold ring-1 ring-emerald-500"
                                      : isOtherTyp
                                      ? "border-slate-200 bg-white text-slate-700 hover:border-indigo-300"
                                      : "border-dashed border-slate-300 bg-white/70 text-slate-500 hover:border-indigo-400"
                                  )}
                                >
                                  <div>
                                    <span className="font-extrabold text-sm block">Flat {flat.flat_number}</span>
                                    {flat.customer_name && (
                                      <span className="text-[10px] text-slate-500 block font-normal truncate max-w-[120px]">
                                        {flat.customer_name}
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-right">
                                    {isCurrentTyp ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white shadow-2xs">
                                        ✓ {currentActiveTyp?.name}
                                      </span>
                                    ) : flat.typology_name ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                        {flat.typology_name}
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-medium text-slate-400 border border-dashed border-slate-200">
                                        Not Assigned
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>

            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-between items-center text-xs">
              <span className="text-slate-500 text-[11px]">
                Clicking an already assigned flat to the active typology will unassign it.
              </span>
              <button
                type="button"
                onClick={() => setShowAssignFlatsModal(false)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

