'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { enterpriseAPI } from '@/lib/api'
import Navbar from '@/components/Navbar'
import toast from 'react-hot-toast'
import { ArrowLeft, User, Mail, Phone, Link2, Copy, Trash2, Calendar, MapPin, Building, Activity, Layout, Eye, CheckCircle2 } from 'lucide-react'
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
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('All')

  // Modal states
  const [selectedFlat, setSelectedFlat] = useState<any>(null)
  const [assignName, setAssignName] = useState('')
  const [assignPhone, setAssignPhone] = useState('')
  const [assignEmail, setAssignEmail] = useState('')
  
  // Inline edit state inside Modal
  const [editFlatNumber, setEditFlatNumber] = useState('')
  const [editBhkType, setEditBhkType] = useState('')
  const [editFloorPlanId, setEditFloorPlanId] = useState('')
  const [isEditingFlat, setIsEditingFlat] = useState(false)
  const [submittingFlatEdit, setSubmittingFlatEdit] = useState(false)

  const fetchData = async () => {
    try {
      const [projRes, flatsRes, fpRes] = await Promise.all([
        enterpriseAPI.getProject(projectId),
        enterpriseAPI.listFlats(projectId),
        enterpriseAPI.listFloorPlans(projectId)
      ])
      setProject(projRes.data)
      setFlats(flatsRes.data.flats || [])
      setFloorPlans(fpRes.data || [])
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

  const handleAssignCustomer = async () => {
    if (!selectedFlat || !assignName.trim()) {
      toast.error("Please enter a customer name.")
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
    setIsEditingFlat(true)
  }

  const handleSaveFlatConfig = async () => {
    if (!selectedFlat) return
    setSubmittingFlatEdit(true)
    try {
      await enterpriseAPI.updateFlat(selectedFlat.id, {
        flat_number: editFlatNumber,
        bhk_type: editBhkType,
        floor_plan_id: editFloorPlanId || ""
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
                          {flat.floor_plan_name && (
                            <span className="block text-[8px] text-indigo-700 font-medium truncate mb-1" title={flat.floor_plan_name}>
                              Plan: {flat.floor_plan_name}
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                <div className="flex justify-between items-center bg-slate-50 border border-slate-100 p-3.5 rounded-xl">
                  <div>
                    <span className="text-slate-450 block text-[9px] uppercase font-bold tracking-wider">Unit Drawing</span>
                    <span className="font-bold text-slate-800 text-xs">
                      {selectedFlat.floor_plan_name || 'No floor plan layout drawing assigned'}
                    </span>
                  </div>
                  <button onClick={handleFlatEditStart} className="text-indigo-600 hover:text-indigo-800 font-bold">
                    Edit unit setup
                  </button>
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
                        placeholder="Buyer's Full Name"
                        value={assignName}
                        onChange={e => setAssignName(e.target.value)}
                        className="input w-full px-3 py-2 rounded-lg border border-slate-200 outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Buyer's Phone (e.g. +919900004444)"
                        value={assignPhone}
                        onChange={e => setAssignPhone(e.target.value)}
                        className="input w-full px-3 py-2 rounded-lg border border-slate-200 outline-none"
                      />
                      <input
                        type="email"
                        placeholder="Buyer's Email (optional)"
                        value={assignEmail}
                        onChange={e => setAssignEmail(e.target.value)}
                        className="input w-full px-3 py-2 rounded-lg border border-slate-200 outline-none"
                      />
                      <button
                        onClick={handleAssignCustomer}
                        className="w-full py-2 bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-lg transition text-xs shadow-sm"
                      >
                        Assign Buyer
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

    </div>
  )
}
