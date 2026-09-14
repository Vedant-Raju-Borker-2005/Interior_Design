'use client'

/**
 * Item tracking with the vendor and technician tracks kept apart.
 *
 * Feedback 3.1–3.5: the old table had one dropdown mixing supplier steps
 * (production, dispatch) with the installer's step (installed), and photos were
 * uploaded somewhere else entirely. Here every item shows its product, both
 * tracks, and its own photos in one place, and each viewer only gets the
 * controls for the track they own.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { Camera, Lock, Package, Truck, Wrench, ImageOff, Loader2 } from 'lucide-react'
import { itemTrackingAPI } from '@/lib/api'

type StatusOption = { value: string; label: string }

type Photo = { url: string; caption?: string; stage?: string; uploaded_at?: string }

type TrackedItem = {
  id: string
  room_name: string
  item_name: string
  product?: { id: string; name: string; sku?: string; category?: string; thumbnail_url?: string } | null
  vendor_status: string
  vendor_status_label: string
  technician_status: string
  technician_status_label: string
  awaiting_handover: boolean
  expected_date?: string
  handover_at?: string | null
  installed_at?: string | null
  photos: Photo[]
  photo_count: number
}

type Permissions = {
  project_role: string | null
  view: string
  can_move_vendor_track: boolean
  can_move_technician_track: boolean
  can_upload_photos: boolean
}

const TECH_TONE: Record<string, string> = {
  NOT_RECEIVED: 'bg-slate-100 text-slate-500 border-slate-200',
  RECEIVED: 'bg-sky-50 text-sky-700 border-sky-200',
  INSTALLATION: 'bg-amber-50 text-amber-700 border-amber-200',
  INSTALLED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SNAG: 'bg-rose-50 text-rose-700 border-rose-200',
}

const VENDOR_TONE: Record<string, string> = {
  ORDERED: 'bg-slate-100 text-slate-600 border-slate-200',
  ACCEPTED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  IN_PRODUCTION: 'bg-violet-50 text-violet-700 border-violet-200',
  READY: 'bg-blue-50 text-blue-700 border-blue-200',
  DISPATCHED: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

function Thumb({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
        <Package className="w-6 h-6 text-slate-300" />
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-50"
    />
  )
}

export default function ItemTrackingBoard({
  projectId,
  viewAs,
  refreshKey,
  onChanged,
  renderAssignee,
  renderActions,
}: {
  projectId: string
  /** Pass 'technician' to force the installer-only view. */
  viewAs?: 'technician'
  /** Bump to reload (e.g. after the page repopulates default rows). */
  refreshKey?: number | string
  onChanged?: () => void
  renderAssignee?: (item: TrackedItem) => React.ReactNode
  renderActions?: (item: TrackedItem) => React.ReactNode
}) {
  const [items, setItems] = useState<TrackedItem[]>([])
  const [perms, setPerms] = useState<Permissions | null>(null)
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [vendorOptions, setVendorOptions] = useState<StatusOption[]>([])
  const [techOptions, setTechOptions] = useState<StatusOption[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  const load = useCallback(async () => {
    try {
      const [list, v, t] = await Promise.all([
        itemTrackingAPI.list(projectId, viewAs),
        itemTrackingAPI.statuses('vendor'),
        itemTrackingAPI.statuses('technician'),
      ])
      setItems(list.data.items || [])
      setPerms(list.data.permissions || null)
      setSummary(list.data.summary || {})
      setVendorOptions(v.data.statuses || [])
      setTechOptions(t.data.statuses || [])
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Could not load item tracking')
    } finally {
      setLoading(false)
    }
  }, [projectId, viewAs])

  useEffect(() => { load() }, [load, refreshKey])

  const technicianOnly = viewAs === 'technician' || perms?.view === 'technician'

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key)
    try {
      await action()
      toast.success(success)
      await load()
      onChanged?.()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Update failed')
    } finally {
      setBusy(null)
    }
  }

  const onPhoto = (item: TrackedItem, file?: File | null) => {
    if (!file) return
    run(
      `photo-${item.id}`,
      () => itemTrackingAPI.uploadPhoto(item.id, file, { stage: item.technician_status }),
      `Photo added to ${item.item_name}`,
    )
  }

  if (loading) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-8 shadow-sm flex items-center justify-center gap-2 text-xs font-bold text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading items…
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
            {technicianOnly ? 'My Installations' : 'Item Sourcing & Fitments'}
          </h3>
          <p className="text-[10px] text-slate-400 max-w-md">
            {technicianOnly
              ? 'Items handed over to you. Update installation status and add site photos on the item itself.'
              : 'Supplier progress and on-site installation are tracked separately. The installer track opens once the item is delivered.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
          {!technicianOnly && (
            <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1">
              <Truck className="w-3 h-3" /> With vendor {summary.with_vendor ?? 0}
            </span>
          )}
          <span className="px-2 py-1 rounded-full bg-sky-50 text-sky-700 flex items-center gap-1">
            <Package className="w-3 h-3" /> Handed over {summary.handed_over ?? 0}
          </span>
          <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 flex items-center gap-1">
            <Wrench className="w-3 h-3" /> Installed {summary.installed ?? 0}
          </span>
          {(summary.snags ?? 0) > 0 && (
            <span className="px-2 py-1 rounded-full bg-rose-50 text-rose-700">Snags {summary.snags}</span>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 font-semibold">
          {technicianOnly
            ? 'Nothing has been delivered to site yet. Items appear here once the vendor hands them over.'
            : 'No items are being tracked for this project yet.'}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
          {items.map((item) => {
            const photoBusy = busy === `photo-${item.id}`
            return (
              <li key={item.id} className="p-4 grid grid-cols-1 xl:grid-cols-12 gap-4 hover:bg-slate-50/40">
                {/* Product — 3.5: which item this is, at a glance */}
                <div className="xl:col-span-4 flex gap-3 min-w-0">
                  <Thumb src={item.product?.thumbnail_url} alt={item.item_name} />
                  <div className="min-w-0">
                    <span className="text-[9px] bg-slate-100 border border-slate-200 text-slate-500 rounded px-1.5 py-0.5 uppercase font-bold">
                      {item.room_name?.replace(/_/g, ' ')}
                    </span>
                    <p className="font-bold text-slate-800 text-sm mt-1 truncate">{item.item_name}</p>
                    {item.product?.sku && <p className="text-[10px] font-mono text-slate-400">{item.product.sku}</p>}
                    {item.expected_date && (
                      <p className="text-[10px] text-slate-400 font-semibold">Expected {item.expected_date}</p>
                    )}
                  </div>
                </div>

                {/* Tracks — 3.1: two separate fields, never one mixed list */}
                <div className={clsx('grid gap-3', technicianOnly ? 'xl:col-span-3' : 'xl:col-span-5 sm:grid-cols-2')}>
                  {!technicianOnly && (
                    <div>
                      <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider flex items-center gap-1 mb-1">
                        <Truck className="w-3 h-3" /> Vendor status
                      </span>
                      {perms?.can_move_vendor_track ? (
                        <select
                          value={item.vendor_status}
                          disabled={busy === `vendor-${item.id}`}
                          onChange={(e) =>
                            run(`vendor-${item.id}`,
                              () => itemTrackingAPI.setVendorStatus(item.id, { vendor_status: e.target.value }),
                              'Vendor status updated')
                          }
                          className="w-full bg-white border border-slate-200 text-[11px] font-bold text-slate-700 rounded-lg p-1.5"
                        >
                          {vendorOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : (
                        <span className={clsx('inline-block px-2 py-1 rounded-lg border text-[11px] font-bold', VENDOR_TONE[item.vendor_status])}>
                          {item.vendor_status_label}
                        </span>
                      )}
                    </div>
                  )}

                  <div>
                    <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider flex items-center gap-1 mb-1">
                      <Wrench className="w-3 h-3" /> {technicianOnly ? 'Installation' : 'Technician status'}
                    </span>
                    {item.awaiting_handover ? (
                      // 3.2 — nothing for the installer to do until handover.
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-slate-300 text-[11px] font-bold text-slate-400">
                        <Lock className="w-3 h-3" /> Awaiting delivery
                      </span>
                    ) : perms?.can_move_technician_track ? (
                      <select
                        value={item.technician_status}
                        disabled={busy === `tech-${item.id}`}
                        onChange={(e) =>
                          run(`tech-${item.id}`,
                            () => itemTrackingAPI.setTechnicianStatus(item.id, { technician_status: e.target.value }),
                            'Installation status updated')
                        }
                        className={clsx('w-full border text-[11px] font-bold rounded-lg p-1.5', TECH_TONE[item.technician_status])}
                      >
                        {techOptions
                          .filter((o) => o.value !== 'NOT_RECEIVED')
                          .map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <span className={clsx('inline-block px-2 py-1 rounded-lg border text-[11px] font-bold', TECH_TONE[item.technician_status])}>
                        {item.technician_status_label}
                      </span>
                    )}
                  </div>
                </div>

                {/* Photos — 3.4: uploaded against this item, visible right here */}
                <div className={clsx(technicianOnly ? 'xl:col-span-3' : 'xl:col-span-2')}>
                  <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider flex items-center gap-1 mb-1">
                    <Camera className="w-3 h-3" /> Photos ({item.photo_count})
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.photos.slice(-3).map((p) => (
                      <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer" title={p.caption || p.stage}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt={p.caption || item.item_name} loading="lazy"
                          className="w-9 h-9 rounded-lg object-cover border border-slate-200" />
                      </a>
                    ))}
                    {item.photo_count > 3 && (
                      <span className="text-[10px] font-bold text-slate-400">+{item.photo_count - 3}</span>
                    )}
                    {item.photo_count === 0 && !perms?.can_upload_photos && (
                      <span className="text-[10px] text-slate-300 flex items-center gap-1"><ImageOff className="w-3 h-3" /> none</span>
                    )}
                    {perms?.can_upload_photos && !item.awaiting_handover && (
                      <>
                        <input
                          ref={(el) => { fileInputs.current[item.id] = el }}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => { onPhoto(item, e.target.files?.[0]); e.target.value = '' }}
                        />
                        <button
                          type="button"
                          disabled={photoBusy}
                          onClick={() => fileInputs.current[item.id]?.click()}
                          className="w-9 h-9 rounded-lg border border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 flex items-center justify-center transition"
                          title="Add a site photo to this item"
                        >
                          {photoBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {(renderAssignee || renderActions) && (
                  <div className="xl:col-span-1 flex xl:flex-col items-start xl:items-end justify-between gap-2 text-xs">
                    {renderAssignee?.(item)}
                    {renderActions?.(item)}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
