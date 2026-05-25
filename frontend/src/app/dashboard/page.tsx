'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { projectsAPI, authAPI } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import Navbar from '@/components/Navbar'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, ArrowRight, Clock, CheckCircle2, FileText,
  Home, Sparkles, TrendingUp, Edit3, Activity, MapPin, User, Mail, Phone, Settings, X, Check
} from 'lucide-react'
import Link from 'next/link'
import clsx from 'clsx'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft:   { label: 'Draft',       color: 'bg-slate-100 text-slate-600',   icon: Edit3 },
  quoted:  { label: 'Quoted',      color: 'bg-amber-100 text-amber-700',   icon: FileText },
  ordered: { label: 'In Progress', color: 'bg-blue-100 text-blue-700',     icon: TrendingUp },
  done:    { label: 'Completed',   color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
}

const CITIES = ['Bangalore', 'Mumbai', 'Delhi', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad', 'Other']

function ProjectCard({ project }: { project: any }) {
  const status = STATUS_CONFIG[project.status] || STATUS_CONFIG.draft
  const isExecution = ['ordered', 'done'].includes(project.status)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden card-hover"
    >
      {/* Color accent bar */}
      <div className={clsx(
        'h-1.5',
        project.status === 'done'    ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' :
        project.status === 'ordered' ? 'bg-gradient-to-r from-blue-400 to-blue-600' :
        project.status === 'quoted'  ? 'bg-gradient-to-r from-amber-400 to-amber-600' :
        'bg-gradient-to-r from-indigo-500 to-indigo-700'
      )} />

      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-800 text-lg leading-tight truncate">{project.property_name}</h3>
            <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-0.5">
              <span className="font-semibold text-indigo-600">{project.bhk_type}</span>
              <span>•</span>
              <MapPin className="w-3 h-3 text-slate-400" />
              <span>{project.city}</span>
            </div>
          </div>
          <span className={clsx('badge ml-2 flex-shrink-0', status.color)}>
            <status.icon className="w-3 h-3 inline mr-1" />{status.label}
          </span>
        </div>

        {project.floor_plan_name && (
          <div className="mb-3 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-1.5 text-slate-500 text-xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span className="truncate font-medium">{project.floor_plan_name}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: 'Budget Cap', value: `₹${(project.budget / 100000).toFixed(1)}L` },
            { label: 'Created', value: new Date(project.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) },
          ].map((s) => (
            <div key={s.label} className="bg-slate-50 rounded-xl p-3">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">{s.label}</div>
              <div className="font-extrabold text-slate-800 text-sm">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Execution phase highlight */}
        {isExecution && (
          <div className="mb-4 flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-bold text-blue-700">
              {project.status === 'done' ? '✅ Handover Complete' : '🔨 Execution In Progress'}
            </span>
          </div>
        )}

        <div className="flex gap-2">
          <Link href={`/customize/${project.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition">
            <Edit3 className="w-3.5 h-3.5" /> Customise
          </Link>
          <Link href={`/visualize/${project.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition">
            <Sparkles className="w-3.5 h-3.5" /> AI View
          </Link>
          {project.status === 'draft' ? (
            <Link href={`/quotation/${project.id}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition">
              <FileText className="w-3.5 h-3.5" /> Quote
            </Link>
          ) : (
            <Link href={`/track/${project.id}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition">
              <Activity className="w-3.5 h-3.5" /> Track
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isLoggedIn, user, fetchMe, setUser } = useAuthStore()
  
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Profile Editor Modal States
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [profileCity, setProfileCity] = useState('Bangalore')
  const [profilePref, setProfilePref] = useState<'new' | 'upgrade'>('new')
  const [savingProfile, setSavingProfile] = useState(false)

  useEffect(() => {
    if (!isLoggedIn) { router.push('/login'); return }
    fetchMe()
    loadProjects()

    // Auto-open modal if ?edit=true is present
    if (searchParams.get('edit') === 'true') {
      setShowProfileModal(true)
    }
  }, [isLoggedIn, searchParams])

  // Populate profile editor once user details are fetched
  useEffect(() => {
    if (user) {
      setProfileName(user.name || '')
      setProfileEmail(user.email || '')
      setProfilePhone(user.phone || '')
      setProfileCity(user.city || 'Bangalore')
      setProfilePref((user.furnishing_preference || user.furnishing_type || 'new') === 'upgrade' ? 'upgrade' : 'new')
    }
  }, [user])

  const loadProjects = async () => {
    try {
      const res = await projectsAPI.list()
      setProjects(res.data.projects || [])
    } catch {
      toast.error('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profileName.trim()) return toast.error('Name cannot be empty')
    
    setSavingProfile(true)
    try {
      // Persist to SQLite via real backend API
      await authAPI.updateProfile({
        name: profileName,
        city: profileCity,
        style_tags: user?.style_tags || [],
      })

      const updatedUser = {
        ...user,
        name: profileName,
        email: profileEmail,
        phone: profilePhone,
        city: profileCity,
        furnishing_preference: profilePref
      }
      
      // Sync Zustand + localStorage after successful API save
      setUser(updatedUser)
      localStorage.setItem('active_user', JSON.stringify(updatedUser))
      
      toast.success('Profile updated successfully! ✨')
      setShowProfileModal(false)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {greeting()}, {user?.name?.split(' ')[0] || 'Designer'} 👋
            </h1>
            
            {/* User Meta Badges + Edit Profile Action */}
            <div className="flex flex-wrap items-center gap-2.5 mt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md flex items-center gap-1 border border-indigo-100">
                <MapPin className="w-3 h-3" /> {user?.city || 'Bangalore'}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md border border-slate-200">
                {(user?.furnishing_preference || user?.furnishing_type || 'new') === 'new' ? '🏠 Furnishing New Home' : '🔧 Upgrading Home'}
              </span>
              <button
                onClick={() => setShowProfileModal(true)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 py-1 px-2.5 rounded-md hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-all ml-1"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit Profile Details
              </button>
            </div>
          </div>
          
          <Link href="/onboarding" className="btn-primary self-start sm:self-center shadow-glow-indigo rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-5 flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> New Project
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { icon: Home,         label: 'Total Projects', value: projects.length,                                        color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
            { icon: CheckCircle2, label: 'Completed',      value: projects.filter(p => p.status === 'done').length,      color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
            { icon: FileText,     label: 'Quoted',         value: projects.filter(p => p.status === 'quoted').length,    color: 'bg-amber-50 text-amber-700 border-amber-100' },
            { icon: Activity,     label: 'In Progress',    value: projects.filter(p => p.status === 'ordered').length,   color: 'bg-blue-50 text-blue-600 border-blue-100' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl p-5 shadow-card border border-slate-100 text-center relative overflow-hidden card-hover">
              <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3 border', stat.color)}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div className="text-2.5xl font-black text-slate-900 mb-1">{stat.value}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Projects grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl shadow-card h-60 shimmer" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="w-28 h-28 bg-indigo-50 rounded-3xl flex items-center justify-center mb-6 border border-indigo-100 shadow-inner"
            >
              <Home className="w-12 h-12 text-indigo-400" />
            </motion.div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No active projects yet</h3>
            <p className="text-slate-500 mb-6 max-w-sm text-sm leading-relaxed">
              Start your first interior design project and transform your home with AI — in under 10 minutes.
            </p>
            <Link href="/onboarding" className="btn-primary text-base px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-glow-indigo">
              <Plus className="w-5 h-5" /> Create Your First Project
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowProfileModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden relative z-10 p-6 sm:p-8"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowProfileModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all"
              >
                <X className="w-4 h-4" />
              </button>

              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 mb-1">
                <Settings className="w-5.5 h-5.5 text-indigo-600 animate-spin-slow" /> Edit Profile Details
              </h2>
              <p className="text-slate-400 text-xs mb-6">Manage your designer profile contact and city information.</p>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-indigo-500" /> Full Name
                  </label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="input w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-slate-800 text-sm"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-indigo-500" /> Email Address
                  </label>
                  <input
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    className="input w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-slate-800 text-sm"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-indigo-500" /> Phone Number
                  </label>
                  <input
                    type="tel"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    className="input w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-slate-800 text-sm"
                  />
                </div>

                {/* City */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-indigo-500" /> Location City
                  </label>
                  <select
                    value={profileCity}
                    onChange={(e) => setProfileCity(e.target.value)}
                    className="input w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-bold text-slate-800 text-sm bg-white"
                  >
                    {CITIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Preference Q */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                    Scope Preference
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setProfilePref('new')}
                      className={clsx(
                        'p-3 rounded-xl border-2 text-left flex items-start gap-2.5 transition-all duration-200',
                        profilePref === 'new'
                          ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300'
                      )}
                    >
                      <div className={clsx(
                        'w-4 h-4 rounded-full border flex items-center justify-center mt-0.5',
                        profilePref === 'new' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                      )}>
                        {profilePref === 'new' && <Check className="w-2.5 h-2.5 stroke-[4px]" />}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-xs">Furnish New Home</div>
                      </div>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setProfilePref('upgrade')}
                      className={clsx(
                        'p-3 rounded-xl border-2 text-left flex items-start gap-2.5 transition-all duration-200',
                        profilePref === 'upgrade'
                          ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300'
                      )}
                    >
                      <div className={clsx(
                        'w-4 h-4 rounded-full border flex items-center justify-center mt-0.5',
                        profilePref === 'upgrade' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                      )}>
                        {profilePref === 'upgrade' && <Check className="w-2.5 h-2.5 stroke-[4px]" />}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-xs">Upgrading Home</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowProfileModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-glow-indigo flex items-center gap-1 transition"
                  >
                    {savingProfile ? <div className="spinner w-3.5 h-3.5" /> : <><Check className="w-4 h-4" /> Save Changes</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <DashboardContent />
    </Suspense>
  )
}
