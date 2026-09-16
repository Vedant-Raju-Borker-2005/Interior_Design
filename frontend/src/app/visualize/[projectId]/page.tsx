'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { projectsAPI, aiAPI, catalogAPI, premiumRenderAPI, designStudioAPI } from '@/lib/api'
import Navbar from '@/components/Navbar'
import RenderEntitlementPanel from '@/components/RenderEntitlementPanel'
import DesignEditForm from '@/components/DesignEditForm'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, ArrowLeft, Clock, CheckCircle2, Download,
  Image as ImageIcon, RefreshCw, X, Layout, AlignLeft, Settings,
  ChevronLeft, ChevronRight, Lock, PencilRuler, Box, Map as MapIcon, Loader2, FileText, ScanLine
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
  living_room:    'Living Room',
  bedroom_master: 'Master Bedroom',
  bedroom_2:      'Bedroom 2',
  kitchen:        'Kitchen',
  bathroom:       'Bathroom',
  balcony:        'Balcony',
  dining_room:    'Dining Room',
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

// Default room dimensions (in feet) for the floor plan preview in Templates tab
const DEFAULT_ROOM_DIMS: Record<string, { w: number; h: number }> = {
  living_room:    { w: 18, h: 14 },
  bedroom_master: { w: 16, h: 14 },
  bedroom_2:      { w: 13, h: 12 },
  kitchen:        { w: 14, h: 10 },
  bathroom:       { w: 9,  h: 7  },
  balcony:        { w: 12, h: 6  },
  dining_room:    { w: 14, h: 12 },
}

