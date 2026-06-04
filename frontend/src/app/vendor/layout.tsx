'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, UserCheck, Briefcase, Bell, CreditCard, LogOut, ArrowLeft, ShoppingBag, Archive } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useVendorStore } from '@/stores/vendorStore'
import Navbar from '@/components/Navbar'

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isLoggedIn, user, logout } = useAuthStore()
  const { profile, loadOnboarding } = useVendorStore()

  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/login')
    } else {
      loadOnboarding()
    }
  }, [isLoggedIn, router, loadOnboarding])

  const navLinks = [
    { href: '/vendor/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/vendor/onboarding', label: 'KYC & Onboarding', icon: UserCheck },
    { href: '/vendor/products', label: 'Product Catalog', icon: ShoppingBag },
    { href: '/vendor/inventory', label: 'Inventory Log', icon: Archive },
    { href: '/vendor/assignments', label: 'Assignments', icon: Briefcase },
    { href: '/vendor/payouts', label: 'Payouts Log', icon: CreditCard },
  ]

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  if (!isLoggedIn) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Redirecting to login...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col">
      <Navbar />
      
      <div className="flex flex-1 pt-16">
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-white border-r border-slate-200/60 p-6 flex flex-col justify-between shadow-sm sticky top-16 h-[calc(100vh-4rem)]">
          <div>
            {/* Logo / Portal Brand */}
            <div className="flex items-center space-x-3 mb-8">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-150">
                <span className="font-bold text-lg">💡</span>
              </div>
              <div>
                <span className="font-extrabold text-sm text-slate-800 tracking-tight block">InteriorAI</span>
                <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider block">Vendor Hub</span>
              </div>
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
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span>{link.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* User Info & Footer */}
          <div className="space-y-4">
            <Link
              href="/dashboard"
              className="flex items-center justify-center space-x-2 w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Go to Customer Portal</span>
            </Link>

            <div className="border-t border-slate-150 pt-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                  {profile?.ownerName?.charAt(0) || user?.name?.charAt(0) || 'V'}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-700 truncate max-w-[110px]">
                    {profile?.ownerName || user?.name || 'Vendor Partner'}
                  </span>
                  <span className={`text-[9px] font-extrabold uppercase tracking-wide ${
                    profile?.status === 'APPROVED' ? 'text-emerald-600' : 'text-amber-500'
                  }`}>
                    {profile?.status || 'NOT REGISTERED'}
                  </span>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Workspace Panel */}
        <main className="flex-1 p-8 overflow-y-auto max-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </div>
    </div>
  )
}
