'use client'

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cmczgcqooszzmjwrzlnz.supabase.co'
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_dH9Mnw9A7TW21BwxBnZeDQ_fkvctj8-'

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseAnonKey &&
    !supabaseAnonKey.includes('YOUR_') &&
    supabaseAnonKey.length > 20
  )
}

let _supabaseInstance: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (typeof window === 'undefined') return null
  if (!isSupabaseConfigured()) {
    return null
  }
  if (!_supabaseInstance) {
    _supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return _supabaseInstance
}
