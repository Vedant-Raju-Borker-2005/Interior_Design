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
  ChevronDown,
  ChevronRight
} from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoggedIn, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  // Customer dropdown state
  const isCustomerPath = pathname === '/admin/customers' || pathname === '/admin/quotations';
  const [customerOpen, setCustomerOpen] = useState(isCustomerPath);

  // Project Management dropdown state
  const isProjectPath = pathname.startsWith('/admin/projects') || pathname === '/admin/approvals';
  const [projectOpen, setProjectOpen] = useState(isProjectPath);

  useEffect(() => {
    setMounted(true);
    if (mounted && (!isLoggedIn || user?.role !== 'admin')) {
      router.push('/');
    }
  }, [isLoggedIn, user, mounted, router]);

  useEffect(() => {
    if (isCustomerPath) setCustomerOpen(true);
    if (isProjectPath) setProjectOpen(true);
  }, [pathname, isCustomerPath, isProjectPath]);

  if (!mounted || !isLoggedIn || user?.role !== 'admin') {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Authenticating...</div>;
  }

  const customerSubItems = [
    { href: '/admin/customers', label: 'Customer Directory', icon: Users },
    { href: '/admin/quotations', label: 'Quotations Search', icon: FileSearch },
  ];

  const projectSubItems = [
    { href: '/admin/projects', label: 'Project Directory', icon: LayoutDashboard },
    { href: '/admin/approvals', label: 'Project Approvals', icon: ClipboardCheck },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <div className="flex flex-1 pt-16 h-[calc(100vh-64px)] overflow-hidden">
        {/* Sidebar - Hide on root /admin page */}
        {pathname !== '/admin' && (
          <aside className="w-64 bg-indigo-950 text-indigo-100 flex-shrink-0 flex flex-col overflow-y-auto border-r border-indigo-900/50 hidden md:flex">
            <div className="p-4 py-6 border-b border-indigo-900/50">
              <h2 className="text-white font-semibold text-lg flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                Admin Portal
              </h2>
              <p className="text-xs text-indigo-300 mt-1">Manage operations & governance</p>
            </div>
            
            <nav className="flex-1 py-4 px-3 space-y-1">
              {/* Dashboard */}
              <Link
                href="/admin"
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  pathname === '/admin'
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/20" 
                    : "text-indigo-200 hover:text-white hover:bg-white/10"
                )}
              >
                <LayoutDashboard className="w-4 h-4 text-indigo-300" />
                Dashboard
              </Link>

              {/* Customer Management Dropdown */}
              <div className="space-y-1">
                <div 
                  className={clsx(
                    "flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all select-none",
                    isCustomerPath 
                      ? "bg-indigo-900/80 text-white border border-indigo-700/50" 
                      : "text-indigo-200 hover:text-white hover:bg-white/10"
                  )}
                  onClick={() => setCustomerOpen(!customerOpen)}
                >
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-indigo-300" />
                    <span>Customer Management</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setCustomerOpen(!customerOpen);
                    }}
                    className="p-0.5 text-indigo-300 hover:text-white rounded"
                  >
                    {customerOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>

                {/* Sub-items list */}
                {customerOpen && (
                  <div className="pl-4 pr-1 py-1 space-y-1 bg-indigo-900/30 rounded-lg border border-indigo-800/30 my-1">
                    {customerSubItems.map((sub) => {
                      const SubIcon = sub.icon;
                      const isSubActive = pathname === sub.href;
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className={clsx(
                            "flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all",
                            isSubActive
                              ? "bg-indigo-600 text-white font-semibold shadow-sm"
                              : "text-indigo-300 hover:text-white hover:bg-indigo-800/50"
                          )}
                        >
                          <SubIcon className={clsx("w-3.5 h-3.5", isSubActive ? "text-white" : "text-indigo-400")} />
                          {sub.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Enterprise Management */}
              <Link
                href="/admin/enterprise"
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  pathname.startsWith('/admin/enterprise')
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/20" 
                    : "text-indigo-200 hover:text-white hover:bg-white/10"
                )}
              >
                <Building className="w-4 h-4 text-indigo-300" />
                Enterprise
              </Link>

              {/* Vendor Management */}
              <Link
                href="/admin/vendors"
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  pathname.startsWith('/admin/vendors')
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/20" 
                    : "text-indigo-200 hover:text-white hover:bg-white/10"
                )}
              >
                <Briefcase className="w-4 h-4 text-indigo-300" />
                Vendors
              </Link>

              {/* Project Team */}
              <Link
                href="/admin/project-team"
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  pathname.startsWith('/admin/project-team')
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/20" 
                    : "text-indigo-200 hover:text-white hover:bg-white/10"
                )}
              >
                <Users className="w-4 h-4 text-indigo-300" />
                Project Team
              </Link>

              {/* Project Management Dropdown */}
              <div className="space-y-1">
                <div 
                  className={clsx(
                    "flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all select-none",
                    isProjectPath 
                      ? "bg-indigo-900/80 text-white border border-indigo-700/50" 
                      : "text-indigo-200 hover:text-white hover:bg-white/10"
                  )}
                  onClick={() => setProjectOpen(!projectOpen)}
                >
                  <div className="flex items-center gap-3">
                    <LayoutDashboard className="w-4 h-4 text-indigo-300" />
                    <span>Project Management</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setProjectOpen(!projectOpen);
                    }}
                    className="p-0.5 text-indigo-300 hover:text-white rounded"
                  >
                    {projectOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>

                {projectOpen && (
                  <div className="pl-4 pr-1 py-1 space-y-1 bg-indigo-900/30 rounded-lg border border-indigo-800/30 my-1">
                    {projectSubItems.map((sub) => {
                      const SubIcon = sub.icon;
                      const isSubActive = pathname === sub.href;
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className={clsx(
                            "flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all",
                            isSubActive
                              ? "bg-indigo-600 text-white font-semibold shadow-sm"
                              : "text-indigo-300 hover:text-white hover:bg-indigo-800/50"
                          )}
                        >
                          <SubIcon className={clsx("w-3.5 h-3.5", isSubActive ? "text-white" : "text-indigo-400")} />
                          {sub.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Special Services (NEW BOX & SIDEBAR MATCH) */}
              <Link
                href="/admin/special-services"
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  pathname.startsWith('/admin/special-services')
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/20" 
                    : "text-indigo-200 hover:text-white hover:bg-white/10"
                )}
              >
                <Handshake className="w-4 h-4 text-indigo-300" />
                Special Services
              </Link>

              {/* IT Box / Settings */}
              <Link
                href="/admin/settings"
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  pathname.startsWith('/admin/settings')
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/20" 
                    : "text-indigo-200 hover:text-white hover:bg-white/10"
                )}
              >
                <Settings className="w-4 h-4 text-indigo-300" />
                IT Box / Settings
              </Link>

              {/* Master Data */}
              <Link
                href="/admin/master-data"
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  pathname.startsWith('/admin/master-data')
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/20" 
                    : "text-indigo-200 hover:text-white hover:bg-white/10"
                )}
              >
                <Database className="w-4 h-4 text-indigo-300" />
                Master Data
              </Link>

              {/* Reports & Analytics */}
              <Link
                href="/admin/reports"
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  pathname.startsWith('/admin/reports')
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/20" 
                    : "text-indigo-200 hover:text-white hover:bg-white/10"
                )}
              >
                <BarChart3 className="w-4 h-4 text-indigo-300" />
                Reports & Analytics
              </Link>

              {/* AI Engine */}
              <Link
                href="/admin/ai-engine"
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  pathname.startsWith('/admin/ai-engine')
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/20" 
                    : "text-indigo-200 hover:text-white hover:bg-white/10"
                )}
              >
                <Bot className="w-4 h-4 text-indigo-300" />
                AI Engine
              </Link>

              {/* Activity Log */}
              <Link
                href="/admin/activity-log"
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  pathname.startsWith('/admin/activity-log')
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/20" 
                    : "text-indigo-200 hover:text-white hover:bg-white/10"
                )}
              >
                <Activity className="w-4 h-4 text-indigo-300" />
                Activity Log
              </Link>

              {/* Audit Log */}
              <Link
                href="/admin/audit-log"
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  pathname.startsWith('/admin/audit-log')
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/20" 
                    : "text-indigo-200 hover:text-white hover:bg-white/10"
                )}
              >
                <ShieldCheck className="w-4 h-4 text-indigo-300" />
                Audit Log
              </Link>
            </nav>
          </aside>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-slate-50 relative">
          {children}
        </main>
      </div>
    </div>
  );
}

