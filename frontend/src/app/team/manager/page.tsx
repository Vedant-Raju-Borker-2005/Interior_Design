'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectTeamStore } from '@/stores/projectTeamStore';
import { useAuthStore } from '@/stores/authStore';
import {
  Briefcase,
  FolderKanban,
  CheckSquare,
  AlertCircle,
  Users,
  Settings,
  Bell,
  LogOut,
  MapPin,
  Play,
  Search,
  MoreVertical,
  Plus
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import Link from 'next/link';

export default function ManagerDashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { dashboard, projects, teamDirectory, teamDirectoryError, fetchDashboard, fetchProjects, fetchTeamDirectory, isLoading, error } = useProjectTeamStore();
  
  // Navigation tabs for sidebar
  const [activeTab, setActiveTab] = useState<'dashboard' | 'projects' | 'tasks' | 'issues' | 'team'>('dashboard');
  
  // Sub-tabs for Team section
  const [teamTab, setTeamTab] = useState<'members' | 'projects' | 'assignments'>('members');
  
  // Form state for assignment
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedMember, setSelectedMember] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [projectAssignments, setProjectAssignments] = useState<any>({}); // Store team members for each project
  const [memberAssignmentCounts, setMemberAssignmentCounts] = useState<any>({}); // Count projects per member

  useEffect(() => {
    fetchDashboard().catch(() => {});
    fetchProjects().catch(() => {});
    fetchTeamDirectory().catch(() => {});
  }, [fetchDashboard, fetchProjects, fetchTeamDirectory]);

  // Fetch team members for each project when assignments tab is active
  useEffect(() => {
    if (teamTab === 'assignments' && projects && projects.length > 0) {
      projects.forEach(async (proj) => {
        try {
          const res = await fetch(`/api/v1/team/projects/${proj.id}/team`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
          });
          if (res.ok) {
            const data = await res.json();
            setProjectAssignments(prev => ({ ...prev, [proj.id]: data }));
          }
        } catch (err) {
          console.error(`Failed to fetch team for project ${proj.id}:`, err);
        }
      });
    }
  }, [teamTab, projects]);

  const handleAssignMember = async () => {
    if (!selectedProject || !selectedMember) {
      toast.error('Please select both a project and a team member');
      return;
    }

    setAssignLoading(true);
    try {
      const response = await fetch(`/api/v1/team/projects/${selectedProject}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          userId: selectedMember,
          role: 'COORDINATOR'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `Error: ${response.status}`);
      }

      toast.success('Team member assigned successfully!');
      setSelectedProject('');
      setSelectedMember('');
      // Refresh projects and reload assignments
      await fetchProjects();
      // Re-fetch team members for updated assignments
      try {
        const res = await fetch(`/api/v1/team/projects/${selectedProject}/team`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
        });
        if (res.ok) {
          const data = await res.json();
          setProjectAssignments(prev => ({ ...prev, [selectedProject]: data }));
        }
      } catch (err) {
        console.error('Failed to refresh team:', err);
      }
    } catch (err: any) {
      console.error('Assignment error:', err);
      toast.error(err.message || 'Failed to assign member');
    } finally {
      setAssignLoading(false);
    }
  };

  // Helper function to get team members by role
  const getTeamMembersByRole = (projectId: string, role: string) => {
    const teamMembers = projectAssignments[projectId] || [];
    const filtered = teamMembers.filter((m: any) => m.role === role);
    if (filtered.length === 0) return 'N/A';
    return filtered.map((m: any) => m.user?.name || 'Unknown').join(', ');
  };

  // Check if user is customer (read-only mode)
  const isCustomer = user?.role === 'customer';

  if (isLoading && !dashboard) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="text-white text-sm font-bold animate-pulse">Loading Workspace...</div>
      </div>
    );
  }

  const stats = dashboard?.manager || { totalProjects: 0, activeProjects: 0, pendingItems: 0, completedProjects: 0, openIssues: 0 };
  
  // Click Team tab in sidebar → also fetch the directory
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Briefcase },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'issues', label: 'Issues', icon: AlertCircle },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'resources', label: 'Resources', icon: Settings },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Navbar - Dark */}
      <header className="h-16 bg-[#0a0f1d] text-white flex items-center justify-between px-6 shrink-0 shadow-md relative z-20">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-[0_0_15px_rgba(79,70,229,0.5)]">
              AI
            </div>
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
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold border border-indigo-500/30">
              {user?.name?.substring(0, 2).toUpperCase() || 'PM'}
            </div>
            <div className="hidden md:block text-sm">
              <div className="font-bold text-slate-100 leading-none">{user?.name || 'Project Manager'}</div>
              <div className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-wider">Project Manager</div>
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
                  onClick={() => {
                    setActiveTab(item.id as any);
                    if (item.id === 'team') {
                      fetchTeamDirectory().catch(() => {});
                    }
                  }}
                  className={clsx(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive 
                      ? "bg-indigo-600/10 text-indigo-400" 
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  )}
                >
                  <Icon className={clsx("w-5 h-5", isActive ? "text-indigo-500" : "text-slate-500")} />
                  {item.label}
                  {isActive && (
                    <div className="absolute left-0 w-1 h-8 bg-indigo-500 rounded-r-md"></div>
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
                  <h1 className="text-2xl font-bold text-slate-900">Project Team Dashboard</h1>
                  <p className="text-slate-500 text-sm mt-1">Track and manage your assigned projects and execution activities</p>
                </div>
                <button 
                  onClick={() => {
                    setActiveTab('team');
                    setTeamTab('assignments');
                  }}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-2"
                >
                  Manage Project Allocations
                </button>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                    <FolderKanban className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Projects</p>
                    <div className="text-2xl font-bold text-slate-900">{stats.totalProjects}</div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                    <CheckSquare className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Projects</p>
                    <div className="text-2xl font-bold text-slate-900">{stats.activeProjects}</div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Items</p>
                    <div className="text-2xl font-bold text-slate-900">{stats.pendingItems}</div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <Briefcase className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed Items</p>
                    <div className="text-2xl font-bold text-slate-900">{stats.completedProjects}</div>
                  </div>
                </div>
              </div>

              {/* Recent Projects Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 text-lg">Recent Projects</h3>
                  <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">View All</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4">Project ID</th>
                        <th className="px-6 py-4">Customer</th>
                        <th className="px-6 py-4">Location</th>
                        <th className="px-6 py-4">Start Date</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Progress</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {projects?.slice(0, 5).map((proj) => (
                        <tr key={proj.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-900">{proj.id.substring(0, 8)}</td>
                          <td className="px-6 py-4 font-medium text-slate-700">{proj.customerName || 'N/A'}</td>
                          <td className="px-6 py-4 text-slate-500">{proj.locality || proj.city || 'N/A'}</td>
                          <td className="px-6 py-4 text-slate-500">{proj.startDate || 'N/A'}</td>
                          <td className="px-6 py-4">
                            <span className={clsx(
                              "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide",
                              proj.status === 'ordered' ? "bg-blue-50 text-blue-700" :
                              proj.status === 'production' ? "bg-amber-50 text-amber-700" :
                              "bg-emerald-50 text-emerald-700"
                            )}>
                              {proj.status === 'ordered' ? 'In Progress' : proj.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-slate-700 text-xs w-8">{proj.progress}%</span>
                              <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${proj.progress}%` }}></div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => router.push(`/projects/${proj.id}/execution`)}
                              className="text-indigo-600 font-semibold hover:text-indigo-800 text-sm"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!projects || projects.length === 0) && (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                            No active projects found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Projects */}
          {activeTab === 'projects' && (
            <div className="animate-in fade-in duration-300 max-w-7xl mx-auto space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Project Execution Hub</h2>
                <p className="text-slate-500 text-sm mt-1">Select a project to view its detailed execution plan.</p>
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
                        proj.status === 'ordered' ? 'bg-blue-50 text-blue-700' : 'bg-indigo-50 text-indigo-700'
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
                          <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${proj.progress}%` }} />
                        </div>
                      </div>
                      <button
                        onClick={() => router.push(`/projects/${proj.id}/execution`)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
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
                    <p className="text-sm text-slate-400 font-medium">You don't have any active projects right now.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: Team & Assignments */}
          {activeTab === 'team' && (
            <div className="animate-in fade-in duration-300 max-w-7xl mx-auto space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Team & Project Assignment</h1>
                <p className="text-slate-500 text-sm mt-1">Manage team members and project assignments</p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center border-b border-slate-200">
                  <button 
                    onClick={() => { setTeamTab('members'); fetchTeamDirectory().catch(() => {}); }}
                    className={clsx("px-6 py-4 text-sm font-semibold border-b-2 transition-colors", teamTab === 'members' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700")}
                  >
                    Team Members
                  </button>
                  <button 
                    onClick={() => setTeamTab('projects')}
                    className={clsx("px-6 py-4 text-sm font-semibold border-b-2 transition-colors", teamTab === 'projects' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700")}
                  >
                    Projects
                  </button>
                  <button 
                    onClick={() => setTeamTab('assignments')}
                    className={clsx("px-6 py-4 text-sm font-semibold border-b-2 transition-colors", teamTab === 'assignments' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700")}
                  >
                    Assignments
                  </button>
                </div>

                <div className="p-6">
                  {/* Team Members SubTab */}
                  {teamTab === 'members' && (
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <h3 className="font-bold text-slate-800 text-lg">Team Members</h3>
                        {teamDirectoryError && (
                          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            ⚠ {teamDirectoryError} — Make sure you are logged in as a Manager.
                          </div>
                        )}
                      </div>
                      
                      <table className="w-full text-left text-sm">
                        <thead className="text-slate-500 border-b border-slate-100">
                          <tr>
                            <th className="pb-3 font-semibold">Name</th>
                            <th className="pb-3 font-semibold">Role</th>
                            <th className="pb-3 font-semibold">Assigned Projects</th>
                            <th className="pb-3 font-semibold text-right"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {teamDirectory?.map((member) => (
                            <tr key={member.id} className="hover:bg-slate-50">
                              <td className="py-3 flex items-center gap-3">
                                <div className={clsx(
                                  "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs",
                                  member.role === 'team_coordinator' ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
                                )}>
                                  {member.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <span className="font-medium text-slate-900 block">{member.name}</span>
                                  <span className="text-[10px] text-slate-500">{member.email}</span>
                                </div>
                              </td>
                              <td className="py-3 text-slate-600">
                                {member.role === 'team_coordinator' ? 'Coordinator' : 'Technician'}
                              </td>
                              <td className="py-3 font-medium text-slate-900">
                                {/* This would be dynamic based on actual assignments */}
                                0
                              </td>
                              <td className="py-3 text-right">
                                <button 
                                  onClick={() => toast.info('Member profile view is under development')}
                                  className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          ))}
                          {(!teamDirectory || teamDirectory.length === 0) && (
                            <tr>
                              <td colSpan={4} className="py-8 text-center text-slate-400">
                                No team members found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Projects SubTab */}
                  {teamTab === 'projects' && (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 text-lg">Projects</h3>
                        <div className="relative">
                          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                          <input type="text" placeholder="Search projects..." className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64" />
                        </div>
                      </div>
                      <table className="w-full text-left text-sm">
                        <thead className="text-slate-500 border-b border-slate-100">
                          <tr>
                            <th className="pb-3 font-semibold">Project ID</th>
                            <th className="pb-3 font-semibold">Customer</th>
                            <th className="pb-3 font-semibold">Status</th>
                            <th className="pb-3 font-semibold">Assigned Team</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {projects?.map((proj) => (
                            <tr key={proj.id} className="hover:bg-slate-50">
                              <td className="py-3 font-medium text-slate-900">{proj.id.substring(0, 8)}</td>
                              <td className="py-3 text-slate-700">{proj.customerName || 'N/A'}</td>
                              <td className="py-3">
                                <span className={clsx(
                                  "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                  proj.status === 'ordered' ? "text-blue-600" : "text-emerald-600"
                                )}>
                                  {proj.status === 'ordered' ? 'In Progress' : proj.status}
                                </span>
                              </td>
                              <td className="py-3 text-slate-600">
                                4 Members
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Assignments SubTab */}
                  {teamTab === 'assignments' && (
                    <div className="flex flex-col md:flex-row gap-8">
                      <div className="flex-1 space-y-6">
                        <div className="flex justify-between items-center">
                          <h3 className="font-bold text-slate-800 text-lg">Project Assignments</h3>
                          <div className="relative w-48">
                            <input type="text" placeholder="Search projects..." className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md bg-slate-50 focus:bg-white" />
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                          </div>
                        </div>
                        
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 text-slate-500">
                            <tr>
                              <th className="py-2 px-3 font-semibold">Project ID</th>
                              <th className="py-2 px-3 font-semibold">Project Name</th>
                              <th className="py-2 px-3 font-semibold">Customer</th>
                              <th className="py-2 px-3 font-semibold">Manager</th>
                              <th className="py-2 px-3 font-semibold">Coordinator</th>
                              <th className="py-2 px-3 font-semibold">Technicians</th>
                              <th className="py-2 px-3 font-semibold text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {projects?.map((proj) => (
                              <tr key={proj.id} className="hover:bg-slate-50">
                                <td className="py-3 px-3 font-medium text-slate-900 text-xs">{proj.id.substring(0, 8)}</td>
                                <td className="py-3 px-3 text-slate-700 text-xs font-medium">{proj.propertyName || 'N/A'}</td>
                                <td className="py-3 px-3 text-slate-700 text-xs">{proj.customerName || 'N/A'}</td>
                                <td className="py-3 px-3 text-slate-600 text-xs">{getTeamMembersByRole(proj.id, 'MANAGER')}</td>
                                <td className="py-3 px-3 text-slate-600 text-xs">{getTeamMembersByRole(proj.id, 'COORDINATOR')}</td>
                                <td className="py-3 px-3 text-slate-600 text-xs">{getTeamMembersByRole(proj.id, 'TECHNICIAN')}</td>
                                <td className="py-3 px-3 text-right">
                                  <button onClick={() => router.push(`/projects/${proj.id}/team`)} className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded hover:bg-indigo-700 transition">
                                    Reassign
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      {/* Assignment Form Panel - Only for Managers */}
                      {!isCustomer && (
                      <div className="w-full md:w-72 bg-slate-50 rounded-xl p-5 border border-slate-100 h-fit">
                        <h4 className="font-bold text-slate-800 text-sm mb-4">Assign Team Member</h4>
                        
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Project</label>
                            <select 
                              value={selectedProject} 
                              onChange={(e) => setSelectedProject(e.target.value)}
                              className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 bg-white text-slate-700"
                            >
                              <option value="">Select Project</option>
                              {projects?.map(p => (
                                <option key={p.id} value={p.id}>{p.id.substring(0,8)} - {p.propertyName || 'N/A'}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Team Member</label>
                            <select 
                              value={selectedMember} 
                              onChange={(e) => setSelectedMember(e.target.value)}
                              className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 bg-white text-slate-700"
                            >
                              <option value="">Select Member</option>
                              {teamDirectory?.map(m => (
                                <option key={m.id} value={m.id}>
                                  {m.name} ({m.role === 'team_coordinator' ? 'Coordinator' : 'Technician'})
                                </option>
                              ))}
                            </select>
                          </div>

                          
                          <button 
                            onClick={handleAssignMember}
                            disabled={assignLoading}
                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors mt-2"
                          >
                            {assignLoading ? 'Assigning...' : 'Assign'}
                          </button>
                        </div>
                      </div>
                      )}
                    </div>
                  )}
                </div>
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
