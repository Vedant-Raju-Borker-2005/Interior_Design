'use client'

/**
 * Pre-checkout — stakeholder feedback 1.12 (with 1.3 and 5.x).
 *
 * The last stop before payment. The customer can request partner-delivered
 * special services, must confirm the practical details that block execution,
 * and sees the GST identity their invoice will carry. Everything is saved on
 * the project, and each requested service becomes a lead for a consultant.
 */
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import {
  ArrowLeft, ArrowRight, Check, Compass, Ruler, Home, PackageSearch, ShieldCheck, Receipt,
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import { billingAPI, projectsAPI, quotationsAPI, specialServicesAPI } from '@/lib/api'

const SERVICE_INFO: Record<string, { icon: any; blurb: string; placeholder: string }> = {
  'House Design': {
    icon: Home,
    blurb: 'An architect partner reworks layouts, elevations or a full home design.',
    placeholder: 'e.g. Open up the kitchen into the dining area; need a structural check',
  },
  'Survey Plan': {
    icon: Compass,
    blurb: 'A licensed surveyor measures the plot or flat and prepares the survey plan.',
    placeholder: 'e.g. Plot survey for society approval, 2,400 sq ft',
  },
  'Special Vending Services': {
    icon: PackageSearch,
    blurb: 'Specialist suppliers for items outside our catalogue — lifts, automation, bespoke pieces.',
    placeholder: 'e.g. Home automation for lights and curtains in 3 rooms',
  },
  'Measurable Drawings': {
    icon: Ruler,
    blurb: 'Dimensioned working drawings your contractor or society can build from.',
    placeholder: 'e.g. Kitchen and wardrobe elevations with electrical points',
  },
}

const CONFIRMATIONS = [
  { key: 'site_access', label: 'The site will be accessible to our team from the date below' },
  { key: 'scope_final', label: 'The rooms, products and customisations on my quotation are final' },
  { key: 'full_payment_terms', label: 'I understand the quotation is paid in full to confirm the booking' },
]

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0)

