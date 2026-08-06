'use client'

import { useEffect, useState } from 'react'
import { useCustomerStore } from '@/stores/customerStore'
import Navbar from '@/components/Navbar'
import { Sparkles, ArrowRight, Layout, PencilRuler, HelpCircle, HardDrive, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function ServicesPage() {
  const { services, fetchServices, createServiceRequest } = useCustomerStore()
  
  // Form fields
  const [serviceType, setServiceType] = useState('3D Rendering')
  const [requirements, setRequirements] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchServices()
  }, [fetchServices])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!requirements.trim()) {
      toast.error('Please enter requirements')
      return
    }
    setIsSubmitting(true)
    try {
      await createServiceRequest(serviceType, requirements)
      toast.success('Service requested and payment processed! Check your Active Projects on dashboard. 🎉')
      setRequirements('')
      fetchServices() // reload list
    } catch {
      toast.error('Failed to submit service request')
    } finally {
      setIsSubmitting(false)
    }
  }

  const SERVICE_CARDS = [
    { name: '3D Rendering', price: '₹5,000 / room', desc: 'Get photorealistic 3D renders of your room styles under various lighting conditions.', icon: Layout, color: 'text-indigo-650 bg-indigo-50 border-indigo-100' },
    { name: 'Custom Design', price: '₹12,000 / room', desc: 'Collaborate with a senior designer to create custom architectural layouts and models.', icon: PencilRuler, color: 'text-purple-650 bg-purple-50 border-purple-100' },
    { name: 'Advanced Modeling', price: '₹8,000 / room', desc: 'Detailed 3D modeling of complex items (like unique custom cabinets, modular storage) for fabrication.', icon: HardDrive, color: 'text-rose-650 bg-rose-50 border-rose-100' },
    { name: 'Consultation', price: '₹1,500 / hour', desc: '1-on-1 virtual call consultation with a senior design lead to guide you on materials and styles.', icon: HelpCircle, color: 'text-emerald-650 bg-emerald-50 border-emerald-100' }
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 pt-24 space-y-8">
        {/* Title */}
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Special Design Services</h1>
          <p className="text-sm text-slate-500 mt-1">
            Access optional, premium paid services to refine and finalize your interior design plans.
          </p>
        </div>

        {/* Services cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {SERVICE_CARDS.map((s) => {
            const Icon = s.icon
            return (
              <div key={s.name} className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex flex-col justify-between hover:shadow transition-all card-hover">
                <div className="space-y-3">
                  <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center border', s.color)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-800">{s.name}</h3>
                    <p className="text-xs text-indigo-600 font-bold mt-0.5">{s.price}</p>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">{s.desc}</p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Submit form */}
          <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-6">
            <div>
              <h2 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider">Request Service</h2>
              <p className="text-[10px] text-slate-400 mt-1">Describe your specifications and custom modifications.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Service Type</label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none text-slate-700 focus:ring-1 focus:ring-indigo-500 font-bold bg-white"
                >
                  <option value="3D Rendering">3D Rendering</option>
                  <option value="Custom Design">Custom Design</option>
                  <option value="Advanced Modeling">Advanced Modeling</option>
                  <option value="Consultation">Consultation</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Your Requirements</label>
                <textarea
                  required
                  placeholder="Tell us what you need in detail (dimensions, rooms, preferences)..."
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  rows={5}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none text-slate-800 focus:ring-1 focus:ring-indigo-500 resize-none font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-755 disabled:bg-indigo-400 text-white text-xs font-bold rounded-xl transition-all shadow-glow-indigo flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isSubmitting ? 'Submitting...' : 'Request & Checkout'}
              </button>
            </form>
          </div>

          {/* Active Requests trackers */}
          <div className="lg:col-span-2 bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4">
            <h2 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider border-b border-slate-50 pb-3">Active Service Requests</h2>

            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {services.map((req) => (
                <div key={req.id} className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-extrabold text-xs text-slate-800 capitalize">{req.service_type.replace('_', ' ')}</h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{req.requirements}</p>
                    <p className="text-[9px] text-slate-400 mt-1.5 font-semibold">Requested: {new Date(req.created_at).toLocaleDateString()}</p>
                  </div>

                  <div className="text-right space-y-1 flex-shrink-0">
                    <span className={clsx(
                      'inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border',
                      req.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                    )}>
                      {req.status}
                    </span>
                    <p className="text-xs font-black text-slate-800 mt-1">
                      {req.quote_amount ? `₹${req.quote_amount.toLocaleString()}` : 'Awaiting Quote'}
                    </p>
                  </div>
                </div>
              ))}

              {services.length === 0 && (
                <div className="text-center py-12 text-slate-400 font-semibold text-xs">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                  No service requests submitted yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
