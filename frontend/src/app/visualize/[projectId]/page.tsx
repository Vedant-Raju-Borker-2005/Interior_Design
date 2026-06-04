'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { projectsAPI, aiAPI, catalogAPI } from '@/lib/api'
import Navbar from '@/components/Navbar'
import type { RoomCanvas3DRef } from '@/components/RoomCanvas3D'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, ArrowRight, ChevronDown, Clock, CheckCircle2, Download, Image as ImageIcon } from 'lucide-react'
import clsx from 'clsx'

const RoomCanvas3D = dynamic(() => import('@/components/RoomCanvas3D'), { ssr: false })

const STYLES = [
  { id: 'modern',              label: 'Modern',              emoji: '🔲' },
  { id: 'scandinavian',        label: 'Scandinavian',        emoji: '🪵' },
  { id: 'indian_contemporary', label: 'Indian Contemporary', emoji: '🪔' },
  { id: 'luxury',              label: 'Luxury',              emoji: '💎' },
  { id: 'mediterranean',       label: 'Mediterranean',       emoji: '🌊' },
  { id: 'boho',                label: 'Boho',                emoji: '🪴' },
]

const ROOM_LABELS: Record<string, string> = {
  living_room: 'Living Room', bedroom_master: 'Master Bedroom',
  bedroom_2: 'Bedroom 2', kitchen: 'Kitchen', bathroom: 'Bathroom', balcony: 'Balcony',
}

const PALETTES = [
  { name: 'Neutral', colors: ['#F5F5F0', '#C4B9A8', '#8B7355'] },
  { name: 'Ocean',   colors: ['#E0F2FE', '#7DD3FC', '#0EA5E9'] },
  { name: 'Forest',  colors: ['#DCFCE7', '#86EFAC', '#16A34A'] },
  { name: 'Blush',   colors: ['#FDF2F8', '#F9A8D4', '#DB2777'] },
  { name: 'Amber',   colors: ['#FFFBEB', '#FCD34D', '#D97706'] },
  { name: 'Slate',   colors: ['#F1F5F9', '#94A3B8', '#334155'] },
]

