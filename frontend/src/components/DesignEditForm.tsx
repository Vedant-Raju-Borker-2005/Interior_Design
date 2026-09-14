'use client'

/**
 * "Edit design" form for the design studio.
 *
 * Writes to the project's real preference fields (the same ones onboarding
 * fills), then the studio reloads the 2D plan and 3D model from them.
 */
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { X, Lock, Check, Loader2, PencilRuler } from 'lucide-react'
import { designStudioAPI, type DesignValues } from '@/lib/api'

// The exact swatches the 3D model paints with.
const COLOR_HEX: Record<string, string> = {
  'Warm White': '#F4EFE8', 'Off White': '#F7F5F0', 'Soft Grey': '#C9CBC8', 'Greige': '#CFC6B8',
  'Charcoal Grey': '#3C3F43', 'Ivory': '#F2E8D5', 'Terracotta': '#C1663F', 'Clay Beige': '#C9A98A',
  'Olive Green': '#6B7248', 'Sand': '#D9C7A8', 'Rust': '#A34D2A', 'Warm Taupe': '#9C8672',
  'Deep Emerald': '#14553F', 'Royal Blue': '#23408E', 'Wine Maroon': '#6E1F2E', 'Champagne Gold': '#C8A96A',
  'Onyx Black': '#1C1C1E', 'Pearl Grey': '#D6D3CD', 'Blush Pink': '#E7C4C0', 'Mustard Yellow': '#D9A521',
  'Teal': '#1F7A78', 'Coral': '#E4735B', 'Sage Green': '#A7B79C', 'Burnt Orange': '#C25A2B',
}
const COLOR_GROUPS: Record<string, string[]> = {
  Neutral: ['Warm White', 'Off White', 'Soft Grey', 'Greige', 'Charcoal Grey', 'Ivory'],
  Earthy: ['Terracotta', 'Clay Beige', 'Olive Green', 'Sand', 'Rust', 'Warm Taupe'],
  'Luxury / Premium': ['Deep Emerald', 'Royal Blue', 'Wine Maroon', 'Champagne Gold', 'Onyx Black', 'Pearl Grey'],
  Accent: ['Blush Pink', 'Mustard Yellow', 'Teal', 'Coral', 'Sage Green', 'Burnt Orange'],
}
const WOOD_HEX: Record<string, string> = {
  'Oak Laminate': '#C7A57B', 'Teak Laminate': '#9A6B3F', 'Walnut Laminate': '#5B3A26',
}

type Option = { value: string | number; label: string }

