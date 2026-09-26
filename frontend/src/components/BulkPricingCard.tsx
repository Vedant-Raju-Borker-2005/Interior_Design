'use client'

/**
 * Unit-wise B2B pricing & Customization Ledger — stakeholder feedback 2.1, 2.2, 2.3, 2.4.
 *
 * Shows transparent side-by-side pricing (Original per-unit price next to discounted
 * and savings), unit-by-unit customization delta tracking, and project-level bulk discount controls.
 * Product catalog prices remain untouched.
 */
import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Tag, Building2, Loader2, Sliders, Check, Trash2, Search, ChevronDown, ChevronUp, Percent, IndianRupee } from 'lucide-react'
import { approvalsAPI } from '@/lib/api'
import toast from 'react-hot-toast'

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0)

const STATUS_PILLS: Record<string, { bg: string; text: string }> = {
  'Unassigned': { bg: 'bg-slate-100 text-slate-600', text: 'Unassigned' },
  'Not Invited': { bg: 'bg-amber-50 text-amber-700', text: 'Not Invited' },
  'Invited': { bg: 'bg-blue-50 text-blue-700', text: 'Invited' },
  'Onboarding': { bg: 'bg-orange-50 text-orange-700', text: 'Onboarding' },
  'Onboarding Complete': { bg: 'bg-teal-50 text-teal-700', text: 'Onboarded' },
  'Customization': { bg: 'bg-purple-50 text-purple-700', text: 'Customizing' },
  'AI Rendering': { bg: 'bg-pink-50 text-pink-700', text: 'AI Rendering' },
  'Completed': { bg: 'bg-emerald-50 text-emerald-700', text: 'Completed' },
}

