'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { Home, LayoutDashboard, LogOut, Menu, X, Sparkles, BarChart3, User, Briefcase } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'

import NotificationCenter from '@/components/NotificationCenter'

export default function Navbar() {
  const { isLoggedIn, user, logout } = useAuthStore()
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navLinks = [
    { href: '/', label: 'Home', icon: Home },
  ]

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 backdrop-blur-xl bg-indigo-950/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-glow-indigo">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-xl tracking-tight">
              Interior<span className="text-indigo-400">AI</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  pathname === href
                    ? 'bg-indigo-600 text-white'
                    : 'text-indigo-200 hover:text-white hover:bg-white/10'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Auth buttons */}
          <div className="hidden md:flex items-center gap-3">
            {isLoggedIn ? (
              <div className="flex items-center gap-4">


                <NotificationCenter />
                <div className="text-sm text-indigo-200 flex items-center gap-1">
                  <span>Hey,</span>
                  <Link 
                    href="/dashboard?edit=true" 
                    className="text-white font-semibold hover:text-indigo-300 hover:underline transition-all"
                    title="Click to edit profile"
                  >
                    {user?.name?.split(' ')[0] || 'User'}
                  </Link>
                </div>
                <Link 
                  href="/dashboard?edit=true"
                  className="text-xs text-indigo-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1 rounded-md transition-all font-medium"
                >
                  Edit Profile
                </Link>
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-300 hover:text-white rounded-lg hover:bg-white/10 transition-all"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            ) : (
              <>
                <Link href="/login" className="text-sm text-indigo-200 hover:text-white transition px-3 py-2">
                  Sign In
                </Link>
                <Link href="/login" className="btn-primary text-sm py-2 px-5">
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-white p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden border-t border-white/10 bg-indigo-950/95"
          >
            <div className="px-4 py-4 space-y-2">
              {navLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-indigo-200 hover:text-white hover:bg-white/10 transition"
                >
                  <Icon className="w-4 h-4" /> {label}
                </Link>
              ))}
              {isLoggedIn ? (
                <>
                  {/* Mobile Role Switcher */}
                  <div className="border-t border-white/10 pt-2 pb-1">
                    <span className="block px-3 py-1.5 text-[9px] font-bold text-indigo-300 uppercase tracking-wider">Switch Portal View</span>
                    <div className="grid grid-cols-2 gap-2 px-3 pb-2.5">
                      {[
                        { val: 'customer', label: 'Customer', path: '/dashboard' },
                        { val: 'vendor', label: 'Vendor Hub', path: '/vendor/dashboard' },
                        { val: 'team', label: 'Project Team', path: '/team' },
                        { val: 'admin', label: 'Admin', path: '/admin' },
                      ].map((item) => {
                        const active = (item.val === 'admin' && pathname.startsWith('/admin')) ||
                                       (item.val === 'vendor' && pathname.startsWith('/vendor')) ||
                                       (item.val === 'team' && pathname.startsWith('/team')) ||
                                       (item.val === 'customer' && !pathname.startsWith('/admin') && !pathname.startsWith('/vendor') && !pathname.startsWith('/team'))
                        return (
                          <button
                            key={item.val}
                            onClick={() => {
                              router.push(item.path)
                              setMobileOpen(false)
                            }}
                            className={clsx(
                              'py-2 px-2.5 rounded-lg text-xs font-bold text-center border text-white transition',
                              active
                                ? 'bg-indigo-600 border-indigo-500'
                                : 'bg-indigo-900 border-white/10 hover:bg-indigo-800'
                            )}
                          >
                            {item.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <Link
                    href="/dashboard?edit=true"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-indigo-200 hover:text-white hover:bg-white/10 transition"
                  >
                    <User className="w-4 h-4" /> Edit Profile
                  </Link>
                  <button
                    onClick={() => { logout(); setMobileOpen(false) }}
                    className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-indigo-300 hover:text-white hover:bg-white/10 transition"
                  >
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block w-full text-center btn-primary py-2.5 mt-2"
                >
                  Get Started Free
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
