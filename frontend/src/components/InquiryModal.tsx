'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { inquiryAPI } from '@/lib/api'
import toast from 'react-hot-toast'
import { X, Send, CheckCircle2, Phone, Mail, Sparkles } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  projectId?: string
  quotationId?: string
  bhkType?: string
  city?: string
  defaultName?: string
  defaultPhone?: string
}

export default function InquiryModal({
  isOpen, onClose, projectId, quotationId, bhkType, city, defaultName, defaultPhone
}: Props) {
  const [form, setForm] = useState({
    name: defaultName || '',
    phone: defaultPhone || '',
    email: '',
    message: '',
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async () => {
    if (!form.name || (!form.phone && !form.email)) {
      toast.error('Please provide your name and contact details')
      return
    }
    setLoading(true)
    try {
      await inquiryAPI.submit({
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        city,
        bhk_type: bhkType,
        message: form.message,
        project_id: projectId,
        quotation_id: quotationId,
        source: 'web',
      })
      setSuccess(true)
    } catch {
      toast.error('Failed to submit. Please call us directly.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSuccess(false)
    setForm({ name: defaultName || '', phone: defaultPhone || '', email: '', message: '' })
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden z-10"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 p-5 text-white flex-shrink-0 relative">
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition"
              >
                <X className="w-4 h-4 text-white" />
              </button>
              <div className="flex items-center gap-3 mb-1.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4.5 h-4.5" />
                </div>
                <h2 className="text-lg font-bold">Talk to a Design Expert</h2>
              </div>
              <p className="text-indigo-200 text-xs leading-relaxed">
                Our consultants will call you within 2 hours to walk through your design & execution plan.
              </p>
            </div>

            <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
              {!success ? (
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Your Name *</label>
                    <input
                      id="inquiry-name"
                      type="text"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Rahul Sharma"
                      className="input py-2 px-3.5 text-sm rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      Phone <span className="text-slate-400 font-normal">(or email required)</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        id="inquiry-phone"
                        type="tel"
                        value={form.phone}
                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="+91 98765 43210"
                        className="input pl-10 py-2 px-3.5 text-sm rounded-xl"
                        style={{ paddingLeft: '2.5rem' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        id="inquiry-email"
                        type="email"
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="rahul@example.com"
                        className="input pl-10 py-2 px-3.5 text-sm rounded-xl"
                        style={{ paddingLeft: '2.5rem' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Message <span className="text-slate-400 font-normal">(optional)</span></label>
                    <textarea
                      id="inquiry-message"
                      value={form.message}
                      onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                      placeholder="Any specific requirements or questions..."
                      rows={2}
                      className="input resize-none py-2 px-3.5 text-sm rounded-xl"
                    />
                  </div>

                  <button
                    id="inquiry-submit-btn"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="btn-primary w-full justify-center py-2.5 text-sm rounded-xl"
                  >
                    {loading
                      ? <div className="spinner w-5 h-5" />
                      : <><Send className="w-4 h-4" /> Submit Inquiry</>
                    }
                  </button>

                  <p className="text-center text-xs text-slate-400 pt-1">
                    Or call us directly: <a href="tel:+919876543210" className="text-indigo-600 font-bold hover:underline">+91 98765 43210</a>
                  </p>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-6"
                >
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1.5">Thank You, {form.name}! 🎉</h3>
                  <p className="text-slate-500 text-xs mb-5">
                    Our design consultant will contact you within <strong>2 hours</strong>.
                  </p>
                  <button onClick={handleClose} className="btn-primary justify-center px-8 py-2 text-xs rounded-lg">
                    Close
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
