'use client';

import { useEffect, useState } from 'react';
import { adminAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { ShieldCheck, RefreshCw, Search, User, AlertTriangle, CheckCircle, XCircle, Settings } from 'lucide-react';

const ACTION_BADGE: Record<string, string> = {
  VENDOR_APPROVED: 'bg-emerald-100 text-emerald-700',
  VENDOR_REJECTED: 'bg-red-100 text-red-700',
  VENDOR_SUSPENDED: 'bg-orange-100 text-orange-700',
  VENDOR_REACTIVATED: 'bg-blue-100 text-blue-700',
  TEAM_MEMBER_APPROVED: 'bg-emerald-100 text-emerald-700',
  TEAM_MEMBER_REJECTED: 'bg-red-100 text-red-700',
  PROJECT_CREATED: 'bg-indigo-100 text-indigo-700',
  PROJECT_CLOSED: 'bg-emerald-100 text-emerald-700',
  PROJECT_CANCELLED: 'bg-red-100 text-red-700',
  QUOTE_APPROVED: 'bg-emerald-100 text-emerald-700',
  CUSTOMER_SUSPENDED: 'bg-red-100 text-red-700',
  CUSTOMER_REACTIVATED: 'bg-emerald-100 text-emerald-700',
  RESOURCE_ASSIGNED: 'bg-blue-100 text-blue-700',
};

export default function AdminAuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getAuditLogs();
      setLogs(res.data || []);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = logs.filter(l =>
    (!entityFilter || l.entity_type === entityFilter) &&
    (!search ||
      l.action?.toLowerCase().includes(search.toLowerCase()) ||
      l.entity_type?.toLowerCase().includes(search.toLowerCase()) ||
      l.entity_id?.toLowerCase().includes(search.toLowerCase()) ||
      l.user_name?.toLowerCase().includes(search.toLowerCase()))
  );

  const entityTypes = Array.from(new Set(logs.map((l: any) => l.entity_type).filter(Boolean)));

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Audit Log</h1>
          <p className="text-slate-500 mt-1">Complete immutable record of all admin and system actions</p>
        </div>
        <div className="flex gap-3">
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
        <div className="bg-white border border-slate-200 rounded-xl p-4 min-w-[160px] flex items-center gap-3">
          <ShieldCheck className="w-9 h-9 text-indigo-500" />
          <div>
            <div className="text-2xl font-bold text-slate-900">{logs.length}</div>
            <div className="text-xs text-slate-500 font-medium">Total Entries</div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 min-w-[160px] flex items-center gap-3">
          <ShieldCheck className="w-9 h-9 text-emerald-500" />
          <div>
            <div className="text-2xl font-bold text-slate-900">{logs.filter(l => l.entity_type === 'Vendor').length}</div>
            <div className="text-xs text-slate-500 font-medium">Vendor Actions</div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 min-w-[160px] flex items-center gap-3">
          <ShieldCheck className="w-9 h-9 text-blue-500" />
          <div>
            <div className="text-2xl font-bold text-slate-900">{logs.filter(l => l.entity_type === 'Project').length}</div>
            <div className="text-xs text-slate-500 font-medium">Project Actions</div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 min-w-[160px] flex items-center gap-3">
          <ShieldCheck className="w-9 h-9 text-amber-500" />
          <div>
            <div className="text-2xl font-bold text-slate-900">{logs.filter(l => l.entity_type === 'User').length}</div>
            <div className="text-xs text-slate-500 font-medium">User Actions</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 bg-slate-50 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Filter by action, entity, user..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <button onClick={() => setEntityFilter('')} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${!entityFilter ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>All</button>
            {entityTypes.map((et: string) => (
              <button key={et} onClick={() => setEntityFilter(et)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${entityFilter === et ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{et}</button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-5 py-4 font-medium">#</th>
                <th className="px-5 py-4 font-medium">Action</th>
                <th className="px-5 py-4 font-medium">Entity Type</th>
                <th className="px-5 py-4 font-medium">Entity ID</th>
                <th className="px-5 py-4 font-medium">Performed By</th>
                <th className="px-5 py-4 font-medium">Performed At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="py-10 text-center text-slate-500">Loading audit logs...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-slate-500">No matching audit entries</td></tr>
              ) : (
                filtered.slice(0, 200).map((log: any, idx: number) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3 text-slate-400 text-xs">{idx + 1}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-mono font-medium ${ACTION_BADGE[log.action] || 'bg-slate-100 text-slate-600'}`}>{log.action}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-xs font-medium">{log.entity_type}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-400">{log.entity_id?.substring(0, 16)}...</td>
                    <td className="px-5 py-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">{(log.user_name || 'S')[0]}</div>
                        <span className="text-slate-700 font-medium">{log.user_name || 'System'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' }) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
