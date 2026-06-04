'use client'

import { useEffect } from 'react'
import { useCustomerStore } from '@/stores/customerStore'
import { Activity, FileText, Image, MessageSquare, ShieldAlert, Sparkles, Upload } from 'lucide-react'

export default function ActivityFeed() {
  const { activity, fetchActivity } = useCustomerStore()

  useEffect(() => {
    fetchActivity()
  }, [fetchActivity])

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'floorplan_uploaded':
        return <Upload className="w-4 h-4 text-blue-500" />
      case 'quote_approved':
        return <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
      case 'quote_rejected':
        return <XCircleIcon className="w-4 h-4 text-red-500" />
      case 'quote_revision_requested':
        return <FileText className="w-4 h-4 text-amber-500" />
      case 'item_status_updated':
        return <Activity className="w-4 h-4 text-indigo-500" />
      case 'project_photo_uploaded':
        return <Image className="w-4 h-4 text-teal-500" />
      case 'issue_created':
        return <ShieldAlert className="w-4 h-4 text-rose-500" />
      case 'support_ticket_created':
        return <MessageSquare className="w-4 h-4 text-violet-500" />
      case 'service_requested':
        return <Sparkles className="w-4 h-4 text-purple-500" />
      default:
        return <Activity className="w-4 h-4 text-slate-500" />
    }
  }

  const formatActionText = (log: any) => {
    const meta = log.metadata_json || {}
    switch (log.action) {
      case 'floorplan_uploaded':
        return `Uploaded floor plan: ${meta.filename || 'Blueprint'}`
      case 'quote_approved':
        return 'Approved project quotation'
      case 'quote_rejected':
        return 'Rejected project quotation'
      case 'quote_revision_requested':
        return `Requested quote revision: "${meta.notes || ''}"`
      case 'item_status_updated':
        return `Updated status of ${meta.item_name || 'item'} to ${meta.status || 'new status'}`
      case 'project_photo_uploaded':
        return `Uploaded verification photo for ${meta.room || 'site'}`
      case 'issue_created':
        return `Logged execution issue (${meta.type || 'Other'})`
      case 'support_ticket_created':
        return `Raised support ticket: "${meta.subject || ''}"`
      case 'service_requested':
        return `Requested paid design service: ${meta.service_type || ''}`
      default:
        return log.action.replace(/_/g, ' ')
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-card space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
        <Activity className="w-5 h-5 text-indigo-600" />
        <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Recent Activity</h2>
      </div>

      <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
        {activity.map((log) => (
          <div key={log.id} className="flex gap-3 text-xs">
            <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-150 flex items-center justify-center flex-shrink-0 mt-0.5">
              {getActionIcon(log.action)}
            </div>
            <div className="space-y-0.5">
              <p className="font-semibold text-slate-700 leading-snug">{formatActionText(log)}</p>
              <p className="text-[9px] text-slate-400 font-medium">
                {new Date(log.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            </div>
          </div>
        ))}

        {activity.length === 0 && (
          <p className="text-center py-6 text-slate-400 text-xs font-semibold">No activity logs recorded yet.</p>
        )}
      </div>
    </div>
  )
}

function CheckCircleIcon(props: any) {
  return (
    <svg className={props.className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function XCircleIcon(props: any) {
  return (
    <svg className={props.className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
