'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { enterpriseAPI } from '@/lib/api'
import Navbar from '@/components/Navbar'
import toast from 'react-hot-toast'
import { Plus, Building, MapPin, Calendar, CheckCircle2, ChevronRight, Activity, Percent, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import clsx from 'clsx'

export default function EnterpriseDashboard() {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProjects = () => {
    setLoading(true)
    setError(null)
    enterpriseAPI.listProjects()
      .then(res => {
        setProjects(res.data.projects || [])
        setLoading(false)
      })
      .catch(err => {
        console.error("Failed to load enterprise projects:", err)
        setError("Failed to fetch projects. Please check your credentials.")
        toast.error("Failed to fetch projects. Please check your credentials.", { id: 'enterprise-fetch-projects-error' })
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  // Calculate cumulative stats
  const totalUnits = projects.reduce((acc, p) => acc + p.total_units, 0)
  const completedUnits = projects.reduce((acc, p) => acc + (p.stats?.completed || 0), 0)
  const inProgressUnits = projects.reduce((acc, p) => acc + (p.stats?.in_progress || 0), 0)
  const avgCompletion = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0

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
        ) : projects.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
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
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                  <Building className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Projects</span>
                  <div className="text-2xl font-black text-slate-800">{projects.length}</div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Unit Inventory</span>
                  <div className="text-2xl font-black text-slate-800">{totalUnits}</div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">In Progress Onboarding</span>
                  <div className="text-2xl font-black text-slate-800">{inProgressUnits}</div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Execution Completed</span>
                  <div className="text-2xl font-black text-slate-800">{completedUnits} <span className="text-xs text-slate-450 font-medium">({avgCompletion}%)</span></div>
                </div>
              </div>
            </div>

            {/* Projects Grid */}
            <div className="space-y-4">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Active Real Estate Developments</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {projects.map((p) => {
                  const percentDone = p.total_units > 0 ? Math.round(((p.stats?.completed || 0) / p.total_units) * 100) : 0
                  return (
                    <div
                      key={p.id}
                      onClick={() => router.push(`/enterprise/project/${p.id}`)}
                      className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md cursor-pointer transition flex flex-col justify-between hover:border-indigo-300 group"
                    >
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-extrabold text-slate-850 text-slate-800 text-lg group-hover:text-indigo-650 transition">
                              {p.property_name}
                            </h3>
                            <div className="flex items-center gap-1.5 text-slate-400 text-xs mt-1 font-semibold">
                              <MapPin className="w-3.5 h-3.5 text-slate-405 text-slate-400" />
                              <span>{p.city}</span>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                        </div>

                        {/* Flat setup stats */}
                        <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3.5 rounded-xl text-center text-xs">
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
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div className="bg-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${percentDone}%` }} />
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center border-t border-slate-100 pt-4 mt-5 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-450 font-semibold">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span>Ready from: {p.earliest_start_date || 'Immediate'}</span>
                        </div>
                        <span className="text-indigo-600 font-extrabold flex items-center gap-0.5 group-hover:underline">
                          View Units <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>

                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
