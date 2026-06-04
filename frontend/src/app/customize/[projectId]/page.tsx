'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { projectsAPI, catalogAPI } from '@/lib/api'
import Navbar from '@/components/Navbar'
import toast from 'react-hot-toast'
import {
  ChevronRight, Palette, Sliders, ShoppingBag, ArrowRight,
  RotateCcw, Save, Sparkles
} from 'lucide-react'
import clsx from 'clsx'

// Dynamic import to avoid SSR issues with Three.js
const RoomCanvas3D = dynamic(() => import('@/components/RoomCanvas3D'), { ssr: false })

const STYLES = [
  { id: 'modern', label: 'Modern' },
  { id: 'scandinavian', label: 'Scandinavian' },
  { id: 'indian_contemporary', label: 'Indian Contemporary' },
  { id: 'luxury', label: 'Luxury' },
  { id: 'mediterranean', label: 'Mediterranean' },
  { id: 'boho', label: 'Boho' },
]

const WALL_COLORS = [
  { value: '#ffffff', label: 'Pure White' },
  { value: '#f5f5f0', label: 'Off White' },
  { value: '#e8e4d9', label: 'Warm Sand' },
  { value: '#d4c5b0', label: 'Latte' },
  { value: '#b8c5c2', label: 'Sage' },
  { value: '#c8d4dd', label: 'Sky Blue' },
  { value: '#ddd0e8', label: 'Lavender' },
  { value: '#2d3748', label: 'Charcoal' },
]

const ROOM_LABELS: Record<string, string> = {
  living_room: '🛋️ Living Room',
  bedroom_master: '🛏️ Master Bedroom',
  bedroom_2: '🛌 Bedroom 2',
  bedroom_3: '🛌 Bedroom 3',
  bedroom_4: '🛌 Bedroom 4',
  bedroom_5: '🛌 Bedroom 5',
  kitchen: '🍳 Kitchen',
  bathroom: '🚿 Bathroom',
  bathroom_2: '🚿 Bathroom 2',
  bathroom_3: '🚿 Bathroom 3',
  balcony: '🌿 Balcony',
  dining_room: '🍽️ Dining Room',
  home_office: '💻 Home Office',
}

