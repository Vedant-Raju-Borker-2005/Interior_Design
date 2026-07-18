'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { projectsAPI, catalogAPI } from '@/lib/api'
import Navbar from '@/components/Navbar'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight, ArrowRight, CheckCircle2, ShoppingBag,
  Info, Sparkles, AlertCircle, Settings, Sliders, ChevronDown,
  ChevronLeft, Image as ImageIcon
} from 'lucide-react'
import clsx from 'clsx'
import { getBestColorMatch, getColorHex } from '@/lib/colorUtils'

const ROOM_LABELS: Record<string, { label: string; icon: string }> = {
  living_room: { label: 'Living Room', icon: '🛋️' },
  bedroom_master: { label: 'Master Bedroom', icon: '🛏️' },
  bedroom_2: { label: 'Bedroom 2', icon: '🛌' },
  bedroom_3: { label: 'Bedroom 3', icon: '🛌' },
  kitchen: { label: 'Kitchen', icon: '🍳' },
  bathroom: { label: 'Bathroom', icon: '🚿' },
  balcony: { label: 'Balcony', icon: '🌿' },
}

const MANDATORY_CATEGORIES: Record<string, { id: string; label: string; desc: string }[]> = {
  living_room: [
    { id: 'sofas', label: 'Sofa', desc: 'Main seating element' },
    { id: 'coffee_tables', label: 'Coffee Table', desc: 'Central low table' },
    { id: 'side_tables', label: 'Side Tables', desc: 'Beside sofa accents' },
    { id: 'chairs', label: 'Accent Chair', desc: 'Secondary seating' },
    { id: 'rugs', label: 'Area Rug', desc: 'Flooring base' },
    { id: 'lighting', label: 'Lighting', desc: 'Ambient floor/table lamps' },
    { id: 'decor', label: 'Decor', desc: 'Wall art & accessories' },
  ],
  bedroom_master: [
    { id: 'Furniture', label: 'Master Bed', desc: 'Main sleeping set' },
    { id: 'Lighting', label: 'Lighting', desc: 'Bedside reading lamps' },
    { id: 'Décor', label: 'Decor & Rugs', desc: 'Cozy floor & accessories' },
  ],
  bedroom_2: [
    { id: 'Furniture', label: 'Bed set', desc: 'Main sleeping frame' },
    { id: 'Lighting', label: 'Lighting', desc: 'Lamps or spot lights' },
  ],
  kitchen: [
    { id: 'Kitchen', label: 'Modular Cabinets', desc: 'Base & wall counters' },
    { id: 'Lighting', label: 'Kitchen Lights', desc: 'Counter lighting' },
  ],
  bathroom: [
    { id: 'Furniture', label: 'Vanity Counter', desc: 'Wash basin setup' },
    { id: 'Décor', label: 'Fixtures', desc: 'Shower panels & hardware' },
  ],
}

