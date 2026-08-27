'use client';

import { useEffect, useState } from 'react';
import { adminAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { FileText, Search, Plus, Filter, X, CheckCircle2, Clock, XCircle, AlertCircle, Users } from 'lucide-react';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  quoted: 'bg-amber-50 text-amber-700',
  ordered: 'bg-blue-50 text-blue-700',
  done: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-red-50 text-red-700',
  delayed: 'bg-orange-50 text-orange-700',
  in_progress: 'bg-purple-50 text-purple-700',
};

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedProject, setSelectedProject] = useState<any | null>(null);

  // Assign modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignProjectId, setAssignProjectId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [assignRole, setAssignRole] = useState('COORDINATOR');

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.projects();
      const data = res.data;
      setProjects(data.projects || data || []);
      setTotal(data.total || (data.projects || data || []).length);
    } catch {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleStatusAction = async (id: string, action: 'close' | 'cancel') => {
    try {
      if (action === 'close') await adminAPI.closeProject(id);
      else await adminAPI.cancelProject(id);
      toast.success(`Project ${action}d successfully`);
      load();
    } catch {
      toast.error(`Failed to ${action} project`);
    }
  };

  const handleAssign = async () => {
    if (!assigneeId.trim()) { toast.error('Enter assignee ID'); return; }
    try {
      await adminAPI.assignProjectResource(assignProjectId, { assignee_id: assigneeId, role: assignRole });
      toast.success('Assignment successful');
      setShowAssignModal(false);
      setAssigneeId('');
    } catch {
      toast.error('Failed to assign resource');
    }
  };

  const filtered = projects.filter(p => {
    const matchSearch = !search || p.property_name?.toLowerCase().includes(search.toLowerCase()) || p.customer_name?.toLowerCase().includes(search.toLowerCase()) || p.city?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statuses = ['draft', 'quoted', 'ordered', 'done', 'cancelled', 'delayed'];
  const countByStatus = (s: string) => projects.filter(p => p.status === s).length;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Project Management</h1>
          <p className="text-slate-500 mt-1">Create, assign and track projects across lifecycle</p>
        </div>
        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Project
        </button>
      </div>

      {/* Status filter chips */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => setStatusFilter('')} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${!statusFilter ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
          All ({total})
        </button>
        {statuses.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize ${statusFilter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            {s} ({countByStatus(s)})
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 flex gap-4 bg-slate-50">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-5 py-4 font-medium">Project ID</th>
                <th className="px-5 py-4 font-medium">Customer</th>
                <th className="px-5 py-4 font-medium">Property</th>
                <th className="px-5 py-4 font-medium">City</th>
                <th className="px-5 py-4 font-medium">Budget</th>
                <th className="px-5 py-4 font-medium">Status</th>
                <th className="px-5 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500">Loading projects...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-500">No projects found</td></tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 font-mono text-xs text-slate-400">{p.id?.substring(0,8).toUpperCase()}</td>
                    <td className="px-5 py-4 font-medium text-slate-900">{p.customer_name || '-'}</td>
                    <td className="px-5 py-4 text-slate-600">{p.property_name} <span className="text-slate-400">({p.bhk_type})</span></td>
                    <td className="px-5 py-4 text-slate-600">{p.city || '-'}</td>
                    <td className="px-5 py-4 text-slate-700 font-medium">₹{(p.budget || 0).toLocaleString()}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[p.status] || 'bg-slate-100 text-slate-600'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 flex gap-2 items-center">
                      <button onClick={() => setSelectedProject(p)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">View</button>
                      <button
                        onClick={() => { setAssignProjectId(p.id); setShowAssignModal(true); }}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >Assign</button>
                      {!['done', 'cancelled'].includes(p.status) && (
                        <>
                          <button onClick={() => handleStatusAction(p.id, 'close')} className="text-emerald-600 hover:text-emerald-800 text-sm font-medium">Close</button>
                          <button onClick={() => handleStatusAction(p.id, 'cancel')} className="text-red-600 hover:text-red-800 text-sm font-medium">Cancel</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Project Detail Modal */}
      {selectedProject && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="font-bold text-slate-900 text-lg">Project Details</h2>
              <button onClick={() => setSelectedProject(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {[
                { label: 'Project ID', value: selectedProject.id },
                { label: 'Property Name', value: selectedProject.property_name },
                { label: 'BHK Type', value: selectedProject.bhk_type },
                { label: 'City', value: selectedProject.city },
                { label: 'Budget', value: `₹${(selectedProject.budget || 0).toLocaleString()}` },
                { label: 'Status', value: selectedProject.status?.toUpperCase() },
                { label: 'Customer', value: selectedProject.customer_name },
                { label: 'Customer Email', value: selectedProject.customer_email },
                { label: 'Created', value: selectedProject.created_at ? new Date(selectedProject.created_at).toLocaleDateString() : '-' },
              ].map(row => (
                <div key={row.label} className="bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                  <div className="text-xs text-slate-400 font-medium mb-1">{row.label}</div>
                  <div className="font-medium text-slate-800 text-sm">{row.value || '-'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-bold text-slate-900 text-lg">Assign Resource to Project</h2>
              <button onClick={() => setShowAssignModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assignee User ID</label>
                <input
                  type="text"
                  placeholder="Enter user ID..."
                  value={assigneeId}
                  onChange={e => setAssigneeId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select
                  value={assignRole}
                  onChange={e => setAssignRole(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="COORDINATOR">Coordinator</option>
                  <option value="TECHNICIAN">Technician</option>
                  <option value="MANAGER">Project Manager</option>
                  <option value="VENDOR">Vendor</option>
                </select>
              </div>
              <button onClick={handleAssign} className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors">
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