export default function PreCheckoutPage() {
  const { projectId } = useParams() as { projectId: string }
  const router = useRouter()

  const [project, setProject] = useState<any>(null)
  const [quotation, setQuotation] = useState<any>(null)
  const [billing, setBilling] = useState<any>(null)
  const [existingLeads, setExistingLeads] = useState<any[]>([])
  const [types, setTypes] = useState<string[]>(Object.keys(SERVICE_INFO))
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [confirmations, setConfirmations] = useState<Record<string, boolean>>({})
  const [siteAccessFrom, setSiteAccessFrom] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      const [p, q, b, c] = await Promise.allSettled([
        projectsAPI.get(projectId),
        quotationsAPI.get(projectId),
        billingAPI.get(),
        specialServicesAPI.getCheckout(projectId),
      ])
      if (p.status === 'fulfilled') setProject(p.value.data)
      if (q.status === 'fulfilled') setQuotation(q.value.data)
      if (b.status === 'fulfilled') setBilling(b.value.data)
      if (c.status === 'fulfilled') {
        const data = c.value.data
        setTypes(data.service_types?.length ? data.service_types : Object.keys(SERVICE_INFO))
        setExistingLeads(data.leads || [])
        if (data.saved) {
          setConfirmations(data.saved.confirmations || {})
          setSiteAccessFrom(data.saved.site_access_from || '')
          setNotes(data.saved.notes || '')
        }
      } else {
        toast.error('Could not load checkout for this project')
      }
      setLoading(false)
    }
    load()
  }, [projectId])

  const requested = useMemo(
    () => Object.fromEntries(existingLeads.map((l) => [l.service_type, l])),
    [existingLeads],
  )

  const allConfirmed = CONFIRMATIONS.every((c) => confirmations[c.key]) && !!siteAccessFrom
  const today = new Date().toISOString().slice(0, 10)

  const toggleService = (type: string) => {
    setSelected((prev) => {
      const next = { ...prev }
      if (type in next) delete next[type]
      else next[type] = ''
      return next
    })
  }

  const continueToPayment = async () => {
    if (!allConfirmed) {
      toast.error('Please complete the confirmations and site access date')
      return
    }
    setSaving(true)
    try {
      const res = await specialServicesAPI.saveCheckout(projectId, {
        services: Object.entries(selected).map(([service_type, requirements]) => ({ service_type, requirements: requirements || undefined })),
        confirmations,
        site_access_from: siteAccessFrom,
        notes: notes || undefined,
      })
      const created: string[] = res.data.created_leads || []
      if (created.length) {
        toast.success(`Requested ${created.length} special service${created.length > 1 ? 's' : ''} — a partner will contact you`)
      }
      router.push(`/track/${projectId}/payments`)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Could not save checkout details')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="spinner w-12 h-12" /></div>
  }

  return (
    <div className="min-h-screen bg-[#FAFBF9] text-[#161D1A]">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-16">
        <button onClick={() => router.push(`/quotation/${projectId}`)} className="btn-ghost mb-6 text-stone-600 hover:text-stone-900">
          <ArrowLeft className="w-4 h-4" /> Back to quotation
        </button>

        <div className="bg-gradient-to-r from-[#0B0F0D] via-[#161D1A] to-[#1B2923] border border-emerald-950/20 rounded-3xl p-7 text-white mb-6 shadow-xl flex flex-wrap justify-between items-end gap-4">
          <div>
            <div className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">Checkout · step 1 of 2</div>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif tracking-tight">{project?.property_name || 'Your project'}</h1>
            <p className="text-stone-300 text-sm mt-0.5">{project?.bhk_type} · {project?.city}</p>
          </div>
          {quotation && (
            <div className="text-right">
              <div className="text-stone-300 text-xs font-medium">Quotation <span className="font-mono text-[#A3E635] font-bold">{quotation.quotation_no}</span></div>
              <div className="text-3xl font-black font-serif text-[#A3E635] mt-0.5">{inr(quotation.total)}</div>
              <div className="text-stone-300 text-xs">incl. GST · paid in full</div>
            </div>
          )}
        </div>

        {/* Special services — partner delivered, requested here, quoted separately */}
        <section className="bg-white rounded-3xl border border-[#E5ECE7] shadow-xs p-6 sm:p-7 mb-6">
          <h2 className="font-bold text-stone-900 text-lg font-serif">Need any special services?</h2>
          <p className="text-sm text-stone-600 mb-5">
            Optional. These are delivered by our partner consultants and quoted separately — requesting one does not change today’s payment.
          </p>
          <div className="grid sm:grid-cols-2 gap-3.5">
            {types.map((type) => {
              const info = SERVICE_INFO[type] || { icon: PackageSearch, blurb: '', placeholder: '' }
              const Icon = info.icon
              const lead = requested[type]
              const on = type in selected
              return (
                <div key={type} className={clsx('rounded-2xl border-2 p-4 transition-all duration-200',
                  lead ? 'border-emerald-300 bg-emerald-50/50' : on ? 'border-[#84CC16] bg-emerald-50/30 ring-2 ring-[#84CC16]/20' : 'border-[#E5ECE7] bg-white hover:border-[#84CC16]/50')}>
                  <button type="button" disabled={!!lead} onClick={() => toggleService(type)} className="w-full text-left flex gap-3 disabled:cursor-default">
                    <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs',
                      lead ? 'bg-emerald-100 text-emerald-800' : on ? 'bg-gradient-to-r from-[#A3E635] to-[#84CC16] text-[#0B0F0D]' : 'bg-stone-100 text-stone-600')}>
                      {lead || on ? <Check className="w-5 h-5 stroke-[2.5]" /> : <Icon className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="font-extrabold text-stone-900 text-sm">{type}</div>
                      <div className="text-xs text-stone-500 leading-relaxed mt-0.5">{info.blurb}</div>
                      {lead && (
                        <div className="text-[11px] text-emerald-800 font-bold mt-1.5 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 stroke-[3]" /> Requested · {lead.lead_no} · {lead.status.replace('_', ' ').toLowerCase()}
                        </div>
                      )}
                    </div>
                  </button>
                  {on && !lead && (
                    <textarea
                      rows={2}
                      value={selected[type]}
                      onChange={(e) => setSelected((prev) => ({ ...prev, [type]: e.target.value }))}
                      placeholder={info.placeholder}
                      className="mt-3 w-full text-xs border border-stone-200 rounded-xl p-2.5 outline-none focus:border-[#84CC16] focus:ring-1 focus:ring-[#84CC16] resize-none bg-[#FAFBF9]"
                    />
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Confirmations — required before payment */}
        <section className="bg-white rounded-3xl border border-[#E5ECE7] shadow-xs p-6 sm:p-7 mb-6">
          <h2 className="font-bold text-stone-900 text-lg font-serif flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-[#059669]" /> Before you pay</h2>
          <p className="text-sm text-stone-600 mb-4">These let our team start on schedule once your payment is recorded.</p>
          <div className="space-y-3">
            {CONFIRMATIONS.map((c) => (
              <label key={c.key} className="flex items-start gap-3 text-sm text-stone-700 cursor-pointer select-none">
                <input type="checkbox" checked={!!confirmations[c.key]}
                  onChange={(e) => setConfirmations((prev) => ({ ...prev, [c.key]: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 rounded accent-[#84CC16]" />
                <span className="font-medium">{c.label}</span>
              </label>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-4 mt-5">
            <label className="block">
              <span className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">Site accessible from *</span>
              <input type="date" min={today} value={siteAccessFrom} onChange={(e) => setSiteAccessFrom(e.target.value)}
                className="w-full border border-stone-200 rounded-xl p-2.5 text-sm focus:border-[#84CC16] focus:ring-1 focus:ring-[#84CC16] outline-none bg-[#FAFBF9]" />
            </label>
            <label className="block">
              <span className="block text-xs font-bold text-stone-600 uppercase tracking-wider mb-1">Anything we should know?</span>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Society work timings, lift booking…"
                className="w-full border border-stone-200 rounded-xl p-2.5 text-sm focus:border-[#84CC16] focus:ring-1 focus:ring-[#84CC16] outline-none bg-[#FAFBF9]" />
            </label>
          </div>
        </section>

        {/* Billing identity — feedback 1.3 */}
        <section className="bg-white rounded-3xl border border-[#E5ECE7] shadow-xs p-6 sm:p-7 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex gap-3">
            <Receipt className="w-5 h-5 text-stone-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <div className="font-bold text-stone-900">
                Invoice to {quotation?.billing?.company_name || quotation?.billing?.name || billing?.name || 'you'}
              </div>
              {quotation?.gst_number ? (
                <div className="text-stone-600 font-mono text-xs mt-0.5">GSTIN {quotation.gst_number}</div>
              ) : billing?.gst_number ? (
                <div className="text-amber-700 text-xs mt-0.5 font-medium">
                  Your profile has GSTIN {billing.gst_number}, but this quotation was issued without it — regenerate the quotation to include it.
                </div>
              ) : (
                <div className="text-stone-500 text-xs mt-0.5">No GSTIN — add one if you need to claim input tax credit.</div>
              )}
            </div>
          </div>
          <Link href={`/profile/billing?next=${encodeURIComponent(`/checkout/${projectId}`)}`}
            className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 hover:border-[#84CC16] hover:bg-stone-50 font-bold text-xs whitespace-nowrap transition">
            {billing?.gst_number ? 'Edit billing details' : 'Add GST details'}
          </Link>
        </section>

        <div className="flex justify-end">
          <button onClick={continueToPayment} disabled={saving || !allConfirmed}
            className="btn-lime px-8 py-3.5 text-sm font-extrabold flex items-center gap-2 shadow-md disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? 'Saving…' : <>Continue to payment <ArrowRight className="w-4 h-4 stroke-[3]" /></>}
          </button>
        </div>
      </div>
    </div>
  )
}
