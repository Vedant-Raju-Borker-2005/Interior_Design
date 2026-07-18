'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { projectsAPI, aiAPI, catalogAPI } from '@/lib/api'
import Navbar from '@/components/Navbar'
import RoomCanvas3D from '@/components/RoomCanvas3D'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, ArrowLeft, Clock, CheckCircle2, Download,
  Image as ImageIcon, RefreshCw, X, Layout, AlignLeft, Settings,
  ChevronLeft, ChevronRight
} from 'lucide-react'
import clsx from 'clsx'
import { getBestColorMatch, getColorHex } from '@/lib/colorUtils'

const STYLES = [
  { id: 'modern', label: 'Modern Luxury', emoji: '💎' },
  { id: 'scandinavian', label: 'Scandinavian Warmth', emoji: '🪵' },
  { id: 'indian_contemporary', label: 'Indian Contemporary', emoji: '🪔' },
]

const STYLE_RENDER_TEMPLATES: Record<string, string[]> = {
  modern: [
    'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&fit=crop',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&fit=crop',
    'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=800&fit=crop',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&fit=crop',
  ],
  scandinavian: [
    'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=800&fit=crop',
    'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800&fit=crop',
    'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=800&fit=crop',
    'https://images.unsplash.com/photo-1617806118233-18e1db207f62?w=800&fit=crop',
  ],
  indian_contemporary: [
    'https://images.unsplash.com/photo-1600121848594-d8644e57abab?w=800&fit=crop',
    'https://images.unsplash.com/photo-1582582624425-e17143e8f5c8?w=800&fit=crop',
    'https://images.unsplash.com/photo-1512915922686-57c11dde9b6b?w=800&fit=crop',
    'https://images.unsplash.com/photo-1618219908412-a29a1bb7b86e?w=800&fit=crop',
  ]
}

