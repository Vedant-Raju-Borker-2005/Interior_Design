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
        className={`relative z-10 p-3 rounded-xl border border-[#E8DFD1] border-l-4 cursor-grab active:cursor-grabbing select-none transition-colors duration-200 ${
          n.read 
            ? 'bg-stone-50 border-l-stone-300 text-stone-500 hover:bg-stone-100' 
            : 'bg-white hover:bg-stone-50/80 border-l-[#b85d3b] shadow-xs text-stone-900'
        }`}
      >
        <div className="flex justify-between items-start gap-2">
          <h4 className={`font-bold text-xs ${n.read ? 'text-stone-600' : 'text-stone-900'}`}>
            {n.title}
          </h4>
          {!n.read && (
            <span className="w-2 h-2 bg-[#b85d3b] rounded-full flex-shrink-0 mt-1 shadow-xs" />
          )}
        </div>
        <p className={`text-[11px] mt-1 leading-relaxed ${n.read ? 'text-stone-400' : 'text-stone-600'}`}>
          {n.message}
        </p>
        <div className="text-[9px] text-stone-400 mt-1.5 font-medium flex items-center justify-between">
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
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-stone-600 hover:text-stone-900 transition-colors duration-200 focus:outline-none"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-[#b85d3b] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-bounce shadow-xs">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Transparent Click-Outside Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-transparent" 
          onClick={() => setIsOpen(false)} 
        />
      )}

      {isOpen && (
        <div className="absolute top-full right-0 w-[340px] mt-2 bg-[#FAF6F0] backdrop-blur-md shadow-2xl rounded-2xl border-2 border-[#E8DFD1] p-4 z-50 max-h-[420px] overflow-y-auto scrollbar-thin scrollbar-thumb-stone-300 scrollbar-track-transparent animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col gap-3">
          <div className="flex justify-between items-center pb-2.5 border-b border-[#E8DFD1]">
            <h3 className="font-extrabold text-stone-900 text-sm flex items-center gap-1.5">
              Notifications
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-[#faeae3] text-[#b85d3b] border border-[#f3d2c4] rounded-full">
                  {unreadCount} New
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllNotificationsRead()}
                className="text-[11px] font-bold text-[#b85d3b] hover:text-[#9c4b2c] transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="text-center py-8 text-stone-400 text-xs">
              <BellOff className="w-8 h-8 mx-auto mb-2 opacity-40 text-stone-400" />
              <p className="font-semibold text-stone-600">No notifications yet</p>
              <p className="text-[10px] text-stone-400 mt-0.5">Project and execution updates will appear here</p>
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
              <div className="text-[10px] text-stone-400 text-center pt-2 mt-1 border-t border-[#E8DFD1] select-none font-medium">
                Swipe left on a card to delete
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
