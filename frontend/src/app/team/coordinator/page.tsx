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
  LayoutDashboard,
  Check,
  ShieldAlert
} from 'lucide-react';
import clsx from 'clsx';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function CoordinatorDashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { dashboard, projects, globalIssues, globalTasks, globalResources, fetchDashboard, fetchProjects, fetchGlobalIssues, fetchGlobalTasks, fetchGlobalResources, resolveIssue, isLoading, error } = useProjectTeamStore();
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'projects' | 'tasks' | 'issues' | 'resources'>('dashboard');
  const [resolveFormId, setResolveFormId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [issueFilter, setIssueFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL');

  useEffect(() => {
    fetchDashboard().catch(() => {});
    fetchProjects().catch(() => {});
  }, [fetchDashboard, fetchProjects]);

  useEffect(() => {
    if (activeTab === 'issues') fetchGlobalIssues().catch(() => {});
    if (activeTab === 'tasks') fetchGlobalTasks().catch(() => {});
    if (activeTab === 'resources') fetchGlobalResources().catch(() => {});
  }, [activeTab, fetchGlobalIssues, fetchGlobalTasks, fetchGlobalResources]);

  const handleResolveIssue = async (issueId: string) => {
    try {
      await resolveIssue(issueId, resolutionText);
      toast.success('Issue marked as resolved');
      setResolveFormId(null);
      setResolutionText('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to resolve issue');
    }
  };

  if (user?.status === 'pending_verification' && !user?.role?.includes('admin')) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="w-16 h-16 text-amber-400 mb-4 animate-bounce" />
        <h1 className="text-3xl font-bold mb-2">Account Approval Pending</h1>
        <p className="text-slate-300 max-w-md mb-6 leading-relaxed">
          Your Coordinator registration is currently pending review by an Administrator. Access to this workspace will be granted once approved.
        </p>
        <button onClick={() => router.push('/team')} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg transition-all">
          Return to Team Portal
        </button>
      </div>
    );
  }

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
    <div className="min-h-screen bg-[#FAFBF9] text-[#161D1A] flex flex-col font-sans">
      {/* Top Navbar - Editorial Alabaster Glass */}
      <header className="h-16 bg-white/95 backdrop-blur-md border-b border-[#E5ECE7] text-[#161D1A] flex items-center justify-between px-6 shrink-0 shadow-xs relative z-20">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <img src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/static/assets/catalog/logo/Logo.webp`} alt="Logo" className="w-8 h-8 object-contain" />
            <span className="font-black text-xl tracking-tight hidden sm:block">InteriorAI</span>
          </Link>
        </div>
        
        <div className="flex items-center gap-5">
          <button className="text-stone-400 hover:text-stone-700 transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full"></span>
          </button>
          
          <div className="flex items-center gap-3 pl-5 border-l border-[#E5ECE7]">
            <div className="w-8 h-8 rounded-full bg-[#84CC16] text-[#0B0F0D] flex items-center justify-center text-xs font-black">
              {user?.name?.substring(0, 2).toUpperCase() || 'CO'}
            </div>
            <div className="hidden md:block text-sm">
              <div className="font-bold text-stone-900 leading-none">{user?.name || 'Coordinator'}</div>
              <div className="text-[10px] text-stone-500 font-medium mt-1 uppercase tracking-wider">Coordinator</div>
            </div>
            <button onClick={() => { logout(); window.location.href = '/'; }} className="ml-2 text-stone-400 hover:text-rose-600 transition-colors" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - White Editorial Theme */}
        <aside className="w-64 bg-white shrink-0 border-r border-[#E5ECE7] flex flex-col">
          <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={clsx(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 relative",
                    isActive 
                      ? "bg-[#F4F6F4] text-[#161D1A] font-extrabold shadow-xs" 
                      : "text-stone-600 hover:bg-[#F4F6F4] hover:text-[#161D1A]"
                  )}
                >
                  <Icon className={clsx("w-5 h-5", isActive ? "text-[#65A30D]" : "text-stone-400")} />
                  {item.label}
                  {isActive && (
                    <div className="absolute left-0 w-1.5 h-7 bg-[#84CC16] rounded-r-md"></div>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-[#FAFBF9] text-[#161D1A] p-8">
          {error && (
            <div className="p-4 mb-6 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          {/* TAB: Dashboard */}
          {activeTab === 'dashboard' && (
            <div className="animate-in fade-in duration-300 max-w-7xl mx-auto space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-black text-[#161D1A]">Coordinator Dashboard</h1>
                  <p className="text-stone-500 text-sm mt-1">Manage your pending tasks and assigned project status.</p>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-[#E5ECE7] shadow-xs flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-200/60">
                    <FolderKanban className="w-5 h-5 text-[#059669]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Assigned Projects</p>
                    <div className="text-2xl font-black text-[#059669]">{stats.assignedProjects}</div>
                  </div>
                </div>
                
                <div className="bg-white rounded-2xl p-5 border border-[#E5ECE7] shadow-xs flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#F4F6F4] flex items-center justify-center shrink-0">
                    <CheckSquare className="w-5 h-5 text-[#161D1A]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Pending Tasks</p>
                    <div className="text-2xl font-black text-[#161D1A]">{stats.pendingTasks}</div>
                  </div>
                </div>
                
                <div className="bg-white rounded-2xl p-5 border border-[#E5ECE7] shadow-xs flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center shrink-0 border border-rose-200">
                    <AlertCircle className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Open Issues</p>
                    <div className="text-2xl font-black text-rose-700">{stats.vendorDelays}</div>
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
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-50 text-indigo-600">In Production</span>
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
                          <div className="bg-[#84CC16] h-full rounded-full" style={{ width: `${proj.progress}%` }} />
                        </div>
                      </div>
                      <button
                        onClick={() => router.push(`/projects/${proj.id}/execution`)}
                        className="px-4 py-2 bg-[#84CC16] hover:bg-[#A3E635] text-[#0B0F0D] text-xs font-black rounded-lg transition-colors flex items-center gap-2 shadow-xs"
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
          
          {/* TAB: Issues */}
          {activeTab === 'issues' && (
            <div className="animate-in fade-in duration-300 max-w-7xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Issues & Escalations</h2>
                  <p className="text-slate-500 text-sm mt-1">All open issues across your assigned projects.</p>
                </div>
                <div className="flex gap-2">
                  {(['ALL', 'OPEN', 'RESOLVED'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setIssueFilter(f)}
                      className={clsx('px-3 py-1.5 text-xs font-bold rounded-lg border transition-all', issueFilter === f ? 'bg-[#84CC16] text-[#0B0F0D] border-[#84CC16]' : 'bg-white text-slate-600 border-slate-200 hover:border-lime-300')}
                    >{f}</button>
                  ))}
                </div>
              </div>

              {globalIssues.filter(i => issueFilter === 'ALL' || i.status === issueFilter).length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                  <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-slate-600">No Issues Found</h3>
                  <p className="text-sm text-slate-400 mt-1">No {issueFilter !== 'ALL' ? issueFilter.toLowerCase() : ''} issues found.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {globalIssues.filter(i => issueFilter === 'ALL' || i.status === issueFilter).map((issue: any) => (
                    <div key={issue.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-xs font-black uppercase text-emerald-700">{issue.type?.replace(/_/g,' ')}</span>
                          <span className={clsx('px-2 py-0.5 text-[10px] font-bold border rounded-full uppercase',
                            issue.priority === 'CRITICAL' ? 'bg-red-50 text-red-700 border-red-200' :
                            issue.priority === 'HIGH' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                            issue.priority === 'MEDIUM' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                            'bg-slate-50 text-slate-600 border-slate-200'
                          )}>{issue.priority}</span>
                          <span className="text-[10px] text-slate-400 font-mono">Project: {issue.projectId?.substring(0,8)}</span>
                        </div>
                        <span className={clsx('shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black uppercase border',
                          issue.status === 'RESOLVED' || issue.status === 'CLOSED' ? 'bg-green-50 text-green-700 border-green-200' :
                          issue.status === 'ESCALATED' ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-indigo-50 text-indigo-700 border-indigo-200'
                        )}>{issue.status}</span>
                      </div>
                      <p className="text-sm text-slate-700 font-medium leading-relaxed">{issue.description}</p>
                      {issue.resolution && (
                        <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-green-800 text-xs font-medium">
                          <span className="font-bold block mb-0.5 uppercase text-[10px] tracking-wider">Resolution</span>
                          {issue.resolution}
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">By: {issue.createdBy?.name}</span>
                        {issue.status !== 'RESOLVED' && issue.status !== 'CLOSED' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setResolveFormId(resolveFormId === issue.id ? null : issue.id)}
                              className="flex items-center gap-1 text-xs font-bold text-green-700 hover:text-green-900 px-2.5 py-1.5 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" /> Mark as Solved
                            </button>
                            <button
                              onClick={() => router.push(`/projects/${issue.projectId}/execution?tab=issues`)}
                              className="flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-800 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" /> View in Project
                            </button>
                          </div>
                        )}
                      </div>
                      {resolveFormId === issue.id && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Resolution Notes</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Describe how it was resolved..."
                              value={resolutionText}
                              onChange={e => setResolutionText(e.target.value)}
                              className="flex-1 text-xs bg-white border border-slate-200 rounded-lg p-2.5 outline-none focus:border-emerald-400"
                            />
                            <button
                              onClick={() => handleResolveIssue(issue.id)}
                              className="px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-colors"
                            >Confirm</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: Tasks */}
          {activeTab === 'tasks' && (
            <div className="animate-in fade-in duration-300 max-w-7xl mx-auto space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Task Overview</h2>
                <p className="text-slate-500 text-sm mt-1">All tasks across your assigned projects.</p>
              </div>
              {globalTasks.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                  <CheckSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-slate-600">No Tasks Found</h3>
                  <p className="text-sm text-slate-400 mt-1">No tasks are assigned to your projects yet.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-wider">Task</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-wider">Project</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-wider">Assignee</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-wider">Priority</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-wider">Due Date</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {globalTasks.map((task: any) => (
                        <tr key={task.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-800 text-sm">{task.title}</div>
                            {task.description && <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">{task.description}</div>}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-slate-500">{task.projectId?.substring(0,8)}</td>
                          <td className="px-6 py-4 text-xs font-medium text-slate-700">{task.assignee?.name || 'Unassigned'}</td>
                          <td className="px-6 py-4">
                            <span className={clsx('px-2 py-0.5 text-[10px] font-bold border rounded-full uppercase',
                              task.priority === 'CRITICAL' ? 'bg-red-50 text-red-700 border-red-200' :
                              task.priority === 'HIGH' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                              task.priority === 'MEDIUM' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                              'bg-slate-50 text-slate-600 border-slate-200'
                            )}>{task.priority}</span>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500">
                            {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={clsx('px-2.5 py-1 text-[10px] font-bold rounded-full uppercase',
                              task.status === 'COMPLETED' ? 'bg-green-50 text-green-700' :
                              task.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700' :
                              task.status === 'BLOCKED' ? 'bg-red-50 text-red-700' :
                              'bg-slate-100 text-slate-600'
                            )}>{task.status?.replace(/_/g,' ')}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          
          {/* TAB: Resources */}
          {activeTab === 'resources' && (
            <div className="animate-in fade-in duration-300 max-w-7xl mx-auto space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Resources Overview</h2>
                <p className="text-slate-500 text-sm mt-1">Vendors, team members, and documents for your assigned projects.</p>
              </div>

              {/* Vendors */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 text-base">Assigned Vendors</h3>
                  <span className="text-xs bg-emerald-50 text-emerald-600 font-bold px-2 py-1 rounded-full">{globalResources?.vendors?.length ?? 0} vendors</span>
                </div>
                {(!globalResources?.vendors || globalResources.vendors.length === 0) ? (
                  <div className="text-center py-10 text-slate-400 text-sm">No vendors assigned to your projects yet.</div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">Vendor</th>
                        <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">Category</th>
                        <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">Contact</th>
                        <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">Status</th>
                        <th className="px-6 py-3 text-[10px] font-black uppercase text-slate-500 tracking-wider">Items</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {globalResources.vendors.map((v: any) => (
                        <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-semibold text-slate-800 text-sm">{v.name}</td>
                          <td className="px-6 py-4 text-xs text-slate-500">{v.category}</td>
                          <td className="px-6 py-4 text-xs text-slate-600">
                            <div>{v.email || '—'}</div>
                            <div className="text-slate-400">{v.phone || ''}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                              v.status === 'approved' ? 'bg-green-50 text-green-700' : 'bg-indigo-50 text-indigo-700'
                            )}>{v.status}</span>
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-emerald-600">{v.assignedItems} items</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Team */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 text-base">Team Members</h3>
                  <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2 py-1 rounded-full">{globalResources?.team?.length ?? 0} members</span>
                </div>
                {(!globalResources?.team || globalResources.team.length === 0) ? (
                  <div className="text-center py-10 text-slate-400 text-sm">No team members assigned yet.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                    {globalResources.team.map((m: any) => (
                      <div key={m.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                          <span className="text-emerald-700 font-black text-sm">{(m.name || '?')[0].toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 text-sm truncate">{m.name}</p>
                          <p className="text-[10px] text-slate-400 uppercase font-semibold">{m.role}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-black text-slate-700">{m.activeTasks}</span>
                          <p className="text-[10px] text-slate-400">tasks</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Documents */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 text-base">Project Documents</h3>
                  <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2 py-1 rounded-full">{globalResources?.documents?.length ?? 0} files</span>
                </div>
                {(!globalResources?.documents || globalResources.documents.length === 0) ? (
                  <div className="text-center py-10 text-slate-400 text-sm">No documents uploaded yet.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {globalResources.documents.map((d: any) => (
                      <div key={d.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                            <Settings className="w-4 h-4 text-slate-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">{d.title}</p>
                            <p className="text-[10px] text-slate-400 font-mono">Project: {d.projectId?.substring(0,8)} · {d.type}</p>
                          </div>
                        </div>
                        {d.fileUrl && (
                          <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-emerald-600 hover:text-emerald-800 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors">
                            View
                          </a>
                        )}
                      </div>
                    ))}
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
