'use client'

import React, { useEffect, useState } from 'react'
import { useVendorStore } from '@/stores/vendorStore'
import { Toaster, toast } from 'react-hot-toast'
import { 
  Search, CheckCircle2, X, UploadCloud, Eye, Info,
  Truck, DollarSign, Layers, CreditCard, Clipboard, MapPin, Phone, User, Clock, Check
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { vendorAPI } from '@/lib/api'

export default function VendorAssignmentsPage() {
  const { 
    dashboard, assignments, loading, loadAssignments, loadDashboard,
    updateAssignmentStatus, uploadProof 
  } = useVendorStore()

  const [filterStatus, setFilterStatus] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  
  // Selected assignment for detailed modal (Status history, Shipment forms, Milestone checklist)
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null)
  const [activeTab, setActiveTab] = useState<'status' | 'shipment' | 'milestones'>('status')
  
  // Shipment tracking form state
  const [courier, setCourier] = useState('')
  const [vehicleDetails, setVehicleDetails] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [dispatchDate, setDispatchDate] = useState('')
  const [expectedArrival, setExpectedArrival] = useState('')
  const [shipmentStatus, setShipmentStatus] = useState('Pending')

  // Upload proof photo state
  const [proofType, setProofType] = useState('PRODUCTION')
  const [proofCaption, setProofCaption] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [uploadingProofState, setUploadingProofState] = useState(false)
  const [updatingShipmentState, setUpdatingShipmentState] = useState(false)

  useEffect(() => {
    loadAssignments()
    loadDashboard()
  }, [loadAssignments, loadDashboard])

  // Open modal and prefill states
  const openDetailsModal = (item: any) => {
    setSelectedAssignment(item)
    setActiveTab('status')
    
    // Prefill shipment form state
    setCourier(item.courier || '')
    setVehicleDetails(item.vehicleDetails || '')
    setTrackingNumber(item.trackingNumber || '')
    setDispatchDate(item.dispatchDate || '')
    setExpectedArrival(item.expectedArrival || '')
    setShipmentStatus(item.shipmentStatus || 'Pending')
    
    // Prefill photo upload state
    setProofType(item.status === 'ACCEPTED' ? 'PRODUCTION' : item.status)
    setProofCaption('')
    setProofFile(null)
  }

  const handleAccept = async (id: string) => {
    try {
      await updateAssignmentStatus(id, 'ACCEPTED', 'Accepted via elements manager')
      toast.success('Assignment accepted')
      loadAssignments()
      loadDashboard()
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept assignment')
    }
  }

  const handleReject = async (id: string) => {
    try {
      await updateAssignmentStatus(id, 'REJECTED', 'Rejected via elements manager')
      toast.error('Assignment declined')
      loadAssignments()
      loadDashboard()
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject assignment')
    }
  }

  const handleStatusChange = async (assignmentId: string, nextStatus: string) => {
    try {
      // Simulate adding status milestone change log
      const milestoneData = new FormData()
      milestoneData.append('status', nextStatus)
      milestoneData.append('remarks', `Status updated to ${nextStatus}`)
      
      await vendorAPI.addMilestone(assignmentId, milestoneData)
      toast.success(`Status updated to ${nextStatus}`)
      
      // Update selected assignment state if open
      if (selectedAssignment && selectedAssignment.id === assignmentId) {
        const updatedAssigns = await vendorAPI.getAssignments()
        const refreshed = updatedAssigns.data.find((x: any) => x.id === assignmentId)
        if (refreshed) setSelectedAssignment(refreshed)
      }
      
      loadAssignments()
      loadDashboard()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status')
    }
  }

  const handleShipmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAssignment) return
    setUpdatingShipmentState(true)

    try {
      await vendorAPI.updateShipment(selectedAssignment.id, {
        courier,
        vehicle_details: vehicleDetails,
        tracking_number: trackingNumber,
        dispatch_date: dispatchDate,
        expected_arrival: expectedArrival,
        shipment_status: shipmentStatus
      })
      toast.success('Shipment details updated successfully!')
      
      // Refresh assignment in modal
      const updatedAssigns = await vendorAPI.getAssignments()
      const refreshed = updatedAssigns.data.find((x: any) => x.id === selectedAssignment.id)
      if (refreshed) setSelectedAssignment(refreshed)

      loadAssignments()
      loadDashboard()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update shipment')
    } finally {
      setUpdatingShipmentState(false)
    }
  }

  const handleMilestoneToggle = async (mKey: string, nextMilestoneStatus: string) => {
    if (!selectedAssignment) return
    try {
      await vendorAPI.updateMilestone(selectedAssignment.id, mKey, nextMilestoneStatus)
      toast.success(`Milestone payment updated to ${nextMilestoneStatus.toUpperCase()}`)
      
      // Refresh assignment in modal
      const updatedAssigns = await vendorAPI.getAssignments()
      const refreshed = updatedAssigns.data.find((x: any) => x.id === selectedAssignment.id)
      if (refreshed) setSelectedAssignment(refreshed)

      loadAssignments()
      loadDashboard()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update milestone status')
    }
  }

  const handleProofSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAssignment || !proofFile) {
      toast.error('Please select an image file first')
      return
    }
    setUploadingProofState(true)

    try {
      const proofData = new FormData()
      proofData.append('imageType', proofType)
      proofData.append('caption', proofCaption || `${proofType} photo proof`)
      proofData.append('file', proofFile)
      
      await uploadProof(selectedAssignment.id, proofData)
      toast.success('Proof photo uploaded successfully!')
      setProofFile(null)
      setProofCaption('')
      
      // Refresh assignments
      const updatedAssigns = await vendorAPI.getAssignments()
      const refreshed = updatedAssigns.data.find((x: any) => x.id === selectedAssignment.id)
      if (refreshed) setSelectedAssignment(refreshed)

      loadAssignments()
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload photo proof')
    } finally {
      setUploadingProofState(false)
    }
  }

  // Format Currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val)
  }

  // Filter and search
  const filtered = assignments.filter((item) => {
    const matchesStatus = filterStatus === 'ALL' || item.status === filterStatus
    const matchesSearch = 
      item.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesStatus && matchesSearch
  })

  // Group by Project ID
  const projectsMap: { [key: string]: { id: string; projectName: string; customerName: string; customerPhone: string; city: string; pincode: string; expectedDeliveryDate: string; items: any[] } } = {}

  filtered.forEach(item => {
    const pid = item.projectId || 'unknown-project'
    if (!projectsMap[pid]) {
      projectsMap[pid] = {
        id: pid,
        projectName: item.projectName || 'Unknown Project',
        customerName: item.customerName || 'Unknown Customer',
        customerPhone: item.customerPhone || 'N/A',
        city: item.city || 'N/A',
        pincode: item.pincode || 'N/A',
        expectedDeliveryDate: item.expectedDeliveryDate || 'N/A',
        items: []
      }
    }
    projectsMap[pid].items.push(item)
  })

  const groupedProjects = Object.values(projectsMap)

  // Extract KPI counts from store's dashboard
  const kpis = dashboard?.kpi || {
    totalOrderValue: 0,
    paidAmount: 0,
    pendingAmount: 0,
    upcomingMilestone: 'N/A'
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Project Fulfillment Portal</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track product assignments lifecycle status, coordinate shipping transits, and claim payment milestones.
          </p>
        </div>
      </div>

      {/* KPI Cards Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Order Pipeline</span>
            <span className="text-xl font-extrabold text-slate-850 mt-1 block">
              {formatCurrency(kpis.totalOrderValue)}
            </span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Amount Received</span>
            <span className="text-xl font-extrabold text-emerald-600 mt-1 block">
              {formatCurrency(kpis.paidAmount)}
            </span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Outstanding Balance</span>
            <span className="text-xl font-extrabold text-amber-600 mt-1 block">
              {formatCurrency(kpis.pendingAmount)}
            </span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Upcoming Milestone</span>
            <span className="text-sm font-extrabold text-slate-700 mt-2 block truncate max-w-[180px]">
              {kpis.upcomingMilestone}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and search bar controls */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2 w-full md:w-auto flex-wrap">
          {['ALL', 'RECEIVED_ORDER', 'ACCEPTED', 'PRODUCTION', 'READY', 'DISPATCHED', 'DELIVERED', 'COMPLETED', 'REJECTED'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-2 text-xs font-bold rounded-xl transition border uppercase tracking-wider ${
                filterStatus === st
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-550 hover:bg-slate-50 border-slate-200'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by project name, SKU, item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs focus:outline-none focus:bg-white text-slate-800 transition"
          />
        </div>
      </div>

      {/* Main Grouped List View */}
      <div className="space-y-6">
        {groupedProjects.map((project) => (
          <div key={project.id} className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition duration-300">
            {/* Project Card Header */}
            <div className="bg-slate-50/80 border-b border-slate-200/60 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Project File
                  </span>
                  <span className="text-xs font-mono text-slate-450">ID: {project.id}</span>
                </div>
                <h2 className="text-lg font-black text-slate-800 tracking-tight">{project.projectName}</h2>
              </div>
              
              <div className="grid grid-cols-2 lg:flex lg:items-center gap-x-6 gap-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Customer</span>
                    <span className="font-extrabold text-slate-700">{project.customerName}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Phone</span>
                    <span className="font-extrabold text-slate-700">{project.customerPhone}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Site Location</span>
                    <span className="font-extrabold text-slate-700">{project.city} ({project.pincode})</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Target Arrival</span>
                    <span className="font-extrabold text-indigo-650">{project.expectedDeliveryDate}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Product items list */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/40 text-[10px] uppercase font-bold text-slate-450 tracking-wider">
                    <th className="py-3 px-5">Design Element Details</th>
                    <th className="py-3 px-4 text-center">Qty</th>
                    <th className="py-3 px-4">Value</th>
                    <th className="py-3 px-4">Custom Variants</th>
                    <th className="py-3 px-4">Production Lifecycle</th>
                    <th className="py-3 px-4">Transit / Milestone</th>
                    <th className="py-3 px-5 text-right font-bold text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {project.items.map((item) => {
                    const itemValue = item.price * item.quantity;
                    
                    // Render list of custom variants
                    const variantsList = [];
                    if (item.customColor) variantsList.push(`Color: ${item.customColor}`);
                    if (item.customMaterial) variantsList.push(`Material: ${item.customMaterial}`);
                    if (item.customFabric) variantsList.push(`Fabric: ${item.customFabric}`);
                    if (item.customSize) variantsList.push(`Size: ${item.customSize}`);
                    if (item.customWoodFinish) variantsList.push(`Finish: ${item.customWoodFinish}`);
                    if (item.customTexture) variantsList.push(`Texture: ${item.customTexture}`);
                    if (item.customCushionStyle) variantsList.push(`Cushion: ${item.customCushionStyle}`);

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-4 px-5">
                          <div className="font-bold text-slate-800 text-[13px]">{item.itemName}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5 font-mono">
                            <span>Room: {item.roomName}</span>
                            <span>|</span>
                            <span>SKU: {item.sku}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center font-bold text-slate-800">
                          {item.quantity}
                        </td>
                        <td className="py-4 px-4 font-extrabold text-slate-750">
                          {formatCurrency(itemValue)}
                        </td>
                        <td className="py-4 px-4">
                          {variantsList.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {variantsList.map((v, i) => (
                                <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-medium rounded border border-slate-200/50 whitespace-nowrap">
                                  {v}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Standard catalog specs</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          {item.status === 'REJECTED' ? (
                            <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-100 text-[10px] font-black rounded-full uppercase tracking-wider">
                              Declined
                            </span>
                          ) : (
                            <select
                              value={item.status}
                              onChange={(e) => handleStatusChange(item.id, e.target.value)}
                              className="px-2.5 py-1 bg-white border border-slate-200 text-slate-750 text-[11px] font-bold rounded-lg cursor-pointer hover:border-slate-350 focus:outline-none transition"
                            >
                              <option value="RECEIVED_ORDER">RECEIVED ORDER (New)</option>
                              <option value="ACCEPTED">ACCEPTED (Ready to process)</option>
                              <option value="PRODUCTION">PRODUCTION (In progress)</option>
                              <option value="READY">READY (QA complete)</option>
                              <option value="DISPATCHED">DISPATCHED (In transit)</option>
                              <option value="DELIVERED">DELIVERED (At site)</option>
                              <option value="COMPLETED">COMPLETED (Handover done)</option>
                            </select>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex flex-col gap-1">
                            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border inline-block max-w-fit ${
                              item.shipmentStatus === 'Delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              item.shipmentStatus === 'In Transit' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                              item.shipmentStatus === 'Dispatched' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                              'bg-slate-50 text-slate-500 border-slate-100'
                            }`}>
                              🚚 {item.shipmentStatus || 'Pending'}
                            </span>
                            
                            {/* Compute how many milestones are paid */}
                            {(() => {
                              const mst = item.milestonesStatus || {}
                              const totalMilestones = 5
                              const paidCount = Object.values(mst).filter(v => v === 'paid').length
                              return (
                                <span className="text-[10px] text-slate-450 font-bold">
                                  💳 Payout: {paidCount}/{totalMilestones} Milestones
                                </span>
                              )
                            })()}
                          </div>
                        </td>
                        <td className="py-4 px-5 text-right">
                          {item.status === 'REJECTED' || item.status === 'DECLINED' ? (
                            <span className="text-xs font-bold text-red-500 uppercase pr-4">Declined</span>
                          ) : (
                            <button
                              onClick={() => openDetailsModal(item)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg inline-flex items-center gap-1.5 transition"
                            >
                              <Info className="w-3.5 h-3.5 text-slate-400" />
                              <span>Manage details</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {groupedProjects.length === 0 && (
          <div className="bg-white border border-slate-150 rounded-2xl p-16 text-center text-slate-450">
            <Clipboard className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold">No product assignments match the filter criteria.</p>
            <p className="text-xs text-slate-400 mt-1">Try changing the status tabs or search term query.</p>
          </div>
        )}
      </div>

      {/* Sourcing Side Drawer Slide-in Panel */}
      <AnimatePresence>
        {selectedAssignment && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAssignment(null)}
              className="fixed inset-0 bg-slate-900 z-40 cursor-pointer"
            />

            {/* Slider Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white z-50 shadow-2xl p-6 overflow-y-auto flex flex-col justify-between"
            >
              <div className="space-y-6">
                {/* Header */}
                <div className="flex justify-between items-start border-b pb-4">
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-lg">Assignment Sourcing Details</h3>
                    <p className="text-[11px] text-slate-500 mt-1 font-mono">
                      {selectedAssignment.projectName} / {selectedAssignment.itemName}
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedAssignment(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200">
                  <button
                    onClick={() => setActiveTab('status')}
                    className={`flex-1 pb-3 text-xs font-black uppercase tracking-wider text-center border-b-2 transition ${
                      activeTab === 'status' 
                        ? 'border-indigo-600 text-indigo-650' 
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Status & Proofs
                  </button>
                  <button
                    onClick={() => setActiveTab('shipment')}
                    className={`flex-1 pb-3 text-xs font-black uppercase tracking-wider text-center border-b-2 transition ${
                      activeTab === 'shipment' 
                        ? 'border-indigo-600 text-indigo-650' 
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Shipment Tracking
                  </button>
                  <button
                    onClick={() => setActiveTab('milestones')}
                    className={`flex-1 pb-3 text-xs font-black uppercase tracking-wider text-center border-b-2 transition ${
                      activeTab === 'milestones' 
                        ? 'border-indigo-600 text-indigo-650' 
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Milestone Payouts
                  </button>
                </div>

                {/* Tab content */}
                <div className="pt-2">
                  
                  {/* TAB 1: STATUS & PHOTO PROOFS */}
                  {activeTab === 'status' && (
                    <div className="space-y-6">
                      {/* Lifecycle Status selector */}
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                        <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-2">
                          Production / Delivery State
                        </label>
                        <select
                          value={selectedAssignment.status}
                          onChange={(e) => handleStatusChange(selectedAssignment.id, e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-xs focus:outline-none text-slate-800 transition"
                        >
                          <option value="RECEIVED_ORDER">RECEIVED ORDER (New)</option>
                          <option value="ACCEPTED">ACCEPTED (Ready to process)</option>
                          <option value="PRODUCTION">PRODUCTION (Factory manufacturing)</option>
                          <option value="READY">READY (Finished fabrication)</option>
                          <option value="DISPATCHED">DISPATCHED (Handed to courier)</option>
                          <option value="DELIVERED">DELIVERED (Sourced at site)</option>
                          <option value="COMPLETED">COMPLETED (Installation complete)</option>
                        </select>
                      </div>

                      {/* Timeline status logs */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span>Fulfillment Progress Log</span>
                        </h4>
                        <div className="relative border-l-2 border-slate-100 ml-3 pl-5 space-y-4">
                          {selectedAssignment.history && selectedAssignment.history.map((hist: any, index: number) => (
                            <div key={index} className="relative text-xs">
                              {/* Dot */}
                              <div className="absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-indigo-650 flex items-center justify-center">
                                <div className="w-1.5 h-1.5 bg-indigo-650 rounded-full" />
                              </div>
                              <div className="flex justify-between font-bold text-slate-800">
                                <span>{hist.status}</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {new Date(hist.timestamp).toLocaleDateString()} {new Date(hist.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-1">{hist.remarks}</p>
                            </div>
                          ))}
                          {(!selectedAssignment.history || selectedAssignment.history.length === 0) && (
                            <div className="text-xs text-slate-450 italic">No progress events logged yet.</div>
                          )}
                        </div>
                      </div>

                      {/* Image proofs uploader */}
                      <div className="border-t border-slate-100 pt-5 space-y-4">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Upload Dispatch or Delivery Photo Proof
                        </h4>
                        <form onSubmit={handleProofSubmit} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Photo Tag</label>
                              <select
                                value={proofType}
                                onChange={(e) => setProofType(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none text-slate-800"
                              >
                                <option value="PRODUCTION">Factory Production</option>
                                <option value="PACKAGING">Item Packaging</option>
                                <option value="DISPATCH">Transit Dispatch</option>
                                <option value="DELIVERY">Site Delivery</option>
                                <option value="INSTALLATION">Fitment Proof</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Caption</label>
                              <input
                                type="text"
                                placeholder="Short description"
                                value={proofCaption}
                                onChange={(e) => setProofCaption(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none text-slate-800"
                              />
                            </div>
                          </div>

                          <div className="border-2 border-dashed border-slate-200 p-5 rounded-xl bg-slate-50 text-center">
                            {proofFile ? (
                              <div className="text-xs text-slate-700 space-y-2">
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
                                <span className="font-bold block truncate max-w-[250px] mx-auto">{proofFile.name}</span>
                                <button
                                  type="button"
                                  onClick={() => setProofFile(null)}
                                  className="text-[10px] text-red-500 font-bold hover:underline"
                                >
                                  Clear Image
                                </button>
                              </div>
                            ) : (
                              <>
                                <input
                                  type="file"
                                  accept="image/*"
                                  id="drawer-proof-upload"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) setProofFile(file)
                                  }}
                                />
                                <label
                                  htmlFor="drawer-proof-upload"
                                  className="cursor-pointer inline-flex flex-col items-center space-y-1 text-slate-450 hover:text-indigo-600 transition"
                                >
                                  <UploadCloud className="w-6 h-6 text-slate-350" />
                                  <span className="text-xs font-bold">Choose a verification photo</span>
                                </label>
                              </>
                            )}
                          </div>

                          <button
                            type="submit"
                            disabled={uploadingProofState || !proofFile}
                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                          >
                            {uploadingProofState ? 'Uploading file...' : 'Submit Photo Proof'}
                          </button>
                        </form>

                        {/* List of proofs */}
                        {selectedAssignment.proofImages && selectedAssignment.proofImages.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Uploaded Proof Images:</span>
                            <div className="grid grid-cols-3 gap-2">
                              {selectedAssignment.proofImages.map((proof: any) => {
                                const fullUrl = proof.imageUrl.startsWith('/') 
                                  ? `http://localhost:8000${proof.imageUrl}` 
                                  : proof.imageUrl;
                                return (
                                  <div key={proof.id} className="relative group border border-slate-100 rounded-lg overflow-hidden">
                                    <img
                                      src={fullUrl}
                                      alt={proof.caption || "Proof"}
                                      className="w-full h-20 object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center p-1 transition text-center text-white">
                                      <span className="text-[8px] truncate max-w-full font-bold uppercase">{proof.imageType}</span>
                                      <a
                                        href={fullUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mt-1 p-0.5 bg-indigo-600 hover:bg-indigo-700 rounded text-xs transition"
                                      >
                                        View
                                      </a>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 2: SHIPMENT TRACKING */}
                  {activeTab === 'shipment' && (
                    <form onSubmit={handleShipmentSubmit} className="space-y-4">
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3">
                        <h4 className="text-xs font-black uppercase text-indigo-650 tracking-wider">
                          Transit Status: {shipmentStatus}
                        </h4>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-slate-400 block">Shipment ID:</span>
                            <span className="font-mono font-bold text-slate-700">{selectedAssignment.shipmentId || 'Not created'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Courier Partner</label>
                          <input
                            type="text"
                            placeholder="e.g. BlueDart, DHL, Professional Express"
                            value={courier}
                            onChange={(e) => setCourier(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white text-slate-800 transition"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Vehicle Details / Reg No.</label>
                            <input
                              type="text"
                              placeholder="e.g. MH-12-PQ-9876"
                              value={vehicleDetails}
                              onChange={(e) => setVehicleDetails(e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white text-slate-800 transition"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">AWB / Tracking Number</label>
                            <input
                              type="text"
                              placeholder="Tracking reference number"
                              value={trackingNumber}
                              onChange={(e) => setTrackingNumber(e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white text-slate-800 transition"
                              required
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Dispatch Date</label>
                            <input
                              type="date"
                              value={dispatchDate}
                              onChange={(e) => setDispatchDate(e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white text-slate-800 transition"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Expected Arrival Date</label>
                            <input
                              type="date"
                              value={expectedArrival}
                              onChange={(e) => setExpectedArrival(e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white text-slate-800 transition"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Shipment status</label>
                          <select
                            value={shipmentStatus}
                            onChange={(e) => setShipmentStatus(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white text-slate-800 transition"
                          >
                            <option value="Pending">Pending (Not Dispatched)</option>
                            <option value="Dispatched">Dispatched (Left Warehouse)</option>
                            <option value="In Transit">In Transit (On the Road)</option>
                            <option value="Delivered">Delivered (Received at Site)</option>
                          </select>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={updatingShipmentState}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                      >
                        {updatingShipmentState ? 'Saving details...' : 'Save Shipment & Track Transit'}
                      </button>
                    </form>
                  )}

                  {/* TAB 3: MILESTONE PAYMENT CHECKLIST */}
                  {activeTab === 'milestones' && (
                    <div className="space-y-4">
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-1">
                          Payment Policy Splits
                        </span>
                        <p className="text-xs text-slate-500">
                          Milestones splits payment is released at 20% installments for each verified stage completed.
                        </p>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {[
                          { key: 'po_approved', label: 'Purchase Order Approved (20%)', desc: 'Released when PO is initialised and accepted.' },
                          { key: 'design_approved', label: 'Design Approved (20%)', desc: 'Released when room layouts and renders are signed off.' },
                          { key: 'manufacturing_started', label: 'Manufacturing Started (20%)', desc: 'Released when sourcing production begins at plant.' },
                          { key: 'material_delivered', label: 'Material Delivered (20%)', desc: 'Released when product elements reach customer premises.' },
                          { key: 'installation_complete', label: 'Installation Completed (20%)', desc: 'Released when site installation fitment is approved.' }
                        ].map((m) => {
                          const currentVal = (selectedAssignment.milestonesStatus || {})[m.key] || 'pending'
                          
                          return (
                            <div key={m.key} className="py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                              <div className="space-y-0.5">
                                <div className="text-xs font-extrabold text-slate-800">{m.label}</div>
                                <div className="text-[10px] text-slate-400">{m.desc}</div>
                              </div>
                              
                              <div className="flex gap-1">
                                {['pending', 'approved', 'paid'].map((v) => (
                                  <button
                                    key={v}
                                    type="button"
                                    onClick={() => handleMilestoneToggle(m.key, v)}
                                    className={`px-2 py-1 text-[9px] font-black rounded uppercase transition ${
                                      currentVal === v
                                        ? v === 'paid' ? 'bg-emerald-500 text-white shadow-xs' :
                                          v === 'approved' ? 'bg-blue-500 text-white shadow-xs' :
                                          'bg-slate-400 text-white shadow-xs'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}
                                  >
                                    {v}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-100 pt-4 flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setSelectedAssignment(null)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
