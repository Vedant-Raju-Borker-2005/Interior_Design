'use client';

import { useEffect, useState } from 'react';
import { adminAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { Settings, Lock, Server, Bell, Shield, Key, Database } from 'lucide-react';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'system' | 'roles' | 'audit'>('system');
  const [editKey, setEditKey] = useState('');
  const [editVal, setEditVal] = useState('');

  // Role assignment
  const [roleUserId, setRoleUserId] = useState('');
  const [roleName, setRoleName] = useState('OPERATIONS_ADMIN');

  const load = async () => {
    setLoading(true);
    try {
      const [settingsRes, logsRes] = await Promise.all([
        adminAPI.getSystemSettings(),
        adminAPI.getAuditLogs(),
      ]);
      setSettings(settingsRes.data || []);
      setAuditLogs(logsRes.data || []);
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleUpdateSetting = async () => {
    if (!editKey || !editVal) { toast.error('Provide key and value'); return; }
    try {
      await adminAPI.updateSystemSetting({ key: editKey, value: editVal, category: 'general' });
      toast.success('Setting updated');
      setEditKey(''); setEditVal('');
      load();
    } catch {
      toast.error('Failed to update setting');
    }
  };

  const handleAssignRole = async () => {
    if (!roleUserId) { toast.error('Enter user ID'); return; }
    try {
      await adminAPI.assignAdminRole({ user_id: roleUserId, role_name: roleName });
      toast.success(`Role ${roleName} assigned`);
      setRoleUserId('');
    } catch {
      toast.error('Failed to assign role');
    }
  };

  const SECTIONS = [
    { id: 'system', label: 'System Config', icon: Server },
    { id: 'roles', label: 'Roles & Permissions', icon: Lock },
    { id: 'audit', label: 'Audit Log', icon: Shield },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">IT Box / Settings</h1>
        <p className="text-slate-500 mt-1">System configuration, user roles and permissions</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-8 w-max">
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setTab(s.id as any)}
            className={`px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${tab === s.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <s.icon className="w-4 h-4" />
            {s.label}
          </button>
        ))}
      </div>

      {/* System Config */}
      {tab === 'system' && (
        <div className="space-y-6">
          {/* Update setting */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><Key className="w-5 h-5 text-indigo-500" /> Update System Setting</h3>
            <div className="flex gap-3 flex-wrap">
              <input type="text" placeholder="Setting key (e.g. MAX_PROJECTS)" value={editKey} onChange={e => setEditKey(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
              <input type="text" placeholder="New value" value={editVal} onChange={e => setEditVal(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
              <button onClick={handleUpdateSetting} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors whitespace-nowrap">
                Update
              </button>
            </div>
          </div>

          {/* Existing settings table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 font-semibold text-slate-900">Current System Settings</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Key</th>
                    <th className="px-5 py-3 font-medium">Value</th>
                    <th className="px-5 py-3 font-medium">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={3} className="py-8 text-center text-slate-500">Loading...</td></tr>
                  ) : settings.length === 0 ? (
                    <tr><td colSpan={3} className="py-8 text-center text-slate-500">No system settings configured</td></tr>
                  ) : (
                    settings.map((s: any) => (
                      <tr key={s.id || s.key} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3 font-mono text-xs text-slate-700">{s.key}</td>
                        <td className="px-5 py-3 text-slate-600">{s.value}</td>
                        <td className="px-5 py-3"><span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">{s.category}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Roles & Permissions */}
      {tab === 'roles' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-8">
          <div>
            <h3 className="font-semibold text-slate-900 mb-1">Assign Admin Role</h3>
            <p className="text-slate-500 text-sm mb-5">Grant or change admin roles for platform users.</p>
            <div className="flex gap-3 flex-wrap">
              <input type="text" placeholder="User ID" value={roleUserId} onChange={e => setRoleUserId(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
              <select value={roleName} onChange={e => setRoleName(e.target.value)}
                className="min-w-[200px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="OPERATIONS_ADMIN">Operations Admin</option>
                <option value="SALES_ADMIN">Sales Admin</option>
                <option value="FINANCE_ADMIN">Finance Admin</option>
              </select>
              <button onClick={handleAssignRole} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                Assign Role
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <h3 className="font-semibold text-slate-900 mb-4">Role Reference</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { role: 'SUPER_ADMIN', desc: 'Full platform access. All modules.' },
                { role: 'OPERATIONS_ADMIN', desc: 'Manage projects, team, vendors.' },
                { role: 'SALES_ADMIN', desc: 'Manage customers, quotations, projects.' },
                { role: 'FINANCE_ADMIN', desc: 'Manage pricing rules, payments, reports.' },
              ].map(r => (
                <div key={r.role} className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <div className="font-semibold text-slate-900 text-sm mb-1">{r.role}</div>
                  <div className="text-xs text-slate-500">{r.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Audit Log */}
      {tab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 font-semibold text-slate-900">System Audit Log</div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Action</th>
                  <th className="px-5 py-3 font-medium">Entity</th>
                  <th className="px-5 py-3 font-medium">Entity ID</th>
                  <th className="px-5 py-3 font-medium">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={4} className="py-8 text-center text-slate-500">Loading...</td></tr>
                ) : auditLogs.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-slate-500">No audit logs</td></tr>
                ) : (
                  auditLogs.slice(0, 100).map((log: any) => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3"><span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full font-mono">{log.action}</span></td>
                      <td className="px-5 py-3 text-slate-600 text-xs">{log.entity_type}</td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-400">{log.entity_id?.substring(0, 10)}</td>
                      <td className="px-5 py-3 text-slate-500 text-xs">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