export default function BulkPricingCard({
  projectId,
  data: provided,
  allowDiscountConfig = true,
}: {
  projectId: string
  data?: any
  allowDiscountConfig?: boolean
}) {
  const [data, setData] = useState<any>(provided || null)
  const [loading, setLoading] = useState(!provided)

  // Discount configuration drawer
  const [showConfig, setShowConfig] = useState(false)
  const [discountType, setDiscountType] = useState('PERCENT')
  const [discountValue, setDiscountValue] = useState<number | ''>('')
  const [discountNote, setDiscountNote] = useState('')
  const [savingDiscount, setSavingDiscount] = useState(false)

  // Units search / filter
  const [searchQuery, setSearchQuery] = useState('')
  const [showTable, setShowTable] = useState(true)

  const fetchPricing = async () => {
    try {
      const res = await approvalsAPI.pricing(projectId)
      setData(res.data)
      if (res.data.discount_type) {
        setDiscountType(res.data.discount_type)
        setDiscountValue(res.data.discount_value || '')
        setDiscountNote(res.data.discount_note || '')
      }
    } catch (err) {
      console.error("Failed to load project pricing:", err)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (provided) {
      setData(provided)
      if (provided.discount_type) {
        setDiscountType(provided.discount_type)
        setDiscountValue(provided.discount_value || '')
        setDiscountNote(provided.discount_note || '')
      }
      return
    }
    fetchPricing()
  }, [projectId, provided])

  const handleApplyDiscount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (discountValue === '' || Number(discountValue) < 0) {
      toast.error("Please enter a valid positive discount amount.")
      return
    }

    setSavingDiscount(true)
    try {
      const res = await approvalsAPI.setDiscount(projectId, {
        discount_type: discountType,
        discount_value: Number(discountValue),
        note: discountNote.trim() || undefined,
      })
      setData(res.data)
      setShowConfig(false)
      toast.success("Bulk project discount applied successfully! 🎉")
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to apply bulk discount.")
    } finally {
      setSavingDiscount(false)
    }
  }

  const handleClearDiscount = async () => {
    setSavingDiscount(true)
    try {
      const res = await approvalsAPI.clearDiscount(projectId)
      setData(res.data)
      setDiscountValue('')
      setDiscountNote('')
      setShowConfig(false)
      toast.success("Bulk discount removed.")
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to clear discount.")
    } finally {
      setSavingDiscount(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-6 flex items-center gap-2 text-xs text-slate-400 shadow-sm">
        <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> Loading project pricing breakdown…
      </div>
    )
  }
  if (!data) return null

  const discounted = data.discount_amount > 0
  const lines: any[] = data.unit_lines || []

  const filteredLines = lines.filter((l) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      String(l.unit || '').toLowerCase().includes(q) ||
      String(l.flat_number || '').toLowerCase().includes(q) ||
      String(l.bhk_type || '').toLowerCase().includes(q) ||
      String(l.typology_name || '').toLowerCase().includes(q) ||
      String(l.customer_name || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
      
      {/* Header with Title and Savings Pill */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-black text-slate-800 text-lg tracking-tight">Project Bulk Pricing & Ledger</h3>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {data.units_priced} of {data.units_total} unit{data.units_total === 1 ? '' : 's'} itemized
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Transparent unit pricing with base showroom benchmark, customization deltas, and project volume discounts.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {discounted && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black shadow-xs">
              <Tag className="w-3.5 h-3.5" />
              <span>Bulk Discount {data.savings_percent ? `· ${data.savings_percent}%` : ''} ({inr(data.discount_amount)} saved)</span>
            </span>
          )}
          {allowDiscountConfig && (
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className={clsx(
                "px-3.5 py-1.5 text-xs font-bold rounded-xl border flex items-center gap-1.5 transition",
                showConfig
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:text-indigo-650"
              )}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{showConfig ? 'Close Editor' : discounted ? 'Edit Discount' : 'Set Bulk Discount'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Discount Configuration Drawer */}
      {showConfig && (
        <form onSubmit={handleApplyDiscount} className="bg-indigo-50/40 border border-indigo-150 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-indigo-650" /> Configure Project-Level Volume Discount
            </span>
            <span className="text-[11px] text-slate-500 font-medium">Catalog product prices remain unaltered</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Discount Mode
              </label>
              <select
                value={discountType}
                onChange={e => setDiscountType(e.target.value)}
                className="select w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 outline-none"
              >
                <option value="PERCENT">Percentage Discount (%)</option>
                <option value="FLAT_PER_UNIT">Flat Discount Per Unit (₹ / unit)</option>
                <option value="FLAT_TOTAL">Total Lump-Sum Discount (₹ off project)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Discount Value {discountType === 'PERCENT' ? '(%)' : '(₹)'}
              </label>
              <input
                type="number"
                min={0}
                max={discountType === 'PERCENT' ? 100 : undefined}
                required
                value={discountValue}
                onChange={e => setDiscountValue(e.target.value ? Number(e.target.value) : '')}
                placeholder={discountType === 'PERCENT' ? 'e.g. 15' : 'e.g. 100000'}
                className="input w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-bold text-slate-900 outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Agreement Note <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={discountNote}
                onChange={e => setDiscountNote(e.target.value)}
                placeholder="e.g. Volume deal 15% discount for tower units"
                className="input w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-800 outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-indigo-100">
            {discounted && (
              <button
                type="button"
                onClick={handleClearDiscount}
                disabled={savingDiscount}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove Discount
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowConfig(false)}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingDiscount}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" /> {savingDiscount ? 'Applying...' : 'Apply Volume Discount'}
            </button>
          </div>
        </form>
      )}

      {/* 2.2 — Side-by-Side Transparent Pricing (Original vs Discounted vs Savings) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Average Original Price / Unit
          </div>
          <div className={clsx('text-xl font-black mt-1', discounted ? 'text-slate-400 line-through' : 'text-slate-800')}>
            {inr(data.original_unit_price)}
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">Catalog base benchmark</span>
        </div>

        <div className="rounded-2xl bg-indigo-50/80 border border-indigo-150 p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
            {discounted ? 'Discounted Price / Unit' : 'Effective Price / Unit'}
          </div>
          <div className="text-xl font-black mt-1 text-indigo-700">
            {inr(data.discounted_unit_price)}
          </div>
          <span className="text-[10px] text-indigo-500 block mt-0.5">
            {discounted ? `Net after applied volume discount` : `Standard rate per unit`}
          </span>
        </div>

        <div className="rounded-2xl bg-emerald-50/80 border border-emerald-150 p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            Volume Savings / Unit
          </div>
          <div className="text-xl font-black mt-1 text-emerald-600">
            {inr(data.savings_per_unit)}
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">
            {data.savings_percent ? `${data.savings_percent}% net savings per flat` : '0% discount active'}
          </span>
        </div>
      </div>

      {/* 2.3 — Itemized Unit-by-Unit Breakdown Table with Customization Deltas */}
      {lines.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <button
              type="button"
              onClick={() => setShowTable(!showTable)}
              className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 hover:text-indigo-650"
            >
              <span>Unit Customization & Pricing Breakdown ({filteredLines.length} Units)</span>
              {showTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showTable && (
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by flat, BHK, or buyer..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-slate-800"
                />
              </div>
            )}
          </div>

          {showTable && (
            <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3">Flat / Unit</th>
                    <th className="text-left px-3 py-3">BHK</th>
                    <th className="text-right px-3 py-3">Base Price</th>
                    <th className="text-right px-3 py-3">Customization Delta</th>
                    <th className="text-right px-3 py-3">Unit Gross</th>
                    <th className="text-right px-3 py-3">Volume Discount</th>
                    <th className="text-right px-4 py-3">Final Unit Price</th>
                    <th className="text-center px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredLines.map((l, idx) => {
                    const delta = l.customization_delta ?? 0
                    const statusPill = STATUS_PILLS[l.status] || { bg: 'bg-slate-100 text-slate-600', text: l.status }

                    return (
                      <tr key={l.flat_id || l.project_id || idx} className="hover:bg-slate-50/60 transition">
                        <td className="px-4 py-3">
                          <div className="font-extrabold text-slate-850 text-slate-800 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{l.unit}</span>
                            {l.typology_name && (
                              <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded">
                                {l.typology_name}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[140px]">
                            {l.customer_name ? (
                              <span className="text-slate-600 font-semibold">{l.customer_name}</span>
                            ) : (
                              <span className="italic">Unassigned Buyer</span>
                            )}
                          </div>
                        </td>

                        <td className="px-3 py-3 text-slate-600 font-semibold">
                          {l.bhk_type}
                        </td>

                        <td className="px-3 py-3 text-right text-slate-500 font-medium">
                          {inr(l.base_price || l.original_price)}
                        </td>

                        <td className="px-3 py-3 text-right font-bold">
                          {delta > 0 ? (
                            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px]">
                              +{inr(delta)}
                            </span>
                          ) : delta < 0 ? (
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                              −{inr(Math.abs(delta))}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">—</span>
                          )}
                        </td>

                        <td className={clsx('px-3 py-3 text-right font-semibold', l.discount > 0 ? 'text-slate-400 line-through' : 'text-slate-700')}>
                          {inr(l.original_price)}
                        </td>

                        <td className="px-3 py-3 text-right text-emerald-600 font-bold">
                          {l.discount > 0 ? `− ${inr(l.discount)}` : '—'}
                        </td>

                        <td className="px-4 py-3 text-right font-black text-slate-900 text-sm">
                          {inr(l.discounted_price)}
                        </td>

                        <td className="px-3 py-3 text-center">
                          <span className={clsx('inline-block text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider', statusPill.bg)}>
                            {statusPill.text}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Project Total Financials Breakdown */}
      <dl className="text-xs grid grid-cols-2 gap-y-2 bg-slate-50 rounded-2xl p-5 border border-slate-100">
        <dt className="text-slate-500 font-medium">Project Value Before Discount</dt>
        <dd className="text-right font-bold text-slate-800">{inr(data.original_total)}</dd>

        {discounted && (
          <>
            <dt className="text-emerald-700 font-bold flex items-center gap-1">
              <Tag className="w-3 h-3 text-emerald-600" /> Bulk Volume Savings
            </dt>
            <dd className="text-right font-black text-emerald-600">− {inr(data.discount_amount)}</dd>
            <dt className="text-slate-500 font-medium">Net Taxable Project Subtotal</dt>
            <dd className="text-right font-bold text-slate-700">{inr(data.discounted_total)}</dd>
          </>
        )}

        <dt className="text-slate-500 font-medium">GST ({data.gst_rate}%)</dt>
        <dd className="text-right font-bold text-slate-700">{inr(data.gst_amount)}</dd>

        <dt className="font-extrabold text-slate-900 text-sm pt-2 border-t border-slate-200">Total Project Value</dt>
        <dd className="text-right font-black text-indigo-700 text-lg pt-2 border-t border-slate-200">
          {inr(data.grand_total)}
        </dd>
      </dl>

      {data.discount_note && (
        <p className="text-[11px] text-slate-500 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
          <strong>Volume Agreement Note:</strong> {data.discount_note}
        </p>
      )}

    </div>
  )
}
