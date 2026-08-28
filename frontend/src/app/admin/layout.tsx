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
  Building
} from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/enterprise', label: 'Enterprise', icon: Building },
  { href: '/admin/vendors', label: 'Vendors', icon: Briefcase },
  { href: '/admin/project-team', label: 'Project Team', icon: Users },
  { href: '/admin/projects', label: 'Projects', icon: LayoutDashboard },
  { href: '/admin/settings', label: 'IT Box / Settings', icon: Settings },
  { href: '/admin/master-data', label: 'Master Data', icon: Database },
  { href: '/admin/reports', label: 'Reports & Analytics', icon: BarChart3 },
  { href: '/admin/ai-engine', label: 'AI Engine', icon: Bot },
  { href: '/admin/activity-log', label: 'Activity Log', icon: Activity },
  { href: '/admin/audit-log', label: 'Audit Log', icon: ShieldCheck },
];

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
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Authenticating...</div>;
  }

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
              <p className="text-xs text-indigo-300 mt-1">Manage operations</p>
            </div>
            <nav className="flex-1 py-4 px-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                      isActive 
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/20" 
                        : "text-indigo-200 hover:text-white hover:bg-white/10"
                    )}
                  >
                    <Icon className={clsx("w-4 h-4", isActive ? "text-indigo-200" : "text-indigo-400")} />
                    {item.label}
                  </Link>
                );
              })}
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
