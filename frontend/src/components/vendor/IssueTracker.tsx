'use client';

import { useState, useEffect } from 'react';
import { useProjectTeamStore } from '@/stores/projectTeamStore';
import { AlertCircle, Plus, X } from 'lucide-react';

interface Props {
  projectId: string;
}

export function IssueTracker({ projectId }: Props) {
  const { issues, fetchIssues, createIssue, error, clearError } = useProjectTeamStore();
  const [showForm, setShowForm] = useState(false);
  
  // Form fields
  const [type, setType] = useState('OTHER');
  const [priority, setPriority] = useState('LOW');
  const [description, setDescription] = useState('');
  const [itemId, setItemId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchIssues(projectId);
  }, [projectId, fetchIssues]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setIsSubmitting(true);
    clearError();
    try {
      await createIssue(projectId, {
        type,
        priority,
        description,
        itemId: itemId || undefined,
      });
      setDescription('');
      setItemId('');
      setShowForm(false);
    } catch (err) {}
    setIsSubmitting(false);
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH':
        return 'bg-orange-100 text-orange-850 border-orange-200';
      case 'MEDIUM':
        return 'bg-amber-100 text-amber-850 border-amber-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const formatEnum = (str: string) => {
    return str.replace(/_/g, ' ');
  };

  return (
    <div className="bg-white border border-slate-200/85 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
              Execution Issues
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">Log and track delays or damage.</p>
          </div>
          <button
            onClick={() => {
              setShowForm(!showForm);
              clearError();
            }}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-xl transition-all shadow-sm flex items-center space-x-1"
          >
            <span>{showForm ? '✕ Close' : '+ New Issue'}</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-medium">
            {error}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Issue Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none font-semibold text-slate-700"
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none font-semibold text-slate-700"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Item ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="SKU-XYZ"
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none font-medium text-slate-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Description
              </label>
              <textarea
                placeholder="Details of the execution issue..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                required
                className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none font-medium text-slate-700 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
            >
              {isSubmitting ? 'Submitting...' : 'Log Issue'}
            </button>
          </form>
        )}

        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          {issues.map((issue) => (
            <div
              key={issue.id}
              className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl hover:shadow-sm transition-all"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {formatEnum(issue.type)}
                </span>
                <span
                  className={`px-2 py-0.5 text-[9px] font-bold rounded-full border uppercase ${getPriorityColor(
                    issue.priority
                  )}`}
                >
                  {issue.priority}
                </span>
              </div>
              <p className="text-xs text-slate-700 font-medium mb-2.5 leading-relaxed">
                {issue.description}
              </p>
              <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold uppercase tracking-wider pt-2 border-t border-slate-200/50">
                <span>By {issue.createdBy?.name || 'Staff'}</span>
                <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                  {issue.status}
                </span>
              </div>
            </div>
          ))}

          {issues.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-xs font-semibold">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50 text-slate-300" />
              No issues logged yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default IssueTracker;
