'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectTeamStore } from '@/stores/projectTeamStore';
import Navbar from '@/components/Navbar';
import {
  Briefcase,
  AlertTriangle,
  CheckCircle,
  Users,
  Clock,
  Calendar,
  ClipboardList,
  ChevronRight,
  TrendingUp,
  UserCheck
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function TeamDashboardPage() {
  const router = useRouter();
  const { dashboard, fetchDashboard, isLoading, error } = useProjectTeamStore();
  const [activeRole, setActiveRole] = useState<'MANAGER' | 'COORDINATOR' | 'TECHNICIAN'>('MANAGER');

  useEffect(() => {
    fetchDashboard().catch(() => {});
  }, [fetchDashboard]);

  useEffect(() => {
    if (dashboard?.roles && dashboard.roles.length > 0) {
      setActiveRole(dashboard.roles[0]);
    }
  }, [dashboard]);

  if (isLoading && !dashboard) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 pt-32 text-center text-sm font-bold text-slate-400">
          Loading Dashboard...
        </div>
      </div>
    );
  }

  const stats = dashboard || {
    manager: { totalProjects: 0, activeProjects: 0, delayedProjects: 0, completedProjects: 0, openIssues: 0, teamUtilization: 0 },
    coordinator: { assignedProjects: 0, pendingTasks: 0, vendorDelays: 0, upcomingVisits: 0 },
    technician: { assignedInstallations: 0, todaysTasks: 0, pendingTasks: 0, completedTasks: 0 },
    roles: ['MANAGER']
  };

  const rolesList = stats.roles && stats.roles.length > 0 ? stats.roles : ['MANAGER', 'COORDINATOR', 'TECHNICIAN'];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 pt-24 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Briefcase className="w-8 h-8 text-indigo-600" />
              Project Team Dashboard
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Workspace execution portal and operational metrics dashboard.
            </p>
          </div>

          {/* Role switcher tab */}
          <div className="flex bg-slate-200/60 p-1 rounded-xl self-start md:self-center border border-slate-300/30">
            {rolesList.map((role: string) => (
              <button
                key={role}
                onClick={() => setActiveRole(role as any)}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeRole === role
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {role} VIEW
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl text-xs text-red-700 font-bold">
            {error}
          </div>
        )}

        {/* Manager Dashboard view */}
        {activeRole === 'MANAGER' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* KPI Section */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Projects</span>
                <div className="text-2xl font-black text-slate-800 mt-1">{stats.manager.totalProjects}</div>
              </div>
              <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider text-emerald-600">Active</span>
                <div className="text-2xl font-black text-emerald-600 mt-1">{stats.manager.activeProjects}</div>
              </div>
              <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider text-red-500">Delayed</span>
                <div className="text-2xl font-black text-red-500 mt-1">{stats.manager.delayedProjects}</div>
              </div>
              <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider text-indigo-600">Completed</span>
                <div className="text-2xl font-black text-indigo-600 mt-1">{stats.manager.completedProjects}</div>
              </div>
              <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider text-amber-600">Open Issues</span>
                <div className="text-2xl font-black text-amber-600 mt-1">{stats.manager.openIssues}</div>
              </div>
              <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Team Util.</span>
                <div className="text-2xl font-black text-slate-800 mt-1 flex items-baseline gap-0.5">
                  {stats.manager.teamUtilization}<span className="text-xs font-bold">%</span>
                </div>
              </div>
            </div>

            {/* Main Manager Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200/85 p-6 rounded-2xl shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-indigo-600" />
                  Quick Assign Coordinators & Technicians
                </h3>
                <p className="text-xs text-slate-500">
                  Select a project to configure execution teams, reassign personnel, or review performance records.
                </p>
                <div className="pt-2 border-t border-slate-100 flex gap-3">
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                  >
                    Manage Project Allocations <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="bg-white border border-slate-200/85 p-6 rounded-2xl shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  Monthly Trend Analysis
                </h3>
                <p className="text-xs text-slate-500">
                  Track delivery success rate, technician productivity logs, and issue resolution SLAs.
                </p>
                <div className="pt-2 border-t border-slate-100 text-xs text-slate-400 font-semibold">
                  SLA Goal: 95% completion within 30 days of design handoff.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Coordinator Dashboard view */}
        {activeRole === 'COORDINATOR' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* KPI Section */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Assigned Projects</span>
                <div className="text-2xl font-black text-indigo-600 mt-1">{stats.coordinator.assignedProjects}</div>
              </div>
              <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pending Tasks</span>
                <div className="text-2xl font-black text-slate-800 mt-1">{stats.coordinator.pendingTasks}</div>
              </div>
              <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider text-red-500">Vendor Delays</span>
                <div className="text-2xl font-black text-red-500 mt-1">{stats.coordinator.vendorDelays}</div>
              </div>
              <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Upcoming Site Visits</span>
                <div className="text-2xl font-black text-emerald-600 mt-1">{stats.coordinator.upcomingVisits}</div>
              </div>
            </div>

            {/* List of assigned projects */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 text-sm mb-4 uppercase tracking-wider">Assigned Execution Projects</h3>
              <p className="text-xs text-slate-500 mb-4">
                You are assigned as the coordinator for these active projects.
              </p>
              <div className="text-center py-6 text-slate-400 text-xs font-semibold border border-dashed border-slate-200 rounded-xl">
                Please check the general Dashboard and select execution views to log progress.
              </div>
            </div>
          </div>
        )}

        {/* Technician Dashboard view */}
        {activeRole === 'TECHNICIAN' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* KPI Section */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Assigned Installations</span>
                <div className="text-2xl font-black text-indigo-600 mt-1">{stats.technician.assignedInstallations}</div>
              </div>
              <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Today's Tasks</span>
                <div className="text-2xl font-black text-teal-700 mt-1">{stats.technician.todaysTasks}</div>
              </div>
              <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pending Tasks</span>
                <div className="text-2xl font-black text-slate-800 mt-1">{stats.technician.pendingTasks}</div>
              </div>
              <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider text-emerald-600">Completed Tasks</span>
                <div className="text-2xl font-black text-emerald-600 mt-1">{stats.technician.completedTasks}</div>
              </div>
            </div>

            {/* List of active tasks */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 text-sm mb-4 uppercase tracking-wider">Your Assigned Site Checklists</h3>
              <p className="text-xs text-slate-500 mb-4">
                Record outcome of fitment jobs and upload installation verification proof.
              </p>
              <div className="text-center py-6 text-slate-400 text-xs font-semibold border border-dashed border-slate-200 rounded-xl">
                No custom checklist items assigned for today. Go to the project execution screen to upload fitment photos.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
