'use client';

import { useEffect, useState } from 'react';
import { adminAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { Database, Package, Tag, Plus, Edit2, Trash2, X } from 'lucide-react';

export default function AdminMasterDataPage() {
  const [pricingRules, setPricingRules] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pricing' | 'packages' | 'picklists'>('packages');

  // Forms
  const [showPricingForm, setShowPricingForm] = useState(false);
  const [pricingForm, setPricingForm] = useState({ rule_type: 'GST', name: '', value: '', effective_date: '', expiry_date: '' });
  const [showPackageForm, setShowPackageForm] = useState(false);
  const [pkgForm, setPkgForm] = useState({ name: '', tier: 'essential', pricing: '', timeline_days: '30' });

  const PICKLISTS = [
    { group: 'BHK Types', values: ['1BHK', '2BHK', '3BHK', '4BHK', '5BHK+', 'Studio', 'Villa', 'Penthouse'] },
    { group: 'Room Types', values: ['Living Room', 'Master Bedroom', 'Bedroom 2', 'Kitchen', 'Dining Room', 'Bathroom', 'Study Room', 'Balcony'] },
    { group: 'Style Tags', values: ['Modern', 'Contemporary', 'Scandinavian', 'Industrial', 'Bohemian', 'Minimalist', 'Traditional', 'Luxury'] },
    { group: 'Project Statuses', values: ['draft', 'quoted', 'ordered', 'in_progress', 'done', 'cancelled', 'delayed'] },
    { group: 'Vendor Categories', values: ['Furniture', 'Lighting', 'Flooring', 'Wall Finishes', 'Fixtures', 'Curtains', 'Accessories', 'Appliances'] },
  ];

  const load = async () => {
    setLoading(true);
    try {
      const [rulesRes, pkgRes] = await Promise.all([
        adminAPI.getPricingRules(),
        adminAPI.getPackageConfigs(),
      ]);
      setPricingRules(rulesRes.data || []);
      setPackages(pkgRes.data || []);
    } catch {
      toast.error('Failed to load master data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreatePricingRule = async () => {
    if (!pricingForm.name || !pricingForm.value || !pricingForm.effective_date || !pricingForm.expiry_date) {
      toast.error('Fill all required fields');
      return;
    }
    try {
      await adminAPI.createPricingRule({ ...pricingForm, value: parseFloat(pricingForm.value) });
      toast.success('Pricing rule created');
      setShowPricingForm(false);
      setPricingForm({ rule_type: 'GST', name: '', value: '', effective_date: '', expiry_date: '' });
      load();
    } catch {
      toast.error('Failed to create pricing rule');
    }
  };

  const handleDeletePricingRule = async (id: string) => {
    if (!confirm('Delete this pricing rule?')) return;
    try {
      await adminAPI.deletePricingRule(id);
      toast.success('Rule deleted');
      load();
    } catch {
      toast.error('Failed to delete rule');
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Master Data</h1>
        <p className="text-slate-500 mt-1">
          Manage platform-level reference data — packages, pricing rules, and configurable picklists
        </p>
      </div>

      {/* Info banner */}
      <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-indigo-700 flex items-start gap-3">
        <Database className="w-5 h-5 mt-0.5 text-indigo-500 flex-shrink-0" />
        <div>
          <strong>Admin Master Data</strong> manages platform-wide configuration — design packages, tax/pricing rules, and reference picklists.
          Vendor product catalogs are managed separately in the Vendor portal.
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-8 w-max">
        {([
          { id: 'packages', label: 'Design Packages', icon: Package },
          { id: 'pricing', label: 'Pricing Rules', icon: Tag },
          { id: 'picklists', label: 'Picklists & Reference Data', icon: Database },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Design Packages Tab */}
      {tab === 'packages' && (
        <div>
          <div className="flex justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Design Packages</h2>
            <button onClick={() => setShowPackageForm(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Package
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-3 py-10 text-center text-slate-500">Loading...</div>
            ) : packages.length === 0 ? (
              <div className="col-span-3 py-10 text-center bg-white border border-slate-200 rounded-2xl">
                <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500">No packages configured yet</p>
              </div>
            ) : (
              packages.map((pkg: any) => (
                <div key={pkg.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-slate-900">{pkg.name}</h3>
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium capitalize ${
                      pkg.tier === 'premium' ? 'bg-indigo-50 text-indigo-700' :
                      pkg.tier === 'essential' ? 'bg-teal-50 text-teal-700' :
                      'bg-amber-50 text-amber-700'
                    }`}>{pkg.tier}</span>
                  </div>
                  <div className="text-3xl font-bold text-indigo-700 mb-2">₹{(pkg.pricing || 0).toLocaleString()}</div>
                  <div className="text-sm text-slate-500 mb-4">{pkg.timeline_days} days timeline</div>
                  {pkg.included_services?.length > 0 && (
                    <div className="space-y-1">
                      {pkg.included_services.slice(0, 3).map((s: string, i: number) => (
                        <div key={i} className="text-xs text-slate-600 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          {s}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Pricing Rules Tab */}
      {tab === 'pricing' && (
        <div>
          <div className="flex justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Pricing Rules (GST, Discounts, Margins)</h2>
            <button onClick={() => setShowPricingForm(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Rule
            </button>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-medium">Rule Name</th>
                    <th className="px-5 py-4 font-medium">Type</th>
                    <th className="px-5 py-4 font-medium">Value (%)</th>
                    <th className="px-5 py-4 font-medium">Effective From</th>
                    <th className="px-5 py-4 font-medium">Expires</th>
                    <th className="px-5 py-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={6} className="py-8 text-center text-slate-500">Loading...</td></tr>
                  ) : pricingRules.length === 0 ? (
                    <tr><td colSpan={6} className="py-10 text-center text-slate-500">No pricing rules configured</td></tr>
                  ) : (
                    pricingRules.map((r: any) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3 font-medium text-slate-900">{r.name}</td>
                        <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.rule_type === 'GST' ? 'bg-amber-50 text-amber-700' :
                          r.rule_type === 'DISCOUNT' ? 'bg-emerald-50 text-emerald-700' :
                          'bg-indigo-50 text-indigo-700'
                        }`}>{r.rule_type}</span></td>
                        <td className="px-5 py-3 font-semibold text-slate-800">{r.value}%</td>
                        <td className="px-5 py-3 text-slate-500 text-xs">{r.effective_date ? new Date(r.effective_date).toLocaleDateString() : '-'}</td>
                        <td className="px-5 py-3 text-slate-500 text-xs">{r.expiry_date ? new Date(r.expiry_date).toLocaleDateString() : '-'}</td>
                        <td className="px-5 py-3">
                          <button onClick={() => handleDeletePricingRule(r.id)} className="text-red-400 hover:text-red-600 transition-colors">
                            <Trash2 className="w-4 h-4" />
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
      )}

      {/* Picklists Tab */}
      {tab === 'picklists' && (
        <div>
          <div className="mb-4">
            <h2 className="font-semibold text-slate-900">Reference Data & Picklists</h2>
            <p className="text-slate-500 text-sm mt-1">Platform-wide configurable values used across all modules</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PICKLISTS.map(group => (
              <div key={group.group} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-slate-900">{group.group}</h3>
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{group.values.length} values</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.values.map(v => (
                    <span key={v} className="px-3 py-1 bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-full font-medium">{v}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Pricing Rule Modal */}
      {showPricingForm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-bold text-slate-900 text-lg">Add Pricing Rule</h2>
              <button onClick={() => setShowPricingForm(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rule Type</label>
                <select value={pricingForm.rule_type} onChange={e => setPricingForm(p => ({ ...p, rule_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                  {['GST', 'DISCOUNT', 'MARGIN', 'PRODUCT', 'PACKAGE', 'VENDOR'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rule Name</label>
                <input type="text" placeholder="e.g. Standard GST 18%" value={pricingForm.name} onChange={e => setPricingForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Value (%)</label>
                <input type="number" placeholder="e.g. 18" value={pricingForm.value} onChange={e => setPricingForm(p => ({ ...p, value: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Effective Date</label>
                  <input type="date" value={pricingForm.effective_date} onChange={e => setPricingForm(p => ({ ...p, effective_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Expiry Date</label>
                  <input type="date" value={pricingForm.expiry_date} onChange={e => setPricingForm(p => ({ ...p, expiry_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                </div>
              </div>
              <button onClick={handleCreatePricingRule} className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors">
                Create Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
