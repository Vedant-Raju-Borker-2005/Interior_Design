'use client'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '@/components/Navbar'
import { useAuthStore } from '@/stores/authStore'
import { useState, useEffect } from 'react'
import {
  Sparkles, ArrowRight, Star, CheckCircle2, Zap, Shield,
  Clock, Users, ChevronLeft, ChevronRight, LayoutGrid, Palette,
  Image as ImageIcon, FileText
} from 'lucide-react'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const VIBE_SLIDES = [
  {
    id: 'modern',
    name: 'Modern Minimalist',
    tagline: 'Clean architectural lines, neutral tones, and intentional negative space',
    image: '/images/hero/living_room_hero.webp',
    fallback: `${BACKEND_URL}/static/assets/catalog/design_vibe/Modern.webp`,
  },
  {
    id: 'scandinavian',
    name: 'Scandinavian Hygge',
    tagline: 'Light blonde oak, cozy boucle textures, and sunlit natural warmth',
    image: '/images/hero/bedroom_suite_hero.webp',
    fallback: `${BACKEND_URL}/static/assets/catalog/design_vibe/Scandinavian.webp`,
  },
  {
    id: 'japandi',
    name: 'Japandi Sanctuary',
    tagline: 'Wabi-sabi serenity, organic blonde wood, and artisan paper light',
    image: '/images/hero/japandi_hero.webp',
    fallback: `${BACKEND_URL}/static/assets/catalog/design_vibe/Japandi.webp`,
  },
  {
    id: 'indo_minimalistic',
    name: 'Indo-Minimalistic',
    tagline: 'Handcrafted teakwood, artisanal cane weave, and warm terracotta tones',
    image: '/images/hero/indo_minimalistic_hero.webp',
    fallback: `${BACKEND_URL}/static/assets/catalog/design_vibe/Indo_Minimalistic.webp`,
  },
]

