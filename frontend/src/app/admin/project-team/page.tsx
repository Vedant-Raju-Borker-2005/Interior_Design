'use client';

import { useEffect, useState } from 'react';
import { adminAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { Users, Search, CheckCircle2, Clock, XCircle, UserCheck, X, Briefcase, MapPin } from 'lucide-react';

export default function AdminProjectTeamPage() {
  const [pendingMembers, setPendingMembers] = useState<any[]>([]);
  const [allTeam, setAllTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('pending');

  const load = async () => {
    setLoading(true);
    try {
      const [pendingRes, allRes] = await Promise.all([
        adminAPI.getTeamApprovals(),
        adminAPI.projects(),
      ]);
      setPendingMembers(pendingRes.data || []);
    } catch {
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      if (action === 'approve') await adminAPI.approveTeamMember(id);
      else await adminAPI.rejectTeamMember(id);
      toast.success(`Team member ${action}d`);
      load();
    } catch {
      toast.error(`Failed to ${action} team member`);
    }
  };

  const filtered = pendingMembers.filter(m =>
    m.name?.toLowerCase().includes(search.toLowerCase()) ||
    m.email?.toLowerCase().includes(search.toLowerCase()) ||
    m.role?.toLowerCase().includes(search.toLowerCase())
  );

  const ROLE_COLORS: Record<string, string> = {
    team_manager: 'bg-indigo-50 text-indigo-700',
    team_coordinator: 'bg-blue-50 text-blue-700',
    team_technician: 'bg-teal-50 text-teal-700',
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Project Team Management</h1>
        <p className="text-slate-500 mt-1">Manage project teams, roles and assignments</p>
      </div>

      {/* Stat Cards */}
      <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
        <div className="bg-white border border-slate-200 rounded-xl p-4 min-w-[180px] flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{pendingMembers.length}</div>
            <div className="text-xs text-slate-500 font-medium">Pending Approvals</div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 min-w-[180px] flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{pendingMembers.filter(m => m.role?.includes('manager')).length}</div>
            <div className="text-xs text-slate-500 font-medium">Project Managers</div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 min-w-[180px] flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{pendingMembers.filter(m => m.role?.includes('technician')).length}</div>
            <div className="text-xs text-slate-500 font-medium">Technicians</div>
          </div>
        </div>
      </div>

      {/* Pending Approvals Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-4 items-center bg-slate-50">
          <div>
            <h2 className="font-semibold text-slate-900">Pending Team Registrations</h2>
            <p className="text-xs text-slate-500 mt-0.5">Approve or reject new project team members</p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, role..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium">City</th>
                <th className="px-6 py-4 font-medium">Registered</th>
                <th className="px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center">
                  <UserCheck className="w-10 h-10 text-emerald-300 mx-auto mb-2" />
                  <p className="text-slate-500 font-medium">No pending approvals!</p>
                </td></tr>
              ) : (
                filtered.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{m.name}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[m.role] || 'bg-slate-100 text-slate-600'}`}>
                        {m.role?.replace('team_', '').replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{m.email}</td>
                    <td className="px-6 py-4 text-slate-500">{m.city || '-'}</td>
                    <td className="px-6 py-4 text-slate-500 text-xs">{m.created_at ? new Date(m.created_at).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4 flex gap-3">
                      <button onClick={() => handleAction(m.id, 'approve')} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button onClick={() => handleAction(m.id, 'reject')} className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-100 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
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
