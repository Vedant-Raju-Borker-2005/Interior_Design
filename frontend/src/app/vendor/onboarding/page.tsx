'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useVendorStore } from '@/stores/vendorStore'
import { Toaster, toast } from 'react-hot-toast'
import { 
  Building2, User, Mail, Phone, FileSpreadsheet, MapPin, 
  UploadCloud, CheckCircle2, AlertCircle, FileText, ArrowRight, ArrowLeft 
} from 'lucide-react'

export default function VendorOnboardingPage() {
  const router = useRouter()
  const { profile, documents, loading, error, loadOnboarding, registerVendor, uploadDocuments } = useVendorStore()
  
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    businessName: '',
    ownerName: '',
    email: '',
    phone: '',
    gstNumber: '',
    panNumber: '',
    warehouseAddress: '',
    serviceLocations: '',
  })

  // Document upload files
  const [gstFile, setGstFile] = useState<File | null>(null)
  const [panFile, setPanFile] = useState<File | null>(null)
  const [bankFile, setBankFile] = useState<File | null>(null)
  const [uploadingDocs, setUploadingDocs] = useState(false)

  useEffect(() => {
    loadOnboarding()
  }, [loadOnboarding])

  // If already onboarded and approved, redirect to dashboard or show completion
  useEffect(() => {
    if (profile) {
      setForm({
        businessName: profile.businessName || '',
        ownerName: profile.ownerName || '',
        email: profile.email || '',
        phone: profile.phone || '',
        gstNumber: profile.gstNumber || '',
        panNumber: profile.panNumber || '',
        warehouseAddress: profile.warehouseAddress || '',
        serviceLocations: Array.isArray(profile.serviceLocations) ? profile.serviceLocations.join(', ') : '',
      })
      
      // If approved, don't force step 1
      if (profile.status === 'APPROVED') {
        // Just let them view their profile details
      }
    }
  }, [profile])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault()
    if (step === 1) {
      if (!form.businessName || !form.ownerName || !form.email) {
        toast.error('Please fill out all required fields marked with *')
        return
      }
      setStep(2)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        businessName: form.businessName,
        ownerName: form.ownerName,
        email: form.email,
        phone: form.phone || undefined,
        gstNumber: form.gstNumber || undefined,
        panNumber: form.panNumber || undefined,
        warehouseAddress: form.warehouseAddress || undefined,
        serviceLocations: form.serviceLocations.split(',').map(s => s.trim()).filter(Boolean),
      }
      await registerVendor(payload)
      toast.success('Business profile registered successfully!')
      setStep(3)
    } catch (err: any) {
      toast.error(err.message || 'Failed to save business details')
    }
  }

  const handleUploadKYC = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.id) {
      toast.error('Vendor ID missing. Try registering profile first.')
      return
    }
    if (!gstFile || !panFile || !bankFile) {
      toast.error('Please upload all three mandatory KYC documents.')
      return
    }

    setUploadingDocs(true)
    try {
      const formData = new FormData()
      formData.append('vendorId', profile.id)
      formData.append('gstCertificate', gstFile)
      formData.append('panCard', panFile)
      formData.append('bankDetails', bankFile)

      await uploadDocuments(formData)
      toast.success('KYC documents uploaded successfully! Profile auto-approved.')
      router.push('/vendor/dashboard')
    } catch (err: any) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploadingDocs(false)
    }
  }

  // Approved view
  if (profile?.status === 'APPROVED') {
    return (
      <div className="max-w-4xl mx-auto space-y-6 select-none">
        <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-6 flex items-start gap-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 mt-0.5 flex-shrink-0" />
          <div>
            <h2 className="font-extrabold text-emerald-800 text-sm">Active Partner Status</h2>
            <p className="text-xs text-emerald-700/80 mt-1">
              Your design partner profile is active and verified. You will receive notifications and new element allocations automatically.
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl shadow-card p-8 space-y-6">
          <div>
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Business Profile Details</h1>
            <p className="text-xs text-slate-400 mt-0.5">Your official verified partner details in our system catalog.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { label: 'Business Name', value: profile.businessName, icon: Building2 },
              { label: 'Owner Name', value: profile.ownerName, icon: User },
              { label: 'Email Address', value: profile.email, icon: Mail },
              { label: 'Phone Number', value: profile.phone || 'N/A', icon: Phone },
              { label: 'GST Number', value: profile.gstNumber || 'N/A', icon: FileSpreadsheet },
              { label: 'PAN Number', value: profile.panNumber || 'N/A', icon: FileText },
              { label: 'Warehouse Address', value: profile.warehouseAddress || 'N/A', icon: MapPin },
              { label: 'Serviceable Pincodes', value: Array.isArray(profile.serviceLocations) ? profile.serviceLocations.join(', ') : 'All Locations', icon: MapPin },
            ].map((field, idx) => {
              const Icon = field.icon
              return (
                <div key={idx} className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-start gap-3">
                  <Icon className="w-4 h-4 text-indigo-500 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-450 tracking-wider block">{field.label}</span>
                    <span className="text-xs font-extrabold text-slate-700 block mt-0.5">{field.value}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">KYC Documents</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { name: 'GST Certificate', url: documents?.gstCertificate },
                { name: 'PAN Card Copy', url: documents?.panCard },
                { name: 'Bank Details / Cheque', url: documents?.bankDetails },
              ].map((doc, idx) => (
                <div key={idx} className="border border-slate-150 rounded-xl p-3 flex items-center justify-between bg-white text-xs">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span className="font-semibold text-slate-650">{doc.name}</span>
                  </div>
                  {doc.url ? (
                    <a
                      href={doc.url.startsWith('/') ? `http://localhost:8000${doc.url}` : doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                    >
                      View
                    </a>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Not Uploaded</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Under review view
  if (profile?.status === 'UNDER_REVIEW') {
    return (
      <div className="max-w-xl mx-auto text-center select-none py-12 space-y-6">
        <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto border border-amber-200">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Application Under Review</h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            We are reviewing your KYC documents and business registration details. You will get access to full dashboard controls once approved.
          </p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-6 text-left max-w-sm mx-auto text-xs space-y-3">
          <div className="flex justify-between font-semibold border-b pb-2">
            <span className="text-slate-500">Business Name</span>
            <span className="text-slate-800">{profile.businessName}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span className="text-slate-500">Status</span>
            <span className="badge bg-amber-100 text-amber-700">UNDER REVIEW</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 select-none py-6">
      {/* Page Header */}
      <div className="text-center max-w-xl mx-auto">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Become a Design Partner</h1>
        <p className="text-xs text-slate-400 mt-1.5">
          Submit your official business credentials to get matched with room design layout allocations, track inventory, and get paid automatically.
        </p>
      </div>

      {/* Stepper Wizard Progress */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
        <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
          <span>Step {step} of 3</span>
          <span>{step === 1 ? 'Business Registry' : step === 2 ? 'Service Locations' : 'KYC Document Files'}</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-indigo-600 rounded-full transition-all duration-300" 
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Forms */}
      <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-card">
        {step === 1 && (
          <form onSubmit={handleNext} className="space-y-6">
            <div>
              <h2 className="text-sm font-black uppercase text-indigo-600 tracking-wider mb-4">Business Contact</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Business Name *</label>
                  <input
                    name="businessName"
                    value={form.businessName}
                    onChange={handleChange}
                    required
                    placeholder="e.g. Oakwood Carpentry Labs"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs focus:outline-none focus:bg-white text-slate-800 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Owner Name *</label>
                  <input
                    name="ownerName"
                    value={form.ownerName}
                    onChange={handleChange}
                    required
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs focus:outline-none focus:bg-white text-slate-800 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Email Address *</label>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                    placeholder="e.g. contact@oakwoodlabs.in"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs focus:outline-none focus:bg-white text-slate-800 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Phone Number</label>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs focus:outline-none focus:bg-white text-slate-800 transition"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-6">
              <h2 className="text-sm font-black uppercase text-indigo-600 tracking-wider mb-4">Taxation Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">GSTIN Number</label>
                  <input
                    name="gstNumber"
                    value={form.gstNumber}
                    onChange={handleChange}
                    placeholder="e.g. 29AAAAA1111A1Z1"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs focus:outline-none focus:bg-white text-slate-800 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Permanent Account Number (PAN)</label>
                  <input
                    name="panNumber"
                    value={form.panNumber}
                    onChange={handleChange}
                    placeholder="e.g. ABCDE1234F"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs focus:outline-none focus:bg-white text-slate-800 transition"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                className="flex items-center gap-1.5 py-2.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-md shadow-indigo-150"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleRegister} className="space-y-6">
            <div>
              <h2 className="text-sm font-black uppercase text-indigo-600 tracking-wider mb-4">Warehouse & Service Distribution</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Serviceable Pincodes (Comma-separated List)</label>
                  <input
                    name="serviceLocations"
                    value={form.serviceLocations}
                    onChange={handleChange}
                    placeholder="e.g. 560001, 560034, 560047"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs focus:outline-none focus:bg-white text-slate-800 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Warehouse Physical Address</label>
                  <textarea
                    name="warehouseAddress"
                    value={form.warehouseAddress}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Plot 12, Phase 2, Industrial Layout Area, Bangalore"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs focus:outline-none focus:bg-white text-slate-800 transition resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 py-2.5 px-6 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-1.5 py-2.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition disabled:opacity-50 shadow-md shadow-indigo-150"
              >
                {loading ? (
                  <span>Registering...</span>
                ) : (
                  <>
                    <span>Register Business</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleUploadKYC} className="space-y-6">
            <div>
              <h2 className="text-sm font-black uppercase text-indigo-600 tracking-wider mb-4">Mandatory Verification Files</h2>
              <p className="text-xs text-slate-400 mb-6">
                Please upload PDF or Image scans of files. In the developer sandbox, providing all three uploads triggers auto-approval.
              </p>

              <div className="space-y-4">
                {[
                  { label: 'GST Certificate *', file: gstFile, setFile: setGstFile, name: 'gst' },
                  { label: 'PAN Card Copy *', file: panFile, setFile: setPanFile, name: 'pan' },
                  { label: 'Bank Details (Cheque / Passbook) *', file: bankFile, setFile: setBankFile, name: 'bank' }
                ].map((item, idx) => (
                  <div key={idx} className="border border-slate-150 rounded-xl p-4 flex items-center justify-between bg-slate-50/50">
                    <div className="flex-1">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{item.label}</span>
                      <span className="text-xs text-slate-650 font-medium">
                        {item.file ? item.file.name : 'No file selected'}
                      </span>
                    </div>
                    <div>
                      <input
                        type="file"
                        id={`file-${item.name}`}
                        accept=".pdf,image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) item.setFile(file)
                        }}
                      />
                      <label
                        htmlFor={`file-${item.name}`}
                        className="flex items-center gap-1 py-1.5 px-3 bg-white border border-slate-250 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 cursor-pointer shadow-sm transition"
                      >
                        <UploadCloud className="w-3.5 h-3.5 text-slate-400" />
                        <span>Upload File</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-6 border-t border-slate-100">
              <span className="text-[10px] text-slate-400 font-medium leading-9">
                Fields marked with * are mandatory
              </span>

              <button
                type="submit"
                disabled={uploadingDocs}
                className="flex items-center gap-1.5 py-2.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition disabled:opacity-50 shadow-md shadow-indigo-150"
              >
                {uploadingDocs ? (
                  <span>Uploading Documents...</span>
                ) : (
                  <>
                    <span>Complete & Activate</span>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
