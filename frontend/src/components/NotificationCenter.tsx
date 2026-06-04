'use client'

import { useState, useEffect } from 'react'
import { useCustomerStore } from '@/stores/customerStore'
import { Bell, BellOff, CheckCircle } from 'lucide-react'

export default function NotificationCenter() {
  const { notifications, fetchNotifications, markNotificationRead, markAllNotificationsRead } = useCustomerStore()
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    fetchNotifications()
    const timer = setInterval(() => {
      fetchNotifications()
    }, 15000) // poll every 15s
    return () => clearInterval(timer)
  }, [fetchNotifications])

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="relative">
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
        <div className="absolute top-full right-0 w-80 mt-3 bg-indigo-950/95 backdrop-blur-md shadow-2xl rounded-2xl border border-indigo-850 p-4 z-50 max-h-[400px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-indigo-900/60">
            <h3 className="font-bold text-white text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllNotificationsRead()}
                className="text-[11px] font-semibold text-indigo-300 hover:text-white transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="text-center py-6 text-indigo-300/60 text-xs">
              <BellOff className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.read && markNotificationRead(n.id)}
                  className={`p-2.5 rounded-xl border-l-4 cursor-pointer transition-all duration-200 ${
                    n.read ? 'bg-indigo-950/40 border-indigo-900/30' : 'bg-indigo-900/40 hover:bg-indigo-900/60 border-indigo-500'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <h4 className={`font-bold text-xs ${n.read ? 'text-indigo-200' : 'text-white'}`}>{n.title}</h4>
                    {!n.read && (
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full flex-shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-xs text-indigo-200 mt-1 leading-relaxed">{n.message}</p>
                  <div className="text-[9px] text-indigo-400 mt-1.5 font-medium">
                    {new Date(n.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
