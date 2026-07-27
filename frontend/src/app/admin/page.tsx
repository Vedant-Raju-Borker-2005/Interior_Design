'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { adminAPI } from '@/lib/api';
import Navbar from '@/components/Navbar';
import toast from 'react-hot-toast';
import Link from 'next/link';
import clsx from 'clsx';
import {
  Users, Home, FileText, MessageCircle, TrendingUp,
  BarChart3, CheckCircle2, Clock, AlertCircle, Building2,
  ArrowUpRight, RefreshCw, Star, Trash2, Edit, Plus, Upload, Download,
  Lock, Settings, ShieldCheck, ShieldAlert, FileSpreadsheet, Activity, Search
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  draft:   'bg-slate-100 text-slate-650 border-slate-200',
  quoted:  'bg-amber-50 text-amber-700 border-amber-200',
  ordered: 'bg-blue-50 text-blue-700 border-blue-200',
  done:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  delayed: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-slate-250 text-slate-600 border-slate-300'
};

export default function AdminPage() {
  const [stats, setStats] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [pricingRules, setPricingRules] = useState<any[]>([]);
  const [packageConfigs, setPackageConfigs] = useState<any[]>([]);
  const [systemSettings, setSystemSettings] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [masterProducts, setMasterProducts] = useState<any[]>([]);

  // Active Tab state
  const [tab, setTab] = useState<
    'overview' | 'customers' | 'vendors' | 'quotes' | 'projects' | 'catalog' | 'pricing' | 'roles' | 'reports'
  >('overview');
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [custSearch, setCustSearch] = useState('');
  const [projStatusFilter, setProjStatusFilter] = useState('');

  // Selected Detail views
  const [selectedCustDetail, setSelectedCustDetail] = useState<any>(null);
  const [selectedQuoteHistory, setSelectedQuoteHistory] = useState<any[]>([]);
  const [viewingQuoteId, setViewingQuoteId] = useState<string | null>(null);

  // Assignment Modal
  const [assignProjId, setAssignProjId] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState('');
  const [assignRole, setAssignRole] = useState('COORDINATOR');

  // Forms / Actions state
  const [showProductForm, setShowProductForm] = useState(false);
  const [productSku, setProductSku] = useState('');
  const [productName, setProductName] = useState('');
  const [productCategory, setProductCategory] = useState('Furniture');
  const [productSubcat, setProductSubcat] = useState('');
  const [productPrice, setProductPrice] = useState(0);

  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleType, setRuleType] = useState('PRODUCT');
  const [ruleName, setRuleName] = useState('');
  const [ruleValue, setRuleValue] = useState(0);
  const [ruleEffDate, setRuleEffDate] = useState('');
  const [ruleExpDate, setRuleExpDate] = useState('');

  const [showPackageForm, setShowPackageForm] = useState(false);
  const [pkgName, setPkgName] = useState('');
  const [pkgTier, setPkgTier] = useState('premium');
  const [pkgPrice, setPkgPrice] = useState(0);
  const [pkgTimeline, setPkgTimeline] = useState(30);

  const [adminRoleUserId, setAdminRoleUserId] = useState('');
  const [adminRoleName, setAdminRoleName] = useState('OPERATIONS_ADMIN');

  const [editSettingKey, setEditSettingKey] = useState('');
  const [editSettingVal, setEditSettingVal] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [
        statsRes, projRes, custRes, vendorRes, quoteRes,
        rulesRes, pkgsRes, settingsRes, logsRes, prodRes
      ] = await Promise.all([
        adminAPI.stats(),
        adminAPI.projects(),
        adminAPI.getCustomers(),
        adminAPI.getVendors(),
        adminAPI.getQuotations(),
        adminAPI.getPricingRules(),
        adminAPI.getPackageConfigs(),
        adminAPI.getSystemSettings(),
        adminAPI.getAuditLogs(),
        adminAPI.getMasterProducts()
      ]);
      setStats(statsRes.data);
      setProjects(projRes.data.projects || []);
      setCustomers(custRes.data.customers || []);
      setVendors(vendorRes.data || []);
      setQuotations(quoteRes.data || []);
      setPricingRules(rulesRes.data || []);
      setPackageConfigs(pkgsRes.data || []);
      setSystemSettings(settingsRes.data || []);
      setAuditLogs(logsRes.data || []);
      setMasterProducts(prodRes.data || []);
    } catch {
      toast.error('Failed to load platform data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load() }, []);

  // Customer handlers
  const handleLoadCustomerDetail = async (id: string) => {
    try {
      const res = await adminAPI.getCustomerDetail(id);
      setSelectedCustDetail(res.data);
    } catch {
      toast.error('Failed to load profile details');
    }
  };

  const handleToggleCustomerSuspension = async (id: string, currentStatus: string) => {
    try {
      if (currentStatus === 'suspended') {
        await adminAPI.reactivateCustomer(id);
        toast.success('Customer account reactivated!');
      } else {
        await adminAPI.suspendCustomer(id);
        toast.success('Customer account suspended!');
      }
      load();
      handleLoadCustomerDetail(id);
    } catch {
      toast.error('Failed to update suspension status');
    }
  };

  // Vendor handlers
  const handleVendorAction = async (id: string, action: 'approve' | 'reject' | 'suspend' | 'reactivate' | 'request-docs') => {
    try {
      if (action === 'approve') await adminAPI.approveVendor(id);
      else if (action === 'reject') {
        const reason = prompt('Enter rejection reason:');
        await adminAPI.rejectVendor(id, { rejection_reason: reason || undefined });
      }
      else if (action === 'suspend') await adminAPI.suspendVendor(id);
      else if (action === 'reactivate') await adminAPI.reactivateVendor(id);
      else if (action === 'request-docs') await adminAPI.requestVendorDocs(id);
      toast.success(`Vendor action [${action}] succeeded!`);
      load();
    } catch {
      toast.error('Failed to perform vendor action');
    }
  };

  // Quote handlers
  const handleQuoteAction = async (id: string, action: 'approve' | 'reject' | 'expire' | 'convert') => {
    try {
      if (action === 'approve') await adminAPI.approveQuotation(id);
      else if (action === 'reject') await adminAPI.rejectQuotation(id);
      else if (action === 'expire') await adminAPI.expireQuotation(id);
      else if (action === 'convert') await adminAPI.convertQuotation(id);
      toast.success(`Quote status updated to [${action}]`);
      load();
    } catch {
      toast.error('Failed to update quote status');
    }
  };

  const handleViewQuoteHistory = async (id: string) => {
    try {
      const res = await adminAPI.getQuotationHistory(id);
      setSelectedQuoteHistory(res.data);
      setViewingQuoteId(id);
    } catch {
      toast.error('Failed to load revision history');
    }
  };

  // Project handlers
  const handleUpdateProjectStatus = async (id: string, action: 'close' | 'cancel') => {
    try {
      if (action === 'close') await adminAPI.closeProject(id);
      else if (action === 'cancel') await adminAPI.cancelProject(id);
      toast.success(`Project updated successfully!`);
      load();
    } catch {
      toast.error('Failed to update project status');
    }
  };

  const handleAssignResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignProjId || !assigneeId) return;
    try {
      await adminAPI.assignProjectResource(assignProjId, {
        assignee_id: assigneeId,
        role: assignRole
      });
      toast.success('Resource mapped successfully!');
      setAssignProjId(null);
      setAssigneeId('');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Assignment failed');
    }
  };

  // Product CRUD
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminAPI.createMasterProduct({
        sku: productSku,
        name: productName,
        category: productCategory,
        subcategory: productSubcat,
        price: productPrice
      });
      toast.success('Product added successfully!');
      setProductSku('');
      setProductName('');
      setProductSubcat('');
      setProductPrice(0);
      setShowProductForm(false);
      load();
    } catch {
      toast.error('Failed to create product');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await adminAPI.deleteMasterProduct(id);
      toast.success('Product deleted!');
      load();
    } catch {
      toast.error('Failed to delete product');
    }
  };

  // Pricing Rules CRUD
  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminAPI.createPricingRule({
        rule_type: ruleType,
        name: ruleName,
        value: ruleValue,
        effective_date: ruleEffDate,
        expiry_date: ruleExpDate
      });
      toast.success('Pricing rule created!');
      setRuleName('');
      setRuleValue(0);
      setRuleEffDate('');
      setRuleExpDate('');
      setShowRuleForm(false);
      load();
    } catch {
      toast.error('Failed to create pricing rule');
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await adminAPI.deletePricingRule(id);
      toast.success('Pricing rule deleted!');
      load();
    } catch {
      toast.error('Failed to delete rule');
    }
  };

  // Package Config CRUD
  const handleCreatePackageConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminAPI.createPackageConfig({
        name: pkgName,
        tier: pkgTier,
        pricing: pkgPrice,
        timeline_days: pkgTimeline
      });
      toast.success('Package config created!');
      setPkgName('');
      setPkgPrice(0);
      setShowPackageForm(false);
      load();
    } catch {
      toast.error('Failed to save config');
    }
  };

  const handleDeletePackageConfig = async (id: string) => {
    try {
      await adminAPI.deletePackageConfig(id);
      toast.success('Package tier deleted');
      load();
    } catch {
      toast.error('Failed to delete package config');
    }
  };

  // Admin Roles assignment
  const handleAssignAdminRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminRoleUserId) return;
    try {
      await adminAPI.assignAdminRole({
        user_id: adminRoleUserId,
        role_name: adminRoleName
      });
      toast.success('Admin role assigned successfully!');
      setAdminRoleUserId('');
      load();
    } catch {
      toast.error('Failed to assign admin role');
    }
  };

  // System settings template updates
  const handleSaveSetting = async (key: string, value: string, category: string) => {
    try {
      await adminAPI.updateSystemSetting({ key, value, category });
      toast.success('Template setting updated!');
      setEditSettingKey('');
      load();
    } catch {
      toast.error('Failed to save template setting');
    }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await adminAPI.importCatalog(file);
      toast.success(res.data.message);
      load();
    } catch {
      toast.error('CSV import failed');
    }
  };

  const formatINR = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0, notation: 'compact' }).format(n);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 pt-24 space-y-8">
        
        {/* Header */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-indigo-650" /> Platform Admin Operations Console
            </h1>
            <p className="text-xs text-slate-450 font-semibold">
              Master control center for approvals, role mappings, pricing rules, configurations, and reports.
            </p>
          </div>
          <button onClick={load} className="px-3.5 py-1.5 bg-slate-100 border rounded-xl hover:bg-slate-200 text-xs font-extrabold flex items-center gap-1.5 transition">
            <RefreshCw className="w-3.5 h-3.5" /> Reload Console
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200 overflow-x-auto gap-6 whitespace-nowrap bg-white p-2.5 rounded-2xl shadow-sm border border-slate-100">
          {[
            { id: 'overview', label: '📊 Operations Dashboard' },
            { id: 'customers', label: '👥 Customers & CRM' },
            { id: 'vendors', label: '🚚 Vendor Approvals' },
            { id: 'quotes', label: '📄 Quotations & Revisions' },
            { id: 'projects', label: '🏗️ Project Control Center' },
            { id: 'catalog', label: '📁 Catalog & Packages' },
            { id: 'pricing', label: '🏷️ Pricing Rules' },
            { id: 'roles', label: '⚙️ Security & System Settings' },
            { id: 'reports', label: '📈 Reports & Exports' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id as any)}
              className={`pb-2.5 pt-1.5 px-3 text-xs font-extrabold border-b-2 transition-all outline-none rounded-lg ${
                tab === item.id
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Outer Split Columns */}
        <div className="space-y-6">

          {/* TAB CONTENT: Overview Analytics */}
          {tab === 'overview' && stats && (
            <div className="space-y-8 animate-in fade-in duration-200">
              
              {/* KPI Cards Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {[
                  { icon: Users, label: 'Customers', value: stats.total_clients, color: 'text-indigo-600 bg-indigo-50' },
                  { icon: Home, label: 'Active Projects', value: stats.active_projects, color: 'text-blue-600 bg-blue-50' },
                  { icon: TrendingUp, label: 'Revenue', value: formatINR(stats.total_revenue), color: 'text-emerald-600 bg-emerald-50' },
                  { icon: Clock, label: 'Pending Payments', value: stats.pending_payments, color: 'text-amber-600 bg-amber-50' },
                  { icon: AlertCircle, label: 'Delayed Projects', value: stats.delayed_projects, color: 'text-red-650 bg-red-50' },
                  { icon: Building2, label: 'Approved Vendors', value: stats.active_vendors, color: 'text-purple-600 bg-purple-50' },
                  { icon: Star, label: 'Open Issues', value: stats.open_issues, color: 'text-rose-600 bg-rose-50' }
                ].map((kpi, idx) => (
                  <div key={idx} className="bg-white border rounded-2xl p-4.5 shadow-sm space-y-2">
                    <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center', kpi.color)}>
                      <kpi.icon className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <div className="text-xl font-black text-slate-850 tracking-tight">{kpi.value}</div>
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mt-0.5">{kpi.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Status and Pipeline Breakdowns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Project Statuses */}
                <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5"><Home className="w-4 h-4 text-indigo-650" /> Project Status Pipeline</h3>
                  <div className="space-y-3">
                    {Object.entries(stats.projects_by_status || {}).map(([st, count]) => (
                      <div key={st} className="flex justify-between items-center text-xs font-semibold">
                        <span className={`px-2 py-0.5 border rounded-full capitalize text-[9.5px] font-black ${STATUS_COLORS[st] || 'bg-slate-50 text-slate-500'}`}>{st}</span>
                        <span className="font-extrabold text-slate-700">{count as number}</span>
                      </div>
                    ))}
                    {Object.keys(stats.projects_by_status || {}).length === 0 && (
                      <div className="text-center py-4 text-slate-450 italic">No projects registered.</div>
                    )}
                  </div>
                </div>

                {/* Inquiry CRM statuses */}
                <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5"><MessageCircle className="w-4 h-4 text-rose-500" /> Inquiry Status</h3>
                  <div className="space-y-3">
                    {Object.entries(stats.inquiries_by_status || {}).map(([st, count]) => (
                      <div key={st} className="flex justify-between items-center text-xs font-semibold">
                        <span className="badge bg-slate-100 text-slate-650 border border-slate-200 capitalize text-[9.5px] font-black">{st}</span>
                        <span className="font-extrabold text-slate-700">{count as number}</span>
                      </div>
                    ))}
                    {Object.keys(stats.inquiries_by_status || {}).length === 0 && (
                      <div className="text-center py-4 text-slate-450 italic">No customer inquiries submitted.</div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB CONTENT: Customers CRM */}
          {tab === 'customers' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Search Control */}
              <div className="bg-white border rounded-2xl p-4 shadow-sm flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name, email, or phone number..."
                    value={custSearch}
                    onChange={(e) => setCustSearch(e.target.value)}
                    className="w-full text-xs bg-slate-50 border rounded-lg pl-9 pr-4 py-2.5 outline-none font-semibold text-slate-700"
                  />
                </div>
              </div>

              {/* Customers grid splits */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* List Column */}
                <div className="lg:col-span-2 bg-white border rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[500px]">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <tr>
                          <th className="p-3">Customer name</th>
                          <th className="p-3">Contact</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-650">
                        {customers
                          .filter(c => c.name.toLowerCase().includes(custSearch.toLowerCase()) || c.email.toLowerCase().includes(custSearch.toLowerCase()))
                          .map((cust) => (
                            <tr key={cust.id} className="hover:bg-slate-50/50">
                              <td className="p-3 font-bold text-slate-800">{cust.name}</td>
                              <td className="p-3">
                                <div>{cust.phone}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{cust.email}</div>
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 border text-[9px] font-black rounded-full uppercase ${
                                  cust.status === 'suspended' ? 'bg-red-50 text-red-700 border-red-150' : 'bg-green-50 text-green-700 border-green-150'
                                }`}>{cust.status}</span>
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => handleLoadCustomerDetail(cust.id)}
                                  className="text-indigo-650 hover:underline font-extrabold text-[10px] uppercase tracking-wider"
                                >
                                  View CRM Profile
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Detail View Column */}
                <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-5">
                  <h3 className="text-xs font-black text-slate-850 uppercase tracking-wider border-b pb-2 flex items-center gap-1.5"><Users className="w-4 h-4 text-indigo-600" /> Customer detail profile</h3>
                  {selectedCustDetail ? (
                    <div className="space-y-4 text-xs font-semibold text-slate-700">
                      
                      {/* Actions panel */}
                      <div className="flex gap-2 border-b pb-4">
                        <button
                          onClick={() => handleToggleCustomerSuspension(selectedCustDetail.profile.id, selectedCustDetail.profile.status)}
                          className={`flex-1 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider ${
                            selectedCustDetail.profile.status === 'suspended' ? 'bg-green-50 border-green-200 text-green-750' : 'bg-red-50 border-red-200 text-red-700'
                          }`}
                        >
                          {selectedCustDetail.profile.status === 'suspended' ? 'Reactivate account' : 'Suspend account'}
                        </button>
                      </div>

                      {/* Bio */}
                      <div className="space-y-2">
                        <div className="flex justify-between"><span className="text-slate-450">ID</span><span className="font-mono font-bold text-slate-800">{selectedCustDetail.profile.id}</span></div>
                        <div className="flex justify-between"><span className="text-slate-450">Name</span><span className="font-bold text-slate-850">{selectedCustDetail.profile.name}</span></div>
                        <div className="flex justify-between"><span className="text-slate-450">Email</span><span className="text-slate-600 font-mono">{selectedCustDetail.profile.email}</span></div>
                        <div className="flex justify-between"><span className="text-slate-450">City</span><span>{selectedCustDetail.profile.city}</span></div>
                      </div>

                      {/* Inquiries */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Inquiry History</span>
                        <div className="space-y-1.5 max-h-[100px] overflow-y-auto pr-1">
                          {selectedCustDetail.inquiries.map((inq: any) => (
                            <div key={inq.id} className="p-2 border rounded-lg bg-slate-50 text-[10.5px]">
                              <div className="flex justify-between font-bold text-indigo-700"><span>BHK: {inq.bhk_type}</span><span>{inq.status}</span></div>
                              <p className="text-slate-500 font-medium truncate mt-0.5">{inq.message}</p>
                            </div>
                          ))}
                          {selectedCustDetail.inquiries.length === 0 && <span className="text-[10.5px] italic text-slate-400">No inquiry history found.</span>}
                        </div>
                      </div>

                      {/* Projects */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Projects & tracking</span>
                        <div className="space-y-1.5 max-h-[100px] overflow-y-auto pr-1">
                          {selectedCustDetail.projects.map((proj: any) => (
                            <div key={proj.id} className="p-2 border rounded-lg bg-slate-50 text-[10.5px] flex justify-between font-bold text-slate-700">
                              <span>{proj.property_name}</span>
                              <span className="uppercase text-[9px] text-indigo-650 bg-indigo-50 border px-1.5 py-0.5 rounded">{proj.status}</span>
                            </div>
                          ))}
                          {selectedCustDetail.projects.length === 0 && <span className="text-[10.5px] italic text-slate-400">No projects generated.</span>}
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400 italic">Select a customer to view complete CRM logs.</div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB CONTENT: Vendor Onboarding */}
          {tab === 'vendors' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="p-3">Vendor company</th>
                        <th className="p-3">Owner & Contact</th>
                        <th className="p-3">Onboarding status</th>
                        <th className="p-3">Documents Check</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-650">
                      {vendors.map((vendor) => (
                        <tr key={vendor.id} className="hover:bg-slate-50/50">
                          <td className="p-3">
                            <div className="font-bold text-slate-850">{vendor.business_name || 'N/A'}</div>
                            <div className="text-[10px] text-slate-450">ID: {vendor.id}</div>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-750">{vendor.owner_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{vendor.email} ({vendor.phone})</div>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 border text-[9px] font-black rounded-full uppercase ${
                              vendor.status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-200' :
                              vendor.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200' :
                              'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>{vendor.status || 'SUBMITTED'}</span>
                          </td>
                          <td className="p-3">
                            {vendor.documents ? (
                              <div className="flex gap-2.5 text-[10px] font-bold">
                                {vendor.documents.gst_certificate && <span className="text-indigo-650 uppercase">GST ✓</span>}
                                {vendor.documents.pan_card && <span className="text-indigo-650 uppercase">PAN ✓</span>}
                                {vendor.documents.bank_details && <span className="text-indigo-650 uppercase">Bank ✓</span>}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">No documents uploaded</span>
                            )}
                          </td>
                          <td className="p-3 text-right space-x-2">
                            {vendor.status !== 'APPROVED' ? (
                              <>
                                <button onClick={() => handleVendorAction(vendor.id, 'approve')} className="px-2.5 py-1 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded font-black text-[10px] uppercase">✓ Approve</button>
                                <button onClick={() => handleVendorAction(vendor.id, 'reject')} className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded font-black text-[10px] uppercase">✕ Reject</button>
                                <button onClick={() => handleVendorAction(vendor.id, 'request-docs')} className="px-2.5 py-1 bg-slate-100 border text-slate-600 rounded font-black text-[10px] uppercase">Docs Req</button>
                              </>
                            ) : (
                              <>
                                {vendor.active ? (
                                  <button onClick={() => handleVendorAction(vendor.id, 'suspend')} className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded font-black text-[10px] uppercase">Suspend</button>
                                ) : (
                                  <button onClick={() => handleVendorAction(vendor.id, 'reactivate')} className="px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded font-black text-[10px] uppercase">Reactivate</button>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: Quotations */}
          {tab === 'quotes' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Quotations List */}
                <div className="lg:col-span-2 bg-white border rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[500px]">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <tr>
                          <th className="p-3">Quote ID</th>
                          <th className="p-3">Subtotal</th>
                          <th className="p-3">Total (incl GST)</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-650">
                        {quotations.map((q) => (
                          <tr key={q.id} className="hover:bg-slate-50/50">
                            <td className="p-3 font-mono font-bold text-slate-750">{q.id.slice(0,8)}...</td>
                            <td className="p-3">₹{q.subtotal.toLocaleString()}</td>
                            <td className="p-3 font-bold text-indigo-650">₹{q.total.toLocaleString()}</td>
                            <td className="p-3">
                              <span className={`px-2.5 py-0.5 border text-[9px] font-black rounded-full uppercase ${
                                q.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                                q.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                                'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>{q.status}</span>
                            </td>
                            <td className="p-3 text-right space-x-1.5">
                              {q.status === 'pending' || q.status === 'draft' ? (
                                <>
                                  <button onClick={() => handleQuoteAction(q.id, 'approve')} className="text-green-700 hover:underline">Approve</button>
                                  <button onClick={() => handleQuoteAction(q.id, 'reject')} className="text-red-655 hover:underline">Reject</button>
                                  <button onClick={() => handleQuoteAction(q.id, 'convert')} className="text-indigo-650 hover:underline">Convert to Proj</button>
                                </>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Processed</span>
                              )}
                              <button onClick={() => handleViewQuoteHistory(q.id)} className="text-slate-500 hover:underline pl-2 border-l">Revisions</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Quote Revision History log */}
                <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="text-xs font-black text-slate-850 uppercase tracking-wider border-b pb-2 flex items-center gap-1.5"><Activity className="w-4 h-4 text-indigo-600" /> Revisions & audit logs</h3>
                  {viewingQuoteId ? (
                    <div className="space-y-3.5">
                      <div className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Quotation: {viewingQuoteId.slice(0, 12)}...</div>
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                        {selectedQuoteHistory.map((h: any) => (
                          <div key={h.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                            <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                              <span className="text-indigo-650 font-black">{h.action}</span>
                              <span>{new Date(h.timestamp).toLocaleDateString()}</span>
                            </div>
                            <p className="text-[11.5px] text-slate-650 font-medium leading-relaxed">{h.details}</p>
                          </div>
                        ))}
                        {selectedQuoteHistory.length === 0 && (
                          <div className="text-xs text-slate-400 italic">No revision logs recorded.</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400 italic">Select revision history on a quote item to inspect version logs.</div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB CONTENT: Projects Control Center */}
          {tab === 'projects' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Project Assignments Modal Overlay */}
              {assignProjId && (
                <div className="bg-white border rounded-2xl p-6 shadow-md max-w-md mx-auto space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Map Project Resource Assignee</h4>
                    <button onClick={() => setAssignProjId(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                  </div>
                  <form onSubmit={handleAssignResource} className="space-y-3.5 text-xs font-semibold text-slate-700">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">User ID</label>
                      <input
                        type="text"
                        required
                        placeholder="Enter user uuid..."
                        value={assigneeId}
                        onChange={(e) => setAssigneeId(e.target.value)}
                        className="w-full text-xs bg-slate-50 border rounded-lg p-2.5 outline-none font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Role Type</label>
                      <select
                        value={assignRole}
                        onChange={(e) => setAssignRole(e.target.value)}
                        className="w-full text-xs bg-slate-50 border rounded-lg p-2.5 outline-none font-bold text-slate-600"
                      >
                        <option value="COORDINATOR">Coordinator</option>
                        <option value="TECHNICIAN">Technician</option>
                        <option value="VENDOR">Vendor</option>
                      </select>
                    </div>
                    <button type="submit" className="w-full py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 shadow-sm transition">Assign Resource</button>
                  </form>
                </div>
              )}

              {/* Project Filter & Search Bar */}
              <div className="bg-white border rounded-2xl p-4 shadow-sm flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by property, city or customer..."
                    value={custSearch}
                    onChange={(e) => setCustSearch(e.target.value)}
                    className="w-full text-xs bg-slate-50 border rounded-lg pl-9 pr-4 py-2.5 outline-none font-semibold text-slate-700"
                  />
                </div>
                <select
                  value={projStatusFilter}
                  onChange={(e) => setProjStatusFilter(e.target.value)}
                  className="text-xs bg-slate-50 border rounded-lg px-3 py-2.5 outline-none font-bold text-slate-650"
                >
                  <option value="">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="quoted">Quoted</option>
                  <option value="ordered">Ordered (Finalized)</option>
                  <option value="done">Done</option>
                  <option value="delayed">Delayed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Property details</th>
                        <th className="p-3">City</th>
                        <th className="p-3">Budget</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-650">
                      {projects
                        .filter(p =>
                          (!projStatusFilter || p.status === projStatusFilter) &&
                          (!custSearch || 
                            p.property_name?.toLowerCase().includes(custSearch.toLowerCase()) || 
                            p.city?.toLowerCase().includes(custSearch.toLowerCase()) ||
                            p.customer_name?.toLowerCase().includes(custSearch.toLowerCase())
                          )
                        )
                        .map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="p-3">
                            <div className="font-bold text-slate-800">{p.customer_name || '—'}</div>
                            <div className="text-[10px] text-slate-450">{p.customer_phone}</div>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-800">{p.property_name}</div>
                            <div className="text-[10px] text-slate-400 font-medium">BHK: {p.bhk_type}</div>
                          </td>
                          <td className="p-3">{p.city}</td>
                          <td className="p-3 font-extrabold text-indigo-650">₹{(p.budget / 100000).toFixed(1)}L</td>
                          <td className="p-3">
                            <span className={`px-2.5 py-0.5 border text-[9px] font-black rounded-full uppercase ${STATUS_COLORS[p.status] || 'bg-slate-50 text-slate-500'}`}>{p.status}</span>
                          </td>
                          <td className="p-3 text-right space-x-2.5">
                            <button onClick={() => setAssignProjId(p.id)} className="text-indigo-650 hover:underline">Map Assignee</button>
                            {p.status !== 'done' && p.status !== 'cancelled' && (
                              <>
                                <button onClick={() => handleUpdateProjectStatus(p.id, 'close')} className="text-green-700 hover:underline">Close Proj</button>
                                <button onClick={() => handleUpdateProjectStatus(p.id, 'cancel')} className="text-red-655 hover:underline">Cancel Proj</button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: Master Catalog & Packages */}
          {tab === 'catalog' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Product Catalog List */}
                <div className="lg:col-span-2 bg-white border rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="text-xs font-black text-slate-850 uppercase tracking-wider flex items-center gap-1.5"><FileSpreadsheet className="w-4 h-4 text-indigo-650" /> Product SKU Inventory Catalog</h3>
                    <div className="flex items-center gap-2">
                      <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border rounded-xl cursor-pointer text-xs font-extrabold flex items-center gap-1">
                        <Upload className="w-3.5 h-3.5" /> Import CSV
                        <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
                      </label>
                      <a
                        href={adminAPI.exportCatalogUrl()}
                        download
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border rounded-xl text-xs font-extrabold flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" /> Export CSV
                      </a>
                    </div>
                  </div>

                  {/* Add Product inline form */}
                  <button onClick={() => setShowProductForm(!showProductForm)} className="px-3.5 py-1.5 bg-indigo-600 text-white font-bold text-[10px] uppercase rounded-lg hover:bg-indigo-700 shadow-sm">+ Add catalog product</button>
                  {showProductForm && (
                    <form onSubmit={handleCreateProduct} className="bg-slate-50 border rounded-xl p-4 space-y-3.5 text-xs font-semibold text-slate-700">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">SKU Code</label>
                          <input type="text" required value={productSku} onChange={(e) => setProductSku(e.target.value)} className="w-full text-xs bg-white border rounded-lg p-2" />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Product Name</label>
                          <input type="text" required value={productName} onChange={(e) => setProductName(e.target.value)} className="w-full text-xs bg-white border rounded-lg p-2" />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Category</label>
                          <select value={productCategory} onChange={(e) => setProductCategory(e.target.value)} className="w-full text-xs bg-white border rounded-lg p-2">
                            <option value="Furniture">Furniture</option>
                            <option value="Kitchen">Kitchen</option>
                            <option value="Lighting">Lighting</option>
                            <option value="Decor">Decor</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Subcategory</label>
                          <input type="text" required value={productSubcat} onChange={(e) => setProductSubcat(e.target.value)} className="w-full text-xs bg-white border rounded-lg p-2" />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Price (INR)</label>
                          <input type="number" required value={productPrice} onChange={(e) => setProductPrice(Number(e.target.value))} className="w-full text-xs bg-white border rounded-lg p-2" />
                        </div>
                      </div>
                      <button type="submit" className="w-full py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-sm">Save Catalog Entry</button>
                    </form>
                  )}

                  {/* Products list */}
                  <div className="overflow-y-auto max-h-[300px] border border-slate-100 rounded-xl">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 border-b text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <tr>
                          <th className="p-3">SKU</th>
                          <th className="p-3">Name</th>
                          <th className="p-3">Category</th>
                          <th className="p-3">Base Price</th>
                          <th className="p-3 text-right">Delete</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-650">
                        {masterProducts.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50/50">
                            <td className="p-3 font-mono font-bold text-[10px]">{p.sku}</td>
                            <td className="p-3 font-bold text-slate-800">{p.name}</td>
                            <td className="p-3"><span className="badge bg-slate-100 border text-slate-500">{p.category}</span></td>
                            <td className="p-3 font-extrabold text-indigo-650">₹{p.price.toLocaleString()}</td>
                            <td className="p-3 text-right"><button onClick={() => handleDeleteProduct(p.id)} className="text-red-500 hover:text-red-750 p-1.5"><Trash2 className="w-4 h-4" /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Packages Configuration */}
                <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="text-xs font-black text-slate-850 uppercase tracking-wider flex items-center gap-1.5"><Settings className="w-4 h-4 text-indigo-650" /> Package Tiers Config</h3>
                    <button onClick={() => setShowPackageForm(!showPackageForm)} className="text-xs text-indigo-600 hover:underline font-extrabold">+ Add config</button>
                  </div>

                  {showPackageForm && (
                    <form onSubmit={handleCreatePackageConfig} className="bg-slate-50 border rounded-xl p-3.5 space-y-3 text-xs font-semibold text-slate-700">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Package Name</label>
                        <input type="text" required value={pkgName} onChange={(e) => setPkgName(e.target.value)} className="w-full text-xs bg-white border rounded-lg p-2" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tier</label>
                          <select value={pkgTier} onChange={(e) => setPkgTier(e.target.value)} className="w-full text-xs bg-white border rounded-lg p-2 font-bold text-slate-600">
                            <option value="basic">Basic</option>
                            <option value="premium">Premium</option>
                            <option value="luxury">Luxury</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cycle Days</label>
                          <input type="number" required value={pkgTimeline} onChange={(e) => setPkgTimeline(Number(e.target.value))} className="w-full text-xs bg-white border rounded-lg p-2" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pricing Multiplier</label>
                        <input type="number" required step="0.01" value={pkgPrice} onChange={(e) => setPkgPrice(Number(e.target.value))} className="w-full text-xs bg-white border rounded-lg p-2" />
                      </div>
                      <button type="submit" className="w-full py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">Save Package Config</button>
                    </form>
                  )}

                  {/* List configs */}
                  <div className="space-y-3">
                    {packageConfigs.map((c) => (
                      <div key={c.id} className="p-3 border rounded-xl bg-slate-50/50 flex justify-between items-center text-xs font-semibold text-slate-700">
                        <div>
                          <h4 className="font-extrabold text-slate-800 uppercase text-xs">{c.name}</h4>
                          <span className="text-[10px] text-slate-450 block font-bold uppercase tracking-wider">Tier: {c.tier} | Default Timeline: {c.timeline_days} days</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-extrabold text-indigo-650">₹{c.pricing.toLocaleString()}</span>
                          <button onClick={() => handleDeletePackageConfig(c.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB CONTENT: Pricing Rules */}
          {tab === 'pricing' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <h3 className="text-xs font-black text-slate-850 uppercase tracking-wider flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-indigo-650" /> Dynamic Pricing Rule sets</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Configure profit markups, active customer discounts, and local tax (GST) rates.</p>
                  </div>
                  <button onClick={() => setShowRuleForm(!showRuleForm)} className="px-3.5 py-1.5 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 shadow-sm">+ New pricing rule</button>
                </div>

                {showRuleForm && (
                  <form onSubmit={handleCreateRule} className="bg-slate-50 border rounded-xl p-4 space-y-3.5 text-xs font-semibold text-slate-700 max-w-md">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Rule Type</label>
                        <select value={ruleType} onChange={(e) => setRuleType(e.target.value)} className="w-full text-xs bg-white border rounded-lg p-2.5 font-bold text-slate-600">
                          <option value="PRODUCT">Product Markup</option>
                          <option value="PACKAGE">Package Markup</option>
                          <option value="DISCOUNT">Discount Rate</option>
                          <option value="GST">Tax / GST rate</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Rule Name</label>
                        <input type="text" required placeholder="e.g. Diwali discount..." value={ruleName} onChange={(e) => setRuleName(e.target.value)} className="w-full text-xs bg-white border rounded-lg p-2.5" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Value (Float)</label>
                        <input type="number" step="0.01" required value={ruleValue} onChange={(e) => setRuleValue(Number(e.target.value))} className="w-full text-xs bg-white border rounded-lg p-2.5" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Effective Date</label>
                        <input type="date" required value={ruleEffDate} onChange={(e) => setRuleEffDate(e.target.value)} className="w-full text-xs bg-white border rounded-lg p-2.5 text-slate-600" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Expiry Date</label>
                        <input type="date" required value={ruleExpDate} onChange={(e) => setRuleExpDate(e.target.value)} className="w-full text-xs bg-white border rounded-lg p-2.5 text-slate-600" />
                      </div>
                    </div>
                    <button type="submit" className="w-full py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">Save Pricing Rule</button>
                  </form>
                )}

                {/* Rules List */}
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead className="bg-slate-50 border-b text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="p-3">Rule name</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Value</th>
                        <th className="p-3">Effective range</th>
                        <th className="p-3 text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-650">
                      {pricingRules.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-bold text-slate-800">{r.name}</td>
                          <td className="p-3"><span className="badge bg-slate-100 border text-slate-500 uppercase text-[9px] font-black">{r.rule_type}</span></td>
                          <td className="p-3 font-extrabold text-indigo-650">{r.value}</td>
                          <td className="p-3 text-slate-500 text-[11px] font-medium">
                            {new Date(r.effective_date).toLocaleDateString()} to {new Date(r.expiry_date).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-right">
                            <button onClick={() => handleDeleteRule(r.id)} className="text-red-500 hover:text-red-750 p-1.5"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))}
                      {pricingRules.length === 0 && (
                        <tr><td colSpan={5} className="text-center py-6 text-slate-450 italic">No pricing rules configured.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: Roles Security & System templates Settings */}
          {tab === 'roles' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Mappings */}
                <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="text-xs font-black text-slate-850 uppercase tracking-wider border-b pb-2 flex items-center gap-1.5"><Lock className="w-4 h-4 text-indigo-650" /> Administrative Role Matrix</h3>
                  <form onSubmit={handleAssignAdminRole} className="space-y-3 text-xs font-semibold text-slate-700">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">User ID</label>
                      <input
                        type="text"
                        required
                        placeholder="Enter user UUID to map..."
                        value={adminRoleUserId}
                        onChange={(e) => setAdminRoleUserId(e.target.value)}
                        className="w-full text-xs bg-slate-50 border rounded-lg p-2.5 outline-none font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Role level</label>
                      <select
                        value={adminRoleName}
                        onChange={(e) => setAdminRoleName(e.target.value)}
                        className="w-full text-xs bg-slate-50 border rounded-lg p-2.5 outline-none font-bold text-slate-650"
                      >
                        <option value="SUPER_ADMIN">Super Admin (Full Access)</option>
                        <option value="OPERATIONS_ADMIN">Operations Admin (Projects, Vendors)</option>
                        <option value="SALES_ADMIN">Sales Admin (Customers, Quotes)</option>
                        <option value="FINANCE_ADMIN">Finance Admin (Payments, Invoices)</option>
                      </select>
                    </div>
                    <button type="submit" className="w-full py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-sm transition">Assign Admin Role</button>
                  </form>
                </div>

                {/* Templates System Settings */}
                <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="text-xs font-black text-slate-850 uppercase tracking-wider border-b pb-2 flex items-center gap-1.5"><Settings className="w-4 h-4 text-indigo-650" /> System templates configuration</h3>
                  <div className="space-y-3">
                    {systemSettings.map((s) => (
                      <div key={s.id} className="p-3 border rounded-xl bg-slate-50/50 space-y-2 text-xs font-semibold text-slate-700">
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-indigo-700 text-[10px]">{s.key}</span>
                          <span className="text-[9px] text-slate-450 uppercase font-black">{s.category}</span>
                        </div>
                        {editSettingKey === s.key ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editSettingVal}
                              onChange={(e) => setEditSettingVal(e.target.value)}
                              className="flex-1 text-xs bg-white border rounded p-1"
                            />
                            <button onClick={() => handleSaveSetting(s.key, editSettingVal, s.category)} className="px-2.5 py-1 bg-green-600 text-white rounded font-bold text-[10px]">✓</button>
                            <button onClick={() => setEditSettingKey('')} className="px-2.5 py-1 bg-slate-400 text-white rounded font-bold text-[10px]">✕</button>
                          </div>
                        ) : (
                          <div className="flex justify-between items-start gap-4">
                            <p className="text-slate-600 text-[11px] font-medium leading-relaxed">{s.value}</p>
                            <button
                              onClick={() => {
                                setEditSettingKey(s.key);
                                setEditSettingVal(s.value);
                              }}
                              className="text-[10px] text-indigo-650 hover:underline font-bold"
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {systemSettings.length === 0 && (
                      <div className="text-center py-6 text-slate-450 italic">No system settings registered.</div>
                    )}
                  </div>
                </div>

                {/* Audit Logs list */}
                <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-4 col-span-2">
                  <h3 className="text-xs font-black text-slate-850 uppercase tracking-wider border-b pb-2 flex items-center gap-1.5"><Activity className="w-4 h-4 text-indigo-600" /> Platform system audit trail logs</h3>
                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                    {auditLogs.map((l) => (
                      <div key={l.id} className="text-[11px] font-semibold border-b pb-1.5 flex justify-between">
                        <span>
                          <span className="text-indigo-650 font-black uppercase mr-2">{l.action}</span>
                          <span className="text-slate-500 font-medium">({l.entity_type} ID: {l.entity_id})</span>
                        </span>
                        <span className="text-slate-400 font-medium">By {l.user_name} on {new Date(l.timestamp).toLocaleString()}</span>
                      </div>
                    ))}
                    {auditLogs.length === 0 && (
                      <div className="text-center py-6 text-slate-450 italic">No audit actions logged.</div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB CONTENT: Reports */}
          {tab === 'reports' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-4 max-w-lg">
                <div>
                  <h3 className="text-xs font-black text-slate-850 uppercase tracking-wider flex items-center gap-1.5"><FileSpreadsheet className="w-4.5 h-4.5 text-indigo-650" /> Management Reporting Portal</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Download CSV formats of system operations data.</p>
                </div>

                <div className="grid grid-cols-1 gap-3 pt-2">
                  {[
                    { id: 'sales', label: '📊 Sales Performance CSV Report', desc: 'Lists quotation item counts, totals, margins, and statuses.' },
                    { id: 'revenue', label: '💰 Completed Revenue CSV Report', desc: 'Detailed timeline payouts milestones receipts.' },
                    { id: 'projects', label: '🏗️ Active Projects Pipeline CSV Report', desc: 'Includes room counts, locations, budgets, and status logs.' },
                    { id: 'vendors', label: '🚚 Vendor Specializations & SLA CSV Report', desc: 'Earnings, delay counts, rating scorecard.' },
                    { id: 'customers', label: '👥 Registered Customers CSV Report', desc: 'Joined dates, contact credentials, budget configurations.' }
                  ].map((rep) => (
                    <div key={rep.id} className="p-3 border rounded-xl hover:bg-slate-50 transition-all flex justify-between items-center text-xs font-semibold text-slate-700">
                      <div>
                        <h4 className="font-extrabold text-slate-800">{rep.label}</h4>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">{rep.desc}</p>
                      </div>
                      <a
                        href={adminAPI.getReportUrl(rep.id)}
                        download
                        className="p-2 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-600 rounded-lg transition"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
