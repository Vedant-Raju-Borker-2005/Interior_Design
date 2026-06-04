'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import Navbar from '@/components/Navbar'
import { useAuthStore } from '@/stores/authStore'
import {
  Sparkles, ArrowRight, Star, CheckCircle2, Zap, Shield, Palette,
  LayoutGrid, Clock, Image as ImageIcon, FileText, Users
} from 'lucide-react'

const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&h=400&fit=crop&q=85',
  'https://images.unsplash.com/photo-1616137466211-f939a420be84?w=600&h=400&fit=crop&q=85',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=400&fit=crop&q=85',
  'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=600&h=400&fit=crop&q=85',
]

const STEPS = [
  { icon: LayoutGrid, title: 'Choose Your BHK', desc: 'Select 1–5 BHK and let us auto-configure your rooms.', color: 'bg-indigo-100 text-indigo-600' },
  { icon: Palette, title: 'Pick a Style Package', desc: 'Browse AI-recommended Basic, Premium, or Luxury packages.', color: 'bg-amber-100 text-amber-600' },
  { icon: Zap, title: 'Customise Room-by-Room', desc: 'Swap furniture, change colours/materials with live price updates.', color: 'bg-emerald-100 text-emerald-600' },
  { icon: ImageIcon, title: 'AI Visualisation', desc: 'Generate photo-realistic renders of your designed room in seconds.', color: 'bg-purple-100 text-purple-600' },
  { icon: FileText, title: 'Instant Quotation', desc: 'Download a professional PDF quote with GST, terms, and warranty.', color: 'bg-rose-100 text-rose-600' },
]

const FEATURES = [
  { icon: Sparkles, title: 'AI-Powered Renders', desc: 'Stable Diffusion XL + ControlNet. Generate photorealistic room visuals in under 15 seconds.' },
  { icon: Zap,       title: 'Real-Time Pricing', desc: 'Every customisation instantly reflects on your total. No surprises at checkout.' },
  { icon: Shield,    title: 'Verified Vendors',  desc: 'KYC-verified contractors with geo-matching and rating system for flawless execution.' },
  { icon: Clock,     title: '14-Week Delivery',  desc: 'End-to-end project tracking from design to site completion with milestone photos.' },
  { icon: Users,     title: 'Team Collaboration',desc: 'Invite family members to co-design in real-time with shared cursors and comments.' },
  { icon: Star,      title: 'Premium Catalog',   desc: '500+ curated products across furniture, flooring, lighting, and modular kitchen.' },
]

const TESTIMONIALS = [
  { name: 'Priya Mehta', city: 'Bangalore', rating: 5, text: 'Got my entire 3BHK designed in one afternoon! The AI renders looked exactly like the final result.', avatar: 'PM' },
  { name: 'Rahul Sharma', city: 'Mumbai', rating: 5, text: 'The quotation PDF was so professional my banker accepted it for a home loan application.', avatar: 'RS' },
  { name: 'Ananya Iyer', city: 'Chennai', rating: 5, text: 'Loved the Scandinavian package. The 3D room viewer made it so easy to explain to my husband.', avatar: 'AI' },
]

