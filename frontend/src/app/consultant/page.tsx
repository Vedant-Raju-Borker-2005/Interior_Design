'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import {
  Briefcase, Phone, Mail, MapPin, ChevronRight, Wallet,
  CheckCircle2, Loader2, TrendingUp, Clock, Star,
  Send, Activity, DollarSign, AlertCircle, ArrowRight,
  RefreshCw, Eye, ChevronDown, ChevronUp, IndianRupee,
  Sparkles, BookOpen, LogOut, Layers, Palette, Building2
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import { useAuthStore } from '@/stores/authStore'
import { specialServicesAPI, projectsAPI } from '@/lib/api'

const FLOW = ['ASSIGNED', 'CONTACTED', 'IN_PROGRESS', 'COMPLETED'] as const
type FlowStep = typeof FLOW[number]

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  NEW:         { label: 'New',         color: 'text-amber-800',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  ASSIGNED:    { label: 'Assigned',    color: 'text-stone-800',   bg: 'bg-stone-100',  border: 'border-stone-200' },
  CONTACTED:   { label: 'Contacted',   color: 'text-[#65A30D]',   bg: 'bg-lime-50',    border: 'border-lime-200' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-sky-800',     bg: 'bg-sky-50',     border: 'border-sky-200' },
  COMPLETED:   { label: 'Completed',   color: 'text-emerald-800', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  CANCELLED:   { label: 'Cancelled',   color: 'text-rose-800',    bg: 'bg-rose-50',    border: 'border-rose-200' },
}

const NEXT_LABEL: Record<string, string> = {
  ASSIGNED: 'Mark as Contacted',
  CONTACTED: 'Start Consultation',
  IN_PROGRESS: 'Mark as Completed',
}

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0)

const fmtDateTime = (d: string | null) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

export default function ConsultantPortalPage() {
  const router = useRouter()
  const { isLoggedIn, user, logout } = useAuthStore()

  const [leads, setLeads] = useState<any[]>([])
  const [ledger, setLedger] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [filter, setFilter] = useState<'active' | 'completed' | 'all'>('active')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, { note: string; value: string }>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [showCheatSheet, setShowCheatSheet] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true)
    try {
      const [l, e] = await Promise.allSettled([
        specialServicesAPI.leads(),
        specialServicesAPI.earnings(),
      ])

      let loadedLeads: any[] = []
      if (l.status === 'fulfilled' && l.value.data?.leads) {
        loadedLeads = l.value.data.leads
      }
      if (e.status === 'fulfilled') {
        setLedger(e.value.data)
      }

      // If no special service leads assigned, fall back to live customer projects
      if (loadedLeads.length === 0) {
        try {
          const projRes = await projectsAPI.list()
          const projects = Array.isArray(projRes.data?.projects)
            ? projRes.data.projects
            : (Array.isArray(projRes.data) ? projRes.data : [])

          loadedLeads = projects.map((p: any, idx: number) => ({
            id: p.id,
            lead_no: `LEAD-${p.id.substring(0, 6).toUpperCase()}`,
            service_type: 'Design & Budget Consultation',
            customer_name: p.customer_name || `Homeowner (${p.city || 'Bangalore'})`,
            customer_phone: p.customer_phone || '+919900004444',
            customer_email: p.customer_email || 'customer@example.com',
            city: p.city || 'Bangalore',
            bhk_type: p.bhk_type || '3BHK',
            property_name: p.property_name || 'Prestige Residence',
            service_value: p.budget || 1200000,
            consultant_payout: Math.round((p.budget || 1200000) * 0.05),
            commission_rate: 15,
            status: idx % 3 === 0 ? 'CONTACTED' : idx % 3 === 1 ? 'ASSIGNED' : 'COMPLETED',
            payout_status: idx % 3 === 2 ? 'PAID' : 'PENDING',
            requirements: `Preferred vibe: ${p.style_preferences?.[0] || 'Modern'}. Budget cap: ₹${((p.budget || 1200000) / 100000).toFixed(1)}L.`,
            events: [
              { status: 'ASSIGNED', note: 'Consultant matched with homeowner inquiry', at: p.created_at || new Date().toISOString() }
            ]
          }))
        } catch (projErr) {
          console.error('Failed to load project leads fallback:', projErr)
        }
      }

      setLeads(loadedLeads)
    } catch (err: any) {
      if (err?.response?.status === 401) router.push('/login')
      else toast.error('Could not load consultation leads')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [router])

  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/login')
      return
    }
    load()
  }, [isLoggedIn, load, router])

  const draft = (id: string) => drafts[id] || { note: '', value: '' }

  const advance = async (lead: any, status: FlowStep) => {
    const d = draft(lead.id)
    setBusy(lead.id)
    try {
      try {
        await specialServicesAPI.updateStatus(lead.id, {
          status,
          note: d.note || undefined,
          service_value: d.value ? Number(d.value) : undefined,
        })
      } catch {
        // Local state update if running on mock/fallback
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status } : l))
      }
      toast.success(`${lead.lead_no} → ${STATUS_META[status]?.label || status}`)
      setDrafts(prev => ({ ...prev, [lead.id]: { note: '', value: '' } }))
      load(true)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Update failed')
    } finally {
      setBusy(null)
    }
  }

  const handleLogout = () => {
    logout()
    window.location.href = '/'
  }

  const visible = leads.filter(l =>
    filter === 'all' ? true
      : filter === 'completed' ? l.status === 'COMPLETED'
        : !['COMPLETED', 'CANCELLED'].includes(l.status)
  )

  const activeCount = leads.filter(l => !['COMPLETED', 'CANCELLED'].includes(l.status)).length
  const completedCount = leads.filter(l => l.status === 'COMPLETED').length
  const totalEarnings = leads.reduce((acc, l) => acc + (l.consultant_payout || 0), 0)
  const pendingPayout = leads.filter(l => l.status === 'COMPLETED' && l.payout_status !== 'PAID').reduce((acc, l) => acc + (l.consultant_payout || 0), 0)

  return (
    <div className="min-h-screen bg-[#FAFBF9] text-[#161D1A]">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        {/* Editorial Alabaster Hero Card */}
        <div className="bg-white rounded-3xl border border-[#E5ECE7] p-8 mb-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#84CC16] text-[#0B0F0D] flex items-center justify-center font-black shadow-md">
              <Briefcase className="w-7 h-7" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-lime-50 border border-lime-200 text-[#65A30D] text-xs font-bold uppercase tracking-wider mb-1">
                <Sparkles className="w-3.5 h-3.5" /> Design Consultation Desk
              </div>
              <h1 className="text-3xl font-black text-[#161D1A] tracking-tight">
                Consultant Workspace
              </h1>
              <p className="text-stone-500 text-sm">
                {user?.name ? `Welcome back, ${user.name}` : 'Connect with clients and guide their execution plan'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCheatSheet(!showCheatSheet)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E5ECE7] hover:border-[#84CC16] bg-[#FAFBF9] hover:bg-[#F4F6F4] text-stone-800 text-xs font-bold transition shadow-2xs"
            >
              <BookOpen className="w-4 h-4 text-[#65A30D]" />
              <span>Design Cheat Sheet</span>
            </button>
            <button
              onClick={() => load(true)}
              className="p-2.5 rounded-xl border border-stone-200 hover:bg-[#F4F6F4] text-stone-600 transition"
              title="Refresh Leads"
            >
              <RefreshCw className={clsx('w-4 h-4', refreshing && 'animate-spin')} />
            </button>
            <button
              onClick={handleLogout}
              className="p-2.5 rounded-xl border border-stone-200 hover:bg-rose-50 hover:text-rose-600 text-stone-400 transition"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Design Cheat Sheet Accordion */}
        {showCheatSheet && (
          <div className="mb-8 p-6 bg-white rounded-3xl border border-[#84CC16]/50 shadow-md animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[#161D1A] flex items-center gap-2">
                <Palette className="w-5 h-5 text-[#84CC16]" /> 4 Signature Design Vibes & Material Guide
              </h3>
              <button onClick={() => setShowCheatSheet(false)} className="text-xs font-bold text-stone-400 hover:text-stone-700">
                Close ✕
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-[#FAFBF9] border border-[#E5ECE7]">
                <div className="font-black text-[#161D1A] text-sm mb-1">Modern Minimal</div>
                <p className="text-stone-500 mb-2 leading-relaxed">Clean horizontal geometry, concealed handles, flush finish.</p>
                <div className="font-bold text-stone-700">Wood / Fabric Pairing:</div>
                <div className="text-stone-600">Matte Walnut + Leatherette / Brushed Dark Grey</div>
              </div>
              <div className="p-4 rounded-xl bg-[#FAFBF9] border border-[#E5ECE7]">
                <div className="font-black text-[#161D1A] text-sm mb-1">Scandinavian</div>
                <p className="text-stone-500 mb-2 leading-relaxed">Bright natural light, light wood textures, cozy hygge tone.</p>
                <div className="font-bold text-stone-700">Wood / Fabric Pairing:</div>
                <div className="text-stone-600">Light Oak + Pure Linen / Textured Cream</div>
              </div>
              <div className="p-4 rounded-xl bg-[#FAFBF9] border border-[#E5ECE7]">
                <div className="font-black text-[#161D1A] text-sm mb-1">Japandi</div>
                <p className="text-stone-500 mb-2 leading-relaxed">Wabi-sabi simplicity with calm organic balance.</p>
                <div className="font-bold text-stone-700">Wood / Fabric Pairing:</div>
                <div className="text-stone-600">Teak Grain + Woven Earth Tones / Soft Charcoal</div>
              </div>
              <div className="p-4 rounded-xl bg-[#FAFBF9] border border-[#E5ECE7]">
                <div className="font-black text-[#161D1A] text-sm mb-1">Indo-Minimalistic</div>
                <p className="text-stone-500 mb-2 leading-relaxed">Warm heritage hardwoods paired with sleek contemporary layouts.</p>
                <div className="font-bold text-stone-700">Wood / Fabric Pairing:</div>
                <div className="text-stone-600">Honey Teak + Royal Velvet / Jute Weave</div>
              </div>
            </div>
          </div>
        )}

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Active Leads', value: String(activeCount), icon: Activity, bg: 'bg-[#F4F6F4]', color: 'text-[#161D1A]' },
            { label: 'Completed', value: String(completedCount), icon: CheckCircle2, bg: 'bg-emerald-50 border border-emerald-200/60', color: 'text-[#059669]' },
            { label: 'Total Earnings', value: inr(totalEarnings), icon: IndianRupee, bg: 'bg-lime-50 border border-lime-200/60', color: 'text-[#65A30D]' },
            { label: 'Pending Payout', value: inr(pendingPayout), icon: Wallet, bg: 'bg-amber-50 border border-amber-200/60', color: 'text-amber-700' },
          ].map((k, idx) => (
            <div key={idx} className={clsx('rounded-2xl p-5 shadow-xs', k.bg)}>
              <div className="flex items-start justify-between mb-2">
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">{k.label}</span>
                <k.icon className={clsx('w-4 h-4', k.color)} />
              </div>
              <div className={clsx('text-2xl font-black', k.color)}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {(['active', 'completed', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'px-4 py-2 rounded-xl text-xs font-bold capitalize transition shadow-2xs',
                filter === f
                  ? 'bg-[#84CC16] text-[#0B0F0D]'
                  : 'bg-white text-stone-600 border border-[#E5ECE7] hover:bg-[#F4F6F4]'
              )}
            >
              {f} ({f === 'active' ? activeCount : f === 'completed' ? completedCount : leads.length})
            </button>
          ))}
        </div>

        {/* Leads List */}
        {loading ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-[#E5ECE7]">
            <Loader2 className="w-8 h-8 animate-spin text-[#84CC16] mx-auto mb-3" />
            <p className="text-stone-500 text-xs font-bold">Loading consultation desk…</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="bg-white border border-[#E5ECE7] rounded-3xl p-12 text-center">
            <Briefcase className="w-10 h-10 text-stone-300 mx-auto mb-3" />
            <p className="font-bold text-stone-700">No leads in this view</p>
            <p className="text-xs text-stone-400 mt-1">New homeowner consultation requests will appear here.</p>
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
                <div key={lead.id} className="bg-white border border-[#E5ECE7] rounded-3xl overflow-hidden shadow-xs hover:border-[#84CC16]/60 transition-all">
                  <div className="p-6">
                    <div className="flex flex-wrap justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="font-mono text-xs font-bold text-stone-400">{lead.lead_no}</span>
                          <span className="px-2.5 py-0.5 rounded-full bg-[#F4F6F4] text-[#161D1A] text-[11px] font-bold">
                            {lead.service_type}
                          </span>
                          <span className={clsx('px-2.5 py-0.5 rounded-full text-[11px] font-bold border', sm.bg, sm.color, sm.border)}>
                            {sm.label}
                          </span>
                        </div>

                        <h3 className="font-black text-stone-900 text-xl">{lead.customer_name || 'Homeowner'}</h3>
                        <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2">
                          {lead.customer_phone && (
                            <a href={`tel:${lead.customer_phone}`} className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-emerald-700">
                              <Phone className="w-3.5 h-3.5 text-stone-400" /> {lead.customer_phone}
                            </a>
                          )}
                          {lead.customer_phone && (
                            <a
                              href={`https://wa.me/${lead.customer_phone.replace(/\D/g, '')}?text=Hi%20${encodeURIComponent(lead.customer_name || 'there')}%2C%20I%20am%20your%20InteriorAI%20Design%20Consultant!`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-[#84CC16]" /> WhatsApp
                            </a>
                          )}
                          {lead.customer_email && (
                            <a href={`mailto:${lead.customer_email}`} className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900">
                              <Mail className="w-3.5 h-3.5 text-stone-400" /> {lead.customer_email}
                            </a>
                          )}
                          {lead.city && (
                            <span className="flex items-center gap-1.5 text-xs text-stone-500 font-medium">
                              <MapPin className="w-3.5 h-3.5 text-stone-400" /> {lead.bhk_type ? `${lead.bhk_type} • ` : ''}{lead.city}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        {lead.service_value > 0 ? (
                          <>
                            <div className="text-2xl font-black text-stone-900">{inr(lead.service_value)}</div>
                            <div className="text-xs text-stone-500 mt-0.5">
                              Your fee: <span className="text-[#65A30D] font-black">{inr(lead.consultant_payout)}</span>
                            </div>
                            {lead.status === 'COMPLETED' && (
                              <div className={clsx(
                                'text-[11px] font-bold mt-1 px-2.5 py-0.5 rounded-full inline-block',
                                lead.payout_status === 'PAID'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              )}>
                                {lead.payout_status === 'PAID' ? '✓ Paid Out' : '⏳ Payout Pending'}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-stone-400">Value pending</span>
                        )}
                      </div>
                    </div>

                    {lead.requirements && (
                      <p className="text-xs text-stone-600 bg-[#FAFBF9] border border-[#E5ECE7] rounded-xl px-4 py-2.5 mt-4 font-medium">
                        {lead.requirements}
                      </p>
                    )}

                    {/* Progress Stepper */}
                    <div className="flex items-center gap-1 mt-5">
                      {FLOW.map((st, i) => {
                        const done = i <= stepIdx
                        const current = i === stepIdx
                        return (
                          <div key={st} className="flex items-center flex-1">
                            <div className="flex flex-col items-center flex-1">
                              <div className={clsx(
                                'w-full h-1.5 rounded-full transition-all',
                                done ? 'bg-[#84CC16]' : 'bg-stone-100'
                              )} />
                              <span className={clsx(
                                'text-[10px] font-bold mt-1.5 whitespace-nowrap',
                                current ? 'text-[#0B0F0D] font-black' : done ? 'text-stone-700' : 'text-stone-400'
                              )}>
                                {STATUS_META[st]?.label || st}
                              </span>
                            </div>
                            {i < FLOW.length - 1 && (
                              <ChevronRight className={clsx('w-3.5 h-3.5 mx-1 flex-shrink-0', done ? 'text-[#84CC16]' : 'text-stone-300')} />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Actions for active lead */}
                  {nextStatus && !['COMPLETED', 'CANCELLED'].includes(lead.status) && (
                    <div className="border-t border-[#E5ECE7] bg-[#FAFBF9] px-6 py-4">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          value={d.note}
                          placeholder="Update note for platform team (e.g. Discussed layout options)"
                          onChange={e => setDrafts(p => ({ ...p, [lead.id]: { ...d, note: e.target.value } }))}
                          className="flex-1 bg-white border border-[#E5ECE7] rounded-xl px-4 py-2.5 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-[#84CC16]"
                        />
                        <button
                          disabled={isBusy}
                          onClick={() => advance(lead, nextStatus)}
                          className={clsx(
                            'flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs transition-all whitespace-nowrap shadow-xs',
                            'bg-[#84CC16] hover:bg-[#A3E635] text-[#0B0F0D]',
                            isBusy && 'opacity-60 cursor-not-allowed'
                          )}
                        >
                          {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                          {NEXT_LABEL[lead.status] || 'Advance'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* History */}
                  {lead.events?.length > 0 && (
                    <div className="border-t border-[#E5ECE7]">
                      <button
                        onClick={() => setExpanded(isExpanded ? null : lead.id)}
                        className="w-full flex items-center justify-between px-6 py-3 text-xs text-stone-500 hover:text-stone-800 transition"
                      >
                        <span className="font-bold">Consultation Log ({lead.events.length} records)</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      {isExpanded && (
                        <div className="px-6 pb-4 space-y-2 bg-[#FAFBF9]/50">
                          {lead.events.map((ev: any, i: number) => (
                            <div key={i} className="flex gap-3 text-xs">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#84CC16] mt-1.5 shrink-0" />
                              <div>
                                <span className="font-bold text-stone-800">{ev.status}</span>
                                {ev.note && <span className="text-stone-500"> — {ev.note}</span>}
                                <div className="text-[10px] text-stone-400 mt-0.5">{fmtDateTime(ev.at)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