const STEPS = [
  { icon: LayoutGrid, title: 'Choose Property & BHK', desc: 'Select your home structure and explore tailored architectural floor plans.', color: 'bg-[#faeae3] text-[#b85d3b]' },
  { icon: Palette, title: 'Select Materials & Fabrics', desc: 'Pick laminate finishes and fabric textures with real-time price tracking.', color: 'bg-[#f6f1e3] text-[#c5a059]' },
  { icon: Zap, title: 'Customise Room-by-Room', desc: 'Swap items, change attributes, and track budget variations in real time.', color: 'bg-[#e5eae4] text-[#4e5b4b]' },
  { icon: ImageIcon, title: '4-Wall AI Renders', desc: 'Visualize your curated rooms in photorealistic multi-angle perspectives.', color: 'bg-[#f5f2eb] text-[#7a664e]' },
  { icon: FileText, title: 'Quote & Execution', desc: 'Download bank-compliant PDF quotes and begin execution with verified teams.', color: 'bg-[#faeae3] text-[#b85d3b]' },
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
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isHovered, setIsHovered] = useState(false)

  // Auto-slide carousel every 5s with pause on hover
  useEffect(() => {
    if (isHovered) return
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % VIBE_SLIDES.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [isHovered])

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % VIBE_SLIDES.length)
  const prevSlide = () => setCurrentSlide((prev) => (prev === 0 ? VIBE_SLIDES.length - 1 : prev - 1))

  return (
    <div className="min-h-screen bg-[#faf8f5] text-stone-900">
      <Navbar />

      {/* ── Top Hero Slider (Cinematic Design Vibes Showcase) ────────────────── */}
      <section
        className="relative w-full h-[620px] sm:h-[700px] lg:h-[760px] overflow-hidden bg-stone-950 flex items-center justify-center pt-16"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Background Image Carousel with Smooth Cross-Fade */}
        <AnimatePresence mode="sync">
          <motion.div
            key={VIBE_SLIDES[currentSlide].id}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
            className="absolute inset-0 z-0"
          >
            <img
              src={VIBE_SLIDES[currentSlide].image}
              alt={VIBE_SLIDES[currentSlide].name}
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement
                if (!target.dataset.fallbackTried) {
                  target.dataset.fallbackTried = 'true'
                  target.src = VIBE_SLIDES[currentSlide].fallback
                }
              }}
              className="w-full h-full object-cover object-center"
            />
          </motion.div>
        </AnimatePresence>

        {/* Ambient Overlay for Crisp High-Contrast Legibility */}
        <div className="absolute inset-0 z-1 bg-gradient-to-b from-black/60 via-black/40 to-black/75 pointer-events-none" />

        {/* Left & Right Navigation Arrows */}
        <button
          type="button"
          onClick={prevSlide}
          aria-label="Previous slide"
          className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/40 hover:bg-black/70 text-white/80 hover:text-white backdrop-blur-md border border-white/20 flex items-center justify-center transition-all shadow-lg active:scale-95"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <button
          type="button"
          onClick={nextSlide}
          aria-label="Next slide"
          className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/40 hover:bg-black/70 text-white/80 hover:text-white backdrop-blur-md border border-white/20 flex items-center justify-center transition-all shadow-lg active:scale-95"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Centralized Hero Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-6">
          
          {/* Active Vibe Chip */}
          <motion.div
            key={`badge-${currentSlide}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/25 text-[#f4d1c3] text-xs font-bold tracking-wider uppercase shadow-md"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#e8c08a]" />
            <span>Design Vibe: {VIBE_SLIDES[currentSlide].name}</span>
          </motion.div>

          {/* Centralized Main Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-white tracking-tight font-serif drop-shadow-xl max-w-4xl mx-auto leading-[1.12]">
            Transform Your Home with{' '}
            <span className="bg-gradient-to-r from-[#f5d0b5] via-[#e8c08a] to-[#f0bc98] bg-clip-text text-transparent">
              Handcrafted Interiors
            </span>{' '}
            & Master Artisans
          </h1>

          {/* Streamlined Subtitle */}
          <p className="text-sm sm:text-base lg:text-lg text-white/90 max-w-2xl mx-auto font-medium leading-relaxed drop-shadow-md">
            Step into the future of interior architecture with interactive 3D spatial curation, transparent pricing, and turnkey execution.
          </p>

          {/* Centralized Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              href={ctaHref}
              id="hero-cta"
              className="px-8 py-3.5 bg-[#b85d3b] hover:bg-[#a04e30] text-white text-sm sm:text-base font-bold rounded-2xl shadow-xl transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Design My Home Free</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="#how-it-works"
              className="px-8 py-3.5 bg-white/15 hover:bg-white/25 backdrop-blur-md text-white text-sm sm:text-base font-bold border border-white/30 rounded-2xl shadow-md transition-all hover:border-white/50"
            >
              Explore Design Vibes
            </Link>
          </div>

          {/* Centralized Stats Bar */}
          <div className="grid grid-cols-3 gap-6 sm:gap-12 pt-6 border-t border-white/20 max-w-lg mx-auto text-center">
            {[
              { value: '50K+', label: 'Homes Designed' },
              { value: '500+', label: 'Curated Elements' },
              { value: '4.9★', label: 'Homeowner Rating' },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-2xl sm:text-3xl font-extrabold text-white font-serif drop-shadow-md">{s.value}</div>
                <div className="text-[11px] sm:text-xs text-white/75 font-medium mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

        </div>

        {/* Bottom Pagination Indicators */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          {VIBE_SLIDES.map((slide, idx) => (
            <button
              key={slide.id}
              onClick={() => setCurrentSlide(idx)}
              aria-label={`Go to slide ${slide.name}`}
              className={`h-2 rounded-full transition-all duration-300 ${
                currentSlide === idx ? 'w-8 bg-white shadow-md' : 'w-2 bg-white/40 hover:bg-white/70'
              }`}
            />
          ))}
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 bg-[#f4efe8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 mb-4 font-serif">From Idea to Reality in 5 Steps</h2>
            <p className="text-base text-stone-600 max-w-2xl mx-auto font-medium">
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
                className="relative text-center bg-white p-6 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col items-center">
                  <div className={`w-14 h-14 rounded-2xl ${step.color} flex items-center justify-center mb-4 shadow-sm`}>
                    <step.icon className="w-7 h-7" />
                  </div>
                  <div className="text-[11px] font-extrabold text-[#b85d3b] tracking-wider mb-1">STEP {i + 1}</div>
                  <div className="font-bold text-stone-900 text-sm mb-2">{step.title}</div>
                  <div className="text-xs text-stone-600 leading-relaxed font-medium">{step.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 bg-[#faf8f5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 mb-4 font-serif">Everything You Need</h2>
            <p className="text-base text-stone-600 font-medium">Built for discerning homeowners across India.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="group p-6 rounded-3xl border border-stone-200/90 hover:border-[#c5a059] hover:shadow-lg transition-all duration-300 bg-white"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#f4efe8] group-hover:bg-[#faeae3] flex items-center justify-center mb-4 transition-colors">
                  <f.icon className="w-6 h-6 text-[#b85d3b]" />
                </div>
                <h3 className="font-bold text-stone-900 text-base mb-2 font-serif">{f.title}</h3>
                <p className="text-stone-600 text-xs sm:text-sm leading-relaxed font-medium">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────────────────────── */}
      <section className="py-24 bg-[#f4eee5] border-t border-[#e6dcce]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 text-center mb-12 font-serif">
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
                className="bg-white border border-[#e6dcce] rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-[#c5a059] text-[#c5a059]" />
                  ))}
                </div>
                <p className="text-stone-700 text-sm leading-relaxed mb-5 font-medium">&quot;{t.text}&quot;</p>
                <div className="flex items-center gap-3 border-t border-stone-100 pt-3">
                  <div className="w-9 h-9 rounded-full bg-[#b85d3b] flex items-center justify-center text-white text-xs font-bold">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="text-stone-900 text-sm font-bold">{t.name}</div>
                    <div className="text-[#b85d3b] text-xs font-semibold">{t.city}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Refined Dark Charcoal / Black Footer ────────────────────────────── */}
      <footer className="bg-gradient-to-b from-[#1c1917] via-[#141210] to-[#0c0a09] py-14 text-center text-stone-400 text-sm border-t border-stone-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-[#e8c08a]" />
            <span className="text-stone-100 font-bold font-serif text-lg tracking-wide">
              Interior<span className="text-[#b85d3b]">AI</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-stone-400 font-medium">
            © 2026 InteriorAI Platform. Crafted with ❤️ for homeowners across India.
          </p>
        </div>
      </footer>
    </div>
  )
}
