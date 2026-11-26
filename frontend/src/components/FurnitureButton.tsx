'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
import clsx from 'clsx'

export const STEP_BUTTON_IMAGES: Record<number, { src: string; alt: string; label: string; imgClass?: string }> = {
  0: { src: '/images/buttons/step_0.webp', alt: 'Property & Location - Next Step', label: 'Next Step', imgClass: 'scale-[1.03] -translate-x-[2%]' },
  1: { src: '/images/buttons/step_1.webp', alt: 'Scope & BHK - Next Step', label: 'Next Step' },
  2: { src: '/images/buttons/step_2.webp', alt: 'Budget & Timeline - Next Step', label: 'Next Step' },
  3: { src: '/images/buttons/step_3.webp', alt: 'Design Vibe - Next Step', label: 'Next Step' },
  4: { src: '/images/buttons/step_4.webp', alt: 'Material & Fabric - Next Step', label: 'Next Step', imgClass: 'scale-[0.95]' },
  5: { src: '/images/buttons/step_5.webp', alt: 'Colors - Find My Packages', label: 'Find My Packages' },
}

interface FurnitureButtonProps {
  children?: React.ReactNode
  href?: string
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  variant?: 'primary' | 'champagne' | 'outline' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  icon?: 'arrow' | 'sparkle' | 'none'
  stepIndex?: number
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  id?: string
}

export default function FurnitureButton({
  children,
  href,
  onClick,
  variant = 'primary',
  size = 'md',
  icon = 'arrow',
  stepIndex,
  className,
  disabled = false,
  type = 'button',
  id,
}: FurnitureButtonProps) {
  const router = useRouter()
  const [isPopping, setIsPopping] = useState(false)

  const isClaymorphicStep = typeof stepIndex === 'number' && STEP_BUTTON_IMAGES[stepIndex]

  const sizeClasses = {
    sm: 'px-4 py-2 text-xs gap-1.5',
    md: 'px-6 sm:px-7 py-2.5 sm:py-3 text-xs sm:text-sm font-extrabold gap-2',
    lg: 'px-8 sm:px-9 py-3 sm:py-3.5 text-sm sm:text-base font-extrabold gap-2.5',
  }[size]

  const variantClasses = {
    primary:
      'bg-gradient-to-r from-[#A3E635] via-[#94DB26] to-[#84CC16] text-[#0B0F0D] font-black shadow-[0_4px_16px_-2px_rgba(163,230,53,0.4)] hover:shadow-[0_8px_24px_-4px_rgba(163,230,53,0.55)] border border-lime-300/40',
    champagne:
      'bg-gradient-to-r from-[#E2B870] via-[#D8AD62] to-[#C59B4E] text-[#161D1A] font-black shadow-[0_4px_16px_-2px_rgba(226,184,112,0.35)] hover:shadow-[0_8px_24px_-4px_rgba(226,184,112,0.5)] border border-amber-200/50',
    outline:
      'bg-white/95 hover:bg-white text-[#161D1A] font-extrabold border border-stone-300 hover:border-[#84CC16] shadow-sm hover:shadow-md',
    dark:
      'bg-[#161D1A] text-white font-extrabold border border-white/15 hover:border-[#A3E635]/60 hover:shadow-[0_0_20px_rgba(163,230,53,0.25)] shadow-md',
  }[variant]

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || isPopping) return

    setIsPopping(true)

    setTimeout(() => {
      if (onClick) {
        onClick(e)
      }
      if (href) {
        router.push(href)
      } else {
        setTimeout(() => setIsPopping(false), 300)
      }
    }, 220)
  }

  // 1. If stepIndex matches an onboarding step: Render the true 3D claymorphic sculpted button asset!
  if (isClaymorphicStep) {
    const stepAsset = STEP_BUTTON_IMAGES[stepIndex]

    return (
      <motion.button
        id={id}
        type={type}
        disabled={disabled}
        onClick={handleClick}
        whileHover={disabled ? {} : { scale: 1.05, y: -2 }}
        whileTap={disabled ? {} : { scaleY: 0.94, y: 2 }}
        animate={
          isPopping
            ? {
                scaleY: [1, 0.91, 1.04, 1],
                y: [0, 3, -1, 0],
              }
            : {}
        }
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className={clsx(
          'relative inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#84CC16] focus-visible:ring-offset-2 rounded-2xl select-none transition-transform duration-200 cursor-pointer p-0 bg-transparent border-0',
          disabled && 'opacity-35 cursor-not-allowed pointer-events-none grayscale-[40%]',
          className
        )}
        aria-label={stepAsset.alt}
      >
        <div className="relative h-[70px] sm:h-[80px] md:h-[88px] w-auto inline-flex items-center justify-center filter drop-shadow-[0_10px_14px_rgba(22,29,26,0.22)] drop-shadow-[0_4px_10px_rgba(132,204,22,0.22)] hover:drop-shadow-[0_16px_22px_rgba(22,29,26,0.28)] hover:drop-shadow-[0_6px_16px_rgba(132,204,22,0.34)] transition-[filter] duration-200">
          <img
            src={stepAsset.src}
            alt={stepAsset.alt}
            className={clsx(
              'h-full w-auto max-w-[240px] object-contain block pointer-events-none select-none',
              stepAsset.imgClass
            )}
            draggable={false}
          />
        </div>
      </motion.button>
    )
  }

  // 2. Standard luxurious pill button for non-onboarding calls (hero CTA, etc.)
  return (
    <div className="relative inline-flex items-center group">
      <motion.button
        id={id}
        type={type}
        disabled={disabled}
        onClick={handleClick}
        animate={
          isPopping
            ? {
                scaleY: [1, 0.92, 1.05, 1],
                y: [0, 3, -1, 0],
              }
            : {}
        }
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        whileTap={{ scaleY: 0.94, y: 2 }}
        className={clsx(
          'relative z-10 inline-flex items-center justify-center font-sans tracking-wide rounded-full overflow-hidden select-none transition-all duration-200 cursor-pointer',
          sizeClasses,
          variantClasses,
          disabled && 'opacity-40 cursor-not-allowed pointer-events-none grayscale-[30%]',
          className
        )}
      >
        {/* Specular Cushion Highlight Sheen on Upper Half */}
        <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent pointer-events-none rounded-t-full" />

        {/* Tactile Cushion Seam Shadow Accent */}
        <span className="absolute inset-x-3 bottom-0.5 h-[1.5px] bg-black/15 rounded-full pointer-events-none" />

        {/* Button Content / Morph State */}
        <AnimatePresence mode="wait">
          {isPopping ? (
            <motion.div
              key="morphing"
              initial={{ scale: 0.8, opacity: 0, y: 3 }}
              animate={{ scale: 1.08, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="flex items-center gap-2 text-inherit font-black"
            >
              <span className="text-xs tracking-wider uppercase">Proceeding...</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              className="flex items-center gap-2.5 text-inherit"
            >
              <span className="leading-none">{children}</span>
              {icon === 'arrow' && <ArrowRight className="w-4 h-4 stroke-[2.5] flex-shrink-0" />}
              {icon === 'sparkle' && <Sparkles className="w-4 h-4 text-[#FDE047] flex-shrink-0" />}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  )
}
