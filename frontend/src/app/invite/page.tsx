'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { enterpriseAPI } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import Navbar from '@/components/Navbar'
import toast from 'react-hot-toast'
import { CheckCircle2, ShieldCheck, Calendar, MapPin, Building, ArrowRight } from 'lucide-react'
import clsx from 'clsx'
import { Suspense } from 'react'

function InviteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams?.get('token')

  const { isLoggedIn } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [flatInfo, setFlatInfo] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)


  useEffect(() => {
    if (!token) {
      setErrorMsg("Invitation token is missing. Please check your link.")
      setLoading(false)
      return
    }

    enterpriseAPI.validateInvitation(token)
      .then(res => {
        setFlatInfo(res.data)
        setLoading(false)
      })
      .catch(err => {
        console.error("Token validation error:", err)
        setErrorMsg(err?.response?.data?.detail || "Invalid, expired, or revoked invitation token.")
        setLoading(false)
      })
  }, [token])

  const handleAccept = async () => {
    if (!token) return

    if (!isLoggedIn) {
      localStorage.setItem('inviteToken', token)
      toast.success("Please sign in with your phone number or email to claim your flat.")
      router.push(`/login?inviteToken=${token}`)
      return
    }

    setAccepting(true)
    try {
      const res = await enterpriseAPI.acceptInvitation(token)
      if (res.data.access_token && res.data.user) {
        localStorage.setItem('token', res.data.access_token)
        useAuthStore.getState().setUser(res.data.user)
      }
      toast.success("Invitation accepted! Welcome to your customer portal. 🎉")
      router.push(`/onboarding?inviteToken=${token}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to accept invitation. Please try again.")
    } finally {
      setAccepting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center pt-24 pb-16 px-4">
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
          
          <div className="bg-indigo-600 px-6 py-8 text-center text-white relative">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-indigo-800 opacity-90" />
            <div className="relative z-10 space-y-2">
              <div className="w-12 h-12 bg-white/25 rounded-full flex items-center justify-center mx-auto mb-3">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight">Flat Invitation</h2>
              <p className="text-indigo-100 text-xs">Secure B2B2C Project Configuration</p>
            </div>
          </div>

          <div className="p-6 md:p-8">
            {loading ? (
              <div className="text-center py-10">
                <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-500 text-sm">Verifying invitation details...</p>
              </div>
            ) : errorMsg ? (
              <div className="text-center py-6 space-y-4">
                <p className="text-red-500 font-bold text-sm bg-red-50 p-4 rounded-xl border border-red-100">{errorMsg}</p>
                <button 
                  onClick={() => router.push('/')}
                  className="text-xs text-indigo-600 font-bold hover:underline"
                >
                  Go to Homepage
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-slate-800 font-extrabold text-lg">
                    Hello, {flatInfo.customer_name}!
                  </h3>
                  <p className="text-slate-500 text-xs mt-1">You have been invited to configure your new modular interior space.</p>
                </div>

                <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                  <div className="flex items-center gap-3 text-slate-700">
                    <Building className="w-4 h-4 text-indigo-650 flex-shrink-0" />
                    <div className="text-xs">
                      <span className="text-slate-450 block text-[9px] uppercase font-bold tracking-wider">Development</span>
                      <span className="font-bold text-slate-800">{flatInfo.project_name}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-slate-700">
                    <MapPin className="w-4 h-4 text-indigo-650 flex-shrink-0" />
                    <div className="text-xs">
                      <span className="text-slate-450 block text-[9px] uppercase font-bold tracking-wider">Location</span>
                      <span className="font-bold text-slate-800">{flatInfo.city}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-slate-700">
                    <Building className="w-4 h-4 text-indigo-650 flex-shrink-0" />
                    <div className="text-xs">
                      <span className="text-slate-450 block text-[9px] uppercase font-bold tracking-wider">Unit / BHK</span>
                      <span className="font-bold text-slate-800">Flat {flatInfo.flat_number} ({flatInfo.bhk_type})</span>
                    </div>
                  </div>

                  {flatInfo.earliest_start_date && (
                    <div className="flex items-center gap-3 text-slate-700">
                      <Calendar className="w-4 h-4 text-indigo-650 flex-shrink-0" />
                      <div className="text-xs">
                        <span className="text-slate-450 block text-[9px] uppercase font-bold tracking-wider">Earliest Interior Work Start</span>
                        <span className="font-bold text-slate-800">{flatInfo.earliest_start_date}</span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="w-full btn-primary py-3.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2 shadow-lg"
                >
                  {accepting ? 'Configuring Space...' : (isLoggedIn ? 'Accept & Continue' : 'Sign In / Sign Up to Claim')}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    }>
      <InviteContent />
    </Suspense>
  )
}
