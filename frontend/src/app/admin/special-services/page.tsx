'use client';

/**
 * Special Services — stakeholder feedback section 5.
 *
 * 5.1  Consultant Directory     — searchable cards with stats
 * 5.2  Consultant Onboarding    — onboard & edit partner consultants
 * 5.3  Lead Assignment          — route inquiries to eligible consultants
 * 5.4  Lead Tracking            — admin view of all leads with history
 * 5.5  Status Tracking          — admin can also move a lead (cancel, etc.)
 * 5.6/5.7  Commission Ledger    — per-consultant earning & payout controls
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  Handshake, UserPlus, Inbox, Wallet, X, Star, Send,
  Search, Phone, Mail, MapPin, TrendingUp, CheckCircle,
  Clock, AlertCircle, ChevronDown, Edit2, Plus,
  BarChart3, Filter, RefreshCw, DollarSign, Users,
  Eye, XCircle, Loader2, Calculator, Percent, Info,
  Layers, ChevronUp, BadgePercent, Receipt,
} from 'lucide-react';
import { specialServicesAPI } from '@/lib/api';

/* ─── constants ────────────────────────────────────────────────────────────── */
const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  NEW:        { label: 'New',         color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',    icon: Clock },
  ASSIGNED:   { label: 'Assigned',    color: 'text-indigo-700',  bg: 'bg-indigo-50 border-indigo-200',  icon: Send },
  CONTACTED:  { label: 'Contacted',   color: 'text-sky-700',     bg: 'bg-sky-50 border-sky-200',        icon: Phone },
  IN_PROGRESS:{ label: 'In Progress', color: 'text-violet-700',  bg: 'bg-violet-50 border-violet-200',  icon: TrendingUp },
  COMPLETED:  { label: 'Completed',   color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200',icon: CheckCircle },
  CANCELLED:  { label: 'Cancelled',   color: 'text-slate-500',   bg: 'bg-slate-100 border-slate-200',   icon: XCircle },
};

const CONSULTANT_STATUS_META: Record<string, { color: string; bg: string }> = {
  ACTIVE:    { color: 'text-emerald-700', bg: 'bg-emerald-50 ring-emerald-200' },
  INACTIVE:  { color: 'text-amber-700',   bg: 'bg-amber-50 ring-amber-200' },
  SUSPENDED: { color: 'text-red-700',     bg: 'bg-red-50 ring-red-200' },
};

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const EMPTY_CONSULTANT = {
  name: '', company_name: '', email: '', phone: '', city: '',
  services: [] as string[], commission_rate: '15', notes: '', status: 'ACTIVE',
};

const EMPTY_LEAD = {
  service_type: '', customer_name: '', customer_phone: '',
  customer_email: '', city: '', requirements: '', service_value: '',
};

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function AdminSpecialServicesPage() {
  const [tab, setTab] = useState<'leads' | 'consultants' | 'earnings'>('leads');

  /* data */
  const [types, setTypes]             = useState<string[]>([]);
  const [leads, setLeads]             = useState<any[]>([]);
  const [consultants, setConsultants] = useState<any[]>([]);
  const [ledger, setLedger]           = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);

  /* filters */
  const [leadFilter, setLeadFilter]       = useState('');
  const [typeFilter, setTypeFilter]       = useState('');
  const [consultantSearch, setConsultantSearch] = useState('');
  const [consultantStatusFilter, setConsultantStatusFilter] = useState('');

  /* modals */
  const [assigningLead, setAssigningLead]   = useState<any | null>(null);
  const [selectedConsultantId, setSelectedConsultantId] = useState('');
  const [editingConsultant, setEditingConsultant]       = useState<any | null>(null); // null=closed, 'new'=create
  const [consultantForm, setConsultantForm] = useState(EMPTY_CONSULTANT);
  const [creatingLead, setCreatingLead]     = useState(false);
  const [leadForm, setLeadForm]             = useState(EMPTY_LEAD);
  const [viewingLead, setViewingLead]       = useState<any | null>(null);

  /* 5.6 commission calculator */
  const [calcValue, setCalcValue]   = useState('');
  const [calcRate, setCalcRate]     = useState('15');
  const [calcResult, setCalcResult] = useState<any>(null);
  const [calcBusy, setCalcBusy]     = useState(false);

  const [busy, setBusy] = useState(false);

  /* ── load ──────────────────────────────────────────────────────────────── */
  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [t, l, c, e] = await Promise.all([
        specialServicesAPI.types(),
        specialServicesAPI.leads(),
        specialServicesAPI.consultants(),
        specialServicesAPI.earnings(),
      ]);
      setTypes(t.data.service_types || []);
      setLeads(l.data.leads || []);
      setConsultants(c.data.consultants || []);
      setLedger(e.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to load');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* ── derived ────────────────────────────────────────────────────────────── */
  const filteredLeads = useMemo(() =>
    leads.filter((l) =>
      (!leadFilter || l.status === leadFilter) &&
      (!typeFilter  || l.service_type === typeFilter)),
  [leads, leadFilter, typeFilter]);

  const filteredConsultants = useMemo(() =>
    consultants.filter((c) => {
      const q = consultantSearch.toLowerCase();
      const matchSearch = !q ||
        c.name?.toLowerCase().includes(q) ||
        c.company_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q);
      const matchStatus = !consultantStatusFilter || c.status === consultantStatusFilter;
      return matchSearch && matchStatus;
    }),
  [consultants, consultantSearch, consultantStatusFilter]);

  const eligibleForAssign = useMemo(() =>
    assigningLead
      ? consultants.filter((c) => c.status === 'ACTIVE' && c.services.includes(assigningLead.service_type))
      : [],
  [assigningLead, consultants]);

  const s = ledger?.summary || {};

  /* 5.6 — commission preview via backend */
  const previewCommission = async () => {
    const val = Number(calcValue);
    const rate = Number(calcRate);
    if (!val || val <= 0) { toast.error('Enter a valid service value'); return; }
    setCalcBusy(true);
    try {
      const res = await specialServicesAPI.previewCommission(val, rate);
      setCalcResult(res.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Preview failed');
    } finally { setCalcBusy(false); }
  };

  /* ── actions ────────────────────────────────────────────────────────────── */
  const assign = async () => {
    if (!assigningLead || !selectedConsultantId) return;
    setBusy(true);
    try {
      await specialServicesAPI.assign(assigningLead.id, selectedConsultantId);
      toast.success(`${assigningLead.lead_no} assigned successfully`);
      setAssigningLead(null);
      loadAll(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Assignment failed');
    } finally { setBusy(false); }
  };

  const saveConsultant = async () => {
    if (!consultantForm.name.trim()) { toast.error('Name is required'); return; }
    if (consultantForm.services.length === 0) { toast.error('Pick at least one service type'); return; }
    setBusy(true);
    try {
      const payload = { ...consultantForm, commission_rate: Number(consultantForm.commission_rate) || 15 };
      if (editingConsultant === 'new') {
        await specialServicesAPI.createConsultant(payload);
        toast.success(`${consultantForm.name} onboarded — can now sign in`);
      } else {
        await specialServicesAPI.updateConsultant(editingConsultant.id, payload);
        toast.success(`${consultantForm.name} updated`);
      }
      setEditingConsultant(null);
      setConsultantForm(EMPTY_CONSULTANT);
      loadAll(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Save failed');
    } finally { setBusy(false); }
  };

  const openEditConsultant = (c: any) => {
    setConsultantForm({
      name: c.name || '', company_name: c.company_name || '',
      email: c.email || '', phone: c.phone || '', city: c.city || '',
      services: c.services || [], commission_rate: String(c.commission_rate ?? 15),
      notes: c.notes || '', status: c.status || 'ACTIVE',
    });
    setEditingConsultant(c);
  };

  const createLead = async () => {
    if (!leadForm.service_type) { toast.error('Select a service type'); return; }
    if (!leadForm.customer_name.trim()) { toast.error('Customer name required'); return; }
    setBusy(true);
    try {
      await specialServicesAPI.createLead({
        service_type: leadForm.service_type,
        customer_name: leadForm.customer_name,
        customer_phone: leadForm.customer_phone || undefined,
        customer_email: leadForm.customer_email || undefined,
        city: leadForm.city || undefined,
        requirements: leadForm.requirements || undefined,
        service_value: leadForm.service_value ? Number(leadForm.service_value) : undefined,
      });
      toast.success('Lead created');
      setCreatingLead(false);
      setLeadForm(EMPTY_LEAD);
      loadAll(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create lead');
    } finally { setBusy(false); }
  };

  const cancelLead = async (lead: any) => {
    if (!confirm(`Cancel lead ${lead.lead_no}? This cannot be undone.`)) return;
    try {
      await specialServicesAPI.updateStatus(lead.id, { status: 'CANCELLED', note: 'Cancelled by admin' });
      toast.success('Lead cancelled');
      loadAll(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Could not cancel');
    }
  };

  const markPayout = async (leadId: string) => {
    try {
      await specialServicesAPI.updatePayout(leadId, 'PAID');
      toast.success('Payout recorded as paid');
      loadAll(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Could not update payout');
    }
  };

  /* ── render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">

      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Handshake className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Special Services</h1>
              <p className="text-sm text-slate-500 mt-0.5">Refer, track, and earn commission on partner-delivered services</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadAll(true)}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 transition-colors"
          >
            <RefreshCw className={clsx('w-4 h-4', refreshing && 'animate-spin')} />
          </button>
          <button
            onClick={() => { setCreatingLead(true); setLeadForm(EMPTY_LEAD); }}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 flex items-center gap-2 text-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> New Lead
          </button>
          <button
            onClick={() => { setEditingConsultant('new'); setConsultantForm(EMPTY_CONSULTANT); }}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 flex items-center gap-2 text-sm shadow-sm shadow-indigo-500/20 transition-all"
          >
            <UserPlus className="w-4 h-4" /> Onboard Consultant
          </button>
        </div>
      </div>

      {/* 5.8 Partner-led services banner */}
      <div className="flex items-start gap-3 bg-gradient-to-r from-violet-50 to-indigo-50 border border-indigo-100 rounded-2xl px-5 py-3.5">
        <Layers className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <span className="font-bold text-indigo-800">Partner-led Referral Model (5.8) — </span>
          <span className="text-indigo-600">
            InteriorAI does <em>not</em> deliver these services directly. The platform acts as a
            lead-generation / referral layer, passing inquiries to registered partner consultants
            and retaining a commission on each completed engagement.
          </span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Open Leads" value={String(leads.filter(l => !['COMPLETED','CANCELLED'].includes(l.status)).length)}
          sub={`${leads.filter(l => l.status === 'NEW').length} unassigned`}
          icon={Inbox} gradient="from-amber-500 to-orange-500"
        />
        <KpiCard
          label="Service Revenue" value={inr(s.gross_service_value ?? 0)}
          sub={`${s.completed_leads ?? 0} completed leads`}
          icon={TrendingUp} gradient="from-emerald-500 to-teal-500"
        />
        <KpiCard
          label="Platform Commission" value={inr(s.platform_earning ?? 0)}
          sub="Earned by InteriorAI"
          icon={DollarSign} gradient="from-indigo-500 to-purple-500"
        />
        <KpiCard
          label="Owed to Consultants" value={inr(s.unpaid_payout ?? 0)}
          sub="Pending payout"
          icon={Wallet} gradient="from-rose-500 to-pink-500"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { id: 'leads', label: `Leads`, count: leads.length, icon: Inbox },
          { id: 'consultants', label: 'Consultants', count: consultants.length, icon: Users },
          { id: 'earnings', label: 'Commission Ledger', icon: BarChart3 },
        ].map(({ id, label, count, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as any)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all',
              tab === id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
            {count !== undefined && (
              <span className={clsx(
                'text-[11px] font-bold px-1.5 py-0.5 rounded-full',
                tab === id ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
              )}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading special services data…</p>
        </div>
      ) : tab === 'leads' ? (
        <LeadsTab
          leads={filteredLeads} allLeads={leads} types={types}
          leadFilter={leadFilter} setLeadFilter={setLeadFilter}
          typeFilter={typeFilter} setTypeFilter={setTypeFilter}
          onAssign={(l: any) => { setAssigningLead(l); setSelectedConsultantId(l.consultant_id || ''); }}
          onCancel={cancelLead}
          onView={setViewingLead}
        />
      ) : tab === 'consultants' ? (
        <ConsultantsTab
          consultants={filteredConsultants}
          search={consultantSearch} setSearch={setConsultantSearch}
          statusFilter={consultantStatusFilter} setStatusFilter={setConsultantStatusFilter}
          onEdit={openEditConsultant}
          onNewLead={(_c: any) => {
            setCreatingLead(true);
            setLeadForm(EMPTY_LEAD);
          }}
        />
      ) : (
        <EarningsTab
          ledger={ledger}
          leads={leads}
          onMarkPaid={markPayout}
          calcValue={calcValue} setCalcValue={setCalcValue}
          calcRate={calcRate}   setCalcRate={setCalcRate}
          calcResult={calcResult}  setCalcResult={setCalcResult}
          calcBusy={calcBusy}
          onPreview={previewCommission}
        />
      )}

      {/* ── Assign Lead Modal ── */}
      {assigningLead && (
        <Modal
          title={`Assign ${assigningLead.lead_no}`}
          subtitle={`${assigningLead.service_type} · ${assigningLead.customer_name || 'Guest'} · ${assigningLead.city || 'City not given'}`}
          onClose={() => setAssigningLead(null)}
          wide
        >
          {eligibleForAssign.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <p className="font-semibold text-slate-800">No eligible consultants</p>
              <p className="text-sm text-slate-500 mt-1">
                No active consultant is registered for <strong>{assigningLead.service_type}</strong>.
                Onboard one first.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {eligibleForAssign.map((c) => (
                <label
                  key={c.id}
                  className={clsx(
                    'flex items-center justify-between gap-3 border rounded-xl p-3.5 cursor-pointer transition-all',
                    selectedConsultantId === c.id
                      ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-300'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                  )}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio" name="consultant"
                      checked={selectedConsultantId === c.id}
                      onChange={() => setSelectedConsultantId(c.id)}
                      className="accent-indigo-600"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">{c.name}</span>
                      <span className="block text-xs text-slate-500">
                        {c.city || '—'} · {c.stats.active_leads} active · ⭐ {c.rating}
                      </span>
                    </span>
                  </span>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                    {c.commission_rate}% commission
                  </span>
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setAssigningLead(null)} className="px-4 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Cancel</button>
            <button
              disabled={busy || !selectedConsultantId}
              onClick={assign}
              className="px-5 py-2 text-sm rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Assign Lead
            </button>
          </div>
        </Modal>
      )}

      {/* ── Consultant Form Modal ── */}
      {editingConsultant !== null && (
        <Modal
          title={editingConsultant === 'new' ? 'Onboard a Partner Consultant' : `Edit: ${editingConsultant.name}`}
          subtitle={editingConsultant === 'new'
            ? 'A login account is created so they can sign in and update leads'
            : 'Changes take effect immediately'}
          onClose={() => { setEditingConsultant(null); setConsultantForm(EMPTY_CONSULTANT); }}
          wide
        >
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Name *" value={consultantForm.name} onChange={(v: string) => setConsultantForm(p => ({ ...p, name: v }))} />
            <FormField label="Company" value={consultantForm.company_name} onChange={(v: string) => setConsultantForm(p => ({ ...p, company_name: v }))} />
            <FormField label="Email (sign-in)" value={consultantForm.email} onChange={(v: string) => setConsultantForm(p => ({ ...p, email: v }))} />
            <FormField label="Phone" value={consultantForm.phone} onChange={(v: string) => setConsultantForm(p => ({ ...p, phone: v }))} />
            <FormField label="City" value={consultantForm.city} onChange={(v: string) => setConsultantForm(p => ({ ...p, city: v }))} />
            <FormField label="Platform Commission %" type="number" value={consultantForm.commission_rate} onChange={(v: string) => setConsultantForm(p => ({ ...p, commission_rate: v }))} />
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Services Offered *</p>
            <div className="flex flex-wrap gap-2">
              {types.map((t) => {
                const on = consultantForm.services.includes(t);
                return (
                  <button
                    type="button" key={t}
                    onClick={() => setConsultantForm(p => ({ ...p, services: on ? p.services.filter(x => x !== t) : [...p.services, t] }))}
                    className={clsx(
                      'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                      on ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                    )}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
          {editingConsultant !== 'new' && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Status</p>
              <div className="flex gap-2">
                {['ACTIVE', 'INACTIVE', 'SUSPENDED'].map(s => (
                  <button key={s} type="button"
                    onClick={() => setConsultantForm(p => ({ ...p, status: s }))}
                    className={clsx(
                      'px-3 py-1.5 text-xs font-semibold rounded-full border transition-all',
                      consultantForm.status === s ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <FormField label="Notes" value={consultantForm.notes} onChange={(v: string) => setConsultantForm(p => ({ ...p, notes: v }))} className="mt-3" />
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => { setEditingConsultant(null); setConsultantForm(EMPTY_CONSULTANT); }} className="px-4 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Cancel</button>
            <button
              disabled={busy}
              onClick={saveConsultant}
              className="px-5 py-2 text-sm rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {editingConsultant === 'new' ? 'Onboard' : 'Save Changes'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Create Lead Modal ── */}
      {creatingLead && (
        <Modal
          title="Create a New Lead"
          subtitle="Manually raise a special-service inquiry for a customer"
          onClose={() => { setCreatingLead(false); setLeadForm(EMPTY_LEAD); }}
          wide
        >
          <div className="mb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Service Type *</p>
            <div className="flex flex-wrap gap-2">
              {types.map(t => (
                <button key={t} type="button"
                  onClick={() => setLeadForm(p => ({ ...p, service_type: t }))}
                  className={clsx(
                    'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                    leadForm.service_type === t
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Customer Name *" value={leadForm.customer_name} onChange={(v: string) => setLeadForm(p => ({ ...p, customer_name: v }))} />
            <FormField label="City" value={leadForm.city} onChange={(v: string) => setLeadForm(p => ({ ...p, city: v }))} />
            <FormField label="Phone" value={leadForm.customer_phone} onChange={(v: string) => setLeadForm(p => ({ ...p, customer_phone: v }))} />
            <FormField label="Email" value={leadForm.customer_email} onChange={(v: string) => setLeadForm(p => ({ ...p, customer_email: v }))} />
            <FormField label="Service Value ₹ (optional)" type="number" value={leadForm.service_value} onChange={(v: string) => setLeadForm(p => ({ ...p, service_value: v }))} />
          </div>
          <div className="mt-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Requirements</p>
            <textarea
              value={leadForm.requirements}
              onChange={e => setLeadForm(p => ({ ...p, requirements: e.target.value }))}
              rows={3}
              className="w-full border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="Describe the customer's requirements…"
            />
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => { setCreatingLead(false); setLeadForm(EMPTY_LEAD); }} className="px-4 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Cancel</button>
            <button
              disabled={busy}
              onClick={createLead}
              className="px-5 py-2 text-sm rounded-lg bg-slate-800 text-white font-semibold hover:bg-slate-900 disabled:opacity-50 flex items-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Lead
            </button>
          </div>
        </Modal>
      )}

      {/* ── View Lead Detail Modal ── */}
      {viewingLead && (
        <LeadDetailModal lead={viewingLead} onClose={() => setViewingLead(null)} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════ Leads Tab ══════════════════════ */
function LeadsTab({ leads, allLeads, types, leadFilter, setLeadFilter, typeFilter, setTypeFilter, onAssign, onCancel, onView }: any) {
  const counts = allLeads.reduce((acc: any, l: any) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-1 text-xs text-slate-500 font-semibold mr-1">
          <Filter className="w-3.5 h-3.5" /> Status:
        </div>
        {['', 'NEW', 'ASSIGNED', 'CONTACTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(st => (
          <button
            key={st || 'all'}
            onClick={() => setLeadFilter(st)}
            className={clsx(
              'px-3 py-1 rounded-full text-[11px] font-bold border transition-all',
              leadFilter === st
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
            )}
          >
            {st ? `${st.replace('_', ' ')} (${counts[st] || 0})` : `All (${allLeads.length})`}
          </button>
        ))}
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        >
          <option value="">All service types</option>
          {types.map((t: string) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {leads.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center">
          <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-600">No leads match this filter</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Lead</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Consultant</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Value / Commission</th>
                  <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((l: any) => {
                  const sm = STATUS_META[l.status] || STATUS_META.NEW;
                  const StatusIcon = sm.icon;
                  return (
                    <tr key={l.id} className="hover:bg-slate-50/60 transition-colors align-top">
                      <td className="px-5 py-4">
                        <div className="font-mono text-xs font-bold text-slate-400">{l.lead_no}</div>
                        <div className="font-semibold text-slate-800 text-sm mt-0.5">{l.service_type}</div>
                        {l.requirements && (
                          <div className="text-xs text-slate-400 mt-0.5 max-w-[200px] truncate" title={l.requirements}>
                            {l.requirements}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 mt-1">{fmt(l.created_at)}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-800">{l.customer_name || '—'}</div>
                        {l.customer_phone && (
                          <a href={`tel:${l.customer_phone}`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 mt-0.5">
                            <Phone className="w-3 h-3" /> {l.customer_phone}
                          </a>
                        )}
                        {l.customer_email && (
                          <a href={`mailto:${l.customer_email}`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600">
                            <Mail className="w-3 h-3" /> {l.customer_email}
                          </a>
                        )}
                        {l.city && <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5"><MapPin className="w-3 h-3" /> {l.city}</div>}
                      </td>
                      <td className="px-5 py-4">
                        {l.consultant_name ? (
                          <div>
                            <div className="font-medium text-slate-800">{l.consultant_name}</div>
                            {l.consultant_company && <div className="text-xs text-slate-400">{l.consultant_company}</div>}
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-1 rounded-full">Unassigned</span>
                        )}
                        {l.assigned_at && <div className="text-[10px] text-slate-400 mt-1">Since {fmt(l.assigned_at)}</div>}
                      </td>
                      <td className="px-5 py-4">
                        <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border', sm.bg, sm.color)}>
                          <StatusIcon className="w-3 h-3" />
                          {sm.label}
                        </span>
                        {l.status_note && (
                          <div className="text-[11px] text-slate-400 mt-1.5 max-w-[180px] truncate" title={l.status_note}>{l.status_note}</div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {l.service_value > 0 ? (
                          <>
                            <div className="font-bold text-slate-800">{inr(l.service_value)}</div>
                            <div className="text-[11px] text-slate-400">
                              Platform: {inr(l.platform_earning)} ({l.commission_rate}%)
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Consultant: {inr(l.consultant_payout)}
                            </div>
                            {l.status === 'COMPLETED' && (
                              <div className={clsx('text-[11px] font-bold mt-1', l.payout_status === 'PAID' ? 'text-emerald-600' : 'text-amber-600')}>
                                {l.payout_status === 'PAID' ? '✓ Paid out' : '⏳ Payout pending'}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          <button
                            onClick={() => onView(l)}
                            className="text-xs text-slate-500 hover:text-indigo-600 font-medium flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </button>
                          {['NEW', 'ASSIGNED'].includes(l.status) && (
                            <button
                              onClick={() => onAssign(l)}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                            >
                              <Send className="w-3.5 h-3.5" /> {l.consultant_id ? 'Reassign' : 'Assign'}
                            </button>
                          )}
                          {!['COMPLETED', 'CANCELLED'].includes(l.status) && (
                            <button
                              onClick={() => onCancel(l)}
                              className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════ Consultants Tab ════════════════════ */
function ConsultantsTab({ consultants, search, setSearch, statusFilter, setStatusFilter, onEdit }: any) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search consultants…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
        <div className="flex gap-1">
          {['', 'ACTIVE', 'INACTIVE', 'SUSPENDED'].map(s => (
            <button
              key={s || 'all'}
              onClick={() => setStatusFilter(s)}
              className={clsx(
                'px-3 py-1.5 text-xs font-semibold rounded-full border transition-all',
                statusFilter === s
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
              )}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {consultants.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-600">No consultants found</p>
          <p className="text-sm text-slate-400 mt-1">Try a different search or onboard a new consultant</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {consultants.map((c: any) => {
            const sm = CONSULTANT_STATUS_META[c.status] || CONSULTANT_STATUS_META.ACTIVE;
            return (
              <div
                key={c.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all group"
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center font-black text-indigo-600 text-lg">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm leading-tight">{c.name}</div>
                      {c.company_name && <div className="text-xs text-slate-500">{c.company_name}</div>}
                      {c.city && (
                        <div className="flex items-center gap-0.5 text-[11px] text-slate-400 mt-0.5">
                          <MapPin className="w-2.5 h-2.5" /> {c.city}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className={clsx('text-[10px] font-bold px-2 py-1 rounded-full ring-1', sm.bg, sm.color)}>
                    {c.status}
                  </span>
                </div>

                {/* Services */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {(c.services || []).map((sv: string) => (
                    <span key={sv} className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-semibold border border-indigo-100">
                      {sv}
                    </span>
                  ))}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <MiniStat label="Commission" value={`${c.commission_rate}%`} />
                  <MiniStat label="Active" value={String(c.stats.active_leads)} accent="text-indigo-600" />
                  <MiniStat label="Done" value={String(c.stats.completed_leads)} accent="text-emerald-600" />
                </div>

                {/* Contact */}
                <div className="space-y-1 text-xs text-slate-500 mb-3">
                  {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 hover:text-indigo-600"><Mail className="w-3 h-3" />{c.email}</a>}
                  {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 hover:text-indigo-600"><Phone className="w-3 h-3" />{c.phone}</a>}
                </div>

                {/* Rating & payable */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-amber-500 font-semibold">
                    <Star className="w-3.5 h-3.5 fill-amber-400" /> {c.rating}
                  </div>
                  {c.stats.payable > 0 && (
                    <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-semibold border border-amber-100">
                      Payable: {inr(c.stats.payable)}
                    </span>
                  )}
                </div>

                {/* Edit button */}
                <button
                  onClick={() => onEdit(c)}
                  className="mt-4 w-full py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:border-indigo-300 hover:text-indigo-600 flex items-center justify-center gap-1.5 transition-all group-hover:border-indigo-200"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit Consultant
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════ Earnings Tab ══════════════════════ */
function EarningsTab({ ledger, leads, onMarkPaid, calcValue, setCalcValue, calcRate, setCalcRate, calcResult, calcBusy, onPreview, setCalcResult }: any) {
  const s = ledger?.summary || {};
  const pendingPayouts    = leads.filter((l: any) => l.status === 'COMPLETED' && l.payout_status !== 'PAID');
  const completedLeads    = leads.filter((l: any) => l.status === 'COMPLETED');
  const [ledgerView, setLedgerView] = useState<'consultant' | 'lead'>('consultant');

  /* bar widths for the visual split */
  const totalVal = s.gross_service_value ?? 0;
  const platformPct = totalVal > 0 ? Math.round((s.platform_earning / totalVal) * 100) : 0;
  const consultantPct = 100 - platformPct;

  return (
    <div className="space-y-5">

      {/* ── 5.6 Commission Model Overview ── */}
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 rounded-2xl p-6 text-white shadow-xl shadow-indigo-500/20">
        <div className="flex items-center gap-2 mb-4">
          <BadgePercent className="w-5 h-5 text-indigo-300" />
          <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest">5.6 Commission Management — All Time</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-5">
          {[
            { label: 'Gross Service Value', val: inr(s.gross_service_value ?? 0), sub: `${s.completed_leads ?? 0} completed leads` },
            { label: 'Platform Retained',   val: inr(s.platform_earning ?? 0),    sub: `${platformPct}% of revenue` },
            { label: 'Consultant Payouts',  val: inr(s.consultant_payout ?? 0),   sub: `${consultantPct}% to partners` },
            { label: 'Still Unpaid',        val: inr(s.unpaid_payout ?? 0),       sub: `${pendingPayouts.length} leads pending` },
          ].map(({ label, val, sub }) => (
            <div key={label}>
              <div className="text-indigo-300 text-[11px] font-semibold uppercase tracking-wider">{label}</div>
              <div className="text-2xl font-black mt-1">{val}</div>
              <div className="text-indigo-400 text-[11px] mt-0.5">{sub}</div>
            </div>
          ))}
        </div>
        {/* Visual split bar */}
        {totalVal > 0 && (
          <div>
            <div className="flex text-[11px] font-semibold justify-between mb-1.5">
              <span className="text-emerald-300">Platform: {platformPct}%</span>
              <span className="text-amber-300">Consultant: {consultantPct}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-white/10 overflow-hidden flex">
              <div className="h-full bg-emerald-400 transition-all" style={{ width: `${platformPct}%` }} />
              <div className="h-full bg-amber-400 transition-all" style={{ width: `${consultantPct}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* ── 5.6 Commission Calculator ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Calculator className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Commission Calculator (5.6)</h3>
            <p className="text-xs text-slate-400">Preview the platform/consultant split for any service value</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Service Value ₹</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">₹</span>
              <input
                type="number" min={0} value={calcValue}
                onChange={e => setCalcValue(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full pl-7 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>
          <div className="w-40">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Commission Rate %</label>
            <div className="relative">
              <input
                type="number" min={0} max={100} value={calcRate}
                onChange={e => setCalcRate(e.target.value)}
                className="w-full pr-7 pl-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>
          <button
            disabled={calcBusy}
            onClick={onPreview}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 flex items-center gap-2 transition-all disabled:opacity-60"
          >
            {calcBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
            Calculate
          </button>
        </div>
        {calcResult && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Service Value</p>
              <p className="text-xl font-black text-slate-800 mt-1">{inr(calcResult.service_value)}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Customer pays this</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 text-center">
              <p className="text-[11px] text-emerald-600 uppercase tracking-wider font-semibold">Platform Retains</p>
              <p className="text-xl font-black text-emerald-700 mt-1">{inr(calcResult.platform_earning)}</p>
              <p className="text-[11px] text-emerald-500 mt-0.5">{calcResult.commission_rate}% commission</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 text-center">
              <p className="text-[11px] text-amber-600 uppercase tracking-wider font-semibold">Consultant Gets</p>
              <p className="text-xl font-black text-amber-700 mt-1">{inr(calcResult.consultant_payout)}</p>
              <p className="text-[11px] text-amber-500 mt-0.5">{100 - calcResult.commission_rate}% payout</p>
            </div>
          </div>
        )}
      </div>

      {/* ── 5.7 Earnings Breakdown ── */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-800">Consultant Earnings (5.7)</h3>
            <p className="text-xs text-slate-400 mt-0.5">Admin view: who receives what for every completed engagement</p>
          </div>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setLedgerView('consultant')}
              className={clsx('px-3 py-1 rounded-md text-xs font-semibold transition-all', ledgerView === 'consultant' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
            >
              By Consultant
            </button>
            <button
              onClick={() => setLedgerView('lead')}
              className={clsx('px-3 py-1 rounded-md text-xs font-semibold transition-all', ledgerView === 'lead' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
            >
              Per Lead
            </button>
          </div>
        </div>

        {ledgerView === 'consultant' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Consultant', 'Leads Done', 'Service Value', 'Platform Commission', 'Consultant Payout', 'Unpaid'].map(h => (
                    <th key={h} className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(ledger?.by_consultant || []).length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">No completed work yet</td></tr>
                ) : ledger.by_consultant.map((r: any) => (
                  <tr key={r.consultant_id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-800">{r.consultant_name}</div>
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-600 font-medium">{r.leads}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-800">{inr(r.service_value)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-bold text-emerald-600">{inr(r.platform_earning)}</span>
                      <div className="text-[10px] text-slate-400">{r.service_value > 0 ? Math.round((r.platform_earning/r.service_value)*100) : 0}%</div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-bold text-indigo-600">{inr(r.consultant_payout)}</span>
                      <div className="text-[10px] text-slate-400">{r.service_value > 0 ? Math.round((r.consultant_payout/r.service_value)*100) : 0}%</div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={clsx('font-black text-sm', r.unpaid > 0 ? 'text-amber-600' : 'text-slate-300')}>
                        {inr(r.unpaid)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Per-lead breakdown */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Lead', 'Service', 'Consultant', 'Service Value', 'Platform Keeps', 'Consultant Gets', 'Payout'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {completedLeads.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400">No completed leads yet</td></tr>
                ) : completedLeads.map((l: any) => (
                  <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-mono text-xs font-bold text-slate-400">{l.lead_no}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{fmt(l.completed_at)}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{l.service_type}</span>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-700">{l.consultant_name || '—'}</td>
                    <td className="px-4 py-3.5 text-right font-bold text-slate-800">{inr(l.service_value)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="font-bold text-emerald-600">{inr(l.platform_earning)}</div>
                      <div className="text-[10px] text-slate-400">{l.commission_rate}% rate</div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="font-bold text-indigo-600">{inr(l.consultant_payout)}</div>
                      <div className="text-[10px] text-slate-400">{l.service_value > 0 ? Math.round((l.consultant_payout/l.service_value)*100) : 0}%</div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className={clsx(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold',
                        l.payout_status === 'PAID'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      )}>
                        {l.payout_status === 'PAID' ? '✓ Paid' : '⏳ Pending'}
                      </div>
                      {l.payout_status !== 'PAID' && (
                        <button
                          onClick={() => onMarkPaid(l.id)}
                          className="block mt-1 text-[10px] text-emerald-600 font-bold hover:underline ml-auto"
                        >
                          Mark paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pending Payout Queue ── */}
      {pendingPayouts.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-amber-600" />
              <h3 className="font-bold text-amber-800">Pending Payouts — Action Required</h3>
              <span className="px-2 py-0.5 bg-amber-500 text-white text-[11px] font-black rounded-full">{pendingPayouts.length}</span>
            </div>
            <p className="text-xs text-amber-600">{inr(pendingPayouts.reduce((a: number, l: any) => a + (l.consultant_payout || 0), 0))} outstanding</p>
          </div>
          <div className="divide-y divide-amber-100">
            {pendingPayouts.map((l: any) => (
              <div key={l.id} className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-amber-50/40 transition-colors">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-slate-500">{l.lead_no}</span>
                    <span className="text-xs text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full">{l.service_type}</span>
                  </div>
                  <div className="text-sm font-semibold text-slate-800 mt-0.5">{l.consultant_name}</div>
                  <div className="text-xs text-slate-400">Completed {fmt(l.completed_at)}</div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Consultant receives</div>
                    <div className="font-black text-amber-700 text-lg">{inr(l.consultant_payout)}</div>
                    <div className="text-[10px] text-slate-400">of {inr(l.service_value)}</div>
                  </div>
                  <button
                    onClick={() => onMarkPaid(l.id)}
                    className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm shadow-emerald-500/20 transition-all"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Mark Paid
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════ Lead Detail Modal ═════════════════════════ */
function LeadDetailModal({ lead, onClose }: { lead: any; onClose: () => void }) {
  const sm = STATUS_META[lead.status] || STATUS_META.NEW;
  return (
    <Modal title={`Lead ${lead.lead_no}`} subtitle={lead.service_type} onClose={onClose} wide>
      <div className="space-y-4">
        {/* Status badge */}
        <div className={clsx('inline-flex items-center gap-2 px-3 py-1.5 rounded-full border font-bold text-sm', sm.bg, sm.color)}>
          <sm.icon className="w-4 h-4" /> {sm.label}
          {lead.status_note && <span className="font-normal text-xs">· {lead.status_note}</span>}
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase">Customer</p>
            <p className="font-semibold text-slate-800 mt-1">{lead.customer_name || '—'}</p>
            {lead.customer_phone && <p className="text-slate-500">{lead.customer_phone}</p>}
            {lead.customer_email && <p className="text-slate-500">{lead.customer_email}</p>}
            {lead.city && <p className="text-slate-500">{lead.city}</p>}
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase">Consultant</p>
            <p className="font-semibold text-slate-800 mt-1">{lead.consultant_name || 'Unassigned'}</p>
            {lead.consultant_company && <p className="text-slate-500">{lead.consultant_company}</p>}
            {lead.assigned_at && <p className="text-xs text-slate-400">Assigned {fmt(lead.assigned_at)}</p>}
          </div>
        </div>

        {lead.requirements && (
          <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-700">
            <p className="text-xs text-slate-400 font-semibold uppercase mb-1">Requirements</p>
            {lead.requirements}
          </div>
        )}

        {lead.service_value > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <MiniStat label="Service Value" value={inr(lead.service_value)} />
            <MiniStat label="Platform" value={inr(lead.platform_earning)} accent="text-emerald-600" />
            <MiniStat label="Consultant" value={inr(lead.consultant_payout)} accent="text-indigo-600" />
          </div>
        )}

        {/* Timeline */}
        {lead.events?.length > 0 && (
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase mb-2">Timeline</p>
            <div className="space-y-2">
              {lead.events.map((ev: any, i: number) => {
                const esm = STATUS_META[ev.status];
                return (
                  <div key={i} className="flex gap-3 text-sm">
                    <div className={clsx('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', esm ? `bg-${esm.color.split('-')[1]}-400` : 'bg-slate-300')} />
                    <div>
                      <span className="font-semibold text-slate-700">{esm?.label || ev.status}</span>
                      {ev.note && <span className="text-slate-500"> — {ev.note}</span>}
                      <span className="block text-[11px] text-slate-400">
                        {ev.at ? new Date(ev.at).toLocaleString('en-IN') : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Close</button>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════ Shared Components ═════════════════ */
function KpiCard({ label, value, sub, icon: Icon, gradient }: any) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <div className={clsx('w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm', gradient)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
      <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{label}</div>
      <div className={clsx('text-sm font-black mt-0.5', accent || 'text-slate-800')}>{value}</div>
    </div>
  );
}

function FormField({ label, value, onChange, type = 'text', className = '' }: any) {
  return (
    <label className={clsx('block', className)}>
      <span className="block text-xs font-semibold text-slate-500 mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent transition-all"
      />
    </label>
  );
}

function Modal({ title, subtitle, onClose, children, wide }: any) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={clsx('bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto', wide ? 'w-full max-w-2xl' : 'w-full max-w-md')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white px-6 pt-6 pb-4 border-b border-slate-100 flex justify-between items-start z-10">
          <div>
            <h2 className="text-lg font-black text-slate-900">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors ml-4">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
