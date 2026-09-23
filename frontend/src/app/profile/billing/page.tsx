'use client'

/**
 * GST & billing details — stakeholder feedback 1.3.
 *
 * What is saved here is frozen onto every quotation generated afterwards, so an
 * issued quotation keeps showing exactly what was invoiced.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowLeft, Building2, CheckCircle2, Receipt } from 'lucide-react'
import Navbar from '@/components/Navbar'
import { billingAPI, type BillingDetails } from '@/lib/api'

// Same rules the API enforces: state code, PAN, entity digit, 'Z', checksum.
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/

const STATES = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
  'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal',
]

const EMPTY: BillingDetails = {
  gst_number: '', company_name: '', pan_number: '', billing_address: '',
  billing_city: '', billing_state: '', billing_pincode: '',
}

export default function BillingDetailsPage() {
  const router = useRouter()
  const [form, setForm] = useState<BillingDetails>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [next, setNext] = useState<string | null>(null)

  useEffect(() => {
    setNext(new URLSearchParams(window.location.search).get('next'))
    billingAPI.get()
      .then((r) => {
        const d = r.data || {}
        setForm({
          gst_number: d.gst_number || '', company_name: d.company_name || '', pan_number: d.pan_number || '',
          billing_address: d.billing_address || '', billing_city: d.billing_city || d.city || '',
          billing_state: d.billing_state || '', billing_pincode: d.billing_pincode || '',
        })
      })
      .catch(() => toast.error('Please sign in to manage billing details'))
      .finally(() => setLoading(false))
  }, [])

  const set = (key: keyof BillingDetails, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const gst = (form.gst_number || '').toUpperCase().replace(/\s/g, '')
  const pan = (form.pan_number || '').toUpperCase().replace(/\s/g, '')
  const gstError = gst && !GSTIN.test(gst) ? 'GSTIN should be 15 characters, e.g. 27AAPFU0939F1ZV' : ''
  const panError = pan && !PAN.test(pan) ? 'PAN should look like AAPFU0939F' : ''
  const pinError = form.billing_pincode && !/^[1-9][0-9]{5}$/.test(form.billing_pincode) ? 'Enter a 6-digit PIN code' : ''
  const panMismatch = gst && pan && GSTIN.test(gst) && PAN.test(pan) && gst.slice(2, 12) !== pan
    ? 'This PAN does not match the one inside your GSTIN' : ''

  const save = async () => {
    if (gstError || panError || pinError) {
      toast.error('Please fix the highlighted fields')
      return
    }
    setSaving(true)
    try {
      const r = await billingAPI.update({ ...form, gst_number: gst || null, pan_number: pan || null })
      setForm((f) => ({ ...f, pan_number: r.data.pan_number || f.pan_number }))
      toast.success('Billing details saved')
      if (next) router.push(next)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Could not save billing details')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-24 pb-16">
        <button onClick={() => (next ? router.push(next) : router.back())} className="btn-ghost mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="bg-white rounded-2xl shadow-card p-6 md:p-8">
          <div className="flex items-start gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">GST & billing details</h1>
              <p className="text-sm text-slate-500 mt-1">
                Printed on your quotations. Add a GSTIN if you want to claim input tax credit; individuals can leave it blank.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center text-slate-400 text-sm">Loading…</div>
          ) : (
            <div className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="GSTIN" hint="Optional" error={gstError} ok={!!gst && !gstError}>
                  <input value={form.gst_number || ''} onChange={(e) => set('gst_number', e.target.value.toUpperCase())}
                    maxLength={15} placeholder="27AAPFU0939F1ZV" className="input font-mono uppercase" />
                </Field>
                <Field label="PAN" hint={gst && !gstError ? 'Filled from GSTIN if left blank' : 'Optional'} error={panError || panMismatch}>
                  <input value={form.pan_number || ''} onChange={(e) => set('pan_number', e.target.value.toUpperCase())}
                    maxLength={10} placeholder="AAPFU0939F" className="input font-mono uppercase" />
                </Field>
              </div>

              <Field label="Company / billing name" hint="As registered for GST">
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                  <input value={form.company_name || ''} onChange={(e) => set('company_name', e.target.value)}
                    placeholder="Leave blank to bill in your own name" className="input !pl-10" />
                </div>
              </Field>

              <Field label="Billing address">
                <textarea value={form.billing_address || ''} onChange={(e) => set('billing_address', e.target.value)}
                  rows={2} className="input resize-none" placeholder="Flat / building, street, area" />
              </Field>

              <div className="grid sm:grid-cols-3 gap-4">
                <Field label="City">
                  <input value={form.billing_city || ''} onChange={(e) => set('billing_city', e.target.value)} className="input" />
                </Field>
                <Field label="State">
                  <select value={form.billing_state || ''} onChange={(e) => set('billing_state', e.target.value)} className="input">
                    <option value="">Select…</option>
                    {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="PIN code" error={pinError}>
                  <input value={form.billing_pincode || ''} onChange={(e) => set('billing_pincode', e.target.value.replace(/\D/g, ''))}
                    maxLength={6} inputMode="numeric" className="input" />
                </Field>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button onClick={save} disabled={saving} className="btn-primary px-6 py-3 disabled:opacity-60">
                  {saving ? 'Saving…' : next ? 'Save and continue' : 'Save details'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <style jsx>{`
        :global(.input) {
          width: 100%;
          border: 1px solid rgb(226 232 240);
          border-radius: 0.75rem;
          padding: 0.6rem 0.75rem;
          font-size: 0.875rem;
          background: white;
          outline: none;
        }
        :global(.input:focus) {
          border-color: rgb(99 102 241);
          box-shadow: 0 0 0 3px rgb(99 102 241 / 0.15);
        }
      `}</style>
    </div>
  )
}

function Field({ label, hint, error, ok, children }: {
  label: string; hint?: string; error?: string; ok?: boolean; children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="flex justify-between items-baseline mb-1">
        <span className="text-xs font-semibold text-slate-600">{label}</span>
        {hint && !error && <span className="text-[11px] text-slate-400">{hint}</span>}
      </span>
      {children}
      {error ? (
        <span className="block text-[11px] text-rose-600 mt-1">{error}</span>
      ) : ok ? (
        <span className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Valid format</span>
      ) : null}
    </label>
  )
}
