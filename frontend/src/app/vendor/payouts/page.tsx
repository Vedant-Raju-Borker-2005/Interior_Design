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
          <h1 className="text-2xl font-black text-[#161D1A] tracking-tight">Payouts Overview</h1>
          <p className="text-xs text-stone-500 mt-0.5">Track your project earnings, processed invoices, and pending milestones settlement.</p>
        </div>
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/60 text-[#059669] font-bold text-[10px] uppercase tracking-wider">
          <Landmark className="w-4 h-4 text-[#059669]" /> Bank Transfer Active
        </span>
      </div>

      {/* KPI Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Paid Earnings', value: paid, color: 'text-[#059669]', desc: 'Settled to your bank account' },
          { label: 'Processing', value: processing, color: 'text-[#161D1A]', desc: 'In clearance pipeline' },
          { label: 'Pending Settl.', value: pending, color: 'text-amber-700', desc: 'Logged on installation' },
          { label: 'Lifetime Revenue', value: lifetime, color: 'text-[#161D1A]', desc: 'All earnings recorded' }
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl p-5 border border-[#E5ECE7] shadow-xs relative overflow-hidden">
            <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider block mb-1">{card.label}</span>
            <span className={clsx('text-2.5xl font-black block', card.color)}>{formatINR(card.value)}</span>
            <span className="text-[10px] text-stone-400 font-medium block mt-1">{card.desc}</span>
          </div>
        ))}
      </div>

      {/* Payout records timeline checklist */}
      <div className="bg-white rounded-2xl border border-[#E5ECE7] shadow-xs p-6 space-y-6">
        <h3 className="font-extrabold text-[#161D1A] text-base">Settlement Log</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E5ECE7] text-stone-500 font-bold uppercase tracking-wider bg-[#F4F6F4]">
                <th className="py-2.5 px-3">Payout ID / Date</th>
                <th className="py-2.5 px-3">Project Source</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Statements</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5ECE7] font-semibold text-stone-700">
              {payouts?.payouts?.map((p: any, idx: number) => (
                <tr key={p.id || idx} className="hover:bg-[#FAFBF9] transition">
                  <td className="py-4 px-3">
                    <div>
                      <div className="font-mono text-[10px] text-stone-500 truncate max-w-[120px]">{(p.id || '').toUpperCase()}</div>
                      <div className="text-[9px] text-stone-400 font-normal mt-0.5">
                        Logged: {new Date(p.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-3 font-bold text-[#161D1A]">{p.projectName}</td>
                  <td className="py-4 px-3 text-right font-extrabold text-[#161D1A]">
                    {formatINR(p.amount)}
                  </td>
                  <td className="py-4 px-3">
                    <span className={clsx(
                      'px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border flex items-center gap-1 w-fit',
                      p.status === 'PAID' ? 'bg-emerald-50 text-emerald-800 border-emerald-200/60' :
                      p.status === 'PROCESSING' ? 'bg-stone-100 text-stone-800 border-stone-200' :
                      'bg-amber-50 text-amber-800 border-amber-200'
                    )}>
                      {p.status === 'PAID' ? <CheckCircle2 className="w-3 h-3 text-[#059669]" /> : <Clock className="w-3 h-3" />}
                      {p.status}
                    </span>
                  </td>
                  <td className="py-4 px-3 text-right">
                    <a
                      href={p.statementUrl || `mailto:billing@interiorai.in?subject=Statement Request for Payout ID: ${p.id}`}
                      className="text-[10px] font-bold text-[#059669] hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 transition border border-emerald-200/60"
                    >
                      <Download className="w-3 h-3" /> Statement
                    </a>
                  </td>
                </tr>
              ))}

              {(!payouts?.payouts || payouts.payouts.length === 0) && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-stone-400 font-semibold">
                    No payouts logged yet. Payouts are spawned automatically when installation items status changes to INSTALLED.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Information guidelines */}
      <div className="bg-[#FAFBF9] border border-[#E5ECE7] rounded-2xl p-4 flex gap-3 text-xs text-stone-700 leading-relaxed font-medium">
        <HelpCircle className="w-5 h-5 text-[#059669] flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-extrabold block text-[#161D1A] mb-0.5">Billing Settlement Guideline:</span>
          Earnings are registered in PENDING status as soon as assignments status is marked as INSTALLED by design coordinators. Net-30 clearance clears pending to PAID via direct NEFT transaction.
        </div>
      </div>
    </div>
  )
}
