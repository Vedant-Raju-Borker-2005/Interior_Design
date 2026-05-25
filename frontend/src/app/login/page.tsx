'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { authAPI } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import toast from 'react-hot-toast'
import { Sparkles, Phone, Mail, ArrowRight, RefreshCw, MapPin, User, Compass, HelpCircle, Check, Info } from 'lucide-react'
import Link from 'next/link'
import clsx from 'clsx'

type FormMode = 'signin' | 'signup'
type VerificationStep = 'form' | 'otp'
type LoginMethod = 'phone' | 'email'

const CITIES = ['Bangalore', 'Mumbai', 'Delhi', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad', 'Other']

export default function LoginPage() {
  const router = useRouter()
  const { setToken } = useAuthStore()

  const [mode, setMode] = useState<FormMode>('signin')
  const [step, setStep] = useState<VerificationStep>('form')
  const [method, setMethod] = useState<LoginMethod>('phone')
  const [loading, setLoading] = useState(false)
  const [devOtp, setDevOtp] = useState('')

  // Form Fields
  const [contact, setContact] = useState('')
  const [name, setName] = useState('')
  const [city, setCity] = useState('Bangalore')
  const [furnishingPreference, setFurnishingPreference] = useState<'new' | 'upgrade'>('new')
  const [otp, setOtp] = useState('')

  const handleSendOtp = async () => {
    if (!contact.trim()) {
      return toast.error(method === 'phone' ? 'Please enter your phone number' : 'Please enter your email')
    }

    if (mode === 'signup') {
      if (!name.trim()) return toast.error('Please enter your full name')
      if (!city) return toast.error('Please select your city')
    }

    setLoading(true)
    try {
      if (mode === 'signup') {
        const payload = {
          name,
          email: method === 'email' ? contact : `${name.replace(/\s+/g, '').toLowerCase()}@example.com`,
          phone: method === 'phone' ? contact : '+91 99999 88888',
          city,
          furnishing_preference: furnishingPreference
        }
        const res = await authAPI.signup(payload)
        setDevOtp(res.data.dev_otp || '')
        toast.success(`Registration OTP sent! Check hint below.`)
        setStep('otp')
      } else {
        // Sign In - Strictly requires registered user
        const payload = method === 'phone' ? { phone: contact } : { email: contact }
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

  const handleVerify = async () => {
    if (otp.length < 6) return toast.error('Enter 6-digit OTP')
    setLoading(true)
    try {
      const payload = method === 'phone'
        ? { phone: contact, otp }
        : { email: contact, otp }
      
      const res = await authAPI.verifyOtp(payload)
      
      // Auto Login & Set token
      setToken(res.data.access_token, res.data.user_id)
      
      // If they just registered, update their profile details in the authStore
      if (mode === 'signup' && res.data.user) {
        const updatedUser = {
          id: res.data.user_id,
          name,
          email: method === 'email' ? contact : `${name.replace(/\s+/g, '').toLowerCase()}@example.com`,
          phone: method === 'phone' ? contact : '',
          city,
          furnishing_preference: furnishingPreference,
          style_tags: []
        }
        // Force set user profile details
        useAuthStore.getState().setUser(updatedUser)
        localStorage.setItem('active_user', JSON.stringify(updatedUser))
      }

      toast.success(mode === 'signup' ? 'Account created successfully! 🎉' : 'Welcome back to InteriorAI! 👋')
      
      // Directly redirect to dashboard (home page when logged in)
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Invalid OTP code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left panel – form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white relative overflow-y-auto">
        <div className="w-full max-w-md my-auto">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-glow-indigo">
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
            </div>
            <span className="font-extrabold text-2xl text-slate-800 tracking-tight">
              Interior<span className="text-indigo-600">AI</span>
            </span>
          </Link>

          <AnimatePresence mode="wait">
            {step === 'form' ? (
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                {mode === 'signin' ? (
                  <>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">Welcome Back</h1>
                    <p className="text-slate-500 mb-6">Enter your email or phone to sign in to your dashboard.</p>
                  </>
                ) : (
                  <>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">Create Account</h1>
                    <p className="text-slate-500 mb-6">Join InteriorAI to design and visualize your home in minutes.</p>
                  </>
                )}

                {/* Method selector */}
                <div className="flex gap-2 mb-4 bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => { setMethod('phone'); setContact('') }}
                    className={clsx(
                      'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all',
                      method === 'phone' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    )}
                  >
                    <Phone className="w-3.5 h-3.5" /> Phone Number
                  </button>
                  <button
                    onClick={() => { setMethod('email'); setContact('') }}
                    className={clsx(
                      'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all',
                      method === 'email' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    )}
                  >
                    <Mail className="w-3.5 h-3.5" /> Email Address
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Signup Specific Fields */}
                  {mode === 'signup' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-4"
                    >
                      {/* Name */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <User className="w-3 h-3 text-indigo-500" /> Full Name
                        </label>
                        <input
                          type="text"
                          placeholder="Amey Kulkarni"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="input w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-slate-800 font-medium placeholder-slate-400"
                        />
                      </div>

                      {/* City */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-indigo-500" /> Current City
                        </label>
                        <select
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="input w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-slate-800 font-semibold bg-white"
                        >
                          {CITIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      {/* Furnishing Preference */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <HelpCircle className="w-3 h-3 text-indigo-500" /> Project Scope
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setFurnishingPreference('new')}
                            className={clsx(
                              'p-3 rounded-xl border-2 text-left flex items-start gap-2.5 transition-all duration-200',
                              furnishingPreference === 'new'
                                ? 'border-indigo-500 bg-indigo-50/60 shadow-sm'
                                : 'border-slate-200 hover:border-slate-300'
                            )}
                          >
                            <div className={clsx(
                              'w-4 h-4 rounded-full border flex items-center justify-center mt-0.5',
                              furnishingPreference === 'new' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                            )}>
                              {furnishingPreference === 'new' && <Check className="w-2.5 h-2.5 stroke-[4px]" />}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800 text-xs">Furnishing New Home</div>
                              <div className="text-[10px] text-slate-500 mt-0.5">Brand new shell property</div>
                            </div>
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => setFurnishingPreference('upgrade')}
                            className={clsx(
                              'p-3 rounded-xl border-2 text-left flex items-start gap-2.5 transition-all duration-200',
                              furnishingPreference === 'upgrade'
                                ? 'border-indigo-500 bg-indigo-50/60 shadow-sm'
                                : 'border-slate-200 hover:border-slate-300'
                            )}
                          >
                            <div className={clsx(
                              'w-4 h-4 rounded-full border flex items-center justify-center mt-0.5',
                              furnishingPreference === 'upgrade' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                            )}>
                              {furnishingPreference === 'upgrade' && <Check className="w-2.5 h-2.5 stroke-[4px]" />}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800 text-xs">Upgrading / Renovating</div>
                              <div className="text-[10px] text-slate-500 mt-0.5">Renovate existing house</div>
                            </div>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Main Contact Input */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      {method === 'phone' ? 'Phone Number' : 'Email Address'}
                    </label>
                    <input
                      type={method === 'phone' ? 'tel' : 'email'}
                      placeholder={method === 'phone' ? '+91 98765 43210' : 'amey@gmail.com'}
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                      className="input w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-slate-800 font-medium placeholder-slate-400"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="btn-primary w-full justify-center py-3.5 text-base mt-6 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 shadow-glow-indigo"
                >
                  {loading ? (
                    <div className="spinner w-5 h-5" />
                  ) : (
                    <>
                      {mode === 'signin' ? 'Send OTP' : 'Register & Send OTP'}
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>

                {/* Toggle between signin and signup */}
                <div className="text-center mt-6">
                  {mode === 'signin' ? (
                    <p className="text-sm text-slate-500">
                      Don't have an account?{' '}
                      <button
                        onClick={() => { setMode('signup'); setContact('') }}
                        className="text-indigo-600 font-bold hover:underline"
                      >
                        Sign Up
                      </button>
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Already have an account?{' '}
                      <button
                        onClick={() => { setMode('signin'); setContact('') }}
                        className="text-indigo-600 font-bold hover:underline"
                      >
                        Sign In
                      </button>
                    </p>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="otp"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6"
              >
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Verify Identity</h1>
                <p className="text-slate-500">
                  We sent a 6-digit code to <strong className="text-slate-800">{contact}</strong>
                </p>

                {/* Dev OTP Box */}
                {devOtp && (
                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-start gap-3">
                    <Info className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-indigo-900">
                      <strong className="font-bold">🔐 Dev Mode OTP:</strong>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="font-mono bg-white px-2 py-0.5 rounded border border-indigo-200 font-extrabold tracking-widest text-indigo-700 text-lg">
                          {devOtp}
                        </span>
                        <span className="text-xs text-indigo-500">(Use this code to verify)</span>
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
                    onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                    className="input w-full text-center text-3xl py-3 rounded-2xl border-2 tracking-[0.4em] font-mono border-slate-200 focus:border-indigo-500 focus:ring-0 text-slate-900"
                    autoFocus
                  />
                </div>

                <button
                  onClick={handleVerify}
                  disabled={loading}
                  className="btn-primary w-full justify-center py-3.5 text-base rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 shadow-glow-indigo"
                >
                  {loading ? <div className="spinner w-5 h-5" /> : <>Verify & Access Platform <ArrowRight className="w-5 h-5" /></>}
                </button>

                <button
                  onClick={() => { setStep('form'); setOtp('') }}
                  className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition mx-auto"
                >
                  <RefreshCw className="w-4 h-4" /> Go Back / Resend OTP
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right panel – visual */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1000&q=80&fit=crop"
          alt="Beautiful interior design"
          className="w-full h-full object-cover animate-fade-in"
          style={{ animationDuration: '2s' }}
        />
        <div className="absolute inset-0 bg-gradient-to-l from-indigo-950/60 via-indigo-950/20 to-transparent" />
        
        <div className="absolute bottom-12 left-8 right-8 glass rounded-2xl p-6 border border-white/20 shadow-glow-indigo">
          <p className="text-white font-medium text-lg leading-relaxed">&quot;Designed my entire 3BHK in under 20 minutes with InteriorAI. The renders and budget calculator were incredibly accurate!&quot;</p>
          <div className="flex items-center gap-3 mt-4">
            <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-extrabold shadow-inner border border-white/20">PM</div>
            <div>
              <div className="text-white text-sm font-bold">Priya Mehta</div>
              <div className="text-indigo-200 text-xs font-semibold">Homeowner, Bangalore</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
