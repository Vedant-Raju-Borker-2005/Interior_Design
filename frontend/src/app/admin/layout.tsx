'use client';

import { useAuthStore } from '@/stores/authStore';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import clsx from 'clsx';
import { 
  Users, 
  Briefcase, 
  LayoutDashboard, 
  Settings, 
  Database, 
  BarChart3, 
  Bot, 
  Activity, 
  ShieldCheck,
  Building,
  ClipboardCheck,
  FileSearch,
  Handshake,
  ArrowLeft
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: any;
}

interface ModuleConfig {
  title: string;
  items: NavItem[];
}

const MODULE_CONFIGS: Record<string, ModuleConfig> = {
  customer: {
    title: 'Customer Management',
    items: [
      { href: '/admin/customers', label: 'Customer Directory', icon: Users },
      { href: '/admin/quotations', label: 'Quotations Search', icon: FileSearch },
    ]
  },
  enterprise: {
    title: 'Enterprise Management',
    items: [
      { href: '/admin/enterprise', label: 'Enterprise Partners', icon: Building },
    ]
  },
  vendor: {
    title: 'Vendor Governance',
    items: [
      { href: '/admin/vendors', label: 'Vendor Directory & KYC', icon: Briefcase },
    ]
  },
  team: {
    title: 'Project Team',
    items: [
      { href: '/admin/project-team', label: 'Team Roles & Onboarding', icon: Users },
    ]
  },
  project: {
    title: 'Project Control',
    items: [
      { href: '/admin/projects', label: 'Project Directory', icon: LayoutDashboard },
      { href: '/admin/approvals', label: 'Project Approvals', icon: ClipboardCheck },
    ]
  },
  special: {
    title: 'Special Services',
    items: [
      { href: '/admin/special-services', label: 'Consultations & Requests', icon: Handshake },
    ]
  },
  settings: {
    title: 'IT Box & Settings',
    items: [
      { href: '/admin/settings', label: 'System Settings', icon: Settings },
      { href: '/admin/audit-log', label: 'Audit Trail', icon: ShieldCheck },
      { href: '/admin/activity-log', label: 'Developer Activity', icon: Activity },
    ]
  },
  masterdata: {
    title: 'Master Catalog',
    items: [
      { href: '/admin/master-data', label: 'Catalog CRUD & CSV', icon: Database },
    ]
  },
  reports: {
    title: 'Reports & Analytics',
    items: [
      { href: '/admin/reports', label: 'Operational CSV Reports', icon: BarChart3 },
    ]
  },
  ai: {
    title: 'AI Engine',
    items: [
      { href: '/admin/ai-engine', label: 'Model Customization', icon: Bot },
    ]
  }
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoggedIn, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (mounted && (!isLoggedIn || user?.role !== 'admin')) {
      router.push('/');
    }
  }, [isLoggedIn, user, mounted, router]);

  if (!mounted || !isLoggedIn || user?.role !== 'admin') {
    return <div className="min-h-screen bg-[#FAFBF9] flex items-center justify-center text-stone-500">Authenticating...</div>;
  }

  // Determine active module based on current pathname
  const getActiveModule = (): ModuleConfig => {
    if (pathname.startsWith('/admin/customers') || pathname.startsWith('/admin/quotations')) return MODULE_CONFIGS.customer;
    if (pathname.startsWith('/admin/enterprise')) return MODULE_CONFIGS.enterprise;
    if (pathname.startsWith('/admin/vendors')) return MODULE_CONFIGS.vendor;
    if (pathname.startsWith('/admin/project-team')) return MODULE_CONFIGS.team;
    if (pathname.startsWith('/admin/projects') || pathname.startsWith('/admin/approvals')) return MODULE_CONFIGS.project;
    if (pathname.startsWith('/admin/special-services')) return MODULE_CONFIGS.special;
    if (pathname.startsWith('/admin/settings') || pathname.startsWith('/admin/audit-log') || pathname.startsWith('/admin/activity-log')) return MODULE_CONFIGS.settings;
    if (pathname.startsWith('/admin/master-data')) return MODULE_CONFIGS.masterdata;
    if (pathname.startsWith('/admin/reports')) return MODULE_CONFIGS.reports;
    if (pathname.startsWith('/admin/ai-engine')) return MODULE_CONFIGS.ai;
    return MODULE_CONFIGS.customer;
  };

  const activeModule = getActiveModule();

  return (
    <div className="min-h-screen bg-[#FAFBF9] text-[#161D1A] flex flex-col">
      <Navbar />
      <div className="flex flex-1 pt-16 h-[calc(100vh-64px)] overflow-hidden">
        {/* Contextual Isolated Sidebar - Hide on root /admin hub */}
        {pathname !== '/admin' && (
          <aside className="w-64 bg-white text-[#161D1A] flex-shrink-0 flex flex-col overflow-y-auto border-r border-[#E5ECE7] hidden md:flex">
            {/* Top Back Navigation: Arrow-Only Header */}
            <div className="p-4 py-5 border-b border-[#E5ECE7] flex items-center justify-between">
              <Link
                href="/admin"
                className="p-2 rounded-xl text-stone-600 hover:text-[#161D1A] hover:bg-[#F4F6F4] border border-[#E5ECE7] transition-all flex items-center justify-center shadow-2xs group"
                title="Back to Admin Hub"
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
              </Link>
              <div className="text-right">
                <div className="text-xs font-black text-[#161D1A] uppercase tracking-wider">{activeModule.title}</div>
                <div className="text-[10px] text-stone-400 font-medium">Admin Workspace</div>
              </div>
            </div>
            
            {/* Direct Flattened Navigation Links */}
            <nav className="flex-1 py-4 px-3 space-y-1.5">
              {activeModule.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all duration-200 relative",
                      isActive
                        ? "bg-[#F4F6F4] text-[#161D1A] font-extrabold shadow-2xs"
                        : "text-stone-600 hover:bg-[#F4F6F4] hover:text-[#161D1A]"
                    )}
                  >
                    <Icon className={clsx("w-4 h-4 shrink-0", isActive ? "text-[#65A30D]" : "text-stone-400")} />
                    <span className="truncate">{item.label}</span>
                    {isActive && (
                      <div className="absolute left-0 w-1.5 h-6 bg-[#84CC16] rounded-r-md"></div>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Bottom Quick Return */}
            <div className="p-4 border-t border-[#E5ECE7] bg-[#FAFBF9]">
              <Link
                href="/admin"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white border border-[#E5ECE7] hover:border-[#84CC16] text-xs font-bold text-stone-600 hover:text-[#161D1A] transition shadow-2xs"
              >
                <LayoutDashboard className="w-4 h-4 text-stone-400" />
                <span>Admin Hub Home</span>
              </Link>
            </div>
          </aside>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-[#FAFBF9] relative">
          {children}
        </main>
      </div>
    </div>
  );
}
