'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { projectsAPI, quotationsAPI } from '@/lib/api'
import Navbar from '@/components/Navbar'
import InquiryModal from '@/components/InquiryModal'
import { useAuthStore } from '@/stores/authStore'
import { useCustomerStore } from '@/stores/customerStore'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Download, CheckCircle2, ArrowLeft, ArrowRight,
  Phone, Mail, MessageCircle, Sparkles, Building2, MapPin,
  Share2, Activity, X, CreditCard
} from 'lucide-react'
import Link from 'next/link'

export default function QuotationPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string
  const { user } = useAuthStore()
  const { revisions, fetchRevisions, requestRevision, updateQuotationStatus } = useCustomerStore()

  const [project, setProject] = useState<any>(null)
  const [quotation, setQuotation] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [inquiryOpen, setInquiryOpen] = useState(false)
  
  // Revision Modal States
  const [showRevModal, setShowRevModal] = useState(false)
  const [revNotes, setRevNotes] = useState('')
  const [submittingRev, setSubmittingRev] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [projRes, quoteRes] = await Promise.allSettled([
          projectsAPI.get(projectId),
          quotationsAPI.get(projectId)
        ])
        if (projRes.status === 'fulfilled') setProject(projRes.value.data)
        if (quoteRes.status === 'fulfilled') setQuotation(quoteRes.value.data)
        fetchRevisions(projectId)
      } catch {
        toast.error('Failed to load project data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [projectId, fetchRevisions])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await quotationsAPI.generate(projectId)
      setQuotation(res.data)
      toast.success('Quotation generated! 🎉')
      // Auto-open inquiry modal after 1.5s
      setTimeout(() => setInquiryOpen(true), 1500)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to generate quotation')
    } finally {
      setGenerating(false)
    }
  }

  const handleWhatsAppShare = () => {
    if (!quotation) return
    const text = encodeURIComponent(
      `Hi! I've designed my ${project?.bhk_type} at ${project?.property_name} using InteriorAI.\n` +
      `📋 Quotation Total: ₹${quotation.total?.toLocaleString('en-IN')}\n` +
      `📅 Valid until: ${quotation.valid_until}\n\n` +
      `Check InteriorAI: http://localhost:3000`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  const handleApprove = async () => {
    try {
      await updateQuotationStatus(projectId, quotation.id, 'approved')
      setQuotation({ ...quotation, status: 'approved' })
      toast.success('Quotation approved! Project status is now set to ordered.')
    } catch {
      toast.error('Failed to approve quotation')
    }
  }

  const handleReject = async () => {
    try {
      await updateQuotationStatus(projectId, quotation.id, 'rejected')
      setQuotation({ ...quotation, status: 'rejected' })
      toast.success('Quotation rejected')
    } catch {
      toast.error('Failed to reject quotation')
    }
  }

  const handleRevSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!revNotes.trim()) return
    setSubmittingRev(true)
    try {
      await requestRevision(projectId, revNotes)
      setQuotation({ ...quotation, status: 'under_revision' })
      toast.success('Revision request logged successfully')
      setRevNotes('')
      setShowRevModal(false)
    } catch {
      toast.error('Failed to request revision')
    } finally {
      setSubmittingRev(false)
    }
  }

  const formatINR = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner w-12 h-12" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-16">

        {/* Back button */}
        <button onClick={() => router.back()} className="btn-ghost mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Customise
        </button>

        {/* Project header */}
        <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 rounded-2xl p-8 text-white mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-indigo-300 text-sm mb-2">
                <Building2 className="w-4 h-4" /> {project?.bhk_type}
                <span className="mx-1">•</span>
                <MapPin className="w-4 h-4" /> {project?.city}
              </div>
              <h1 className="text-3xl font-bold mb-1">{project?.property_name}</h1>
              <p className="text-indigo-200 text-sm">Budget: {formatINR(project?.budget || 0)}</p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-black">{project?.rooms?.length || 0}</div>
              <div className="text-indigo-300 text-sm">Rooms</div>
            </div>
          </div>
        </div>

        {!quotation ? (
          /* Generate quotation CTA */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-card p-10 text-center"
          >
            <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <FileText className="w-10 h-10 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Generate Your Quotation</h2>
            <p className="text-slate-500 mb-6 max-w-md mx-auto leading-relaxed">
              We'll calculate the total cost including all your selected products,
              GST (18%), and generate a professional PDF you can download and share.
            </p>

            <div className="flex justify-center gap-6 mb-8 flex-wrap">
              {[
                { icon: CheckCircle2, text: 'Line-item breakdown' },
                { icon: CheckCircle2, text: 'GST @ 18% included' },
                { icon: CheckCircle2, text: 'Download as PDF' },
                { icon: CheckCircle2, text: 'Share via WhatsApp' },
              ].map((f) => (
                <div key={f.text} className="flex items-center gap-1.5 text-sm text-slate-600">
                  <f.icon className="w-4 h-4 text-indigo-500" /> {f.text}
                </div>
              ))}
            </div>

            <button
              id="generate-quote-btn"
              onClick={handleGenerate}
              disabled={generating}
              className="btn-primary text-base px-10 py-4"
            >
              {generating ? (
                <><div className="spinner w-5 h-5" /> Generating…</>
              ) : (
                <><Sparkles className="w-5 h-5" /> Generate Instant Quotation</>
              )}
            </button>
          </motion.div>
        ) : (
          /* Quotation display */
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Subtotal',   value: formatINR(quotation.subtotal), color: 'text-slate-700' },
                { label: 'GST (18%)', value: formatINR(quotation.gst),      color: 'text-amber-600' },
                { label: 'TOTAL',     value: formatINR(quotation.total),    color: 'text-indigo-600' },
              ].map((card) => (
                <div key={card.label} className="bg-white rounded-2xl p-5 shadow-card text-center">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{card.label}</div>
                  <div className={`text-2xl font-black ${card.color}`}>{card.value}</div>
                </div>
              ))}
            </div>

            {/* Line items table */}
            <div className="bg-white rounded-2xl shadow-card overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-900">Scope of Work — Line Items</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3 text-left">Room</th>
                      <th className="px-6 py-3 text-left">Item</th>
                      <th className="px-6 py-3 text-left">Category</th>
                      <th className="px-6 py-3 text-right">Qty</th>
                      <th className="px-6 py-3 text-right">Unit Rate</th>
                      <th className="px-6 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(quotation.line_items || []).map((item: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{item.room}</td>
                        <td className="px-6 py-4 font-medium text-slate-800">{item.name}</td>
                        <td className="px-6 py-4 text-slate-500 capitalize">{item.category?.replace(/_/g, ' ')}</td>
                        <td className="px-6 py-4 text-right text-slate-600">{item.qty}</td>
                        <td className="px-6 py-4 text-right text-slate-600">₹{item.unit_price?.toLocaleString('en-IN')}</td>
                        <td className="px-6 py-4 text-right font-semibold text-indigo-600">₹{item.total?.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-indigo-50">
                    <tr>
                      <td colSpan={5} className="px-6 py-4 font-bold text-slate-700 text-right">TOTAL (incl. 18% GST)</td>
                      <td className="px-6 py-4 text-right font-black text-xl text-indigo-600">{formatINR(quotation.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
             {/* Validity and actions */}
            <div className="bg-white rounded-2xl shadow-card p-6 mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-slate-500 mb-1">Quotation valid until</div>
                  <div className="font-bold text-slate-800 text-lg">{quotation.valid_until}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    ID: {(quotation.quotation_id || quotation.id)?.substring(0, 8)?.toUpperCase()}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <a
                    href={quotation.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    id="download-pdf-btn"
                    className="btn-primary animate-glow"
                  >
                    <Download className="w-4 h-4" /> Download PDF
                  </a>
                  <button
                    onClick={handleWhatsAppShare}
                    className="flex items-center gap-2 bg-green-500 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-green-600 transition shadow-sm font-bold text-xs"
                  >
                    <Share2 className="w-4 h-4" /> Share via WhatsApp
                  </button>
                  <a
                    href={`mailto:?subject=Interior Design Quotation&body=${encodeURIComponent(
                      `Hi! I've designed my ${project?.bhk_type} at ${project?.property_name} using InteriorAI.\n` +
                      `📋 Quotation Total: ₹${quotation.total?.toLocaleString('en-IN')}\n` +
                      `📅 Valid until: ${quotation.valid_until}\n\n` +
                      `Check InteriorAI: http://localhost:3000`
                    )}`}
                    className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-5 py-2.5 rounded-xl transition border border-slate-200 shadow-sm font-bold text-xs"
                  >
                    <Mail className="w-4 h-4 text-indigo-600" /> Share via Email
                  </a>
                  <Link
                    href={`/track/${projectId}`}
                    className="flex items-center gap-2 bg-indigo-50 text-indigo-700 font-semibold px-5 py-2.5 rounded-xl hover:bg-indigo-100 transition border border-indigo-200/50 font-bold text-xs shadow-sm"
                  >
                    <Activity className="w-4 h-4" /> Track Project
                  </Link>
                </div>
              </div>
            </div>

            {/* Quotation Status & Approval Actions */}
            <div className="bg-white rounded-2xl shadow-card p-6 mb-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Quotation Decision</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  quotation.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                  quotation.status === 'rejected' ? 'bg-rose-100 text-rose-700' :
                  quotation.status === 'under_revision' ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-650'
                }`}>
                  Status: {quotation.status?.replace('_', ' ')}
                </span>
              </div>

              {quotation.status !== 'approved' && quotation.status !== 'rejected' ? (
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleApprove}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-sm"
                  >
                    ✓ Approve Quotation
                  </button>
                  <button
                    onClick={handleReject}
                    className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition shadow-sm"
                  >
                    ✕ Reject Quotation
                  </button>
                  <button
                    onClick={() => setShowRevModal(true)}
                    className="px-6 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-150 font-bold rounded-xl text-xs transition"
                  >
                    ✎ Request Changes / Revision
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <p className="text-xs text-slate-500 font-semibold">
                    This quotation has been <span className="font-bold text-slate-700 uppercase">{quotation.status}</span>. You can track progress, make milestone payments, or download receipts.
                  </p>
                  {quotation.status === 'approved' && (
                    <Link
                      href={`/track/${projectId}/payments`}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white font-bold rounded-xl text-xs transition shadow-glow-indigo flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <CreditCard className="w-3.5 h-3.5" /> Make Milestone Payment
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Revision History timeline */}
            {revisions.length > 0 && (
              <div className="bg-white rounded-2xl shadow-card p-6 mb-6 space-y-4">
                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider border-b border-slate-100 pb-3">Revision History</h3>
                <div className="space-y-4 relative">
                  {revisions.map((rev: any, idx: number) => (
                    <div key={rev.id} className="p-4 bg-slate-50 border border-slate-150 rounded-xl flex justify-between items-start text-xs shadow-sm">
                      <div className="space-y-1">
                        <div className="font-bold text-slate-800">Revision #{rev.revision_number}</div>
                        <p className="text-slate-600 leading-relaxed italic">"Notes: {rev.customer_notes}"</p>
                        <p className="text-[10px] text-slate-400 font-medium">Requested: {new Date(rev.created_at).toLocaleString()}</p>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 border border-indigo-200">
                        {rev.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inquiry CTA */}
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-2xl p-6 text-white">
              <h3 className="font-bold text-xl mb-2">Ready to Proceed?</h3>
              <p className="text-indigo-200 text-sm mb-5">
                Our design consultants will get in touch within 2 hours to walk you through the execution plan.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setInquiryOpen(true)}
                  id="proceed-inquiry-btn"
                  className="flex items-center gap-2 bg-white text-indigo-600 font-semibold px-5 py-2.5 rounded-xl hover:bg-indigo-50 transition"
                >
                  <Sparkles className="w-4 h-4" /> Proceed to Execution
                </button>
                <a href="tel:+919876543210" className="flex items-center gap-2 bg-white/20 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-white/30 transition">
                  <Phone className="w-4 h-4" /> Call Us
                </a>
                <a href="https://wa.me/919876543210" target="_blank" className="flex items-center gap-2 bg-green-500 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-green-600 transition">
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </a>
                <a href="mailto:hello@interiorai.in" className="flex items-center gap-2 bg-white/10 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-white/20 transition">
                  <Mail className="w-4 h-4" /> Email
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Revision Modal Dialog */}
      <AnimatePresence>
        {showRevModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRevModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden relative z-10 p-6"
            >
              <button
                onClick={() => setShowRevModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>

              <h2 className="text-xl font-extrabold text-slate-900 mb-2 flex items-center gap-2">
                Request Quote Revision
              </h2>
              <p className="text-slate-400 text-xs mb-4">Provide detailed feedback or changes needed in your furniture catalog rates.</p>

              <form onSubmit={handleRevSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Revision Notes</label>
                  <textarea
                    required
                    placeholder="e.g. Please swap the velvet sofa for oak fabric, and reduce bedroom wardrobe quantity to 1."
                    value={revNotes}
                    onChange={(e) => setRevNotes(e.target.value)}
                    rows={4}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none text-slate-800 focus:ring-1 focus:ring-indigo-500 resize-none font-medium"
                  />
                </div>

                <div className="flex gap-2 justify-end border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowRevModal(false)}
                    className="px-4 py-2 rounded-lg border border-slate-250 text-slate-500 text-xs font-bold hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingRev}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-850 text-white text-xs font-bold rounded-lg transition"
                  >
                    {submittingRev ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Inquiry Modal */}
      <InquiryModal
        isOpen={inquiryOpen}
        onClose={() => setInquiryOpen(false)}
        projectId={projectId}
        quotationId={quotation?.quotation_id || quotation?.id}
        bhkType={project?.bhk_type}
        city={project?.city}
        defaultName={user?.name}
        defaultPhone={user?.phone}
      />
    </div>
  )
}
