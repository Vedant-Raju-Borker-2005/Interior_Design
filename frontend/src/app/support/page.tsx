'use client'

import { useEffect, useState } from 'react'
import { useCustomerStore } from '@/stores/customerStore'
import { projectsAPI } from '@/lib/api'
import Navbar from '@/components/Navbar'
import { AlertCircle, Mail, MessageSquare, Phone, User, Send, Check, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function SupportPage() {
  const { tickets, fetchTickets, createTicket } = useCustomerStore()
  const [projects, setProjects] = useState<any[]>([])
  
  // Form fields
  const [selectedProjectId, setSelectedProjectId] = useState('general')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchTickets()
    // Load projects for selection
    const loadProjects = async () => {
      try {
        const res = await projectsAPI.list()
        const projectList = res.data.projects || []
        setProjects(projectList)
        if (projectList.length > 0) {
          setSelectedProjectId(projectList[0].id)
        } else {
          setSelectedProjectId('general')
        }
      } catch {}
    }
    loadProjects()
  }, [fetchTickets])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProjectId || !subject.trim() || !description.trim()) {
      toast.error('Please fill all fields')
      return
    }
    setIsSubmitting(true)
    try {
      const targetProjId = selectedProjectId === 'general' ? 'general' : selectedProjectId
      await createTicket(targetProjId, subject, description)
      toast.success('Support ticket submitted successfully')
      setSubject('')
      setDescription('')
      fetchTickets() // refresh list
    } catch {
      toast.error('Failed to submit ticket')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Coordinator info
  const coordinator = {
    name: 'Amit Patel',
    role: 'Senior Project Coordinator',
    phone: '+91 99887 76655',
    email: 'amit.patel@interiorai.in',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 pt-24 space-y-8">
        {/* Title */}
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Support Center</h1>
          <p className="text-sm text-slate-500 mt-1">
            Get help with your project design, deliveries, payments, or raise a support ticket.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Columns: Contact & Coordinator */}
          <div className="space-y-6">
            {/* Coordinator profile card */}
            <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-5">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Your Project Coordinator</h2>
              
              <div className="flex items-center gap-4">
                <img
                  src={coordinator.avatar}
                  alt={coordinator.name}
                  className="w-14 h-14 rounded-2xl object-cover border border-slate-100"
                />
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800">{coordinator.name}</h3>
                  <p className="text-[10px] text-indigo-600 font-bold uppercase">{coordinator.role}</p>
                </div>
              </div>

              <div className="space-y-2.5 pt-4 border-t border-slate-50 text-xs text-slate-650">
                <a href={`tel:${coordinator.phone}`} className="flex items-center gap-2.5 hover:text-indigo-650 transition-colors">
                  <Phone className="w-4 h-4 text-indigo-500" />
                  <span>Call: {coordinator.phone}</span>
                </a>
                <a href={`mailto:${coordinator.email}`} className="flex items-center gap-2.5 hover:text-indigo-650 transition-colors">
                  <Mail className="w-4 h-4 text-indigo-500" />
                  <span>Email: {coordinator.email}</span>
                </a>
              </div>
            </div>

            {/* General Support contacts */}
            <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Support Channels</h2>
              
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Call Support</h4>
                    <p className="text-xs text-slate-500 mt-0.5">+91 98765 43210</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Email Support</h4>
                    <p className="text-xs text-slate-500 mt-0.5">support@interiorai.in</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Columns: Raise ticket & History */}
          <div className="lg:col-span-2 space-y-6">
            {/* Raise a ticket form */}
            <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-6">
              <div>
                <h2 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider">Raise a Support Ticket</h2>
                <p className="text-[10px] text-slate-400 mt-1">Our support agents respond within 2 hours.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select Project</label>
                    <select
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none text-slate-700 focus:ring-1 focus:ring-indigo-500 font-bold"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.property_name} ({p.city})</option>
                      ))}
                      <option value="general">General Query (No active project)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Subject</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sofa fabric design mismatch"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none text-slate-800 focus:ring-1 focus:ring-indigo-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Detailed Description</label>
                  <textarea
                    required
                    placeholder="Describe the support issue in detail..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none text-slate-800 focus:ring-1 focus:ring-indigo-500 resize-none font-medium"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-750 disabled:bg-indigo-400 text-white text-xs font-bold rounded-xl transition-all shadow-glow-indigo flex items-center gap-1.5 ml-auto"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSubmitting ? 'Submitting...' : 'Submit Support Ticket'}
                </button>
              </form>
            </div>

            {/* Support Tickets History logs */}
            <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4">
              <h2 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider border-b border-slate-50 pb-3">Ticket History</h2>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {tickets.map((t) => (
                  <div key={t.id} className="p-4 border border-slate-100 rounded-xl bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-extrabold text-xs text-slate-800">{t.subject}</h3>
                      <p className="text-xs text-slate-650 mt-1 leading-relaxed">{t.description}</p>
                      <p className="text-[9px] text-slate-400 mt-1.5 font-semibold">
                        Logged: {new Date(t.created_at).toLocaleString()}
                        {t.project_id && <span className="text-indigo-600 ml-1.5">• Linked to project</span>}
                      </p>
                    </div>

                    <div>
                      <span className={clsx(
                        'px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border',
                        t.status === 'resolved' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                          : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                      )}>
                        {t.status}
                      </span>
                    </div>
                  </div>
                ))}

                {tickets.length === 0 && (
                  <div className="text-center py-8 text-slate-400 font-semibold text-xs">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                    No support tickets submitted yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
