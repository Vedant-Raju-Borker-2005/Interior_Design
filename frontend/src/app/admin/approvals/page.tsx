'use client';

/**
 * Admin approval queue — stakeholder feedback 4.2–4.5 and 2.1–2.4.
 *
 * Every project waits here for an explicit decision (no straight-through flow
 * after payment), is then allocated to a supplier, and — for bulk B2B work —
 * can carry a project-level discount shown as original vs discounted per unit.
 */
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  CheckCircle2, XCircle, Clock, Truck, History, Percent, X,
} from 'lucide-react';
import { adminAPI, approvalsAPI } from '@/lib/api';
import BulkPricingCard from '@/components/BulkPricingCard';

type QueueProject = {
  id: string;
  property_name: string;
  bhk_type: string;
  city: string;
  budget: number;
  status: string;
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejection_reason?: string | null;
  allocated_vendor_id?: string | null;
  allocated_vendor_name?: string | null;
  total_units: number;
  customer: { id: string; name: string; email: string; phone: string };
  created_at: string;
};

const TABS = ['PENDING', 'APPROVED', 'REJECTED'] as const;

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export default function AdminApprovalsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('PENDING');
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [projects, setProjects] = useState<QueueProject[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<any[]>([]);

  const [rejecting, setRejecting] = useState<QueueProject | null>(null);
  const [reason, setReason] = useState('');
  const [allocating, setAllocating] = useState<QueueProject | null>(null);
  const [vendorId, setVendorId] = useState('');
  const [historyFor, setHistoryFor] = useState<QueueProject | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [pricingFor, setPricingFor] = useState<QueueProject | null>(null);
  const [pricing, setPricing] = useState<any>(null);
  const [discount, setDiscount] = useState({ discount_type: 'FLAT_PER_UNIT', discount_value: '', note: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await approvalsAPI.queue({ status: tab, include_drafts: includeDrafts });
      setProjects(res.data.projects || []);
      setCounts(res.data.counts || {});
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to load approval queue');
    } finally {
      setLoading(false);
    }
  }, [tab, includeDrafts]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    adminAPI.getVendors({ status: 'APPROVED' })
      .then((r: any) => setVendors((Array.isArray(r.data) ? r.data : r.data?.vendors || []).filter((v: any) => v.status === 'APPROVED')))
      .catch(() => {});
  }, []);

  // Deep link from quotation search: /admin/approvals?project=<id>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('project');
    if (!id) return;
    approvalsAPI.queue({ status: 'ALL', include_drafts: true }).then((r) => {
      const hit = (r.data.projects || []).find((p: QueueProject) => p.id === id);
      if (hit) {
        setTab(hit.approval_status);
        setIncludeDrafts(hit.status === 'draft');
      }
    }).catch(() => {});
  }, []);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await load();
      return true;
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Action failed');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openHistory = async (p: QueueProject) => {
    setHistoryFor(p);
    setHistory([]);
    try {
      const r = await approvalsAPI.history(p.id);
      setHistory(r.data.events || []);
    } catch { /* drawer shows empty state */ }
  };

  const openPricing = async (p: QueueProject) => {
    setPricingFor(p);
    setPricing(null);
    try {
      const r = await approvalsAPI.pricing(p.id);
      setPricing(r.data);
      if (r.data.discount_type) {
        setDiscount({ discount_type: r.data.discount_type, discount_value: String(r.data.discount_value || ''), note: r.data.discount_note || '' });
      } else {
        setDiscount({ discount_type: 'FLAT_PER_UNIT', discount_value: '', note: '' });
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to load pricing');
    }
  };

  const applyDiscount = async () => {
    if (!pricingFor) return;
    const value = Number(discount.discount_value);
    if (!value || value < 0) { toast.error('Enter a discount value'); return; }
    setBusy(true);
    try {
      const r = await approvalsAPI.setDiscount(pricingFor.id, { ...discount, discount_value: value });
      setPricing(r.data);
      toast.success('Discount applied');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Could not apply discount');
    } finally {
      setBusy(false);
    }
  };

  const clearDiscount = async () => {
    if (!pricingFor) return;
    setBusy(true);
    try {
      const r = await approvalsAPI.clearDiscount(pricingFor.id);
      setPricing(r.data);
      setDiscount({ discount_type: 'FLAT_PER_UNIT', discount_value: '', note: '' });
      toast.success('Discount removed');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Could not remove discount');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8 flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Project Approvals</h1>
          <p className="text-slate-500 mt-1">Approve or reject incoming projects, then allocate each approved project to a supplier.</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <input type="checkbox" checked={includeDrafts} onChange={(e) => setIncludeDrafts(e.target.checked)} className="rounded" />
          Include un-quoted onboarding drafts
        </label>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              tab === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
            )}
          >
            {t === 'PENDING' ? 'Awaiting decision' : t === 'APPROVED' ? 'Approved' : 'Rejected'} ({counts[t] ?? 0})
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-5 py-4 font-medium">Project</th>
                <th className="px-5 py-4 font-medium">Customer</th>
                <th className="px-5 py-4 font-medium">Budget</th>
                <th className="px-5 py-4 font-medium">Stage</th>
                <th className="px-5 py-4 font-medium">Supplier</th>
                <th className="px-5 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Loading…</td></tr>
              ) : projects.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                  {tab === 'PENDING' ? 'Nothing is waiting for approval.' : 'No projects here.'}
                </td></tr>
              ) : projects.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-4">
                    <div className="font-medium text-slate-900">{p.property_name}</div>
                    <div className="text-xs text-slate-400">
                      {p.bhk_type} · {p.city}
                      {p.total_units > 1 && <span className="ml-1 text-indigo-600 font-semibold">· {p.total_units} units (B2B)</span>}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-slate-700">{p.customer?.name || '—'}</div>
                    <div className="text-xs text-slate-400">{p.customer?.email || p.customer?.phone}</div>
                  </td>
                  <td className="px-5 py-4 text-slate-700 font-medium">{inr(p.budget)}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 capitalize">{p.status}</span>
                    {p.approval_status === 'REJECTED' && p.rejection_reason && (
                      <div className="text-[11px] text-rose-600 mt-1 max-w-[220px] truncate" title={p.rejection_reason}>{p.rejection_reason}</div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {p.allocated_vendor_name
                      ? <span className="inline-flex items-center gap-1 text-emerald-700 font-medium"><Truck className="w-3.5 h-3.5" /> {p.allocated_vendor_name}</span>
                      : <span className="text-slate-400">{p.approval_status === 'APPROVED' ? 'Not allocated' : '—'}</span>}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-3 justify-end items-center text-sm font-medium">
                      {p.approval_status !== 'APPROVED' && (
                        <button disabled={busy} onClick={() => act(() => approvalsAPI.approve(p.id), 'Project approved')}
                          className="text-emerald-600 hover:text-emerald-800 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Approve</button>
                      )}
                      {p.approval_status === 'PENDING' && (
                        <button disabled={busy} onClick={() => { setRejecting(p); setReason(''); }}
                          className="text-rose-600 hover:text-rose-800 flex items-center gap-1"><XCircle className="w-4 h-4" /> Reject</button>
                      )}
                      {p.approval_status === 'APPROVED' && (
                        <button disabled={busy} onClick={() => { setAllocating(p); setVendorId(p.allocated_vendor_id || ''); }}
                          className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><Truck className="w-4 h-4" /> {p.allocated_vendor_id ? 'Re-allocate' : 'Allocate'}</button>
                      )}
                      <button onClick={() => openPricing(p)} className="text-slate-600 hover:text-slate-900 flex items-center gap-1"><Percent className="w-4 h-4" /> Pricing</button>
                      <button onClick={() => openHistory(p)} className="text-slate-400 hover:text-slate-700" title="Decision history"><History className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject — reason is required */}
      {rejecting && (
        <Modal title={`Reject ${rejecting.property_name}`} onClose={() => setRejecting(null)}>
          <label className="block text-xs font-medium text-slate-500 mb-1">Reason (shared with the team)</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
            className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20" />
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setRejecting(null)} className="px-4 py-2 text-sm rounded-lg border border-slate-200">Cancel</button>
            <button disabled={busy || !reason.trim()}
              onClick={async () => { if (await act(() => approvalsAPI.reject(rejecting.id, reason), 'Project rejected')) setRejecting(null); }}
              className="px-4 py-2 text-sm rounded-lg bg-rose-600 text-white disabled:opacity-50">Reject project</button>
          </div>
        </Modal>
      )}

      {/* Allocate — approved suppliers only */}
      {allocating && (
        <Modal title={`Allocate ${allocating.property_name}`} onClose={() => setAllocating(null)}>
          <p className="text-xs text-slate-500 mb-3">The supplier will see this project's items in their portal as soon as it is allocated.</p>
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}
            className="w-full border border-slate-200 rounded-lg p-2 text-sm">
            <option value="">Select an approved supplier…</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.business_name || v.name}</option>)}
          </select>
          {vendors.length === 0 && <p className="text-xs text-amber-600 mt-2">No approved suppliers yet — approve one under Vendors first.</p>}
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setAllocating(null)} className="px-4 py-2 text-sm rounded-lg border border-slate-200">Cancel</button>
            <button disabled={busy || !vendorId}
              onClick={async () => { if (await act(() => approvalsAPI.allocate(allocating.id, vendorId), 'Supplier allocated')) setAllocating(null); }}
              className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white disabled:opacity-50">Allocate</button>
          </div>
        </Modal>
      )}

      {/* History */}
      {historyFor && (
        <Modal title="Decision history" onClose={() => setHistoryFor(null)}>
          {history.length === 0 ? (
            <p className="text-sm text-slate-400">No decisions recorded yet.</p>
          ) : (
            <ol className="space-y-3">
              {history.map((e, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <Clock className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium text-slate-800">{e.action}</div>
                    {e.reason && <div className="text-slate-500 text-xs">{e.reason}</div>}
                    <div className="text-slate-400 text-[11px]">{e.at ? new Date(e.at).toLocaleString() : ''}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Modal>
      )}

      {/* B2B pricing & discount */}
      {pricingFor && (
        <Modal title={`Pricing — ${pricingFor.property_name}`} onClose={() => setPricingFor(null)} wide>
          {!pricing ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : (
            <div className="space-y-5">
              <BulkPricingCard projectId={pricingFor.id} data={pricing} />
              {pricing.discount_inherited && (
                <p className="text-xs text-indigo-600">This unit inherits the discount set on its development. Set a discount here only to override it.</p>
              )}

              <div className="border border-slate-200 rounded-xl p-4">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Bulk discount</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select value={discount.discount_type} onChange={(e) => setDiscount({ ...discount, discount_type: e.target.value })}
                    className="border border-slate-200 rounded-lg p-2 text-sm">
                    <option value="FLAT_PER_UNIT">₹ off per unit</option>
                    <option value="PERCENT">% off</option>
                    <option value="FLAT_TOTAL">₹ off total</option>
                  </select>
                  <input type="number" min={0} placeholder={discount.discount_type === 'PERCENT' ? 'e.g. 20' : 'e.g. 500000'}
                    value={discount.discount_value} onChange={(e) => setDiscount({ ...discount, discount_value: e.target.value })}
                    className="border border-slate-200 rounded-lg p-2 text-sm" />
                  <input placeholder="Note (optional)" value={discount.note} onChange={(e) => setDiscount({ ...discount, note: e.target.value })}
                    className="border border-slate-200 rounded-lg p-2 text-sm" />
                </div>
                <p className="text-[11px] text-slate-400 mt-2">Product prices are not changed — the discount is applied at project level and printed on the quotation.</p>
                <div className="flex justify-end gap-2 mt-3">
                  {pricing.discount_amount > 0 && (
                    <button disabled={busy} onClick={clearDiscount} className="px-3 py-2 text-sm rounded-lg border border-slate-200">Remove discount</button>
                  )}
                  <button disabled={busy} onClick={applyDiscount} className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white disabled:opacity-50">Apply discount</button>
                </div>
              </div>

              {pricing.customisations?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Customisations in scope</div>
                  <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                    {pricing.customisations.map((c: any, i: number) => (
                      <li key={i} className="text-xs bg-slate-50 rounded-lg px-3 py-2 flex justify-between gap-3">
                        <span><span className="font-medium text-slate-700">{c.product}</span> <span className="text-slate-400">· {c.room?.replace(/_/g, ' ')} × {c.qty}</span></span>
                        <span className="text-slate-500 text-right">{Object.entries(c.customisations).map(([k, v]) => `${k.replace('_', ' ')}: ${v}`).join(' · ')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={clsx('bg-white w-full rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto', wide ? 'max-w-2xl' : 'max-w-md')}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
