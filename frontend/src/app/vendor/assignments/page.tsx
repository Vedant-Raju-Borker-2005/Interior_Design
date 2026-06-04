'use client'

import React, { useEffect, useState } from 'react'
import { useVendorStore } from '@/stores/vendorStore'
import { Toaster, toast } from 'react-hot-toast'
import { 
  Briefcase, Calendar, CheckCircle2, ChevronRight, Eye, 
  FileText, Image, Search, ShieldAlert, UploadCloud, X, ArrowLeft, Activity, Info
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function VendorAssignmentsPage() {
  const { 
    profile, assignments, loading, loadAssignments, 
    updateAssignmentStatus, addMilestone, uploadProof 
  } = useVendorStore()

  const [filterStatus, setFilterStatus] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  
  // Selected assignment for updating progress / details
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null)
  const [showDrawer, setShowDrawer] = useState(false)
  const [milestoneStatus, setMilestoneStatus] = useState('PRODUCTION')
  const [remarks, setRemarks] = useState('')
  const [proofType, setProofType] = useState('PRODUCTION')
  const [proofCaption, setProofCaption] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    loadAssignments()
  }, [loadAssignments])

  const handleOpenUpdate = (item: any) => {
    setSelectedAssignment(item)
    // Find last status in history to set next default milestone status
    const lastStatus = item.status === 'ACCEPTED' ? 'PRODUCTION' : item.status
    setMilestoneStatus(lastStatus)
    setRemarks('')
    setProofType(lastStatus)
    setProofCaption('')
    setProofFile(null)
    setShowDrawer(true)
  }

  const handleAccept = async (id: string) => {
    try {
      await updateAssignmentStatus(id, 'ACCEPTED', 'Accepted via elements manager')
      toast.success('Assignment accepted')
      loadAssignments()
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept assignment')
    }
  }

  const handleReject = async (id: string) => {
    try {
      await updateAssignmentStatus(id, 'REJECTED', 'Rejected via elements manager')
      toast.error('Assignment rejected')
      loadAssignments()
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject assignment')
    }
  }

  const handleProgressSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAssignment) return

    setUpdating(true)
    try {
      // 1. Add Milestone Status update
      const milestoneData = new FormData()
      milestoneData.append('status', milestoneStatus)
      milestoneData.append('remarks', remarks || `Sourcing milestone updated to ${milestoneStatus}`)
      await addMilestone(selectedAssignment.id, milestoneData)

      // 2. Upload Proof file if selected
      if (proofFile) {
        const proofData = new FormData()
        proofData.append('imageType', proofType)
        proofData.append('caption', proofCaption || `${proofType} photo proof`)
        proofData.append('file', proofFile)
        await uploadProof(selectedAssignment.id, proofData)
        toast.success('Milestone updated and photo proof uploaded!')
      } else {
        toast.success('Milestone updated successfully')
      }

      setShowDrawer(false)
      loadAssignments()
    } catch (err: any) {
      toast.error(err.message || 'Failed to record progress')
    } finally {
      setUpdating(false)
    }
  }

  // Filter logic
  const filtered = assignments.filter((item) => {
    const matchesStatus = filterStatus === 'ALL' || item.status === filterStatus
    const matchesSearch = 
      item.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesStatus && matchesSearch
  })

  return (
    <div className="space-y-6 select-none">
      <Toaster position="top-right" />

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Assigned Design Elements</h1>
        <p className="text-xs text-slate-400 mt-1">Manage project items, log progress status milestones, and upload delivery photo proofs.</p>
      </div>

      {/* Filter and search bar controls */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2 w-full md:w-auto">
          {['ALL', 'ASSIGNED', 'ACCEPTED', 'REJECTED'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition border ${
                filterStatus === st
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-650 hover:bg-slate-50 border-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by project name, item, SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs focus:outline-none focus:bg-white text-slate-850 transition"
          />
        </div>
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map((item) => (
          <div 
            key={item.id}
            className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between hover:shadow-md transition"
          >
            {/* Color banner */}
            <div className={`h-1 ${
              item.status === 'ACCEPTED' ? 'bg-emerald-500' :
              item.status === 'REJECTED' ? 'bg-red-500' : 'bg-amber-500'
            }`} />

            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base leading-snug">{item.projectName}</h3>
                  <span className="text-[10px] text-indigo-600 font-bold block mt-0.5 uppercase tracking-wide">
                    Room: {item.roomName}
                  </span>
                </div>
                <span className={`px-2.5 py-0.5 text-[9px] font-extrabold rounded-full uppercase border ${
                  item.status === 'ACCEPTED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                  item.status === 'REJECTED' ? 'bg-red-50 text-red-750 border-red-100' :
                  'bg-amber-50 text-amber-700 border-amber-100'
                }`}>
                  {item.status}
                </span>
              </div>

              {/* Item Details block */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between font-semibold">
                  <span className="text-slate-450">Element Name</span>
                  <span className="text-slate-700">{item.itemName}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-slate-450">Item SKU</span>
                  <span className="font-mono text-slate-600">{item.sku}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-slate-450">Assigned Quantity</span>
                  <span className="text-slate-800 font-extrabold">{item.quantity} units</span>
                </div>
                {item.remarks && (
                  <div className="border-t border-slate-200/60 pt-2 text-[10px] text-slate-450 italic">
                    Remarks: {item.remarks}
                  </div>
                )}
              </div>

              {/* Milestone progress visual preview */}
              {item.status === 'ACCEPTED' && item.history.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Latest Milestones</span>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-700 bg-indigo-50/50 border border-indigo-100/50 rounded-lg p-2">
                    <Activity className="w-3.5 h-3.5" />
                    <span>Current: {item.history[item.history.length - 1].status}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500 font-medium font-mono text-[9px]">
                      {new Date(item.history[item.history.length - 1].timestamp).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions footer bar */}
            <div className="border-t border-slate-100 p-4 bg-slate-50/40 flex justify-between gap-3">
              {item.status === 'ASSIGNED' ? (
                <>
                  <button
                    onClick={() => handleReject(item.id)}
                    className="flex-1 py-2 border border-slate-200 hover:border-slate-300 text-slate-650 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 transition shadow-sm"
                  >
                    Decline Request
                  </button>
                  <button
                    onClick={() => handleAccept(item.id)}
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-150"
                  >
                    Accept Allocation
                  </button>
                </>
              ) : item.status === 'ACCEPTED' ? (
                <>
                  <button
                    onClick={() => handleOpenUpdate(item)}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-150"
                  >
                    Update Milestones & Proof Photo
                  </button>
                </>
              ) : (
                <button
                  disabled
                  className="w-full py-2 bg-slate-100 text-slate-400 rounded-xl text-xs font-bold border border-slate-200/50 cursor-not-allowed"
                >
                  Assignment Processed
                </button>
              )}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-2 bg-white border border-slate-100 rounded-2xl p-12 text-center text-slate-400 text-xs">
            No element assignments matched the filter selections.
          </div>
        )}
      </div>

      {/* Sourcing Side Drawer Slide-in Panel */}
      <AnimatePresence>
        {showDrawer && selectedAssignment && (
          <>
            {/* Backdrop cover */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDrawer(false)}
              className="fixed inset-0 bg-slate-900 z-40 cursor-pointer"
            />

            {/* Slider container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl p-6 overflow-y-auto flex flex-col justify-between"
            >
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b pb-4">
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-base">Update Element Milestones</h3>
                    <p className="text-[10px] text-slate-450">{selectedAssignment.projectName} / {selectedAssignment.itemName}</p>
                  </div>
                  <button 
                    onClick={() => setShowDrawer(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleProgressSubmit} className="space-y-5">
                  {/* Select next milestones progress */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Milestone Status</label>
                    <select
                      value={milestoneStatus}
                      onChange={(e) => setMilestoneStatus(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs focus:outline-none focus:bg-white text-slate-800 transition"
                    >
                      <option value="PRODUCTION">PRODUCTION (Fabricating in factory)</option>
                      <option value="READY">READY (Finished fabrication checks)</option>
                      <option value="DISPATCHED">DISPATCHED (Loaded for transit)</option>
                      <option value="DELIVERED">DELIVERED (Sourced at site)</option>
                      <option value="INSTALLED">INSTALLED (Final elements fitment completed)</option>
                    </select>
                  </div>

                  {/* Comments */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Milestone Notes / Remarks</label>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      rows={3}
                      placeholder="e.g. Cutboard assembly completed, dispatching on vehicle number KA-01-A-1234"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs focus:outline-none focus:bg-white text-slate-800 transition resize-none text-xs"
                    />
                  </div>

                  {/* Verification image upload */}
                  <div className="border-t border-slate-100 pt-5 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Upload Verification Photo</h4>
                      <span className="text-[9px] text-slate-400 font-semibold">(Optional)</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Photo Type</label>
                        <select
                          value={proofType}
                          onChange={(e) => setProofType(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] focus:outline-none focus:bg-white text-slate-800 transition"
                        >
                          <option value="PRODUCTION">Factory Production Check</option>
                          <option value="PACKAGING">Item Packaging Copy</option>
                          <option value="DISPATCH">Transit Dispatch Photo</option>
                          <option value="DELIVERY">Site Delivery Verification</option>
                          <option value="INSTALLATION">Site Installation Proof</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Short Description</label>
                        <input
                          type="text"
                          placeholder="e.g. packaging box scan"
                          value={proofCaption}
                          onChange={(e) => setProofCaption(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] focus:outline-none focus:bg-white text-slate-850 transition"
                        />
                      </div>
                    </div>

                    <div className="border-2 border-dashed border-slate-200 p-6 rounded-xl bg-slate-50/50 text-center">
                      {proofFile ? (
                        <div className="text-xs text-slate-700 space-y-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
                          <span className="font-bold block truncate">{proofFile.name}</span>
                          <button
                            type="button"
                            onClick={() => setProofFile(null)}
                            className="text-[10px] text-red-500 font-bold hover:underline"
                          >
                            Remove File
                          </button>
                        </div>
                      ) : (
                        <>
                          <input
                            type="file"
                            accept="image/*"
                            id="proof-upload"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) setProofFile(file)
                            }}
                          />
                          <label
                            htmlFor="proof-upload"
                            className="cursor-pointer inline-flex flex-col items-center space-y-1 text-slate-450 hover:text-indigo-600 transition"
                          >
                            <UploadCloud className="w-6 h-6 text-slate-350" />
                            <span className="text-[11px] font-bold">Select Proof Photo</span>
                          </label>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-6 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowDrawer(false)}
                      className="flex-1 py-2.5 border border-slate-200 text-slate-650 hover:bg-slate-50 text-xs font-bold rounded-xl transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={updating}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-150 disabled:opacity-50"
                    >
                      {updating ? 'Recording...' : 'Update Milestone'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Status History Logs Timeline */}
              {selectedAssignment.history.length > 0 && (
                <div className="border-t border-slate-150 pt-5 mt-6 space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Milestone History Logs</h4>
                  <div className="relative border-l border-slate-150 ml-2.5 pl-4 space-y-4">
                    {selectedAssignment.history.map((hist: any, index: number) => (
                      <div key={index} className="relative text-xs">
                        <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-indigo-600" />
                        <div className="flex justify-between font-bold text-slate-700">
                          <span>{hist.status}</span>
                          <span className="text-[9px] text-slate-400 font-mono">
                            {new Date(hist.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-450 mt-0.5">{hist.remarks}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
