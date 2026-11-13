'use client'

import React, { useState } from 'react'
import { usePathname } from 'next/navigation'
import { useToaster, toast, resolveValue, Toast } from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronDown, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'

export default function DynamicIslandToaster() {
  const pathname = usePathname() || '/'
  const { toasts, handlers } = useToaster()
  const { startPause, endPause } = handlers

  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Identify whether this route belongs to Admin, Vendor, or Project Team
  const isBackoffice = 
    pathname.startsWith('/admin') || 
    pathname.startsWith('/vendor') || 
    pathname.startsWith('/team')

  // Filter only visible toasts
  const activeToasts = toasts.filter((t) => t.visible)

  // ============================================================
  // FALLBACK: Backoffice Portals (Admin, Vendor, Team)
  // Retain the standard top-right toast behavior untouched
  // ============================================================
  if (isBackoffice) {
    return (
      <div 
        className="fixed top-[80px] right-[24px] z-[9999] flex flex-col gap-2 pointer-events-none"
        onMouseEnter={startPause}
        onMouseLeave={endPause}
      >
        <AnimatePresence>
          {activeToasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.15 } }}
              className={`pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-2xl shadow-[0_14px_34px_-4px_rgba(22,43,30,0.12),0_4px_12px_rgba(0,0,0,0.04)] backdrop-blur-md text-[13.5px] font-bold border ${
                t.type === 'error'
                  ? 'bg-white/95 text-[#991B1B] border-red-500/35 border-l-4 border-l-[#EF4444]'
                  : 'bg-white/95 text-[#132A1C] border-[#84CC16]/55 border-l-4 border-l-[#84CC16]'
              }`}
            >
              <span>{resolveValue(t.message, t)}</span>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="text-stone-400 hover:text-stone-700 p-0.5 rounded transition-colors"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    )
  }

  // ============================================================
  // CUSTOMER & ENTERPRISE: Dynamic Island & Cloudlet Floating Hub
  // Floating top-center adaptive pill, morphing & 3D stacking
  // Matches exact light luxury alabaster & luminous lime palette
  // ============================================================
  if (activeToasts.length === 0) return null

  // Inverted stack: index 0 is the foreground active island
  const foregroundToast = activeToasts[activeToasts.length - 1]
  const backgroundToasts = activeToasts.slice(0, activeToasts.length - 1).reverse()
  const isExpanded = expandedId === foregroundToast.id

  const rawMessage = String(resolveValue(foregroundToast.message, foregroundToast) || '')
  const isProcessing = 
    rawMessage.toLowerCase().includes('processing') || 
    rawMessage.toLowerCase().includes('verifying') || 
    rawMessage.toLowerCase().includes('generating') || 
    rawMessage.toLowerCase().includes('queued')

  const isError = foregroundToast.type === 'error'

  return (
    <div 
      className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center pointer-events-none max-w-[calc(100vw-32px)]"
      onMouseEnter={startPause}
      onMouseLeave={endPause}
    >
      <div className="relative flex flex-col items-center">
        
        {/* Layer 2 (Deepest Stack Card) */}
        {backgroundToasts.length >= 2 && (
          <div 
            className="absolute top-0 left-1/2 -translate-x-1/2 h-[42px] w-[80%] rounded-full bg-white/70 border border-[#84CC16]/25 shadow-md -translate-y-[-16px] scale-[0.88] opacity-40 pointer-events-none transition-all duration-300 z-10"
          />
        )}

        {/* Layer 1 (Immediate Underlay Card) */}
        {backgroundToasts.length >= 1 && (
          <div 
            className="absolute top-0 left-1/2 -translate-x-1/2 h-[42px] w-[90%] rounded-full bg-white/85 border border-[#84CC16]/35 shadow-md -translate-y-[-8px] scale-[0.94] opacity-70 pointer-events-none transition-all duration-300 z-20"
          />
        )}

        {/* Active Foreground Dynamic Island Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={foregroundToast.id}
            layout
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.9, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', stiffness: 520, damping: 32 }}
            className={`pointer-events-auto relative z-30 select-none overflow-hidden transition-all duration-300 ${
              isExpanded ? 'rounded-2xl w-[390px] max-w-[calc(100vw-32px)] p-4' : 'rounded-full px-4 py-2.5 cursor-pointer'
            } bg-white/97 backdrop-blur-xl border ${
              isError
                ? 'border-red-400/40 border-l-4 border-l-[#EF4444] shadow-[0_14px_34px_-4px_rgba(239,68,68,0.16),0_4px_12px_rgba(0,0,0,0.04)]'
                : 'border-[#84CC16]/45 border-l-4 border-l-[#84CC16] shadow-[0_14px_34px_-4px_rgba(22,43,30,0.14),0_4px_12px_rgba(0,0,0,0.04)]'
            }`}
            onClick={() => {
              if (!isExpanded) setExpandedId(foregroundToast.id)
            }}
          >
            {isExpanded ? (
              // ================= EXPANDED VIEW =================
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                      isError ? 'bg-red-100 text-red-600' : 'bg-[#84CC16]/20 text-[#365314]'
                    }`}>
                      {isProcessing ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#84CC16]" />
                      ) : isError ? (
                        <AlertCircle className="w-3.5 h-3.5" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#4D7C0F]" />
                      )}
                    </div>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-500">
                      InteriorAI Update
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpandedId(null)
                    }}
                    className="p-1 text-stone-400 hover:text-stone-700 rounded-md hover:bg-stone-100 transition-colors"
                    title="Collapse"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-[13px] font-bold text-[#132A1C] leading-snug">
                  {rawMessage}
                </div>

                {/* Pulsing micro-interaction progress bar */}
                {isProcessing && (
                  <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden mt-1 relative">
                    <div className="absolute top-0 left-0 h-full w-2/3 bg-gradient-to-r from-[#38BDF8] to-[#84CC16] rounded-full animate-pulse" />
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-stone-100/80 mt-1">
                  <span className="text-[10px] font-medium text-stone-400">
                    {backgroundToasts.length > 0 ? `+${backgroundToasts.length} more in stack` : 'Just now'}
                  </span>

                  {/* Clean Dismiss Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toast.dismiss(foregroundToast.id)
                      setExpandedId(null)
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    Dismiss
                  </button>
                </div>
              </div>
            ) : (
              // ================= COMPACT PILL VIEW =================
              <div className="flex items-center gap-2.5">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  isError 
                    ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' 
                    : 'bg-[#84CC16] shadow-[0_0_8px_rgba(132,204,22,0.6)] animate-pulse'
                }`} />

                <span className="text-[13px] font-bold text-[#132A1C] max-w-[280px] sm:max-w-[360px] truncate">
                  {rawMessage}
                </span>

                {backgroundToasts.length > 0 && (
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-[#84CC16]/20 text-[#365314] border border-[#84CC16]/30">
                    +{backgroundToasts.length}
                  </span>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toast.dismiss(foregroundToast.id)
                  }}
                  className="ml-1 p-0.5 text-stone-400 hover:text-stone-700 rounded transition-colors"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

      </div>
    </div>
  )
}
