'use client';

import { useEffect, useState } from 'react';
import { adminAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { Activity, RefreshCw } from 'lucide-react';

const ACTION_COLOR: Record<string, string> = {
  VENDOR_APPROVED: 'bg-emerald-50 text-emerald-700',
  VENDOR_REJECTED: 'bg-red-50 text-red-700',
  VENDOR_SUSPENDED: 'bg-orange-50 text-orange-700',
  VENDOR_REACTIVATED: 'bg-blue-50 text-blue-700',
  TEAM_MEMBER_APPROVED: 'bg-emerald-50 text-emerald-700',
  TEAM_MEMBER_REJECTED: 'bg-red-50 text-red-700',
  PROJECT_CREATED: 'bg-indigo-50 text-indigo-700',
  PROJECT_CLOSED: 'bg-emerald-50 text-emerald-700',
  PROJECT_CANCELLED: 'bg-red-50 text-red-700',
  PROJECT_EDITED: 'bg-blue-50 text-blue-700',
  QUOTE_CREATED: 'bg-indigo-50 text-indigo-700',
  QUOTE_APPROVED: 'bg-emerald-50 text-emerald-700',
  CUSTOMER_SUSPENDED: 'bg-red-50 text-red-700',
  CUSTOMER_REACTIVATED: 'bg-emerald-50 text-emerald-700',
};

export default function AdminActivityLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getAuditLogs();
      setLogs(res.data || []);
    } catch {
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Activity Log</h1>
          <p className="text-slate-500 mt-1">All admin actions across the platform</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-5 py-4 font-medium">Action</th>
                <th className="px-5 py-4 font-medium">Entity Type</th>
                <th className="px-5 py-4 font-medium">Entity ID</th>
                <th className="px-5 py-4 font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={4} className="py-10 text-center text-slate-500">Loading activity logs...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={4} className="py-10 text-center">
                  <Activity className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">No activity logs yet</p>
                </td></tr>
              ) : (
                logs.slice(0, 200).map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium font-mono ${ACTION_COLOR[log.action] || 'bg-slate-100 text-slate-600'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-xs">{log.entity_type}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-400">{log.entity_id?.substring(0, 12)}...</td>
                    <td className="px-5 py-3 text-slate-400 text-xs">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
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