const FOUR_WALL_VIEWS: Record<string, { id: string; label: string; url: string }[]> = {
  living_room: [
    { id: 'lr_wall_a', label: 'Wall A (Entertainment Console)', url: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&fit=crop' },
    { id: 'lr_wall_b', label: 'Wall B (Sofa Lounge Wall)', url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&fit=crop' },
    { id: 'lr_wall_c', label: 'Wall C (Gallery & Art Display)', url: 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=800&fit=crop' },
    { id: 'lr_wall_d', label: 'Wall D (Balcony Window View)', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&fit=crop' },
  ],
  bedroom_master: [
    { id: 'bm_wall_a', label: 'Wall A (Bed & Accent Wall)', url: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=800&fit=crop' },
    { id: 'bm_wall_b', label: 'Wall B (Wardrobe & Dressing)', url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800&fit=crop' },
    { id: 'bm_wall_c', label: 'Wall C (Study Console Wall)', url: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=800&fit=crop' },
    { id: 'bm_wall_d', label: 'Wall D (Balcony Perspective)', url: 'https://images.unsplash.com/photo-1617806118233-18e1db207f62?w=800&fit=crop' },
  ],
  bedroom_2: [
    { id: 'b2_wall_a', label: 'Wall A (Bed & Accent Wall)', url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800&fit=crop' },
    { id: 'b2_wall_b', label: 'Wall B (Wardrobe & Dressing)', url: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=800&fit=crop' },
    { id: 'b2_wall_c', label: 'Wall C (Study Console Wall)', url: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=800&fit=crop' },
    { id: 'b2_wall_d', label: 'Wall D (Balcony Perspective)', url: 'https://images.unsplash.com/photo-1617806118233-18e1db207f62?w=800&fit=crop' },
  ],
  kitchen: [
    { id: 'k_wall_a', label: 'Wall A (Hob & Range Counter)', url: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&fit=crop' },
    { id: 'k_wall_b', label: 'Wall B (Sink & Dishwasher Counter)', url: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&fit=crop' },
    { id: 'k_wall_c', label: 'Wall C (Pantry & Fridge Tower)', url: 'https://images.unsplash.com/photo-1556912173-3bb406ef7e77?w=800&fit=crop' },
    { id: 'k_wall_d', label: 'Wall D (Breakfast Counter View)', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&fit=crop' },
  ],
  bathroom: [
    { id: 'bt_wall_a', label: 'Wall A (Vanity & Mirror Wall)', url: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&fit=crop' },
    { id: 'bt_wall_b', label: 'Wall B (Shower Glass Wall)', url: 'https://images.unsplash.com/photo-1604014237800-1c9102c219da?w=800&fit=crop' },
    { id: 'bt_wall_c', label: 'Wall C (WC & Flush Plate Wall)', url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&fit=crop' },
    { id: 'bt_wall_d', label: 'Wall D (Ventilation Glass Wall)', url: 'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=800&fit=crop' },
  ],
  balcony: [
    { id: 'bl_wall_a', label: 'Wall A (Railing & View Wall)', url: 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?w=800&fit=crop' },
    { id: 'bl_wall_b', label: 'Wall B (Accent Green Wall)', url: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=800&fit=crop' },
    { id: 'bl_wall_c', label: 'Wall C (Storage & Seating Wall)', url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&fit=crop' },
    { id: 'bl_wall_d', label: 'Wall D (Glass Sliding Door Wall)', url: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&fit=crop' },
  ]
}

const ROOM_LABELS: Record<string, string> = {
  living_room: 'Living Room',
  bedroom_master: 'Master Bedroom',
  bedroom_2: 'Bedroom 2',
  kitchen: 'Kitchen',
  bathroom: 'Bathroom',
  balcony: 'Balcony',
}

const BASE_VIEWS: Record<string, { id: string; label: string; url: string }[]> = {
  living_room: [
    { id: 'lr_view_1', label: 'Living Room View 1 (Main Wall Perspective)', url: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&h=800&fit=crop' },
    { id: 'lr_view_2', label: 'Living Room View 2 (Window Perspective)', url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&h=800&fit=crop' },
  ],
  bedroom_master: [
    { id: 'br_view_1', label: 'Bedroom View 1 (Bed Wall)', url: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=1200&h=800&fit=crop' },
    { id: 'br_view_2', label: 'Bedroom View 2 (Dresser perspective)', url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200&h=800&fit=crop' },
  ],
  bedroom_2: [
    { id: 'br2_view_1', label: 'Bedroom 2 View 1', url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200&h=800&fit=crop' },
  ],
  kitchen: [
    { id: 'k_view_1', label: 'Kitchen View 1 (Counter-top perspective)', url: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=1200&h=800&fit=crop' },
  ],
  bathroom: [
    { id: 'bt_view_1', label: 'Bathroom View 1 (Shower-glass perspective)', url: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=1200&h=800&fit=crop' },
  ],
}

export default function ControlledVisualizePage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const [project, setProject] = useState<any>(null)
  const [activeRoomIdx, setActiveRoomIdx] = useState(0)
  const [selectedStyle, setSelectedStyle] = useState('modern')
  
  // Rendering settings
  const [selectedBaseView, setSelectedBaseView] = useState<string>('')
  const [uploadedBaseImage, setUploadedBaseImage] = useState<string>('')
  const [layoutPrompt, setLayoutPrompt] = useState<string>('')
  
  // Custom setup states
  const [setupMode, setSetupMode] = useState<'default' | 'uploads' | 'dimensions'>('default')
  const [uploadedWalls, setUploadedWalls] = useState<Record<string, string>>({ A: '', B: '', C: '', D: '' })
  const [roomLength, setRoomLength] = useState('')
  const [roomWidth, setRoomWidth] = useState('')
  const [roomHeight, setRoomHeight] = useState('')
  const [hasPillar, setHasPillar] = useState(false)
  const [calculatedMetrics, setCalculatedMetrics] = useState<any>(null)
  const [clearanceCalculated, setClearanceCalculated] = useState(false)
  const [renderedWallImages, setRenderedWallImages] = useState<string[] | null>(null)

  const [renders, setRenders] = useState<any[]>([])
  const [currentRender, setCurrentRender] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null)

  // Swap / variant customization drawer
  const [swappingItem, setSwappingItem] = useState<any>(null)
  const [activeSwapImageIdx, setActiveSwapImageIdx] = useState(0)

  useEffect(() => {
    setActiveSwapImageIdx(0)
  }, [swappingItem?.id])
  const [alternativeProducts, setAlternativeProducts] = useState<any[]>([])
  const [swappingColor, setSwappingColor] = useState('')
  const [swappingFabric, setSwappingFabric] = useState('')
  const [swappingWoodFinish, setSwappingWoodFinish] = useState('')
  const [swappingSize, setSwappingSize] = useState('')
  const [swappingTexture, setSwappingTexture] = useState('')
  const [swappingCushionStyle, setSwappingCushionStyle] = useState('')
  const [savingSwap, setSavingSwap] = useState(false)

  // Uploaded room photo for img2img
  const [uploadedFileB64, setUploadedFileB64] = useState<string>('')
  const [uploadedFileMime, setUploadedFileMime] = useState<string>('image/jpeg')

  const activeRoom = project?.rooms?.[activeRoomIdx]
  const activeRoomItems = activeRoom?.items || []

  // Load project details
  const loadProject = async () => {
    try {
      const res = await projectsAPI.get(projectId)
      setProject(res.data)
    } catch {
      toast.error('Failed to load project details')
    }
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await loadProject()
      setLoading(false)
    }
    init()
    return () => { if (pollInterval) clearInterval(pollInterval) }
  }, [projectId])

  // Load renderings and pre-fill default parameters
  useEffect(() => {
    if (activeRoom) {
      // Set default base room view
      const baseViewsList = BASE_VIEWS[activeRoom.room_type] || []
      if (baseViewsList.length > 0) {
        setSelectedBaseView(baseViewsList[0].id)
      }

      // Generate a dynamic default layout prompt based on selected products
      const itemNames = activeRoomItems.map((it: any) => it.product?.name).filter(Boolean)
      if (itemNames.length > 0) {
        const itemPromptParts = activeRoomItems.map((it: any) => {
          const cat = it.product?.category?.toLowerCase() || ''
          const name = it.product?.name || 'Item'
          const col = it.custom_color ? ` (${it.custom_color})` : ''
          if (cat.includes('sofas')) {
            return `Place ${name}${col} against the main wall.`
          } else if (cat.includes('tables') && cat.includes('coffee')) {
            return `Place ${name} in front of the sofa.`
          } else if (cat.includes('tables') && cat.includes('side')) {
            return `Place two ${name} beside the sofa.`
          } else if (cat.includes('chairs')) {
            return `Place Accent Chair near the window.`
          } else if (cat.includes('rugs')) {
            return `Lay Area Rug centered under the coffee table.`
          }
          return `Arrange ${name} in the room.`
        })
        setLayoutPrompt(itemPromptParts.join(' ') + ' Maintain modern luxury aesthetic.')
      } else {
        setLayoutPrompt('Maintain clean, modern luxury aesthetic with minimalist furniture alignment.')
      }

      loadRoomRenders(activeRoom.id)
      setCurrentRender(null)
    }
  }, [activeRoomIdx, activeRoom?.id, activeRoomItems.length])

  const loadRoomRenders = async (roomId: string) => {
    try {
      const res = await aiAPI.roomRenders(roomId)
      setRenders(res.data.renders || [])
    } catch {}
  }

  const handleCalculateClearance = () => {
    const l = parseFloat(roomLength) || 12
    const w = parseFloat(roomWidth) || 10
    const h = parseFloat(roomHeight) || 9
    const vol = l * w * h
    const perimeter = 2 * (l + w)
    const pillarDeduction = hasPillar ? 1.5 : 0
    setCalculatedMetrics({
      volume: vol,
      perimeter: perimeter,
      usableArea: l * w - pillarDeduction,
    })
    setClearanceCalculated(true)
    toast.success('Clearance metrics calculated successfully!')
  }

  const handleWallUpload = (wallKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setUploadedWalls(prev => ({
        ...prev,
        [wallKey]: reader.result as string
      }))
      toast.success(`Wall ${wallKey} photo uploaded!`)
    }
    reader.readAsDataURL(file)
  }

  // Generate controlled visualization pipeline
  const handleGenerate = async () => {
    if (!activeRoom) return
    setGenerating(true)
    setCurrentRender(null)
    setRenderedWallImages(null)

    try {
      const baseViewsList = BASE_VIEWS[activeRoom.room_type] || []
      const chosenView = baseViewsList.find((v) => v.id === selectedBaseView)
      const baseViewUrl = chosenView ? chosenView.url : ''

      const productsPayload = activeRoomItems.map((item: any) => ({
        id: item.product_id,
        name: item.product?.name,
        color: item.custom_color,
        fabric: item.custom_fabric,
        wood_finish: item.custom_wood_finish,
        size: item.custom_size,
        texture: item.custom_texture,
        cushion_style: item.custom_cushion_style,
      }))

      // Automatically compile dynamic layout prompt
      const autoPrompt = `A premium styled ${selectedStyle} theme room featuring a curated setup of: ${productsPayload.map((p: any) => `${p.name} in ${p.color || 'coordinated tone'}`).join(', ')}.`

      // Call API passing prompt, base image, and products cutout inputs
      const res = await aiAPI.render({
        room_id: activeRoom.id,
        mode: 'sdxl',
        style: selectedStyle,
        color_palette: [],
        layout_prompt: autoPrompt,
        base_image_url: selectedBaseView === uploadedBaseImage ? uploadedBaseImage : baseViewUrl,
        products: productsPayload,
        base_image_data: uploadedFileB64 || undefined,
        base_image_mime: uploadedFileMime || 'image/jpeg',
      })

      const jobId = res.data.job_id
      toast.success(`Controlled AI Render queued! ETA ~${res.data.eta_seconds}s`)

      // Poll rendering status
      const interval = setInterval(async () => {
        try {
          const status = await aiAPI.renderStatus(jobId)
          if (status.data.status === 'completed') {
            clearInterval(interval)
            setCurrentRender(status.data)
            setRenderedWallImages(STYLE_RENDER_TEMPLATES[selectedStyle] || STYLE_RENDER_TEMPLATES.modern)
            setGenerating(false)
            setRenders((prev) => [status.data, ...prev])
            toast.success('✨ Controlled 4-wall rendering completed successfully!')
          }
        } catch {
          clearInterval(interval)
          setGenerating(false)
        }
      }, 2500)
      setPollInterval(interval)
    } catch (err: any) {
      toast.error('Failed to trigger visualization engine')
      setGenerating(false)
    }
  }

  // Open Swap drawer configuration
  const openSwapPanel = async (roomItem: any) => {
    setSwappingItem(roomItem)
    const product = roomItem.product
    const v = product?.variants || {}
    const match = getBestColorMatch(v.color || [], project?.color_preferences || [])
    setSwappingColor(roomItem.custom_color || match.color)
    setSwappingFabric(roomItem.custom_fabric || v.fabric?.[0] || '')
    setSwappingWoodFinish(roomItem.custom_wood_finish || v.wood_finish?.[0] || '')
    setSwappingSize(roomItem.custom_size || v.size?.[0] || '')
    setSwappingTexture(roomItem.custom_texture || v.texture?.[0] || '')
    setSwappingCushionStyle(roomItem.custom_cushion_style || v.cushion_style?.[0] || '')

    try {
      const res = await catalogAPI.products({
        room_type: activeRoom.room_type,
        category: product.category,
        pincode: project?.pincode,
        limit: 10
      })
      setAlternativeProducts(res.data.items?.filter((p: any) => p.id !== product.id) || [])
    } catch {
      setAlternativeProducts([])
    }
  }

  // Save selection and immediately auto-re-render
  const handleSaveSwap = async (customProduct?: any) => {
    if (!activeRoom || !swappingItem) return
    setSavingSwap(true)
    const targetProduct = customProduct || swappingItem.product
    try {
      if (targetProduct.id !== swappingItem.product_id) {
        await projectsAPI.removeRoomItem(projectId, activeRoom.id, swappingItem.id)
      }
      await projectsAPI.addRoomItem(projectId, activeRoom.id, {
        product_id: targetProduct.id,
        qty: 1,
        custom_color: swappingColor || undefined,
        custom_fabric: swappingFabric || undefined,
        custom_wood_finish: swappingWoodFinish || undefined,
        custom_size: swappingSize || undefined,
        custom_texture: swappingTexture || undefined,
        custom_cushion_style: swappingCushionStyle || undefined,
      })

      toast.success('Room selection updated!')
      setSwappingItem(null)
      await loadProject()

      // Immediately trigger re-render
      handleGenerate()
    } catch {
      toast.error('Failed to update product details')
    } finally {
      setSavingSwap(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #dfd9d4 0%, #bed4e3 20%, #6062ed 60%, #322e6b 100%)' }}>
        <div className="text-center space-y-4 bg-white/40 backdrop-blur-md p-8 rounded-3xl border border-white/20 shadow-xl">
          <div className="w-16 h-16 border-4 border-indigo-600/10 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <p className="text-slate-800 text-sm font-extrabold animate-pulse">Loading visualization studio…</p>
        </div>
      </div>
    )
  }

  const swapGalleryImages = swappingItem?.product
    ? (swappingItem.product.images || swappingItem.product.variants?.images || [])
    : []

  return (
    <div className="min-h-screen text-slate-800 pb-20" style={{ background: 'linear-gradient(135deg, #dfd9d4 0%, #bed4e3 20%, #6062ed 60%, #322e6b 100%)', backgroundAttachment: 'fixed' }}>
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 pt-24">
        
        {/* HEADER BAR */}
        <div className="flex items-center justify-between mb-8 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/customize/${projectId}`)}
              className="p-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition shadow-sm text-slate-700"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-800">
                Controlled AI Render Studio
              </h1>
              <p className="text-slate-500 text-xs mt-0.5">{project?.property_name} • Visual pipeline</p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: BASE ROOM + SELECTS + STYLE SELECTOR + GENERATE ACTION (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Room Tabs */}
            <div className="bg-slate-900 border border-white/5 p-4 rounded-3xl">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Design Room</h3>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {project?.rooms?.map((room: any, i: number) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => {
                      setActiveRoomIdx(i)
                      setRenderedWallImages(null)
                    }}
                    className={clsx(
                      'px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap',
                      i === activeRoomIdx
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-950/40 text-slate-400 border border-white/5 hover:text-white'
                    )}
                  >
                    {ROOM_LABELS[room.room_type] || room.room_type}
                  </button>
                ))}
              </div>
            </div>

            {/* Base Room View Selection & Custom Layout Config */}
            {activeRoom && (
              <div className="bg-slate-900 border border-white/5 p-4 rounded-3xl space-y-4 text-slate-100">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Settings className="w-4 h-4 text-indigo-400" />
                    <span>Configure Base View Mode</span>
                  </h3>
                </div>

                {/* Sub-tabs for view modes */}
                <div className="grid grid-cols-3 gap-2 bg-slate-950/40 p-1 rounded-xl">
                  {(['default', 'uploads', 'dimensions'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSetupMode(mode)}
                      className={clsx(
                        'py-1.5 px-1 rounded-lg text-[10px] font-bold uppercase transition text-center',
                        setupMode === mode
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      )}
                    >
                      {mode === 'default' ? 'Templates' : mode === 'uploads' ? 'Uploads' : 'Dimensions'}
                    </button>
                  ))}
                </div>

                {/* Setup Mode 1: Default Blueprints */}
                {setupMode === 'default' && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                      Select a standard wall blueprint view for AI rendering.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {(BASE_VIEWS[activeRoom.room_type] || []).map((view) => {
                        const isSelected = selectedBaseView === view.id
                        return (
                          <div
                            key={view.id}
                            onClick={() => setSelectedBaseView(view.id)}
                            className={clsx(
                              'rounded-2xl overflow-hidden border-2 cursor-pointer transition relative aspect-[4/3]',
                              isSelected ? 'border-indigo-500 bg-indigo-950/20' : 'border-transparent opacity-65 hover:opacity-100'
                            )}
                          >
                            <img src={view.url} alt={view.label} className="w-full h-full object-cover" />
                            <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 text-[9px] font-bold text-white truncate">
                              {view.label}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Setup Mode 2: Custom Uploads */}
                {setupMode === 'uploads' && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                      Upload photos of the 4 walls of your room (Wall A, B, C, D) under renovation.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {(['A', 'B', 'C', 'D'] as const).map((wall) => {
                        const preview = uploadedWalls[wall]
                        return (
                          <label
                            key={wall}
                            className={clsx(
                              'rounded-2xl overflow-hidden border-2 border-dashed cursor-pointer transition relative aspect-[4/3] flex flex-col items-center justify-center p-3 text-center',
                              preview ? 'border-emerald-500 bg-emerald-950/20' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800'
                            )}
                          >
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleWallUpload(wall, e)}
                            />
                            {preview ? (
                              <>
                                <img src={preview} alt={`Wall ${wall}`} className="absolute inset-0 w-full h-full object-cover" />
                                <div className="absolute inset-x-0 bottom-0 bg-emerald-900/80 p-1 text-[9px] font-bold text-white">
                                  Wall {wall} Uploaded
                                </div>
                              </>
                            ) : (
                              <>
                                <ImageIcon className="w-6 h-6 text-slate-550 mb-1" />
                                <span className="text-[9px] font-bold text-slate-350">Wall {wall} Image</span>
                              </>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Setup Mode 3: Construction Dimensions */}
                {setupMode === 'dimensions' && (
                  <div className="space-y-4">
                    <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                      Enter structural measurements to calculate layout clearances for new spaces.
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-slate-800">
                      <div>
                        <label className="block text-[8px] font-extrabold text-slate-400 uppercase mb-1">Length (ft)</label>
                        <input
                          type="number"
                          placeholder="12"
                          value={roomLength}
                          onChange={(e) => setRoomLength(e.target.value)}
                          className="w-full text-xs bg-slate-950 border border-white/5 rounded-lg p-2 text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-extrabold text-slate-400 uppercase mb-1">Width (ft)</label>
                        <input
                          type="number"
                          placeholder="10"
                          value={roomWidth}
                          onChange={(e) => setRoomWidth(e.target.value)}
                          className="w-full text-xs bg-slate-950 border border-white/5 rounded-lg p-2 text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-extrabold text-slate-400 uppercase mb-1">Height (ft)</label>
                        <input
                          type="number"
                          placeholder="9"
                          value={roomHeight}
                          onChange={(e) => setRoomHeight(e.target.value)}
                          className="w-full text-xs bg-slate-950 border border-white/5 rounded-lg p-2 text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-slate-950/20 p-2 rounded-xl border border-white/5">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-350">Pillar Presence</span>
                        <span className="text-[8px] text-slate-550">Is there a structural column?</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setHasPillar(!hasPillar)}
                        className={clsx(
                          'px-3 py-1 rounded-lg text-[9px] font-bold transition uppercase',
                          hasPillar ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'
                        )}
                      >
                        {hasPillar ? 'Yes' : 'No'}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleCalculateClearance}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-550 text-white text-[10px] font-extrabold rounded-xl transition shadow-md"
                    >
                      Calculate Room Clearance
                    </button>

                    {clearanceCalculated && calculatedMetrics && (
                      <div className="bg-slate-950/60 p-3 rounded-2xl border border-white/5 space-y-1.5 text-[9px]">
                        <div className="flex justify-between font-bold text-slate-350">
                          <span>Calculated Space:</span>
                          <span className="text-indigo-400">{calculatedMetrics.volume} cubic ft</span>
                        </div>
                        <div className="flex justify-between font-bold text-slate-350">
                          <span>Room Perimeter:</span>
                          <span>{calculatedMetrics.perimeter} ft</span>
                        </div>
                        <div className="flex justify-between font-bold text-slate-350">
                          <span>Net Usable Area:</span>
                          <span>{calculatedMetrics.usableArea} sqft</span>
                        </div>
                        <div className="text-[8px] text-slate-400 italic leading-snug mt-1">
                          * Clearances layout fits chosen appliances. {hasPillar && 'Pillar footprint (1.5 sqft) subtracted.'}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Style preference selector */}
            <div className="bg-slate-900 border border-white/5 p-4 rounded-3xl space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Design Style Theme</h3>
              <div className="grid grid-cols-3 gap-2">
                {STYLES.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setSelectedStyle(st.id)}
                    className={clsx(
                      'p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1',
                      selectedStyle === st.id
                        ? 'border-indigo-500 bg-indigo-600/10 text-white'
                        : 'border-white/5 bg-slate-950/20 text-slate-300 hover:text-white'
                    )}
                  >
                    <span className="text-lg">{st.emoji}</span>
                    <span className="text-[10px]">{st.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Render Trigger */}
            <button
              onClick={handleGenerate}
              disabled={generating || activeRoomItems.length === 0}
              className={clsx(
                'w-full py-4 rounded-2xl font-bold text-sm shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]',
                generating || activeRoomItems.length === 0
                  ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                  : 'bg-indigo-700 hover:bg-indigo-850 text-white'
              )}
            >
              {generating ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-500 border-t-slate-200 rounded-full animate-spin" />
                  <span>Generating 4-wall viewport…</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Generate Controlled Render</span>
                </>
              )}
            </button>

          </div>

          {/* RIGHT COLUMN: 4-WALL VIEWPORT + FINALIZATION + PRODUCT ITEMS LIST (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* 4-Wall Render Studio Viewport */}
            <div className="bg-slate-900 border border-white/5 rounded-3xl p-5 shadow-2xl space-y-4 text-slate-100 min-h-[500px] flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-350">
                    4-Wall Perspective Studio
                  </h3>
                </div>
                <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 px-2.5 py-0.5 rounded-full font-bold uppercase">
                  {renderedWallImages ? '✨ Rendered Space' : '📋 Blueprints View'}
                </span>
              </div>

              <div className="relative flex-1 flex items-center justify-center">
                {generating ? (
                  <div className="flex flex-col items-center justify-center text-center p-6 my-auto">
                    <div className="w-16 h-16 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin mb-4" />
                    <h4 className="text-white font-bold text-sm">Controlled 4-Wall Rendering in Progress</h4>
                    <p className="text-slate-550 text-[11px] max-w-xs leading-normal mt-1">
                      Synthesizing 4 distinct perspectives + variant preferences...
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 w-full">
                    {(renderedWallImages || FOUR_WALL_VIEWS[activeRoom?.room_type] || []).map((imgUrlOrObj, idx) => {
                      const wallLetter = ['A', 'B', 'C', 'D'][idx]
                      const isRendered = !!renderedWallImages
                      const label = isRendered
                        ? `Wall ${wallLetter} (Rendered)`
                        : (imgUrlOrObj as any).label || `Wall ${wallLetter} Blueprint`
                      const url = isRendered ? (imgUrlOrObj as string) : (imgUrlOrObj as any).url

                      return (
                        <div key={idx} className="relative rounded-2xl overflow-hidden border border-white/5 group aspect-[4/3] bg-slate-950/40">
                          <img src={url} alt={label} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-3 flex items-end justify-between gap-2">
                            <span className="text-[10px] font-bold text-slate-200 truncate">{label}</span>
                            {isRendered && (
                              <a
                                href={url}
                                download={`Wall_${wallLetter}_Render.jpg`}
                                target="_blank"
                                className="p-1.5 bg-indigo-600 hover:bg-indigo-550 text-white rounded-lg transition"
                                title="Download HD"
                              >
                                <Download className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {!generating && !renderedWallImages && (
                <div className="text-[10px] text-center text-slate-500 mt-4 leading-normal">
                  Configure your room variant preferences on the left and click <strong>Generate Controlled Render</strong> to render all 4 walls.
                </div>
              )}
            </div>

            {/* Finalize and get quotation CTA */}
            {(renders.length > 0 || renderedWallImages) && !generating && (
              <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-500/20 p-5 rounded-3xl flex items-center justify-between">
                <div>
                  <h3 className="text-white font-bold mb-1">Satisfied with the designs?</h3>
                  <p className="text-indigo-200 text-xs">Generate your final PDF quotation and design proposal for this project.</p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push(`/quotation/${projectId}`)}
                  className="px-6 py-3 bg-white text-indigo-950 hover:bg-indigo-50 font-bold rounded-xl text-sm transition-all shadow-lg flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  Finalize & Get Quotation
                </button>
              </div>
            )}

            {/* Selected Products Iterative Design swap panel */}
            <div className="bg-slate-900 border border-white/5 p-5 rounded-3xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Selected Room Products</h3>
                <span className="text-[10px] text-slate-500">{activeRoomItems.length} items configured</span>
              </div>

              <div className="grid md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-1 text-slate-100">
                {activeRoomItems.map((item: any) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-950/40 border border-white/5 rounded-2xl flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img src={item.product?.thumbnail_url} alt={item.product?.name} className="w-10 h-10 object-cover rounded-xl shrink-0" />
                      <div className="min-w-0">
                        <h4 className="text-[11px] font-bold text-white truncate">{item.product?.name}</h4>
                        <div className="text-[9px] text-slate-500 truncate">
                          {[
                            item.custom_color,
                            item.custom_fabric,
                            item.custom_wood_finish,
                            item.custom_size,
                            item.custom_texture,
                          ].filter(Boolean).join(' • ')}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openSwapPanel(item)}
                      className="py-1.5 px-3 bg-slate-800/80 border border-white/10 hover:border-indigo-500/40 text-[10px] font-bold text-indigo-300 rounded-xl transition"
                    >
                      Edit
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* SWAPPING AND COMPONENT CUSTOMIZER MODAL DRAWER OVERLAY */}
      {swappingItem && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-3xl p-6 overflow-y-auto max-h-[90vh] flex flex-col justify-between text-slate-100">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-white">Swap / Configure Selection</h3>
                <p className="text-slate-400 text-xs mt-0.5">Currently: {swappingItem.product?.name}</p>
              </div>
              <button
                onClick={() => setSwappingItem(null)}
                className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              
              {/* Product Variant Details Panel */}
              <div className="space-y-4 border-r border-white/5 pr-6">
                
                {/* Image Gallery Carousel Slider */}
                <div className="mb-4">
                  <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-2.5 group bg-slate-950 border border-white/5 flex items-center justify-center">
                    {swapGalleryImages[activeSwapImageIdx] ? (
                      <img
                        src={swapGalleryImages[activeSwapImageIdx].startsWith('/') ? `http://localhost:8000${swapGalleryImages[activeSwapImageIdx]}` : swapGalleryImages[activeSwapImageIdx]}
                        alt={swappingItem.product?.name}
                        className="w-full h-full object-cover transition-all duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-5 text-center bg-slate-950 select-none">
                        <ImageIcon className="w-7 h-7 text-slate-700 mb-2 animate-pulse" />
                        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Optional View Not Uploaded</h5>
                        <p className="text-[9px] text-slate-500 mt-1 max-w-xs leading-normal">
                          The vendor has only provided the primary view for this component.
                        </p>
                      </div>
                    )}
                    
                    {/* Navigation Arrows */}
                    <button
                      type="button"
                      onClick={() => setActiveSwapImageIdx((prev) => (prev === 0 ? 2 : prev - 1))}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-7.5 h-7.5 rounded-full bg-slate-900/60 hover:bg-slate-900/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-md border border-white/10"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSwapImageIdx((prev) => (prev === 2 ? 0 : prev + 1))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-7.5 h-7.5 rounded-full bg-slate-900/60 hover:bg-slate-900/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-md border border-white/10"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Thumbnail Indicators */}
                  <div className="grid grid-cols-3 gap-2">
                    {[0, 1, 2].map((idx) => {
                      const imgUrl = swapGalleryImages[idx]
                      const isActive = activeSwapImageIdx === idx
                      const label = idx === 0 ? "Front" : idx === 1 ? "Side" : "Top"
                      
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveSwapImageIdx(idx)}
                          className={clsx(
                            "relative h-11 rounded-lg overflow-hidden border transition flex flex-col items-center justify-center text-center p-1",
                            isActive ? "border-indigo-500 bg-indigo-500/10 shadow-sm" : "border-white/5 bg-slate-950/40 hover:bg-slate-950/80 hover:border-slate-800"
                          )}
                        >
                          {imgUrl ? (
                            <img
                              src={imgUrl.startsWith('/') ? `http://localhost:8000${imgUrl}` : imgUrl}
                              alt={`Thumb ${idx}`}
                              className="w-full h-full object-cover rounded"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center">
                              <ImageIcon className="w-3 h-3 text-slate-700 mb-0.5" />
                              <span className="text-[7px] text-slate-500 font-bold uppercase tracking-wider">{label} N/A</span>
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Available Variants</h4>
                
                {swappingItem.product?.variants?.color && (() => {
                  const matchResult = getBestColorMatch(swappingItem.product.variants.color, project?.color_preferences || []);
                  return (
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Color</span>
                        {project?.color_preferences?.length > 0 && (
                          <span className="text-[9px] text-slate-400">
                            🎨 Selected Palette: <strong className="text-indigo-400">{project.color_preferences.join(', ')}</strong>
                          </span>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-1.5">
                        {swappingItem.product.variants.color.map((val: string) => {
                          const isSelected = swappingColor === val;
                          const isBestMatch = matchResult.color === val;
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setSwappingColor(val)}
                              className={clsx(
                                'px-2.5 py-1 rounded-lg text-xs transition border flex items-center gap-1 font-semibold',
                                isSelected
                                  ? 'bg-indigo-600 border-indigo-500 text-white'
                                  : 'bg-slate-800 border-white/5 text-slate-400 hover:text-white'
                              )}
                            >
                              {isBestMatch && <span>⭐</span>}
                              {val}
                              {isBestMatch && <span className="text-[9px] opacity-75 font-normal ml-0.5">(Best Match)</span>}
                            </button>
                          );
                        })}
                      </div>
                      
                      {/* Banner for exact match unavailable */}
                      {project?.color_preferences?.length > 0 && !matchResult.isExact && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 text-[10px] text-amber-200 leading-normal flex items-start gap-1">
                          <span className="text-amber-350 font-bold">⚠️ Note:</span>
                          <span>Your preferred color isn't available for this product. We've selected the closest matching variant.</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {swappingItem.product?.variants?.fabric && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Fabric choice</label>
                    <div className="flex flex-wrap gap-1.5">
                      {swappingItem.product.variants.fabric.map((val: string) => (
                        <button
                          key={val}
                          onClick={() => setSwappingFabric(val)}
                          className={clsx(
                            'px-2.5 py-1 rounded-lg text-xs transition border',
                            swappingFabric === val
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'bg-slate-800 border-white/5 text-slate-300 hover:text-white'
                          )}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {swappingItem.product?.variants?.wood_finish && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Wood finish type</label>
                    <div className="flex flex-wrap gap-1.5">
                      {swappingItem.product.variants.wood_finish.map((val: string) => (
                        <button
                          key={val}
                          onClick={() => setSwappingWoodFinish(val)}
                          className={clsx(
                            'px-2.5 py-1 rounded-lg text-xs transition border',
                            swappingWoodFinish === val
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'bg-slate-800 border-white/5 text-slate-300 hover:text-white'
                          )}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {swappingItem.product?.variants?.size && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Custom sizing</label>
                    <div className="flex flex-wrap gap-1.5">
                      {swappingItem.product.variants.size.map((val: string) => (
                        <button
                          key={val}
                          onClick={() => setSwappingSize(val)}
                          className={clsx(
                            'px-2.5 py-1 rounded-lg text-xs transition border',
                            swappingSize === val
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'bg-slate-800 border-white/5 text-slate-300 hover:text-white'
                          )}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {swappingItem.product?.variants?.texture && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Surface texture</label>
                    <div className="flex flex-wrap gap-1.5">
                      {swappingItem.product.variants.texture.map((val: string) => (
                        <button
                          key={val}
                          onClick={() => setSwappingTexture(val)}
                          className={clsx(
                            'px-2.5 py-1 rounded-lg text-xs transition border',
                            swappingTexture === val
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'bg-slate-800 border-white/5 text-slate-300 hover:text-white'
                          )}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {swappingItem.product?.variants?.cushion_style && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Cushion styling</label>
                    <div className="flex flex-wrap gap-1.5">
                      {swappingItem.product.variants.cushion_style.map((val: string) => (
                        <button
                          key={val}
                          onClick={() => setSwappingCushionStyle(val)}
                          className={clsx(
                            'px-2.5 py-1 rounded-lg text-xs transition border',
                            swappingCushionStyle === val
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'bg-slate-800 border-white/5 text-slate-300 hover:text-white'
                          )}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => handleSaveSwap()}
                  disabled={savingSwap}
                  className="w-full py-2.5 justify-center rounded-xl text-xs font-bold flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  {savingSwap ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Update & Re-render</span>
                    </>
                  )}
                </button>
              </div>

              {/* Swap Product Alternatives Selection Panel */}
              <div className="space-y-4 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Swap Product Design</h4>
                  {alternativeProducts.length === 0 ? (
                    <p className="text-[11px] text-slate-500">No other designs catalogued for this room style category.</p>
                  ) : (
                    <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                      {alternativeProducts.map((p: any) => (
                        <div
                          key={p.id}
                          className="p-2.5 bg-slate-950/60 border border-white/5 rounded-xl flex items-center justify-between gap-3 hover:border-white/15 transition"
                        >
                          <div className="flex gap-2.5 items-center min-w-0">
                            <img src={p.thumbnail_url} alt={p.name} className="w-10 h-10 object-cover rounded-lg flex-shrink-0" />
                            <div className="min-w-0">
                              <h5 className="text-[11px] font-bold text-white truncate">{p.name}</h5>
                              <div className="text-[11px] text-indigo-400 font-bold">₹{p.price.toLocaleString('en-IN')}</div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleSaveSwap(p)}
                            disabled={savingSwap}
                            className="py-1 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg transition"
                          >
                            Swap
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-slate-500 bg-slate-950/40 p-3 rounded-2xl leading-normal mt-4">
                  Note: Swapping or updating choices saves modifications to project and immediately triggers rendering preview updates in background.
                </div>
              </div>

            </div>

            {/* About this Product */}
            <div className="border-t border-white/5 pt-5 mt-6 space-y-4">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">About this Product</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-xs">
                
                {/* Left Column */}
                <div className="space-y-1">
                  <div className="grid grid-cols-3 py-1.5 border-b border-white/5">
                    <span className="col-span-1 text-slate-400 font-semibold">Material</span>
                    <span className="col-span-2 text-white font-bold pl-2">{swappingItem.product.primary_material || swappingItem.product.primaryMaterial || 'Solid Wood'}</span>
                  </div>
                  <div className="grid grid-cols-3 py-1.5 border-b border-white/5">
                    <span className="col-span-1 text-slate-400 font-semibold">Dimensions</span>
                    <span className="col-span-2 text-white font-bold pl-2">
                      {swappingItem.product.width || 1200}w × {swappingItem.product.height || 750}h × {swappingItem.product.depth || 600}d mm
                    </span>
                  </div>
                  <div className="grid grid-cols-3 py-1.5 border-b border-white/5">
                    <span className="col-span-1 text-slate-400 font-semibold">Weight</span>
                    <span className="col-span-2 text-white font-bold pl-2">{swappingItem.product.weight || 15} kg</span>
                  </div>
                  <div className="grid grid-cols-3 py-1.5 border-b border-white/5">
                    <span className="col-span-1 text-slate-400 font-semibold">Capacity</span>
                    <span className="col-span-2 text-white font-bold pl-2">{swappingItem.product.weight_capacity || swappingItem.product.weightCapacity || 120} kg</span>
                  </div>
                  <div className="grid grid-cols-3 py-1.5 border-b border-white/5">
                    <span className="col-span-1 text-slate-400 font-semibold">Suitable Room</span>
                    <span className="col-span-2 text-white font-bold pl-2">{swappingItem.product.suitable_room || swappingItem.product.suitableRoom || 'Living Room'}</span>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-1">
                  <div className="grid grid-cols-3 py-1.5 border-b border-white/5">
                    <span className="col-span-1 text-slate-400 font-semibold">Style</span>
                    <span className="col-span-2 text-white font-bold pl-2">{swappingItem.product.style || 'Modern'}</span>
                  </div>
                  <div className="grid grid-cols-3 py-1.5 border-b border-white/5">
                    <span className="col-span-1 text-slate-400 font-semibold">Finish</span>
                    <span className="col-span-2 text-white font-bold pl-2">{swappingItem.product.finish || 'Matte'}</span>
                  </div>
                  <div className="grid grid-cols-3 py-1.5 border-b border-white/5">
                    <span className="col-span-1 text-slate-400 font-semibold">Mounting</span>
                    <span className="col-span-2 text-white font-bold pl-2">{swappingItem.product.mounting_type || swappingItem.product.mountingType || 'Floor Standing'}</span>
                  </div>
                  <div className="grid grid-cols-3 py-1.5 border-b border-white/5">
                    <span className="col-span-1 text-slate-400 font-semibold">Assembly</span>
                    <span className="col-span-2 text-white font-bold pl-2">{swappingItem.product.assembly_required || swappingItem.product.assemblyRequired || 'No'}</span>
                  </div>
                  <div className="grid grid-cols-3 py-1.5 border-b border-white/5">
                    <span className="col-span-1 text-slate-400 font-semibold">Colors</span>
                    <span className="col-span-2 text-white font-bold pl-2">{(swappingItem.product.color_variants || swappingItem.product.colorVariants || []).join(', ') || 'N/A'}</span>
                  </div>
                </div>

              </div>
              {swappingItem.product.description && (
                <div className="text-xs text-slate-400 mt-2 bg-slate-950/40 p-3 rounded-xl border border-white/5">
                  <div className="font-bold text-white mb-1">Description / Notes</div>
                  {swappingItem.product.description}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
