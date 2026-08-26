'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProjectTeamStore } from '@/stores/projectTeamStore';
import { useAuthStore } from '@/stores/authStore';
import { ExecutionProgressBar } from '@/components/vendor/ExecutionProgressBar';
import { TimelineView } from '@/components/vendor/TimelineView';
import Navbar from '@/components/Navbar';
import {
  ArrowLeft, Plus, Image as ImageIcon, Calendar, Clock, CheckSquare, ClipboardList,
  PhoneCall, FileText, BarChart2, Shield, User, Trash2, Send, AlertTriangle, Upload,
  Eye, Download, ShieldAlert, Award, MessageSquare, Check, X, Users, RefreshCw, Layers, Map
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProjectExecutionPage() {
  const { projectId } = useParams() as { projectId: string };
  const router = useRouter();
  const { user: authUser } = useAuthStore();
  
  const {
    progress,
    photos,
    members,
    tracking,
    projectDetail,
    customerDetail,
    vendorDetail,
    tasks,
    checklists,
    siteVisits,
    comms,
    documents,
    analytics,
    comments,
    assignmentHistory,
    trackingHistory,
    fetchTrackingHistory,
    fetchProgress,
    fetchPhotos,
    fetchMembers,
    fetchTracking,
    updateTracking,
    uploadPhoto,
    removeMember,
    fetchAssignmentHistory,
    assignItemTechnician,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    fetchChecklists,
    createChecklist,
    toggleChecklistItem,
    fetchSiteVisits,
    scheduleSiteVisit,
    updateSiteVisit,
    fetchComms,
    createComm,
    fetchDocuments,
    uploadDocument,
    deleteDocument,
    fetchAnalytics,
    fetchIssueComments,
    createIssueComment,
    escalateIssue,
    resolveIssue,
    issues,
    fetchIssues,
    createIssue
  } = useProjectTeamStore();

  // Active Tab state
  const [activeTab, setActiveTab] = useState<'sourcing' | 'tasks' | 'visits' | 'issues' | 'documents' | 'analytics'>('sourcing');

  // Details expander states
  const [selectedItemHistory, setSelectedItemHistory] = useState<string | null>(null);
  const [assigningItem, setAssigningItem] = useState<string | null>(null);
  const [assigneeTechId, setAssigneeTechId] = useState('');
  
  // Sourcing photo state
  const [photoRoom, setPhotoRoom] = useState('');
  const [photoCategory, setPhotoCategory] = useState('SITE_VISIT');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);


  // New task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState('MEDIUM');
  const [taskAssignedTo, setTaskAssignedTo] = useState('');
  const [showTaskForm, setShowTaskForm] = useState(false);

  // New checklist form state
  const [checklistType, setChecklistType] = useState('COORDINATOR_CHECK');
  const [checklistItemsText, setChecklistItemsText] = useState('');
  const [showChecklistForm, setShowChecklistForm] = useState(false);

  // New site visit form state
  const [visitDate, setVisitDate] = useState('');
  const [visitNotes, setVisitNotes] = useState('');
  const [visitAssignedTo, setVisitAssignedTo] = useState('');
  const [showVisitForm, setShowVisitForm] = useState(false);

  // New comm log form state
  const [commType, setCommType] = useState('CALL');
  const [commNotes, setCommNotes] = useState('');
  const [showCommForm, setShowCommForm] = useState(false);

  // New issue form state
  const [issueType, setIssueType] = useState('VENDOR_DELAY');
  const [issuePriority, setIssuePriority] = useState('LOW');
  const [issueDesc, setIssueDesc] = useState('');
  const [issueItemId, setIssueItemId] = useState('');
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [resolutionText, setResolutionText] = useState('');
  const [showResolveForm, setShowResolveForm] = useState<string | null>(null);

  // Document upload state
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState('SITE_REPORT');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  useEffect(() => {
    fetchProgress(projectId);
    fetchPhotos(projectId);
    fetchMembers(projectId);
    fetchTracking(projectId);
    fetchTasks(projectId);
    fetchChecklists(projectId);
    fetchSiteVisits(projectId);
    fetchComms(projectId);
    fetchDocuments(projectId);
    fetchAnalytics(projectId);
    fetchIssues(projectId);
    fetchAssignmentHistory(projectId);
  }, [projectId]);

  const handleStatusChange = async (itemId: string, newStatus: string) => {
    try {
      await updateTracking(projectId, itemId, newStatus, `Status updated to ${newStatus} by project team.`);
      toast.success('Status updated, progress recalculated! 🔨');
      fetchTracking(projectId);
      fetchProgress(projectId);
      fetchAnalytics(projectId);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleItemTechAssign = async (itemId: string) => {
    if (!assigneeTechId) return;
    try {
      await assignItemTechnician(projectId, itemId, assigneeTechId);
      toast.success('Technician assigned to item!');
      setAssigningItem(null);
      setAssigneeTechId('');
      fetchAssignmentHistory(projectId);
    } catch (e: any) {
      toast.error(e.message || 'Assignment failed');
    }
  };

  const handleAddPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoFile) {
      toast.error('Please select an image file to upload as proof');
      return;
    }
    setIsUploadingPhoto(true);

    const fd = new FormData();
    fd.append('roomName', photoRoom);
    fd.append('category', photoCategory);
    fd.append('file', photoFile);

    try {
      await uploadPhoto(projectId, fd);
      setPhotoRoom('');
      setPhotoFile(null);
      toast.success('Verification proof photo uploaded successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload proof photo');
    }
    setIsUploadingPhoto(false);
  };


  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle || !taskDueDate) return;
    try {
      await createTask(projectId, {
        title: taskTitle,
        description: taskDesc,
        dueDate: taskDueDate,
        priority: taskPriority,
        assignedTo: taskAssignedTo || undefined
      });
      toast.success('Task created successfully!');
      setTaskTitle('');
      setTaskDesc('');
      setTaskDueDate('');
      setTaskAssignedTo('');
      setShowTaskForm(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, status: string) => {
    try {
      await updateTask(projectId, taskId, { status });
      toast.success('Task status updated!');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(projectId, taskId);
      toast.success('Task deleted successfully!');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCreateChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checklistItemsText) return;
    const items = checklistItemsText.split('\n').filter(x => x.trim()).map(x => ({ title: x.trim(), isCompleted: false }));
    try {
      await createChecklist(projectId, {
        checklistType,
        items
      });
      toast.success('Checklist created successfully!');
      setChecklistItemsText('');
      setShowChecklistForm(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggleChecklist = async (itemId: string, currentVal: boolean) => {
    try {
      await toggleChecklistItem(projectId, itemId, !currentVal);
    } catch (err) {}
  };

  const handleScheduleVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitDate) return;
    try {
      await scheduleSiteVisit(projectId, {
        visitDate,
        assignedTo: visitAssignedTo || undefined,
        notes: visitNotes
      });
      toast.success('Site visit scheduled!');
      setVisitDate('');
      setVisitNotes('');
      setVisitAssignedTo('');
      setShowVisitForm(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdateVisitStatus = async (visitId: string, status: string, notes?: string, outcome?: string) => {
    try {
      await updateSiteVisit(projectId, visitId, { status, notes, outcome });
      toast.success('Site visit updated!');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCreateComm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commNotes) return;
    try {
      await createComm(projectId, {
        type: commType,
        notes: commNotes
      });
      toast.success('Communication logged!');
      setCommNotes('');
      setShowCommForm(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueDesc) return;
    try {
      await createIssue(projectId, {
        type: issueType,
        priority: issuePriority,
        description: issueDesc,
        itemId: issueItemId || undefined
      });
      toast.success('Issue logged successfully!');
      setIssueDesc('');
      setIssueItemId('');
      setShowIssueForm(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAddComment = async (issueId: string) => {
    if (!newComment.trim()) return;
    try {
      await createIssueComment(issueId, newComment);
      setNewComment('');
      toast.success('Comment added!');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleEscalateIssue = async (issueId: string) => {
    try {
      await escalateIssue(issueId);
      toast.success('Issue escalated to Project Manager!');
      fetchIssues(projectId);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleResolveIssue = async (issueId: string) => {
    if (!resolutionText.trim()) return;
    try {
      await resolveIssue(issueId, resolutionText);
      toast.success('Issue resolved successfully!');
      setResolutionText('');
      setShowResolveForm(null);
      fetchIssues(projectId);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle || !selectedFile) return;
    setIsUploadingDoc(true);
    try {
      await uploadDocument(projectId, docTitle, docType, selectedFile);
      toast.success('Document uploaded successfully!');
      setDocTitle('');
      setSelectedFile(null);
    } catch (err: any) {
      toast.error(err.message);
    }
    setIsUploadingDoc(false);
  };

  const handleDeleteDoc = async (docId: string) => {
    try {
      await deleteDocument(projectId, docId);
      toast.success('Document deleted!');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Access Control check
  const projectMember = members.find((m) => m.user.id === authUser?.id && m.status === 'ACTIVE');
  const userRole = projectMember?.role || (authUser?.role?.toUpperCase() === 'ADMIN' ? 'MANAGER' : 'COORDINATOR');
  const isManager = userRole === 'MANAGER';
  const isCoordinator = userRole === 'COORDINATOR';
  const isTechnician = userRole === 'TECHNICIAN';
  const isAssigned = !!projectMember;
  const hasAccess = isManager || isAssigned;

  if (members.length > 0 && !hasAccess) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
        <Navbar />
        <div className="max-w-md mx-auto pt-32 text-center space-y-4">
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-6 shadow-sm space-y-3">
            <h2 className="text-sm font-black uppercase tracking-wider text-red-700">Access Denied</h2>
            <p className="text-xs text-red-650 font-semibold leading-relaxed">
              Access Denied: You are not assigned to coordinate this project.
            </p>
            <button
              onClick={() => router.push('/team')}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition shadow-sm"
            >
              Back to Team Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Maps timeline items for the Gantt Chart View
  const timelineResources = tracking.map((i) => ({
    id: i.id,
    title: `[${i.room_name}] ${i.item_name}`,
    status: i.status?.toUpperCase() || 'ORDERED',
    createdAt: new Date(),
  }));

  const technicians = members.filter(m => m.role === 'TECHNICIAN');
  const coordinators = members.filter(m => m.role === 'COORDINATOR');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 pt-24 space-y-8">
        {/* Back Button */}
        <button
          onClick={() => router.push(`/team`)}
          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 transition-colors text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        {/* Header */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-indigo-50 text-indigo-700 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">Project Execution Center</span>
              <span className="text-xs font-mono text-slate-500">ID: {projectId}</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Project Execution Workspace</h1>
            <p className="text-xs text-slate-400">
              Coordinated workspace for site operations, sourcing milestones, and task checklists.
            </p>
          </div>

          <div className="grid grid-cols-2 md:flex md:items-center gap-x-8 gap-y-2 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Customer</span>
              <span className="font-extrabold text-slate-700">{customerDetail?.name || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Location</span>
              <span className="font-extrabold text-slate-700">{projectDetail?.city || 'N/A'} ({projectDetail?.pincode || 'N/A'})</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Start Date</span>
              <span className="font-extrabold text-slate-700">{projectDetail?.startDate || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Project Status</span>
              <span className={`px-2.5 py-0.5 text-[10px] font-black rounded-full uppercase inline-block border mt-0.5 ${
                projectDetail?.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                projectDetail?.status === 'Delayed' ? 'bg-red-50 text-red-700 border-red-100' :
                'bg-indigo-50 text-indigo-700 border-indigo-100'
              }`}>
                {projectDetail?.status || 'On Track'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex border-b border-slate-200 overflow-x-auto gap-6 whitespace-nowrap bg-white p-2.5 rounded-2xl shadow-sm border border-slate-100">
          {[
            { id: 'sourcing', label: '📦 Item Tracking & Status' },
            { id: 'tasks', label: '📝 Tasks & Checklists' },
            { id: 'visits', label: '🚗 Site Visits & Logs' },
            { id: 'issues', label: `⚠️ Issues (${issues.length})` },
            { id: 'documents', label: `📂 Documents (${documents.length})` },
            { id: 'analytics', label: '📊 Manager Analytics', managerOnly: true }
          ].map((tab) => {
            if (tab.managerOnly && !isManager) return null;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-2.5 pt-1.5 px-3 text-xs font-extrabold border-b-2 transition-all outline-none rounded-lg ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Outer Split Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Workspace Column */}
          <div className="lg:col-span-2 space-y-6">

            {/* TAB CONTENT: Sourcing */}
            {activeTab === 'sourcing' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Overview Cards instead of Gantt */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Items</span>
                    <div className="text-2xl font-black text-slate-800 mt-1">{tracking.length}</div>
                  </div>
                  <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider text-emerald-600">Installed</span>
                    <div className="text-2xl font-black text-emerald-600 mt-1">{tracking.filter(t => t.status === 'installed').length}</div>
                  </div>
                  <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider text-amber-500">In Production</span>
                    <div className="text-2xl font-black text-amber-500 mt-1">{tracking.filter(t => t.status === 'production').length}</div>
                  </div>
                  <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider text-indigo-600">Ordered</span>
                    <div className="text-2xl font-black text-indigo-600 mt-1">{tracking.filter(t => t.status === 'ordered').length}</div>
                  </div>
                </div>

                {/* Sourcing Item Table */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Item Tracking Board</h3>
                    <p className="text-[10px] text-slate-400">Update item status, view proofs, or inspect 2D/3D layouts.</p>
                  </div>

                  <div className="overflow-hidden border border-slate-100 rounded-xl overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[500px]">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <th className="p-3">Item details</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Expected Date</th>
                          <th className="p-3">Assignee Tech</th>
                          <th className="p-3 text-center">Visuals</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-medium">
                        {tracking.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/50">
                            <td className="p-3">
                              <span className="text-[9px] bg-slate-100 border border-slate-200 text-slate-500 rounded px-1.5 py-0.5 mr-1 uppercase font-bold">{item.room_name}</span>
                              <span className="font-bold text-slate-700">{item.item_name}</span>
                            </td>
                            <td className="p-3">
                              <select
                                value={item.status?.toLowerCase()}
                                onChange={(e) => handleStatusChange(item.id, e.target.value)}
                                disabled={isTechnician && members.find(m => m.user.id === assignmentHistory.find(h => h.role === 'TECHNICIAN' && h.target_item_id === item.id)?.assignee?.id)?.user.id !== authUser?.id}
                                className="bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700 rounded p-1"
                              >
                                <option value="ordered">Ordered</option>
                                <option value="production">In Production</option>
                                <option value="dispatched">Dispatched</option>
                                <option value="delivered">Delivered</option>
                                <option value="installed">Installed</option>
                              </select>

                            </td>
                            <td className="p-3 font-semibold text-slate-500">{item.expected_date || 'N/A'}</td>
                            <td className="p-3">
                              {assigningItem === item.id ? (
                                <div className="flex items-center gap-1.5">
                                  <select
                                    value={assigneeTechId}
                                    onChange={(e) => setAssigneeTechId(e.target.value)}
                                    className="bg-white border text-[10px] rounded p-1 font-bold text-slate-650"
                                  >
                                    <option value="">Select Tech...</option>
                                    {technicians.map(t => (
                                      <option key={t.id} value={t.user.id}>{t.user.name}</option>
                                    ))}
                                  </select>
                                  <button onClick={() => handleItemTechAssign(item.id)} className="p-1 bg-green-500 text-white rounded"><Check className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => setAssigningItem(null)} className="p-1 bg-red-400 text-white rounded"><X className="w-3.5 h-3.5" /></button>
                                </div>
                              ) : (
                                <span className="font-bold text-indigo-650 flex items-center gap-1">
                                  {members.find(m => m.user.id === assignmentHistory.find(h => h.role === 'TECHNICIAN' && h.target_item_id === item.id)?.assignee?.id)?.user.name || 'Unassigned'}
                                  {isManager && (
                                    <button onClick={() => { setAssigningItem(item.id); setAssigneeTechId(''); }} className="text-[10px] text-slate-400 hover:text-indigo-600 ml-1">✎</button>
                                  )}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex justify-center gap-2">
                                <button
                                  className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-colors"
                                  title="View 2D/3D Design"
                                >
                                  <Layers className="w-4 h-4" />
                                </button>
                                <button
                                  className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition-colors"
                                  title="Upload / View Proof"
                                >
                                  <ImageIcon className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => {
                                  if (selectedItemHistory === item.id) setSelectedItemHistory(null);
                                  else {
                                    setSelectedItemHistory(item.id);
                                    fetchTrackingHistory(projectId, item.id);
                                  }
                                }}
                                className="text-[10px] text-indigo-600 hover:underline font-bold"
                              >
                                {selectedItemHistory === item.id ? 'Hide History' : 'View History'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* History Logs panel */}
                  {selectedItemHistory && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 animate-in slide-in-from-top-2 duration-150">
                      <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Clock className="w-4 h-4 text-indigo-600" /> Sourcing Status History Log</h4>
                      <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                        {(trackingHistory[selectedItemHistory] || []).map((h: any) => (
                          <div key={h.id} className="text-[10.5px] border-b pb-1 flex justify-between font-semibold">
                            <span>
                              <span className="text-indigo-600 uppercase font-black mr-2">{h.status}</span>
                              <span className="text-slate-500 font-medium">({h.remarks})</span>
                            </span>
                            <span className="text-slate-400 font-medium">{new Date(h.changedAt).toLocaleString()} by {h.updatedBy}</span>
                          </div>
                        ))}
                        {(trackingHistory[selectedItemHistory] || []).length === 0 && (
                          <div className="text-[10.5px] text-slate-400 italic">No status history logged yet.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: Tasks */}
            {activeTab === 'tasks' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Execution Tasks</h3>
                      <p className="text-[10px] text-slate-400">Allocate installer tasks, field visits, or delivery verification.</p>
                    </div>
                    {!isTechnician && (
                      <button
                        onClick={() => setShowTaskForm(!showTaskForm)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                      >
                        <Plus className="w-4 h-4" /> Add Task
                      </button>
                    )}
                  </div>

                  {/* Add Task Form */}
                  {showTaskForm && (
                    <form onSubmit={handleCreateTask} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Task Title</label>
                          <input
                            type="text"
                            required
                            placeholder="Install Kitchen counter..."
                            value={taskTitle}
                            onChange={(e) => setTaskTitle(e.target.value)}
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 outline-none font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Due Date</label>
                          <input
                            type="date"
                            required
                            value={taskDueDate}
                            onChange={(e) => setTaskDueDate(e.target.value)}
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 outline-none font-semibold text-slate-700"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Priority</label>
                          <select
                            value={taskPriority}
                            onChange={(e) => setTaskPriority(e.target.value)}
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 outline-none font-bold text-slate-650"
                          >
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">High</option>
                            <option value="CRITICAL">Critical</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Assign To</label>
                          <select
                            value={taskAssignedTo}
                            onChange={(e) => setTaskAssignedTo(e.target.value)}
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 outline-none font-bold text-slate-650"
                          >
                            <option value="">Select Assignee...</option>
                            {members.map(m => (
                              <option key={m.id} value={m.user.id}>[{m.role}] {m.user.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Description</label>
                        <textarea
                          placeholder="Task details and instructions..."
                          value={taskDesc}
                          onChange={(e) => setTaskDesc(e.target.value)}
                          rows={2}
                          className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 outline-none font-medium resize-none"
                        />
                      </div>
                      <button type="submit" className="w-full py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-indigo-700">Submit Task</button>
                    </form>
                  )}

                  {/* Tasks List */}
                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <div key={task.id} className="p-4 border rounded-xl bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 font-semibold text-xs text-slate-700">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] border px-1.5 py-0.5 rounded font-black uppercase ${
                              task.priority === 'CRITICAL' ? 'bg-red-50 text-red-750 border-red-200' :
                              task.priority === 'HIGH' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                              'bg-indigo-50 text-indigo-700 border-indigo-200'
                            }`}>{task.priority}</span>
                            <h4 className="font-extrabold text-slate-800 text-sm">{task.title}</h4>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1 font-medium">{task.description || 'No description provided.'}</p>
                          <div className="flex gap-4 text-[10px] text-slate-450 font-bold uppercase tracking-wider mt-2.5">
                            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                            <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> Assigned: {task.assignedTo?.name || 'Unassigned'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                          {task.status !== 'COMPLETED' ? (
                            <>
                              <button onClick={() => handleUpdateTaskStatus(task.id, 'COMPLETED')} className="px-2.5 py-1.5 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 rounded-lg text-[10px] font-black uppercase">✓ Complete</button>
                              {task.status !== 'CANCELLED' && (
                                <button onClick={() => handleUpdateTaskStatus(task.id, 'CANCELLED')} className="px-2.5 py-1.5 bg-red-55/60 text-red-700 border border-red-200 hover:bg-red-55 rounded-lg text-[10px] font-black uppercase">✕ Cancel</button>
                              )}
                            </>
                          ) : (
                            <span className="text-green-600 font-extrabold uppercase text-[10px] bg-green-50 border border-green-150 px-2.5 py-1 rounded-full flex items-center gap-1">✓ Completed</span>
                          )}
                          {!isTechnician && (
                            <button onClick={() => handleDeleteTask(task.id)} className="p-2 text-slate-400 hover:text-red-600 bg-white border rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                          )}
                        </div>
                      </div>
                    ))}
                    {tasks.length === 0 && (
                      <div className="text-center py-8 text-slate-400 text-xs italic">No execution tasks created.</div>
                    )}
                  </div>
                </div>

                {/* Daily Checklist System */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Daily Execution Checklist</h3>
                      <p className="text-[10px] text-slate-400">Audit site progress, vendor deliveries, and contractor verifications.</p>
                    </div>
                    <button
                      onClick={() => setShowChecklistForm(!showChecklistForm)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      <Plus className="w-4 h-4" /> Log Checklist
                    </button>
                  </div>

                  {/* Log Checklist Form */}
                  {showChecklistForm && (
                    <form onSubmit={handleCreateChecklist} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Checklist Type</label>
                        <select
                          value={checklistType}
                          onChange={(e) => setChecklistType(e.target.value)}
                          className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 outline-none font-bold text-slate-650"
                        >
                          <option value="COORDINATOR_CHECK">Coordinator Checklist</option>
                          <option value="TECHNICIAN_CHECK">Technician Checklist</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Checklist Items (One per line)</label>
                        <textarea
                          placeholder="e.g. Verify counter fitment&#10;Verify drawer smoothness&#10;Upload proof pictures"
                          required
                          value={checklistItemsText}
                          onChange={(e) => setChecklistItemsText(e.target.value)}
                          rows={4}
                          className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 outline-none font-medium"
                        />
                      </div>
                      <button type="submit" className="w-full py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 shadow-sm">Submit Checklist</button>
                    </form>
                  )}

                  {/* Checklist display */}
                  <div className="space-y-4">
                    {checklists.map((cl) => (
                      <div key={cl.id} className="p-4 border rounded-xl bg-slate-50/60 space-y-3 text-xs font-semibold text-slate-700">
                        <div className="flex justify-between items-center border-b pb-2 border-slate-200">
                          <span className="text-[10px] font-black uppercase text-indigo-650">{cl.checklistType.replace('_', ' ')}</span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Logged: {new Date(cl.createdAt).toLocaleDateString()} by {cl.completedBy || 'Staff'}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {cl.items.map((item: any) => (
                            <label key={item.id} className="flex items-center gap-2 cursor-pointer font-semibold text-xs text-slate-650 select-none bg-white p-2 border border-slate-100 rounded-lg hover:bg-slate-50/50">
                              <input
                                type="checkbox"
                                defaultChecked={item.isCompleted}
                                onChange={() => handleToggleChecklist(item.id, item.isCompleted)}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                              <span className={item.isCompleted ? 'line-through text-slate-400 font-medium' : 'text-slate-700'}>{item.title}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    {checklists.length === 0 && (
                      <div className="text-center py-6 text-slate-400 text-xs italic">No daily checklists registered.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Site Visits & Logs */}
            {activeTab === 'visits' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Site Visits Scheduling */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Site Visits Planner</h3>
                      <p className="text-[10px] text-slate-400">Plan physical visits, assign coordinators/technicians, and log outcomes.</p>
                    </div>
                    {!isTechnician && (
                      <button
                        onClick={() => setShowVisitForm(!showVisitForm)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                      >
                        <Plus className="w-4 h-4" /> Schedule Visit
                      </button>
                    )}
                  </div>

                  {/* Visit scheduler form */}
                  {showVisitForm && (
                    <form onSubmit={handleScheduleVisit} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Visit Date</label>
                          <input
                            type="datetime-local"
                            required
                            value={visitDate}
                            onChange={(e) => setVisitDate(e.target.value)}
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 outline-none font-semibold text-slate-700"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Assign Visitor</label>
                          <select
                            value={visitAssignedTo}
                            onChange={(e) => setVisitAssignedTo(e.target.value)}
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 outline-none font-bold text-slate-650"
                          >
                            <option value="">Select Member...</option>
                            {members.map(m => (
                              <option key={m.id} value={m.user.id}>[{m.role}] {m.user.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Notes / Instructions</label>
                        <textarea
                          placeholder="Purpose of visit, checklist instructions..."
                          value={visitNotes}
                          onChange={(e) => setVisitNotes(e.target.value)}
                          rows={2}
                          className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 outline-none font-medium resize-none"
                        />
                      </div>
                      <button type="submit" className="w-full py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 shadow-sm">Confirm Schedule</button>
                    </form>
                  )}

                  {/* Visit items */}
                  <div className="space-y-3">
                    {siteVisits.map((visit) => (
                      <div key={visit.id} className="p-4 border rounded-xl bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs font-semibold text-slate-700">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] px-2 py-0.5 border rounded-full font-black uppercase ${
                              visit.status === 'COMPLETED' ? 'bg-green-55/60 text-green-700 border-green-200' :
                              visit.status === 'CANCELLED' ? 'bg-red-55/65 text-red-700 border-red-200' :
                              'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>{visit.status}</span>
                            <span className="font-extrabold text-slate-800">{new Date(visit.visitDate).toLocaleString()}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-medium">Notes: {visit.notes || 'N/A'}</p>
                          {visit.outcome && <p className="text-[11px] text-indigo-700 font-extrabold">Outcome: {visit.outcome}</p>}
                          <span className="text-[10px] text-slate-450 block pt-1 font-bold uppercase tracking-wider">Visitor: {visit.assignee?.name || 'Unassigned'}</span>
                        </div>
                        <div className="flex items-center gap-2 justify-end w-full md:w-auto">
                          {visit.status === 'SCHEDULED' && (
                            <>
                              <button
                                onClick={() => {
                                  const out = prompt('Enter visit outcome summary:');
                                  if (out) handleUpdateVisitStatus(visit.id, 'COMPLETED', visit.notes, out);
                                }}
                                className="px-2.5 py-1.5 bg-green-50 text-green-700 border border-green-250 rounded-lg text-[10px] font-black uppercase hover:bg-green-100"
                              >
                                ✓ Complete
                              </button>
                              <button
                                onClick={() => handleUpdateVisitStatus(visit.id, 'CANCELLED')}
                                className="px-2.5 py-1.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-lg text-[10px] font-black uppercase hover:bg-slate-200"
                              >
                                ✕ Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    {siteVisits.length === 0 && (
                      <div className="text-center py-6 text-slate-400 text-xs italic">No site visits scheduled.</div>
                    )}
                  </div>
                </div>

                {/* Customer Communication logs */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Customer Communication Log</h3>
                      <p className="text-[10px] text-slate-400">Track and log call minutes, WhatsApp updates, and emails.</p>
                    </div>
                    <button
                      onClick={() => setShowCommForm(!showCommForm)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      <Plus className="w-4 h-4" /> Log Comm
                    </button>
                  </div>

                  {/* Log comm form */}
                  {showCommForm && (
                    <form onSubmit={handleCreateComm} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Communication Type</label>
                        <select
                          value={commType}
                          onChange={(e) => setCommType(e.target.value)}
                          className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 outline-none font-bold text-slate-650"
                        >
                          <option value="CALL">Phone Call</option>
                          <option value="WHATSAPP">WhatsApp Message</option>
                          <option value="EMAIL">Email</option>
                          <option value="MEETING">Site Meeting</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Communication Minutes / Notes</label>
                        <textarea
                          placeholder="Summary of conversation, milestones discussed, or customer concerns..."
                          required
                          value={commNotes}
                          onChange={(e) => setCommNotes(e.target.value)}
                          rows={2.5}
                          className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 outline-none font-medium"
                        />
                      </div>
                      <button type="submit" className="w-full py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 shadow-sm">Save Log</button>
                    </form>
                  )}

                  {/* Logs list */}
                  <div className="space-y-3">
                    {comms.map((log) => (
                      <div key={log.id} className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-3.5 text-xs font-semibold text-slate-700">
                        <div className="p-2 bg-white border border-slate-100 rounded-lg text-indigo-600"><PhoneCall className="w-4 h-4" /></div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-indigo-700">{log.type}</span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{new Date(log.timestamp).toLocaleString()} by {log.createdBy}</span>
                          </div>
                          <p className="text-[11.5px] text-slate-600 font-medium leading-relaxed">{log.notes}</p>
                        </div>
                      </div>
                    ))}
                    {comms.length === 0 && (
                      <div className="text-center py-6 text-slate-400 text-xs italic">No communication logs registered.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Issues */}
            {activeTab === 'issues' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Execution Issues & Escalations</h3>
                      <p className="text-[10px] text-slate-400">Track vendor delays, product damages, and trigger escalation processes.</p>
                    </div>
                    <button
                      onClick={() => setShowIssueForm(!showIssueForm)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      <Plus className="w-4 h-4" /> Log Issue
                    </button>
                  </div>

                  {/* Log Issue Form */}
                  {showIssueForm && (
                    <form onSubmit={handleCreateIssue} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Issue Type</label>
                          <select
                            value={issueType}
                            onChange={(e) => setIssueType(e.target.value)}
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 outline-none font-bold text-slate-650"
                          >
                            <option value="VENDOR_DELAY">Vendor Delay</option>
                            <option value="DAMAGED_PRODUCT">Damaged Product</option>
                            <option value="WRONG_PRODUCT">Wrong Product</option>
                            <option value="MISSING_ITEM">Missing Item</option>
                            <option value="INSTALLATION_PROBLEM">Installation Problem</option>
                            <option value="CUSTOMER_COMPLAINT">Customer Complaint</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Priority</label>
                          <select
                            value={issuePriority}
                            onChange={(e) => setIssuePriority(e.target.value)}
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 outline-none font-bold text-slate-650"
                          >
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">High</option>
                            <option value="CRITICAL">Critical</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Item ID (Optional)</label>
                        <input
                          type="text"
                          placeholder="Select/Enter RoomItem UUID..."
                          value={issueItemId}
                          onChange={(e) => setIssueItemId(e.target.value)}
                          className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 outline-none font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Description</label>
                        <textarea
                          placeholder="Describe the problem, damages, or discrepancies..."
                          required
                          value={issueDesc}
                          onChange={(e) => setIssueDesc(e.target.value)}
                          rows={2.5}
                          className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 outline-none font-medium"
                        />
                      </div>
                      <button type="submit" className="w-full py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 shadow-sm">Log Issue</button>
                    </form>
                  )}

                  {/* Issues List */}
                  <div className="space-y-4">
                    {issues.map((issue) => (
                      <div key={issue.id} className="p-4 border rounded-xl bg-slate-50/50 space-y-3 text-xs font-semibold text-slate-700">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] font-black uppercase text-indigo-700 mr-2">{issue.type.replace('_', ' ')}</span>
                            <span className={`px-2 py-0.5 text-[9px] font-bold border rounded-full uppercase ${
                              issue.priority === 'CRITICAL' ? 'bg-red-50 text-red-700 border-red-200' :
                              issue.priority === 'HIGH' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                              'bg-indigo-50 text-indigo-700 border-indigo-200'
                            }`}>{issue.priority}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                            issue.status === 'RESOLVED' || issue.status === 'CLOSED' ? 'bg-green-50 text-green-700 border-green-200' :
                            issue.status === 'ESCALATED' ? 'bg-red-55/65 text-red-700 border-red-200' :
                            'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>{issue.status}</span>
                        </div>
                        <p className="text-[12px] text-slate-650 font-medium leading-relaxed">{issue.description}</p>
                        {issue.resolution && (
                          <div className="p-2.5 bg-green-50/60 border border-green-150 rounded-xl text-green-850">
                            <span className="font-black block uppercase text-[9px] tracking-wider mb-0.5">Resolution summary</span>
                            <p className="font-medium text-[11px]">{issue.resolution} (Resolved {new Date(issue.resolvedAt!).toLocaleDateString()})</p>
                          </div>
                        )}
                        <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider pt-2 border-t border-slate-200/50">
                          <span>Logged by: {issue.createdBy?.name || 'Staff'}</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                if (expandedIssue === issue.id) setExpandedIssue(null);
                                else {
                                  setExpandedIssue(issue.id);
                                  fetchIssueComments(issue.id);
                                }
                              }}
                              className="text-indigo-650 hover:underline font-extrabold flex items-center gap-1"
                            >
                              <MessageSquare className="w-3.5 h-3.5" /> Comments ({comments[issue.id]?.length || 0})
                            </button>
                            {issue.status !== 'ESCALATED' && issue.status !== 'RESOLVED' && (
                              <button onClick={() => handleEscalateIssue(issue.id)} className="text-red-600 hover:underline font-extrabold flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5" /> Escalate</button>
                            )}
                            {issue.status !== 'RESOLVED' && (
                              <button onClick={() => setShowResolveForm(showResolveForm === issue.id ? null : issue.id)} className="text-green-700 hover:underline font-extrabold flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Resolve</button>
                            )}
                          </div>
                        </div>

                        {/* Threaded Comments */}
                        {expandedIssue === issue.id && (
                          <div className="bg-white border rounded-xl p-3.5 space-y-3.5 animate-in slide-in-from-top-2 duration-150 mt-2">
                            <h5 className="font-bold text-slate-800 text-[11px] border-b pb-1.5 flex items-center gap-1.5"><MessageSquare className="w-4 h-4 text-indigo-500" /> Issue Discussion Thread</h5>
                            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                              {(comments[issue.id] || []).map((c) => (
                                <div key={c.id} className="text-[11px] border-b pb-1">
                                  <div className="flex justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">
                                    <span>{c.user.name}</span>
                                    <span>{new Date(c.createdAt).toLocaleString()}</span>
                                  </div>
                                  <p className="font-medium text-slate-650 leading-normal">{c.comment}</p>
                                </div>
                              ))}
                              {(comments[issue.id] || []).length === 0 && (
                                <div className="text-[10px] text-slate-400 italic">No comments logged. Add a comment to discuss.</div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Add updates or site findings..."
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                className="flex-1 text-[11px] bg-slate-50 border rounded-lg p-2 outline-none focus:bg-white"
                              />
                              <button onClick={() => handleAddComment(issue.id)} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"><Send className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        )}

                        {/* Resolve Form */}
                        {showResolveForm === issue.id && (
                          <div className="bg-slate-50 border rounded-xl p-3.5 space-y-2 mt-2">
                            <label className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Resolution notes</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="State changes made or replacement item status..."
                                value={resolutionText}
                                onChange={(e) => setResolutionText(e.target.value)}
                                className="flex-1 text-[11px] bg-white border rounded-lg p-2 outline-none"
                              />
                              <button onClick={() => handleResolveIssue(issue.id)} className="px-3.5 py-2 bg-green-600 text-white text-[11px] font-bold rounded-lg hover:bg-green-700">Confirm Resolve</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {issues.length === 0 && (
                      <div className="text-center py-6 text-slate-400 text-xs italic">No execution issues registered.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Documents */}
            {activeTab === 'documents' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Project Documents Management</h3>
                      <p className="text-[10px] text-slate-400">Upload quotations, invoices, floor plans, or site handover sheets.</p>
                    </div>
                  </div>

                  {/* Document upload form */}
                  <form onSubmit={handleUploadDoc} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Document Title</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Master Bedroom Revision..."
                          value={docTitle}
                          onChange={(e) => setDocTitle(e.target.value)}
                          className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 outline-none font-semibold text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Document Category</label>
                        <select
                          value={docType}
                          onChange={(e) => setDocType(e.target.value)}
                          className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 outline-none font-bold text-slate-650"
                        >
                          <option value="QUOTATION">Quotation</option>
                          <option value="INVOICE">Invoice</option>
                          <option value="FLOOR_PLAN">Floor Plan</option>
                          <option value="SITE_REPORT">Site Report</option>
                          <option value="COMPLETION_CERTIFICATE">Completion Certificate</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Select File</label>
                      <input
                        type="file"
                        required
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 text-slate-600 font-semibold"
                      />
                    </div>
                    <button type="submit" disabled={isUploadingDoc} className="w-full py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 flex justify-center items-center gap-1.5 shadow-sm">
                      {isUploadingDoc ? 'Uploading...' : <><Upload className="w-4 h-4" /> Upload Document</>}
                    </button>
                  </form>

                  {/* Documents list */}
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div key={doc.id} className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-700">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white border border-slate-100 rounded-lg text-indigo-600"><FileText className="w-4.5 h-4.5" /></div>
                          <div>
                            <h4 className="font-extrabold text-slate-800 text-xs">{doc.title}</h4>
                            <div className="flex gap-2.5 text-[9px] text-slate-400 uppercase tracking-wider font-bold mt-0.5">
                              <span>Type: {doc.type}</span>
                              <span>•</span>
                              <span>Version: V{doc.version}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={`http://localhost:8000${doc.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-slate-400 hover:text-indigo-600 bg-white border rounded-lg transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => handleDeleteDoc(doc.id)}
                            className="p-2 text-slate-400 hover:text-red-600 bg-white border rounded-lg transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {documents.length === 0 && (
                      <div className="text-center py-6 text-slate-400 text-xs italic">No documents uploaded.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Analytics */}
            {activeTab === 'analytics' && isManager && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Operational SLA & Productivity Reports</h3>
                    <p className="text-[10px] text-slate-400">View project completion speeds, team performance KPIs, and delay rates.</p>
                  </div>

                  {/* Grid Reports */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-1">
                      <span className="text-[9.5px] uppercase font-bold text-slate-400 tracking-wider block">Technician Productivity</span>
                      <div className="text-3xl font-black text-slate-800">{analytics?.technicianProductivity ?? 0}%</div>
                      <span className="text-[10px] text-slate-400 block font-semibold">% of assigned tasks closed on time</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-1">
                      <span className="text-[9.5px] uppercase font-bold text-slate-400 tracking-wider block">Issue Resolution SLA</span>
                      <div className="text-3xl font-black text-slate-800">{analytics?.issueResolutionRate ?? 0}%</div>
                      <span className="text-[10px] text-slate-400 block font-semibold">% of logged construction issues resolved</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-1 col-span-2">
                      <span className="text-[9.5px] uppercase font-bold text-indigo-700 tracking-wider block flex items-center gap-1.5"><Award className="w-4 h-4 text-indigo-600" /> Handovers success metrics</span>
                      <div className="text-xs text-slate-650 leading-relaxed font-semibold">
                        Average project delivery cycle takes <strong>34 operational days</strong>. Handover certificates upload SLA stands at <strong>{analytics?.slaMetrics ?? 0}% compliance</strong>.
                      </div>
                    </div>
                  </div>

                  {/* Monthly Trend mock visualizer */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Project Completion Trend</span>
                    <div className="flex items-end justify-between h-32 pt-4 bg-slate-50/50 border border-dashed rounded-xl px-4">
                      {(analytics?.monthlyTrends || []).map((t: any, idx: number) => (
                        <div key={idx} className="flex flex-col items-center flex-1">
                          <div
                            style={{ height: `${t.progress}%` }}
                            className="w-8 bg-indigo-600 hover:bg-indigo-700 transition-all rounded-t-md relative group flex justify-center"
                          >
                            <span className="absolute -top-6 text-[10px] bg-slate-800 text-white font-extrabold px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">{t.progress}%</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase mt-2">{t.month}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Right Sidebar Details Column */}
          <div className="space-y-6">

            {/* Design & Visualization Links Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Design & Visualization</h3>
                <p className="text-[10px] text-slate-400 font-medium">Quick links to design canvases and room planners.</p>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => router.push(`/visualize/${projectId}?tab=2d`)}
                  className="w-full py-2 bg-indigo-50 hover:bg-indigo-150 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-xl transition shadow-sm text-center uppercase tracking-wider"
                >
                  [ 2D Floor Plan ]
                </button>
                <button
                  onClick={() => router.push(`/visualize/${projectId}?tab=3d`)}
                  className="w-full py-2 bg-indigo-50 hover:bg-indigo-150 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-xl transition shadow-sm text-center uppercase tracking-wider"
                >
                  [ Open 3D View ]
                </button>
                <button
                  onClick={() => router.push(`/visualize/${projectId}?tab=render`)}
                  className="w-full py-2 bg-indigo-50 hover:bg-indigo-150 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-xl transition shadow-sm text-center uppercase tracking-wider"
                >
                  [ Rendered Views ]
                </button>
              </div>
            </div>

            {/* Customer Details Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">

              <div>
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Customer Profile</h3>
                <p className="text-[10px] text-slate-400 font-medium">Primary contact details for this project.</p>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2.5 text-xs font-semibold text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-400">Name</span>
                  <span className="text-slate-800 font-extrabold">{customerDetail?.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Phone</span>
                  <span className="text-slate-800 font-extrabold">{customerDetail?.phone || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Email</span>
                  <span className="text-slate-600 font-mono">{customerDetail?.email || 'N/A'}</span>
                </div>
                <div className="border-t border-slate-200/60 pt-2 font-semibold">
                  <span className="text-slate-400 block mb-1">Site Address</span>
                  <span className="text-slate-700 text-[11px] leading-relaxed block">{customerDetail?.address || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Vendor Directory Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Vendor Directory</h3>
                <p className="text-[10px] text-slate-400 font-medium">Assigned manufacturing & supply partners.</p>
              </div>

              <div className="space-y-3">
                {vendorDetail && vendorDetail.length > 0 ? (
                  vendorDetail.map((vendor: any) => (
                    <div key={vendor.id} className="border border-slate-150 rounded-xl p-3.5 bg-slate-50/50 space-y-2 text-xs font-semibold text-slate-700">
                      <div className="flex justify-between items-start font-extrabold">
                        <span className="text-slate-800 text-[11px]">{vendor.businessName}</span>
                        <span className="text-[10px] text-indigo-650 font-mono">{vendor.phone}</span>
                      </div>
                      <div className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Assigned Items:</div>
                      <ul className="list-disc pl-4 text-[10px] text-slate-600 space-y-0.5 font-semibold">
                        {vendor.items.map((itemStr: string, idx: number) => (
                          <li key={idx}>{itemStr}</li>
                        ))}
                      </ul>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-slate-400 text-xs font-semibold border border-dashed border-slate-200 rounded-xl">
                    No vendors assigned to project elements yet.
                  </div>
                )}
              </div>
            </div>

            {/* Photo Gallery & Upload */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-5">
              <div>
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Site Verification Photos</h3>
                <p className="text-[10px] text-slate-400 font-medium">Verify installation proof from the site.</p>
              </div>

              {/* Photo Upload Form */}
              <form onSubmit={handleAddPhoto} className="space-y-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Context / Room</label>
                  <input
                    type="text"
                    required
                    placeholder="Master Bedroom, Kitchen, etc."
                    value={photoRoom}
                    onChange={(e) => setPhotoRoom(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 outline-none font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Category</label>
                  <select
                    value={photoCategory}
                    onChange={(e) => setPhotoCategory(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 outline-none font-bold text-slate-600"
                  >
                    <option value="SITE_VISIT">Site Visit</option>
                    <option value="PRODUCTION_CHECK">Production Check</option>
                    <option value="DELIVERY">Delivery</option>
                    <option value="INSTALLATION">Installation</option>
                    <option value="FINAL_HANDOVER">Final Handover</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Verification Image Proof</label>
                  <input
                    type="file"
                    required
                    accept="image/*"
                    onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                    className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isUploadingPhoto}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-xl transition-all shadow-sm flex justify-center items-center gap-1"
                >
                  {isUploadingPhoto ? 'Uploading...' : <><Upload className="w-3.5 h-3.5" /> Add Sourcing Photo</>}
                </button>
              </form>


              {/* Photos List Grid */}
              <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative group rounded-xl overflow-hidden shadow-sm aspect-video border border-slate-100 bg-slate-50">
                    <img
                      src={photo.imageUrl}
                      alt={photo.roomName || 'Site Photo'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 text-white">
                      <span className="text-[10px] font-bold">{photo.roomName || 'Site'}</span>
                      <span className="text-[8px] opacity-75 font-semibold uppercase">{photo.category}</span>
                    </div>
                  </div>
                ))}
                {photos.length === 0 && (
                  <div className="col-span-2 text-center py-6 text-slate-400 text-xs font-semibold">
                    No site photos yet.
                  </div>
                )}
              </div>
            </div>

            {/* Project Team Members Brief */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Project Team</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Assigned executors and field roles.</p>
                </div>
                {isManager && (
                  <button
                    onClick={() => router.push(`/projects/${projectId}/team`)}
                    className="p-1.5 text-indigo-650 hover:bg-indigo-50 rounded-lg border border-transparent hover:border-indigo-100"
                  >
                    <Users className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <div className="flex items-center space-x-3">
                      <div className="w-7.5 h-7.5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-650 font-black border border-indigo-200 text-xs">
                        {member.user?.name ? member.user.name[0].toUpperCase() : 'U'}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{member.user?.name}</div>
                        <div className="text-[9px] text-indigo-600 font-black uppercase tracking-wider">{member.role}</div>
                      </div>
                    </div>
                    {isManager && member.user.id !== authUser?.id && (
                      <button
                        onClick={() => removeMember(projectId, member.user.id, member.role).then(() => { toast.success('Member removed!'); fetchMembers(projectId); })}
                        className="text-[10px] text-red-500 hover:underline font-black uppercase tracking-wider"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                {members.length === 0 && (
                  <div className="text-center py-2 text-slate-400 text-xs font-semibold">
                    No team members assigned.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
