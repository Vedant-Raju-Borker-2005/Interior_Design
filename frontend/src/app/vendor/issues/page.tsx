'use client'

import { useEffect, useState } from 'react'
import { vendorAPI } from '@/lib/api'
import { AlertCircle, Clock, CheckCircle2, ChevronRight, MessageSquare, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'

export default function VendorIssuesPage() {
  const [issues, setIssues] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchIssues = async () => {
      try {
        const res = await vendorAPI.getIssues()
        setIssues(res.data || [])
      } catch (err) {
        console.error("Failed to load issues:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchIssues()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Issues & Escalations</h1>
        <p className="text-xs text-slate-500 mt-0.5">View and monitor errors or issues raised by customers for your assigned components.</p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-6 space-y-6">
        <h3 className="font-extrabold text-slate-800 text-base">Active Issues Log</h3>
        
        {loading ? (
          <div className="py-12 flex justify-center items-center">
            <div className="spinner w-8 h-8" />
          </div>
        ) : issues.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-xs font-semibold bg-slate-50/50 rounded-2xl border border-dashed border-slate-200/60">
            <AlertCircle className="w-8 h-8 text-slate-355 mx-auto mb-2" />
            No issues or errors reported for your components yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="pb-3 pl-2">Component / Project</th>
                  <th className="pb-3">Room</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Priority</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Description</th>
                  <th className="pb-3">Reported</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
                {issues.map((issue) => (
                  <tr key={issue.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-4 pl-2">
                      <div className="font-bold text-slate-800">{issue.itemName}</div>
                      <div className="text-[10px] text-slate-450 mt-0.5">{issue.projectName}</div>
                    </td>
                    <td className="py-4 capitalize">{issue.roomName?.replace(/_/g, ' ')}</td>
                    <td className="py-4">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200/50 text-[10px]">
                        {issue.type?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-4">
                      <span className={clsx(
                        "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                        issue.priority === 'critical' ? 'bg-red-100 text-red-700 border-red-200' :
                        issue.priority === 'high' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                        issue.priority === 'medium' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                      )}>
                        {issue.priority}
                      </span>
                    </td>
                    <td className="py-4">
                      <span className={clsx(
                        "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                        issue.status === 'resolved' || issue.status === 'closed' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                        issue.status === 'in_progress' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' :
                        'bg-rose-100 text-rose-700 border-rose-200'
                      )}>
                        {issue.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-4 font-normal text-slate-500 max-w-xs truncate" title={issue.description}>
                      {issue.description}
                    </td>
                    <td className="py-4 text-slate-455 font-normal">
                      {new Date(issue.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
