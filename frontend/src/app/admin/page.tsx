'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { adminAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {
  Users, Home, FileText, MessageCircle, TrendingUp,
  BarChart3, CheckCircle2, Clock, AlertCircle, Building2,
  ArrowRight, ShieldCheck, Database, Settings, Activity, Bot
} from 'lucide-react';

const MODULES = [
  {
    title: 'Customer Management',
    desc: 'Manage customers, monitor accounts and track engagement.',
    href: '/admin/customers',
    icon: Users,
    color: 'bg-indigo-50 text-indigo-700',
    borderColor: 'border-indigo-100'
  },
  {
    title: 'Vendor Management',
    desc: 'Approve vendors, monitor performance and manage partnerships.',
    href: '/admin/vendors',
    icon: Building2,
    color: 'bg-emerald-50 text-emerald-700',
    borderColor: 'border-emerald-100'
  },
  {
    title: 'Project Team Management',
    desc: 'Manage project teams, roles and assignments.',
    href: '/admin/project-team',
    icon: Users,
    color: 'bg-blue-50 text-blue-700',
    borderColor: 'border-blue-100'
  },
  {
    title: 'Project Management',
    desc: 'Create, assign and track projects across lifecycle.',
    href: '/admin/projects',
    icon: FileText,
    color: 'bg-orange-50 text-orange-700',
    borderColor: 'border-orange-100'
  },
  {
    title: 'IT Box / Settings',
    desc: 'System configuration, user roles and permissions.',
    href: '/admin/settings',
    icon: Settings,
    color: 'bg-pink-50 text-pink-700',
    borderColor: 'border-pink-100'
  },
  {
    title: 'Master Data',
    desc: 'Manage categories, units, brands, and default data.',
    href: '/admin/master-data',
    icon: Database,
    color: 'bg-teal-50 text-teal-700',
    borderColor: 'border-teal-100'
  },
  {
    title: 'Reports & Analytics',
    desc: 'View insights, reports and business analytics.',
    href: '/admin/reports',
    icon: BarChart3,
    color: 'bg-purple-50 text-purple-700',
    borderColor: 'border-purple-100'
  },
  {
    title: 'AI Engine',
    desc: 'Manage AI models, rules and intelligent workflows.',
    href: '/admin/ai-engine',
    icon: Bot,
    color: 'bg-green-50 text-green-700',
    borderColor: 'border-green-100'
  },
];

export default function AdminLandingPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const statsRes = await adminAPI.stats();
      setStats(statsRes.data);
    } catch {
      toast.error('Failed to load platform stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load() }, []);

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </span>
          Welcome – Admin Portal
        </h1>
        <p className="text-slate-500 mt-2 ml-14">Manage and monitor all operations from one place</p>
      </div>

      {/* Compact Overview Section */}
      <div className="mb-12">
        <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Activity className="w-5 h-5 text-slate-400" />
          Quick Overview
        </h2>
        
        {loading ? (
          <div className="h-32 rounded-2xl bg-slate-100 animate-pulse border border-slate-200"></div>
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="text-sm text-slate-500 mb-1 font-medium">Total Customers</div>
              <div className="text-2xl font-bold text-slate-900">{stats.total_clients || 0}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="text-sm text-slate-500 mb-1 font-medium">Active Projects</div>
              <div className="text-2xl font-bold text-slate-900">{stats.active_projects || 0}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="text-sm text-slate-500 mb-1 font-medium">Total Vendors</div>
              <div className="text-2xl font-bold text-slate-900">{stats.total_vendors || 0}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="text-sm text-slate-500 mb-1 font-medium">Total Revenue</div>
              <div className="text-2xl font-bold text-slate-900">₹{(stats.total_revenue || 0).toLocaleString()}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="text-sm text-slate-500 mb-1 font-medium">Delayed Projects</div>
              <div className="text-2xl font-bold text-red-600">{stats.delayed_projects || 0}</div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 bg-slate-50 border border-slate-200 rounded-xl">
            Failed to load quick overview stats.
          </div>
        )}
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {MODULES.map((mod, i) => (
          <Link href={mod.href} key={mod.title}>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`h-full bg-white rounded-2xl border ${mod.borderColor} p-6 shadow-sm hover:shadow-md transition-all group flex flex-col`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${mod.color}`}>
                <mod.icon className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-slate-900 text-lg mb-2">{mod.title}</h3>
              <p className="text-sm text-slate-500 flex-1 mb-6">{mod.desc}</p>
              
              <div className="mt-auto flex items-center justify-center text-sm font-medium text-indigo-600 bg-indigo-50/50 rounded-lg py-2 group-hover:bg-indigo-100 transition-colors">
                Open <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.div>
          </Link>
        ))}
      </div>

    </div>
  );
}
