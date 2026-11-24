'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { adminAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {
  Users, Home, FileText, MessageCircle, TrendingUp,
  BarChart3, CheckCircle2, Clock, AlertCircle, Building2, Building,
  ArrowRight, ShieldCheck, Database, Settings, Activity, Bot, Handshake
} from 'lucide-react';

const MODULES = [
  {
    title: 'Customer Directory',
    tag: 'Clients',
    href: '/admin/customers',
    icon: Users,
    color: 'bg-emerald-50 text-[#059669]',
  },
  {
    title: 'Enterprise Portfolios',
    tag: 'B2B Developers',
    href: '/admin/enterprise',
    icon: Building,
    color: 'bg-[#F4F6F4] text-[#161D1A]',
  },
  {
    title: 'Vendor Governance',
    tag: 'Suppliers',
    href: '/admin/vendors',
    icon: Building2,
    color: 'bg-emerald-50 text-[#059669]',
  },
  {
    title: 'Project Team Roles',
    tag: 'Staff',
    href: '/admin/project-team',
    icon: Users,
    color: 'bg-[#F4F6F4] text-[#161D1A]',
  },
  {
    title: 'Project Control',
    tag: 'Live Sites',
    href: '/admin/projects',
    icon: FileText,
    color: 'bg-emerald-50 text-[#059669]',
  },
  {
    title: 'Quotations Search',
    tag: 'Estimates',
    href: '/admin/quotations',
    icon: FileText,
    color: 'bg-[#F4F6F4] text-[#161D1A]',
  },
  {
    title: 'Special Services',
    tag: 'Consultations',
    href: '/admin/special-services',
    icon: Handshake,
    color: 'bg-amber-50 text-amber-800',
  },
  {
    title: 'Master Catalog Data',
    tag: 'Inventory',
    href: '/admin/master-data',
    icon: Database,
    color: 'bg-emerald-50 text-[#059669]',
  },
  {
    title: 'Reports & Exports',
    tag: 'Analytics',
    href: '/admin/reports',
    icon: BarChart3,
    color: 'bg-[#F4F6F4] text-[#161D1A]',
  },
  {
    title: 'IT Box & Settings',
    tag: 'System',
    href: '/admin/settings',
    icon: Settings,
    color: 'bg-[#F4F6F4] text-[#161D1A]',
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
    <div className="p-6 lg:p-10 max-w-7xl mx-auto w-full text-[#161D1A]">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-[#161D1A] tracking-tight flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-[#84CC16] text-[#0B0F0D] flex items-center justify-center font-black shadow-xs">
            <ShieldCheck className="w-6 h-6" />
          </span>
          Admin Control Center
        </h1>
        <p className="text-stone-500 mt-2 ml-14">High-density administrative governance and operations hub</p>
      </div>

      {/* Compact Overview Section */}
      <div className="mb-12">
        <h2 className="text-lg font-bold text-[#161D1A] mb-6 flex items-center gap-2">
          <Activity className="w-5 h-5 text-stone-400" />
          Quick Overview
        </h2>
        
        {loading ? (
          <div className="h-32 rounded-2xl bg-stone-100 animate-pulse border border-[#E5ECE7]"></div>
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white border border-[#E5ECE7] rounded-2xl p-5 shadow-xs">
              <div className="text-sm text-stone-500 mb-1 font-medium">Total Customers</div>
              <div className="text-2xl font-black text-[#161D1A]">{stats.total_clients || 0}</div>
            </div>
            <div className="bg-white border border-[#E5ECE7] rounded-2xl p-5 shadow-xs">
              <div className="text-sm text-stone-500 mb-1 font-medium">Total Enterprises</div>
              <div className="text-2xl font-black text-[#059669]">{stats.total_enterprises || 0}</div>
            </div>
            <div className="bg-white border border-[#E5ECE7] rounded-2xl p-5 shadow-xs">
              <div className="text-sm text-stone-500 mb-1 font-medium">Active Projects</div>
              <div className="text-2xl font-black text-[#161D1A]">{stats.total_projects || stats.active_projects || 0}</div>
            </div>
            <div className="bg-white border border-[#E5ECE7] rounded-2xl p-5 shadow-xs">
              <div className="text-sm text-stone-500 mb-1 font-medium">Total Vendors</div>
              <div className="text-2xl font-black text-[#161D1A]">{stats.total_vendors || 0}</div>
            </div>
            <div className="bg-white border border-[#E5ECE7] rounded-2xl p-5 shadow-xs">
              <div className="text-sm text-stone-500 mb-1 font-medium">Total Revenue</div>
              <div className="text-2xl font-black text-[#059669]">₹{(stats.total_revenue || 0).toLocaleString()}</div>
            </div>
            <div className="bg-white border border-[#E5ECE7] rounded-2xl p-5 shadow-xs">
              <div className="text-sm text-stone-500 mb-1 font-medium">Delayed Projects</div>
              <div className="text-2xl font-black text-rose-600">{stats.delayed_projects || 0}</div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-stone-500 bg-[#FAFBF9] border border-[#E5ECE7] rounded-2xl">
            Failed to load quick overview stats.
          </div>
        )}
      </div>

      {/* Modules Grid - Option B: High-Density Executive Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-12">
        {MODULES.map((mod, i) => (
          <Link href={mod.href} key={mod.title} className="block group">
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="h-full bg-white rounded-2xl border border-[#E5ECE7] p-5 shadow-xs transition-all duration-200 group-hover:scale-105 group-hover:border-[#84CC16] group-hover:shadow-[0_12px_30px_rgba(132,204,22,0.18)] cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${mod.color}`}>
                    <mod.icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] uppercase font-bold text-stone-400 bg-stone-50 px-2 py-0.5 rounded-md border border-stone-100">
                    {mod.tag}
                  </span>
                </div>
                <h3 className="font-extrabold text-[#161D1A] text-sm leading-snug group-hover:text-[#65A30D] transition-colors">{mod.title}</h3>
              </div>
              
              <div className="mt-4 pt-3 border-t border-[#E5ECE7]/60 flex items-center justify-between text-xs text-stone-400 font-bold group-hover:text-[#65A30D] transition-colors">
                <span>Manage</span>
                <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.div>
          </Link>
        ))}
      </div>

    </div>
  );
}
