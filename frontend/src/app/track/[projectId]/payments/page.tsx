'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCustomerStore } from '@/stores/customerStore'
import Navbar from '@/components/Navbar'
import { ArrowLeft, CreditCard, Download, ShieldCheck, CheckCircle2, Clock, HelpCircle, X } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function ProjectPaymentsPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const {
    projectPayments,
    fetchProjectPayments,
    payMilestone,
    isLoading,
    error,
    clearError
  } = useCustomerStore()

  const [checkoutMilestone, setCheckoutMilestone] = useState<any | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'upi' | 'netbanking'>('card')
  const [processingPayment, setProcessingPayment] = useState(false)

  // Card input states
  const [cardNumber, setCardNumber] = useState('4111 2222 3333 4444')
  const [cardExpiry, setCardExpiry] = useState('12/28')
  const [cardCvv, setCardCvv] = useState('123')

  useEffect(() => {
    fetchProjectPayments(projectId)
  }, [projectId])

  const formatINR = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  const handlePay = async () => {
    if (!checkoutMilestone) return
    setProcessingPayment(true)
    try {
      await payMilestone(projectId, checkoutMilestone.name, checkoutMilestone.amount)
      toast.success(`Payment of ${formatINR(checkoutMilestone.amount)} successful! ✨`)
      setCheckoutMilestone(null)
    } catch (e: any) {
      toast.error(e.message || 'Payment failed')
    } finally {
      setProcessingPayment(false)
    }
  }

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 pt-24 pb-16 space-y-6">
        {/* Back navigation */}
        <button onClick={() => router.back()} className="btn-ghost flex items-center gap-1 text-slate-500 font-bold text-xs hover:text-slate-800 transition">
          <ArrowLeft className="w-4 h-4" /> Back to Tracking
        </button>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Milestone Payments</h1>
            <p className="text-xs text-slate-500 mt-1">Track contract transactions, pay milestone advances, and view payment receipts.</p>
          </div>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold text-[10px] uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" /> Secured by SSL
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Contract Value', value: projectPayments?.contractValue ?? 0, color: 'text-slate-850 bg-white border-slate-100' },
            { label: 'Total Paid', value: projectPayments?.totalPaid ?? 0, color: 'text-emerald-600 bg-white border-slate-100' },
            { label: 'Pending Balance', value: projectPayments?.pendingAmount ?? 0, color: 'text-indigo-600 bg-white border-slate-100' },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm relative overflow-hidden">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">{card.label}</span>
              <span className={clsx('text-2.5xl font-black block', card.color)}>{formatINR(card.value)}</span>
            </div>
          ))}
        </div>

        {/* Timeline of Milestones */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
          <h3 className="font-extrabold text-slate-800 text-base">Payment Milestones Checklist</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="pb-3">Stage</th>
                  <th className="pb-3 text-right">Amount</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">TXN Reference</th>
                  <th className="pb-3 text-right">Documents</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
                {projectPayments?.milestones?.map((m: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition">
                    <td className="py-4">
                      <div>
                        <div className="font-bold text-slate-800">{m.name}</div>
                        {m.date && <div className="text-[10px] text-slate-400 font-normal mt-0.5">Paid on: {new Date(m.date).toLocaleDateString()}</div>}
                      </div>
                    </td>
                    <td className="py-4 text-right font-extrabold text-slate-850">
                      {formatINR(m.amount)}
                    </td>
                    <td className="py-4">
                      <span className={clsx(
                        'px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border flex items-center gap-1 w-fit',
                        m.status === 'paid'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : 'bg-amber-50 text-amber-700 border-amber-100'
                      )}>
                        {m.status === 'paid' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {m.status}
                      </span>
                    </td>
                    <td className="py-4 font-mono text-[10px] text-slate-400">
                      {m.transactionId ?? '—'}
                    </td>
                    <td className="py-4 text-right space-x-1.5">
                      {m.status === 'paid' ? (
                        <div className="flex justify-end gap-1.5">
                          {m.invoiceUrl && (
                            <a
                              href={`${API_BASE_URL}${m.invoiceUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-850 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition"
                            >
                              <Download className="w-3 h-3" /> Invoice
                            </a>
                          )}
                          {m.receiptUrl && (
                            <a
                              href={`${API_BASE_URL}${m.receiptUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition"
                            >
                              <Download className="w-3 h-3" /> Receipt
                            </a>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => setCheckoutMilestone(m)}
                          className="text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-1.5 rounded-lg shadow-sm hover:shadow transition"
                        >
                          Pay Advance
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Information Callout */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex gap-3 text-xs text-indigo-900 leading-relaxed font-medium">
          <HelpCircle className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-extrabold block text-indigo-950 mb-0.5">Milestone Structure:</span>
            Booking Advance initiates structural designing. Sourcing begins on 40% production setup advance. Delivery advance prepares dispatch validation. Handover is released upon final sign-off.
          </div>
        </div>
      </div>

      {/* Sleek Mockup Checkout Modal */}
      {checkoutMilestone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setCheckoutMilestone(null)} />
          
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden relative z-10 p-6 space-y-6">
            <button
              onClick={() => setCheckoutMilestone(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Complete Payment</h2>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                Milestone: {checkoutMilestone.name}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center justify-between">
              <span className="text-xs font-bold text-slate-650">Amount Payable</span>
              <span className="text-xl font-black text-indigo-650">{formatINR(checkoutMilestone.amount)}</span>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-3 gap-2">
              {(['card', 'upi', 'netbanking'] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={clsx(
                    'py-2 px-1 rounded-xl text-[10px] font-bold text-center border-2 capitalize transition',
                    paymentMethod === method
                      ? 'border-indigo-500 bg-indigo-50/50 text-indigo-700'
                      : 'border-slate-100 hover:border-slate-200 text-slate-500'
                  )}
                >
                  {method}
                </button>
              ))}
            </div>

            {/* Subforms based on method */}
            {paymentMethod === 'card' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Card Number</label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 font-bold tracking-widest text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Expiry</label>
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg p-2.5 font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">CVV</label>
                    <input
                      type="password"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg p-2.5 font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50"
                    />
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === 'upi' && (
              <div className="space-y-2 text-center py-2 bg-slate-50 border border-slate-100 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Scan QR or enter VPA</span>
                <div className="w-24 h-24 bg-slate-200 rounded-lg mx-auto flex items-center justify-center text-[10px] font-bold text-slate-400 border border-slate-300">
                  MOCK QR CODE
                </div>
                <span className="text-xs font-bold text-slate-700">pay@interiorai</span>
              </div>
            )}

            {paymentMethod === 'netbanking' && (
              <div className="space-y-2">
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Select Bank</label>
                <select className="w-full text-xs border border-slate-200 rounded-lg p-2.5 font-bold text-slate-700 bg-slate-50">
                  <option>State Bank of India</option>
                  <option>HDFC Bank</option>
                  <option>ICICI Bank</option>
                  <option>Axis Bank</option>
                </select>
              </div>
            )}

            <button
              onClick={handlePay}
              disabled={processingPayment}
              className="w-full py-3 bg-indigo-650 hover:bg-indigo-750 text-white font-extrabold rounded-xl text-xs shadow-glow-indigo transition flex items-center justify-center gap-1.5"
            >
              {processingPayment ? (
                <><div className="spinner w-4 h-4 border-white" /> Processing…</>
              ) : (
                <><CreditCard className="w-4 h-4" /> Pay {formatINR(checkoutMilestone.amount)} Secured</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
