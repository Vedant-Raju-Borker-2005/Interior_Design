'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProjectTeamStore } from '@/stores/projectTeamStore';
import Navbar from '@/components/Navbar';
import { ArrowLeft, UserPlus, Shield, User, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProjectTeamPage() {
  const { projectId } = useParams() as { projectId: string };
  const router = useRouter();
  const { members, fetchMembers, assignMember, isLoading, error, clearError } =
    useProjectTeamStore();

  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('TECHNICIAN');
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchMembers(projectId);
  }, [projectId, fetchMembers]);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) return;

    clearError();
    setSuccessMsg('');
    try {
      await assignMember(projectId, userId, role);
      setUserId('');
      setSuccessMsg('Member assigned successfully!');
      toast.success('Team member assigned successfully!');
      setShowAssignForm(false);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      toast.error(err.message || 'Assignment failed');
    }
  };

  const getRoleBadge = (roleName: string) => {
    switch (roleName) {
      case 'MANAGER':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'COORDINATOR':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-teal-50 text-teal-700 border-teal-200';
    }
  };

  const managerCount = members.filter((m) => m.role === 'MANAGER').length;
  const coordinatorCount = members.filter((m) => m.role === 'COORDINATOR').length;
  const technicianCount = members.filter((m) => m.role === 'TECHNICIAN').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 pt-24 space-y-8">
        {/* Back Button */}
        <button
          onClick={() => router.push(`/dashboard`)}
          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 transition-colors text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Project Team</h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage roles, workspace coordination, and technical executors.
            </p>
          </div>
          <button
            onClick={() => {
              setShowAssignForm(!showAssignForm);
              clearError();
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2"
          >
            {showAssignForm ? '✕ Close' : (
              <>
                <UserPlus className="w-4 h-4" />
                Assign Team Member
              </>
            )}
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Total active team
            </span>
            <div className="text-2xl font-black text-slate-800 mt-1">{members.length}</div>
          </div>

          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Managers
            </span>
            <div className="text-2xl font-black text-purple-700 mt-1">{managerCount}</div>
          </div>

          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Coordinators
            </span>
            <div className="text-2xl font-black text-indigo-600 mt-1">{coordinatorCount}</div>
          </div>

          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Technicians
            </span>
            <div className="text-2xl font-black text-teal-700 mt-1">{technicianCount}</div>
          </div>
        </div>

        {successMsg && (
          <div className="p-4 bg-green-50 border-l-4 border-green-500 rounded-r-2xl text-xs text-green-700 font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            {successMsg}
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl text-xs text-red-700 font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            {error}
          </div>
        )}

        {/* Assign Member Form */}
        {showAssignForm && (
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-md max-w-md animate-in fade-in slide-in-from-top-4 duration-200">
            <h3 className="font-bold text-slate-800 text-sm mb-4 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              Assign New Member
            </h3>
            <form onSubmit={handleAssign} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  User ID (UUID)
                </label>
                <input
                  type="text"
                  placeholder="Enter User UUID (e.g. 1a2b3c4d-...)"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  required
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-medium text-slate-700 transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Project Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-semibold text-slate-700 transition-all"
                >
                  <option value="MANAGER">Manager</option>
                  <option value="COORDINATOR">Coordinator</option>
                  <option value="TECHNICIAN">Technician</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
              >
                Confirm Assignment
              </button>
            </form>
          </div>
        )}

        {/* Team List Table */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="text-center py-12 text-slate-400 text-xs font-bold">Loading team members...</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200/80">
                <tr>
                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Member
                  </th>
                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Project Role
                  </th>
                  <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 flex items-center space-x-3.5">
                      <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold border border-indigo-200 flex-shrink-0">
                        {member.user?.name ? member.user.name[0].toUpperCase() : <User className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800">
                          {member.user?.name || 'Anonymous User'}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Mail className="w-3 h-3 inline" /> {member.user?.email}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-full border uppercase tracking-wider ${getRoleBadge(
                          member.role
                        )}`}
                      >
                        {member.role}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`text-xs font-semibold ${
                          member.status === 'ACTIVE' ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                      >
                        {member.status}
                      </span>
                    </td>
                  </tr>
                ))}

                {members.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-12 text-center text-slate-400 text-xs font-semibold">
                      No team members assigned yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
