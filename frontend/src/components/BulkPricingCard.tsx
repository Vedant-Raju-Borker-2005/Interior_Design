'use client'

/**
 * Unit-wise B2B pricing — stakeholder feedback 2.2, 2.3, 2.4.
 *
 * Shows the original per-unit price next to the discounted one and the saving,
 * the value of each unit (units differ by BHK and customisation), and the total
 * project value. Product prices are never shown altered: the discount is a
 * project-level line.
 */
import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Tag, Building2, Loader2 } from 'lucide-react'
import { approvalsAPI } from '@/lib/api'

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0)

export default function BulkPricingCard({ projectId, data: provided }: { projectId: string; data?: any }) {
  const [data, setData] = useState<any>(provided || null)
  const [loading, setLoading] = useState(!provided)

  useEffect(() => {
    if (provided) { setData(provided); return }
    approvalsAPI.pricing(projectId)
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [projectId, provided])

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-6 flex items-center gap-2 text-xs text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading pricing…
      </div>
    )
  }
  if (!data) return null

  const discounted = data.discount_amount > 0
  const lines: any[] = data.unit_lines || []

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-black text-slate-800 text-lg tracking-tight">Project pricing</h3>
          <p className="text-xs text-slate-500">
            {data.units_priced} of {data.units_total} unit{data.units_total === 1 ? '' : 's'} priced
            {data.units_priced < data.units_total ? ' — remaining units are added as their interiors are specified.' : '.'}
          </p>
        </div>
        {discounted && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
            <Tag className="w-3.5 h-3.5" /> Bulk discount {data.savings_percent ? `· ${data.savings_percent}%` : ''}
          </span>
        )}
      </div>

      {/* 2.2 — original vs discounted, per unit */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Original price / unit</div>
          <div className={clsx('text-xl font-black mt-1', discounted ? 'text-slate-400 line-through' : 'text-slate-800')}>
            {inr(data.original_unit_price)}
          </div>
        </div>
        <div className="rounded-2xl bg-indigo-50 p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">{discounted ? 'Discounted price / unit' : 'Price / unit'}</div>
          <div className="text-xl font-black mt-1 text-indigo-700">{inr(data.discounted_unit_price)}</div>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Savings / unit</div>
          <div className="text-xl font-black mt-1 text-emerald-600">{inr(data.savings_per_unit)}</div>
        </div>
      </div>

      {/* 2.3 — each unit and the project total */}
      {lines.length > 0 && (
        <div className="overflow-x-auto border border-slate-100 rounded-2xl">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="text-left px-4 py-2.5">Unit</th>
                <th className="text-right px-4 py-2.5">Original</th>
                <th className="text-right px-4 py-2.5">Discount</th>
                <th className="text-right px-4 py-2.5">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((l) => (
                <tr key={l.project_id}>
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-slate-800 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-slate-400" /> {l.unit}</div>
                    <div className="text-[11px] text-slate-400">
                      {l.bhk_type}{l.customisation_count ? ` · ${l.customisation_count} customisation${l.customisation_count > 1 ? 's' : ''}` : ''}
                    </div>
                  </td>
                  <td className={clsx('px-4 py-2.5 text-right', l.discount > 0 ? 'text-slate-400 line-through' : 'text-slate-700')}>{inr(l.original_price)}</td>
                  <td className="px-4 py-2.5 text-right text-emerald-600">{l.discount > 0 ? `− ${inr(l.discount)}` : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-slate-900">{inr(l.discounted_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <dl className="text-sm grid grid-cols-2 gap-y-1.5 bg-slate-50 rounded-2xl p-4">
        <dt className="text-slate-500">Project value before discount</dt>
        <dd className="text-right font-semibold text-slate-700">{inr(data.original_total)}</dd>
        {discounted && (<>
          <dt className="text-slate-500">Bulk discount</dt>
          <dd className="text-right font-semibold text-emerald-600">− {inr(data.discount_amount)}</dd>
        </>)}
        <dt className="text-slate-500">GST ({data.gst_rate}%)</dt>
        <dd className="text-right font-semibold text-slate-700">{inr(data.gst_amount)}</dd>
        <dt className="font-bold text-slate-800">Total project value</dt>
        <dd className="text-right font-black text-indigo-700 text-base">{inr(data.grand_total)}</dd>
      </dl>
      {data.discount_note && <p className="text-[11px] text-slate-400">{data.discount_note}</p>}
    </div>
  )
}