export default function LandingPage() {
  const { isLoggedIn } = useAuthStore()
  const ctaHref = isLoggedIn ? '/dashboard' : '/login'

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center overflow-hidden bg-hero-gradient">
        {/* Background grid */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)', backgroundSize: '32px 32px' }}
        />

        {/* Glow orbs */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-indigo-500 rounded-full blur-3xl opacity-20 animate-pulse-slow" />
        <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-amber-500 rounded-full blur-3xl opacity-10 animate-pulse-slow" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 pt-32 grid lg:grid-cols-2 gap-16 items-center">

          {/* Left: Text */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-sm font-medium mb-6"
            >
              <Sparkles className="w-4 h-4" />
              AI-Powered Interior Design • India&apos;s First
            </motion.div>

            <h1 className="text-5xl lg:text-6xl xl:text-7xl font-black text-white leading-tight mb-6">
              Design Your{' '}
              <span className="gradient-text">Dream Home</span>
              {' '}with AI
            </h1>

            <p className="text-lg text-indigo-200 leading-relaxed mb-8 max-w-lg">
              From BHK selection to photorealistic room renders — in under 10 minutes.
              Get an instant professional quotation and connect with verified contractors.
            </p>

            <div className="flex flex-wrap gap-4 mb-10">
              <Link href={ctaHref} id="hero-cta" className="btn-primary text-base px-8 py-4">
                Start Designing Free <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="#how-it-works" className="btn-secondary text-base px-8 py-4" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}>
                See How It Works
              </Link>
            </div>

            {/* Stats */}
            <div className="flex gap-8">
              {[
                { value: '50K+', label: 'Homes Designed' },
                { value: '500+', label: 'Products' },
                { value: '4.9★', label: 'App Rating' },
              ].map((s) => (
                <div key={s.label}>
                  <div className="text-2xl font-bold text-white">{s.value}</div>
                  <div className="text-xs text-indigo-300">{s.label}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right: Image mosaic */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="grid grid-cols-2 gap-4">
              {HERO_IMAGES.map((src, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className={`rounded-2xl overflow-hidden shadow-2xl ${i === 0 ? 'col-span-2 h-52' : 'h-40'}`}
                >
                  <img src={src} alt="Interior design showcase" className="w-full h-full object-cover" />
                </motion.div>
              ))}
            </div>

            {/* Floating badge */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="absolute -bottom-4 -left-4 glass rounded-2xl p-4 shadow-2xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/30 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">AI Render Ready</div>
                  <div className="text-indigo-300 text-xs">Generated in 8 seconds</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">From Idea to Reality in 5 Steps</h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Our guided flow walks you through everything — no interior design experience needed.
            </p>
          </div>

          <div className="grid md:grid-cols-5 gap-6">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative text-center"
              >
                <div className="flex flex-col items-center">
                  <div className={`w-14 h-14 rounded-2xl ${step.color} flex items-center justify-center mb-4 shadow-card`}>
                    <step.icon className="w-7 h-7" />
                  </div>
                  <div className="text-xs font-bold text-indigo-500 mb-1">STEP {i + 1}</div>
                  <div className="font-bold text-slate-800 mb-2">{step.title}</div>
                  <div className="text-sm text-slate-500 leading-relaxed">{step.desc}</div>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-7 left-[75%] w-[50%] h-0.5 bg-slate-200" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Everything You Need</h2>
            <p className="text-lg text-slate-500">Built for discerning homeowners across India.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="group p-6 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:shadow-card transition-all duration-300 bg-white"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-50 group-hover:bg-indigo-100 flex items-center justify-center mb-4 transition-colors">
                  <f.icon className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="font-bold text-slate-800 mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────────────────────── */}
      <section className="py-24 bg-indigo-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Loved by Homeowners Across India
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass rounded-2xl p-6"
              >
                <div className="flex items-center gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-white/80 text-sm leading-relaxed mb-4">&quot;{t.text}&quot;</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="text-white text-sm font-medium">{t.name}</div>
                    <div className="text-indigo-400 text-xs">{t.city}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="py-24 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 className="text-4xl font-bold mb-4">Ready to Design Your Dream Home?</h2>
          <p className="text-indigo-200 text-lg mb-8 max-w-xl mx-auto">
            Join 50,000+ homeowners who designed with InteriorAI. It&apos;s free to start.
          </p>
          <Link href={ctaHref} className="inline-flex items-center gap-2 bg-white text-indigo-700 font-bold px-10 py-4 rounded-2xl hover:bg-indigo-50 transition-all shadow-glow-indigo text-lg">
            Start for Free <ArrowRight className="w-5 h-5" />
          </Link>
          <div className="mt-6 flex justify-center gap-6 text-sm text-indigo-200">
            {['No credit card required', 'Instant quotation', 'Verified contractors'].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-300" />{t}
              </span>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-indigo-950 py-10 text-center text-indigo-400 text-sm">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span className="text-white font-bold">InteriorAI</span>
        </div>
        <p>© 2026 InteriorAI Platform. Built with ❤️ for Indian homeowners.</p>
      </footer>
    </div>
  )
}
