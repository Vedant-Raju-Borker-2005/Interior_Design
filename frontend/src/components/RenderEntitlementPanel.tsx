'use client'

/**
 * Free visualisation, floor-plan upload and paid photoreal renders.
 *
 * Feedback 1.7 — the AI visualisation is free, and says so.
 * Feedback 1.1 — a floor plan can be uploaded right here; AI renders then
 *   follow it. (The interactive 3D model keeps the standard layout for the BHK:
 *   its geometry is pre-solved, not derived from an uploaded drawing.)
 * Feedback 1.8 — after payment, up to 20 high-quality renders per project.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { Gift, FileUp, Lock, Sparkles, Trash2, Loader2, Download, Map } from 'lucide-react'
import { premiumRenderAPI } from '@/lib/api'

export default function RenderEntitlementPanel({
  projectId,
  floorPlanUrl,
  onPlanChanged,
}: {
  projectId: string
  floorPlanUrl?: string | null
  onPlanChanged?: () => void
}) {
  const [entitlement, setEntitlement] = useState<any>(null)
  const [plan, setPlan] = useState<string | null>(floorPlanUrl || null)
  const [uploading, setUploading] = useState(false)
  const [count, setCount] = useState(4)
  const [batch, setBatch] = useState<any>(null)
  const [queueing, setQueueing] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { setPlan(floorPlanUrl || null) }, [floorPlanUrl])

  const loadEntitlement = useCallback(async () => {
    try {
      const r = await premiumRenderAPI.entitlement(projectId)
      setEntitlement(r.data)
      const remaining = r.data?.premium_rendering?.credits_remaining || 0
      setCount((c) => Math.max(1, Math.min(c, remaining || 1)))
    } catch {
      // Not signed in / not the owner: the panel simply stays hidden.
    }
  }, [projectId])

  useEffect(() => { loadEntitlement() }, [loadEntitlement])
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const uploadPlan = async (file?: File | null) => {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { toast.error('Floor plan must be 10 MB or smaller'); return }
    setUploading(true)
    try {
      const r = await premiumRenderAPI.uploadFloorPlan(projectId, file)
      setPlan(r.data.floor_plan_url)
      toast.success('Floor plan attached — new AI renders will follow it')
      onPlanChanged?.()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const removePlan = async () => {
    try {
      await premiumRenderAPI.clearFloorPlan(projectId)
      setPlan(null)
      toast.success('Floor plan removed')
      onPlanChanged?.()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Could not remove plan')
    }
  }

  const poll = (batchId: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const r = await premiumRenderAPI.batch(batchId)
        setBatch(r.data)
        if (r.data.completed + r.data.failed >= r.data.total) {
          if (pollRef.current) clearInterval(pollRef.current)
          loadEntitlement()
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current)
      }
    }, 3000)
  }

  const queuePremium = async () => {
    setQueueing(true)
    try {
      const r = await premiumRenderAPI.queueBatch(projectId, { count })
      setBatch({ batch_id: r.data.batch_id, total: r.data.queued, completed: 0, failed: 0, progress: 0, images: [] })
      toast.success(`Generating ${r.data.queued} photoreal renders`)
      poll(r.data.batch_id)
      loadEntitlement()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Could not start premium renders')
    } finally {
      setQueueing(false)
    }
  }

  if (!entitlement) return null
  const premium = entitlement.premium_rendering || {}
  const planName = plan ? decodeURIComponent(plan.split('/').pop() || 'floor plan') : null

  return (
    <div className="bg-slate-900 border border-white/5 rounded-3xl p-5 shadow-2xl text-slate-100 space-y-5">
      {/* 1.7 free tier */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider">
            <Gift className="w-3.5 h-3.5" /> Free
          </span>
          <span className="text-xs text-slate-300 font-semibold">Your 2D plan and 3D model (with .glb export) are free. Gemini renders unlock after payment.</span>
        </div>
      </div>

      {/* 1.1 floor plan */}
      <div className="bg-slate-950/50 border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center shrink-0">
            <Map className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white">
              {plan ? 'Your floor plan is attached' : 'Using the standard layout for your BHK'}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {plan ? (
                <>AI renders follow <a href={plan} target="_blank" rel="noopener noreferrer" className="text-indigo-300 underline truncate">{planName}</a>. The interactive 3D model keeps the standard layout.</>
              ) : (
                'Upload your own plan (PNG, JPG or PDF) and AI renders will be generated against it.'
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden"
            onChange={(e) => { uploadPlan(e.target.files?.[0]); e.target.value = '' }} />
          <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}
            className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-60">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
            {plan ? 'Replace plan' : 'Upload floor plan'}
          </button>
          {plan && (
            <button type="button" onClick={removePlan} title="Remove plan"
              className="px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300"><Trash2 className="w-3.5 h-3.5" /></button>
          )}
        </div>
      </div>

      {/* 1.8 premium renders */}
      <div className={clsx('rounded-2xl p-4 border', premium.unlocked ? 'bg-gradient-to-br from-amber-500/10 to-purple-600/10 border-amber-400/20' : 'bg-slate-950/50 border-white/5')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300" /> Premium photoreal renders
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {premium.unlocked
                ? `${premium.credits_remaining} of ${premium.credits_total} renders remaining on this project.`
                : `Up to ${premium.max_per_project || 20} high-quality renders, unlocked once your quotation is paid.`}
            </p>
          </div>
          {premium.unlocked ? (
            premium.credits_remaining > 0 && (
              <div className="flex items-center gap-2">
                <select value={count} onChange={(e) => setCount(Number(e.target.value))}
                  className="bg-slate-900 border border-white/10 rounded-lg text-xs font-bold text-white p-2">
                  {Array.from({ length: Math.min(premium.credits_remaining, 20) }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n} render{n > 1 ? 's' : ''}</option>
                  ))}
                </select>
                <button type="button" disabled={queueing || (batch && batch.completed + batch.failed < batch.total)} onClick={queuePremium}
                  className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 text-xs font-extrabold disabled:opacity-60 flex items-center gap-1.5">
                  {queueing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Generate
                </button>
              </div>
            )
          ) : (
            <Link href={`/quotation/${projectId}`}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> View quotation
            </Link>
          )}
        </div>

        {batch && (
          <div className="mt-4 space-y-3">
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400 transition-all" style={{ width: `${batch.progress || 0}%` }} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(batch.images || []).map((img: any) => (
                <div key={img.job_id} className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-white/5">
                  {img.image_url ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.image_url} alt="Premium render" className="w-full h-full object-cover" loading="lazy" />
                      <a href={img.image_url} target="_blank" rel="noopener noreferrer"
                        className="absolute bottom-1.5 right-1.5 p-1.5 bg-black/60 rounded-lg text-white" title="Open full size">
                        <Download className="w-3 h-3" />
                      </a>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                      {img.status === 'failed' ? <span className="text-[10px]">Failed</span> : <Loader2 className="w-4 h-4 animate-spin" />}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
