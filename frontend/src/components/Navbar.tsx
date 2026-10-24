'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import { getSupabase } from '@/lib/supabase'
import {
  Home, LayoutDashboard, LogOut, Menu, X, Sparkles, BarChart3,
  User, Briefcase, HelpCircle, ChevronRight, ChevronDown
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'
import NotificationCenter from '@/components/NotificationCenter'

function getAvatarColor(name: string): string {
  const colors = [
    '#B85D3B', // Terracotta
    '#C5A059', // Champagne Bronze
    '#4E5B4B', // Muted Sage
    '#7A664E', // Warm Taupe
    '#9E4A2A', // Burnt Amber
    '#5C6B73', // Slate Slate
    '#8D5B4C', // Clay
  ]
  let hash = 0
  const str = name || 'User'
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function cleanDisplayName(name?: string): string {
  if (!name) return 'User'
  // Remove prefixes like "A." if user profile holds "A.Seeded"
  const cleaned = name.replace(/^([A-Za-z]\.)\s*/, '').trim()
  return cleaned.split(' ')[0] || cleaned || 'User'
}

export default function Navbar() {
  const { isLoggedIn, user, logout } = useAuthStore()
  const pathname = usePathname()
  const router = useRouter()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  const handleLogout = async () => {
    try {
      const supabase = getSupabase()
      if (supabase) {
        await supabase.auth.signOut()
      }
    } catch (err) {
      console.error('Supabase signOut error:', err)
    }
    localStorage.removeItem('access_token')
    localStorage.removeItem('active_role')
    logout()
    useProjectStore.getState().clearProject()
    window.location.href = '/'
  }

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Build role-aware navigation links
  const navLinks = [
    { href: '/', label: 'Home', icon: Home },
  ]

  if (isLoggedIn) {
    const role = user?.role || 'customer'
    if (role === 'admin') {
      navLinks.push({ href: '/admin', label: 'Admin Portal', icon: LayoutDashboard })
    } else if (role === 'enterprise') {
      navLinks.push({ href: '/enterprise/dashboard', label: 'Enterprise Portal', icon: LayoutDashboard })
    } else if (role === 'vendor') {
      navLinks.push({ href: '/vendor/dashboard', label: 'Vendor Hub', icon: Briefcase })
    } else if (role === 'team') {
      navLinks.push({ href: '/team', label: 'Project Team', icon: BarChart3 })
    } else {
      navLinks.push({ href: '/dashboard', label: 'Customer Portal', icon: LayoutDashboard })
    }
  }

  navLinks.push({ href: '/support', label: 'Support', icon: HelpCircle })

  const rawName = user?.name || 'User'
  const displayName = cleanDisplayName(rawName)
  const avatarBg = getAvatarColor(user?.email || rawName)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#E8DFD1]/80 backdrop-blur-xl bg-[#FAF6F0]/90 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Left: Brand Logo & Sliding Navigation Drawer */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group shrink-0">
              <div className="relative w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform">
                <img
                  src="/Logo.webp"
                  alt="InteriorAI Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    const fb = e.currentTarget.parentElement?.querySelector('.logo-fallback') as HTMLElement
                    if (fb) fb.style.display = 'flex'
                  }}
                />
                <div
                  className="logo-fallback hidden w-full h-full rounded-lg bg-gradient-to-br from-[#b85d3b] to-[#9c4a2a] items-center justify-center text-white shadow-xs"
                >
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <span className="text-stone-900 font-bold text-xl tracking-tight font-serif">
                Interior<span className="text-[#b85d3b]">AI</span>
              </span>
            </Link>

            {/* Sliding Drawer Trigger (Desktop) */}
            <div className="hidden md:flex items-center gap-2 pl-2">
              <button
                type="button"
                onClick={() => setDrawerOpen(!drawerOpen)}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border shadow-2xs active:scale-95",
                  drawerOpen
                    ? "bg-[#b85d3b] text-white border-[#b85d3b] ring-2 ring-[#b85d3b]/20"
                    : "bg-white/80 hover:bg-white text-stone-700 border-[#E8DFD1] hover:border-stone-400"
                )}
                title="Toggle navigation links"
              >
                <Menu className="w-3.5 h-3.5" />
                <span>Menu</span>
                <ChevronRight className={clsx("w-3.5 h-3.5 transition-transform duration-200", drawerOpen && "rotate-90")} />
              </button>

              {/* Sliding Links (Slide in/out smoothly) */}
              <AnimatePresence>
                {drawerOpen && (
                  <motion.div
                    initial={{ opacity: 0, x: -12, scaleX: 0.95 }}
                    animate={{ opacity: 1, x: 0, scaleX: 1 }}
                    exit={{ opacity: 0, x: -12, scaleX: 0.95 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="flex items-center gap-1 overflow-hidden"
                  >
                    {navLinks.map(({ href, label }) => {
                      const isActive = pathname === href
                      return (
                        <Link
                          key={href}
                          href={href}
                          className={clsx(
                            "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0",
                            isActive
                              ? "bg-[#b85d3b] text-white shadow-xs"
                              : "text-stone-700 hover:text-stone-900 hover:bg-stone-200/60"
                          )}
                        >
                          {label}
                        </Link>
                      )
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right: Notification Center & Profile Avatar Dropdown */}
          <div className="hidden md:flex items-center gap-3">
            {isLoggedIn ? (
              <div className="flex items-center gap-3">
                <NotificationCenter />

                {/* Profile Avatar Dropdown */}
                <div className="relative" ref={profileRef}>
                  <button
                    type="button"
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full bg-white/80 hover:bg-white border border-[#E8DFD1] hover:border-stone-400 transition shadow-2xs group"
                    aria-label="User profile menu"
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black shadow-xs shrink-0 transition-transform group-hover:scale-105"
                      style={{ backgroundColor: avatarBg }}
                    >
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-bold text-stone-800">{displayName}</span>
                    <ChevronDown className={clsx("w-3 h-3 text-stone-400 transition-transform duration-150", profileOpen && "rotate-180")} />
                  </button>

                  <AnimatePresence>
                    {profileOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-56 bg-[#FAF6F0] border border-[#E8DFD1] rounded-2xl shadow-xl p-2.5 space-y-1.5 z-50 text-left"
                      >
                        <div className="px-3 py-2 border-b border-[#E8DFD1]/70">
                          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Signed in as</p>
                          <p className="text-sm font-extrabold text-stone-900 truncate mt-0.5">{displayName}</p>
                          {user?.email && <p className="text-[10px] text-stone-500 truncate">{user.email}</p>}
                        </div>

                        <Link
                          href="/dashboard?edit=true"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-stone-700 hover:text-stone-900 hover:bg-white transition"
                        >
                          <User className="w-3.5 h-3.5 text-[#b85d3b]" />
                          <span>Edit Profile</span>
                        </Link>

                        <button
                          type="button"
                          onClick={() => {
                            setProfileOpen(false)
                            handleLogout()
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Logout</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="text-xs font-bold text-stone-700 hover:text-stone-900 transition px-3.5 py-2 rounded-xl hover:bg-stone-200/50"
                >
                  Sign In
                </Link>
                <Link
                  href="/login"
                  className="btn-primary text-xs py-2 px-4 shadow-sm font-bold rounded-xl"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden flex items-center gap-2">
            {isLoggedIn && <NotificationCenter />}
            <button
              className="text-stone-800 p-2 rounded-xl hover:bg-stone-200/50 transition"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle mobile menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden border-t border-[#E8DFD1] bg-[#FAF6F0]/98 backdrop-blur-xl"
          >
            <div className="px-4 py-4 space-y-2">
              {navLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-stone-700 hover:text-stone-900 hover:bg-stone-200/50 transition text-xs font-bold"
                >
                  <Icon className="w-4 h-4 text-[#b85d3b]" /> {label}
                </Link>
              ))}

              {isLoggedIn ? (
                <div className="pt-2 border-t border-[#E8DFD1]/70 space-y-2">
                  <div className="px-3 py-1 flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black"
                      style={{ backgroundColor: avatarBg }}
                    >
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-bold text-stone-900">{displayName}</span>
                  </div>
                  <Link
                    href="/dashboard?edit=true"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-stone-700 hover:text-stone-900 hover:bg-stone-200/50 transition text-xs font-bold"
                  >
                    <User className="w-4 h-4 text-[#b85d3b]" /> Edit Profile
                  </Link>
                  <button
                    onClick={() => { handleLogout(); setMobileOpen(false) }}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 transition text-xs font-bold"
                  >
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block w-full text-center btn-primary py-2.5 mt-2 text-xs font-bold rounded-xl"
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
