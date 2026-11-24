'use client';

import { useEffect, useState } from 'react';
import { adminAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { BarChart3, TrendingUp, Users, FileText, Building2, Download } from 'lucide-react';

export default function AdminReportsPage() {
  const [stats, setStats] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'projects' | 'customers' | 'vendors'>('overview');
  const [dateRange, setDateRange] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const [statsRes, projRes, custRes, vendorRes] = await Promise.all([
        adminAPI.stats(),
        adminAPI.projects(),
        adminAPI.getCustomers(),
        adminAPI.getVendors(),
      ]);
      setStats(statsRes.data);
      setProjects(projRes.data.projects || projRes.data || []);
      setCustomers(custRes.data.customers || []);
      setVendors(vendorRes.data || []);
    } catch {
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const statusCount = (arr: any[], key: string, val: string) => arr.filter(i => i[key] === val).length;
  const totalBudget = projects.reduce((s, p) => s + (p.budget || 0), 0);

  const KPI = [
    { label: 'Total Customers', value: stats?.total_clients || customers.length, color: 'bg-[#161D1A] text-[#A3E635]', icon: Users },
    { label: 'Total Projects', value: stats?.total_projects || projects.length, color: 'bg-emerald-50 text-[#059669]', icon: FileText },
    { label: 'Active Projects', value: stats?.active_projects || 0, color: 'bg-emerald-50 text-[#059669]', icon: TrendingUp },
    { label: 'Delayed Projects', value: stats?.delayed_projects || statusCount(projects, 'status', 'delayed'), color: 'bg-red-50 text-red-700', icon: BarChart3 },
    { label: 'Total Vendors', value: stats?.total_vendors || vendors.length, color: 'bg-[#161D1A] text-[#A3E635]', icon: Building2 },
    { label: 'Approved Vendors', value: vendors.filter(v => v.status === 'APPROVED').length, color: 'bg-teal-50 text-teal-700', icon: Building2 },
    { label: 'Total Revenue', value: `₹${(stats?.total_revenue || 0).toLocaleString()}`, color: 'bg-emerald-50 text-[#059669]', icon: TrendingUp },
    { label: 'Budget Pipeline', value: `₹${totalBudget.toLocaleString()}`, color: 'bg-emerald-50 text-[#059669]', icon: TrendingUp },
  ];

  const PROJECT_STATUSES = ['draft', 'quoted', 'ordered', 'done', 'cancelled', 'delayed'];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#161D1A] tracking-tight">Reports & Analytics</h1>
          <p className="text-slate-500 mt-1">View insights, reports and business analytics</p>
        </div>
        <div className="flex gap-3">
          <select value={dateRange} onChange={e => setDateRange(e.target.value)}
            className="px-3 py-2 border border-[#E5ECE7] rounded-lg text-sm text-[#161D1A] focus:outline-none focus:ring-2 focus:ring-[#A3E635]/20 focus:border-[#A3E635] bg-white">
            <option value="all">All Time</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
          <a
            href={adminAPI.getReportUrl('all')}
            download
            className="px-4 py-2 bg-[#A3E635] hover:bg-[#84CC16] text-[#0B0F0D] rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Export CSV
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[#F4F6F4] border border-[#E5ECE7] rounded-xl mb-8 w-max">
        {(['overview', 'projects', 'customers', 'vendors'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${tab === t ? 'bg-[#161D1A] text-[#A3E635] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {KPI.map(k => (
              <div key={k.label} className="bg-[#FAFBF9] border border-[#E5ECE7] rounded-xl p-5 shadow-sm">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${k.color}`}>
                  <k.icon className="w-5 h-5" />
                </div>
                <div className="text-2xl font-bold text-[#161D1A] mb-1">{loading ? '...' : k.value}</div>
                <div className="text-xs text-slate-500 font-medium">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Project by status breakdown */}
          <div className="bg-[#FAFBF9] border border-[#E5ECE7] rounded-2xl p-6 shadow-sm mb-6">
            <h3 className="font-semibold text-[#161D1A] mb-5">Projects by Status</h3>
            <div className="space-y-3">
              {PROJECT_STATUSES.map(s => {
                const count = statusCount(projects, 'status', s);
                const pct = projects.length ? Math.round((count / projects.length) * 100) : 0;
                const colors: Record<string, string> = {
                  draft: 'bg-slate-400', quoted: 'bg-amber-400', ordered: 'bg-blue-500',
                  done: 'bg-[#059669]', cancelled: 'bg-red-400', delayed: 'bg-orange-500'
                };
                return (
                  <div key={s} className="flex items-center gap-4">
                    <div className="w-20 text-xs text-slate-500 capitalize font-medium text-right">{s}</div>
                    <div className="flex-1 h-3 bg-white border border-[#E5ECE7] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${colors[s] || 'bg-slate-400'} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="w-12 text-xs text-slate-600 font-semibold">{count} <span className="text-slate-400 font-normal">({pct}%)</span></div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Vendor status breakdown */}
          <div className="bg-[#FAFBF9] border border-[#E5ECE7] rounded-2xl p-6 shadow-sm">
            <h3 className="font-semibold text-[#161D1A] mb-5">Vendors by Status</h3>
            <div className="flex gap-4 flex-wrap">
              {['APPROVED', 'PENDING', 'REJECTED', 'SUSPENDED'].map(s => (
                <div key={s} className="flex-1 min-w-[120px] bg-white border border-[#E5ECE7] rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-[#161D1A]">{vendors.filter(v => v.status === s).length}</div>
                  <div className="text-xs text-slate-500 font-medium mt-1">{s}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Projects Tab */}
      {tab === 'projects' && (
        <div className="bg-white border border-[#E5ECE7] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[#F4F6F4] border-b border-[#E5ECE7] text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-medium">Project</th>
                  <th className="px-5 py-4 font-medium">Customer</th>
                  <th className="px-5 py-4 font-medium">City</th>
                  <th className="px-5 py-4 font-medium">Budget</th>
                  <th className="px-5 py-4 font-medium">Status</th>
                  <th className="px-5 py-4 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={6} className="py-8 text-center text-slate-500">Loading...</td></tr>
                ) : projects.slice(0, 50).map(p => (
                  <tr key={p.id} className="hover:bg-[#FAFBF9]/80">
                    <td className="px-5 py-3 font-medium text-[#161D1A]">{p.property_name} <span className="text-slate-400 text-xs">({p.bhk_type})</span></td>
                    <td className="px-5 py-3 text-slate-600">{p.customer_name || '-'}</td>
                    <td className="px-5 py-3 text-slate-500">{p.city || '-'}</td>
                    <td className="px-5 py-3 font-semibold text-[#059669]">₹{(p.budget || 0).toLocaleString()}</td>
                    <td className="px-5 py-3"><span className="capitalize px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">{p.status}</span></td>
                    <td className="px-5 py-3 text-slate-400 text-xs">{p.created_at ? new Date(p.created_at).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customers Tab */}
      {tab === 'customers' && (
        <div className="bg-white border border-[#E5ECE7] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[#F4F6F4] border-b border-[#E5ECE7] text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-medium">Name</th>
                  <th className="px-5 py-4 font-medium">Email</th>
                  <th className="px-5 py-4 font-medium">City</th>
                  <th className="px-5 py-4 font-medium">Status</th>
                  <th className="px-5 py-4 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-500">Loading...</td></tr>
                ) : customers.map(c => (
                  <tr key={c.id} className="hover:bg-[#FAFBF9]/80">
                    <td className="px-5 py-3 font-medium text-[#161D1A]">{c.name}</td>
                    <td className="px-5 py-3 text-slate-500">{c.email}</td>
                    <td className="px-5 py-3 text-slate-500">{c.city || '-'}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${c.status === 'suspended' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-[#059669]'}`}>
                        {c.status === 'suspended' ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Vendors Tab */}
      {tab === 'vendors' && (
        <div className="bg-white border border-[#E5ECE7] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[#F4F6F4] border-b border-[#E5ECE7] text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-medium">Business Name</th>
                  <th className="px-5 py-4 font-medium">Category</th>
                  <th className="px-5 py-4 font-medium">City</th>
                  <th className="px-5 py-4 font-medium">Status</th>
                  <th className="px-5 py-4 font-medium">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-500">Loading...</td></tr>
                ) : vendors.map(v => (
                  <tr key={v.id} className="hover:bg-[#FAFBF9]/80">
                    <td className="px-5 py-3 font-medium text-[#161D1A]">{v.business_name}</td>
                    <td className="px-5 py-3 text-slate-500">{v.category || '-'}</td>
                    <td className="px-5 py-3 text-slate-500">{v.city || '-'}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${v.status === 'APPROVED' ? 'bg-emerald-50 text-[#059669]' : v.status === 'PENDING' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{v.rating ? `${v.rating}/5` : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
