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
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'upi' | 'netbanking' | 'offline'>('card')
  const [offlineRef, setOfflineRef] = useState('')
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
      if (paymentMethod === 'offline') {
        const res = await fetch(`/api/v1/customer/projects/${projectId}/payments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          },
          body: JSON.stringify({
            milestoneName: checkoutMilestone.name,
            amount: checkoutMilestone.amount,
            payment_mode: 'offline',
            reference: offlineRef || `OFFLINE-${Date.now()}`
          })
        })
        if (!res.ok) throw new Error('Offline payment request failed')
        toast.success(`Offline Payment request of ${formatINR(checkoutMilestone.amount)} recorded! ✨`)
      } else {
        await payMilestone(projectId, checkoutMilestone.name, checkoutMilestone.amount)
        toast.success(`Payment of ${formatINR(checkoutMilestone.amount)} successful! ✨`)
      }
      setCheckoutMilestone(null)
    } catch (e: any) {
      toast.error(e.message || 'Payment failed')
    } finally {
      setProcessingPayment(false)
    }
  }

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  // Feedback 1.11 — B2C pays the quotation in full; only bulk (B2B) work keeps milestones.
  const isFullPayment = projectPayments?.paymentModel !== 'MILESTONE'
  const offline = projectPayments?.offlinePayment
  const reference = projectPayments?.quotationNo

  return (
    <div className="min-h-screen bg-[#FAFBF9] text-[#161D1A]">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 pt-24 pb-16 space-y-6">
        {/* Back navigation */}
        <button onClick={() => router.back()} className="btn-ghost flex items-center gap-1 text-stone-600 font-bold text-xs hover:text-stone-900 transition">
          <ArrowLeft className="w-4 h-4" /> Back to Tracking
        </button>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-stone-900 tracking-tight font-serif">{isFullPayment ? 'Payment' : 'Milestone Payments'}</h1>
            <p className="text-xs text-stone-500 mt-1">
              {isFullPayment
                ? 'Your interiors are booked once the full quotation amount is received.'
                : 'Track contract transactions, pay milestone advances, and view payment receipts.'}
            </p>
          </div>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-800 font-bold text-[10px] uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Secured by SSL
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Contract Value', value: projectPayments?.contractValue ?? 0, color: 'text-stone-900 font-serif' },
            { label: 'Total Paid', value: projectPayments?.totalPaid ?? 0, color: 'text-[#059669] font-serif' },
            { label: 'Pending Balance', value: projectPayments?.pendingAmount ?? 0, color: 'text-stone-700 font-serif' },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-3xl p-5 border border-[#E5ECE7] shadow-xs relative overflow-hidden">
              <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block mb-1">{card.label}</span>
              <span className={clsx('text-2xl font-black block', card.color)}>{formatINR(card.value)}</span>
            </div>
          ))}
        </div>

        {/* Timeline of Milestones */}
        <div className="bg-white rounded-3xl border border-[#E5ECE7] shadow-xs p-6 sm:p-7 space-y-6">
          <h3 className="font-extrabold text-stone-900 text-base font-serif">{isFullPayment ? 'Amount due' : 'Payment Milestones Checklist'}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E5ECE7] text-stone-500 font-bold uppercase tracking-wider pb-3">
                  <th className="pb-3">Stage</th>
                  <th className="pb-3 text-right">Amount</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">TXN Reference</th>
                  <th className="pb-3 text-right">Documents</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-semibold text-stone-700">
                {projectPayments?.milestones?.map((m: any, idx: number) => (
                  <tr key={idx} className="hover:bg-[#FAFBF9] transition">
                    <td className="py-4">
                      <div>
                        <div className="font-bold text-stone-900">{m.name}</div>
                        {m.date && <div className="text-[10px] text-stone-400 font-normal mt-0.5">Paid on: {new Date(m.date).toLocaleDateString()}</div>}
                      </div>
                    </td>
                    <td className="py-4 text-right font-black text-stone-900 font-serif">
                      {formatINR(m.amount)}
                    </td>
                    <td className="py-4">
                      <span className={clsx(
                        'px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border flex items-center gap-1 w-fit',
                        m.status === 'paid'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      )}>
                        {m.status === 'paid' ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <Clock className="w-3 h-3 text-amber-600" />}
                        {m.status}
                      </span>
                    </td>
                    <td className="py-4 font-mono text-[10px] text-stone-500">
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
                              className="text-[10px] font-bold text-stone-800 hover:text-[#059669] bg-stone-100 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition"
                            >
                              <Download className="w-3 h-3" /> Invoice
                            </a>
                          )}
                          {m.receiptUrl && (
                            <a
                              href={`${API_BASE_URL}${m.receiptUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition"
                            >
                              <Download className="w-3 h-3" /> Receipt
                            </a>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => setCheckoutMilestone(m)}
                          className="btn-lime text-[11px] font-extrabold px-4 py-2 shadow-sm"
                        >
                          {isFullPayment ? 'Pay online' : 'Pay Advance'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Offline payment */}
        {isFullPayment && (projectPayments?.pendingAmount ?? 0) > 0 && (
          <div className="bg-white rounded-3xl border border-[#E5ECE7] shadow-xs p-6 sm:p-7">
            <h3 className="font-extrabold text-stone-900 text-base mb-1 font-serif">Prefer to pay by bank transfer?</h3>
            <p className="text-xs text-stone-600 mb-4 leading-relaxed">
              Transfer {formatINR(projectPayments?.pendingAmount ?? 0)} and use
              {reference ? <> <span className="font-mono font-bold text-[#059669]">{reference}</span></> : ' your quotation number'} as
              the payment reference. Our team confirms receipt and marks your quotation as paid — you’ll see it here.
            </p>
            {offline?.configured ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs bg-[#FAFBF9] border border-[#E5ECE7] rounded-2xl p-4">
                {[
                  ['Account name', offline.account_name],
                  ['Account number', offline.account_number],
                  ['IFSC', offline.ifsc],
                  ['Bank', offline.bank_name],
                  ['UPI ID', offline.upi_id],
                  ['Reference', reference],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k as string} className="flex justify-between gap-3">
                    <dt className="text-stone-500 font-semibold">{k}</dt>
                    <dd className="font-mono font-bold text-stone-900 select-all">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-xs text-stone-600 bg-[#FAFBF9] border border-[#E5ECE7] rounded-2xl p-4">
                Our team will share the account details with you by phone or email.
              </p>
            )}
          </div>
        )}

        {/* Information Callout */}
        <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-3xl p-5 flex gap-3 text-xs text-stone-700 leading-relaxed font-medium">
          <HelpCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          {isFullPayment ? (
            <div>
              <span className="font-extrabold block text-emerald-950 mb-0.5 font-serif">How payment works:</span>
              Interiors are paid for in full, once. After payment is confirmed, your project is reviewed by our team,
              allocated to a supplier, and your premium photoreal renders are unlocked.
            </div>
          ) : (
            <div>
              <span className="font-extrabold block text-emerald-950 mb-0.5 font-serif">Milestone Structure:</span>
              Booking Advance initiates structural designing. Sourcing begins on 40% production setup advance. Delivery advance prepares dispatch validation. Handover is released upon final sign-off.
            </div>
          )}
        </div>
      </div>

      {/* Sleek Checkout Modal */}
      {checkoutMilestone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={() => setCheckoutMilestone(null)} />
          
          <div className="bg-[#FAFBF9] w-full max-w-md rounded-3xl shadow-2xl border border-[#E5ECE7] overflow-hidden relative z-10 p-6 space-y-6 text-stone-900">
            <button
              onClick={() => setCheckoutMilestone(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-stone-100 text-stone-500 hover:bg-stone-200 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h2 className="text-xl font-extrabold text-stone-900 tracking-tight font-serif">Complete Payment</h2>
              <p className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider mt-0.5">
                Milestone: {checkoutMilestone.name}
              </p>
            </div>

            <div className="bg-white border border-[#E5ECE7] p-4 rounded-2xl flex items-center justify-between">
              <span className="text-xs font-bold text-stone-600">Amount Payable</span>
              <span className="text-xl font-black text-[#059669] font-serif">{formatINR(checkoutMilestone.amount)}</span>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-4 gap-1.5">
              {(['card', 'upi', 'netbanking', 'offline'] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={clsx(
                    'py-2 px-1 rounded-xl text-[10px] font-bold text-center border-2 capitalize transition',
                    paymentMethod === method
                      ? 'border-[#84CC16] bg-emerald-50/50 text-[#132A1C] shadow-2xs'
                      : 'border-[#E5ECE7] hover:border-stone-300 text-stone-600 bg-white'
                  )}
                >
                  {method === 'offline' ? 'Offline / NEFT' : method}
                </button>
              ))}
            </div>

            {/* Subforms based on method */}
            {paymentMethod === 'offline' && (
              <div className="space-y-3 bg-amber-500/5 border border-amber-500/20 p-4 rounded-2xl">
                <div className="text-xs text-amber-900 font-bold">Offline / Bank Transfer Payment</div>
                <p className="text-[11px] text-stone-600 font-medium leading-relaxed">
                  Make your payment directly to our bank account or via UPI, then enter your UTR / Transfer Reference number below.
                </p>
                <div>
                  <label className="block text-[9px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                    Transaction / UTR / Reference No.
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UTR123456789 or NEFT-88921"
                    value={offlineRef}
                    onChange={(e) => setOfflineRef(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-xl p-2.5 font-bold text-stone-800 outline-none focus:border-[#84CC16] focus:ring-1 focus:ring-[#84CC16] bg-white"
                  />
                </div>
              </div>
            )}

            {paymentMethod === 'card' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">Card Number</label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-xl p-2.5 font-bold tracking-widest text-stone-800 outline-none focus:border-[#84CC16] focus:ring-1 focus:ring-[#84CC16] bg-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">Expiry</label>
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      className="w-full text-xs border border-stone-200 rounded-xl p-2.5 font-bold text-stone-800 outline-none focus:border-[#84CC16] focus:ring-1 focus:ring-[#84CC16] bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">CVV</label>
                    <input
                      type="password"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      className="w-full text-xs border border-stone-200 rounded-xl p-2.5 font-bold text-stone-800 outline-none focus:border-[#84CC16] focus:ring-1 focus:ring-[#84CC16] bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === 'upi' && (
              <div className="space-y-2 text-center py-3 bg-white border border-[#E5ECE7] rounded-2xl">
                <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Scan QR or enter VPA</span>
                <div className="w-24 h-24 bg-stone-100 rounded-xl mx-auto flex items-center justify-center text-[10px] font-bold text-stone-400 border border-stone-200">
                  MOCK QR CODE
                </div>
                <span className="text-xs font-bold text-stone-800">pay@interiorai</span>
              </div>
            )}

            {paymentMethod === 'netbanking' && (
              <div className="space-y-2">
                <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">Select Bank</label>
                <select className="w-full text-xs border border-stone-200 rounded-xl p-2.5 font-bold text-stone-800 bg-white">
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
              className="btn-lime w-full py-3 text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-md"
            >
              {processingPayment ? (
                <><div className="spinner w-4 h-4 border-stone-900" /> Processing…</>
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