const ROOM_RENDER_WALLS: Record<string, { label: string; url: string }[]> = {
  living_room: [
    { label: 'Wall A — TV & Entertainment', url: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&fit=crop' },
    { label: 'Wall B — Sofa Lounge',        url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&fit=crop' },
    { label: 'Wall C — Gallery Wall',       url: 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=800&fit=crop' },
    { label: 'Wall D — Balcony View',       url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&fit=crop' },
  ],
  bedroom_master: [
    { label: 'Wall A — Bed Headboard',      url: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=800&fit=crop' },
    { label: 'Wall B — Wardrobe & Mirror',  url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800&fit=crop' },
    { label: 'Wall C — Study Nook',         url: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=800&fit=crop' },
    { label: 'Wall D — Window & Lounge',    url: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&fit=crop' },
  ],
  bedroom_2: [
    { label: 'Wall A — Bed Accent',         url: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&fit=crop' },
    { label: 'Wall B — Study & Storage',    url: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=800&fit=crop' },
    { label: 'Wall C — Wardrobe',           url: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=800&fit=crop' },
    { label: 'Wall D — Window',             url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800&fit=crop' },
  ],
  kitchen: [
    { label: 'Wall A — Hob & Counter',      url: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&fit=crop' },
    { label: 'Wall B — Sink & Dishwasher',  url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&fit=crop' },
    { label: 'Wall C — Pantry Tower',       url: 'https://images.unsplash.com/photo-1556912173-3bb406ef7e77?w=800&fit=crop' },
    { label: 'Wall D — Dining View',        url: 'https://images.unsplash.com/photo-1600489000022-c2086d79f9d4?w=800&fit=crop' },
  ],
  bathroom: [
    { label: 'Wall A — Vanity & Mirror',    url: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&fit=crop' },
    { label: 'Wall B — Shower Glass',       url: 'https://images.unsplash.com/photo-1604014237800-1c9102c219da?w=800&fit=crop' },
    { label: 'Wall C — WC & Storage',       url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&fit=crop' },
    { label: 'Wall D — Ventilation',        url: 'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=800&fit=crop' },
  ],
  balcony: [
    { label: 'Wall A — Open Railing View',  url: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=800&fit=crop' },
    { label: 'Wall B — Green Accent Wall',  url: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=800&fit=crop' },
    { label: 'Wall C — Seating & Storage',  url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&fit=crop' },
    { label: 'Wall D — Sliding Door Wall',  url: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&fit=crop' },
  ],
  dining_room: [
    { label: 'Wall A — Dining Table View',  url: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=800&fit=crop' },
    { label: 'Wall B — Sideboard Wall',     url: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&fit=crop' },
    { label: 'Wall C — Bar Cabinet',        url: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&fit=crop' },
    { label: 'Wall D — Window & Light',     url: 'https://images.unsplash.com/photo-1616137466211-f939a420be84?w=800&fit=crop' },
  ],
}


export default function ControlledVisualizePage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromParam = searchParams.get('from')
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

  // IDS Backend-AI state
  // The 3D model now fills the page; the drawer only hosts the Gemini 4-wall studio.
  const [activeStudioTab, setActiveStudioTab] = useState<'4wall' | '3dscene'>('4wall')

  // ── Full-page design studio ────────────────────────────────────────────────
  const viewerRef = useRef<HTMLIFrameElement | null>(null)
  const [viewerKey, setViewerKey] = useState(0)            // bump to redraw 2D + 3D
  const [viewerReady, setViewerReady] = useState(false)
  const [studioSummary, setStudioSummary] = useState<any>(null)
  // 2D plan and 3D model are separate views (never merged side by side).
  const [layoutMode, setLayoutMode] = useState<'plan' | '3d'>('plan')
  const [editOpen, setEditOpen] = useState(false)
  const [renderStudioOpen, setRenderStudioOpen] = useState(false)
  const [geminiUnlocked, setGeminiUnlocked] = useState(false)
  const [glbInfo, setGlbInfo] = useState<{ url: string | null; updated_at: string | null; stale: boolean } | null>(null)
  // The customer's uploaded floor plan, when it drives the 2D plan and 3D model.
  const [planBrief, setPlanBrief] = useState<{ active: boolean; status: string; bhk: string | null } | null>(null)
  const [exportingGlb, setExportingGlb] = useState<'download' | 'save' | null>(null)
  const glbRequest = useRef<{ id: string; mode: 'download' | 'save' } | null>(null)
  const [idsResult, setIdsResult] = useState<any>(null)
  const [solvingIds, setSolvingIds] = useState(false)

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

  const handleCalculateClearance = async () => {
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

    // Run IDS spatial solver for room
    try {
      setSolvingIds(true)
      const bhkText = project?.bhk ? (project.bhk.includes('BHK') ? project.bhk : `${project.bhk} BHK`) : '2 BHK'
      const styleName = selectedStyle === 'scandinavian' ? 'Scandinavian' : (selectedStyle === 'indian_contemporary' ? 'Indian Contemporary' : 'Modern')
      const res = await aiAPI.design({
        bhk: bhkText,
        style: styleName,
        solve: true,
      })
      setIdsResult(res.data)
    } catch (err) {
      console.warn('IDS solver background query:', err)
    } finally {
      setSolvingIds(false)
    }
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

    // Trigger IDS backend-ai solver in parallel
    const bhkText = project?.bhk ? (project.bhk.includes('BHK') ? project.bhk : `${project.bhk} BHK`) : '2 BHK'
    const styleName = selectedStyle === 'scandinavian' ? 'Scandinavian' : (selectedStyle === 'indian_contemporary' ? 'Indian Contemporary' : 'Modern')
    aiAPI.design({
      bhk: bhkText,
      style: styleName,
      solve: true,
    }).then(r => setIdsResult(r.data)).catch(() => {})

    try {
      const baseViewsList = BASE_VIEWS[activeRoom.room_type] || []
      const chosenView = baseViewsList.find((v) => v.id === selectedBaseView)
      const baseViewUrl = chosenView ? chosenView.url : ''

      // Every option chosen on the Customize step (the server also re-reads the
      // saved picks, so the render always matches what was chosen).
      const productsPayload = activeRoomItems.map((item: any) => ({
        id: item.product_id,
        name: item.product?.name,
        color: item.custom_color,
        fabric: item.custom_fabric,
        wood_finish: item.custom_wood_finish,
        size: item.custom_size,
        texture: item.custom_texture,
        cushion_style: item.custom_cushion_style,
        ...(item.custom_attributes || {}),
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

  // ── Design studio: Gemini lock + saved 3D model ─────────────────────────────
  const viewerOrigin = new URL(aiAPI.getInteractiveViewerUrl()).origin

  const loadStudioMeta = useCallback(async () => {
    const [ent, brief] = await Promise.allSettled([
      premiumRenderAPI.entitlement(projectId),
      designStudioAPI.get(projectId),
    ])
    if (ent.status === 'fulfilled') {
      const d = ent.value.data || {}
      setGeminiUnlocked(!!(d.gemini_rendering?.unlocked ?? d.premium_rendering?.unlocked))
    }
    if (brief.status === 'fulfilled') {
      setGlbInfo(brief.value.data.glb)
      setPlanBrief(brief.value.data.plan || null)
    }
  }, [projectId])

  useEffect(() => { loadStudioMeta() }, [loadStudioMeta])

  const postToViewer = useCallback((msg: any) => {
    viewerRef.current?.contentWindow?.postMessage(msg, viewerOrigin)
  }, [viewerOrigin])

  const requestGlb = useCallback((mode: 'download' | 'save') => {
    if (!viewerReady || glbRequest.current) return
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    glbRequest.current = { id, mode }
    setExportingGlb(mode)
    postToViewer({ type: 'ids:export-glb', requestId: id })
  }, [viewerReady, postToViewer])

  // Messages from the 2D/3D viewer.
  useEffect(() => {
    const onMessage = async (event: MessageEvent) => {
      if (event.origin !== viewerOrigin) return
      const msg = event.data || {}

      if (msg.type === 'ids:ready') {
        setViewerReady(true)
        setStudioSummary(msg.summary)
      }

      const pending = glbRequest.current
      if ((msg.type === 'ids:glb' || msg.type === 'ids:glb-error') && pending && pending.id === msg.requestId) {
        const { mode } = pending
        glbRequest.current = null
        if (msg.type === 'ids:glb-error') {
          setExportingGlb(null)
          if (mode === 'download') toast.error(`Could not export the 3D model: ${msg.message}`)
          return
        }
        const blob = new Blob([msg.buffer], { type: 'model/gltf-binary' })
        if (mode === 'download') {
          const href = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = href
          a.download = `${(project?.property_name || 'design').replace(/[^\w\- ]+/g, '').trim() || 'design'}.glb`
          document.body.appendChild(a)
          a.click()
          a.remove()
          setTimeout(() => URL.revokeObjectURL(href), 10000)
        }
        try {
          // Keep the server copy of the model in step with what is on screen.
          const r = await designStudioAPI.uploadGlb(projectId, blob)
          setGlbInfo({ url: r.data.url, updated_at: r.data.updated_at, stale: false })
          if (mode === 'download') toast.success(`3D model exported (${(blob.size / 1024 / 1024).toFixed(1)} MB)`)
        } catch {
          if (mode === 'download') toast('Downloaded — but a copy could not be saved to your project', { icon: '⚠️' })
        } finally {
          setExportingGlb(null)
        }
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [viewerOrigin, projectId, project?.property_name])

  // Layout: 2D plan / split / 3D model.
  useEffect(() => {
    if (viewerReady) postToViewer({ type: 'ids:layout', mode: layoutMode })
  }, [layoutMode, viewerReady, postToViewer])

  // First visit or after an edit: save the current 3D model to the project.
  useEffect(() => {
    if (viewerReady && glbInfo && (!glbInfo.url || glbInfo.stale)) requestGlb('save')
  }, [viewerReady, glbInfo, requestGlb])

  const handleDesignSaved = (payload: any) => {
    setViewerReady(false)
    setStudioSummary(null)
    setGlbInfo(payload?.glb || null)
    setViewerKey((k) => k + 1)          // reload the 2D plan and 3D model
    loadProject()
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

  const viewerSrc = `${aiAPI.getInteractiveViewerUrl(projectId)}?v=${viewerKey}`
  const COLOR_SWATCH: Record<string, string> = {
    'Warm White': '#F4EFE8', 'Off White': '#F7F5F0', 'Soft Grey': '#C9CBC8', 'Greige': '#CFC6B8', 'Charcoal Grey': '#3C3F43',
    'Ivory': '#F2E8D5', 'Terracotta': '#C1663F', 'Clay Beige': '#C9A98A', 'Olive Green': '#6B7248', 'Sand': '#D9C7A8',
    'Rust': '#A34D2A', 'Warm Taupe': '#9C8672', 'Deep Emerald': '#14553F', 'Royal Blue': '#23408E', 'Wine Maroon': '#6E1F2E',
    'Champagne Gold': '#C8A96A', 'Onyx Black': '#1C1C1E', 'Pearl Grey': '#D6D3CD', 'Blush Pink': '#E7C4C0',
    'Mustard Yellow': '#D9A521', 'Teal': '#1F7A78', 'Coral': '#E4735B', 'Sage Green': '#A7B79C', 'Burnt Orange': '#C25A2B',
  }

  const goBack = () => {
    if (fromParam === 'dashboard') router.push('/dashboard')
    else if (fromParam === 'track') router.push(`/track/${projectId}`)
    else router.push(`/customize/${projectId}`)
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-950 text-slate-800">
      <Navbar />

      {/* ═══════════════ STUDIO BAR ═══════════════ */}
      <div className="pt-16 shrink-0">
        <div className="bg-slate-900 border-b border-white/10 px-4 lg:px-6 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-slate-100">
          <button onClick={goBack} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10" title="Back">
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="text-base font-black truncate">{project?.property_name || 'Your home'}</h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
              {studioSummary ? (
                <>
                  {studioSummary.layout === 'uploaded-plan' && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-bold">Your floor plan</span>
                  )}
                  <span className="font-bold text-slate-200">{studioSummary.bhk}</span>
                  <span>·</span><span>{studioSummary.style}</span>
                  <span>·</span><span>{studioSummary.tier} tier</span>
                  <span>·</span><span>{studioSummary.area_sqft?.toLocaleString('en-IN')} sq ft</span>
                  <span>·</span><span>{studioSummary.rooms?.length} rooms</span>
                  <span>·</span><span>{studioSummary.objects} items</span>
                  {Array.isArray(studioSummary.picks) && studioSummary.picks.length > 0 && (() => {
                    const shown = studioSummary.picks.filter((p: any) => p.shown).length
                    const hidden = studioSummary.picks.filter((p: any) => !p.shown)
                    return (
                      <span
                        title={[
                          ...studioSummary.picks.filter((p: any) => p.shown).map((p: any) => `✓ ${p.product}`),
                          ...hidden.map((p: any) => `– ${p.product}: ${p.reason}`),
                        ].join('\n')}
                        className={clsx('px-1.5 py-0.5 rounded font-bold cursor-help',
                          hidden.length ? 'bg-amber-500/15 text-amber-300' : 'bg-indigo-500/20 text-indigo-200')}>
                        {shown}/{studioSummary.picks.length} of your picks shown
                      </span>
                    )
                  })()}
                  <span className="flex items-center gap-1 ml-1">
                    {(studioSummary.colors || []).map((c: string) => (
                      <i key={c} title={c} className="w-3 h-3 rounded-full border border-white/20" style={{ background: COLOR_SWATCH[c] || '#999' }} />
                    ))}
                  </span>
                </>
              ) : (
                <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Building your 2D plan and 3D model…</span>
              )}
            </div>
          </div>

          {/* View: 2D plan or 3D model — shown separately */}
          <div className="flex bg-slate-950/70 p-1 rounded-xl border border-white/10">
            {([
              { id: 'plan', label: '2D plan', icon: MapIcon },
              { id: '3d', label: '3D model', icon: Box },
            ] as const).map((m) => (
              <button key={m.id} type="button" onClick={() => setLayoutMode(m.id)}
                className={clsx('px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition',
                  layoutMode === m.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}>
                <m.icon className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{m.label}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button"
              onClick={() => router.push(`/plan-trace/${projectId}?next=${encodeURIComponent(`/visualize/${projectId}`)}`)}
              title={planBrief?.active ? 'Adjust the rooms traced from your floor plan' : 'Build the 2D plan and 3D model from your own floor plan'}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold flex items-center gap-1.5">
              <ScanLine className={clsx('w-4 h-4', planBrief?.active ? 'text-emerald-300' : 'text-slate-300')} />
              {planBrief?.active ? 'My floor plan' : 'Use my floor plan'}
            </button>

            <button type="button" onClick={() => setEditOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-white text-slate-900 hover:bg-indigo-50 text-xs font-extrabold flex items-center gap-1.5">
              <PencilRuler className="w-4 h-4 text-indigo-600" /> Edit design
            </button>

            <button type="button" onClick={() => requestGlb('download')} disabled={!viewerReady || !!exportingGlb}
              title={glbInfo?.updated_at ? `Saved copy updated ${new Date(glbInfo.updated_at).toLocaleString('en-IN')}` : 'Export the 3D model as a .glb file'}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
              {exportingGlb === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              3D model (.glb)
            </button>

            {/* Gemini photoreal renders — locked until the quotation is paid */}
            <button type="button" onClick={() => setRenderStudioOpen(true)}
              title={geminiUnlocked ? 'Photoreal renders with Gemini' : 'Unlocks once your quotation is paid'}
              className={clsx('px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border',
                geminiUnlocked
                  ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 border-transparent'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10')}>
              {geminiUnlocked ? <Sparkles className="w-4 h-4" /> : <Lock className="w-4 h-4 text-amber-300" />}
              Photoreal · Gemini
            </button>

            <button type="button" onClick={() => router.push(`/quotation/${projectId}`)}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold flex items-center gap-1.5">
              <FileText className="w-4 h-4" /> Quotation
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════ 2D PLAN + 3D MODEL (full page) ═══════════════ */}
      <div className="flex-1 relative bg-[#F7F5F1] min-h-0">
        {!viewerReady && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#F7F5F1] text-slate-500 pointer-events-none">
            <div className="w-12 h-12 border-4 border-indigo-600/10 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-sm font-bold">Building your 2D plan and 3D model…</p>
          </div>
        )}
        <iframe
          key={viewerKey}
          ref={viewerRef}
          src={viewerSrc}
          title="2D plan and 3D model"
          className="absolute inset-0 w-full h-full border-0"
        />
        {exportingGlb === 'save' && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-full bg-slate-900/85 text-white text-[11px] font-semibold flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" /> Saving 3D model to your project…
          </div>
        )}
      </div>

      <DesignEditForm
        projectId={projectId}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={handleDesignSaved}
      />

      {/* ═══════════════ PHOTOREAL RENDERS · GEMINI (drawer) ═══════════════ */}
      {renderStudioOpen && (
      <div className="fixed inset-0 z-50 flex">
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setRenderStudioOpen(false)} />
        <aside className="relative ml-auto w-full max-w-7xl h-full overflow-y-auto shadow-2xl"
          style={{ background: 'linear-gradient(135deg, #dfd9d4 0%, #bed4e3 20%, #6062ed 60%, #322e6b 100%)' }}>
        <div className="px-6 pt-6 pb-20">

        <div className="flex items-center justify-between mb-6 border-b border-white/30 pb-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              {geminiUnlocked ? <Sparkles className="w-6 h-6 text-indigo-600" /> : <Lock className="w-6 h-6 text-amber-600" />}
              Photoreal renders
            </h2>
            <p className="text-slate-600 text-xs mt-0.5">Powered by Gemini • {project?.property_name}</p>
          </div>
          <button onClick={() => setRenderStudioOpen(false)} className="p-2 bg-white/80 hover:bg-white rounded-xl border border-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!geminiUnlocked && (
          <div className="mb-6 bg-slate-900 text-white rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-400/15 text-amber-300 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold">Locked until your quotation is paid</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Your 2D plan and 3D model are free. Gemini photoreal renders — wall views and up to 20 high-quality images — unlock after payment.
                </p>
              </div>
            </div>
            <button onClick={() => router.push(`/quotation/${projectId}`)}
              className="px-4 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-xs whitespace-nowrap">
              View quotation
            </button>
          </div>
        )}

        <div className={clsx('grid lg:grid-cols-12 gap-8', !geminiUnlocked && 'pointer-events-none select-none opacity-40 grayscale')}
          aria-disabled={!geminiUnlocked}>
          
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

                    {idsResult && (
                      <div className="bg-indigo-950/40 p-3 rounded-2xl border border-indigo-500/20 space-y-1.5 text-[9px]">
                        <div className="flex justify-between items-center font-bold text-slate-300">
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-indigo-400" />
                            <span>IDS Spatial Solver:</span>
                          </span>
                          <span className={idsResult.feasible ? "text-emerald-400" : "text-amber-400"}>
                            {idsResult.feasible ? "Feasible (0 Violations)" : "Adjustments Needed"}
                          </span>
                        </div>
                        <div className="flex justify-between font-bold text-slate-300">
                          <span>Predicted Package Cost:</span>
                          <span className="text-indigo-300">₹{Number(idsResult.price).toLocaleString('en-IN')}</span>
                        </div>
                        {idsResult.recommendations && idsResult.recommendations.length > 0 && (
                          <div className="text-[8px] text-slate-400 pt-1 border-t border-white/5">
                            <span className="font-bold text-indigo-400">Associative Add-ons: </span>
                            {idsResult.recommendations.slice(0, 3).map((r: any) => r.category || r).join(', ')}
                          </div>
                        )}
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
            {!['ordered', 'done'].includes(project?.status) && (
              <button
                onClick={handleGenerate}
                disabled={generating || activeRoomItems.length === 0}
                className={clsx(
                  'w-full py-4 rounded-2xl font-bold text-sm shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]',
                  generating || activeRoomItems.length === 0
                    ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                    : 'bg-indigo-700 hover:bg-indigo-800 text-white'
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
            )}

          </div>

          {/* RIGHT COLUMN: 4-WALL VIEWPORT + PHOTOREAL 3D SCENE + FINALIZATION (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* 4-Wall Render Studio Viewport & 3D Spatial Scene */}
            <div className="bg-slate-900 border border-white/5 rounded-3xl p-5 shadow-2xl space-y-4 text-slate-100 min-h-[520px] flex flex-col justify-between">
              <div className="flex flex-wrap items-center justify-between border-b border-white/5 pb-3 gap-2">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-sm font-extrabold">4-Wall Studio</h3>
                  <span className="text-[10px] text-slate-400">Gemini</span>
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
                  Configure your room variant preferences on the left and click <strong>Generate Controlled Render</strong> to render all 4 walls with Gemini.
                </div>
              )}
            </div>

            {/* Finalize and get quotation CTA */}
            {(renders.length > 0 || renderedWallImages) && !generating && !['ordered', 'done'].includes(project?.status) && (
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
            </div>
          </div>

          {/* Floor plan upload stays available while renders are locked (1.1);
              premium batch (1.8) shows its own lock state. */}
          <div className="mt-8">
            <RenderEntitlementPanel
              projectId={projectId}
              floorPlanUrl={project?.floor_plan_url}
              onPlanChanged={loadProject}
            />
          </div>
        </div>
        </aside>
      </div>
      )}
    </div>
  )
}