export default function GuidedCustomizePage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const [project, setProject] = useState<any>(null)
  const [activeRoomIdx, setActiveRoomIdx] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  
  // Products listing inside selected category
  const [products, setProducts] = useState<any[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [exactColorMatchFound, setExactColorMatchFound] = useState(true)


  // Active customization state
  const [customizingProduct, setCustomizingProduct] = useState<any>(null)
  const [activeImageIdx, setActiveImageIdx] = useState(0)

  useEffect(() => {
    setActiveImageIdx(0)
  }, [customizingProduct?.id])
  const [customColor, setCustomColor] = useState('')
  const [customFabric, setCustomFabric] = useState('')
  const [customWoodFinish, setCustomWoodFinish] = useState('')
  const [customSize, setCustomSize] = useState('')
  const [customTexture, setCustomTexture] = useState('')
  const [customCushionStyle, setCustomCushionStyle] = useState('')
  const [savingItem, setSavingItem] = useState(false)

  const [loading, setLoading] = useState(true)

  const activeRoom = project?.rooms?.[activeRoomIdx]
  const activeRoomItems = activeRoom?.items || []

  // Load project detail
  const loadProject = async () => {
    try {
      const res = await projectsAPI.get(projectId)
      setProject(res.data)
    } catch {
      toast.error('Failed to load project details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProject()
  }, [projectId])

  // Get categories list based on active room type
  const getCategoriesForActiveRoom = () => {
    if (!activeRoom) return []
    return MANDATORY_CATEGORIES[activeRoom.room_type] || [
      { id: 'Furniture', label: 'Furniture', desc: 'Main elements' },
      { id: 'Lighting', label: 'Lighting', desc: 'Room fixtures' }
    ]
  }

  // Auto-select first incomplete category or first category
  useEffect(() => {
    const categories = getCategoriesForActiveRoom()
    if (categories.length > 0) {
      // Look for first category without a saved product
      const incomplete = categories.find(
        (cat) => !activeRoomItems.some((it: any) => it.product?.category?.toLowerCase() === cat.id.toLowerCase() || it.product?.subcategory?.toLowerCase() === cat.id.toLowerCase())
      )
      setSelectedCategory(incomplete ? incomplete.id : categories[0].id)
      setCustomizingProduct(null)
    }
  }, [activeRoomIdx, activeRoom?.room_type])

  // Fetch products inside the selected category
  const fetchProducts = async () => {
    if (!activeRoom || !selectedCategory) return
    setLoadingProducts(true)
    try {
      // Map frontend category filter tag to database categories
      const res = await catalogAPI.products({
        room_type: activeRoom.room_type,
        category: selectedCategory,
        pincode: project?.pincode,
        project_id: projectId,
        limit: 25
      })
      setProducts(res.data.items || [])
      setExactColorMatchFound(res.data.exact_color_match_found ?? true)
    } catch {
      setProducts([])
      setExactColorMatchFound(true)
    } finally {
      setLoadingProducts(false)
    }
  }


  useEffect(() => {
    fetchProducts()
  }, [activeRoomIdx, activeRoom?.room_type, selectedCategory])

  // Start customizing product attributes
  const handleSelectProduct = (product: any) => {
    setCustomizingProduct(product)
    const v = product.variants || {}
    const match = getBestColorMatch(v.color || [], project?.color_preferences || [])
    setCustomColor(match.color)
    setCustomFabric(v.fabric?.[0] || '')
    setCustomWoodFinish(v.wood_finish?.[0] || '')
    setCustomSize(v.size?.[0] || '')
    setCustomTexture(v.texture?.[0] || '')
    setCustomCushionStyle(v.cushion_style?.[0] || '')
  }

  // Save the customized selection to the room configuration
  const handleSaveSelection = async () => {
    if (!activeRoom || !customizingProduct) return
    setSavingItem(true)
    try {
      // Clear existing item in this category first if any
      const existing = activeRoomItems.find(
        (it: any) => it.product?.category?.toLowerCase() === selectedCategory.toLowerCase() || it.product?.subcategory?.toLowerCase() === selectedCategory.toLowerCase()
      )
      if (existing) {
        await projectsAPI.removeRoomItem(projectId, activeRoom.id, existing.id)
      }

      await projectsAPI.addRoomItem(projectId, activeRoom.id, {
        product_id: customizingProduct.id,
        qty: 1,
        custom_color: customColor || undefined,
        custom_fabric: customFabric || undefined,
        custom_wood_finish: customWoodFinish || undefined,
        custom_size: customSize || undefined,
        custom_texture: customTexture || undefined,
        custom_cushion_style: customCushionStyle || undefined,
      })

      toast.success(`${customizingProduct.name} saved! ✓`)
      setCustomizingProduct(null)
      await loadProject()

      // Automatically move to the next category or next room tab
      const categories = getCategoriesForActiveRoom()
      const currentIdx = categories.findIndex((c) => c.id === selectedCategory)
      if (currentIdx !== -1) {
        if (currentIdx < categories.length - 1) {
          // Go to next category in current room
          setSelectedCategory(categories[currentIdx + 1].id)
        } else if (activeRoomIdx < (project?.rooms?.length || 0) - 1) {
          // Last category of current room is done; auto-progress to next room tab
          setActiveRoomIdx(activeRoomIdx + 1)
          const nextRoomName = project.rooms[activeRoomIdx + 1].room_type.replace('_', ' ').toUpperCase()
          toast.success(`Switching to next room: ${nextRoomName}! 🚪`)
        }
      }
    } catch {
      toast.error('Failed to save product selection')
    } finally {
      setSavingItem(false)
    }
  }

  // Room completeness validation logic
  const checkRoomCompleteness = (room: any) => {
    if (!room) return { isComplete: false, missing: [] }
    const categories = MANDATORY_CATEGORIES[room.room_type] || []
    const itemCategories = room.items?.map((it: any) => (it.product?.subcategory || it.product?.category || '').toLowerCase()) || []

    const missing = categories.filter((cat) => !itemCategories.includes(cat.id.toLowerCase()))
    return {
      isComplete: missing.length === 0,
      missing: missing.map((m) => m.label)
    }
  }

  const getCompletedCategoriesCount = (room: any) => {
    if (!room || !room.items) return 0
    const categories = MANDATORY_CATEGORIES[room.room_type] || []
    const itemCategories = room.items.map((it: any) => (it.product?.subcategory || it.product?.category || '').toLowerCase())
    return categories.filter((cat) => itemCategories.includes(cat.id.toLowerCase())).length
  }

  const activeRoomCheck = checkRoomCompleteness(activeRoom)
  const allRoomsComplete = project?.rooms?.every((room: any) => checkRoomCompleteness(room).isComplete)
  const anyRoomComplete = project?.rooms?.some((room: any) => checkRoomCompleteness(room).isComplete)
  const anyItemAdded = project?.rooms?.some((room: any) => room.items && room.items.length > 0)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #dfd9d4 0%, #bed4e3 20%, #6062ed 60%, #322e6b 100%)' }}>
        <div className="text-center space-y-4 bg-white/40 backdrop-blur-md p-8 rounded-3xl border border-white/20 shadow-xl">
          <div className="w-16 h-16 border-4 border-indigo-600/10 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <p className="text-slate-800 text-sm font-extrabold animate-pulse">Initializing selection wizard…</p>
        </div>
      </div>
    )
  }

  const galleryImages = customizingProduct
    ? (customizingProduct.images || customizingProduct.variants?.images || [])
    : []

  return (
    <div className="min-h-screen text-slate-800 pb-20" style={{ background: 'linear-gradient(135deg, #dfd9d4 0%, #bed4e3 20%, #6062ed 60%, #322e6b 100%)', backgroundAttachment: 'fixed' }}>
      <Navbar />

      {/* TOP HEADER STATUS BAR */}
      <div className="fixed top-16 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-b border-slate-200 px-6 py-4 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-slate-800">
                {project?.property_name}
              </span>
              <span className="bg-indigo-50 border border-indigo-150 text-indigo-650 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase">
                {project?.bhk_type}
              </span>
            </div>
            <p className="text-slate-500 text-xs mt-0.5">Customize room configurations and choose custom elements</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/dashboard`)}
              className="py-2.5 px-5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition shadow-sm"
            >
              Exit to Dashboard
            </button>
            <button
              onClick={() => router.push(`/visualize/${projectId}`)}
              className={clsx(
                'py-2.5 px-6 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-[0.98]',
                anyItemAdded
                  ? 'bg-indigo-700 hover:bg-indigo-850 text-white'
                  : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
              )}
              disabled={!anyItemAdded}
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Proceed to AI Render</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <div className="max-w-7xl mx-auto px-6 pt-44 grid lg:grid-cols-12 gap-8">
        
        {/* LEFT PANEL: ROOM PROGRESS AND CATEGORIES (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Room Selector Card */}
          <div className="bg-slate-900 border border-white/5 rounded-3xl p-5 shadow-2xl">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">1. Select Room</h3>
            <div className="space-y-2">
              {project?.rooms?.map((room: any, idx: number) => {
                const check = checkRoomCompleteness(room)
                const isActive = idx === activeRoomIdx
                return (
                  <button
                    key={room.id}
                    onClick={() => {
                      setActiveRoomIdx(idx)
                      setCustomizingProduct(null)
                    }}
                    className={clsx(
                      'w-full text-left p-3.5 rounded-2xl transition border flex items-center justify-between',
                      isActive
                        ? 'bg-indigo-600/15 border-indigo-500 text-white font-bold'
                        : 'bg-slate-950/45 border-white/5 text-slate-400 hover:border-white/10 hover:text-white'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{ROOM_LABELS[room.room_type]?.icon || '🏠'}</span>
                      <span>{ROOM_LABELS[room.room_type]?.label || room.room_type}</span>
                    </div>
                    {check.isComplete ? (
                      <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-bold">
                        Complete ✓
                      </span>
                    ) : (
                      <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-bold">
                        {getCompletedCategoriesCount(room)}/{MANDATORY_CATEGORIES[room.room_type]?.length || 2} Done
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Categories Step Checklist */}
          {activeRoom && (
            <div className="bg-slate-900 border border-white/5 rounded-3xl p-5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">2. Category Checklist</h3>
                {activeRoomCheck.isComplete && (
                  <span className="text-xs text-emerald-400 font-extrabold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Room Complete
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                {getCategoriesForActiveRoom().map((cat) => {
                  const savedItemInCat = activeRoomItems.find(
                    (it: any) => it.product?.category?.toLowerCase() === cat.id.toLowerCase() || it.product?.subcategory?.toLowerCase() === cat.id.toLowerCase()
                  )
                  const isSelected = selectedCategory === cat.id

                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategory(cat.id)
                        setCustomizingProduct(null)
                      }}
                      className={clsx(
                        'w-full p-3.5 rounded-2xl border transition text-left flex items-start justify-between gap-3',
                        isSelected
                          ? 'bg-indigo-600 border-indigo-500 text-white font-bold'
                          : savedItemInCat
                            ? 'bg-slate-950/30 border-emerald-500/20 text-slate-300'
                            : 'bg-slate-950/50 border-white/5 text-slate-400 hover:text-white'
                      )}
                    >
                      <div>
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          <span>{cat.label}</span>
                          {savedItemInCat && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                        <p className="text-[10px] text-slate-500 font-normal mt-0.5">{cat.desc}</p>
                        {savedItemInCat && (
                          <div className="text-[10px] text-indigo-300 font-bold mt-1">
                            Chosen: {savedItemInCat.product?.name}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-600 mt-1 flex-shrink-0" />
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT AREA: PRODUCT DESIGN SELECTION AND CUSTOMIZER (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          <AnimatePresence mode="wait">
            {!customizingProduct ? (
              // STEP A: CHOOSE DESIGN
              <motion.div
                key="catalog"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="bg-slate-900 border border-white/5 rounded-3xl p-6 shadow-2xl min-h-[400px] flex flex-col justify-between"
              >
                <div>
                  <div className="border-b border-white/5 pb-4 mb-5">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Step 3</span>
                    <h2 className="text-xl font-extrabold text-white mt-1">Choose Design Category Product</h2>
                    <p className="text-slate-400 text-xs mt-0.5">Select a base design layout for your active room category.</p>
                  </div>

                  {!exactColorMatchFound && !loadingProducts && products.length > 0 && (
                    <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-2 text-[11px] font-medium text-amber-200">
                      <Sparkles className="w-4 h-4 flex-shrink-0 text-amber-350 animate-pulse" />
                      <span>The selected color is currently unavailable for this product category. Showing the closest available shades instead.</span>
                    </div>
                  )}

                  {loadingProducts ? (

                    <div className="grid md:grid-cols-2 gap-4 py-8">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-28 rounded-2xl bg-slate-950/50 border border-white/5 animate-pulse" />
                      ))}
                    </div>
                  ) : products.length === 0 ? (
                    <div className="text-center py-20 text-slate-500 text-xs">
                      No products catalogued for this room style category yet.
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                      {products.map((p) => {
                        const isChosen = activeRoomItems.some((it: any) => it.product_id === p.id)
                        return (
                          <div
                            key={p.id}
                            onClick={() => handleSelectProduct(p)}
                            className={clsx(
                              'p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 group',
                              isChosen
                                ? 'bg-indigo-950/20 border-indigo-500/40 shadow-inner'
                                : 'bg-slate-950/50 border-white/5 hover:border-white/10'
                            )}
                          >
                            <div className="flex items-center gap-3.5 min-w-0">
                              <img
                                src={p.thumbnail_url}
                                alt={p.name}
                                className="w-14 h-14 object-cover rounded-xl flex-shrink-0"
                              />
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors truncate">
                                  {p.name}
                                </h4>
                                <div className="text-xs font-bold text-indigo-400 mt-0.5">
                                  ₹{p.price.toLocaleString('en-IN')}
                                </div>
                                {/* Availability tier badge */}
                                <span className={clsx(
                                  'inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                                  p.availability_tier === 'local'
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                    : p.availability_tier === 'nearby'
                                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                                    : 'bg-slate-700/50 text-slate-400 border border-white/5'
                                )}>
                                  {p.availability_tier === 'local' ? '📍 Your Area' : p.availability_tier === 'nearby' ? '🏙️ Nearby' : '🌐 National'}
                                </span>
                              </div>
                            </div>
                            <button className="py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-md shrink-0">
                              {isChosen ? 'Configure' : 'Choose'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="text-slate-500 text-[10px] mt-6 flex items-center gap-1.5 bg-slate-950/30 p-3.5 rounded-2xl">
                  <Info className="w-4 h-4 text-slate-600" />
                  <span>Choose any design structure to expose variant and custom styling options.</span>
                </div>
              </motion.div>
            ) : (
              // STEP B: CUSTOMIZE ATTRIBUTES
              <motion.div
                key="customizer"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="bg-slate-900 border border-white/5 rounded-3xl p-6 shadow-2xl"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-5">
                  <div>
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Step 4</span>
                    <h2 className="text-xl font-extrabold text-white mt-1">Customize Product</h2>
                    <p className="text-slate-400 text-xs mt-0.5">Customize variant attributes for {customizingProduct.name}</p>
                  </div>
                  <button
                    onClick={() => setCustomizingProduct(null)}
                    className="py-1 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition"
                  >
                    Go Back
                  </button>
                </div>

                <div className="grid md:grid-cols-12 gap-6">
                  {/* Left Column: Product Info Card with Image Gallery Slider */}
                  <div className="md:col-span-5 bg-slate-950/40 border border-white/5 p-4 rounded-2xl flex flex-col justify-between">
                    <div>
                            {/* Image Viewer with Navigation Arrows */}
                            <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-3 group bg-slate-900 border border-white/5 flex items-center justify-center">
                              {galleryImages[activeImageIdx] ? (
                                <img
                                  src={galleryImages[activeImageIdx].startsWith('/') ? `http://localhost:8000${galleryImages[activeImageIdx]}` : galleryImages[activeImageIdx]}
                                  alt={customizingProduct.name}
                                  className="w-full h-full object-cover transition-all duration-300"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-900/90 select-none">
                                  <ImageIcon className="w-8 h-8 text-slate-600 mb-2 animate-pulse" />
                                  <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Optional View Not Uploaded</h5>
                                  <p className="text-[9px] text-slate-500 mt-1 max-w-xs leading-relaxed">
                                    The vendor has only provided the primary view for this component.
                                  </p>
                                </div>
                              )}
                              
                              {/* Navigation Arrows */}
                              <button
                                type="button"
                                onClick={() => setActiveImageIdx((prev) => (prev === 0 ? 2 : prev - 1))}
                                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-900/60 hover:bg-slate-900/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-md border border-white/10"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveImageIdx((prev) => (prev === 2 ? 0 : prev + 1))}
                                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-900/60 hover:bg-slate-900/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-md border border-white/10"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Thumbnail Indicators (Amazon/Flipkart style) */}
                            <div className="grid grid-cols-3 gap-2.5 mb-4">
                              {[0, 1, 2].map((idx) => {
                                const imgUrl = galleryImages[idx]
                                const isActive = activeImageIdx === idx
                                const label = idx === 0 ? "Front" : idx === 1 ? "Side" : "Top"
                                
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setActiveImageIdx(idx)}
                                    className={clsx(
                                      "relative h-12 rounded-lg overflow-hidden border transition flex flex-col items-center justify-center text-center p-1",
                                      isActive ? "border-indigo-500 bg-indigo-500/10 shadow-sm" : "border-white/5 bg-slate-900/40 hover:bg-slate-900/80 hover:border-slate-700"
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
                                        <ImageIcon className="w-3.5 h-3.5 text-slate-650 mb-0.5" />
                                        <span className="text-[7px] text-slate-500 font-bold uppercase tracking-wider">{label} N/A</span>
                                      </div>
                                    )}
                                  </button>
                                )
                              })}
                            </div>

                            <h4 className="text-sm font-extrabold text-white">{customizingProduct.name}</h4>
                      <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                        Design variant elements will overlay inside the visual rendering engine.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                      <span className="text-slate-400 text-xs font-semibold">Base Price:</span>
                      <span className="text-base font-extrabold text-indigo-400">
                        ₹{customizingProduct.price.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Custom Attribute Selectors */}
                  <div className="md:col-span-7 space-y-5">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-indigo-400" />
                      <span>Available Variants</span>
                    </h3>

                    {/* Color Options */}
                    {customizingProduct.variants?.color && (() => {
                      const matchResult = getBestColorMatch(customizingProduct.variants.color, project?.color_preferences || []);
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
                            {customizingProduct.variants.color.map((val: string) => {
                              const isSelected = customColor === val;
                              const isBestMatch = matchResult.color === val;
                              return (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => setCustomColor(val)}
                                  className={clsx(
                                    'px-3 py-1.5 rounded-xl text-xs transition border font-semibold flex items-center gap-1',
                                    isSelected
                                      ? 'bg-indigo-600 border-indigo-500 text-white'
                                      : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
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
                            <div className="bg-amber-950/30 border border-amber-900/30 rounded-xl p-2.5 text-[10px] text-amber-400 leading-normal flex items-start gap-1.5">
                              <span className="text-amber-500 font-bold">⚠️ Note:</span>
                              <span>Your preferred color isn't available for this product. We've selected the closest matching variant.</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Fabric Options */}
                    {customizingProduct.variants?.fabric && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Fabric Choice</label>
                        <div className="flex flex-wrap gap-1.5">
                          {customizingProduct.variants.fabric.map((val: string) => (
                            <button
                              key={val}
                              onClick={() => setCustomFabric(val)}
                              className={clsx(
                                'px-3 py-1.5 rounded-xl text-xs transition border font-semibold',
                                customFabric === val
                                  ? 'bg-indigo-600 border-indigo-500 text-white'
                                  : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                              )}
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Wood Finish Options */}
                    {customizingProduct.variants?.wood_finish && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Wood Finish</label>
                        <div className="flex flex-wrap gap-1.5">
                          {customizingProduct.variants.wood_finish.map((val: string) => (
                            <button
                              key={val}
                              onClick={() => setCustomWoodFinish(val)}
                              className={clsx(
                                'px-3 py-1.5 rounded-xl text-xs transition border font-semibold',
                                customWoodFinish === val
                                  ? 'bg-indigo-600 border-indigo-500 text-white'
                                  : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                              )}
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Size Options */}
                    {customizingProduct.variants?.size && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Size Option</label>
                        <div className="flex flex-wrap gap-1.5">
                          {customizingProduct.variants.size.map((val: string) => (
                            <button
                              key={val}
                              onClick={() => setCustomSize(val)}
                              className={clsx(
                                'px-3 py-1.5 rounded-xl text-xs transition border font-semibold',
                                customSize === val
                                  ? 'bg-indigo-600 border-indigo-500 text-white'
                                  : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                              )}
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Texture Options */}
                    {customizingProduct.variants?.texture && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Texture</label>
                        <div className="flex flex-wrap gap-1.5">
                          {customizingProduct.variants.texture.map((val: string) => (
                            <button
                              key={val}
                              onClick={() => setCustomTexture(val)}
                              className={clsx(
                                'px-3 py-1.5 rounded-xl text-xs transition border font-semibold',
                                customTexture === val
                                  ? 'bg-indigo-600 border-indigo-500 text-white'
                                  : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                              )}
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Cushion Style Options */}
                    {customizingProduct.variants?.cushion_style && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Cushion Style</label>
                        <div className="flex flex-wrap gap-1.5">
                          {customizingProduct.variants.cushion_style.map((val: string) => (
                            <button
                              key={val}
                              onClick={() => setCustomCushionStyle(val)}
                              className={clsx(
                                'px-3 py-1.5 rounded-xl text-xs transition border font-semibold',
                                customCushionStyle === val
                                  ? 'bg-indigo-600 border-indigo-500 text-white'
                                  : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                              )}
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleSaveSelection}
                      disabled={savingItem}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 mt-6 transition shadow-lg"
                    >
                      {savingItem ? (
                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                          <span>Save Selection</span>
                        </>
                      )}
                    </button>
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
                        <span className="col-span-2 text-white font-bold pl-2">{customizingProduct.primary_material || customizingProduct.primaryMaterial || 'Solid Wood'}</span>
                      </div>
                      <div className="grid grid-cols-3 py-1.5 border-b border-white/5">
                        <span className="col-span-1 text-slate-400 font-semibold">Dimensions</span>
                        <span className="col-span-2 text-white font-bold pl-2">
                          {customizingProduct.width || 1200}w × {customizingProduct.height || 750}h × {customizingProduct.depth || 600}d mm
                        </span>
                      </div>
                      <div className="grid grid-cols-3 py-1.5 border-b border-white/5">
                        <span className="col-span-1 text-slate-400 font-semibold">Weight</span>
                        <span className="col-span-2 text-white font-bold pl-2">{customizingProduct.weight || 15} kg</span>
                      </div>
                      <div className="grid grid-cols-3 py-1.5 border-b border-white/5">
                        <span className="col-span-1 text-slate-400 font-semibold">Capacity</span>
                        <span className="col-span-2 text-white font-bold pl-2">{customizingProduct.weight_capacity || customizingProduct.weightCapacity || 120} kg</span>
                      </div>
                      <div className="grid grid-cols-3 py-1.5 border-b border-white/5">
                        <span className="col-span-1 text-slate-400 font-semibold">Suitable Room</span>
                        <span className="col-span-2 text-white font-bold pl-2">{customizingProduct.suitable_room || customizingProduct.suitableRoom || 'Living Room'}</span>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-1">
                      <div className="grid grid-cols-3 py-1.5 border-b border-white/5">
                        <span className="col-span-1 text-slate-400 font-semibold">Style</span>
                        <span className="col-span-2 text-white font-bold pl-2">{customizingProduct.style || 'Modern'}</span>
                      </div>
                      <div className="grid grid-cols-3 py-1.5 border-b border-white/5">
                        <span className="col-span-1 text-slate-400 font-semibold">Finish</span>
                        <span className="col-span-2 text-white font-bold pl-2">{customizingProduct.finish || 'Matte'}</span>
                      </div>
                      <div className="grid grid-cols-3 py-1.5 border-b border-white/5">
                        <span className="col-span-1 text-slate-400 font-semibold">Mounting</span>
                        <span className="col-span-2 text-white font-bold pl-2">{customizingProduct.mounting_type || customizingProduct.mountingType || 'Floor Standing'}</span>
                      </div>
                      <div className="grid grid-cols-3 py-1.5 border-b border-white/5">
                        <span className="col-span-1 text-slate-400 font-semibold">Assembly</span>
                        <span className="col-span-2 text-white font-bold pl-2">{customizingProduct.assembly_required || customizingProduct.assemblyRequired || 'No'}</span>
                      </div>
                      <div className="grid grid-cols-3 py-1.5 border-b border-white/5">
                        <span className="col-span-1 text-slate-400 font-semibold">Colors</span>
                        <span className="col-span-2 text-white font-bold pl-2">{(customizingProduct.color_variants || customizingProduct.colorVariants || []).join(', ') || 'N/A'}</span>
                      </div>
                    </div>

                  </div>
                  {customizingProduct.description && (
                    <div className="text-xs text-slate-400 mt-2 bg-slate-950/40 p-3 rounded-xl border border-white/5">
                      <div className="font-bold text-white mb-1">Description / Notes</div>
                      {customizingProduct.description}
                    </div>
                  )}
                </div>

              </motion.div>

            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  )
}
