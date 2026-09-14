'use client'

/**
 * Consultant portal — stakeholder feedback 5.4, 5.5, 5.7.
 *
 * A partner consultant sees only the leads assigned to them, moves each one
 * through its stages (so the admin never has to chase an update) and sees what
 * they have earned after the platform's commission.
 */
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { Briefcase, Phone, Mail, MapPin, ChevronRight, Wallet, CheckCircle2, Loader2 } from 'lucide-react'
import Navbar from '@/components/Navbar'
import { useAuthStore } from '@/stores/authStore'
import { specialServicesAPI } from '@/lib/api'

const FLOW = ['ASSIGNED', 'CONTACTED', 'IN_PROGRESS', 'COMPLETED'] as const
const LABEL: Record<string, string> = {
  NEW: 'New', ASSIGNED: 'Assigned to you', CONTACTED: 'Customer contacted',
  IN_PROGRESS: 'Work in progress', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
}
const NEXT_ACTION: Record<string, string> = {
  ASSIGNED: 'Mark contacted', CONTACTED: 'Start work', IN_PROGRESS: 'Mark completed',
}

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0)

export default function ConsultantPortalPage() {
  const router = useRouter()
  const { isLoggedIn } = useAuthStore()
  const [leads, setLeads] = useState<any[]>([])
  const [ledger, setLedger] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [noProfile, setNoProfile] = useState(false)
  const [filter, setFilter] = useState<'active' | 'completed' | 'all'>('active')
  const [drafts, setDrafts] = useState<Record<string, { note: string; value: string }>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [l, e] = await Promise.all([specialServicesAPI.leads(), specialServicesAPI.earnings()])
      setLeads(l.data.leads || [])
      setLedger(e.data)
      setNoProfile(false)
    } catch (err: any) {
      if (err?.response?.status === 403) setNoProfile(true)
      else if (err?.response?.status === 401) router.push('/login')
      else toast.error(err?.response?.data?.detail || 'Could not load your leads')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (!isLoggedIn) { router.push('/login'); return }
    load()
  }, [isLoggedIn, load, router])

  const draft = (id: string) => drafts[id] || { note: '', value: '' }

  const advance = async (lead: any, status: string) => {
    const d = draft(lead.id)
    if (status === 'COMPLETED' && !(Number(d.value) > 0) && !(lead.service_value > 0)) {
      toast.error('Enter the final service value so commission can be calculated')
      return
    }
    setBusy(lead.id)
    try {
      await specialServicesAPI.updateStatus(lead.id, {
        status,
        note: d.note || undefined,
        service_value: d.value ? Number(d.value) : undefined,
      })
      toast.success(`${lead.lead_no}: ${LABEL[status]}`)
      setDrafts((prev) => ({ ...prev, [lead.id]: { note: '', value: '' } }))
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Update failed')
    } finally {
      setBusy(null)
    }
  }

  const visible = leads.filter((l) =>
    filter === 'all' ? true : filter === 'completed' ? l.status === 'COMPLETED' : !['COMPLETED', 'CANCELLED'].includes(l.status),
  )
  const s = ledger?.summary || {}

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 pt-24 pb-16">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center"><Briefcase className="w-6 h-6" /></div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Consultant workspace</h1>
            <p className="text-sm text-slate-500">Leads referred to you by InteriorAI. Keep the status current — it is what the platform team sees.</p>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl p-10 text-center text-slate-400 flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : noProfile ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-slate-200">
            <h2 className="font-bold text-slate-800">No consultant profile on this account</h2>
            <p className="text-sm text-slate-500 mt-1">Ask the InteriorAI team to onboard you as a partner consultant using this email or phone number.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Kpi label="Active leads" value={String(leads.filter((l) => !['COMPLETED', 'CANCELLED'].includes(l.status)).length)} />
              <Kpi label="Completed" value={String(s.completed_leads ?? 0)} />
              <Kpi label="Your earnings" value={inr(s.consultant_payout)} tone="text-emerald-600" />
              <Kpi label="Awaiting payout" value={inr(s.unpaid_payout)} tone="text-amber-600" />
            </div>

            <div className="flex gap-2 mb-4">
              {(['active', 'completed', 'all'] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={clsx('px-3 py-1.5 rounded-full text-xs font-bold border capitalize',
                    filter === f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200')}>
                  {f}
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center text-slate-500 border border-slate-200">
                {filter === 'active' ? 'No active leads right now.' : 'Nothing here yet.'}
              </div>
            ) : (
              <div className="space-y-4">
                {visible.map((lead) => {
                  const stepIdx = FLOW.indexOf(lead.status)
                  const nextStatus = stepIdx >= 0 && stepIdx < FLOW.length - 1 ? FLOW[stepIdx + 1] : null
                  const d = draft(lead.id)
                  return (
                    <div key={lead.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                      <div className="flex flex-wrap justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-500">{lead.lead_no}</span>
                            <span className="px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 text-[11px] font-bold">{lead.service_type}</span>
                          </div>
                          <h3 className="font-bold text-slate-900 mt-1">{lead.customer_name || 'Customer'}</h3>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                            {lead.customer_phone && <a href={`tel:${lead.customer_phone}`} className="flex items-center gap-1 hover:text-cyan-700"><Phone className="w-3 h-3" /> {lead.customer_phone}</a>}
                            {lead.customer_email && <a href={`mailto:${lead.customer_email}`} className="flex items-center gap-1 hover:text-cyan-700"><Mail className="w-3 h-3" /> {lead.customer_email}</a>}
                            {lead.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {lead.city}</span>}
                          </div>
                        </div>
                        <div className="text-right">
                          {lead.service_value > 0 && (
                            <>
                              <div className="text-sm font-bold text-slate-800">{inr(lead.service_value)}</div>
                              <div className="text-[11px] text-slate-500">You receive {inr(lead.consultant_payout)} · {lead.commission_rate}% commission</div>
                              {lead.status === 'COMPLETED' && (
                                <div className={clsx('text-[11px] font-bold mt-0.5', lead.payout_status === 'PAID' ? 'text-emerald-600' : 'text-amber-600')}>
                                  Payout {lead.payout_status === 'PAID' ? 'paid' : 'pending'}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {lead.requirements && (
                        <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-3 py-2 mt-3">{lead.requirements}</p>
                      )}

                      {/* Stage tracker */}
                      <div className="flex items-center gap-1 mt-4">
                        {FLOW.map((st, i) => (
                          <div key={st} className="flex items-center gap-1 flex-1">
                            <div className={clsx('h-1.5 rounded-full flex-1', i <= stepIdx ? 'bg-cyan-500' : 'bg-slate-200')} />
                            <span className={clsx('text-[10px] font-bold whitespace-nowrap', i <= stepIdx ? 'text-cyan-700' : 'text-slate-400')}>
                              {LABEL[st].replace(' to you', '')}
                            </span>
                          </div>
                        ))}
                      </div>

                      {nextStatus && (
                        <div className="mt-4 grid sm:grid-cols-12 gap-2 items-center">
                          <input value={d.note} placeholder="Update note for the platform team (optional)"
                            onChange={(e) => setDrafts((p) => ({ ...p, [lead.id]: { ...d, note: e.target.value } }))}
                            className={clsx('border border-slate-200 rounded-xl p-2.5 text-sm', nextStatus === 'COMPLETED' ? 'sm:col-span-6' : 'sm:col-span-9')} />
                          {nextStatus === 'COMPLETED' && (
                            <input type="number" min={0} value={d.value} placeholder={lead.service_value ? String(lead.service_value) : 'Final value ₹'}
                              onChange={(e) => setDrafts((p) => ({ ...p, [lead.id]: { ...d, value: e.target.value } }))}
                              className="sm:col-span-3 border border-slate-200 rounded-xl p-2.5 text-sm" />
                          )}
                          <button disabled={busy === lead.id} onClick={() => advance(lead, nextStatus)}
                            className="sm:col-span-3 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-bold flex items-center justify-center gap-1 disabled:opacity-60">
                            {busy === lead.id ? <Loader2 className="w-4 h-4 animate-spin" /> : nextStatus === 'COMPLETED' ? <CheckCircle2 className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            {NEXT_ACTION[lead.status]}
                          </button>
                        </div>
                      )}

                      {lead.events?.length > 0 && (
                        <details className="mt-3 text-xs text-slate-500">
                          <summary className="cursor-pointer font-semibold">History ({lead.events.length})</summary>
                          <ol className="mt-2 space-y-1">
                            {lead.events.map((ev: any, i: number) => (
                              <li key={i}>{ev.at ? new Date(ev.at).toLocaleString('en-IN') : ''} — <span className="font-semibold">{LABEL[ev.status] || ev.status}</span>{ev.note ? `: ${ev.note}` : ''}</li>
                            ))}
                          </ol>
                        </details>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {(ledger?.by_consultant || []).length > 0 && (
              <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-3 text-sm text-slate-600">
                <Wallet className="w-5 h-5 text-slate-400" />
                Lifetime: {inr(s.gross_service_value)} of work delivered · {inr(s.consultant_payout)} earned · {inr(s.platform_earning)} platform commission
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</div>
      <div className={clsx('text-xl font-black mt-1', tone || 'text-slate-900')}>{value}</div>
    </div>
  )
}
