'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { projectsAPI, quotationsAPI } from '@/lib/api'
import Navbar from '@/components/Navbar'
import InquiryModal from '@/components/InquiryModal'
import { useAuthStore } from '@/stores/authStore'
import { useCustomerStore } from '@/stores/customerStore'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Download, CheckCircle2, ArrowLeft,
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
        
        let activeQuote = null
        if (quoteRes.status === 'fulfilled') {
          activeQuote = quoteRes.value.data
        }
        
        // Auto-regenerate ONLY when customer returns after requesting revision / rejecting
        const needsRegeneration = activeQuote && (
          activeQuote.status === 'rejected' ||
          activeQuote.status === 'under_revision'
        )

        if (needsRegeneration) {
          try {
            const genRes = await quotationsAPI.generate(projectId)
            activeQuote = genRes.data
            toast.success('Quotation updated with your revised selections! 📋')
          } catch (e) {
            console.error("Failed to auto-regenerate quote:", e)
          }
        }
        
        setQuotation(activeQuote)
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

  const handleDownloadPDF = () => {
    // Download the backend-generated PDF directly
    const url = quotationsAPI.download(projectId)
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.download = `Quotation_${quotation?.quotation_no || (quotation?.quotation_id || quotation?.id)?.substring(0, 8)?.toUpperCase() || 'INTERIORAI'}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const emailBody = useCallback(() => {
    return encodeURIComponent(
      `Hi! I've designed my ${project?.bhk_type} at ${project?.property_name} using InteriorAI.\n` +
      `📋 Quotation Total: ₹${quotation?.total?.toLocaleString('en-IN')}\n` +
      `📅 Valid until: ${quotation?.valid_until}\n\n` +
      `Check InteriorAI: http://localhost:3000`
    )
  }, [project, quotation])

  const handleApprove = async () => {
    try {
      const qId = quotation.id || quotation.quotation_id
      await updateQuotationStatus(projectId, qId, 'approved')
      setQuotation({ ...quotation, status: 'approved' })
      toast.success('Quotation approved! Taking you to checkout...')
      setTimeout(() => {
        // Feedback 1.12 — special services are confirmed before payment.
        router.push(`/checkout/${projectId}`)
      }, 800)
    } catch {
      toast.error('Failed to approve quotation')
    }
  }

  const handleReject = async () => {
    try {
      const qId = quotation.id || quotation.quotation_id
      await updateQuotationStatus(projectId, qId, 'rejected')
      setQuotation({ ...quotation, status: 'rejected' })
      toast.success('Quotation rejected')
      router.push(`/customize/${projectId}`)
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
      router.push(`/customize/${projectId}`)
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
    <div className="min-h-screen bg-[#FAFBF9] text-[#161D1A]">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-16">

        {/* Back button */}
        {quotation?.status === 'approved' ? (
          <button onClick={() => router.push(`/track/${projectId}`)} className="btn-ghost mb-6 text-stone-600 hover:text-stone-900">
            <ArrowLeft className="w-4 h-4" /> Back to Project Progress
          </button>
        ) : (
          <button onClick={() => router.back()} className="btn-ghost mb-6 text-stone-600 hover:text-stone-900">
            <ArrowLeft className="w-4 h-4" /> Back to Customise
          </button>
        )}

        {/* Project header */}
        <div className="bg-gradient-to-r from-white via-[#F7FEE7]/90 to-[#A3E635] border border-[#E5ECE7] rounded-3xl p-8 text-[#161D1A] mb-6 shadow-sm">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#161D1A]/5 backdrop-blur-xs px-3 py-1 rounded-full text-[#161D1A] text-xs font-bold mb-2">
                <Building2 className="w-4 h-4 text-[#059669]" /> {project?.bhk_type}
                <span className="mx-1 text-stone-400">•</span>
                <MapPin className="w-4 h-4 text-[#059669]" /> {project?.city}
              </div>
              <h1 className="text-3xl font-bold mb-1 font-serif tracking-tight text-[#161D1A]">{project?.property_name}</h1>
              <p className="text-stone-600 text-sm font-semibold">Budget: {formatINR(project?.budget || 0)}</p>
            </div>
            <div className="text-right flex flex-col items-end gap-3">
              <div>
                <div className="text-4xl font-black text-[#161D1A]">{project?.rooms?.length || 0}</div>
                <div className="text-stone-600 text-sm font-bold">Rooms</div>
              </div>
              <button
                onClick={() => setInquiryOpen(true)}
                className="flex items-center gap-1.5 bg-[#161D1A] hover:bg-stone-800 text-white font-bold px-4 py-2.5 rounded-xl transition text-xs shadow-md"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#FDE047] animate-pulse" /> Talk to a Design Expert
              </button>
            </div>
          </div>
        </div>

        {!quotation ? (
          /* Generate quotation CTA */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-[#E5ECE7] shadow-sm p-10 text-center"
          >
            <div className="w-20 h-20 bg-emerald-50 border border-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <FileText className="w-10 h-10 text-[#059669]" />
            </div>
            <h2 className="text-2xl font-bold text-stone-900 mb-3 font-serif">Generate Your Quotation</h2>
            <p className="text-stone-600 mb-6 max-w-md mx-auto leading-relaxed text-sm">
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
                <div key={f.text} className="flex items-center gap-1.5 text-sm text-stone-600 font-medium">
                  <f.icon className="w-4 h-4 text-[#059669]" /> {f.text}
                </div>
              ))}
            </div>

            <button
              id="generate-quote-btn"
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center justify-center gap-2.5 bg-[#84CC16] hover:bg-[#A3E635] text-[#0B0F0D] text-sm font-black px-8 py-3.5 rounded-full shadow-[0_4px_16px_rgba(132,204,22,0.3)] transition-all hover:scale-102 active:scale-98 disabled:opacity-60"
            >
              {generating ? (
                <><div className="spinner w-5 h-5" /> Generating…</>
              ) : (
                <><Sparkles className="w-5 h-5 text-[#0B0F0D]" /> Generate Instant Quotation</>
              )}
            </button>
          </motion.div>
        ) : (
          /* Quotation display */
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

            {/* Summary cards */}
            <div className={`grid gap-4 mb-5 ${quotation.discount_amount > 0 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3'}`}>
              {[
                ...(quotation.discount_amount > 0 ? [
                  { label: 'Original price', value: formatINR(quotation.original_total), color: 'text-stone-400 line-through' },
                  { label: 'Discount',       value: `− ${formatINR(quotation.discount_amount)}`, color: 'text-emerald-600' },
                ] : []),
                { label: quotation.discount_amount > 0 ? 'Taxable value' : 'Subtotal', value: formatINR(quotation.subtotal), color: 'text-stone-700' },
                { label: 'GST (18%)', value: formatINR(quotation.gst),      color: 'text-amber-700' },
                { label: 'TOTAL',     value: formatINR(quotation.total),    color: 'text-[#059669]' },
              ].map((card) => (
                <div key={card.label} className="bg-white rounded-2xl p-5 border border-[#E5ECE7] shadow-xs text-center">
                  <div className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">{card.label}</div>
                  <div className={`text-2xl font-black font-serif ${card.color}`}>{card.value}</div>
                </div>
              ))}
            </div>

            {/* Billed to */}
            <div className="bg-white rounded-2xl border border-[#E5ECE7] shadow-xs px-5 py-4 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-stone-600 leading-relaxed">
                <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-0.5">Billed to</span>
                <span className="font-bold text-stone-900 text-sm">
                  {quotation.billing?.company_name || quotation.billing?.name || user?.name || 'Customer'}
                </span>
                {quotation.billing?.billing_address && <span className="block">{quotation.billing.billing_address}</span>}
                {(quotation.billing?.billing_city || quotation.billing?.billing_state) && (
                  <span className="block">
                    {[quotation.billing?.billing_city, quotation.billing?.billing_state, quotation.billing?.billing_pincode].filter(Boolean).join(', ')}
                  </span>
                )}
                {quotation.gst_number ? (
                  <span className="block font-mono font-semibold text-stone-700 mt-0.5">GSTIN {quotation.gst_number}</span>
                ) : (
                  <span className="block text-stone-400 mt-0.5">No GSTIN on this quotation</span>
                )}
              </div>
              {!['paid', 'converted'].includes(quotation.status) && (
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/profile/billing?next=${encodeURIComponent(`/quotation/${projectId}`)}`}
                    className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 hover:border-[#84CC16] hover:bg-stone-50 font-bold text-xs transition"
                  >
                    {quotation.gst_number ? 'Edit billing details' : 'Add GST details'}
                  </Link>
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="px-4 py-2 rounded-xl bg-[#161D1A] hover:bg-stone-800 text-white font-bold text-xs disabled:opacity-60 transition"
                    title="Billing details are frozen when a quotation is issued; regenerate to apply changes"
                  >
                    {generating ? 'Regenerating…' : 'Regenerate quotation'}
                  </button>
                </div>
              )}
            </div>

            {/* ── Top Action Bar: Download + Share + Meta ── */}
            <div className="bg-white rounded-2xl border border-[#E5ECE7] shadow-xs px-5 py-4 mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              {/* Quotation metadata */}
              <div className="flex items-center gap-4 text-xs text-stone-500">
                <span>
                  <span className="font-semibold text-stone-700">Quotation No:</span>{' '}
                  <span className="font-mono font-bold text-[#059669]">
                    {quotation.quotation_no || (quotation.quotation_id || quotation.id)?.substring(0, 8)?.toUpperCase()}
                  </span>
                </span>
                <span className="text-stone-300">|</span>
                <span>
                  <span className="font-semibold text-stone-700">Valid until:</span>{' '}
                  {quotation.valid_until}
                </span>
              </div>
              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleDownloadPDF}
                  className="flex items-center gap-1.5 bg-[#161D1A] hover:bg-stone-800 text-white font-bold px-4 py-2 rounded-xl transition shadow-sm text-xs"
                >
                  <Download className="w-3.5 h-3.5" /> Download PDF
                </button>
                <button
                  onClick={handleWhatsAppShare}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl transition shadow-sm text-xs"
                >
                  <Share2 className="w-3.5 h-3.5" /> WhatsApp
                </button>
                <a
                  href={`mailto:?subject=Interior Design Quotation&body=${emailBody()}`}
                  className="flex items-center gap-1.5 bg-white hover:bg-stone-50 text-stone-700 font-bold px-4 py-2 rounded-xl transition border border-[#E5ECE7] hover:border-[#84CC16] shadow-sm text-xs"
                >
                  <Mail className="w-3.5 h-3.5 text-[#059669]" /> Share via Email
                </a>
                {quotation.status === 'approved' && (
                  <a
                    href={projectsAPI.downloadFloorPlan(projectId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    id="download-floorplan-btn"
                    className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#059669] font-bold px-4 py-2 rounded-xl transition border border-emerald-200/80 text-xs"
                  >
                    <FileText className="w-3.5 h-3.5" /> Floor Plan PDF
                  </a>
                )}
              </div>
            </div>

            {/* Line items table */}
            <div className="bg-white rounded-3xl border border-[#E5ECE7] shadow-xs overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-[#E5ECE7]">
                <h3 className="font-bold text-stone-900 font-serif">Scope of Work — Line Items</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#F4F6F4] text-xs font-bold text-stone-600 uppercase tracking-wider border-b border-[#E5ECE7]">
                    <tr>
                      <th className="px-6 py-3 text-left">Room</th>
                      <th className="px-6 py-3 text-left">Item</th>
                      <th className="px-6 py-3 text-left">Category</th>
                      <th className="px-6 py-3 text-right">Qty</th>
                      <th className="px-6 py-3 text-right">Unit Rate</th>
                      <th className="px-6 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {(quotation.line_items || []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-stone-400 text-sm">
                          No line items found. Please regenerate the quotation.
                        </td>
                      </tr>
                    ) : (
                      (quotation.line_items || []).map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-[#FAFBF9] transition-colors">
                          <td className="px-6 py-4 text-stone-600 whitespace-nowrap">{item.room}</td>
                          <td className="px-6 py-4 font-semibold text-stone-800">{item.name}</td>
                          <td className="px-6 py-4 text-stone-500 capitalize">{item.category?.replace(/_/g, ' ')}</td>
                          <td className="px-6 py-4 text-right text-stone-600">{item.qty}</td>
                          <td className="px-6 py-4 text-right text-stone-600">₹{item.unit_price?.toLocaleString('en-IN')}</td>
                          <td className="px-6 py-4 text-right font-extrabold text-[#059669]">₹{item.total?.toLocaleString('en-IN')}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-emerald-50/70 border-t-2 border-[#E5ECE7]">
                    <tr>
                      <td colSpan={5} className="px-6 py-4 font-extrabold text-stone-800 text-right">TOTAL (incl. 18% GST)</td>
                      <td className="px-6 py-4 text-right font-black text-xl text-[#059669] font-serif">{formatINR(quotation.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Approved / paid */}
            {['approved', 'paid', 'converted'].includes(quotation.status) && (
              <div className={`rounded-3xl p-6 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border ${
                quotation.status === 'approved' ? 'bg-gradient-to-r from-[#0B0F0D] via-[#161D1A] to-[#1B2923] text-white border-emerald-950/20' : 'bg-emerald-50 border-emerald-200'
              }`}>
                {quotation.status === 'approved' ? (
                  <>
                    <div>
                      <h3 className="font-bold text-lg font-serif">Quotation approved</h3>
                      <p className="text-stone-300 text-sm mt-0.5">
                        Confirm any special services, then pay {formatINR(quotation.total)} in full quoting <span className="font-mono font-bold text-[#A3E635]">{quotation.quotation_no}</span>.
                      </p>
                    </div>
                    <Link href={`/checkout/${projectId}`}
                      className="btn-lime px-6 py-3 font-extrabold text-xs flex items-center gap-2 whitespace-nowrap shadow-md">
                      <CreditCard className="w-4 h-4" /> Proceed to Checkout
                    </Link>
                  </>
                ) : (
                  <>
                    <div>
                      <h3 className="font-bold text-lg text-emerald-900 font-serif flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-600" /> Payment received</h3>
                      <p className="text-emerald-700 text-sm">
                        {quotation.paid_at ? `Recorded on ${new Date(quotation.paid_at).toLocaleDateString('en-IN')}. ` : ''}
                        Your project is with our team for approval and supplier allocation.
                      </p>
                    </div>
                    <Link href={`/track/${projectId}`}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-3 rounded-xl transition whitespace-nowrap text-sm shadow-sm">
                      Track project
                    </Link>
                  </>
                )}
              </div>
            )}

            {/* Quotation Status & Approval Actions */}
            {!['approved', 'paid', 'converted'].includes(quotation.status) && (
              <>
                <div className="bg-white rounded-3xl border border-[#E5ECE7] shadow-xs p-6 mb-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-[#E5ECE7] pb-3">
                    <h3 className="font-bold text-stone-900 text-xs uppercase tracking-wider">Quotation Decision</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      quotation.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                      quotation.status === 'rejected' ? 'bg-rose-100 text-rose-700' :
                      quotation.status === 'under_revision' ? 'bg-amber-100 text-amber-800' :
                      'bg-stone-100 text-stone-700'
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
                        className="px-6 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 font-bold rounded-xl text-xs transition"
                      >
                        ✎ Request Changes / Revision
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <p className="text-xs text-stone-600 font-semibold">
                        This quotation has been <span className="font-bold text-stone-900 uppercase">{quotation.status}</span>. Continue to checkout to confirm any special services and pay in full.
                      </p>
                      {quotation.status === 'approved' && (
                        <Link
                          href={`/checkout/${projectId}`}
                          className="btn-lime px-5 py-2.5 font-bold text-xs flex items-center gap-1.5 whitespace-nowrap shadow-sm"
                        >
                          <CreditCard className="w-3.5 h-3.5" /> Proceed to Checkout
                        </Link>
                      )}
                    </div>
                  )}
                </div>

                {/* Revision History timeline */}
                {revisions.length > 0 && (
                  <div className="bg-white rounded-3xl border border-[#E5ECE7] shadow-xs p-6 mb-6 space-y-4">
                    <h3 className="font-bold text-stone-900 text-xs uppercase tracking-wider border-b border-[#E5ECE7] pb-3">Revision History</h3>
                    <div className="space-y-4 relative">
                      {revisions.map((rev: any, idx: number) => (
                        <div key={rev.id} className="p-4 bg-[#FAFBF9] border border-[#E5ECE7] rounded-2xl flex justify-between items-start text-xs shadow-2xs">
                          <div className="space-y-1">
                            <div className="font-bold text-stone-900">Revision #{rev.revision_number}</div>
                            <p className="text-stone-600 leading-relaxed italic">"Notes: {rev.customer_notes}"</p>
                            <p className="text-[10px] text-stone-400 font-medium">Requested: {new Date(rev.created_at).toLocaleString()}</p>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {rev.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Inquiry CTA */}
                <div className="bg-gradient-to-r from-white via-[#F7FEE7]/90 to-[#84CC16]/90 border border-[#E5ECE7] rounded-3xl p-6 text-[#161D1A] shadow-sm">
                  <h3 className="font-bold text-xl mb-2 font-serif text-[#161D1A]">Ready to Proceed?</h3>
                  <p className="text-stone-600 text-sm mb-5 font-medium">
                    Our design consultants will get in touch within 2 hours to walk you through the execution plan.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => {
                        if (quotation.status === 'approved') {
                          router.push(`/track/${projectId}`)
                        } else {
                          toast.error('Please approve quotation before proceeding to execution.')
                        }
                      }}
                      id="proceed-inquiry-btn"
                      className="flex items-center gap-2 bg-[#161D1A] text-white font-extrabold px-5 py-2.5 rounded-xl hover:bg-stone-800 transition shadow-md"
                    >
                      <Sparkles className="w-4 h-4 text-[#FDE047]" /> Proceed to Execution
                    </button>
                    <a href="tel:+919876543210" className="flex items-center gap-2 bg-white hover:bg-stone-50 text-[#161D1A] font-extrabold px-5 py-2.5 rounded-xl transition border border-[#E5ECE7] shadow-xs">
                      <Phone className="w-4 h-4 text-[#161D1A]" /> Call Us
                    </a>
                    <a href="https://wa.me/919876543210" target="_blank" className="flex items-center gap-2 bg-[#15803D] hover:bg-[#166534] text-white font-extrabold px-5 py-2.5 rounded-xl transition border border-emerald-600 shadow-xs">
                      <MessageCircle className="w-4 h-4 text-white" /> WhatsApp
                    </a>
                    <a href="mailto:hello@interiorai.in" className="flex items-center gap-2 bg-[#0F766E] hover:bg-[#115E59] text-white font-extrabold px-5 py-2.5 rounded-xl transition border border-teal-600 shadow-xs">
                      <Mail className="w-4 h-4 text-white" /> Email
                    </a>
                  </div>
                </div>
              </>
            )}
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
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-[#FAFBF9] w-full max-w-md rounded-3xl border border-[#E5ECE7] shadow-2xl overflow-hidden relative z-10 p-6 text-stone-900"
            >
              <button
                onClick={() => setShowRevModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-stone-100 text-stone-500 hover:bg-stone-200 transition"
              >
                <X className="w-4 h-4" />
              </button>

              <h2 className="text-xl font-extrabold text-stone-900 mb-2 flex items-center gap-2 font-serif">
                Request Quote Revision
              </h2>
              <p className="text-stone-500 text-xs mb-4">Provide detailed feedback or changes needed in your furniture catalog rates.</p>

              <form onSubmit={handleRevSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Revision Notes</label>
                  <textarea
                    required
                    placeholder="e.g. Please swap the velvet sofa for oak fabric, and reduce bedroom wardrobe quantity to 1."
                    value={revNotes}
                    onChange={(e) => setRevNotes(e.target.value)}
                    rows={4}
                    className="w-full text-xs border border-stone-200 rounded-xl p-2.5 outline-none text-stone-800 focus:border-[#84CC16] focus:ring-1 focus:ring-[#84CC16] resize-none font-medium bg-white"
                  />
                </div>

                <div className="flex gap-2 justify-end border-t border-[#E5ECE7] pt-3">
                  <button
                    type="button"
                    onClick={() => setShowRevModal(false)}
                    className="px-4 py-2 rounded-xl border border-stone-200 text-stone-600 text-xs font-bold hover:bg-stone-100 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingRev}
                    className="px-5 py-2 bg-[#161D1A] hover:bg-stone-800 disabled:opacity-60 text-white text-xs font-bold rounded-xl transition"
                  >
                    {submittingRev ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Action Button for Inquiry */}
      {quotation && (
        <button
          onClick={() => setInquiryOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-[#161D1A] hover:bg-stone-800 text-white p-4 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 flex items-center justify-center border border-[#A3E635]/40 group"
          title="Talk to a Design Expert"
        >
          <Sparkles className="w-6 h-6 text-[#FDE047]" />
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-2 transition-all duration-350 ease-out text-xs font-bold whitespace-nowrap text-[#A3E635]">
            Talk to Expert
          </span>
        </button>
      )}

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
