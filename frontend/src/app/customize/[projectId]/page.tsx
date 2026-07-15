'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { projectsAPI, catalogAPI } from '@/lib/api'
import Navbar from '@/components/Navbar'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight, ArrowRight, CheckCircle2, ShoppingBag,
  Info, Sparkles, AlertCircle, Settings, Sliders, ChevronDown
} from 'lucide-react'
import clsx from 'clsx'

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

  // Active customization state
  const [customizingProduct, setCustomizingProduct] = useState<any>(null)
  const [customColor, setCustomColor] = useState('')
  const [customFabric, setCustomFabric] = useState('')
  const [customWoodFinish, setCustomWoodFinish] = useState('')
  const [customSize, setCustomSize] = useState('')
  const [customTexture, setCustomTexture] = useState('')
  const [customCushionStyle, setCustomCushionStyle] = useState('')
  const [savingItem, setSavingItem] = useState(false)

  const [loading, setLoading] = useState(true)
  const [activeImage, setActiveImage] = useState('')

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
        limit: 25
      })
      setProducts(res.data.items || [])
    } catch {
      setProducts([])
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
    setActiveImage(product.thumbnail_url || '')
    const v = product.variants || {}
    setCustomColor(v.color?.[0] || '')
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

      // Automatically move to the next incomplete category to streamline workflow
      const categories = getCategoriesForActiveRoom()
      const currentIdx = categories.findIndex((c) => c.id === selectedCategory)
      if (currentIdx !== -1 && currentIdx < categories.length - 1) {
        setSelectedCategory(categories[currentIdx + 1].id)
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-sm animate-pulse">Initializing selection wizard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      <Navbar />

      {/* TOP HEADER STATUS BAR */}
      <div className="fixed top-16 left-0 right-0 z-40 bg-slate-900/90 backdrop-blur-xl border-b border-white/5 px-6 py-4 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent">
                {project?.property_name}
              </span>
              <span className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase">
                {project?.bhk_type}
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-0.5">Guided Room Configurator Wizard</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/visualize/${projectId}`)}
              className={clsx(
                'py-2.5 px-6 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg',
                anyItemAdded
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-650 hover:from-indigo-500 hover:to-purple-555 text-white'
                  : 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed'
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
      <div className="max-w-7xl mx-auto px-6 pt-36 grid lg:grid-cols-12 gap-8">
        
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
                            : 'bg-slate-950/50 border-white/5 text-slate-450 hover:text-white'
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
                  {/* Left Column: Product Info Card */}
                  <div className="md:col-span-5 bg-slate-950/40 border border-white/5 p-4 rounded-2xl flex flex-col justify-between">
                    <div>
                      {/* Main Image with Zoom Hover Effect */}
                      <div className="relative w-full aspect-square overflow-hidden rounded-xl mb-4 border border-white/10 bg-slate-950">
                        <img
                          src={activeImage.startsWith('/') ? `http://localhost:8000${activeImage}` : activeImage}
                          alt={customizingProduct.name}
                          className="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
                        />
                      </div>

                      {/* Multi-Image Thumbnails (Flipkart/Amazon style) */}
                      {customizingProduct.variants?.images && customizingProduct.variants.images.length > 1 && (
                        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-thin">
                          {customizingProduct.variants.images.map((img: string, idx: number) => (
                            <div
                              key={idx}
                              onMouseEnter={() => setActiveImage(img)}
                              onClick={() => setActiveImage(img)}
                              className={clsx(
                                'w-12 h-12 rounded-lg overflow-hidden border-2 cursor-pointer transition-all flex-shrink-0 bg-slate-950',
                                activeImage === img ? 'border-indigo-500 scale-105' : 'border-white/5 opacity-60 hover:opacity-100'
                              )}
                            >
                              <img src={img.startsWith('/') ? `http://localhost:8000${img}` : img} className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      )}

                      <h4 className="text-sm font-extrabold text-white">{customizingProduct.name}</h4>
                      
                      {/* Specifications / Product Info Sheet */}
                      <div className="mt-3 p-3 bg-slate-950/30 rounded-xl border border-white/5 space-y-1">
                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Specifications</div>
                        <div className="text-[10px] text-slate-350"><span className="text-slate-500 font-semibold">SKU:</span> {customizingProduct.sku}</div>
                        <div className="text-[10px] text-slate-350"><span className="text-slate-500 font-semibold">Category:</span> {customizingProduct.category} {customizingProduct.subcategory ? `• ${customizingProduct.subcategory}` : ''}</div>
                        {customizingProduct.description && (
                          <div className="text-[10px] text-slate-350 leading-relaxed mt-1"><span className="text-slate-500 font-semibold">Details:</span> {customizingProduct.description}</div>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                      <span className="text-slate-400 text-xs font-semibold">Base Price:</span>
                      <span className="text-base font-extrabold text-indigo-400">
                        ₹{customizingProduct.price.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Custom Attribute Selectors */}
                  <div className="md:col-span-7 space-y-4">
                    {/* Preferred Color Theme Validation Warning */}
                    {project?.color_preference && customizingProduct.variants?.color && 
                     !customizingProduct.variants.color.some((c: string) => c.toLowerCase() === project.color_preference.toLowerCase()) && (
                       <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-[11px] leading-relaxed flex items-start gap-2 mb-2">
                         <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                         <div>
                           <span className="font-bold">Color Theme Warning:</span> The preferred theme color <strong>"{project.color_preference}"</strong> is not available for this design. Please customize using another color variant.
                         </div>
                       </div>
                    )}

                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-indigo-400" />
                      <span>Custom Attributes</span>
                    </h3>

                    {/* Color Options */}
                    {customizingProduct.variants?.color && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Color Variant</label>
                        <div className="flex flex-wrap gap-1.5">
                          {customizingProduct.variants.color.map((val: string) => (
                            <button
                              key={val}
                              onClick={() => setCustomColor(val)}
                              className={clsx(
                                'px-3 py-1.5 rounded-xl text-xs transition border font-semibold',
                                customColor === val
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
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  )
}
