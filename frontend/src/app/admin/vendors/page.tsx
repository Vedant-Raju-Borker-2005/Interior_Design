'use client';

import { useEffect, useState } from 'react';
import { adminAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { Search, Plus, Filter, Building2, CheckCircle2, Clock, XCircle, X, ShieldAlert, Tag, Bell } from 'lucide-react';

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [selectedVendor, setSelectedVendor] = useState<any | null>(null);
  const [vendorProducts, setVendorProducts] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getVendors();
      setVendors(res.data || []);
    } catch {
      toast.error('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load() }, []);

  const handleAction = async (id: string, action: 'approve' | 'reject' | 'suspend' | 'reactivate') => {
    try {
      if (action === 'approve') await adminAPI.approveVendor(id);
      else if (action === 'reject') await adminAPI.rejectVendor(id, { rejection_reason: 'Admin rejected' });
      else if (action === 'suspend') await adminAPI.suspendVendor(id);
      else if (action === 'reactivate') await adminAPI.reactivateVendor(id);
      
      toast.success(`Vendor ${action} successful`);
      load();
    } catch {
      toast.error(`Failed to ${action} vendor`);
    }
  };

  const openVendorDetail = async (vendor: any) => {
    setSelectedVendor(vendor);
    // Mocking fetching vendor products for the UI. Replace with real API later.
    setVendorProducts([
      { id: '1', name: 'Premium Sofa Set', base_price: 25000, seller_price: 0, status: 'pending_review' },
      { id: '2', name: 'Oak Dining Table', base_price: 15000, seller_price: 18000, status: 'approved' }
    ]);
  };

  const handleSetSellerPrice = async (productId: string, price: number) => {
    try {
      // Mock API call: await adminAPI.setVendorProductPrice(productId, price);
      toast.success(`Seller price updated successfully!`);
      setVendorProducts(products => products.map(p => p.id === productId ? { ...p, seller_price: price, status: 'approved' } : p));
    } catch {
      toast.error('Failed to update seller price');
    }
  };

  const filtered = vendors.filter(v => 
    v.business_name?.toLowerCase().includes(search.toLowerCase()) || 
    v.category?.toLowerCase().includes(search.toLowerCase())
  );

  const totalCount = vendors.length;
  const approvedCount = vendors.filter(v => v.status === 'APPROVED').length;
  const pendingCount = vendors.filter(v => v.status === 'PENDING').length;
  const blockedCount = vendors.filter(v => v.status === 'SUSPENDED' || v.status === 'REJECTED').length;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full relative">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Vendor Management</h1>
        <p className="text-slate-500 mt-1">Approve and monitor vendor performance</p>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
        <div className="bg-white border border-slate-200 rounded-xl p-4 min-w-[160px] flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{totalCount}</div>
            <div className="text-xs text-slate-500 font-medium">Total Vendors</div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 min-w-[160px] flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{approvedCount}</div>
            <div className="text-xs text-slate-500 font-medium">Approved</div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 min-w-[160px] flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{pendingCount}</div>
            <div className="text-xs text-slate-500 font-medium">Pending</div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 min-w-[160px] flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{blockedCount}</div>
            <div className="text-xs text-slate-500 font-medium">Blocked</div>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search vendors..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2">
              <Filter className="w-4 h-4" /> Filter
            </button>
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 whitespace-nowrap">
              <Plus className="w-4 h-4" /> Add Vendor
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-medium">Vendor Name</th>
                <th className="px-6 py-4 font-medium">Category</th>
                <th className="px-6 py-4 font-medium">City</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Performance</th>
                <th className="px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Loading vendors...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No vendors found.</td></tr>
              ) : (
                filtered.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-slate-900">{v.business_name}</td>
                    <td className="px-6 py-4 text-slate-600">{v.category || '-'}</td>
                    <td className="px-6 py-4 text-slate-600">{v.city || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        v.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : 
                        v.status === 'PENDING' ? 'bg-amber-50 text-amber-700' :
                        'bg-red-50 text-red-700'
                      }`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-slate-600">
                      {v.rating ? `${v.rating}/5` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 flex gap-3 items-center">
                      <button onClick={() => openVendorDetail(v)} className="text-indigo-600 hover:text-indigo-800 font-medium text-sm transition-colors">View / Pricing</button>
                      
                      {v.status === 'PENDING' && (
                        <>
                          <button onClick={() => handleAction(v.id, 'approve')} className="text-emerald-600 hover:text-emerald-800 font-medium text-sm transition-colors">Approve</button>
                          <button onClick={() => handleAction(v.id, 'reject')} className="text-red-600 hover:text-red-800 font-medium text-sm transition-colors">Reject</button>
                        </>
                      )}
                      
                      {v.status === 'APPROVED' && (
                        <button onClick={() => handleAction(v.id, 'suspend')} className="text-amber-600 hover:text-amber-800 font-medium text-sm transition-colors">Suspend</button>
                      )}

                      {v.status === 'SUSPENDED' && (
                        <button onClick={() => handleAction(v.id, 'reactivate')} className="text-emerald-600 hover:text-emerald-800 font-medium text-sm transition-colors">Reactivate</button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vendor Detail Modal */}
      {selectedVendor && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Vendor Profile & Products</h2>
                <p className="text-sm text-slate-500 mt-1">{selectedVendor.business_name}</p>
              </div>
              <button onClick={() => setSelectedVendor(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              
              <div className="mb-8 bg-amber-50 p-4 rounded-xl border border-amber-200 flex items-start gap-3">
                <Bell className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-900 text-sm">Product Pricing Action Required</h4>
                  <p className="text-sm text-amber-800 mt-1">
                    The vendor has added new products to their catalog. Please review and set the Seller Price. The vendor will then set their Base Price accordingly.
                  </p>
                </div>
              </div>

              <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Tag className="w-5 h-5 text-indigo-500" />
                Vendor Product Catalog
              </h4>
              
              <div className="space-y-4">
                {vendorProducts.map(product => (
                  <div key={product.id} className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50">
                    <div>
                      <div className="font-semibold text-slate-900">{product.name}</div>
                      <div className="text-sm text-slate-500 mt-1">Vendor Proposed Base Price: ₹{product.base_price.toLocaleString()}</div>
                      {product.status === 'pending_review' ? (
                        <span className="inline-flex mt-2 items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                          Pending Admin Pricing
                        </span>
                      ) : (
                        <span className="inline-flex mt-2 items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                          Priced & Approved
                        </span>
                      )}
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex flex-col">
                        <label className="text-xs font-medium text-slate-500 mb-1">Set Seller Price (₹)</label>
                        <input 
                          type="number" 
                          defaultValue={product.seller_price || ''}
                          className="w-32 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          id={`price-${product.id}`}
                        />
                      </div>
                      <button 
                        onClick={() => {
                          const input = document.getElementById(`price-${product.id}`) as HTMLInputElement;
                          if (input && input.value) {
                            handleSetSellerPrice(product.id, Number(input.value));
                          }
                        }}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors whitespace-nowrap"
                      >
                        Set Price
                      </button>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
