'use client'

import { useEffect } from 'react'
import { useVendorStore } from '@/stores/vendorStore'
import { CreditCard, Download, ShieldCheck, HelpCircle, FileText, CheckCircle2, Clock, Landmark } from 'lucide-react'
import clsx from 'clsx'

export default function VendorPayoutsPage() {
  const { payouts, loadPayouts, loading } = useVendorStore()

  useEffect(() => {
    loadPayouts()
  }, [])

  const formatINR = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  // Totals
  const pending = payouts?.summary?.pending ?? 0
  const processing = payouts?.summary?.processing ?? 0
  const paid = payouts?.summary?.paid ?? 0
  const lifetime = payouts?.summary?.total ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Payouts Overview</h1>
          <p className="text-xs text-slate-500 mt-0.5">Track your project earnings, processed invoices, and pending milestones settlement.</p>
        </div>
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold text-[10px] uppercase tracking-wider">
          <Landmark className="w-4 h-4 text-emerald-650" /> Bank Transfer Active
        </span>
      </div>

      {/* KPI Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Paid Earnings', value: paid, color: 'text-emerald-650 bg-white border-slate-100', desc: 'Settled to your bank account' },
          { label: 'Processing', value: processing, color: 'text-indigo-600 bg-white border-slate-100', desc: 'In clearance pipeline' },
          { label: 'Pending Settl.', value: pending, color: 'text-amber-700 bg-white border-slate-100', desc: 'Logged on installation' },
          { label: 'Lifetime Revenue', value: lifetime, color: 'text-slate-850 bg-white border-slate-100', desc: 'All earnings recorded' }
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm relative overflow-hidden">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">{card.label}</span>
            <span className={clsx('text-2.5xl font-black block', card.color)}>{formatINR(card.value)}</span>
            <span className="text-[10px] text-slate-400 font-medium block mt-1">{card.desc}</span>
          </div>
        ))}
      </div>

      {/* Payout records timeline checklist */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
        <h3 className="font-extrabold text-slate-800 text-base">Settlement Log</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                <th className="pb-3">Payout ID / Date</th>
                <th className="pb-3">Project Source</th>
                <th className="pb-3 text-right">Amount</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Statements</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
              {payouts?.payouts?.map((p: any, idx: number) => (
                <tr key={p.id || idx} className="hover:bg-slate-50/50 transition">
                  <td className="py-4">
                    <div>
                      <div className="font-mono text-[10px] text-slate-500 truncate max-w-[120px]">{(p.id || '').toUpperCase()}</div>
                      <div className="text-[9px] text-slate-400 font-normal mt-0.5">
                        Logged: {new Date(p.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 font-bold text-slate-800">{p.projectName}</td>
                  <td className="py-4 text-right font-extrabold text-slate-850">
                    {formatINR(p.amount)}
                  </td>
                  <td className="py-4">
                    <span className={clsx(
                      'px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border flex items-center gap-1 w-fit',
                      p.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                      p.status === 'PROCESSING' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                      'bg-amber-50 text-amber-700 border-amber-100'
                    )}>
                      {p.status === 'PAID' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {p.status}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <a
                      href={p.statementUrl || `mailto:billing@interiorai.in?subject=Statement Request for Payout ID: ${p.id}`}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-850 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 transition"
                    >
                      <Download className="w-3 h-3" /> Statement
                    </a>
                  </td>
                </tr>
              ))}

              {(!payouts?.payouts || payouts.payouts.length === 0) && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-semibold">
                    No payouts logged yet. Payouts are spawned automatically when installation items status changes to INSTALLED.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Information guidelines */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex gap-3 text-xs text-indigo-900 leading-relaxed font-medium">
        <HelpCircle className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-extrabold block text-indigo-950 mb-0.5">Billing Settlement Guideline:</span>
          Earnings are registered in PENDING status as soon as assignments status is marked as INSTALLED by design coordinators. Net-30 clearance clears pending to PAID via direct NEFT transaction.
        </div>
      </div>
    </div>
  )
}
