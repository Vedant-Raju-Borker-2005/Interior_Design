'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import Navbar from '@/components/Navbar';
import { Briefcase, Users, Wrench, ArrowRight } from 'lucide-react';
import clsx from 'clsx';

export default function TeamWelcomePortal() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const role = user?.role || '';
  // Parse comma-separated roles into an exact list e.g. "customer,team_coordinator" → ["customer","team_coordinator"]
  const roleList = role.split(',').map((r: string) => r.trim());

  const cards = [
    {
      id: 'team_manager',
      title: 'Project Manager',
      description: 'Manage projects, assign teams, and oversee execution timelines.',
      icon: Briefcase,
      route: '/team/manager',
      color: 'indigo'
    },
    {
      id: 'team_coordinator',
      title: 'Project Coordinator',
      description: 'Track assigned projects, manage items, tasks, and resolve issues.',
      icon: Users,
      route: '/team/coordinator',
      color: 'emerald'
    },
    {
      id: 'team_technician',
      title: 'Technician / Installer',
      description: 'Update statuses for assigned items and upload proof of installation.',
      icon: Wrench,
      route: '/team/technician',
      color: 'amber'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-900 via-indigo-800 to-transparent opacity-90 z-0"></div>
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-pulse"></div>
      <div className="absolute top-32 -left-24 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-pulse" style={{ animationDelay: '2s' }}></div>
      
      <div className="relative z-10">
        <Navbar />

        <div className="max-w-6xl mx-auto px-4 pt-32 space-y-12">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-indigo-100 text-xs font-bold uppercase tracking-widest mb-6 backdrop-blur-md shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Workspace Access Control
            </div>
            <h1 className="text-5xl font-black text-white tracking-tight mb-6 drop-shadow-md">
              Welcome to the Team Portal
            </h1>
            <p className="text-indigo-100 text-lg font-medium max-w-2xl mx-auto drop-shadow-sm leading-relaxed">
              Select your assigned role to access your dedicated execution center. Your permissions determine which workspaces you can enter.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {cards.map((card) => {
              const Icon = card.icon;
              // Exact role match — prevents "team_coordinator" from accidentally enabling "team_manager"
              const isEnabled = roleList.includes(card.id) || roleList.includes('admin');
              
              return (
                <div 
                  key={card.id}
                  className={clsx(
                    'relative overflow-hidden rounded-3xl p-1 transition-all duration-500 flex flex-col h-full transform',
                    isEnabled 
                      ? `bg-gradient-to-br from-${card.color}-400 to-${card.color}-600 shadow-xl shadow-${card.color}-500/20 hover:-translate-y-2 hover:shadow-2xl hover:shadow-${card.color}-500/30 group`
                      : 'bg-slate-200 opacity-80 grayscale-[0.5]'
                  )}
                >
                  <div className="absolute inset-0 bg-white/40 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative h-full bg-white rounded-[22px] p-8 flex flex-col items-center text-center z-10">
                    <div className={clsx(
                      'w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-inner transition-transform duration-500',
                      isEnabled ? `bg-gradient-to-br from-${card.color}-50 to-${card.color}-100 text-${card.color}-600 group-hover:scale-110` : 'bg-slate-100 text-slate-400'
                    )}>
                      <Icon className="w-10 h-10" />
                    </div>
                    
                    <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">{card.title}</h3>
                    <p className="text-sm text-slate-500 flex-grow mb-10 leading-relaxed font-medium">{card.description}</p>
                    
                    <button
                      onClick={() => isEnabled && router.push(card.route)}
                      disabled={!isEnabled}
                      className={clsx(
                        'w-full py-4 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all mt-auto shadow-sm',
                        isEnabled 
                          ? `bg-${card.color}-600 hover:bg-${card.color}-700 text-white hover:shadow-lg hover:shadow-${card.color}-500/30`
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                      )}
                    >
                      {isEnabled ? (
                        <>
                          Enter Workspace <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </>
                      ) : (
                        'Access Restricted'
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
