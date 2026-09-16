'use client'

/**
 * Floor plan → 2D plan + 3D model.
 *
 * The customer uploads their plan, we detect the rooms, and they confirm or
 * correct them here (move, resize, rename, retype, add, delete, set the scale).
 * Confirming builds the studio's 2D plan and 3D model from these rooms.
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import {
  ArrowLeft, ArrowRight, CheckCircle2, Info, Loader2, Plus, Ruler, ScanLine,
  SquareDashedMousePointer, Trash2, Upload,
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import {
  apiErrorMessage, planLayoutAPI,
  type PlanBox, type PlanLayoutPayload, type PlanRoom,
} from '@/lib/api'

const TYPE_COLOUR: Record<string, string> = {
  living_room: '#EF4444', dining_area: '#B45309', kitchen: '#F59E0B', master_bedroom: '#16A34A',
  bedroom: '#22C55E', bathroom: '#3B82F6', study: '#8B5CF6', family_lounge: '#EC4899',
  pooja_room: '#D946EF', balcony: '#0EA5E9', passage: '#64748B',
}
const FT_PER_M = 3.28084
const MIN_SIZE = 0.015                       // smallest box, as a fraction of the image

type Drag =
  | { kind: 'move' | 'resize'; index: number; corner?: 'nw' | 'ne' | 'sw' | 'se'; start: [number, number]; box: PlanBox }
  | { kind: 'draw'; start: [number, number] }

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const norm = (b: PlanBox): PlanBox => [Math.min(b[0], b[2]), Math.min(b[1], b[3]), Math.max(b[0], b[2]), Math.max(b[1], b[3])]

function PlanTraceContent() {
  const params = useParams()
  const search = useSearchParams()
  const router = useRouter()
  const projectId = params?.projectId as string
  // Only ever continue to a page inside this app.
  const nextParam = search?.get('next') || ''
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : `/visualize/${projectId}`

  const [data, setData] = useState<PlanLayoutPayload | null>(null)
  const [rooms, setRooms] = useState<PlanRoom[]>([])
  const [planWidth, setPlanWidth] = useState<number>(10)
  const [selected, setSelected] = useState<number | null>(null)
  const [drawMode, setDrawMode] = useState(false)
  const [draft, setDraft] = useState<PlanBox | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [syncBhk, setSyncBhk] = useState(false)
  const [calibRoom, setCalibRoom] = useState<number>(0)
  const [calibValue, setCalibValue] = useState('')
  const [calibUnit, setCalibUnit] = useState<'ft' | 'm'>('ft')
  const [loading, setLoading] = useState(true)

  const canvasRef = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const adopt = useCallback((payload: PlanLayoutPayload) => {
    setData(payload)
    if (payload.plan) {
      setRooms(payload.plan.rooms.map((r, i) => ({ ...r, id: r.id || `r${i + 1}` })))
      setPlanWidth(payload.plan.plan_width_m)
      setSelected(null)
    }
  }, [])

  useEffect(() => {
    planLayoutAPI.get(projectId)
      .then((r) => adopt(r.data))
      .catch((err) => toast.error(apiErrorMessage(err, 'Could not load your floor plan')))
      .finally(() => setLoading(false))
  }, [projectId, adopt])

  const plan = data?.plan || null
  // Metres down per metre across. Differs from the pixel aspect when the
  // uploaded image was stretched; the detector measures it from printed sizes.
  const aspect = plan
    ? (plan.plan_depth_m && plan.plan_width_m ? plan.plan_depth_m / plan.plan_width_m : plan.image_h / plan.image_w)
    : 1
  const planDepth = planWidth * aspect
  const bedrooms = rooms.filter((r) => r.room_type === 'master_bedroom' || r.room_type === 'bedroom').length
  const planBhk = `${Math.min(Math.max(bedrooms, 1), 5)} BHK`
  const projectBhkLabel = data?.project_bhk?.replace(/(\d)\s*BHK/i, '$1 BHK') || ''
  const bhkMismatch = !!plan && projectBhkLabel !== planBhk
  const typeLabel = useMemo(
    () => Object.fromEntries((data?.room_types || []).map((t) => [t.value, t.label])),
    [data?.room_types])

  // ── upload ────────────────────────────────────────────────────────────────
  const onFile = async (file: File | undefined | null) => {
    if (!file) return
    if (!/\.(jpe?g|png|webp)$/i.test(file.name)) {
      toast.error('Upload the plan as a JPG, PNG or WebP image (for a PDF, take a screenshot of the plan page).')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Floor plan must be 10 MB or smaller')
      return
    }
    setUploading(true)
    try {
      const r = await planLayoutAPI.detect(projectId, file)
      adopt(r.data)
      const n = r.data.plan?.rooms.length || 0
      toast.success(n ? `Found ${n} spaces — check them against your plan` : 'Plan uploaded — mark the rooms on it')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not read that floor plan'))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // ── canvas gestures ───────────────────────────────────────────────────────
  const pointAt = (e: { clientX: number; clientY: number }): [number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return [clamp((e.clientX - rect.left) / rect.width), clamp((e.clientY - rect.top) / rect.height)]
  }

  const startMove = (e: React.PointerEvent, index: number) => {
    if (drawMode) return
    e.stopPropagation()
    setSelected(index)
    drag.current = { kind: 'move', index, start: pointAt(e), box: [...rooms[index].box] as PlanBox }
    canvasRef.current?.setPointerCapture(e.pointerId)
  }

  const startResize = (e: React.PointerEvent, index: number, corner: 'nw' | 'ne' | 'sw' | 'se') => {
    e.stopPropagation()
    setSelected(index)
    drag.current = { kind: 'resize', index, corner, start: pointAt(e), box: [...rooms[index].box] as PlanBox }
    canvasRef.current?.setPointerCapture(e.pointerId)
  }

  const onCanvasDown = (e: React.PointerEvent) => {
    if (!drawMode) { setSelected(null); return }
    const p = pointAt(e)
    drag.current = { kind: 'draw', start: p }
    setDraft([p[0], p[1], p[0], p[1]])
    canvasRef.current?.setPointerCapture(e.pointerId)
  }

  const onCanvasMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const p = pointAt(e)
    if (d.kind === 'draw') { setDraft([d.start[0], d.start[1], p[0], p[1]]); return }
    const dx = p[0] - d.start[0], dy = p[1] - d.start[1]
    setRooms((prev) => prev.map((r, i) => {
      if (i !== d.index) return r
      let [x0, y0, x1, y1] = d.box
      if (d.kind === 'move') {
        const w = x1 - x0, h = y1 - y0
        x0 = clamp(x0 + dx, 0, 1 - w); y0 = clamp(y0 + dy, 0, 1 - h)
        return { ...r, box: [x0, y0, x0 + w, y0 + h] }
      }
      if (d.corner?.includes('w')) x0 = clamp(Math.min(x0 + dx, x1 - MIN_SIZE))
      if (d.corner?.includes('e')) x1 = clamp(Math.max(x1 + dx, x0 + MIN_SIZE))
      if (d.corner?.includes('n')) y0 = clamp(Math.min(y0 + dy, y1 - MIN_SIZE))
      if (d.corner?.includes('s')) y1 = clamp(Math.max(y1 + dy, y0 + MIN_SIZE))
      return { ...r, box: [x0, y0, x1, y1] }
    }))
  }

  const onCanvasUp = () => {
    const d = drag.current
    drag.current = null
    if (d?.kind !== 'draw' || !draft) return
    const box = norm(draft)
    setDraft(null)
    if (box[2] - box[0] < MIN_SIZE * 2 || box[3] - box[1] < MIN_SIZE * 2) return
    const index = rooms.length
    setRooms((prev) => [...prev, { id: `n${Date.now()}`, label: 'Bedroom', room_type: 'bedroom', box }])
    setSelected(index)
    setDrawMode(false)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected !== null) {
        setRooms((prev) => prev.filter((_, i) => i !== selected))
        setSelected(null)
      }
      if (e.key === 'Escape') { setDrawMode(false); setDraft(null); setSelected(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  // ── room editing ──────────────────────────────────────────────────────────
  const updateRoom = (index: number, patch: Partial<PlanRoom>) =>
    setRooms((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))

  const changeType = (index: number, roomType: string) => {
    const room = rooms[index]
    const oldDefault = typeLabel[room.room_type]
    const renamed = !room.label || room.label === oldDefault || /^(bedroom|bathroom|room)\s*\d*$/i.test(room.label)
    updateRoom(index, { room_type: roomType, ...(renamed ? { label: typeLabel[roomType] || room.label } : {}) })
  }

  const removeRoom = (index: number) => {
    setRooms((prev) => prev.filter((_, i) => i !== index))
    setSelected(null)
  }

  const dims = (box: PlanBox) => {
    const w = (box[2] - box[0]) * planWidth
    const d = (box[3] - box[1]) * planDepth
    return { w, d }
  }
  const ftIn = (m: number) => {
    const inches = Math.round(m * FT_PER_M * 12)
    return `${Math.floor(inches / 12)}'${inches % 12}"`
  }

  const applyCalibration = () => {
    const room = rooms[calibRoom]
    if (!room) return
    const raw = calibValue.trim()
    let metres = NaN
    if (calibUnit === 'm') metres = parseFloat(raw)
    else {
      // Accept 11, 11.5, 11'2", 11' 2, 11-2
      const m = raw.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|-|\s)?\s*(\d+(?:\.\d+)?)?\s*(?:"|in)?$/i)
      if (m) metres = (parseFloat(m[1]) + (m[2] ? parseFloat(m[2]) / 12 : 0)) / FT_PER_M
    }
    const frac = room.box[2] - room.box[0]
    if (!isFinite(metres) || metres <= 0 || frac <= 0) {
      toast.error(calibUnit === 'ft' ? "Enter the width like 11'2\" or 11.5" : 'Enter the width in metres, e.g. 3.4')
      return
    }
    const width = metres / frac
    if (width < 2 || width > 80) { toast.error('That makes the plan an unlikely size — check the room and the number'); return }
    setPlanWidth(Number(width.toFixed(2)))
    toast.success(`Scale set from ${room.label}`)
  }

  // ── confirm ───────────────────────────────────────────────────────────────
  const generate = async () => {
    if (!rooms.length) { toast.error('Mark at least one room on the plan'); return }
    setSaving(true)
    try {
      const r = await planLayoutAPI.save(projectId, {
        rooms: rooms.map((room) => ({ ...room, box: norm(room.box).map((v) => Number(v.toFixed(4))) as PlanBox })),
        plan_width_m: planWidth,
        plan_depth_m: plan?.plan_depth_m ? Number(planDepth.toFixed(3)) : undefined,
        activate: true,
        sync_bhk: syncBhk && bhkMismatch && !data?.bhk_locked,
      })
      adopt(r.data)
      const s = r.data.plan?.summary
      toast.success(s ? `Built ${s.rooms} rooms with ${s.objects} furniture items` : 'Your 2D plan and 3D model are ready')
      router.push(next)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not build the design from this plan'))
    } finally {
      setSaving(false)
    }
  }

  const redetect = async () => {
    if (!window.confirm('Detect the rooms again from your plan? Your edits on this page will be replaced.')) return
    setUploading(true)
    try {
      const r = await planLayoutAPI.redetect(projectId)
      adopt(r.data)
      toast.success(`Found ${r.data.plan?.rooms.length || 0} spaces — check them against your plan`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not detect the rooms again'))
    } finally {
      setUploading(false)
    }
  }

  const useStandard = async () => {
    try {
      await planLayoutAPI.disable(projectId)
      toast.success('Switched back to the standard layout')
      router.push(next)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not switch layouts'))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    )
  }

  const uploadInput = (
    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
      onChange={(e) => onFile(e.target.files?.[0])} />
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      {uploadInput}
      <div className="max-w-7xl mx-auto px-4 pt-24 pb-16">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <button onClick={() => router.back()} className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100" title="Back">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-[220px]">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Match your floor plan</h1>
            <p className="text-sm text-slate-500">
              We build your 2D plan and 3D model from these rooms. Drag to move, pull the corners to resize, and fix any names.
            </p>
          </div>
          <ol className="hidden md:flex items-center gap-2 text-xs font-bold">
            {['Upload plan', 'Check rooms', 'See 2D & 3D'].map((step, i) => {
              const done = i === 0 ? !!plan : false
              const current = i === (plan ? 1 : 0)
              return (
                <li key={step} className={clsx('flex items-center gap-1.5 px-2.5 py-1 rounded-full border',
                  current ? 'bg-indigo-600 text-white border-indigo-600'
                    : done ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-slate-400 border-slate-200')}>
                  {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>{i + 1}</span>} {step}
                </li>
              )
            })}
          </ol>
        </div>

        {!plan ? (
          <UploadPanel uploading={uploading} onFile={onFile} onPick={() => fileRef.current?.click()} />
        ) : (
          <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
            {/* ── plan canvas ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 lg:sticky lg:top-24">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <button type="button" onClick={() => { setDrawMode((v) => !v); setSelected(null) }}
                  className={clsx('px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border',
                    drawMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50')}>
                  {drawMode ? <SquareDashedMousePointer className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {drawMode ? 'Drag over a room to add it' : 'Add a room'}
                </button>
                {selected !== null && rooms[selected] && (
                  <button type="button" onClick={() => removeRoom(selected)}
                    className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100">
                    <Trash2 className="w-4 h-4" /> Remove {rooms[selected].label}
                  </button>
                )}
                <span className="ml-auto text-[11px] text-slate-400 hidden sm:inline">
                  Plan {planWidth.toFixed(2)} m × {planDepth.toFixed(2)} m
                </span>
              </div>

              <div ref={canvasRef}
                className={clsx('relative w-full select-none rounded-xl overflow-hidden border border-slate-100 bg-slate-50',
                  drawMode ? 'cursor-crosshair' : 'cursor-default')}
                style={{ aspectRatio: `${plan.image_w} / ${plan.image_h}`, touchAction: 'none' }}
                onPointerDown={onCanvasDown} onPointerMove={onCanvasMove} onPointerUp={onCanvasUp} onPointerCancel={onCanvasUp}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={plan.image_url} alt="Your floor plan" draggable={false}
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
                {rooms.map((room, i) => {
                  const [x0, y0, x1, y1] = norm(room.box)
                  const colour = TYPE_COLOUR[room.room_type] || '#64748B'
                  const active = selected === i
                  const { w, d } = dims(room.box)
                  return (
                    <div key={room.id || i}
                      onPointerDown={(e) => startMove(e, i)}
                      className={clsx('absolute rounded-[3px]', drawMode ? 'pointer-events-none' : 'cursor-move')}
                      style={{
                        left: `${x0 * 100}%`, top: `${y0 * 100}%`, width: `${(x1 - x0) * 100}%`, height: `${(y1 - y0) * 100}%`,
                        border: `${active ? 3 : 2}px solid ${colour}`, background: `${colour}${active ? '33' : '1A'}`,
                        zIndex: active ? 20 : 10,
                      }}>
                      <span className="absolute left-0 top-0 max-w-full truncate px-1.5 py-0.5 text-[10px] font-bold text-white rounded-br"
                        style={{ background: colour }}>
                        {room.label} · {w.toFixed(1)}×{d.toFixed(1)} m
                      </span>
                      {active && (['nw', 'ne', 'sw', 'se'] as const).map((c) => (
                        <span key={c} onPointerDown={(e) => startResize(e, i, c)}
                          className="absolute w-4 h-4 sm:w-3 sm:h-3 bg-white rounded-sm"
                          style={{
                            border: `2px solid ${colour}`,
                            left: c.includes('w') ? -7 : undefined, right: c.includes('e') ? -7 : undefined,
                            top: c.includes('n') ? -7 : undefined, bottom: c.includes('s') ? -7 : undefined,
                            cursor: c === 'nw' || c === 'se' ? 'nwse-resize' : 'nesw-resize',
                          }} />
                      ))}
                    </div>
                  )
                })}
                {draft && (() => {
                  const [x0, y0, x1, y1] = norm(draft)
                  return <div className="absolute border-2 border-dashed border-indigo-600 bg-indigo-500/10 z-30"
                    style={{ left: `${x0 * 100}%`, top: `${y0 * 100}%`, width: `${(x1 - x0) * 100}%`, height: `${(y1 - y0) * 100}%` }} />
                })()}
              </div>
            </div>

            {/* ── side panel ── */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-start gap-2 text-xs text-slate-600">
                  <ScanLine className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-slate-800">
                      {plan.method === 'gemini' ? 'Rooms read by Gemini vision' : 'Rooms detected from the wall lines'}
                    </p>
                    {(plan.notes || []).map((n) => <p key={n}>{n}</p>)}
                  </div>
                </div>
              </div>

              {/* Scale */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
                <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-indigo-600" /> Scale
                </h2>
                <p className="text-[11px] text-slate-500">
                  Pick a room whose size is printed on your plan and type its <b>width</b> (left to right). Everything else scales with it.
                </p>
                <div className="flex flex-wrap gap-2">
                  <select value={calibRoom} onChange={(e) => setCalibRoom(Number(e.target.value))}
                    className="flex-1 min-w-[120px] px-2 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white">
                    {rooms.map((r, i) => <option key={r.id || i} value={i}>{r.label}</option>)}
                  </select>
                  <input value={calibValue} onChange={(e) => setCalibValue(e.target.value)}
                    placeholder={calibUnit === 'ft' ? `11'0"` : '3.35'}
                    className="w-20 px-2 py-2 rounded-lg border border-slate-200 text-xs font-semibold" />
                  <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-bold">
                    {(['ft', 'm'] as const).map((u) => (
                      <button key={u} type="button" onClick={() => setCalibUnit(u)}
                        className={clsx('px-2.5', calibUnit === u ? 'bg-slate-900 text-white' : 'bg-white text-slate-500')}>{u}</button>
                    ))}
                  </div>
                  <button type="button" onClick={applyCalibration}
                    className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold">Set</button>
                </div>
                <label className="flex items-center justify-between gap-3 text-xs text-slate-600">
                  <span>Whole plan width</span>
                  <span className="flex items-center gap-1">
                    <input type="number" min={2} max={80} step={0.05} value={planWidth}
                      onChange={(e) => setPlanWidth(Math.max(0, Number(e.target.value)))}
                      className="w-24 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-right" /> m
                  </span>
                </label>
              </div>

              {/* Rooms */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-extrabold text-slate-900">Rooms ({rooms.length})</h2>
                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">{planBhk}</span>
                </div>
                {rooms.length === 0 && (
                  <p className="text-xs text-slate-500 flex items-center gap-2"><Info className="w-4 h-4" /> Use “Add a room” and drag over each room on the plan.</p>
                )}
                <ul className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
                  {rooms.map((room, i) => {
                    const { w, d } = dims(room.box)
                    const colour = TYPE_COLOUR[room.room_type] || '#64748B'
                    return (
                      <li key={room.id || i} onClick={() => setSelected(i)}
                        className={clsx('rounded-xl border p-2.5 space-y-2 cursor-pointer transition',
                          selected === i ? 'border-indigo-400 bg-indigo-50/40' : 'border-slate-200 hover:border-slate-300')}>
                        <div className="flex items-center gap-2">
                          <i className="w-3 h-3 rounded-sm shrink-0" style={{ background: colour }} />
                          <input value={room.label} maxLength={40}
                            onChange={(e) => updateRoom(i, { label: e.target.value })}
                            className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-slate-200 text-xs font-bold" />
                          <button type="button" onClick={(e) => { e.stopPropagation(); removeRoom(i) }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Remove room">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <select value={room.room_type} onChange={(e) => changeType(i, e.target.value)}
                            className="flex-1 px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold bg-white">
                            {(data?.room_types || []).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                          <span className="text-[10px] text-slate-500 whitespace-nowrap" title={`${ftIn(w)} × ${ftIn(d)}`}>
                            {w.toFixed(2)} × {d.toFixed(2)} m
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>

              {bhkMismatch && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900 space-y-2">
                  <p>Your plan has <b>{planBhk}</b>, but this project is set to <b>{projectBhkLabel}</b>.</p>
                  {data?.bhk_locked ? (
                    <p className="text-amber-700">{data.bhk_locked}</p>
                  ) : (
                    <label className="flex items-center gap-2 font-semibold">
                      <input type="checkbox" checked={syncBhk} onChange={(e) => setSyncBhk(e.target.checked)} />
                      Also change the project to {planBhk}
                    </label>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <button type="button" onClick={generate} disabled={saving || !rooms.length}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-extrabold flex items-center justify-center gap-2 disabled:opacity-50 shadow-md">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  {saving ? 'Building your 2D plan and 3D model…' : 'Generate 2D plan & 3D model'}
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="flex-1 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {uploading ? 'Reading plan…' : 'Upload a different plan'}
                  </button>
                  <button type="button" onClick={redetect} disabled={uploading}
                    className="flex-1 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                    <ScanLine className="w-3.5 h-3.5" /> Re-detect rooms
                  </button>
                  {data?.active && (
                    <button type="button" onClick={useStandard}
                      className="flex-1 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-600">
                      Use standard layout
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function UploadPanel({ uploading, onFile, onPick }: {
  uploading: boolean
  onFile: (f: File | undefined | null) => void
  onPick: () => void
}) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFile(e.dataTransfer.files?.[0]) }}
      className={clsx('max-w-2xl mx-auto bg-white rounded-2xl border-2 border-dashed p-10 text-center shadow-sm transition',
        over ? 'border-indigo-500 bg-indigo-50/40' : 'border-slate-200')}>
      {uploading ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
          <p className="font-bold text-slate-800">Reading your floor plan…</p>
          <p className="text-xs text-slate-500">Finding walls, doors and rooms. This takes a few seconds.</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Upload className="w-7 h-7" />
          </div>
          <p className="font-extrabold text-slate-900 text-lg">Upload your floor plan</p>
          <p className="text-sm text-slate-500 max-w-md">
            A brochure or architect plan works best — JPG, PNG or WebP up to 10 MB. We find the rooms, you check them,
            and your 2D plan and 3D model are built from it.
          </p>
          <button type="button" onClick={onPick}
            className="mt-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-extrabold flex items-center gap-2">
            <Upload className="w-4 h-4" /> Choose plan image
          </button>
          <p className="text-[11px] text-slate-400">or drop the file here</p>
        </div>
      )}
    </div>
  )
}

export default function PlanTracePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    }>
      <PlanTraceContent />
    </Suspense>
  )
}