export default function CustomizePage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const [project, setProject] = useState<any>(null)
  const [activeRoomIdx, setActiveRoomIdx] = useState(0)
  const [products, setProducts] = useState<any[]>([])
  const [selectedProducts, setSelectedProducts] = useState<Record<string, Set<string>>>({})
  const [roomStyles, setRoomStyles] = useState<Record<string, string>>({})
  const [wallColors, setWallColors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'style' | 'products'>('style')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await projectsAPI.get(projectId)
        setProject(res.data)
        if (res.data.rooms?.length > 0) {
          fetchProducts(res.data.rooms[0].room_type)
        }
      } catch {
        toast.error('Failed to load project')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [projectId])

  const activeRoom = project?.rooms?.[activeRoomIdx]

  const fetchProducts = async (roomType: string) => {
    try {
      const res = await catalogAPI.products({ room_type: roomType, limit: 30 })
      setProducts(res.data.items || [])
    } catch {}
  }

  useEffect(() => {
    if (activeRoom) {
      fetchProducts(activeRoom.room_type)
    }
  }, [activeRoomIdx, activeRoom?.room_type])

  const toggleProduct = (productId: string) => {
    if (!activeRoom) return
    setSelectedProducts((prev) => {
      const roomSet = new Set(prev[activeRoom.id] || [])
      if (roomSet.has(productId)) roomSet.delete(productId)
      else roomSet.add(productId)
      return { ...prev, [activeRoom.id]: roomSet }
    })
  }

  const totalPrice = Object.entries(selectedProducts).reduce((sum, [roomId, productSet]) => {
    return sum + Array.from(productSet).reduce((rSum, pid) => {
      const p = products.find((p: any) => p.id === pid)
      return rSum + (p?.price || 0)
    }, 0)
  }, 0)

  const handleSave = async () => {
    if (!activeRoom) return
    setSaving(true)
    try {
      // Save style preference
      const style = roomStyles[activeRoom.id] || 'modern'
      const color = wallColors[activeRoom.id] ? [wallColors[activeRoom.id]] : []
      await projectsAPI.updateRoom(projectId, activeRoom.id, {
        style_preference: style,
        color_palette: color,
      })

      // Save selected products as room items
      const productSet = selectedProducts[activeRoom.id] || new Set()
      for (const pid of Array.from(productSet)) {
        const p = products.find((p: any) => p.id === pid)
        if (p) {
          await projectsAPI.addRoomItem(projectId, activeRoom.id, {
            product_id: pid,
            qty: 1,
          })
        }
      }
      toast.success(`${ROOM_LABELS[activeRoom.room_type] || 'Room'} saved!`)
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner w-12 h-12 mx-auto mb-4" />
          <p className="text-slate-500">Loading your project…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <Navbar />

      {/* Top bar */}
      <div className="fixed top-16 left-0 right-0 z-40 bg-slate-900/90 backdrop-blur border-b border-white/10 px-4 py-3">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          <div>
            <div className="text-white font-semibold">{project?.property_name}</div>
            <div className="text-slate-400 text-xs">{project?.bhk_type} • {project?.city}</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-300">
              Selection: <span className="text-amber-400 font-bold">₹{totalPrice.toLocaleString('en-IN')}</span>
            </div>
            <button
              onClick={() => router.push(`/visualize/${projectId}`)}
              className="btn-primary py-2 text-sm"
            >
              <Sparkles className="w-4 h-4" /> AI Visualise
            </button>
            <button
              onClick={() => router.push(`/quotation/${projectId}`)}
              className="btn-secondary py-2 text-sm"
            >
              Get Quote <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 pt-32">

        {/* Left: Room tabs */}
        <div className="w-52 bg-slate-900 border-r border-white/10 fixed left-0 top-32 bottom-0 overflow-y-auto z-30">
          <div className="p-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">Rooms</div>
            {project?.rooms?.map((room: any, i: number) => (
              <button
                key={room.id}
                onClick={() => setActiveRoomIdx(i)}
                className={clsx(
                  'w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all mb-1',
                  i === activeRoomIdx
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                )}
              >
                <div className="font-medium">{ROOM_LABELS[room.room_type] || room.room_type}</div>
                {selectedProducts[room.id]?.size > 0 && (
                  <div className="text-xs text-indigo-300 mt-0.5">
                    {selectedProducts[room.id].size} items
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Center: 3D Canvas */}
        <div className="flex-1 ml-52 mr-80">
          <div className="h-full min-h-[calc(100vh-128px)]">
            {activeRoom && (
              <RoomCanvas3D
                roomType={activeRoom.room_type}
                wallColor={wallColors[activeRoom.id] || '#ffffff'}
                style={roomStyles[activeRoom.id]}
              />
            )}
          </div>

          {/* Room name overlay */}
          <div className="absolute bottom-6 left-64 right-84 flex justify-center pointer-events-none">
            <div className="glass px-4 py-2 rounded-xl text-white text-sm font-medium">
              {ROOM_LABELS[activeRoom?.room_type] || '3D Preview'} — Drag to orbit • Scroll to zoom
            </div>
          </div>
        </div>

        {/* Right: Controls panel */}
        <div className="w-80 bg-slate-900 border-l border-white/10 fixed right-0 top-32 bottom-0 overflow-y-auto z-30">

          {/* Panel tabs */}
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setActiveTab('style')}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors',
                activeTab === 'style' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-white'
              )}
            >
              <Palette className="w-4 h-4" /> Style
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors',
                activeTab === 'products' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-white'
              )}
            >
              <ShoppingBag className="w-4 h-4" /> Products {selectedProducts[activeRoom?.id]?.size > 0 && <span className="bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{selectedProducts[activeRoom?.id]?.size}</span>}
            </button>
          </div>

          <div className="p-4">
            {activeTab === 'style' ? (
              <div className="space-y-5">
                {/* Style selector */}
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Interior Style</div>
                  <div className="grid grid-cols-2 gap-2">
                    {STYLES.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => activeRoom && setRoomStyles((prev) => ({ ...prev, [activeRoom.id]: s.id }))}
                        className={clsx(
                          'p-2.5 rounded-lg text-xs font-medium border transition-all',
                          (roomStyles[activeRoom?.id] || 'modern') === s.id
                            ? 'border-indigo-500 bg-indigo-600 text-white'
                            : 'border-white/10 text-slate-400 hover:border-white/30 hover:text-white'
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Wall color */}
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Wall Color</div>
                  <div className="grid grid-cols-4 gap-2">
                    {WALL_COLORS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => activeRoom && setWallColors((prev) => ({ ...prev, [activeRoom.id]: c.value }))}
                        title={c.label}
                        className={clsx(
                          'w-full aspect-square rounded-lg border-2 transition-all',
                          (wallColors[activeRoom?.id] || '#ffffff') === c.value
                            ? 'border-indigo-400 scale-110 shadow-lg'
                            : 'border-transparent hover:border-white/30'
                        )}
                        style={{ backgroundColor: c.value }}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    Selected: {WALL_COLORS.find(c => c.value === (wallColors[activeRoom?.id] || '#ffffff'))?.label}
                  </div>
                </div>

                {/* Save button */}
                <button onClick={handleSave} disabled={saving} className="btn-primary w-full justify-center py-3">
                  {saving ? <div className="spinner w-4 h-4" /> : <><Save className="w-4 h-4" /> Save Room Settings</>}
                </button>
              </div>
            ) : (
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Products for {ROOM_LABELS[activeRoom?.room_type] || 'Room'}
                </div>
                {products.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">No products for this room</div>
                ) : (
                  <div className="space-y-2">
                    {products.map((p: any) => (
                      <label
                        key={p.id}
                        className={clsx(
                          'flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border',
                          selectedProducts[activeRoom?.id]?.has(p.id)
                            ? 'bg-indigo-900/50 border-indigo-500/50'
                            : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                        )}
                      >
                        <input
                          type="checkbox"
                          className="rounded border-slate-600 text-indigo-600 focus:ring-indigo-500"
                          checked={selectedProducts[activeRoom?.id]?.has(p.id) || false}
                          onChange={() => toggleProduct(p.id)}
                        />
                        <img
                          src={p.thumbnail_url || 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=80&h=80&fit=crop'}
                          alt={p.name}
                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white font-medium truncate">{p.name}</div>
                          <div className="text-xs text-indigo-400 font-semibold">₹{p.price.toLocaleString('en-IN')}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {/* Room subtotal */}
                {selectedProducts[activeRoom?.id]?.size > 0 && (
                  <div className="mt-4 p-3 bg-indigo-900/30 rounded-xl border border-indigo-500/30">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">{selectedProducts[activeRoom?.id]?.size} items selected</span>
                      <span className="text-indigo-400 font-bold">
                        ₹{Array.from(selectedProducts[activeRoom?.id]).reduce((s, pid) => {
                          const p = products.find((p: any) => p.id === pid)
                          return s + (p?.price || 0)
                        }, 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                )}

                <button onClick={handleSave} disabled={saving} className="btn-primary w-full justify-center py-3 mt-4">
                  {saving ? <div className="spinner w-4 h-4" /> : <><Save className="w-4 h-4" /> Save Selections</>}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
