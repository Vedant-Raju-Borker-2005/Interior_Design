'use client';

import { useEffect, useState } from 'react';
import { adminAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { Users, Search, Plus, Filter, UserCheck, UserMinus, UserX, X, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Deep link from quotation search: /admin/<page>?q=<customer or project>
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setSearch(q);
  }, []);
  
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customerDetail, setCustomerDetail] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getCustomers();
      setCustomers(res.data.customers || []);
    } catch {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load() }, []);

  const handleStatusToggle = async (id: string, currentStatus: string) => {
    try {
      if (currentStatus === 'suspended') {
        await adminAPI.reactivateCustomer(id);
        toast.success('Customer reactivated');
      } else {
        await adminAPI.suspendCustomer(id);
        toast.success('Customer suspended');
      }
      load();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const openCustomerDetail = async (customer: any) => {
    setSelectedCustomer(customer);
    setCustomerDetail(null);
    try {
      const res = await adminAPI.getCustomerDetail(customer.id);
      setCustomerDetail(res.data);
    } catch (e) {
      toast.error('Failed to load full profile');
    }
  };

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = customers.filter(c => c.status !== 'suspended').length;
  const suspendedCount = customers.filter(c => c.status === 'suspended').length;
  const newCount = customers.filter(c => {
    const d = new Date(c.created_at);
    const now = new Date();
    return (now.getTime() - d.getTime()) < (7 * 24 * 60 * 60 * 1000); // within 7 days
  }).length;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full relative">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#161D1A] tracking-tight">Customer Management</h1>
        <p className="text-slate-500 mt-1">View and manage all customers</p>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
        <div className="bg-[#FAFBF9] border border-[#E5ECE7] rounded-xl p-4 min-w-[160px] flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[#161D1A] text-[#A3E635] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#161D1A]">{customers.length}</div>
            <div className="text-xs text-slate-500 font-medium">Total Customers</div>
          </div>
        </div>
        <div className="bg-[#FAFBF9] border border-[#E5ECE7] rounded-xl p-4 min-w-[160px] flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#059669] flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#161D1A]">{activeCount}</div>
            <div className="text-xs text-slate-500 font-medium">Active</div>
          </div>
        </div>
        <div className="bg-[#FAFBF9] border border-[#E5ECE7] rounded-xl p-4 min-w-[160px] flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-lime-50 text-[#65A30D] flex items-center justify-center">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#161D1A]">{newCount}</div>
            <div className="text-xs text-slate-500 font-medium">New (7d)</div>
          </div>
        </div>
        <div className="bg-[#FAFBF9] border border-[#E5ECE7] rounded-xl p-4 min-w-[160px] flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#161D1A]">{suspendedCount}</div>
            <div className="text-xs text-slate-500 font-medium">Inactive</div>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white border border-[#E5ECE7] rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[#E5ECE7] flex flex-col sm:row gap-4 justify-between items-center bg-[#FAFBF9]">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search customers..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-[#E5ECE7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A3E635]/20 focus:border-[#A3E635] transition-all text-[#161D1A]"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button className="px-4 py-2 bg-white border border-[#E5ECE7] text-[#161D1A] rounded-lg text-sm font-medium hover:bg-[#F4F6F4] transition-colors flex items-center gap-2">
              <Filter className="w-4 h-4" /> Filter
            </button>
            <button className="px-4 py-2 bg-[#A3E635] hover:bg-[#84CC16] text-[#0B0F0D] rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap">
              <Plus className="w-4 h-4" /> Add Customer
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#F4F6F4] text-slate-500 border-b border-[#E5ECE7]">
              <tr>
                <th className="px-6 py-4 font-medium">Customer ID</th>
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium">City</th>
                <th className="px-6 py-4 font-medium">Phone / Email</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Loading customers...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No customers found.</td></tr>
              ) : (
                filtered.map(c => (
                  <tr key={c.id} className="hover:bg-[#FAFBF9]/80 transition-colors group">
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">{c.id.substring(0,8).toUpperCase()}</td>
                    <td className="px-6 py-4 font-medium text-[#161D1A]">{c.name}</td>
                    <td className="px-6 py-4 text-slate-600">{c.city || '-'}</td>
                    <td className="px-6 py-4 text-slate-600">
                      <div>{c.phone || '-'}</div>
                      <div className="text-xs text-slate-400">{c.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        c.status === 'suspended' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-[#059669]'
                      }`}>
                        {c.status === 'suspended' ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={() => openCustomerDetail(c)} className="text-[#059669] hover:text-[#047857] font-medium text-sm transition-colors mr-3">View</button>
                      <button 
                        onClick={() => handleStatusToggle(c.id, c.status)}
                        className={`${c.status === 'suspended' ? 'text-[#059669] hover:text-[#047857]' : 'text-red-600 hover:text-red-800'} font-medium text-sm transition-colors`}
                      >
                        {c.status === 'suspended' ? 'Activate' : 'Suspend'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-[#FAFBF9] w-full max-w-md h-full shadow-2xl flex flex-col border-l border-[#E5ECE7] animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-[#E5ECE7] flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#161D1A]">Customer Profile</h2>
              <button onClick={() => setSelectedCustomer(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-[#161D1A] text-[#A3E635] flex items-center justify-center font-bold text-xl">
                  {selectedCustomer.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-[#161D1A]">{selectedCustomer.name}</h3>
                  <p className="text-sm text-slate-500">{selectedCustomer.email}</p>
                </div>
              </div>
              
              <div className="space-y-4 mb-8">
                <div className="bg-white p-4 rounded-xl border border-[#E5ECE7]">
                  <div className="text-xs text-slate-400 font-medium mb-1">Phone Number</div>
                  <div className="font-medium text-[#161D1A]">{selectedCustomer.phone || 'N/A'}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-[#E5ECE7]">
                  <div className="text-xs text-slate-400 font-medium mb-1">City</div>
                  <div className="font-medium text-[#161D1A]">{selectedCustomer.city || 'N/A'}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-[#E5ECE7]">
                  <div className="text-xs text-slate-400 font-medium mb-1">Account Status</div>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    selectedCustomer.status === 'suspended' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-[#059669]'
                  }`}>
                    {selectedCustomer.status === 'suspended' ? 'Inactive' : 'Active'}
                  </span>
                </div>
              </div>

              {customerDetail && customerDetail.projects && (
                <div className="mb-8">
                  <h4 className="font-semibold text-[#161D1A] mb-4">Related Projects</h4>
                  {customerDetail.projects.length === 0 ? (
                    <div className="text-sm text-slate-500">No active projects.</div>
                  ) : (
                    <div className="space-y-3">
                      {customerDetail.projects.map((p: any) => (
                        <div key={p.id} className="border border-[#E5ECE7] rounded-lg p-3 bg-white">
                          <div className="font-medium text-[#161D1A] text-sm">{p.property_name}</div>
                          <div className="text-xs text-slate-500">{p.status} • ₹{p.budget}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Link 
                href={`/dashboard?customerId=${selectedCustomer.id}`}
                className="w-full py-3 px-4 bg-[#A3E635] hover:bg-[#84CC16] text-[#0B0F0D] rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <LayoutDashboard className="w-4 h-4" /> Go to Customer Dashboard
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
