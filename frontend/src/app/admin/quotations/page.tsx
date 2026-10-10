'use client';

/**
 * Central quotation search — stakeholder feedback 1.4, 1.5, 1.9, 1.10.
 *
 * Find any quotation by its number, the customer, the project or a GSTIN; jump
 * straight to that customer or project; record an offline bank payment; and
 * turn a paid quotation into a delivery project.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Search, FileText, BadgeCheck, ArrowRightLeft, User, FolderOpen, X, Download } from 'lucide-react';
import { quotationAdminAPI } from '@/lib/api';

const STATUS_STYLES: Record<string, string> = {
  generated: 'bg-slate-100 text-slate-700',
  approved: 'bg-blue-50 text-blue-700',
  under_revision: 'bg-amber-50 text-amber-700',
  rejected: 'bg-rose-50 text-rose-700',
  paid: 'bg-emerald-50 text-emerald-700',
  converted: 'bg-violet-50 text-violet-700',
};

const MODE_LABELS: Record<string, string> = {
  BANK_TRANSFER: 'Bank transfer (NEFT/RTGS/IMPS)',
  UPI: 'UPI',
  CHEQUE: 'Cheque',
  CASH: 'Cash',
  GATEWAY: 'Payment gateway',
};

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export default function AdminQuotationsPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<any | null>(null);
  const [payment, setPayment] = useState({ payment_mode: 'BANK_TRANSFER', payment_reference: '', amount: '', notes: '' });
  const [converting, setConverting] = useState<any | null>(null);
  const [propertyName, setPropertyName] = useState('');
  const [busy, setBusy] = useState(false);

  const search = useCallback(async (q: string, s: string) => {
    setLoading(true);
    try {
      const res = await quotationAdminAPI.search({ q: q || undefined, status: s || undefined });
      setRows(res.data.quotations || []);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get('q') || '';
    setQuery(initial);
    search(initial, '');
  }, [search]);

  // Search as the admin types, without a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => search(query, status), 300);
    return () => clearTimeout(t);
  }, [query, status, search]);

  const markPaid = async () => {
    if (!paying) return;
    setBusy(true);
    try {
      await quotationAdminAPI.markPaid(paying.id, {
        payment_mode: payment.payment_mode,
        payment_reference: payment.payment_reference || undefined,
        amount: payment.amount ? Number(payment.amount) : undefined,
        notes: payment.notes || undefined,
      });
      toast.success(`${paying.quotation_no} marked as paid`);
      setPaying(null);
      search(query, status);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Could not record payment');
    } finally {
      setBusy(false);
    }
  };

  const convert = async () => {
    if (!converting) return;
    setBusy(true);
    try {
      const res = await quotationAdminAPI.convertToProject(converting.id, { property_name: propertyName || undefined });
      toast.success('Project created and sent to the approval queue');
      setConverting(null);
      search(query, status);
      return res.data.project_id as string;
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Conversion failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Quotations</h1>
        <p className="text-slate-500 mt-1">Search every quotation, record offline payments and convert paid quotations into projects.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-3 bg-slate-50">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              type="text"
              placeholder="Quotation no. (QT-2026-00012), customer, phone, email, project or GSTIN"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm">
            <option value="">All statuses</option>
            {Object.keys(STATUS_STYLES).map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-5 py-4 font-medium">Quotation</th>
                <th className="px-5 py-4 font-medium">Customer</th>
                <th className="px-5 py-4 font-medium">Project</th>
                <th className="px-5 py-4 font-medium text-right">Total</th>
                <th className="px-5 py-4 font-medium">Status</th>
                <th className="px-5 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && rows.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Searching…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-500">No quotations match “{query}”.</td></tr>
              ) : rows.map((q) => (
                <tr key={q.id} className="hover:bg-slate-50/50 align-top">
                  <td className="px-5 py-4">
                    <div className="font-mono font-semibold text-slate-900 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-500" /> {q.quotation_no || q.id.slice(0, 8).toUpperCase()}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{q.created_at ? new Date(q.created_at).toLocaleDateString('en-IN') : ''}</div>
                    {q.gst_number && <div className="text-[11px] text-slate-500 font-mono mt-0.5">GSTIN {q.gst_number}</div>}
                  </td>
                  <td className="px-5 py-4">
                    {q.customer?.id ? (
                      <Link href={`/admin/customers?q=${encodeURIComponent(q.customer.email || q.customer.phone || q.customer.name || '')}`}
                        className="text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1">
                        <User className="w-3.5 h-3.5" /> {q.customer.name || q.customer.email}
                      </Link>
                    ) : '—'}
                    {q.customer?.company_name && <div className="text-xs text-slate-500">{q.customer.company_name}</div>}
                    <div className="text-xs text-slate-400">{q.customer?.phone || q.customer?.email}</div>
                  </td>
                  <td className="px-5 py-4">
                    {q.project?.id ? (
                      <Link href={`/admin/projects?q=${encodeURIComponent(q.project.property_name || '')}`}
                        className="text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1">
                        <FolderOpen className="w-3.5 h-3.5" /> {q.project.property_name}
                      </Link>
                    ) : '—'}
                    <div className="text-xs text-slate-400">{q.project?.bhk_type} · {q.project?.city}</div>
                    {q.converted_project_id && (
                      <Link href={`/admin/approvals?project=${q.converted_project_id}`} className="text-[11px] text-violet-600 hover:underline">
                        → execution project
                      </Link>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="font-semibold text-slate-900">{inr(q.total)}</div>
                    {q.discount_amount > 0 && (
                      <div className="text-[11px] text-emerald-600">incl. {inr(q.discount_amount)} discount</div>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className={clsx('inline-flex px-2 py-1 rounded-full text-xs font-medium capitalize', STATUS_STYLES[q.status] || 'bg-slate-100 text-slate-600')}>
                      {q.status?.replace('_', ' ')}
                    </span>
                    {q.paid_at && (
                      <div className="text-[11px] text-slate-400 mt-1">
                        {MODE_LABELS[q.payment_mode] || q.payment_mode}{q.payment_reference ? ` · ${q.payment_reference}` : ''}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-3 justify-end items-center text-sm font-medium">
                      {q.pdf_url && (
                        <a href={q.pdf_url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-700" title="Open PDF">
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                      {!['paid', 'converted'].includes(q.status) && (
                        <button onClick={() => { setPaying(q); setPayment({ payment_mode: 'BANK_TRANSFER', payment_reference: '', amount: String(Math.round(q.total)), notes: '' }); }}
                          className="text-emerald-600 hover:text-emerald-800 inline-flex items-center gap-1">
                          <BadgeCheck className="w-4 h-4" /> Mark paid
                        </button>
                      )}
                      {q.status === 'paid' && !q.converted_project_id && (
                        <button onClick={() => { setConverting(q); setPropertyName(''); }}
                          className="text-violet-600 hover:text-violet-800 inline-flex items-center gap-1">
                          <ArrowRightLeft className="w-4 h-4" /> Convert to project
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {paying && (
        <Modal title={`Record payment — ${paying.quotation_no}`} onClose={() => setPaying(null)}>
          <p className="text-xs text-slate-500 mb-4">
            Use this once the money has reached the bank. The customer is billed in full ({inr(paying.total)}); recording the payment also unlocks their premium renders.
          </p>
          <div className="space-y-3">
            <Field label="Payment mode">
              <select value={payment.payment_mode} onChange={(e) => setPayment({ ...payment, payment_mode: e.target.value })}
                className="w-full border border-slate-200 rounded-lg p-2 text-sm">
                {Object.entries(MODE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Reference (UTR / cheque no. / UPI ref)">
              <input value={payment.payment_reference} onChange={(e) => setPayment({ ...payment, payment_reference: e.target.value })}
                className="w-full border border-slate-200 rounded-lg p-2 text-sm font-mono" />
            </Field>
            <Field label="Amount received (₹)">
              <input type="number" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
                className="w-full border border-slate-200 rounded-lg p-2 text-sm" />
            </Field>
            {payment.amount && Number(payment.amount) !== Math.round(paying.total) && (
              <p className="text-xs text-amber-600">This differs from the quoted total of {inr(paying.total)}.</p>
            )}
            <Field label="Notes">
              <input value={payment.notes} onChange={(e) => setPayment({ ...payment, notes: e.target.value })}
                className="w-full border border-slate-200 rounded-lg p-2 text-sm" />
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setPaying(null)} className="px-4 py-2 text-sm rounded-lg border border-slate-200">Cancel</button>
            <button disabled={busy} onClick={markPaid} className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white disabled:opacity-50">Mark as paid</button>
          </div>
        </Modal>
      )}

      {converting && (
        <Modal title={`Convert ${converting.quotation_no}`} onClose={() => setConverting(null)}>
          <p className="text-xs text-slate-500 mb-4">
            Creates an execution project for {converting.customer?.name || 'the customer'} with every room and item from this quotation.
            The new project goes to the approval queue before a supplier is allocated.
          </p>
          <Field label="Project name (optional)">
            <input placeholder={converting.project?.property_name || 'Project name'} value={propertyName}
              onChange={(e) => setPropertyName(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 text-sm" />
          </Field>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setConverting(null)} className="px-4 py-2 text-sm rounded-lg border border-slate-200">Cancel</button>
            <button disabled={busy} onClick={convert} className="px-4 py-2 text-sm rounded-lg bg-violet-600 text-white disabled:opacity-50">Create project</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
