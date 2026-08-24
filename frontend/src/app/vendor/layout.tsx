'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, UserCheck, Briefcase, Bell, CreditCard, LogOut, ShoppingBag, Archive, Menu, X, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useVendorStore } from '@/stores/vendorStore'
import Navbar from '@/components/Navbar'

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isLoggedIn, user, logout } = useAuthStore()
  const { profile, loadOnboarding } = useVendorStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/login')
    } else {
      loadOnboarding()
    }
  }, [isLoggedIn, router, loadOnboarding])

  // Close sidebar on navigation change
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  const navLinks = [
    { href: '/vendor/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/vendor/onboarding', label: 'KYC & Onboarding', icon: UserCheck },
    { href: '/vendor/products', label: 'Product Catalog', icon: ShoppingBag },
    { href: '/vendor/inventory', label: 'Inventory Log', icon: Archive },
    { href: '/vendor/assignments', label: 'Orders', icon: Briefcase },
    { href: '/vendor/payouts', label: 'Payouts Log', icon: CreditCard },
    { href: '/vendor/issues', label: 'Issues', icon: AlertCircle },
  ]

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  if (!isLoggedIn) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Redirecting to login...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col">
      <Navbar />

      <div className="flex flex-1 pt-16 relative">

        {/* ── Hamburger Toggle Button (always visible, fixed top-left on mobile) ── */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle navigation menu"
          className="lg:hidden fixed top-[4.5rem] left-4 z-50 p-2.5 bg-white border border-slate-200 rounded-xl shadow-md hover:bg-indigo-50 hover:border-indigo-200 transition-all duration-200"
        >
          {sidebarOpen
            ? <X className="w-5 h-5 text-indigo-600" />
            : <Menu className="w-5 h-5 text-slate-600" />
          }
        </button>

        {/* ── Backdrop overlay ── */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Sidebar ── */}
        <aside
          className={`
            fixed top-16 left-0 bottom-0 z-50 bg-white border-r border-slate-200/60 shadow-xl
            flex flex-col justify-between transition-all duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:translate-x-0 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:shadow-sm
            ${collapsed ? 'w-20 p-4' : 'w-64 p-6'}
          `}
        >
          <div>
            {/* Collapsible Toggle Header */}
            <div className={`flex mb-8 ${collapsed ? 'justify-center' : 'justify-end'}`}>
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="hidden lg:flex p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                title={collapsed ? "Expand Menu" : "Collapse Menu"}
              >
                <Menu className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="space-y-1">
              {navLinks.map((link) => {
                const active = pathname === link.href
                const Icon = link.icon
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${
                      active
                        ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/50'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent'
                    } ${collapsed ? 'justify-center px-0' : ''}`}
                    title={collapsed ? link.label : ''}
                  >
                    <Icon className={`w-4 h-4 min-w-[1rem] ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                    {!collapsed && <span className="transition-opacity duration-200 whitespace-nowrap">{link.label}</span>}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* User Info & Footer */}
          <div className="space-y-4">
            <div className="border-t border-slate-150 pt-4 flex items-center justify-between">
              <div className="flex items-center space-x-3 overflow-hidden">
                <div className="w-9 h-9 min-w-[2.25rem] rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                  {profile?.ownerName?.charAt(0) || user?.name?.charAt(0) || 'V'}
                </div>
                {!collapsed && (
                  <div className="flex flex-col text-left transition-opacity duration-200">
                    <span className="text-xs font-bold text-slate-700 truncate max-w-[110px]">
                      {profile?.ownerName || user?.name || 'Vendor Partner'}
                    </span>
                    <span className={`text-[9px] font-extrabold uppercase tracking-wide truncate max-w-[110px] ${
                      profile?.status === 'APPROVED' ? 'text-emerald-600' : 'text-amber-500'
                    }`}>
                      {profile?.status || 'NOT REGISTERED'}
                    </span>
                  </div>
                )}
              </div>

              {!collapsed && (
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
            {collapsed && (
              <button
                onClick={handleLogout}
                className="w-full flex justify-center p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </aside>

        {/* ── Main Workspace Panel ── */}
        <main className="flex-1 p-4 sm:p-8 overflow-y-auto lg:max-h-[calc(100vh-4rem)] pt-14 lg:pt-8">
          {children}
        </main>
      </div>
    </div>
  )
}
