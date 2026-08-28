'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectTeamStore } from '@/stores/projectTeamStore';
import { useAuthStore } from '@/stores/authStore';
import {
  FolderKanban,
  CheckSquare,
  AlertCircle,
  Settings,
  Bell,
  LogOut,
  MapPin,
  Play,
  LayoutDashboard
} from 'lucide-react';
import clsx from 'clsx';
import Link from 'next/link';

export default function CoordinatorDashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { dashboard, projects, fetchDashboard, fetchProjects, isLoading, error } = useProjectTeamStore();
  
  // Navigation tabs for sidebar
  const [activeTab, setActiveTab] = useState<'dashboard' | 'projects' | 'tasks' | 'issues'>('dashboard');

  useEffect(() => {
    fetchDashboard().catch(() => {});
    fetchProjects().catch(() => {});
  }, [fetchDashboard, fetchProjects]);

  if (isLoading && !dashboard) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="text-white text-sm font-bold animate-pulse">Loading Workspace...</div>
      </div>
    );
  }

  const stats = dashboard?.coordinator || { assignedProjects: 0, pendingTasks: 0, vendorDelays: 0, upcomingVisits: 0 };
  
  // Sidebar navigation items
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Assigned Projects', icon: FolderKanban },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'issues', label: 'Issues', icon: AlertCircle },
    { id: 'resources', label: 'Resources', icon: Settings },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Navbar - Dark */}
      <header className="h-16 bg-[#0a0f1d] text-white flex items-center justify-between px-6 shrink-0 shadow-md relative z-20">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <img src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/static/assets/catalog/logo/Logo.png`} alt="Logo" className="w-8 h-8 object-contain" />
            <span className="font-bold text-xl tracking-tight hidden sm:block">InteriorAI</span>
          </Link>
          <div className="h-5 w-px bg-slate-700 mx-2 hidden sm:block"></div>
          <span className="text-sm font-medium text-slate-300">Project Team</span>
        </div>
        
        <div className="flex items-center gap-5">
          <button className="text-slate-400 hover:text-white transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          
          <div className="flex items-center gap-3 pl-5 border-l border-slate-700">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold border border-emerald-500/30">
              {user?.name?.substring(0, 2).toUpperCase() || 'CO'}
            </div>
            <div className="hidden md:block text-sm">
              <div className="font-bold text-slate-100 leading-none">{user?.name || 'Coordinator'}</div>
              <div className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-wider">Coordinator</div>
            </div>
            <button onClick={() => { logout(); router.push('/login'); }} className="ml-2 text-slate-400 hover:text-white transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Dark */}
        <aside className="w-64 bg-[#0d1425] shrink-0 border-r border-[#1e293b] flex flex-col">
          <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={clsx(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive 
                      ? "bg-emerald-600/10 text-emerald-400" 
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  )}
                >
                  <Icon className={clsx("w-5 h-5", isActive ? "text-emerald-500" : "text-slate-500")} />
                  {item.label}
                  {isActive && (
                    <div className="absolute left-0 w-1 h-8 bg-emerald-500 rounded-r-md"></div>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-8">
          {error && (
            <div className="p-4 mb-6 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          {/* TAB: Dashboard */}
          {activeTab === 'dashboard' && (
            <div className="animate-in fade-in duration-300 max-w-7xl mx-auto space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Coordinator Dashboard</h1>
                  <p className="text-slate-500 text-sm mt-1">Manage your pending tasks and assigned project status.</p>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                    <FolderKanban className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned Projects</p>
                    <div className="text-2xl font-bold text-slate-900">{stats.assignedProjects}</div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                    <CheckSquare className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Tasks</p>
                    <div className="text-2xl font-bold text-slate-900">{stats.pendingTasks}</div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Open Issues</p>
                    <div className="text-2xl font-bold text-slate-900">{stats.vendorDelays}</div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Project Execution Mini-view */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                   <div className="px-6 py-5 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800 text-lg">Project Execution</h3>
                   </div>
                   <div className="p-6">
                      <table className="w-full text-left text-sm">
                        <thead className="text-slate-500 font-semibold border-b border-slate-100">
                          <tr>
                            <th className="pb-3">Item</th>
                            <th className="pb-3">Status</th>
                            <th className="pb-3">Assigned To</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {/* Sample placeholder data based on UI screenshot */}
                          <tr>
                            <td className="py-3">
                              <span className="font-semibold text-slate-800 block text-xs">Living Room Sofa</span>
                            </td>
                            <td className="py-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-600">In Production</span>
                            </td>
                            <td className="py-3 text-xs text-slate-600 font-medium">Mike Wilson</td>
                          </tr>
                          <tr>
                            <td className="py-3">
                              <span className="font-semibold text-slate-800 block text-xs">TV Unit</span>
                            </td>
                            <td className="py-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-600">Delivered</span>
                            </td>
                            <td className="py-3 text-xs text-slate-600 font-medium">David Brown</td>
                          </tr>
                        </tbody>
                      </table>
                   </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Projects */}
          {activeTab === 'projects' && (
            <div className="animate-in fade-in duration-300 max-w-7xl mx-auto space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Assigned Projects</h2>
                <p className="text-slate-500 text-sm mt-1">Select a project to manage items, tasks, and issues.</p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {projects?.map((proj) => (
                  <div key={proj.id} className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{proj.propertyName || "Untitled Project"}</h3>
                        <p className="text-xs font-semibold text-slate-500 mt-1 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {proj.locality || "No location provided"}</p>
                      </div>
                      <span className={clsx("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", 
                        proj.status === 'ordered' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                      )}>
                        {proj.status === 'ordered' ? 'In Progress' : proj.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Customer</span>
                        <span className="font-bold text-slate-700 text-xs">{proj.customerName || "N/A"}</span>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Start Date</span>
                        <span className="font-bold text-slate-700 text-xs">{proj.startDate || "N/A"}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                      <div className="flex items-center gap-3 w-1/2">
                        <span className="text-xs font-black text-slate-700">{proj.progress}%</span>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${proj.progress}%` }} />
                        </div>
                      </div>
                      <button
                        onClick={() => router.push(`/projects/${proj.id}/execution`)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                      >
                        Open Execution <Play className="w-3 h-3 fill-current" />
                      </button>
                    </div>
                  </div>
                ))}
                {(!projects || projects.length === 0) && (
                  <div className="col-span-full text-center py-12 bg-white rounded-xl border border-slate-200">
                    <FolderKanban className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-slate-600">No Projects Found</h3>
                    <p className="text-sm text-slate-400 font-medium">You don't have any assigned projects right now.</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Fallback for other tabs */}
          {['tasks', 'issues', 'resources'].includes(activeTab) && (
             <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Settings className="w-8 h-8 text-slate-300" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-600 capitalize">{activeTab}</h2>
                  <p className="text-slate-400 text-sm">This section is currently under development.</p>
                </div>
             </div>
          )}
        </main>
      </div>
    </div>
  );
}
