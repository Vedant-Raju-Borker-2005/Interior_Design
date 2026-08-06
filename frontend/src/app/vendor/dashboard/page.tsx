'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useVendorStore } from '@/stores/vendorStore'
import { 
  Briefcase, Clock, CheckCircle2, TrendingUp, RefreshCw, 
  Star, Percent, Bell, Check, ArrowRight, ShieldAlert, AlertTriangle 
} from 'lucide-react'
import { Toaster, toast } from 'react-hot-toast'

export default function VendorDashboardPage() {
  const router = useRouter()
  const { 
    profile, dashboard, loading, loadDashboard, 
    updateAssignmentStatus, markNotificationsRead 
  } = useVendorStore()

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  // Redirect to onboarding if not registered
  useEffect(() => {
    if (!loading && profile && profile.status === 'NOT REGISTERED') {
      router.push('/vendor/onboarding')
    }
  }, [profile, loading, router])

  const handleRefresh = async () => {
    await loadDashboard()
    toast.success('Dashboard data refreshed')
  }

  const handleAcceptAssignment = async (id: string) => {
    try {
      await updateAssignmentStatus(id, 'ACCEPTED', 'Accepted via dashboard')
      toast.success('Assignment accepted')
      loadDashboard()
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept assignment')
    }
  }

  const handleRejectAssignment = async (id: string) => {
    try {
      await updateAssignmentStatus(id, 'REJECTED', 'Rejected via dashboard')
      toast.error('Assignment rejected')
      loadDashboard()
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject assignment')
    }
  }

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationsRead([id])
      toast.success('Alert dismissed')
    } catch (err) {
      toast.error('Failed to update alert')
    }
  }

  if (loading && !dashboard) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500 space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
        <span className="text-xs font-semibold">Loading partner dashboard...</span>
      </div>
    )
  }

  // Not approved notification gate
  const showGate = profile && profile.status !== 'APPROVED'

  const kpis = [
    { 
      title: 'Allocated Items', 
      value: dashboard?.kpi?.totalAssignments ?? 0, 
      trend: '+8%', 
      isUp: true, 
      icon: Briefcase,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-100'
    },
    { 
      title: 'Pending Acceptance', 
      value: dashboard?.kpi?.pendingItems ?? 0, 
      trend: 'Needs Action', 
      isUp: false, 
      icon: Clock,
      color: 'text-amber-600 bg-amber-50 border-amber-100'
    },
    { 
      title: 'Completed Elements', 
      value: dashboard?.kpi?.completedItems ?? 0, 
      trend: '+12%', 
      isUp: true, 
      icon: CheckCircle2,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-100'
    },
    { 
      title: 'Monthly Payouts', 
      value: `₹${((dashboard?.kpi?.monthlyEarnings ?? 0) / 1000).toFixed(0)}k`, 
      trend: '+24%', 
      isUp: true, 
      icon: TrendingUp,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-100'
    },
  ]

  // Mock graphic metrics data for activity
  const mockActivity = [
    { label: 'Jan', value: 30 },
    { label: 'Feb', value: 45 },
    { label: 'Mar', value: 70 },
    { label: 'Apr', value: 50 },
    { label: 'May', value: 90 },
    { label: 'Jun', value: 80 }
  ]

  return (
    <div className="space-y-8 select-none">
      {/* Upper header action bar */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Partner Dashboard</h1>
          <p className="text-xs text-slate-400 mt-1">Real-time elements logs, fabrication statuses, and performance analytics.</p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Sync Data</span>
        </button>
      </div>

      {showGate && (
        <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-5 flex items-start gap-4">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-extrabold text-amber-800 text-xs">Onboarding Verification Pending</h3>
            <p className="text-xs text-amber-700/80 mt-1">
              Your documents are currently undergoing audit. Some elements allocation, orders, and payout graphs will remain in preview.
            </p>
          </div>
          <Link
            href="/vendor/onboarding"
            className="text-xs font-bold text-amber-800 hover:underline flex items-center gap-0.5"
          >
            <span>Finish Uploads</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* KPI metric display cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon
          return (
            <div key={idx} className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex justify-between items-center pb-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{kpi.title}</span>
                <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${kpi.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div>
                <span className="text-2xl font-black text-slate-800 tracking-tight block">{kpi.value}</span>
                <span className={`text-[10px] font-bold block mt-1.5 ${
                  kpi.trend === 'Needs Action' ? 'text-amber-500 animate-pulse' : kpi.isUp ? 'text-emerald-600' : 'text-red-500'
                }`}>
                  {kpi.trend}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Visual Chart and Performance ratings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Custom activity bar graphics */}
        <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm lg:col-span-2 space-y-6">
          <div>
            <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Fabrication Activity</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Sourcing elements load weight and count logs.</p>
          </div>
          
          <div className="flex items-end justify-between h-48 pt-4 px-2">
            {mockActivity.map((bar, idx) => (
              <div key={idx} className="flex flex-col items-center flex-1 space-y-2">
                <div className="w-full px-2 max-w-[40px] relative group cursor-pointer">
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-slate-900 text-white text-[10px] px-2 py-1 rounded font-bold whitespace-nowrap shadow z-10">
                    {bar.value} Items
                  </div>
                  <div 
                    className="w-full bg-gradient-to-t from-indigo-500 to-indigo-700 rounded-t-lg transition-all duration-500 group-hover:from-indigo-600 group-hover:to-indigo-800 shadow shadow-indigo-100"
                    style={{ height: `${bar.value}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-400">{bar.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Performance metrics tracker */}
        <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-6">
            <div>
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Sourcing Ratings</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Calculated based on partner SLA agreements.</p>
            </div>

            <div className="space-y-4">
              {/* Metric 1 */}
              <div>
                <div className="flex justify-between items-center text-xs font-bold text-slate-700 mb-1">
                  <div className="flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5 text-slate-400" />
                    <span>Acceptance SLA</span>
                  </div>
                  <span className="text-indigo-600">{dashboard?.kpi?.acceptanceRate?.toFixed(0) ?? 95}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${dashboard?.kpi?.acceptanceRate ?? 95}%` }} 
                  />
                </div>
              </div>

              {/* Metric 2 */}
              <div>
                <div className="flex justify-between items-center text-xs font-bold text-slate-700 mb-1">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Completion SLA</span>
                  </div>
                  <span className="text-indigo-600">{dashboard?.kpi?.completionRate?.toFixed(0) ?? 92}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${dashboard?.kpi?.completionRate ?? 92}%` }} 
                  />
                </div>
              </div>

              {/* Metric 3 */}
              <div>
                <div className="flex justify-between items-center text-xs font-bold text-slate-700 mb-1">
                  <div className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-slate-400" />
                    <span>Design Partner Score</span>
                  </div>
                  <span className="text-indigo-600">{dashboard?.kpi?.customerRating?.toFixed(1) ?? 4.8}/5.0</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${(dashboard?.kpi?.customerRating ?? 4.8) * 20}%` }} 
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 mt-6 flex justify-between items-center text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">
            <span>Aggregated weekly</span>
            <span className="text-indigo-600 cursor-pointer hover:underline">Partner SLA Info</span>
          </div>
        </div>
      </div>

      {/* Grid of Alert Center & Recent Assignment requests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent assignments section */}
        <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Recent Sourcing Requests</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Accept or decline custom fabrication items.</p>
            </div>
            <Link 
              href="/vendor/assignments" 
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-hidden border border-slate-100 rounded-xl bg-slate-50/50">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100/50 border-b border-slate-200">
                <tr>
                  <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Project / Item</th>
                  <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Qty</th>
                  <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-xs">
                {(dashboard?.recentAssignments ?? []).map((item: any) => (
                  <tr key={item.id} className="hover:bg-slate-100/30 transition">
                    <td className="p-3">
                      <span className="font-bold text-slate-700 block">{item.projectName}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">{item.itemName}</span>
                    </td>
                    <td className="p-3 text-slate-500 font-bold">{item.quantity}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded-full uppercase border ${
                        item.status === 'ACCEPTED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        item.status === 'REJECTED' ? 'bg-red-50 text-red-750 border-red-100' :
                        'bg-amber-50 text-amber-700 border-amber-100'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1.5">
                      {['ASSIGNED', 'RECEIVED_ORDER'].includes(item.status) ? (
                        <button
                          onClick={() => handleAcceptAssignment(item.id)}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-750 text-white rounded-lg text-[10px] font-extrabold transition shadow-sm"
                        >
                          Accept
                        </button>
                      ) : (
                        <Link
                          href="/vendor/assignments"
                          className="inline-block px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition"
                        >
                          Details
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
                {(dashboard?.recentAssignments ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-400 text-[11px] font-medium bg-white">
                      No recent elements assigned. Ready for layout sync!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alert Notification Center */}
        <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Alert Center</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Critical notifications from project managers.</p>
            </div>

            <div className="space-y-2.5">
              {(dashboard?.notifications ?? []).map((notif: any) => (
                <div 
                  key={notif.id} 
                  className={`p-3 rounded-xl border flex gap-3 items-start transition ${
                    notif.isRead ? 'bg-slate-50/50 border-slate-100 opacity-60' : 'bg-indigo-50/30 border-indigo-100/50'
                  }`}
                >
                  <Bell className={`w-3.5 h-3.5 mt-0.5 ${notif.isRead ? 'text-slate-400' : 'text-indigo-600'}`} />
                  <div className="flex-1 space-y-1">
                    <p className="text-[11px] font-bold text-slate-700 leading-snug">{notif.message}</p>
                    <span className="text-[9px] text-slate-400 block">
                      {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {!notif.isRead && (
                    <button
                      onClick={() => handleMarkRead(notif.id)}
                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                      title="Dismiss Alert"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {(dashboard?.notifications ?? []).length === 0 && (
                <div className="p-8 text-center text-slate-400 text-[11px] font-medium">
                  No notifications or delay warnings active.
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 text-center">
            <span className="text-[9px] font-extrabold text-slate-400 uppercase">
              Notifications sync in real-time
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