export default function DesignEditForm({
  projectId,
  open,
  onClose,
  onSaved,
}: {
  projectId: string
  open: boolean
  onClose: () => void
  onSaved: (payload: any) => void
}) {
  const [data, setData] = useState<any>(null)
  const [form, setForm] = useState<DesignValues | null>(null)
  const [saving, setSaving] = useState(false)

  // Load once per opening. onClose is deliberately not a dependency: the page
  // re-renders often (viewer messages), and refetching would wipe unsaved edits.
  useEffect(() => {
    if (!open) return
    setData(null)
    setForm(null)
    designStudioAPI.get(projectId)
      .then((r) => { setData(r.data); setForm(r.data.values) })
      .catch((err) => { toast.error(err?.response?.data?.detail || 'Could not load the design'); onClose() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId])

  const changed = useMemo(() => {
    if (!data || !form) return {}
    const out: Partial<DesignValues> = {}
    ;(Object.keys(form) as (keyof DesignValues)[]).forEach((k) => {
      if (JSON.stringify(form[k]) !== JSON.stringify(data.values[k])) (out as any)[k] = form[k]
    })
    return out
  }, [data, form])

  if (!open) return null

  const set = <K extends keyof DesignValues>(key: K, value: DesignValues[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f))

  const toggleColor = (name: string) => {
    if (!form) return
    const has = form.colors.includes(name)
    if (has && form.colors.length === 1) return
    set('colors', has ? form.colors.filter((c) => c !== name) : [...form.colors, name].slice(-3))
  }

  const save = async () => {
    if (!Object.keys(changed).length) { onClose(); return }
    setSaving(true)
    try {
      const r = await designStudioAPI.update(projectId, changed)
      toast.success('Design updated — redrawing your 2D plan and 3D model')
      onSaved(r.data)
      onClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Could not save the design')
    } finally {
      setSaving(false)
    }
  }

  const opts = data?.options || {}
  const bhkLock: string | null = data?.locks?.bhk_type || null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-3xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <PencilRuler className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Edit design</h2>
              <p className="text-xs text-slate-500">Changes are saved to your project and redrawn in the 2D plan and 3D model.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"><X className="w-4 h-4" /></button>
        </div>

        {!form ? (
          <div className="flex-1 flex items-center justify-center py-20 text-slate-400 text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* Home */}
            <Section title="Home">
              <div className="grid sm:grid-cols-4 gap-3">
                <Field label="BHK" lock={bhkLock}>
                  <select disabled={!!bhkLock} value={form.bhk_type} onChange={(e) => set('bhk_type', e.target.value)} className={inputCls}>
                    {(opts.bhk_type || []).map((b: string) => <option key={b} value={b}>{b.replace('BHK', ' BHK')}</option>)}
                  </select>
                </Field>
                <Field label="City">
                  <select value={form.city || ''} onChange={(e) => set('city', e.target.value)} className={inputCls}>
                    <option value="" disabled>Select…</option>
                    {(opts.city || []).map((c: string) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Scope">
                  <select value={form.scope || ''} onChange={(e) => set('scope', e.target.value)} className={inputCls}>
                    <option value="" disabled>Select…</option>
                    {(opts.scope || []).map((o: Option) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                <Field label="Timeline">
                  <select value={form.timeline || ''} onChange={(e) => set('timeline', e.target.value)} className={inputCls}>
                    <option value="" disabled>Select…</option>
                    {(opts.timeline || []).map((o: Option) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
              </div>
            </Section>

            {/* Budget & quality */}
            <Section title="Budget & material quality">
              <div className="flex flex-wrap gap-2">
                {(opts.budget || []).map((o: Option) => (
                  <Pill key={o.value} on={Number(form.budget) === Number(o.value)} onClick={() => set('budget', Number(o.value))}>{o.label}</Pill>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {(opts.quality || []).map((o: Option) => (
                  <Pill key={o.value} on={form.quality === o.value} onClick={() => set('quality', String(o.value))}>{o.label}</Pill>
                ))}
              </div>
            </Section>

            {/* Style */}
            <Section title="Design style">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(opts.style || []).map((o: Option) => (
                  <button key={o.value} type="button" onClick={() => set('style', String(o.value))}
                    className={clsx('rounded-xl border-2 px-3 py-2.5 text-sm font-bold text-left transition',
                      form.style === o.value ? 'border-indigo-600 bg-indigo-50 text-indigo-800' : 'border-slate-200 text-slate-700 hover:border-slate-300')}>
                    {o.label}
                  </button>
                ))}
              </div>
            </Section>

            {/* Materials */}
            <Section title="Materials">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Wood laminate">
                  <div className="flex flex-wrap gap-2">
                    {(opts.wood || []).map((w: string) => (
                      <Pill key={w} on={form.wood === w} onClick={() => set('wood', w)}>
                        <i className="w-3 h-3 rounded-full border border-black/10" style={{ background: WOOD_HEX[w] }} /> {w.replace(' Laminate', '')}
                      </Pill>
                    ))}
                  </div>
                </Field>
                <Field label="Upholstery">
                  <div className="flex flex-wrap gap-2">
                    {(opts.fabric || []).map((f: string) => (
                      <Pill key={f} on={form.fabric === f} onClick={() => set('fabric', f)}>{f}</Pill>
                    ))}
                  </div>
                </Field>
              </div>
            </Section>

            {/* Colours */}
            <Section title={`Colours (${form.colors.length}/3)`}>
              <div className="space-y-2">
                {Object.entries(COLOR_GROUPS).map(([group, names]) => (
                  <div key={group} className="flex flex-wrap items-center gap-1.5">
                    <span className="w-28 text-[10px] font-bold uppercase tracking-wider text-slate-400">{group}</span>
                    {names.filter((n) => (opts.colors || []).includes(n)).map((n) => {
                      const on = form.colors.includes(n)
                      return (
                        <button key={n} type="button" onClick={() => toggleColor(n)}
                          className={clsx('inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border text-xs transition',
                            on ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300')}>
                          <i className="w-4 h-4 rounded-full border border-black/15 flex items-center justify-center" style={{ background: COLOR_HEX[n] }}>
                            {on && <Check className="w-2.5 h-2.5" style={{ color: ['Onyx Black', 'Charcoal Grey', 'Deep Emerald', 'Royal Blue', 'Wine Maroon', 'Olive Green', 'Rust', 'Teal'].includes(n) ? '#fff' : '#111' }} />}
                          </i>
                          {n}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">Pick one to three. The first acts as the dominant colour.</p>
            </Section>
          </div>
        )}

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50">
          <span className="text-xs text-slate-500">
            {Object.keys(changed).length ? `${Object.keys(changed).length} change${Object.keys(changed).length > 1 ? 's' : ''}` : 'No changes yet'}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-white">Cancel</button>
            <button onClick={save} disabled={saving || !form}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:opacity-60 flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save & update 2D / 3D
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white disabled:bg-slate-100 disabled:text-slate-400'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2.5">{title}</h3>
      {children}
    </section>
  )
}

function Field({ label, lock, children }: { label: string; lock?: string | null; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-center gap-1 text-xs font-semibold text-slate-600 mb-1">
        {label} {lock && <Lock className="w-3 h-3 text-slate-400" />}
      </span>
      {children}
      {lock && <span className="block text-[10px] text-slate-400 mt-1 leading-snug">{lock}</span>}
    </label>
  )
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={clsx('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition',
        on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300')}>
      {children}
    </button>
  )
}