export default function VisualizePage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const [project, setProject] = useState<any>(null)
  const [activeRoomIdx, setActiveRoomIdx] = useState(0)
  const [selectedStyle, setSelectedStyle] = useState('modern')
  const [selectedPalette, setSelectedPalette] = useState(0)
  const [renders, setRenders] = useState<any[]>([])
  const [currentRender, setCurrentRender] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null)
  const [showComparison, setShowComparison] = useState(false)
  const [roomProducts, setRoomProducts] = useState<any[]>([])
  const canvasRef = useRef<RoomCanvas3DRef>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await projectsAPI.get(projectId)
        setProject(res.data)
      } catch {
        toast.error('Failed to load project')
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => { if (pollInterval) clearInterval(pollInterval) }
  }, [projectId])

  const activeRoom = project?.rooms?.[activeRoomIdx]

  const selectedRoomItems = (activeRoom?.items || []).map((item: any) => {
    const product = roomProducts.find((p: any) => p.id === item.product_id)
    return { ...item, product }
  })

  const loadRoomRenders = async (roomId: string) => {
    try {
      const res = await aiAPI.roomRenders(roomId)
      setRenders(res.data.renders || [])
    } catch {}
  }

  useEffect(() => {
    if (activeRoom) {
      loadRoomRenders(activeRoom.id)
      setCurrentRender(null)
      catalogAPI.products({ room_type: activeRoom.room_type, limit: 100 })
        .then((res) => setRoomProducts(res.data.items || []))
        .catch(() => setRoomProducts([]))
    }
  }, [activeRoomIdx, activeRoom?.id])

  const handleGenerate = async () => {
    if (!activeRoom) return
    setGenerating(true)
    setCurrentRender(null)

    try {
      const palette = PALETTES[selectedPalette].colors
      const layoutImage = canvasRef.current?.takeScreenshot()
      const products = selectedRoomItems.map((item: any) => ({
        name: item.product?.name || 'Selected product',
        category: item.product?.category || 'furniture',
      }))
      const res = await aiAPI.render({
        room_id: activeRoom.id,
        mode: 'sdxl',
        style: selectedStyle,
        color_palette: palette,
        products,
        layout_image: layoutImage,
      })

      const jobId = res.data.job_id
      toast.success(`Render queued! ETA ~${res.data.eta_seconds}s`)

      // Poll for completion
      const interval = setInterval(async () => {
        try {
          const status = await aiAPI.renderStatus(jobId)
          if (status.data.status === 'completed') {
            clearInterval(interval)
            setCurrentRender(status.data)
            setGenerating(false)
            setRenders((prev) => [status.data, ...prev])
            toast.success('✨ Render complete!')
          }
        } catch {
          clearInterval(interval)
          setGenerating(false)
        }
      }, 2500)
      setPollInterval(interval)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to queue render')
      setGenerating(false)
    }
  }

  const handleDownloadPlanPdf = () => {
    if (!activeRoom || typeof window === 'undefined') return

    const screenshot = canvasRef.current?.takeScreenshot()
    const roomLabel = ROOM_LABELS[activeRoom.room_type] || activeRoom.room_type
    const palette = PALETTES[selectedPalette]
    const itemRows = selectedRoomItems.length > 0
      ? selectedRoomItems.map((item: any) => {
          const product = item.product || {}
          return `<tr><td>${product.name || 'Selected product'}</td><td>${product.category || 'Furniture'}</td><td>${item.qty || 1}</td><td>INR ${(item.unit_price || product.price || 0).toLocaleString('en-IN')}</td></tr>`
        }).join('')
      : '<tr><td colspan="4">No saved products selected for this room yet.</td></tr>'

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Please allow popups to download the PDF plan')
      return
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${project?.property_name || 'Interior'} - ${roomLabel} Visual Plan</title>
          <style>
            @page { size: A4; margin: 16mm; }
            body { font-family: Arial, sans-serif; color: #0f172a; }
            h1 { margin: 0 0 4px; font-size: 24px; }
            h2 { margin: 20px 0 8px; font-size: 15px; text-transform: uppercase; letter-spacing: .04em; color: #4f46e5; }
            .meta { color: #475569; font-size: 12px; margin-bottom: 18px; }
            .preview { width: 100%; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background: #111827; }
            .preview img { width: 100%; display: block; }
            .empty { padding: 64px 20px; text-align: center; color: #64748b; background: #f8fafc; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { padding: 9px; border-bottom: 1px solid #e2e8f0; text-align: left; }
            th { background: #eef2ff; color: #312e81; }
            .chips { display: flex; gap: 8px; margin-top: 8px; }
            .chip { border: 1px solid #e2e8f0; padding: 6px 8px; border-radius: 999px; font-size: 11px; }
            .print { position: fixed; top: 12px; right: 12px; padding: 9px 12px; border: 0; border-radius: 8px; background: #4f46e5; color: white; font-weight: 700; }
            @media print { .print { display: none; } }
          </style>
        </head>
        <body>
          <button class="print" onclick="window.print()">Download / Save PDF</button>
          <h1>${project?.property_name || 'Interior Visual Plan'}</h1>
          <div class="meta">${roomLabel} | ${STYLES.find(s => s.id === selectedStyle)?.label || selectedStyle} | ${palette.name} palette</div>
          <div class="preview">
            ${screenshot ? `<img src="${screenshot}" alt="3D room layout" />` : '<div class="empty">3D preview snapshot unavailable. Please try again after the room finishes loading.</div>'}
          </div>
          ${currentRender?.image_url ? `<h2>AI Render</h2><div class="preview"><img src="${currentRender.image_url}" alt="AI render" /></div>` : ''}
          <h2>Selected Products</h2>
          <table>
            <thead><tr><th>Product</th><th>Category</th><th>Qty</th><th>Price</th></tr></thead>
            <tbody>${itemRows}</tbody>
          </table>
          <h2>Palette</h2>
          <div class="chips">${palette.colors.map(c => `<span class="chip">${c}</span>`).join('')}</div>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="spinner w-12 h-12" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <Navbar />
      <div className="max-w-screen-2xl mx-auto px-4 pt-24 pb-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">AI Visualisation</h1>
            <p className="text-slate-400 text-sm">{project?.property_name} • {project?.bhk_type}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleDownloadPlanPdf}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/15 text-sm font-bold transition"
            >
              <Download className="w-4 h-4" /> Download Visual PDF
            </button>
            <button
              onClick={() => router.push(`/quotation/${projectId}`)}
              className="btn-primary"
            >
              Generate Quotation <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">

          {/* Left: Controls + Room tabs */}
          <div className="space-y-4">
            {/* Room selector */}
            <div className="bg-slate-800 rounded-2xl p-4 border border-white/10">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Select Room</div>
              <div className="space-y-1">
                {project?.rooms?.map((room: any, i: number) => (
                  <button key={room.id} onClick={() => setActiveRoomIdx(i)}
                    className={clsx('w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all',
                      i === activeRoomIdx ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white')}>
                    {ROOM_LABELS[room.room_type] || room.room_type}
                  </button>
                ))}
              </div>
            </div>

            {/* Style selector */}
            <div className="bg-slate-800 rounded-2xl p-4 border border-white/10">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Design Style</div>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map((s) => (
                  <button key={s.id} onClick={() => setSelectedStyle(s.id)}
                    className={clsx('flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all',
                      selectedStyle === s.id
                        ? 'border-indigo-500 bg-indigo-600 text-white'
                        : 'border-white/10 text-slate-400 hover:border-white/30 hover:text-white')}>
                    <span>{s.emoji}</span>{s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Color palette */}
            <div className="bg-slate-800 rounded-2xl p-4 border border-white/10">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Color Palette</div>
              <div className="space-y-2">
                {PALETTES.map((pal, i) => (
                  <button key={pal.name} onClick={() => setSelectedPalette(i)}
                    className={clsx('w-full flex items-center gap-3 px-3 py-2 rounded-xl border transition-all',
                      selectedPalette === i ? 'border-indigo-500 bg-indigo-900/30' : 'border-white/10 hover:border-white/20')}>
                    <div className="flex gap-1">
                      {pal.colors.map((c) => (
                        <div key={c} className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <span className="text-sm text-slate-300">{pal.name}</span>
                    {selectedPalette === i && <CheckCircle2 className="w-4 h-4 text-indigo-400 ml-auto" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate button */}
            <button
              id="generate-render-btn"
              onClick={handleGenerate}
              disabled={generating}
              className={clsx(
                'w-full py-4 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2',
                generating
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:from-indigo-500 hover:to-indigo-400 shadow-glow-indigo'
              )}
            >
              {generating ? (
                <>
                  <div className="spinner w-5 h-5" />
                  Generating AI Render…
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Realistic View
                </>
              )}
            </button>

            {generating && (
              <div className="bg-slate-800 rounded-xl p-3 border border-indigo-500/30 text-center">
                <div className="text-xs text-indigo-300">
                  <Clock className="w-3 h-3 inline mr-1" />
                  Processing via Stable Diffusion XL + ControlNet…
                </div>
              </div>
            )}
            <div className="bg-slate-800 rounded-2xl p-4 border border-white/10">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Saved Products in 3D
              </div>
              {selectedRoomItems.length > 0 ? (
                <div className="space-y-2">
                  {selectedRoomItems.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 text-xs text-slate-300 border border-white/10 rounded-xl px-3 py-2">
                      <span className="font-semibold truncate">{item.product?.name || 'Selected product'}</span>
                      <span className="text-indigo-300 whitespace-nowrap">Qty {item.qty || 1}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 leading-relaxed">
                  Save products from Customise first, then they will appear in this room layout and AI prompt.
                </p>
              )}
            </div>
          </div>

          {/* Right: Render output */}
          <div className="lg:col-span-2 space-y-4">

            <div className="bg-slate-800 rounded-2xl overflow-hidden border border-white/10 aspect-video relative">
              {activeRoom && (
                <RoomCanvas3D
                  ref={canvasRef}
                  roomType={activeRoom.room_type}
                  wallColor={activeRoom.color_palette?.[0] || '#ffffff'}
                  style={selectedStyle}
                  roomItems={selectedRoomItems}
                  allProducts={roomProducts}
                />
              )}
              <div className="absolute bottom-3 left-3 glass px-3 py-1.5 rounded-lg">
                <span className="text-white text-xs font-medium">
                  {ROOM_LABELS[activeRoom?.room_type] || 'Room'} 3D Layout | {selectedRoomItems.length} selected products
                </span>
              </div>
            </div>

            {/* Main render view */}
            <div className="bg-slate-800 rounded-2xl overflow-hidden border border-white/10 aspect-video relative">
              <AnimatePresence mode="wait">
                {generating && !currentRender ? (
                  <motion.div key="generating"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center render-loading">
                    <div className="relative mb-6">
                      <div className="w-20 h-20 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin" />
                      <Sparkles className="w-8 h-8 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <h3 className="text-white font-bold text-lg mb-2">Generating Your Room</h3>
                    <p className="text-slate-400 text-sm text-center max-w-xs">
                      Our AI is crafting a photorealistic render of your {ROOM_LABELS[activeRoom?.room_type] || 'room'} in {STYLES.find(s => s.id === selectedStyle)?.label} style…
                    </p>
                    <div className="mt-4 flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
                      ))}
                    </div>
                  </motion.div>
                ) : currentRender?.image_url ? (
                  <motion.div key="rendered" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0">
                    <img src={currentRender.image_url} alt="AI Generated Interior" className="w-full h-full object-cover" />
                    <div className="absolute top-3 right-3 flex gap-2">
                      <a href={currentRender.image_url} download target="_blank"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-black/50 backdrop-blur text-white text-xs rounded-lg hover:bg-black/70 transition">
                        <Download className="w-3 h-3" /> Save
                      </a>
                    </div>
                    <div className="absolute bottom-3 left-3 glass px-3 py-1.5 rounded-lg">
                      <span className="text-white text-xs font-medium">
                        {STYLES.find(s => s.id === selectedStyle)?.emoji} {STYLES.find(s => s.id === selectedStyle)?.label} • AI Generated
                      </span>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                    <div className="w-20 h-20 rounded-2xl bg-indigo-900/50 border border-indigo-500/30 flex items-center justify-center mb-4">
                      <ImageIcon className="w-10 h-10 text-indigo-400" />
                    </div>
                    <h3 className="text-white font-bold text-lg mb-2">No Render Yet</h3>
                    <p className="text-slate-400 text-sm">
                      Select a style and palette, then click "Generate Realistic View"
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Previous renders gallery */}
            {renders.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Previous Renders</div>
                <div className="grid grid-cols-3 gap-3">
                  {renders.slice(0, 6).map((r: any, i) => (
                    <button key={r.id || i} onClick={() => setCurrentRender(r)}
                      className={clsx('rounded-xl overflow-hidden aspect-video border-2 transition-all',
                        currentRender?.image_url === r.image_url ? 'border-indigo-500' : 'border-transparent hover:border-white/30')}>
                      <img src={r.thumbnail_url || r.image_url} alt="Render" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
