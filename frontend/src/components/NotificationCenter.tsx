'use client'

import { useState, useEffect, useRef } from 'react'
import { useCustomerStore } from '@/stores/customerStore'
import { Bell, BellOff } from 'lucide-react'
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion'

interface NotificationCardProps {
  n: any
  onRead: () => void
  onDelete: () => void
}

function NotificationCard({ n, onRead, onDelete }: NotificationCardProps) {
  const x = useMotionValue(0)
  
  // Drag threshold in pixels (swiping left past -100px triggers delete)
  const threshold = -100

  const handleDragEnd = () => {
    const currentX = x.get()
    if (currentX < threshold) {
      onDelete()
    } else {
      // Force spring-back animation to return the card to the original position
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 })
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ 
        x: -360, 
        opacity: 0, 
        height: 0, 
        paddingTop: 0, 
        paddingBottom: 0, 
        marginTop: 0, 
        marginBottom: 0,
        transition: { duration: 0.2, ease: 'easeOut' }
      }}
      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      className="relative rounded-xl"
    >
      {/* Draggable Notification Card */}
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ right: 0, left: -320 }}
        dragElastic={{ right: 0.05, left: 0.6 }}
        style={{ x }}
        onDragEnd={handleDragEnd}
        onTap={() => {
          if (!n.read) {
            onRead()
          }
        }}
        className={`relative z-10 p-3 rounded-xl border border-white/5 border-l-4 cursor-grab active:cursor-grabbing select-none transition-colors duration-250 ${
          n.read 
            ? 'bg-[#0f1129]/95 border-l-indigo-950 text-indigo-300/80 hover:bg-[#131633]' 
            : 'bg-[#14183d]/90 hover:bg-[#1a1f4e] border-l-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.06)]'
        }`}
      >
        <div className="flex justify-between items-start gap-2">
          <h4 className={`font-bold text-xs ${n.read ? 'text-indigo-300/70' : 'text-white'}`}>
            {n.title}
          </h4>
          {!n.read && (
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full flex-shrink-0 mt-1 shadow-sm" />
          )}
        </div>
        <p className={`text-[11px] mt-1 leading-relaxed ${n.read ? 'text-indigo-300/50' : 'text-indigo-200'}`}>
          {n.message}
        </p>
        <div className="text-[9px] text-indigo-400/80 mt-1.5 font-medium flex items-center justify-between">
          <span>{new Date(n.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function NotificationCenter() {
  const { 
    notifications, 
    fetchNotifications, 
    markNotificationRead, 
    markAllNotificationsRead,
    deleteNotification
  } = useCustomerStore()
  const [isOpen, setIsOpen] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchNotifications()
    const timer = setInterval(() => {
      fetchNotifications()
    }, 15000) // poll every 15s
    return () => clearInterval(timer)
  }, [fetchNotifications])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 hover:text-white transition-colors duration-250 focus:outline-none"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-bounce shadow">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 w-[340px] mt-3 bg-gradient-to-b from-[#0b0c1d]/95 to-[#070814]/95 backdrop-blur-md shadow-[0_20px_50px_rgba(5,7,18,0.9)] rounded-2xl border border-indigo-950/80 p-4 z-50 max-h-[420px] overflow-y-auto scrollbar-thin scrollbar-thumb-indigo-950/70 scrollbar-track-transparent animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col gap-3">
          <div className="flex justify-between items-center pb-2 border-b border-indigo-900/40">
            <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
              Notifications
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-indigo-500/20 text-indigo-400 rounded-full">
                  {unreadCount} New
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllNotificationsRead()}
                className="text-[11px] font-semibold text-indigo-400 hover:text-white transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="text-center py-8 text-indigo-400/40 text-xs">
              <BellOff className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 flex-1 max-h-[300px] overflow-y-auto pr-1">
                <AnimatePresence initial={false}>
                  {notifications.map((n) => (
                    <NotificationCard
                      key={n.id}
                      n={n}
                      onRead={() => markNotificationRead(n.id)}
                      onDelete={() => deleteNotification(n.id)}
                    />
                  ))}
                </AnimatePresence>
              </div>
              <div className="text-[10px] text-indigo-400/40 text-center pt-2 mt-1 border-t border-indigo-950/80 select-none font-medium">
                Swipe left on a card to delete
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
