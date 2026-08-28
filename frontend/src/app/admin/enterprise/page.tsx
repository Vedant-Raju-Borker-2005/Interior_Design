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
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/admin" className="text-slate-400 hover:text-slate-600 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Building className="w-6 h-6 text-indigo-600" />
                Enterprise Management
              </h1>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Monitor real-estate developer accounts, portfolio allocations, and multi-unit projects.
            </p>
          </div>
          <button 
            onClick={fetchEnterprises} 
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 shadow-sm"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
            Refresh
          </button>
        </div>

        {/* Search bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by builder name, email, or phone number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400">Loading enterprise accounts...</div>
          ) : enterprises.length === 0 ? (
            <div className="p-12 text-center text-slate-400">No enterprise partner accounts found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
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
                    <tr key={ent.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-semibold text-slate-900 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                          {ent.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{ent.name}</div>
                          <div className="text-xs text-slate-400 font-normal">ID: {ent.id.slice(0, 8)}...</div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-slate-800 font-medium">{ent.email}</div>
                        <div className="text-xs text-slate-400">{ent.phone}</div>
                      </td>
                      <td className="p-4 text-slate-700">{ent.city || 'Bangalore'}</td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {ent.project_count} Parent Projects
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Active Enterprise
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => setSelectedEnterprise(ent)}
                          className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-200 transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Portfolio
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
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg">
                    {selectedEnterprise.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">{selectedEnterprise.name}</h3>
                    <p className="text-xs text-slate-500">Enterprise Real-Estate Builder</p>
                  </div>
                </div>
                <button onClick={() => setSelectedEnterprise(null)} className="text-slate-400 hover:text-slate-600">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 text-slate-700">
                  <Mail className="w-4 h-4 text-indigo-500" />
                  <span>{selectedEnterprise.email}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-700">
                  <Phone className="w-4 h-4 text-indigo-500" />
                  <span>{selectedEnterprise.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-700">
                  <MapPin className="w-4 h-4 text-indigo-500" />
                  <span>{selectedEnterprise.city || 'Bangalore'}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-700">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  <span>{selectedEnterprise.project_count} Registered Parent Property Projects</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setSelectedEnterprise(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-xl text-sm hover:bg-slate-200"
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
