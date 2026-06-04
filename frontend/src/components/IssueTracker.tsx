'use client';

import { useState, useEffect } from 'react';
import { useCustomerStore } from '@/stores/customerStore';
import { AlertCircle, Plus, X } from 'lucide-react';

interface Props {
  projectId: string;
}

export function IssueTracker({ projectId }: Props) {
  const { issues, fetchIssues, createIssue, error, clearError } = useCustomerStore();
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
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'HIGH':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'MEDIUM':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      default:
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
    }
  };

  return (
    <div className="bg-indigo-950/40 border border-white/10 rounded-2xl p-6 shadow-card backdrop-blur-md flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-bold text-white text-sm uppercase tracking-wider">
              Execution Issues
            </h3>
            <p className="text-[10px] text-indigo-300 font-medium">Log and track delays or damage.</p>
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
          <div className="mb-4 p-3 bg-red-500/10 border-l-4 border-red-500 rounded-r-xl text-xs text-red-300 font-medium">
            {error}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 space-y-3.5 bg-indigo-900/30 p-4 rounded-xl border border-white/5">
            <div>
              <label className="block text-[10px] font-bold text-indigo-300 uppercase tracking-wider mb-1">
                Issue Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full text-xs bg-indigo-950 border border-white/10 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none font-semibold text-white"
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
                <label className="block text-[10px] font-bold text-indigo-300 uppercase tracking-wider mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full text-xs bg-indigo-950 border border-white/10 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none font-semibold text-white"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-indigo-300 uppercase tracking-wider mb-1">
                  Item ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="SKU-XYZ"
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                  className="w-full text-xs bg-indigo-950 border border-white/10 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none font-medium text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-indigo-300 uppercase tracking-wider mb-1">
                Description
              </label>
              <textarea
                placeholder="Details of the execution issue..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                required
                className="w-full text-xs bg-indigo-950 border border-white/10 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none font-medium text-white resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 bg-indigo-650 hover:bg-indigo-700 disabled:bg-indigo-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
            >
              {isSubmitting ? 'Submitting...' : 'Log Issue'}
            </button>
          </form>
        )}

        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          {issues.map((issue) => (
            <div
              key={issue.id}
              className="p-3.5 bg-indigo-900/20 border border-white/5 rounded-xl hover:shadow-sm transition-all"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
                  {issue.type.replace(/_/g, ' ')}
                </span>
                <span
                  className={`px-2 py-0.5 text-[9px] font-bold rounded-full border uppercase ${getPriorityColor(
                    issue.priority
                  )}`}
                >
                  {issue.priority}
                </span>
              </div>
              <p className="text-xs text-indigo-100 font-medium mb-2.5 leading-relaxed">
                {issue.description}
              </p>
              <div className="flex justify-between items-center text-[9px] text-indigo-400 font-bold uppercase tracking-wider pt-2 border-t border-white/5">
                <span>By {issue.created_by || 'Customer'}</span>
                <span className="bg-indigo-950 px-2 py-0.5 rounded-full text-indigo-300">
                  {issue.status}
                </span>
              </div>
            </div>
          ))}

          {issues.length === 0 && (
            <div className="text-center py-8 text-indigo-300/60 text-xs font-semibold">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No issues logged yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default IssueTracker;
