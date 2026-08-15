'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { enterpriseAPI } from '@/lib/api'
import Navbar from '@/components/Navbar'
import toast from 'react-hot-toast'
import { Plus, Building, MapPin, Calendar, CheckCircle2, Activity, ArrowRight, Trash2, AlertCircle, Globe, User, ExternalLink, Clock } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/authStore'

export default function EnterpriseDashboard() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [projects, setProjects] = useState<any[]>([])
  const [activity, setActivity] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null)
  const [deletingProject, setDeletingProject] = useState(false)

  const fetchProjects = () => {
    setLoading(true)
    setError(null)
    Promise.all([
      enterpriseAPI.listProjects(),
      enterpriseAPI.getActivity()
    ])
      .then(([projRes, actRes]) => {
        setProjects(projRes.data.projects || [])
        setActivity(actRes.data.activity || [])
        setLoading(false)
      })
      .catch(err => {
        console.error("Failed to load enterprise data:", err)
        setError("Failed to fetch developments. Please check your connection.")
        toast.error("Failed to fetch developments. Please check your connection.", { id: 'enterprise-fetch-error' })
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  // Calculate cumulative stats
  const totalUnits = projects.reduce((acc, p) => acc + p.total_units, 0)

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 pt-28 pb-16 space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Enterprise Console</h1>
            <p className="text-slate-500 text-sm mt-1">Manage B2B2C residential developments, configure layouts, and invite home buyers.</p>
          </div>
          <Link
            href="/enterprise/create-project"
            className="btn-primary px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-md hover:shadow-lg transition"
          >
            <Plus className="w-5 h-5" /> Set Up New Project
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-500 text-sm font-semibold">Loading developments...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-red-100 shadow-sm space-y-4">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500">
              <Building className="w-8 h-8" />
            </div>
            <div className="max-w-sm mx-auto space-y-2">
              <h3 className="font-extrabold text-red-800 text-lg">Error Loading Projects</h3>
              <p className="text-slate-450 text-xs leading-relaxed">{error}</p>
            </div>
            <button
              onClick={fetchProjects}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Organization Profile & Recent Activity */}
            <div className="space-y-6 lg:col-span-1">
              
              {/* Organization Profile Card */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
                    <Building className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-base leading-tight">
                      {user?.name || 'Prestige Developer Group'}
                    </h3>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                      <span>Real Estate Developer</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <div className="flex items-center gap-2.5 text-xs text-slate-605">
                    <Globe className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <a href="https://www.prestigeconstructions.com" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 hover:underline flex items-center gap-1 font-semibold truncate">
                      www.prestigeconstructions.com <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-slate-605">
                    <Building className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="font-semibold">{user?.email || 'admin@prestigegroup.com'}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-slate-605">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">Tier-1 Developer Partner</span>
                  </div>
                </div>
              </div>

              {/* Recent Activity Card (replacing Key Portfolio Metrics) */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 pb-3 border-b border-slate-100">
                  <Activity className="w-4 h-4 text-indigo-500" /> Recent Activity
                </h3>

                <div className="divide-y divide-slate-100">
                  {activity.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 font-semibold">
                      No recent activities logged yet.
                    </div>
                  ) : (
                    activity.map((act) => {
                      const IconComponent = act.type === 'project' ? Building : User
                      let displayedTime = 'Just now'
                      try {
                        const date = new Date(act.timestamp)
                        displayedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString([], { month: 'short', day: 'numeric' })
                      } catch (e) {}

                      return (
                        <div key={act.id} className="py-4 flex gap-4 items-start first:pt-0 last:pb-0">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-50 border border-slate-100 text-slate-500">
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-slate-750 leading-normal">{act.message}</p>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold mt-0.5">
                              <Clock className="w-3 h-3" />
                              <span>{displayedTime}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

            </div>

            {/* Right Column: Projects list & Count Metrics */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Header & Stats Row */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <h2 className="text-lg font-black text-slate-805 text-slate-800">Active Projects</h2>
                
                <div className="flex gap-4">
                  {/* Total Projects */}
                  <div className="flex items-center gap-3 bg-slate-50 border border-slate-150/60 px-4 py-2 rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 border border-indigo-100">
                      <Building className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider leading-none">Total Projects</span>
                      <span className="text-sm font-black text-slate-800 mt-1 block leading-none">{projects.length}</span>
                    </div>
                  </div>

                  {/* Total Units */}
                  <div className="flex items-center gap-3 bg-slate-50 border border-slate-150/60 px-4 py-2 rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 border border-blue-100">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider leading-none">Total Units</span>
                      <span className="text-sm font-black text-slate-800 mt-1 block leading-none">{totalUnits}</span>
                    </div>
                  </div>
                </div>
              </div>

              {projects.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                    <Building className="w-8 h-8" />
                  </div>
                  <div className="max-w-sm mx-auto space-y-2">
                    <h3 className="font-extrabold text-slate-800 text-lg">No Projects Configured</h3>
                    <p className="text-slate-400 text-xs leading-relaxed">Establish your first development project to generate unit mixes and begin inviting customers to customize their layouts.</p>
                  </div>
                  <Link
                    href="/enterprise/create-project"
                    className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-extrabold text-sm"
                  >
                    Get started now &rarr;
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {projects.map((p) => {
                    const percentDone = p.total_units > 0 ? Math.round(((p.stats?.completed || 0) / p.total_units) * 100) : 0
                    return (
                      <div
                        key={p.id}
                        className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md cursor-pointer transition flex flex-col justify-between hover:border-indigo-300 relative group"
                        onClick={() => router.push(`/enterprise/project/${p.id}`)}
                      >
                        <div className="space-y-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0 pr-8">
                              <h3 className="font-extrabold text-slate-800 text-lg group-hover:text-indigo-600 transition truncate">
                                {p.property_name}
                              </h3>
                              <div className="flex items-center gap-1.5 text-slate-400 text-xs mt-1 font-semibold">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                <span>{p.city}</span>
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setProjectToDelete(p.id)
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all z-10"
                              title="Delete Project"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Flat setup stats */}
                          <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3.5 rounded-xl text-center text-xs border border-slate-100">
                            <div>
                              <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Inventory</span>
                              <span className="font-extrabold text-slate-700 text-sm">{p.total_units} units</span>
                            </div>
                            <div>
                              <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Active</span>
                              <span className="font-extrabold text-slate-700 text-sm">{p.stats?.in_progress || 0} buyers</span>
                            </div>
                            <div>
                              <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Completed</span>
                              <span className="font-extrabold text-slate-700 text-sm">{p.stats?.completed || 0} units</span>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                              <span>Modular Delivery Progress</span>
                              <span>{percentDone}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/40">
                              <div className="bg-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${percentDone}%` }} />
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between items-center border-t border-slate-100 pt-4 mt-5 text-xs">
                          <div className="flex items-center gap-1.5 text-slate-450 font-semibold">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <span>Ready from: {p.earliest_start_date || 'Immediate'}</span>
                          </div>
                          <span className="text-indigo-650 font-extrabold flex items-center gap-0.5 group-hover:underline">
                            View Units <ArrowRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

            </div>
          </div>
        )}

      </div>

      {/* Delete Confirmation Overlay Dialog */}
      <AnimatePresence>
        {projectToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            {/* Backdrop Blur Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setProjectToDelete(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />

            {/* Glassmorphism Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-gradient-to-b from-[#2e313d]/95 to-[#0e1013]/95 backdrop-blur-2xl border border-slate-700/40 rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.85)] relative z-10 text-center text-slate-200"
            >
              <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>

              <h3 className="text-lg font-black text-white mb-2">Delete Development</h3>
              <p className="text-slate-300/90 text-xs mb-6 leading-relaxed max-w-sm mx-auto">
                This will permanently delete the project, all flat unit mixes, invitations, and child customer projects. This action cannot be undone.
              </p>

              <div className="flex gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => setProjectToDelete(null)}
                  disabled={deletingProject}
                  className="px-5 py-2.5 rounded-xl border border-slate-700/50 bg-[#161820] hover:bg-[#20232e] text-slate-300 hover:text-white text-xs font-bold transition duration-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setDeletingProject(true)
                    try {
                      await enterpriseAPI.deleteProject(projectToDelete)
                      toast.success("Enterprise project and all associated configurations deleted successfully! 🗑️")
                      fetchProjects()
                    } catch (err: any) {
                      toast.error(err.response?.data?.detail || "Failed to delete project")
                    } finally {
                      setDeletingProject(false)
                      setProjectToDelete(null)
                    }
                  }}
                  disabled={deletingProject}
                  className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 active:from-red-700 active:to-rose-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition shadow-[0_0_12px_rgba(239,68,68,0.2)] flex items-center gap-1.5 duration-200"
                >
                  {deletingProject ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Confirm Delete"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
