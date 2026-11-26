'use client'

import React, { useState, useEffect } from 'react'
import { Sparkles, ArrowDownUp } from 'lucide-react'

interface BeforeAfterSliderProps {
  beforeSrc?: string
  afterSrc?: string
  beforeLabel?: string
  afterLabel?: string
  className?: string
}

export default function BeforeAfterSlider({
  beforeSrc = '/images/showcase/before_flat.webp',
  afterSrc = '/images/showcase/after_flat.webp',
  beforeLabel = 'Earlier: Raw Builder Handover',
  afterLabel = 'Now: InteriorAI Modern Living',
  className = '',
}: BeforeAfterSliderProps) {
  // sliderPos sweeps from top (0%) to bottom (100%) and back continuously
  const [sliderPos, setSliderPos] = useState<number>(50)

  // Silky smooth automated scanning loop: top to bottom and bottom to top
  useEffect(() => {
    let startTime = performance.now()
    let animationFrameId: number

    const animateScan = (time: number) => {
      const elapsed = (time - startTime) / 1000 // in seconds
      // 11.5-second smooth, peaceful oscillating sine wave cycle
      const progress = (Math.sin((elapsed / 11.5) * Math.PI * 2 - Math.PI / 2) + 1) / 2
      const mapped = 6 + progress * 88 // sweeps smoothly between 6% and 94%
      setSliderPos(mapped)
      animationFrameId = requestAnimationFrame(animateScan)
    }

    animationFrameId = requestAnimationFrame(animateScan)
    return () => cancelAnimationFrame(animationFrameId)
  }, [])

  return (
    <section className={`w-full max-w-7xl mx-auto space-y-6 ${className}`}>
      {/* ── Section Header (Clean & Luxurious) ────────────────────────── */}
      <div className="text-center sm:text-left space-y-1">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#161D1A] tracking-tight">
          Every Bare Room Holds a Finished Masterpiece
        </h2>
      </div>

      {/* ── Main Showcase Rectangular Chassis (Automated Continuous Scan) ──── */}
      <div className="relative w-full h-[460px] sm:h-[560px] lg:h-[620px] rounded-[2.5rem] overflow-hidden border border-stone-200/90 shadow-[0_20px_50px_rgba(22,29,26,0.10)] select-none bg-[#0B0F0D]">
        {/* Layer 1: "Earlier" (Base Image - Raw Bare Flat) */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            src={beforeSrc}
            alt="Earlier: Raw developer apartment"
            className="w-full h-full object-cover origin-center scale-[1.03]"
          />
          {/* Subtle Slate Vignette on Earlier Base */}
          <div className="absolute inset-0 bg-stone-900/10 pointer-events-none" />
        </div>

        {/* Layer 2: "Now" (Top Reveal Layer - Fully Furnished Turnkey Flat) */}
        <div
          className="absolute inset-0 z-10 overflow-hidden pointer-events-none"
          style={{
            clipPath: `inset(0 0 ${100 - sliderPos}% 0)`,
          }}
        >
          <img
            src={afterSrc}
            alt="Now: InteriorAI Turnkey Masterpiece"
            className="w-full h-full object-cover origin-center scale-[1.03]"
          />
          {/* Subtle Luminous Ambient Warmth */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/15 pointer-events-none" />
        </div>

        {/* ── Top Badges: Earlier (Top Left) & Now (Top Right) ───────────── */}
        <div className="absolute top-6 inset-x-6 z-20 flex items-center justify-between pointer-events-none">
          <div className="px-4 py-2 rounded-2xl bg-black/60 backdrop-blur-md border border-white/20 text-white shadow-md text-xs font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-stone-400" />
            <span>{beforeLabel}</span>
          </div>

          <div className="px-4 py-2 rounded-2xl bg-[#161D1A]/85 backdrop-blur-md border border-[#84CC16]/40 text-white shadow-md text-xs font-extrabold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#84CC16] shadow-[0_0_8px_#84CC16]" />
            <span className="text-[#A3E635]">{afterLabel}</span>
          </div>
        </div>

        {/* ── Vertical Top-to-Down Automated Laser Divider Bar ───────────── */}
        <div
          className="absolute inset-x-0 z-30 pointer-events-none flex items-center justify-center"
          style={{
            top: `${sliderPos}%`,
          }}
        >
          {/* Glowing Horizontal Laser Line */}
          <div className="w-full h-1 bg-gradient-to-r from-transparent via-white to-transparent shadow-[0_0_16px_rgba(255,255,255,0.9)] opacity-95" />

          {/* Central Handle Pill with Dual Arrows */}
          <div className="absolute px-4 py-1.5 rounded-full bg-white text-[#161D1A] shadow-[0_8px_24px_rgba(0,0,0,0.35)] border border-stone-200/90 text-xs font-black flex items-center gap-2 pointer-events-none select-none">
            <ArrowDownUp className="w-3.5 h-3.5 text-[#84CC16] stroke-[3] animate-pulse" />
            <span className="tracking-wider uppercase text-[10px]">
              {sliderPos < 50 ? 'Turnkey Transformation' : 'Modular Reality'}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
