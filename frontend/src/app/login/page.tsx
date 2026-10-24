'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { authAPI, enterpriseAPI, projectsAPI } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import toast from 'react-hot-toast'
import {
  Sparkles,
  Phone,
  Mail,
  Lock,
  ArrowRight,
  RefreshCw,
  MapPin,
  User,
  Compass,
  HelpCircle,
  Check,
  Info,
  Briefcase,
  Wrench,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import Link from 'next/link'
import clsx from 'clsx'

type FormMode = 'signin' | 'signup'
type VerificationStep = 'form' | 'otp'
type LoginMethod = 'phone' | 'email'

const CITIES = ['Bangalore', 'Mumbai', 'Delhi', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad', 'Other']

export default function LoginPage() {
  const router = useRouter()
  const { setToken } = useAuthStore()

  // Prevent duplicate concurrent Supabase session sync calls and stacked toasts
  const isSyncingRef = useRef(false)

  // Developer Mode toggle: false by default for clean user experience
  const [isDevMode, setIsDevMode] = useState(false)

  // Standard Mode Fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signupName, setSignupName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [isResetMode, setIsResetMode] = useState(false)

  // Dev Mode Fields & Roles
  const [mode, setMode] = useState<FormMode>('signin')
  const [step, setStep] = useState<VerificationStep>('form')
  const [method, setMethod] = useState<LoginMethod>('phone')
  const [loading, setLoading] = useState(false)
  const [devOtp, setDevOtp] = useState('')
  const [portalGroup, setPortalGroup] = useState<'client' | 'vendor' | 'team' | 'consultant' | 'admin'>('client')
  const [clientRole, setClientRole] = useState<'customer' | 'enterprise'>('customer')
  const [teamRole, setTeamRole] = useState<'team_manager' | 'team_coordinator' | 'team_technician'>('team_manager')

  // Dev Form Fields
  const [contact, setContact] = useState('+919900004444')
  const [devName, setDevName] = useState('Seeded Customer')
  const [devCity, setDevCity] = useState('Bangalore')
  const [furnishingPreference, setFurnishingPreference] = useState<'new' | 'upgrade'>('new')
  const [otp, setOtp] = useState('')

  // Check Supabase session on mount (for OAuth redirect / email confirmation link)
  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) return

    const handleSession = async (session: any) => {
      if (!session?.user || isSyncingRef.current) return
      isSyncingRef.current = true
      try {
        setLoading(true)
        const userEmail = session.user.email || ''
        const userName =
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.name ||
          userEmail.split('@')[0] ||
          'Customer'

        const res = await authAPI.supabaseSync({
          supabase_id: session.user.id,
          email: userEmail,
          name: userName,
          role: 'customer',
        })

        setToken(res.data.access_token, res.data.user_id, res.data.role)
        localStorage.setItem('active_role', res.data.role)
        useProjectStore.getState().clearProject()
        await useAuthStore.getState().fetchMe()

        toast.success(`Welcome to InteriorAI, ${userName}! 👋`, { id: 'supabase-welcome' })
        await navigateAfterLogin(res.data.role)
      } catch (err: any) {
        console.error('Supabase session sync error:', err)
        isSyncingRef.current = false
        toast.error('Failed to sync session with platform')
      } finally {
        setLoading(false)
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        handleSession(session)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        handleSession(session)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const navigateAfterLogin = async (role: string) => {
    if (role === 'vendor') {
      router.push('/vendor/dashboard')
    } else if (role === 'consultant') {
      router.push('/consultant')
    } else if (role.startsWith('team_')) {
      router.push('/team')
    } else if (role === 'admin') {
      router.push('/admin')
    } else if (role === 'enterprise' || role.includes('enterprise')) {
      router.push('/enterprise/dashboard')
    } else {
      const token = localStorage.getItem('inviteToken') || new URLSearchParams(window.location.search).get('inviteToken')
      if (token) {
        try {
          await enterpriseAPI.acceptInvitation(token)
          localStorage.removeItem('inviteToken')
          toast.success('Invitation accepted! Proceeding to onboarding. 🏠')
          router.push(`/onboarding?inviteToken=${token}`)
          return
        } catch (acceptErr) {
          console.error('Failed to accept invitation on login:', acceptErr)
        }
      }
      try {
        const projRes = await projectsAPI.list()
        const projects = Array.isArray(projRes.data?.projects)
          ? projRes.data.projects
          : (Array.isArray(projRes.data) ? projRes.data : [])
        if (projects.length === 0) {
          router.push('/onboarding')
          return
        }
      } catch (projErr) {
        console.error('Failed to check existing projects on login:', projErr)
      }
      router.push('/dashboard')
    }
  }

  // ── Standard Supabase Auth Handlers ─────────────────────────────────────────

  const handleStandardSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) return toast.error('Please enter your email')
    if (!password) return toast.error('Please enter your password')

    const supabase = getSupabase()
    if (!supabase) {
      toast.error('Supabase key is not configured. Please switch to Developer Mode on top.')
      setIsDevMode(true)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      })

      if (error) {
        if (error.message.toLowerCase().includes('email not confirmed')) {
          setVerificationSent(true)
          toast.error('Please confirm your email address before signing in.')
          return
        }
        throw error
      }

      if (data?.session && data?.user) {
        const userName =
          data.user.user_metadata?.full_name ||
          data.user.user_metadata?.name ||
          cleanEmail.split('@')[0]

        const syncRes = await authAPI.supabaseSync({
          supabase_id: data.user.id,
          email: cleanEmail,
          name: userName,
          role: 'customer',
        })

        setToken(syncRes.data.access_token, syncRes.data.user_id, syncRes.data.role)
        localStorage.setItem('active_role', syncRes.data.role)
        useProjectStore.getState().clearProject()
        await useAuthStore.getState().fetchMe()

        toast.success(`Welcome back, ${userName}! 👋`)
        await navigateAfterLogin(syncRes.data.role)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to sign in. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const handleStandardSignUp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const cleanEmail = email.trim().toLowerCase()
    const cleanName = signupName.trim()

    if (!cleanName) return toast.error('Please enter your full name')
    if (!cleanEmail) return toast.error('Please enter your email')
    if (!password || password.length < 6) return toast.error('Password must be at least 6 characters')

    const supabase = getSupabase()
    if (!supabase) {
      toast.error('Supabase key is not configured. Please switch to Developer Mode on top.')
      setIsDevMode(true)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
            name: cleanName,
          },
          emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined,
        },
      })

      if (error) throw error

      if (data?.session && data?.user) {
        // Auto-confirmed session
        const syncRes = await authAPI.supabaseSync({
          supabase_id: data.user.id,
          email: cleanEmail,
          name: cleanName,
          role: 'customer',
        })

        setToken(syncRes.data.access_token, syncRes.data.user_id, syncRes.data.role)
        localStorage.setItem('active_role', syncRes.data.role)
        useProjectStore.getState().clearProject()
        await useAuthStore.getState().fetchMe()

        toast.success('Account created successfully! 🎉')
        await navigateAfterLogin(syncRes.data.role)
      } else {
        // Email confirmation link required
        setVerificationSent(true)
        toast.success('Verification link sent to your email!')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleAuth = async () => {
    const supabase = getSupabase()
    if (!supabase) {
      toast.error('Supabase key is not configured. Please switch to Developer Mode on top.')
      setIsDevMode(true)
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      })
      if (error) throw error
    } catch (err: any) {
      toast.error(err?.message || 'Failed to authenticate with Google')
      setLoading(false)
    }
  }

  const handleResetPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) return toast.error('Please enter your email')

    const supabase = getSupabase()
    if (!supabase) {
      toast.error('Supabase key is not configured.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/login?reset=true`,
      })
      if (error) throw error
      setResetSent(true)
      toast.success('Password reset instructions sent to your email!')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send reset link')
    } finally {
      setLoading(false)
    }
  }

  // ── Developer Mode Role & Contact Helpers ────────────────────────────────────

  const getActiveRole = (group = portalGroup, cRole = clientRole, tRole = teamRole) => {
    if (group === 'client') return cRole
    if (group === 'team') return tRole
    return group
  }

  const getPrefilledContact = (group: string, cRole: string, tRole: string, currentMethod: 'phone' | 'email') => {
    const activeRole = group === 'client' ? cRole : group === 'team' ? tRole : group
    if (currentMethod === 'phone') {
      if (activeRole === 'customer') return '+919900004444'
      if (activeRole === 'vendor') return '+919900001111'
      if (activeRole.startsWith('team')) return '+919900002222'
      if (activeRole === 'admin') return '+919900003333'
      if (activeRole === 'enterprise') return '+919900005555'
    } else {
      if (activeRole === 'customer') return 'customer@example.com'
      if (activeRole === 'vendor') return 'vendor@example.com'
      if (activeRole.startsWith('team')) return 'team@example.com'
      if (activeRole === 'admin') return 'admin@example.com'
      if (activeRole === 'enterprise') return 'enterprise@example.com'
    }
    return ''
  }

  const handleDevSendOtp = async () => {
    const sanitizedContact = contact.trim().replace(/\s+/g, '')
    if (!sanitizedContact) {
      return toast.error(method === 'phone' ? 'Please enter your phone number' : 'Please enter your email')
    }

    if (mode === 'signup') {
      if (!devName.trim()) return toast.error('Please enter your full name')
      if (!devCity) return toast.error('Please select your city')
    }

    setLoading(true)
    try {
      const activeRole = getActiveRole()
      if (mode === 'signup') {
        const payload = {
          name: devName,
          email: method === 'email' ? sanitizedContact : `${devName.replace(/\s+/g, '').toLowerCase()}@example.com`,
          phone: method === 'phone' ? sanitizedContact : '+919999988888',
          city: devCity,
          furnishing_preference: furnishingPreference,
          role: activeRole,
        }
        const res = await authAPI.signup(payload)
        setDevOtp(res.data.dev_otp || '')
        toast.success(`Registration OTP sent! Check hint below.`)
        setStep('otp')
      } else {
        const payload = method === 'phone' ? { phone: sanitizedContact, role: activeRole } : { email: sanitizedContact, role: activeRole }
        const res = await authAPI.login(payload)
        setDevOtp(res.data.dev_otp || '')
        toast.success(`Sign-in OTP sent! Check hint below.`)
        setStep('otp')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleDevVerify = async () => {
    if (otp.length < 6) return toast.error('Enter 6-digit OTP')
    setLoading(true)
    const sanitizedContact = contact.trim().replace(/\s+/g, '')
    try {
      const activeRole = getActiveRole()
      const payload = method === 'phone'
        ? { phone: sanitizedContact, otp, role: activeRole }
        : { email: sanitizedContact, otp, role: activeRole }

      const res = await authAPI.verifyOtp(payload)

      setToken(res.data.access_token, res.data.user_id, res.data.role)
      localStorage.setItem('active_role', res.data.role)
      useProjectStore.getState().clearProject()

      if (mode === 'signup' && res.data.user) {
        const updatedUser = {
          id: res.data.user_id,
          name: devName,
          email: method === 'email' ? sanitizedContact : `${devName.replace(/\s+/g, '').toLowerCase()}@example.com`,
          phone: method === 'phone' ? sanitizedContact : '',
          city: devCity,
          furnishing_preference: furnishingPreference,
          style_tags: [],
          role: res.data.role,
        }
        useAuthStore.getState().setUser(updatedUser)
        localStorage.setItem('active_user', JSON.stringify(updatedUser))
      } else {
        await useAuthStore.getState().fetchMe()
      }

      toast.success(mode === 'signup' ? 'Account created successfully! 🎉' : 'Welcome back to InteriorAI! 👋')
      await navigateAfterLogin(res.data.role)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Invalid OTP code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-[#FAF6F0]">
      {/* Left panel – form container */}
      <div className="flex-1 flex flex-col justify-between px-6 py-8 sm:px-10 lg:px-12 bg-[#FAF6F0] border-r border-[#E8DFD1] relative overflow-y-auto">

        {/* Top Bar: Brand Logo & Developer Mode Switch */}
        <div className="flex items-center justify-between w-full max-w-md mx-auto mb-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform">
              <img
                src="/Logo.webp"
                alt="InteriorAI Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  const fb = e.currentTarget.parentElement?.querySelector('.login-logo-fallback') as HTMLElement
                  if (fb) fb.style.display = 'flex'
                }}
              />
              <div className="login-logo-fallback hidden w-full h-full rounded-xl bg-gradient-to-br from-[#b85d3b] to-[#9c4a2a] items-center justify-center shadow-sm">
                <Sparkles className="w-5 h-5 text-white animate-pulse" />
              </div>
            </div>
            <span className="font-extrabold text-2xl text-stone-900 tracking-tight">
              Interior<span className="text-[#b85d3b]">AI</span>
            </span>
          </Link>

          {/* Developer Mode Toggle Button */}
          <button
            type="button"
            onClick={() => {
              setIsDevMode(!isDevMode)
              setStep('form')
              setOtp('')
            }}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border shadow-xs',
              isDevMode
                ? 'bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-400/30'
                : 'bg-white text-stone-600 hover:text-stone-900 hover:bg-[#F5EDE2] border-[#E8DFD1]'
            )}
            title="Toggle developer mode for role simulation and bypass OTP testing"
          >
            <Wrench className={clsx('w-3.5 h-3.5', isDevMode ? 'text-amber-700 animate-spin-slow' : 'text-stone-500')} />
            <span>{isDevMode ? 'Dev Mode: ON' : 'Developer Mode'}</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="w-full max-w-md mx-auto my-auto py-4">

          {/* ════════════════════════════════════════════════════════════════════════ */}
          {/* 1. DEFAULT AUTH MODE (Dev Mode OFF) — Supabase Auth, Google, Email/Pass */}
          {/* ════════════════════════════════════════════════════════════════════════ */}
          {!isDevMode ? (
            <AnimatePresence mode="wait">
              {verificationSent ? (
                /* Verification Email Sent Card */
                <motion.div
                  key="verification-sent"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white p-7 rounded-2xl border border-[#E8DFD1] shadow-sm text-center space-y-4"
                >
                  <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-extrabold text-stone-900">Check Your Email</h2>
                  <p className="text-sm text-stone-600 leading-relaxed">
                    We sent a verification link to <strong className="text-stone-900">{email}</strong>.
                    Please click the link in your email to verify your account and sign in.
                  </p>
                  <div className="pt-2 border-t border-[#E8DFD1]">
                    <button
                      type="button"
                      onClick={() => {
                        setVerificationSent(false)
                        setMode('signin')
                      }}
                      className="text-sm font-bold text-[#b85d3b] hover:underline"
                    >
                      ← Back to Sign In
                    </button>
                  </div>
                </motion.div>
              ) : isResetMode ? (
                /* Password Reset View */
                <motion.div
                  key="password-reset"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-5"
                >
                  <div>
                    <h1 className="text-3xl font-extrabold text-stone-900 tracking-tight mb-2">Reset Password</h1>
                    <p className="text-stone-500 text-sm">Enter your registered email address to receive reset instructions.</p>
                  </div>

                  {resetSent ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 space-y-2">
                      <p className="font-semibold">Reset instructions sent!</p>
                      <p className="text-xs">Check your inbox or spam folder for the password reset link.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setIsResetMode(false)
                          setResetSent(false)
                        }}
                        className="text-xs font-bold text-emerald-900 underline block mt-2"
                      >
                        Return to Sign In
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleResetPassword} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-[#b85d3b]" /> Email Address
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="input w-full px-4 py-3 rounded-xl border border-[#E8DFD1] focus:border-[#b85d3b] focus:ring-1 focus:ring-[#b85d3b] transition-all text-stone-900 font-medium placeholder-stone-400 bg-white"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full justify-center py-3.5 text-base rounded-xl font-bold bg-[#b85d3b] hover:bg-[#a34f30] text-white shadow-sm flex items-center gap-2 transition"
                      >
                        {loading ? <div className="spinner w-5 h-5 border-white" /> : <span>Send Reset Link</span>}
                      </button>

                      <div className="text-center">
                        <button
                          type="button"
                          onClick={() => setIsResetMode(false)}
                          className="text-xs font-bold text-stone-500 hover:text-[#b85d3b] transition"
                        >
                          ← Cancel and go back to Sign In
                        </button>
                      </div>
                    </form>
                  )}
                </motion.div>
              ) : (
                /* Main Sign In / Sign Up View */
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="mb-6">
                    <h1 className="text-3xl font-extrabold text-stone-900 tracking-tight mb-2">
                      {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
                    </h1>
                    <p className="text-stone-500 text-sm">
                      {mode === 'signin'
                        ? 'Sign in to access your customized home interior projects.'
                        : 'Join InteriorAI to design and visualize your dream spaces.'}
                    </p>
                  </div>

                  {/* Google OAuth Button */}
                  <button
                    type="button"
                    onClick={handleGoogleAuth}
                    disabled={loading}
                    className="w-full py-3 px-4 bg-white hover:bg-stone-50 text-stone-800 font-semibold text-sm rounded-xl border border-[#E8DFD1] shadow-xs flex items-center justify-center gap-3 transition-all transform active:scale-[0.99] mb-5"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>{mode === 'signin' ? 'Sign in with Google' : 'Sign up with Google'}</span>
                  </button>

                  <div className="relative flex items-center justify-center mb-5">
                    <div className="border-t border-[#E8DFD1] w-full" />
                    <span className="bg-[#FAF6F0] px-3 text-xs font-semibold text-stone-400 uppercase tracking-wider">
                      or with email
                    </span>
                  </div>

                  {/* Email & Password Form */}
                  <form
                    onSubmit={mode === 'signin' ? handleStandardSignIn : handleStandardSignUp}
                    className="space-y-4"
                  >
                    {/* Full Name for Sign Up only */}
                    {mode === 'signup' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-1.5"
                      >
                        <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-[#b85d3b]" /> Full Name
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Amey Kulkarni"
                          value={signupName}
                          onChange={(e) => setSignupName(e.target.value)}
                          className="input w-full px-4 py-3 rounded-xl border border-[#E8DFD1] focus:border-[#b85d3b] focus:ring-1 focus:ring-[#b85d3b] transition-all text-stone-900 font-medium placeholder-stone-400 bg-white"
                        />
                      </motion.div>
                    )}

                    {/* Email Input */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-[#b85d3b]" /> Email Address
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="input w-full px-4 py-3 rounded-xl border border-[#E8DFD1] focus:border-[#b85d3b] focus:ring-1 focus:ring-[#b85d3b] transition-all text-stone-900 font-medium placeholder-stone-400 bg-white"
                      />
                    </div>

                    {/* Password Input */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider flex items-center gap-1">
                          <Lock className="w-3.5 h-3.5 text-[#b85d3b]" /> Password
                        </label>
                        {mode === 'signin' && (
                          <button
                            type="button"
                            onClick={() => setIsResetMode(true)}
                            className="text-xs font-bold text-[#b85d3b] hover:underline"
                          >
                            Forgot password?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="input w-full px-4 py-3 pr-10 rounded-xl border border-[#E8DFD1] focus:border-[#b85d3b] focus:ring-1 focus:ring-[#b85d3b] transition-all text-stone-900 font-medium placeholder-stone-400 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full justify-center py-3.5 text-base mt-2 rounded-xl font-bold bg-[#b85d3b] hover:bg-[#a34f30] text-white shadow-sm flex items-center gap-2 transition"
                    >
                      {loading ? (
                        <div className="spinner w-5 h-5 border-white" />
                      ) : (
                        <>
                          <span>{mode === 'signin' ? 'Sign In to Dashboard' : 'Create Free Account'}</span>
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Toggle between Sign In and Sign Up */}
                  <div className="text-center mt-6">
                    {mode === 'signin' ? (
                      <p className="text-sm text-stone-500">
                        Don't have an account?{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setMode('signup')
                            setPassword('')
                          }}
                          className="text-[#b85d3b] font-bold hover:underline"
                        >
                          Sign Up
                        </button>
                      </p>
                    ) : (
                      <p className="text-sm text-stone-500">
                        Already have an account?{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setMode('signin')
                            setPassword('')
                          }}
                          className="text-[#b85d3b] font-bold hover:underline"
                        >
                          Sign In
                        </button>
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          ) : (
            /* ════════════════════════════════════════════════════════════════════════ */
            /* 2. DEVELOPER MODE (Multi-Role Portal Simulator & Bypass OTP)              */
            /* ════════════════════════════════════════════════════════════════════════ */
            <AnimatePresence mode="wait">
              {step === 'form' ? (
                <motion.div
                  key="dev-form"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
                    <Wrench className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-900 leading-snug">
                      <span className="font-bold">🛠️ Developer Mode Active:</span> Select any platform stakeholder role below to pre-fill test credentials and simulate login without external email/SMS providers.
                    </div>
                  </div>

                  <div className="mb-6">
                    <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight mb-1">
                      {mode === 'signin' ? 'Role Portal Access' : 'Register Test Role'}
                    </h1>
                    <p className="text-stone-500 text-xs">Simulate direct authentication across all 5 stakeholder portals.</p>
                  </div>

                  {/* Access Portal As Role Selector */}
                  <div className="mb-5">
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2.5">
                      Select Stakeholder Portal
                    </label>
                    <div className="grid grid-cols-6 gap-2">
                      {([
                        { id: 'client', label: 'Client', icon: User, bg: 'from-[#b85d3b] to-[#9c4a2a]', colClass: 'col-span-2' },
                        { id: 'vendor', label: 'Vendor', icon: Compass, bg: 'from-emerald-600 to-teal-700', colClass: 'col-span-2' },
                        { id: 'team', label: 'Project Team', icon: Check, bg: 'from-amber-600 to-orange-700', colClass: 'col-span-2' },
                        { id: 'consultant', label: 'Consultant', icon: Briefcase, bg: 'from-cyan-600 to-sky-700', colClass: 'col-span-2 col-start-2' },
                        { id: 'admin', label: 'Admin', icon: Sparkles, bg: 'from-stone-700 to-stone-900', colClass: 'col-span-2 col-start-4' }
                      ] as const).map((item) => {
                        const Icon = item.icon
                        const isSelected = portalGroup === item.id
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              const group = item.id
                              setPortalGroup(group)
                              setContact(getPrefilledContact(group, clientRole, teamRole, method))
                              const actRole = getActiveRole(group, clientRole, teamRole)
                              if (actRole === 'customer') {
                                setDevName('Seeded Customer')
                              } else {
                                setDevName(`Seeded ${actRole.charAt(0).toUpperCase() + actRole.slice(1)}`)
                              }
                            }}
                            className={clsx(
                              item.colClass,
                              'relative overflow-hidden px-2 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all duration-300 transform min-w-0',
                              isSelected
                                ? `bg-gradient-to-r ${item.bg} text-white shadow-md scale-[1.02]`
                                : 'bg-white text-stone-600 hover:bg-[#F5EDE2] hover:text-stone-900 border border-[#E8DFD1]'
                            )}
                          >
                            <div className={clsx(
                              'p-1 rounded-lg shrink-0',
                              isSelected ? 'bg-white/20' : 'bg-[#FAF6F0] shadow-2xs'
                            )}>
                              <Icon className={clsx("w-3.5 h-3.5", isSelected ? 'text-white' : 'text-stone-500')} />
                            </div>
                            <span className="font-bold text-xs tracking-tight truncate">{item.label}</span>
                          </button>
                        )
                      })}
                    </div>

                    <AnimatePresence>
                      {portalGroup === 'client' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 overflow-hidden"
                        >
                          <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                            Select Client Type
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {([
                              { id: 'customer', label: 'Individual Customer' },
                              { id: 'enterprise', label: 'Enterprise Partner' }
                            ] as const).map(item => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  const cr = item.id
                                  setClientRole(cr)
                                  setContact(getPrefilledContact('client', cr, teamRole, method))
                                  setDevName(cr === 'customer' ? 'Seeded Customer' : 'Seeded Enterprise')
                                }}
                                className={clsx(
                                  'py-2 px-3 text-xs font-bold rounded-lg border transition-all text-center',
                                  clientRole === item.id ? 'bg-[#b85d3b] border-[#b85d3b] text-white shadow-sm' : 'bg-white border-[#E8DFD1] text-stone-600 hover:bg-[#F5EDE2]'
                                )}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {portalGroup === 'team' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 overflow-hidden"
                        >
                          <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                            Select Team Role
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {([
                              { id: 'team_manager', label: 'Manager' },
                              { id: 'team_coordinator', label: 'Coordinator' },
                              { id: 'team_technician', label: 'Technician' }
                            ] as const).map(item => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  const tr = item.id
                                  setTeamRole(tr)
                                  setContact(getPrefilledContact('team', clientRole, tr, method))
                                  setDevName('Seeded Team')
                                }}
                                className={clsx(
                                  'py-2 px-2 text-xs font-bold rounded-lg border transition-all text-center',
                                  teamRole === item.id ? 'bg-[#b85d3b] border-[#b85d3b] text-white shadow-sm' : 'bg-white border-[#E8DFD1] text-stone-600 hover:bg-[#F5EDE2]'
                                )}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Method selector */}
                  <div className="flex gap-2 mb-4 bg-[#EFE8DD] p-1 rounded-xl border border-[#E8DFD1]">
                    <button
                      type="button"
                      onClick={() => {
                        setMethod('phone')
                        setContact(getPrefilledContact(portalGroup, clientRole, teamRole, 'phone'))
                      }}
                      className={clsx(
                        'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all',
                        method === 'phone' ? 'bg-white text-[#b85d3b] shadow-xs' : 'text-stone-600 hover:text-stone-900'
                      )}
                    >
                      <Phone className="w-3.5 h-3.5" /> Phone Number
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMethod('email')
                        setContact(getPrefilledContact(portalGroup, clientRole, teamRole, 'email'))
                      }}
                      className={clsx(
                        'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all',
                        method === 'email' ? 'bg-white text-[#b85d3b] shadow-xs' : 'text-stone-600 hover:text-stone-900'
                      )}
                    >
                      <Mail className="w-3.5 h-3.5" /> Email Address
                    </button>
                  </div>

                  <div className="space-y-4">
                    {mode === 'signup' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-4"
                      >
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <User className="w-3 h-3 text-[#b85d3b]" /> Full Name
                          </label>
                          <input
                            type="text"
                            placeholder="Amey Kulkarni"
                            value={devName}
                            onChange={(e) => setDevName(e.target.value)}
                            className="input w-full px-4 py-3 rounded-xl border border-[#E8DFD1] focus:border-[#b85d3b] focus:ring-1 focus:ring-[#b85d3b] transition-all text-stone-900 font-medium placeholder-stone-400 bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#b85d3b]" /> Current City
                          </label>
                          <select
                            value={devCity}
                            onChange={(e) => setDevCity(e.target.value)}
                            className="input w-full px-4 py-3 rounded-xl border border-[#E8DFD1] focus:border-[#b85d3b] focus:ring-1 focus:ring-[#b85d3b] transition-all text-stone-900 font-semibold bg-white"
                          >
                            {CITIES.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                      </motion.div>
                    )}

                    {/* Contact Input */}
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                        {method === 'phone' ? 'Phone Number' : 'Email Address'}
                      </label>
                      <input
                        type={method === 'phone' ? 'tel' : 'email'}
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleDevSendOtp()}
                        className="input w-full px-4 py-3 rounded-xl border border-[#E8DFD1] focus:border-[#b85d3b] focus:ring-1 focus:ring-[#b85d3b] transition-all text-stone-900 font-medium placeholder-stone-400 bg-white"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleDevSendOtp}
                    disabled={loading}
                    className="w-full justify-center py-3.5 text-base mt-5 rounded-xl font-bold bg-[#b85d3b] hover:bg-[#a34f30] text-white shadow-sm flex items-center gap-2 transition"
                  >
                    {loading ? (
                      <div className="spinner w-5 h-5 border-white" />
                    ) : (
                      <>
                        <span>{mode === 'signin' ? 'Send Dev OTP' : 'Register & Send OTP'}</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>

                  <div className="text-center mt-4">
                    {mode === 'signin' ? (
                      <p className="text-xs text-stone-500">
                        Need a test account?{' '}
                        <button
                          onClick={() => { setMode('signup'); setContact('') }}
                          className="text-[#b85d3b] font-bold hover:underline"
                        >
                          Sign Up Role
                        </button>
                      </p>
                    ) : (
                      <p className="text-xs text-stone-500">
                        Already have a test role?{' '}
                        <button
                          onClick={() => { setMode('signin'); setContact('') }}
                          className="text-[#b85d3b] font-bold hover:underline"
                        >
                          Sign In
                        </button>
                      </p>
                    )}
                  </div>
                </motion.div>
              ) : (
                /* Dev OTP Screen */
                <motion.div
                  key="dev-otp"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-5"
                >
                  <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight">Verify Dev OTP</h1>
                  <p className="text-stone-500 text-sm">
                    Simulated code sent to <strong className="text-stone-900">{contact}</strong>
                  </p>

                  {devOtp && (
                    <div className="p-4 bg-[#faeae3] border border-[#f3d2c4] rounded-2xl flex items-start gap-3">
                      <Info className="w-5 h-5 text-[#b85d3b] flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-[#8a3e23]">
                        <strong className="font-bold">🔐 Dev Mode OTP:</strong>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="font-mono bg-white px-2 py-0.5 rounded border border-[#E8DFD1] font-extrabold tracking-widest text-[#b85d3b] text-lg">
                            {devOtp}
                          </span>
                          <span className="text-xs text-stone-500">(Click verify to enter)</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="482913"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => e.key === 'Enter' && handleDevVerify()}
                      className="input w-full text-center text-3xl py-3 rounded-2xl border-2 tracking-[0.4em] font-mono border-[#E8DFD1] focus:border-[#b85d3b] focus:ring-0 text-stone-900 bg-white"
                      autoFocus
                    />
                  </div>

                  <button
                    onClick={handleDevVerify}
                    disabled={loading}
                    className="w-full justify-center py-3.5 text-base rounded-xl font-bold bg-[#b85d3b] hover:bg-[#a34f30] text-white shadow-sm flex items-center gap-2 transition"
                  >
                    {loading ? <div className="spinner w-5 h-5 border-white" /> : <><span>Verify & Access Platform</span><ArrowRight className="w-5 h-5" /></>}
                  </button>

                  <button
                    onClick={() => { setStep('form'); setOtp('') }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-[#b85d3b] transition mx-auto"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Go Back
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Footer info */}
        <div className="text-center pt-4 text-xs text-stone-400">
          InteriorAI Platform &copy; 2026. Bank-grade 256-bit encryption.
        </div>
      </div>

      {/* Right panel – visual hero banner */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1000&q=80&fit=crop"
          alt="Beautiful interior design"
          className="w-full h-full object-cover animate-fade-in"
          style={{ animationDuration: '2s' }}
        />
        <div className="absolute inset-0 bg-gradient-to-l from-stone-950/75 via-stone-900/35 to-transparent" />

        <div className="absolute bottom-12 left-8 right-8 glass rounded-2xl p-6 border border-white/20 shadow-xl backdrop-blur-md">
          <p className="text-white font-medium text-lg leading-relaxed">
            &quot;Designed my entire 3BHK in under 20 minutes with InteriorAI. The renders and budget calculator were incredibly accurate!&quot;
          </p>
          <div className="flex items-center gap-3 mt-4">
            <div className="w-10 h-10 rounded-full bg-[#b85d3b] flex items-center justify-center text-white text-sm font-extrabold shadow-inner border border-white/20">
              PM
            </div>
            <div>
              <div className="text-white text-sm font-bold">Priya Mehta</div>
              <div className="text-stone-300 text-xs font-semibold">Homeowner, Bangalore</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
