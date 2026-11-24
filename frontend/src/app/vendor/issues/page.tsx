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
        <h1 className="text-2xl font-black text-[#161D1A] tracking-tight">Issues & Escalations</h1>
        <p className="text-xs text-stone-500 mt-0.5">View and monitor errors or issues raised by customers for your assigned components.</p>
      </div>

      <div className="bg-white rounded-3xl border border-[#E5ECE7] shadow-xs p-6 space-y-6">
        <h3 className="font-extrabold text-[#161D1A] text-base">Active Issues Log</h3>
        
        {loading ? (
          <div className="py-12 flex justify-center items-center">
            <div className="spinner w-8 h-8" />
          </div>
        ) : issues.length === 0 ? (
          <div className="text-center py-16 text-stone-400 text-xs font-semibold bg-[#FAFBF9] rounded-2xl border border-dashed border-[#E5ECE7]">
            <AlertCircle className="w-8 h-8 text-stone-300 mx-auto mb-2" />
            No issues or errors reported for your components yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E5ECE7] text-stone-500 font-bold uppercase tracking-wider bg-[#F4F6F4]">
                  <th className="py-2.5 px-3">Component / Project</th>
                  <th className="py-2.5 px-3">Room</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Priority</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Reported</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5ECE7] font-semibold text-stone-700">
                {issues.map((issue) => (
                  <tr key={issue.id} className="hover:bg-[#FAFBF9] transition">
                    <td className="py-4 px-3">
                      <div className="font-bold text-[#161D1A]">{issue.itemName}</div>
                      <div className="text-[10px] text-stone-400 mt-0.5">{issue.projectName}</div>
                    </td>
                    <td className="py-4 px-3 capitalize">{issue.roomName?.replace(/_/g, ' ')}</td>
                    <td className="py-4 px-3">
                      <span className="px-2 py-0.5 rounded-lg bg-stone-100 text-stone-600 border border-[#E5ECE7] text-[10px]">
                        {issue.type?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-4 px-3">
                      <span className={clsx(
                        "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                        issue.priority === 'critical' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        issue.priority === 'high' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                        issue.priority === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-stone-100 text-stone-600 border-[#E5ECE7]'
                      )}>
                        {issue.priority}
                      </span>
                    </td>
                    <td className="py-4 px-3">
                      <span className={clsx(
                        "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                        issue.status === 'resolved' || issue.status === 'closed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        issue.status === 'in_progress' ? 'bg-[#161D1A] text-[#A3E635] border-[#161D1A]' :
                        'bg-rose-50 text-rose-700 border-rose-200'
                      )}>
                        {issue.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-4 px-3 font-normal text-stone-600 max-w-xs truncate" title={issue.description}>
                      {issue.description}
                    </td>
                    <td className="py-4 px-3 text-stone-400 font-normal">
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
