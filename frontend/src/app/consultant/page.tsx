'use client'

/**
 * Consultant Portal — stakeholder feedback 5.4, 5.5, 5.7
 *
 * Partner consultants log in here to:
 *  • See all leads assigned to them (scoped by their user account)
 *  • Move each lead through its stages (ASSIGNED → CONTACTED → IN_PROGRESS → COMPLETED)
 *  • View what they have earned after the platform commission
 *  • Track payout status per lead
 */
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import {
  Briefcase, Phone, Mail, MapPin, ChevronRight, Wallet,
  CheckCircle2, Loader2, TrendingUp, Clock, Star,
  Send, Activity, DollarSign, AlertCircle, ArrowRight,
  RefreshCw, Eye, ChevronDown, ChevronUp, IndianRupee,
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import { useAuthStore } from '@/stores/authStore'
import { specialServicesAPI } from '@/lib/api'

/* ── constants ────────────────────────────────────────────────────────────── */
const FLOW = ['ASSIGNED', 'CONTACTED', 'IN_PROGRESS', 'COMPLETED'] as const
type FlowStep = typeof FLOW[number]

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  NEW:         { label: 'New',         color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  ASSIGNED:    { label: 'Assigned',    color: 'text-indigo-700',  bg: 'bg-indigo-50',  border: 'border-indigo-200' },
  CONTACTED:   { label: 'Contacted',   color: 'text-sky-700',     bg: 'bg-sky-50',     border: 'border-sky-200' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-200' },
  COMPLETED:   { label: 'Completed',   color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  CANCELLED:   { label: 'Cancelled',   color: 'text-slate-500',   bg: 'bg-slate-100',  border: 'border-slate-200' },
}

const NEXT_LABEL: Record<string, string> = {
  ASSIGNED: 'Mark as Contacted',
  CONTACTED: 'Start Work',
  IN_PROGRESS: 'Mark as Completed',
}

const NEXT_STATUS: Record<FlowStep, FlowStep | undefined> = {
  ASSIGNED: 'CONTACTED',
  CONTACTED: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
  COMPLETED: undefined,
}

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0)

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

const fmtDateTime = (d: string | null) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function ConsultantPortalPage() {
  const router = useRouter()
  const { isLoggedIn, user } = useAuthStore()

  const [leads, setLeads]       = useState<any[]>([])
  const [ledger, setLedger]     = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [noProfile, setNoProfile] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const [filter, setFilter]     = useState<'active' | 'completed' | 'all'>('active')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [drafts, setDrafts]     = useState<Record<string, { note: string; value: string }>>({})
  const [busy, setBusy]         = useState<string | null>(null)

  /* ── data ──────────────────────────────────────────────────────────────── */
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true)
    try {
      const [l, e] = await Promise.all([
        specialServicesAPI.leads(),
        specialServicesAPI.earnings(),
      ])
      setLeads(l.data.leads || [])
      setLedger(e.data)
      setNoProfile(false)
    } catch (err: any) {
      if (err?.response?.status === 403) setNoProfile(true)
      else if (err?.response?.status === 401) router.push('/login')
      else toast.error(err?.response?.data?.detail || 'Could not load your leads')
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [router])

  useEffect(() => {
    if (!isLoggedIn) { router.push('/login'); return }
    load()
  }, [isLoggedIn, load, router])

  /* ── helpers ────────────────────────────────────────────────────────────── */
  const draft = (id: string) => drafts[id] || { note: '', value: '' }

  const advance = async (lead: any, status: FlowStep) => {
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
      toast.success(`${lead.lead_no} → ${STATUS_META[status]?.label}`)
      setDrafts(prev => ({ ...prev, [lead.id]: { note: '', value: '' } }))
      load(true)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Update failed')
    } finally {
      setBusy(null)
    }
  }

  /* ── derived ────────────────────────────────────────────────────────────── */
  const visible = leads.filter(l =>
    filter === 'all' ? true
      : filter === 'completed' ? l.status === 'COMPLETED'
        : !['COMPLETED', 'CANCELLED'].includes(l.status)
  )

  const activeCount    = leads.filter(l => !['COMPLETED', 'CANCELLED'].includes(l.status)).length
  const completedCount = leads.filter(l => l.status === 'COMPLETED').length
  const s = ledger?.summary || {}

  /* ── no-profile state ───────────────────────────────────────────────────── */
  if (!loading && noProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
        <Navbar />
        <div className="max-w-lg mx-auto px-4 pt-32 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-900/60 border border-indigo-700/50 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-indigo-400" />
          </div>
          <h2 className="text-xl font-black text-white mb-2">No Consultant Profile Found</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            This account does not have a consultant profile. Ask the InteriorAI team to onboard
            you as a partner consultant using your registered email or phone number.
          </p>
        </div>
      </div>
    )
  }

  /* ── main render ────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 pt-24 pb-16">

        {/* Hero header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-cyan-500/20">
              <Briefcase className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">
                Consultant Workspace
              </h1>
              <p className="text-slate-400 text-sm mt-0.5">
                {user?.name ? `Welcome back, ${user.name.split(' ')[0]}` : 'Your leads from InteriorAI'}
              </p>
            </div>
          </div>
          <button
            onClick={() => load(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/10 rounded-xl text-white/70 text-sm hover:bg-white/20 transition-all"
          >
            <RefreshCw className={clsx('w-4 h-4', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Loading your workspace…</p>
          </div>
        ) : (
          <>
            {/* KPI strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              <GlassKpi label="Active Leads"    value={String(activeCount)}           icon={Activity}      glow="cyan" />
              <GlassKpi label="Completed"       value={String(completedCount)}         icon={CheckCircle2}  glow="emerald" />
              <GlassKpi label="Total Earnings"  value={inr(s.consultant_payout ?? 0)} icon={IndianRupee}   glow="indigo" money />
              <GlassKpi label="Awaiting Payout" value={inr(s.unpaid_payout ?? 0)}     icon={Wallet}        glow="amber" money />
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 bg-white/5 border border-white/10 p-1 rounded-xl mb-6 w-fit">
              {(['active', 'completed', 'all'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={clsx(
                    'px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all',
                    filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'
                  )}
                >
                  {f} {f === 'active' ? `(${activeCount})` : f === 'completed' ? `(${completedCount})` : `(${leads.length})`}
                </button>
              ))}
            </div>

            {/* Lead cards */}
            {visible.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
                <Briefcase className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="font-semibold text-slate-400">
                  {filter === 'active' ? 'No active leads right now.' : 'No leads in this category.'}
                </p>
                <p className="text-xs text-slate-600 mt-1">New leads assigned to you will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {visible.map(lead => {
                  const stepIdx = FLOW.indexOf(lead.status as FlowStep)
                  const nextStatus = FLOW[stepIdx + 1] as FlowStep | undefined
                  const d = draft(lead.id)
                  const sm = STATUS_META[lead.status] || STATUS_META.NEW
                  const isExpanded = expanded === lead.id
                  const isBusy = busy === lead.id

                  return (
                    <div
                      key={lead.id}
                      className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all"
                    >
                      {/* Card header */}
                      <div className="p-5">
                        <div className="flex flex-wrap justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-slate-500">{lead.lead_no}</span>
                              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 text-[11px] font-bold border border-cyan-500/20">
                                {lead.service_type}
                              </span>
                              <span className={clsx('px-2.5 py-0.5 rounded-full text-[11px] font-bold border', sm.bg, sm.color, sm.border)}>
                                {sm.label}
                              </span>
                            </div>

                            <h3 className="font-black text-white text-lg mt-2">{lead.customer_name || 'Customer'}</h3>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                              {lead.customer_phone && (
                                <a href={`tel:${lead.customer_phone}`} className="flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-400 transition-colors">
                                  <Phone className="w-3 h-3" /> {lead.customer_phone}
                                </a>
                              )}
                              {lead.customer_email && (
                                <a href={`mailto:${lead.customer_email}`} className="flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-400 transition-colors">
                                  <Mail className="w-3 h-3" /> {lead.customer_email}
                                </a>
                              )}
                              {lead.city && (
                                <span className="flex items-center gap-1 text-xs text-slate-400">
                                  <MapPin className="w-3 h-3" /> {lead.city}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Value + payout */}
                          <div className="text-right flex-shrink-0">
                            {lead.service_value > 0 ? (
                              <>
                                <div className="text-xl font-black text-white">{inr(lead.service_value)}</div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  Your share: <span className="text-cyan-400 font-bold">{inr(lead.consultant_payout)}</span>
                                </div>
                                <div className="text-[10px] text-slate-500">Platform: {lead.commission_rate}%</div>
                                {lead.status === 'COMPLETED' && (
                                  <div className={clsx(
                                    'text-[11px] font-bold mt-1 px-2 py-0.5 rounded-full',
                                    lead.payout_status === 'PAID'
                                      ? 'bg-emerald-500/10 text-emerald-400'
                                      : 'bg-amber-500/10 text-amber-400'
                                  )}>
                                    {lead.payout_status === 'PAID' ? '✓ Paid' : '⏳ Payout pending'}
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-slate-600">No value set yet</span>
                            )}
                          </div>
                        </div>

                        {/* Requirements */}
                        {lead.requirements && (
                          <p className="text-sm text-slate-400 bg-white/5 border border-white/5 rounded-xl px-3 py-2 mt-3">
                            {lead.requirements}
                          </p>
                        )}

                        {/* Progress stepper */}
                        <div className="flex items-center gap-0 mt-4">
                          {FLOW.map((st, i) => {
                            const done = i <= stepIdx
                            const current = i === stepIdx
                            return (
                              <div key={st} className="flex items-center flex-1">
                                <div className="flex flex-col items-center flex-1">
                                  <div className={clsx(
                                    'w-full h-1 rounded-full transition-all',
                                    done ? 'bg-cyan-500' : 'bg-white/10'
                                  )} />
                                  <span className={clsx(
                                    'text-[9px] font-bold mt-1 whitespace-nowrap transition-colors',
                                    current ? 'text-cyan-400' : done ? 'text-slate-400' : 'text-slate-600'
                                  )}>
                                    {STATUS_META[st]?.label || st}
                                  </span>
                                </div>
                                {i < FLOW.length - 1 && (
                                  <ChevronRight className={clsx('w-3 h-3 flex-shrink-0', done ? 'text-cyan-500' : 'text-white/10')} />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Action bar — only for in-flight leads */}
                      {nextStatus && !['COMPLETED', 'CANCELLED'].includes(lead.status) && (
                        <div className="border-t border-white/5 bg-white/3 px-5 py-4">
                          <div className="flex flex-col sm:flex-row gap-3">
                            <input
                              value={d.note}
                              placeholder="Update note for the platform team (optional)"
                              onChange={e => setDrafts(p => ({ ...p, [lead.id]: { ...d, note: e.target.value } }))}
                              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40"
                            />
                            {nextStatus === 'COMPLETED' && (
                              <input
                                type="number"
                                min={0}
                                value={d.value}
                                placeholder={lead.service_value ? String(lead.service_value) : 'Final value ₹ *'}
                                onChange={e => setDrafts(p => ({ ...p, [lead.id]: { ...d, value: e.target.value } }))}
                                className="w-40 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                              />
                            )}
                            <button
                              disabled={isBusy}
                              onClick={() => advance(lead, nextStatus)}
                              className={clsx(
                                'flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap',
                                nextStatus === 'COMPLETED'
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30'
                                  : 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30',
                                isBusy && 'opacity-60 cursor-not-allowed'
                              )}
                            >
                              {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : nextStatus === 'COMPLETED' ? <CheckCircle2 className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                              {NEXT_LABEL[lead.status] || 'Advance'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* History expand/collapse */}
                      {lead.events?.length > 0 && (
                        <div className="border-t border-white/5">
                          <button
                            onClick={() => setExpanded(isExpanded ? null : lead.id)}
                            className="w-full flex items-center justify-between px-5 py-3 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                          >
                            <span className="font-semibold">Activity history ({lead.events.length} events)</span>
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          {isExpanded && (
                            <div className="px-5 pb-4 space-y-2">
                              {lead.events.map((ev: any, i: number) => {
                                const esm = STATUS_META[ev.status]
                                return (
                                  <div key={i} className="flex gap-3 text-xs">
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/50 mt-1.5 flex-shrink-0" />
                                    <div>
                                      <span className={clsx('font-bold', esm?.color || 'text-slate-400')}>
                                        {esm?.label || ev.status}
                                      </span>
                                      {ev.note && <span className="text-slate-500"> — {ev.note}</span>}
                                      <div className="text-slate-600 mt-0.5">{fmtDateTime(ev.at)}</div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Lifetime earnings footer */}
            {(ledger?.by_consultant || []).length > 0 && (
              <div className="mt-8 bg-gradient-to-r from-indigo-900/60 to-cyan-900/40 border border-indigo-500/20 rounded-2xl p-5 flex flex-wrap gap-6 items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Lifetime Summary</p>
                    <p className="text-sm text-white mt-0.5">
                      {inr(s.gross_service_value ?? 0)} of work delivered
                    </p>
                  </div>
                </div>
                <div className="flex gap-6 text-right">
                  <div>
                    <p className="text-[11px] text-slate-500 uppercase">Your Earnings</p>
                    <p className="text-lg font-black text-cyan-400">{inr(s.consultant_payout ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 uppercase">Platform Commission</p>
                    <p className="text-lg font-black text-slate-300">{inr(s.platform_earning ?? 0)}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* ─── KPI glass card ──────────────────────────────────────────────────────── */
const GLOW_MAP: Record<string, string> = {
  cyan:    'from-cyan-500/20 to-cyan-500/5 border-cyan-500/20',
  emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20',
  indigo:  'from-indigo-500/20 to-indigo-500/5 border-indigo-500/20',
  amber:   'from-amber-500/20 to-amber-500/5 border-amber-500/20',
}
const ICON_GLOW: Record<string, string> = {
  cyan: 'bg-cyan-500/20 text-cyan-400', emerald: 'bg-emerald-500/20 text-emerald-400',
  indigo: 'bg-indigo-500/20 text-indigo-400', amber: 'bg-amber-500/20 text-amber-400',
}

function GlassKpi({ label, value, icon: Icon, glow, money }: { label: string; value: string; icon: any; glow: string; money?: boolean }) {
  return (
    <div className={clsx('bg-gradient-to-br border rounded-2xl p-4', GLOW_MAP[glow] || GLOW_MAP.cyan)}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', ICON_GLOW[glow])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className={clsx('font-black', money ? 'text-lg leading-tight' : 'text-2xl', 'text-white')}>{value}</p>
    </div>
  )
}
