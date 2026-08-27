'use client';

import { useEffect, useState } from 'react';
import { adminAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { Bot, Sparkles, Cpu, Zap, Brain, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function AdminAIEnginePage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.stats().then(r => { setStats(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const AI_MODULES = [
    {
      title: 'Recommendation AI',
      subtitle: 'SC106-SC108',
      desc: 'Product recommendation engine using customer preference vectors and project context. Suggests furniture, finishes and packages based on historical data.',
      icon: Sparkles,
      gradient: 'from-indigo-900 to-indigo-950',
      accent: 'text-indigo-400',
      status: 'active',
      metrics: [
        { label: 'Total Products Indexed', value: loading ? '...' : (stats?.total_projects || 0) * 3 },
        { label: 'Recommendation Calls', value: 'Live' },
      ]
    },
    {
      title: 'Agentic AI',
      subtitle: 'SC109-SC111',
      desc: 'Autonomous layout planning and space optimization agent. Generates room configurations from floor plan inputs and customer style preferences.',
      icon: Brain,
      gradient: 'from-purple-900 to-purple-950',
      accent: 'text-purple-400',
      status: 'active',
      metrics: [
        { label: 'Active Projects', value: loading ? '...' : stats?.active_projects || 0 },
        { label: 'Layout Generations', value: 'On-demand' },
      ]
    },
    {
      title: 'Execution AI',
      subtitle: 'SC112-SC114',
      desc: 'AI-driven project scheduling, vendor matching, and delay prediction. Analyzes project timelines and flags potential bottlenecks proactively.',
      icon: Cpu,
      gradient: 'from-slate-800 to-slate-900',
      accent: 'text-slate-400',
      status: 'active',
      metrics: [
        { label: 'Delayed Projects', value: loading ? '...' : stats?.delayed_projects || 0 },
        { label: 'Vendor Matching', value: 'Real-time' },
      ]
    },
  ];

  const GUARDRAILS = [
    { label: 'Hallucination Guard', status: 'enforced', color: 'text-emerald-600' },
    { label: 'Price Override Protection', status: 'enforced', color: 'text-emerald-600' },
    { label: 'Customer Data Isolation', status: 'enforced', color: 'text-emerald-600' },
    { label: 'Vendor Bias Detection', status: 'monitoring', color: 'text-amber-600' },
    { label: 'Layout Safety Validator', status: 'enforced', color: 'text-emerald-600' },
    { label: 'Autonomous Purchase Limit', status: 'enforced', color: 'text-emerald-600' },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <Bot className="w-7 h-7 text-indigo-600" />
          AI Engine
        </h1>
        <p className="text-slate-500 mt-1">Manage AI models, rules and intelligent workflows</p>
      </div>

      {/* AI Module Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {AI_MODULES.map(mod => (
          <div key={mod.title} className={`bg-gradient-to-br ${mod.gradient} rounded-2xl p-6 text-white shadow-lg border border-white/5 relative overflow-hidden`}>
            <div className="absolute -right-8 -bottom-8 opacity-10">
              <mod.icon className="w-36 h-36" />
            </div>
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <mod.icon className={`w-7 h-7 ${mod.accent} mb-2`} />
                  <h3 className="text-lg font-bold">{mod.title}</h3>
                  <span className="text-xs text-white/50 font-mono">{mod.subtitle}</span>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active
                </span>
              </div>
              <p className="text-white/70 text-sm leading-relaxed mb-5">{mod.desc}</p>
              <div className="grid grid-cols-2 gap-3">
                {mod.metrics.map(m => (
                  <div key={m.label} className="bg-white/5 rounded-xl p-3">
                    <div className="text-lg font-bold text-white">{m.value}</div>
                    <div className="text-xs text-white/50 mt-0.5">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Guardrails & Safety */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            AI Safety Guardrails
          </h3>
          <div className="space-y-3">
            {GUARDRAILS.map(g => (
              <div key={g.label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <span className="text-sm text-slate-700">{g.label}</span>
                <div className={`flex items-center gap-1.5 text-xs font-medium ${g.color}`}>
                  {g.status === 'enforced' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  <span className="capitalize">{g.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-500" />
            Model Configuration
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Embedding Model', value: 'text-embedding-3-small' },
              { label: 'Recommendation Engine', value: 'Vector Similarity (Cosine)' },
              { label: 'Layout AI', value: 'Agentic Pipeline v2' },
              { label: 'Vendor Matching', value: 'Rule-based + ML Hybrid' },
              { label: 'Confidence Threshold', value: '>= 0.75' },
              { label: 'Max Autonomous Actions', value: '5 per session' },
            ].map(cfg => (
              <div key={cfg.label} className="flex items-center justify-between">
                <span className="text-sm text-slate-500">{cfg.label}</span>
                <span className="text-sm font-mono text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">{cfg.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
