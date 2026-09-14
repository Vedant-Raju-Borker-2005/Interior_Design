'use client';

/**
 * Special services — stakeholder feedback section 5.
 *
 * The platform refers work to partner consultants and keeps a commission
 * (5.8). Admins keep the consultant directory (5.1/5.2), route each inquiry to
 * a consultant registered for that service (5.3), watch the status the
 * consultant updates (5.5) and see what is owed to whom (5.6/5.7).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Handshake, UserPlus, Inbox, Wallet, X, Star, Send } from 'lucide-react';
import { specialServicesAPI } from '@/lib/api';

const LEAD_TONE: Record<string, string> = {
  NEW: 'bg-amber-50 text-amber-700',
  ASSIGNED: 'bg-indigo-50 text-indigo-700',
  CONTACTED: 'bg-sky-50 text-sky-700',
  IN_PROGRESS: 'bg-violet-50 text-violet-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const EMPTY_CONSULTANT = { name: '', company_name: '', email: '', phone: '', city: '', services: [] as string[], commission_rate: '15', notes: '' };

export default function AdminSpecialServicesPage() {
  const [tab, setTab] = useState<'leads' | 'consultants' | 'earnings'>('leads');
  const [types, setTypes] = useState<string[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [consultants, setConsultants] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any>(null);
  const [leadFilter, setLeadFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const [assigning, setAssigning] = useState<any | null>(null);
  const [consultantId, setConsultantId] = useState('');
  const [onboarding, setOnboarding] = useState(false);
  const [form, setForm] = useState(EMPTY_CONSULTANT);
  const [busy, setBusy] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
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
      toast.error(err?.response?.data?.detail || 'Failed to load special services');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const filteredLeads = useMemo(
    () => leads.filter((l) => !leadFilter || l.status === leadFilter),
    [leads, leadFilter],
  );

  // Only consultants registered for the lead's service, and active, can take it.
  const eligible = useMemo(
    () => (assigning ? consultants.filter((c) => c.status === 'ACTIVE' && c.services.includes(assigning.service_type)) : []),
    [assigning, consultants],
  );

  const assign = async () => {
    if (!assigning || !consultantId) return;
    setBusy(true);
    try {
      await specialServicesAPI.assign(assigning.id, consultantId);
      toast.success(`${assigning.lead_no} assigned`);
      setAssigning(null);
      loadAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Assignment failed');
    } finally {
      setBusy(false);
    }
  };

  const onboard = async () => {
    if (!form.name.trim()) { toast.error('Consultant name is required'); return; }
    if (form.services.length === 0) { toast.error('Pick at least one service'); return; }
    setBusy(true);
    try {
      await specialServicesAPI.createConsultant({ ...form, commission_rate: Number(form.commission_rate) || 0 });
      toast.success(`${form.name} onboarded — they can now sign in with ${form.email || form.phone}`);
      setOnboarding(false);
      setForm(EMPTY_CONSULTANT);
      loadAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Onboarding failed');
    } finally {
      setBusy(false);
    }
  };

  const markPayout = async (leadId: string) => {
    try {
      await specialServicesAPI.updatePayout(leadId, 'PAID');
      toast.success('Payout recorded');
      loadAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Could not update payout');
    }
  };

  const s = ledger?.summary || {};

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="mb-6 flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Special Services</h1>
          <p className="text-slate-500 mt-1">Partner-delivered house design, surveys, vending and measured drawings — the platform refers and earns commission.</p>
        </div>
        <button onClick={() => setOnboarding(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 flex items-center gap-2">
          <UserPlus className="w-4 h-4" /> Onboard consultant
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi label="Open leads" value={String(leads.filter((l) => !['COMPLETED', 'CANCELLED'].includes(l.status)).length)} />
        <Kpi label="Service value (completed)" value={inr(s.gross_service_value)} />
        <Kpi label="Platform commission" value={inr(s.platform_earning)} tone="text-emerald-600" />
        <Kpi label="Owed to consultants" value={inr(s.unpaid_payout)} tone="text-amber-600" />
      </div>

      <div className="flex gap-2 mb-4">
        {[
          { id: 'leads', label: `Leads (${leads.length})`, icon: Inbox },
          { id: 'consultants', label: `Consultants (${consultants.length})`, icon: Handshake },
          { id: 'earnings', label: 'Commission ledger', icon: Wallet },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={clsx('px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5',
              tab === t.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500">Loading…</div>
      ) : tab === 'leads' ? (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-3 border-b border-slate-200 bg-slate-50 flex gap-2 flex-wrap">
            {['', 'NEW', 'ASSIGNED', 'CONTACTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((st) => (
              <button key={st || 'all'} onClick={() => setLeadFilter(st)}
                className={clsx('px-2.5 py-1 rounded-full text-[11px] font-medium border',
                  leadFilter === st ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200')}>
                {st ? st.replace('_', ' ') : 'All'}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Lead</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Consultant</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Value / commission</th>
                  <th className="px-5 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-500">No leads.</td></tr>
                ) : filteredLeads.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/50 align-top">
                    <td className="px-5 py-3">
                      <div className="font-mono font-semibold text-slate-800">{l.lead_no}</div>
                      <div className="text-xs text-indigo-600 font-medium">{l.service_type}</div>
                      {l.requirements && <div className="text-xs text-slate-400 max-w-[220px] truncate" title={l.requirements}>{l.requirements}</div>}
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-slate-700">{l.customer_name || '—'}</div>
                      <div className="text-xs text-slate-400">{l.customer_phone || l.customer_email} {l.city ? `· ${l.city}` : ''}</div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{l.consultant_name || <span className="text-slate-400">Unassigned</span>}</td>
                    <td className="px-5 py-3">
                      <span className={clsx('inline-flex px-2 py-1 rounded-full text-xs font-medium', LEAD_TONE[l.status])}>{l.status.replace('_', ' ')}</span>
                      {l.status_note && <div className="text-[11px] text-slate-400 mt-1 max-w-[200px] truncate" title={l.status_note}>{l.status_note}</div>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="font-medium text-slate-800">{l.service_value ? inr(l.service_value) : '—'}</div>
                      {l.service_value > 0 && (
                        <div className="text-[11px] text-slate-500">{l.commission_rate}% · platform {inr(l.platform_earning)}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {['NEW', 'ASSIGNED'].includes(l.status) && (
                        <button onClick={() => { setAssigning(l); setConsultantId(l.consultant_id || ''); }}
                          className="text-indigo-600 hover:text-indigo-800 text-sm font-medium inline-flex items-center gap-1">
                          <Send className="w-3.5 h-3.5" /> {l.consultant_id ? 'Reassign' : 'Assign'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === 'consultants' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {consultants.length === 0 && (
            <div className="col-span-full bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-500">
              No partner consultants yet. Onboard one to start routing leads.
            </div>
          )}
          {consultants.map((c) => (
            <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-slate-900">{c.name}</div>
                  <div className="text-xs text-slate-500">{c.company_name}{c.city ? ` · ${c.city}` : ''}</div>
                </div>
                <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold', c.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>{c.status}</span>
              </div>
              <div className="flex flex-wrap gap-1 mt-3">
                {c.services.map((sv: string) => <span key={sv} className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px]">{sv}</span>)}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                <Mini label="Commission" value={`${c.commission_rate}%`} />
                <Mini label="Active" value={String(c.stats.active_leads)} />
                <Mini label="Done" value={String(c.stats.completed_leads)} />
              </div>
              <div className="flex justify-between items-center mt-4 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Star className="w-3 h-3 text-amber-400 fill-amber-400" /> {c.rating}</span>
                <span>{c.email || c.phone}</span>
              </div>
              {c.stats.payable > 0 && (
                <div className="mt-3 text-xs bg-amber-50 text-amber-700 rounded-lg px-3 py-2">Payable: {inr(c.stats.payable)}</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Consultant</th>
                <th className="px-5 py-3 font-medium text-right">Completed leads</th>
                <th className="px-5 py-3 font-medium text-right">Service value</th>
                <th className="px-5 py-3 font-medium text-right">Platform commission</th>
                <th className="px-5 py-3 font-medium text-right">Payable to consultant</th>
                <th className="px-5 py-3 font-medium text-right">Unpaid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(ledger?.by_consultant || []).length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-500">No completed special-service work yet.</td></tr>
              ) : ledger.by_consultant.map((r: any) => (
                <tr key={r.consultant_id}>
                  <td className="px-5 py-3 font-medium text-slate-800">{r.consultant_name}</td>
                  <td className="px-5 py-3 text-right">{r.leads}</td>
                  <td className="px-5 py-3 text-right">{inr(r.service_value)}</td>
                  <td className="px-5 py-3 text-right text-emerald-600 font-medium">{inr(r.platform_earning)}</td>
                  <td className="px-5 py-3 text-right">{inr(r.consultant_payout)}</td>
                  <td className="px-5 py-3 text-right text-amber-600 font-medium">{inr(r.unpaid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {leads.some((l) => l.status === 'COMPLETED' && l.payout_status !== 'PAID') && (
            <div className="border-t border-slate-200 p-4">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Payouts due</div>
              <ul className="space-y-2">
                {leads.filter((l) => l.status === 'COMPLETED' && l.payout_status !== 'PAID').map((l) => (
                  <li key={l.id} className="flex justify-between items-center text-sm bg-slate-50 rounded-lg px-3 py-2">
                    <span><span className="font-mono">{l.lead_no}</span> · {l.consultant_name} · {inr(l.consultant_payout)}</span>
                    <button onClick={() => markPayout(l.id)} className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold">Mark paid</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {assigning && (
        <Modal title={`Assign ${assigning.lead_no}`} onClose={() => setAssigning(null)}>
          <p className="text-xs text-slate-500 mb-3">{assigning.service_type} · {assigning.city || 'city not given'}</p>
          {eligible.length === 0 ? (
            <p className="text-sm text-amber-600">No active consultant offers {assigning.service_type}. Onboard one first.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {eligible.map((c) => (
                <label key={c.id} className={clsx('flex items-center justify-between gap-3 border rounded-lg p-3 cursor-pointer',
                  consultantId === c.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200')}>
                  <span className="flex items-center gap-2">
                    <input type="radio" name="consultant" checked={consultantId === c.id} onChange={() => setConsultantId(c.id)} />
                    <span>
                      <span className="block text-sm font-medium text-slate-800">{c.name}</span>
                      <span className="block text-xs text-slate-500">{c.city || '—'} · {c.stats.active_leads} active</span>
                    </span>
                  </span>
                  <span className="text-xs text-slate-500">{c.commission_rate}% commission</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setAssigning(null)} className="px-4 py-2 text-sm rounded-lg border border-slate-200">Cancel</button>
            <button disabled={busy || !consultantId} onClick={assign} className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white disabled:opacity-50">Assign</button>
          </div>
        </Modal>
      )}

      {onboarding && (
        <Modal title="Onboard a partner consultant" onClose={() => setOnboarding(false)}>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Input label="Company" value={form.company_name} onChange={(v) => setForm({ ...form, company_name: v })} />
            <Input label="Email (sign-in)" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <Input label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <Input label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
            <Input label="Platform commission %" type="number" value={form.commission_rate} onChange={(v) => setForm({ ...form, commission_rate: v })} />
          </div>
          <div className="mt-3">
            <span className="block text-xs font-medium text-slate-500 mb-1">Services offered *</span>
            <div className="flex flex-wrap gap-2">
              {types.map((t) => {
                const on = form.services.includes(t);
                return (
                  <button type="button" key={t}
                    onClick={() => setForm({ ...form, services: on ? form.services.filter((x) => x !== t) : [...form.services, t] })}
                    className={clsx('px-3 py-1.5 rounded-full text-xs border', on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200')}>
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
          <Input label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
          <p className="text-[11px] text-slate-400 mt-2">An account with the consultant role is created (or linked) so they can sign in and update their own leads.</p>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setOnboarding(false)} className="px-4 py-2 text-sm rounded-lg border border-slate-200">Cancel</button>
            <button disabled={busy} onClick={onboard} className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white disabled:opacity-50">Onboard</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</div>
      <div className={clsx('text-xl font-bold mt-1', tone || 'text-slate-900')}>{value}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-lg py-2">
      <div className="text-[10px] text-slate-400 uppercase">{label}</div>
      <div className="text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block mt-2">
      <span className="block text-xs font-medium text-slate-500 mb-1">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 text-sm" />
    </label>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
