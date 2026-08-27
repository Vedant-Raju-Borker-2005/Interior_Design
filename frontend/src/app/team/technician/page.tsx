'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectTeamStore } from '@/stores/projectTeamStore';
import Navbar from '@/components/Navbar';
import {
  Wrench,
  MapPin,
  Play,
  ArrowLeft,
  LayoutDashboard,
  FolderKanban
} from 'lucide-react';
import clsx from 'clsx';

export default function TechnicianDashboardPage() {
  const router = useRouter();
  const { dashboard, projects, fetchDashboard, fetchProjects, isLoading, error } = useProjectTeamStore();
  const [activeTab, setActiveTab] = useState<'kpi' | 'projects'>('kpi');

  useEffect(() => {
    fetchDashboard().catch(() => {});
    fetchProjects().catch(() => {});
  }, [fetchDashboard, fetchProjects]);

  if (isLoading && !dashboard) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 pt-32 text-center text-sm font-bold text-slate-400">
          Loading Technician Portal...
        </div>
      </div>
    );
  }

  const stats = dashboard?.technician || { assignedInstallations: 0, pendingTasks: 0 };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      <Navbar />

      <div className="flex-1 flex pt-20 max-w-[1600px] w-full mx-auto">
        {/* Sidebar */}
        <aside className="w-72 bg-white border-r border-slate-200 hidden md:flex flex-col p-6 h-[calc(100vh-80px)] sticky top-20 overflow-y-auto">
          <button
            onClick={() => router.push('/team')}
            className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-amber-600 transition mb-8"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Welcome Portal
          </button>
          
          <div className="mb-10">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mb-4">
              <Wrench className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Technician</h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">Technician / Installer Workspace</p>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => setActiveTab('kpi')}
              className={clsx(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all",
                activeTab === 'kpi' ? "bg-amber-500 text-white shadow-md shadow-amber-200" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <LayoutDashboard className="w-5 h-5" /> Performance
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              className={clsx(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all",
                activeTab === 'projects' ? "bg-amber-500 text-white shadow-md shadow-amber-200" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <FolderKanban className="w-5 h-5" /> My Assignments
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-10 bg-slate-50/50 min-h-[calc(100vh-80px)] overflow-y-auto">
          {error && (
            <div className="p-4 mb-6 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500"></span> {error}
            </div>
          )}

          {/* TAB CONTENT: KPI Dashboard */}
          {activeTab === 'kpi' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Performance Overview</h2>
                <p className="text-slate-500 font-medium mt-1">Check your installation targets and pending field tasks.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white border-none p-6 rounded-3xl shadow-sm shadow-amber-200/50 relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-50 rounded-full group-hover:scale-150 transition-transform duration-500 z-0"></div>
                  <div className="relative z-10">
                    <span className="text-xs uppercase font-extrabold text-amber-500 tracking-wider">Assigned Installations</span>
                    <div className="text-5xl font-black text-amber-600 mt-2">{stats.assignedInstallations}</div>
                  </div>
                </div>
                <div className="bg-white border-none p-6 rounded-3xl shadow-sm shadow-slate-200/50 relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-slate-50 rounded-full group-hover:scale-150 transition-transform duration-500 z-0"></div>
                  <div className="relative z-10">
                    <span className="text-xs uppercase font-extrabold text-slate-400 tracking-wider">Pending Tasks</span>
                    <div className="text-5xl font-black text-slate-800 mt-2">{stats.pendingTasks}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: Project List */}
          {activeTab === 'projects' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">My Active Assignments</h2>
                <p className="text-slate-500 font-medium mt-1">Select a project to update your assigned items and upload proofs.</p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {projects?.map((proj) => (
                  <div key={proj.id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">{proj.propertyName || "Untitled Project"}</h3>
                        <p className="text-sm font-semibold text-slate-500 mt-1 flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {proj.locality || "No location provided"}</p>
                      </div>
                      <span className={clsx("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider", 
                        proj.status === 'ordered' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                      )}>
                        {proj.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-slate-50 rounded-2xl p-4">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Customer</span>
                        <span className="font-bold text-slate-700 text-sm">{proj.customerName || "N/A"}</span>
                      </div>
                      <div className="bg-slate-50 rounded-2xl p-4">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Start Date</span>
                        <span className="font-bold text-slate-700 text-sm">{proj.startDate || "N/A"}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-6">
                      <div className="flex items-center gap-3 w-1/2">
                        <span className="text-sm font-black text-slate-700">{proj.progress}%</span>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div className="bg-amber-500 h-full rounded-full" style={{ width: `${proj.progress}%` }} />
                        </div>
                      </div>
                      <button
                        onClick={() => router.push(`/projects/${proj.id}/execution`)}
                        className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-xl uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm shadow-amber-200"
                      >
                        Open Execution <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </div>
                  </div>
                ))}
                {(!projects || projects.length === 0) && (
                  <div className="col-span-full text-center py-12 bg-white rounded-3xl border border-slate-100">
                    <FolderKanban className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-slate-600">No Assignments Found</h3>
                    <p className="text-sm text-slate-400 font-medium">You don't have any field assignments right now.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
