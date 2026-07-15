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
  Image as ImageIcon, RefreshCw, X, Layout, AlignLeft, Settings, AlertCircle
} from 'lucide-react'
import clsx from 'clsx'

const STYLES = [
  { id: 'modern', label: 'Modern Luxury', emoji: '💎' },
  { id: 'scandinavian', label: 'Scandinavian Warmth', emoji: '🪵' },
  { id: 'indian_contemporary', label: 'Indian Contemporary', emoji: '🪔' },
]

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
  
  const [renders, setRenders] = useState<any[]>([])
  const [currentRender, setCurrentRender] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null)

  // Swap / variant customization drawer
  const [swappingItem, setSwappingItem] = useState<any>(null)
  const [alternativeProducts, setAlternativeProducts] = useState<any[]>([])
  const [swappingColor, setSwappingColor] = useState('')
  const [swappingFabric, setSwappingFabric] = useState('')
  const [swappingWoodFinish, setSwappingWoodFinish] = useState('')
  const [swappingSize, setSwappingSize] = useState('')
  const [swappingTexture, setSwappingTexture] = useState('')
  const [swappingCushionStyle, setSwappingCushionStyle] = useState('')
  const [savingSwap, setSavingSwap] = useState(false)
  const [swappingActiveImage, setSwappingActiveImage] = useState('')

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

  // Generate controlled visualization pipeline
  const handleGenerate = async () => {
    if (!activeRoom) return
    setGenerating(true)
    setCurrentRender(null)

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

      // Call API passing prompt, base image, and products cutout inputs
      // If user uploaded their own room photo, send it as base64 for img2img
      const res = await aiAPI.render({
        room_id: activeRoom.id,
        mode: 'sdxl',
        style: selectedStyle,
        color_palette: [],
        layout_prompt: layoutPrompt,
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
            setGenerating(false)
            setRenders((prev) => [status.data, ...prev])
            toast.success('✨ Controlled rendering completed successfully!')
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
    setSwappingActiveImage(product?.thumbnail_url || '')
    const v = product?.variants || {}
    setSwappingColor(roomItem.custom_color || v.color?.[0] || '')
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-sm">Loading visualization engine…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 pt-24">
        
        {/* HEADER BAR */}
        <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/customize/${projectId}`)}
              className="p-2 bg-slate-900 border border-white/10 hover:bg-slate-800 rounded-xl transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-2xl font-extrabold bg-gradient-to-r from-white to-indigo-300 bg-clip-text text-transparent">
                Controlled AI Render Studio
              </h1>
              <p className="text-slate-400 text-xs mt-0.5">{project?.property_name} • Visual pipeline</p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: BASE ROOM + SELECTS + LAYOUT PROMPT (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Room Tabs */}
            <div className="bg-slate-900 border border-white/5 p-4 rounded-3xl">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Design Room</h3>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {project?.rooms?.map((room: any, i: number) => (
                  <button
                    key={room.id}
                    onClick={() => setActiveRoomIdx(i)}
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

            {/* Base Room View Selection */}
            {activeRoom && (
              <div className="bg-slate-900 border border-white/5 p-4 rounded-3xl space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Layout className="w-4 h-4 text-indigo-400" />
                  <span>Choose Base Room View</span>
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {(BASE_VIEWS[activeRoom.room_type] || []).map((view) => {
                    const isSelected = selectedBaseView === view.id
                    return (
                      <div
                        key={view.id}
                        onClick={() => setSelectedBaseView(view.id)}
                        className={clsx(
                          'rounded-2xl overflow-hidden border-2 cursor-pointer transition relative aspect-[4/3]',
                          isSelected ? 'border-indigo-500 bg-indigo-950/20' : 'border-transparent opacity-60 hover:opacity-100'
                        )}
                      >
                        <img src={view.url} alt={view.label} className="w-full h-full object-cover" />
                        <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 text-[10px] font-bold text-white truncate">
                          {view.label}
                        </div>
                      </div>
                    )
                  })}
                  
                  {/* Upload Custom Image Option — img2img mode */}
                  <label className={clsx(
                    'rounded-2xl overflow-hidden border-2 border-dashed cursor-pointer transition relative aspect-[4/3] flex flex-col items-center justify-center p-4',
                    uploadedBaseImage && selectedBaseView === uploadedBaseImage ? 'border-emerald-500 bg-emerald-950/20' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800'
                  )}>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0]
                        const previewUrl = URL.createObjectURL(file)
                        setUploadedBaseImage(previewUrl)
                        setSelectedBaseView(previewUrl)
                        setUploadedFileMime(file.type || 'image/jpeg')
                        // Convert to base64 for Gemini img2img
                        const reader = new FileReader()
                        reader.onload = (ev) => {
                          const dataUrl = ev.target?.result as string
                          // Strip "data:image/...;base64," prefix
                          const b64 = dataUrl.split(',')[1]
                          setUploadedFileB64(b64)
                        }
                        reader.readAsDataURL(file)
                      }
                    }} />
                    {uploadedBaseImage ? (
                      <>
                        <img src={uploadedBaseImage} alt="Uploaded Base" className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-x-0 bottom-0 bg-emerald-900/80 p-2 text-[10px] font-bold text-emerald-200 truncate text-center">
                          ✨ AI Redesign Mode
                        </div>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-8 h-8 text-slate-500 mb-2" />
                        <span className="text-[10px] font-bold text-slate-400 text-center">Upload Your<br/>Room Photo</span>
                        <span className="text-[9px] text-emerald-400 mt-1 font-semibold">AI Redesigns It</span>
                      </>
                    )}
                  </label>
                </div>
              </div>
            )}

            {/* Layout Prompt Rules */}
            <div className="bg-slate-900 border border-white/5 p-4 rounded-3xl space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlignLeft className="w-4 h-4 text-indigo-400" />
                <span>Layout Rules & Placement Prompt</span>
              </h3>
              <textarea
                value={layoutPrompt}
                onChange={(e) => setLayoutPrompt(e.target.value)}
                placeholder="Place sofa against main wall..."
                className="w-full h-28 bg-slate-950 border border-white/5 focus:border-indigo-500 rounded-2xl p-3 text-xs text-slate-350 focus:ring-1 focus:ring-indigo-550 resize-none font-medium leading-relaxed"
              />
            </div>

            {/* Style preference selector */}
            <div className="bg-slate-900 border border-white/5 p-4 rounded-3xl space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Design Style Theme</h3>
              <div className="grid grid-cols-3 gap-2">
                {STYLES.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setSelectedStyle(st.id)}
                    className={clsx(
                      'p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1',
                      selectedStyle === st.id
                        ? 'border-indigo-500 bg-indigo-600/10 text-white'
                        : 'border-white/5 bg-slate-950/20 text-slate-450 hover:text-white'
                    )}
                  >
                    <span className="text-lg">{st.emoji}</span>
                    <span className="text-[10px]">{st.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || activeRoomItems.length === 0}
              className={clsx(
                'w-full py-4 rounded-2xl font-bold text-sm shadow-xl flex items-center justify-center gap-2 transition-all',
                generating || activeRoomItems.length === 0
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : uploadedFileB64
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-650 hover:from-indigo-500 hover:to-purple-555 text-white'
              )}
            >
              {generating ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-500 border-t-slate-200 rounded-full animate-spin" />
                  {uploadedFileB64 ? 'AI Redesigning Your Room…' : 'Generating composite view…'}
                </>
              ) : (
                <>
                  <Sparkles className={`w-4 h-4 ${uploadedFileB64 ? 'text-emerald-200' : 'text-amber-300'}`} />
                  <span>{uploadedFileB64 ? '✨ Redesign My Room with AI' : 'Generate Controlled Render'}</span>
                </>
              )}
            </button>

          </div>

          {/* RIGHT COLUMN: PREVIEW + SELECTED PRODUCTS SWAP DRAWER (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Main Render Viewport */}
            <div className="bg-slate-900 border border-white/5 rounded-3xl aspect-[3/2] overflow-hidden flex items-center justify-center relative shadow-2xl">
              <AnimatePresence mode="wait">
                {generating ? (
                  <motion.div
                    key="gen"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-950/40 flex flex-col items-center justify-center text-center p-6"
                  >
                    <div className="w-16 h-16 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin mb-4" />
                    <h4 className="text-white font-bold text-sm">Controlled Rendering in Progress</h4>
                    <p className="text-slate-500 text-[11px] max-w-xs leading-normal mt-1">
                      Synthesizing Base Room View + Custom product cutouts + Layout rules...
                    </p>
                  </motion.div>
                ) : currentRender?.image_url ? (
                  <motion.div key="img" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 group">
                    <img src={currentRender.image_url} alt="Perspective output" className="w-full h-full object-cover" />
                    <div className="absolute top-4 right-4 flex gap-2">
                      <a
                        href={currentRender.image_url}
                        download
                        target="_blank"
                        className="px-3.5 py-2 bg-black/60 hover:bg-black/85 backdrop-blur border border-white/10 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 transition"
                      >
                        <Download className="w-3.5 h-3.5" /> Download HD
                      </a>
                    </div>
                  </motion.div>
                ) : activeRoom ? (
                  <motion.div key="base_view_2d" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 w-full h-full">
                    <img
                      src={selectedBaseView === uploadedBaseImage ? uploadedBaseImage : ((BASE_VIEWS[activeRoom.room_type] || []).find((v) => v.id === selectedBaseView)?.url || '')}
                      alt="2D Room Layout Preview"
                      className="w-full h-full object-cover"
                    />
                  </motion.div>
                ) : (
                  <motion.div key="empty" className="text-center p-8">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-950/40 border border-indigo-500/10 flex items-center justify-center mx-auto mb-4">
                      <ImageIcon className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h4 className="text-white font-bold text-sm">Controlled Render Studio</h4>
                    <p className="text-xs text-slate-400 max-w-[200px] mt-2 leading-relaxed">
                      Select styles, tweak layout rules, and click Generate to view your tailored room concept.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Finalize and get quotation CTA */}
            {renders.length > 0 && !generating && (
              <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-500/20 p-5 rounded-3xl flex items-center justify-between">
                <div>
                  <h3 className="text-white font-bold mb-1">Satisfied with the designs?</h3>
                  <p className="text-indigo-200 text-xs">Generate your final PDF quotation and design proposal for this project.</p>
                </div>
                <button
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

              <div className="grid md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-1">
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
                
                {/* Flipkart style multi-image viewer for swappingItem */}
                <div className="bg-slate-950/40 border border-white/5 p-3 rounded-2xl">
                  <div className="relative w-full aspect-video overflow-hidden rounded-xl bg-slate-950">
                    <img
                      src={swappingActiveImage.startsWith('/') ? `http://localhost:8000${swappingActiveImage}` : swappingActiveImage}
                      alt={swappingItem.product?.name}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                    />
                  </div>
                  {/* Thumbnails */}
                  {swappingItem.product?.variants?.images && swappingItem.product.variants.images.length > 1 && (
                    <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1 scrollbar-thin">
                      {swappingItem.product.variants.images.map((img: string, idx: number) => (
                        <div
                          key={idx}
                          onMouseEnter={() => setSwappingActiveImage(img)}
                          onClick={() => setSwappingActiveImage(img)}
                          className={clsx(
                            'w-10 h-10 rounded-lg overflow-hidden border-2 cursor-pointer transition-all flex-shrink-0 bg-slate-950',
                            swappingActiveImage === img ? 'border-indigo-500 scale-105' : 'border-white/5 opacity-60 hover:opacity-100'
                          )}
                        >
                          <img src={img.startsWith('/') ? `http://localhost:8000${img}` : img} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Specs sheet */}
                  <div className="mt-2.5 space-y-0.5 text-[10px] text-slate-400">
                    <div><span className="text-slate-500 font-semibold">SKU:</span> {swappingItem.product?.sku}</div>
                    <div><span className="text-slate-500 font-semibold">Category:</span> {swappingItem.product?.category} {swappingItem.product?.subcategory ? `• ${swappingItem.product?.subcategory}` : ''}</div>
                    {swappingItem.product?.description && (
                      <div className="leading-normal mt-1"><span className="text-slate-500 font-semibold">Description:</span> {swappingItem.product.description}</div>
                    )}
                  </div>
                </div>

                {/* Color preference warning */}
                {project?.color_preference && swappingItem.product?.variants?.color &&
                 !swappingItem.product.variants.color.some((c: string) => c.toLowerCase() === project.color_preference.toLowerCase()) && (
                   <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-[10px] leading-relaxed flex items-start gap-1.5">
                     <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                     <div>
                       <span className="font-bold">Not Available:</span> Preferred color <strong>"{project.color_preference}"</strong> is not available for this product. Please choose another color or swap design.
                     </div>
                   </div>
                )}

                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Configure Variant Options</h4>
                
                {swappingItem.product?.variants?.color && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Color Variant</label>
                    <div className="flex flex-wrap gap-1.5">
                      {swappingItem.product.variants.color.map((val: string) => (
                        <button
                          key={val}
                          onClick={() => setSwappingColor(val)}
                          className={clsx(
                            'px-2.5 py-1 rounded-lg text-xs transition border',
                            swappingColor === val
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'bg-slate-800 border-white/5 text-slate-450 hover:text-white'
                          )}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

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
                              : 'bg-slate-800 border-white/5 text-slate-450 hover:text-white'
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
                              : 'bg-slate-800 border-white/5 text-slate-450 hover:text-white'
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
                              : 'bg-slate-800 border-white/5 text-slate-450 hover:text-white'
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
                              : 'bg-slate-800 border-white/5 text-slate-450 hover:text-white'
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
                              : 'bg-slate-800 border-white/5 text-slate-450 hover:text-white'
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

          </div>
        </div>
      )}

    </div>
  )
}
