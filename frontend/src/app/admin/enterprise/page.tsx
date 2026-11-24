'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building, Search, Filter, RefreshCw, CheckCircle, AlertTriangle, 
  XCircle, Eye, ArrowLeft, Shield, Phone, Mail, MapPin, Layers, Award
} from 'lucide-react';
import Link from 'next/link';
import { adminAPI } from '@/lib/api';
import toast from 'react-hot-toast';

export default function AdminEnterprisePage() {
  const [enterprises, setEnterprises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedEnterprise, setSelectedEnterprise] = useState<any | null>(null);

  const fetchEnterprises = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getEnterprises({ search });
      setEnterprises(res.data.enterprises || []);
    } catch (err: any) {
      toast.error('Failed to load enterprise partners');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnterprises();
  }, [search]);

  return (
    <div className="min-h-screen bg-[#FAFBF9] p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/admin" className="text-slate-400 hover:text-[#161D1A] transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-2xl font-bold text-[#161D1A] flex items-center gap-2">
                <Building className="w-6 h-6 text-[#059669]" />
                Enterprise Management
              </h1>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Monitor real-estate developer accounts, portfolio allocations, and multi-unit projects.
            </p>
          </div>
          <button 
            onClick={fetchEnterprises} 
            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E5ECE7] text-[#161D1A] font-medium rounded-xl hover:bg-[#F4F6F4] shadow-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
            Refresh
          </button>
        </div>

        {/* Search bar */}
        <div className="bg-[#FAFBF9] p-4 rounded-2xl border border-[#E5ECE7] shadow-sm flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by builder name, email, or phone number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E5ECE7] rounded-xl text-[#161D1A] text-sm focus:outline-none focus:ring-2 focus:ring-[#A3E635]/20 focus:border-[#A3E635]"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-[#E5ECE7] shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400">Loading enterprise accounts...</div>
          ) : enterprises.length === 0 ? (
            <div className="p-12 text-center text-slate-400">No enterprise partner accounts found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-[#F4F6F4] text-slate-700 font-bold border-b border-[#E5ECE7]">
                  <tr>
                    <th className="p-4">Enterprise / Builder</th>
                    <th className="p-4">Contact Info</th>
                    <th className="p-4">City</th>
                    <th className="p-4">Parent Projects</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {enterprises.map((ent) => (
                    <tr key={ent.id} className="hover:bg-[#FAFBF9]/80 transition-colors">
                      <td className="p-4 font-semibold text-[#161D1A] flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#161D1A] border border-[#161D1A] flex items-center justify-center text-[#A3E635] font-bold">
                          {ent.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-[#161D1A]">{ent.name}</div>
                          <div className="text-xs text-slate-400 font-normal">ID: {ent.id.slice(0, 8)}...</div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-slate-800 font-medium">{ent.email}</div>
                        <div className="text-xs text-slate-400">{ent.phone}</div>
                      </td>
                      <td className="p-4 text-slate-700">{ent.city || 'Bangalore'}</td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-[#059669] border border-emerald-200">
                          {ent.project_count} Parent Projects
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#059669] border border-emerald-200">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Active Enterprise
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => setSelectedEnterprise(ent)}
                          className="px-3 py-1.5 bg-[#FAFBF9] border border-[#E5ECE7] text-[#161D1A] text-xs font-medium rounded-lg hover:bg-[#F4F6F4] transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#059669]" /> View Portfolio
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal detail */}
        {selectedEnterprise && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#FAFBF9] rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-[#E5ECE7] space-y-6">
              <div className="flex items-center justify-between border-b border-[#E5ECE7] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#161D1A] text-[#A3E635] flex items-center justify-center font-bold text-lg">
                    {selectedEnterprise.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-[#161D1A] text-lg">{selectedEnterprise.name}</h3>
                    <p className="text-xs text-slate-500">Enterprise Real-Estate Builder</p>
                  </div>
                </div>
                <button onClick={() => setSelectedEnterprise(null)} className="text-slate-400 hover:text-slate-600">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 text-slate-700">
                  <Mail className="w-4 h-4 text-[#059669]" />
                  <span>{selectedEnterprise.email}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-700">
                  <Phone className="w-4 h-4 text-[#059669]" />
                  <span>{selectedEnterprise.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-700">
                  <MapPin className="w-4 h-4 text-[#059669]" />
                  <span>{selectedEnterprise.city || 'Bangalore'}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-700">
                  <Layers className="w-4 h-4 text-[#059669]" />
                  <span>{selectedEnterprise.project_count} Registered Parent Property Projects</span>
                </div>
              </div>

              <div className="pt-4 border-t border-[#E5ECE7] flex justify-end">
                <button
                  onClick={() => setSelectedEnterprise(null)}
                  className="px-4 py-2 bg-[#161D1A] text-white font-medium rounded-xl text-sm hover:bg-black transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
