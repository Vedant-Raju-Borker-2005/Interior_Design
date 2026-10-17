'use client'
import { useEffect, useRef, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { projectsAPI, catalogAPI, recommendationsAPI, planLayoutAPI, apiErrorMessage, type PlanLayoutPayload } from '@/lib/api'
import Navbar from '@/components/Navbar'
import ProductImage from '@/components/ProductImage'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight, ArrowRight, CheckCircle2, ShoppingBag,
  Info, Sparkles, AlertCircle, Settings, Sliders, ChevronDown,
  ChevronLeft, Image as ImageIcon, Upload, Layout, FileText, Check, ShieldCheck, X
} from 'lucide-react'
import clsx from 'clsx'
import { getBestColorMatch, getColorHex } from '@/lib/colorUtils'

const getRoomLabelAndIcon = (roomType: string, bhkType?: string) => {
  const is1BHK = bhkType === '1BHK'
  if (is1BHK) {
    if (roomType === 'bedroom_master') return { label: 'Bedroom', icon: '🛏️' }
    if (roomType === 'bathroom') return { label: 'Bathroom', icon: '🚿' }
  }
  
  const defaults: Record<string, { label: string; icon: string }> = {
    living_room: { label: 'Living Room', icon: '🛋️' },
    bedroom_master: { label: 'Master Bedroom 1', icon: '🛏️' },
    bedroom_2: { label: 'Bedroom 2', icon: '🛌' },
    bedroom_3: { label: 'Bedroom 3', icon: '🛌' },
    bedroom_4: { label: 'Bedroom 4', icon: '🛌' },
    bedroom_5: { label: 'Bedroom 5', icon: '🛌' },
    kitchen: { label: 'Kitchen', icon: '🍳' },
    bathroom: { label: 'Bathroom 1', icon: '🚿' },
    bathroom_2: { label: 'Bathroom 2', icon: '🚿' },
    bathroom_3: { label: 'Bathroom 3', icon: '🚿' },
    bathroom_4: { label: 'Bathroom 4', icon: '🚿' },
    balcony: { label: 'Balcony', icon: '🌿' },
  }
  return defaults[roomType] || { label: roomType.replace('_', ' '), icon: '🏠' }
}

const MANDATORY_CATEGORIES: Record<string, { id: string; label: string; desc: string }[]> = {
  living_room: [
    { id: 'sofas', label: 'Sofa', desc: 'Main seating element' },
    { id: 'coffee_tables', label: 'Coffee Table', desc: 'Central low table' },
    { id: 'side_tables', label: 'Side Tables', desc: 'Beside sofa accents' },
    { id: 'chairs', label: 'Accent Chair', desc: 'Secondary seating' },
    { id: 'shoe_racks', label: 'Shoe Rack', desc: 'Entryway footwear storage' },
    { id: 'rugs', label: 'Area Rug', desc: 'Flooring base' },
    { id: 'lighting', label: 'Lighting', desc: 'Ambient floor/table lamps' },
  ],
  bedroom_master: [
    { id: 'beds', label: 'Master Bed', desc: 'Main sleeping set' },
    { id: 'bedside_tables', label: 'Bedside Table', desc: 'Nightstand storage' },
    { id: 'study_desk', label: 'Study Desk', desc: 'Workstation setup' },
    { id: 'lighting', label: 'Lighting', desc: 'Bedside reading lamps' },
  ],
  bedroom_2: [
    { id: 'beds', label: 'Bed set', desc: 'Main sleeping frame' },
    { id: 'bedside_tables', label: 'Bedside Table', desc: 'Nightstand storage' },
    { id: 'lighting', label: 'Lighting', desc: 'Lamps or spot lights' },
  ],
  kitchen: [
    { id: 'kitchen', label: 'Modular Cabinets', desc: 'Base & wall counters' },
  ],
  bathroom: [
    { id: 'vanity', label: 'Vanity Counter', desc: 'Wash basin setup' },
    { id: 'fixtures', label: 'Fixtures', desc: 'Shower panels & hardware' },
  ],
}

// Option groups a vendor can define for a product. Known groups keep a fixed
// order and wording; any new group a vendor adds is shown after them.
const VARIANT_LABELS: Record<string, string> = {
  color: 'Color', fabric: 'Fabric Choice', wood_finish: 'Wood Finish', material: 'Material',
  texture: 'Texture', size: 'Size Option', cushion_style: 'Cushion Style',
}
const NON_OPTION_KEYS = new Set(['images', 'image', 'thumbnail', 'gallery'])

const variantGroups = (product: any): { key: string; label: string; values: string[] }[] => {
  const variants = product?.variants
  if (!variants || typeof variants !== 'object' || Array.isArray(variants)) return []
  const known = Object.keys(VARIANT_LABELS)
  const keys = Object.keys(variants)
    .filter((k) => !NON_OPTION_KEYS.has(k))
    .sort((a, b) => {
      const ia = known.indexOf(a), ib = known.indexOf(b)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b)
    })
  return keys
    .map((key) => {
      const raw = Array.isArray(variants[key]) ? variants[key] : typeof variants[key] === 'string' ? [variants[key]] : []
      const values = Array.from(new Set(raw.map((v: any) => String(v ?? '').trim()).filter(Boolean))) as string[]
      const label = VARIANT_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      return { key, label, values }
    })
    .filter((g) => g.values.length > 0)          // no empty headings
}

export default function GuidedCustomizePage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const [project, setProject] = useState<any>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  
  // Products listing inside selected category
  const [products, setProducts] = useState<any[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [exactColorMatchFound, setExactColorMatchFound] = useState(true)

  // Active customization state
  const [customizingProduct, setCustomizingProduct] = useState<any>(null)
  const [activeImageIdx, setActiveImageIdx] = useState(0)
  const [isHoveringImage, setIsHoveringImage] = useState(false)
  const [showFloorPlanModal, setShowFloorPlanModal] = useState(false)

  useEffect(() => {
    setActiveImageIdx(0)
    setIsHoveringImage(false)
  }, [customizingProduct?.id])

  // Auto-rotate perspective view carousel (Front -> Side -> Top every 5s with pause on hover)
  useEffect(() => {
    if (!customizingProduct || isHoveringImage) return
    const views = customizingProduct.images?.length
      ? customizingProduct.images
      : (customizingProduct.variants?.images?.length ? customizingProduct.variants.images : [])
    const viewsCount = views.length > 0 ? views.length : 3
    if (viewsCount <= 1) return
    const timer = setInterval(() => {
      setActiveImageIdx((prev) => (prev + 1) % viewsCount)
    }, 5000)
    return () => clearInterval(timer)
  }, [customizingProduct, isHoveringImage])

  // One value per option group the vendor defined for the product (colour,
  // fabric, wood finish, size, texture, cushion style, or anything they add).
  const [customAttrs, setCustomAttrs] = useState<Record<string, string>>({})
  const setAttr = (key: string, value: string) => setCustomAttrs((prev) => ({ ...prev, [key]: value }))
  const [savingItem, setSavingItem] = useState(false)
  
  // Complementary Recommendations State (inside detail panel)
  const [complementaryData, setComplementaryData] = useState<any>(null)
  const [loadingComplementary, setLoadingComplementary] = useState(false)
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([])

  // Inline card-level preview state (shown directly on the grid without opening detail)
  const [inlinePreviewProductId, setInlinePreviewProductId] = useState<string | null>(null)
  const [inlinePreviewData, setInlinePreviewData] = useState<Record<string, any>>({})
  const [loadingInlinePreview, setLoadingInlinePreview] = useState<string | null>(null)
  const [productMood, setProductMood] = useState<Record<string, 'monochrome' | 'accent'>>({})
  const [savingBundleId, setSavingBundleId] = useState<string | null>(null)
  const [customizingMood, setCustomizingMood] = useState<'monochrome' | 'accent'>('monochrome')

  const [uploadingPlan, setUploadingPlan] = useState(false)
  const [planInfo, setPlanInfo] = useState<PlanLayoutPayload | null>(null)
  const planInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const [hasSetInitialRoom, setHasSetInitialRoom] = useState(false)
  const [userEditingCategory, setUserEditingCategory] = useState(false)
  const [activeSidebarTab, setActiveSidebarTab] = useState<'customizer' | 'floorplan'>('customizer')

  const colorVariants = useMemo<any[]>(() => {
    if (!customizingProduct) return []
    const cat = (customizingProduct.category || customizingProduct.subCategory || '').toLowerCase()
    const name = (customizingProduct.name || '').toLowerCase()
    const isSofa = cat.includes('sofa') || name.includes('sofa')

    // Find candidate siblings from `products` in current category
    let candidates = products.filter((p: any) => {
      if (isSofa) {
        const pCat = (p.category || p.subCategory || '').toLowerCase()
        const pName = (p.name || '').toLowerCase()
        return pCat.includes('sofa') || pName.includes('sofa')
      }
      if (customizingProduct.sub_category && p.sub_category === customizingProduct.sub_category) return true
      return p.category === customizingProduct.category
    })

    // For sofas, prioritize Blush Pink, Royal Navy Blue, Warm Beige
    if (isSofa) {
      const preferred = ['blush pink', 'royal navy blue', 'warm beige']
      const prioritized = candidates.filter((p: any) => {
        const pName = (p.name || '').toLowerCase()
        const c = ((p.variants?.color?.[0] || '') as string).toLowerCase()
        return preferred.some((pref) => pName.includes(pref) || c.includes(pref))
      })
      if (prioritized.length >= 2) {
        prioritized.sort((a: any, b: any) => {
          const aName = (a.name || '').toLowerCase()
          const bName = (b.name || '').toLowerCase()
          const aIdx = preferred.findIndex((c) => aName.includes(c))
          const bIdx = preferred.findIndex((c) => bName.includes(c))
          return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx)
        })
        candidates = prioritized
      }
    }

    // Deduplicate by color name
    const seen = new Set<string>()
    const result: any[] = []
    for (const p of candidates) {
      const colorName = p.variants?.color?.[0] || p.name.replace(/sofa\s*set/i, '').trim() || p.name
      const normKey = colorName.toLowerCase()
      if (!seen.has(normKey)) {
        seen.add(normKey)
        const isCurrent = p.id === customizingProduct.id || (customAttrs.color && customAttrs.color.toLowerCase() === normKey)
        result.push({
          product: p,
          colorName: colorName,
          thumbnail: p.thumbnail_url || (p.images && p.images[0]) || (p.variants?.images && p.variants.images[0]),
          images: p.images?.length ? p.images : (p.variants?.images?.length ? p.variants.images : [p.thumbnail_url]),
          isSelected: isCurrent
        })
      }
    }

    if (result.length <= 1 && Array.isArray(customizingProduct.variants?.color) && customizingProduct.variants.color.length > 1) {
      return customizingProduct.variants.color.map((c: string) => ({
        product: customizingProduct,
        colorName: c,
        thumbnail: customizingProduct.thumbnail_url,
        images: customizingProduct.images || customizingProduct.variants?.images || [customizingProduct.thumbnail_url],
        isSelected: (customAttrs.color || '').toLowerCase() === c.toLowerCase()
      }))
    }

    return result
  }, [customizingProduct, products, customAttrs.color])

  // Reset inline preview state when user switches rooms
  useEffect(() => {
    setInlinePreviewProductId(null)
    setInlinePreviewData({})
  }, [activeRoomId])

  // Fetch complementary bundle whenever the user opens a product for customization
  useEffect(() => {
    if (!customizingProduct?.id || !projectId) {
      setComplementaryData(null)
      setSelectedAddonIds([])
      return
    }
    const fetchBundle = async () => {
      setLoadingComplementary(true)
      try {
        const res = await recommendationsAPI.getComplementaryBundle(
          customizingProduct.id,
          projectId,
          activeRoomId || undefined,
          customizingMood
        )
        setComplementaryData(res.data)
        // All recommended pairings are unticked by default as requested
        setSelectedAddonIds([])
      } catch (e) {
        console.error('Failed to fetch complementary recommendations', e)
        setComplementaryData(null)
        setSelectedAddonIds([])
      } finally {
        setLoadingComplementary(false)
      }
    }
    fetchBundle()
  }, [customizingProduct?.id, projectId, activeRoomId, customizingMood])

  const getSortedRoomsList = () => {
    if (!project?.rooms) return []
    return project.rooms.filter((r: any) => r.room_type !== 'balcony')
  }

  const validRooms = getSortedRoomsList()
  const activeRoom = validRooms.find((r: any) => r.id === activeRoomId) || validRooms[0]
  const activeRoomIdx = validRooms.findIndex((r: any) => r.id === activeRoom?.id) ?? 0
  const activeRoomItems = activeRoom?.items || []

  // Load project detail
  const loadProject = async () => {
    try {
      const res = await projectsAPI.get(projectId)
      setProject(res.data)
      return res.data
    } catch {
      toast.error('Failed to load project details')
      return null
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProject()
  }, [projectId])

  // Resolve room-specific categories
  const getRoomMandatoryCategories = (roomType: string) => {
    if (MANDATORY_CATEGORIES[roomType]) {
      return MANDATORY_CATEGORIES[roomType]
    }
    if (roomType.startsWith('bedroom_')) {
      return MANDATORY_CATEGORIES['bedroom_2'] || MANDATORY_CATEGORIES['bedroom_master']
    }
    if (roomType.startsWith('bathroom_')) {
      return MANDATORY_CATEGORIES['bathroom']
    }
    if (roomType === 'balcony') {
      return [
        { id: 'chairs', label: 'Outdoor Seating', desc: 'Balcony chairs/table' },
        { id: 'fixtures', label: 'Planters & Lights', desc: 'Decorative green elements' }
      ]
    }
    return [
      { id: 'sofas', label: 'Furniture', desc: 'Main elements' },
      { id: 'lighting', label: 'Lighting', desc: 'Room fixtures' }
    ]
  }

  const matchCategory = (catId: string, prod: any) => {
    if (!prod) return false
    const norm = (str: string) => (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/_/g, ' ').trim()
    const cleanCat = norm(catId)
    const pCat = norm(prod.category)
    const pSubCat = norm(prod.subCategory || prod.sub_category)
    const pName = norm(prod.name)
    
    if (cleanCat.includes('sofa')) {
      return pCat.includes('sofa') || pSubCat.includes('sofa') || pName.includes('sofa')
    }
    if (cleanCat.includes('coffee')) {
      return pCat.includes('coffee') || pSubCat.includes('coffee') || pName.includes('coffee')
    }
    if (cleanCat.includes('bedside')) {
      return pCat.includes('bedside') || pSubCat.includes('bedside') || pName.includes('bedside') || pName.includes('nightstand')
    }
    if (cleanCat.includes('side table')) {
      return (pCat.includes('side') || pSubCat.includes('side') || pName.includes('side table')) && !pName.includes('bedside')
    }
    if (cleanCat.includes('desk') || cleanCat.includes('study')) {
      return pCat.includes('desk') || pSubCat.includes('desk') || pName.includes('desk') || pName.includes('study')
    }
    if (cleanCat.includes('shoe')) {
      return pCat.includes('shoe') || pSubCat.includes('shoe') || pName.includes('shoe') || pName.includes('rack')
    }
    if (cleanCat.includes('rug')) {
      return pCat.includes('rug') || pSubCat.includes('rug') || pName.includes('rug') || pName.includes('carpet')
    }
    if (cleanCat.includes('lighting') || cleanCat.includes('lamp')) {
      return pCat.includes('lighting') || pSubCat.includes('lamp') || pName.includes('light') || pName.includes('lamp')
    }
    if (cleanCat.includes('bed')) {
      return (pCat.includes('bed') || pName.includes('bed')) && !pName.includes('bedside') && !pName.includes('side table') && !pName.includes('desk')
    }
    if (cleanCat.includes('chair')) {
      return pCat.includes('chair') || pSubCat.includes('chair') || pName.includes('chair')
    }
    if (cleanCat.includes('kitchen') || cleanCat.includes('cabinet')) {
      return pCat.includes('kitchen') || pSubCat.includes('cabinet') || pName.includes('cabinet')
    }
    if (cleanCat.includes('vanity')) {
      return pCat.includes('vanity') || pSubCat.includes('vanity') || pName.includes('vanity') || pName.includes('basin') || pName.includes('counter')
    }
    if (cleanCat.includes('fixture') || cleanCat.includes('decor')) {
      return pCat.includes('decor') || pCat.includes('fixture') || pSubCat.includes('fixture') || pName.includes('fixture') || pName.includes('towel') || pName.includes('rack') || pName.includes('shower') || pName.includes('hardware')
    }

    return pCat.includes(cleanCat) || pSubCat.includes(cleanCat) || pName.includes(cleanCat)
  }

  const checkRoomCompleteness = (room: any) => {
    if (room.room_type === 'balcony') return { isComplete: true }
    const reqCats = getRoomMandatoryCategories(room.room_type)
    const savedItems = room.items || []
    const isComplete = reqCats.every((cat) =>
      savedItems.some((it: any) => matchCategory(cat.id, it.product))
    )
    return { isComplete }
  }

  const getCompletedCategoriesCount = (room: any) => {
    if (room.room_type === 'balcony') return getRoomMandatoryCategories(room.room_type).length
    const reqCats = getRoomMandatoryCategories(room.room_type)
    const savedItems = room.items || []
    return reqCats.filter((cat) =>
      savedItems.some((it: any) => matchCategory(cat.id, it.product))
    ).length
  }

  const checkAllRoomsComplete = () => {
    if (!validRooms || validRooms.length === 0) return false
    return validRooms.every((r: any) => checkRoomCompleteness(r).isComplete)
  }

  useEffect(() => {
    if (validRooms?.length > 0 && !hasSetInitialRoom) {
      const firstIncomplete = validRooms.find((r: any) => !checkRoomCompleteness(r).isComplete)
      if (firstIncomplete) {
        setActiveRoomId(firstIncomplete.id)
      } else {
        setActiveRoomId(validRooms[0].id)
      }
      setHasSetInitialRoom(true)
    }
  }, [project, hasSetInitialRoom, validRooms])

  useEffect(() => {
    if (activeRoom && !userEditingCategory) {
      const mandatory = getRoomMandatoryCategories(activeRoom.room_type)
      const firstUnconfigured = mandatory.find(
        (cat) => !activeRoomItems.some((it: any) => matchCategory(cat.id, it.product))
      )
      if (firstUnconfigured) {
        setSelectedCategory(firstUnconfigured.id)
      } else {
        setSelectedCategory(mandatory[0]?.id || '')
      }
    }
  }, [activeRoomId, project, userEditingCategory])

  useEffect(() => {
    if (!selectedCategory || !activeRoom) return
    const fetchCategoryProducts = async () => {
      setLoadingProducts(true)
      try {
        const res = await catalogAPI.getProducts({
          category: selectedCategory,
          style: project?.style_vibe || 'Modern',
          budget: project?.budget || 500000,
          project_id: projectId,
          // With the room known, the catalogue leaves out anything that cannot
          // physically stand in it — measured from the customer's floor plan
          // once they have confirmed one.
          room_id: activeRoomId || undefined
        })
        const raw = res.data
        const items = Array.isArray(raw) 
          ? raw 
          : (Array.isArray(raw?.items) ? raw.items : (Array.isArray(raw?.products) ? raw.products : []))
        
        let colorMatchOk = true
        if (typeof raw?.exact_color_match_found === 'boolean') {
          colorMatchOk = raw.exact_color_match_found
        } else {
          const prefColors = project?.color_preferences || []
          if (prefColors.length > 0 && items.length > 0) {
            const hasColorAvailable = items.some((p: any) => {
              const availColors = p.variants?.color || []
              if (availColors.length === 0) return true
              return availColors.some((c: string) =>
                prefColors.some((pc: string) => c.toLowerCase().includes(pc.toLowerCase()) || pc.toLowerCase().includes(c.toLowerCase()))
              )
            })
            if (!hasColorAvailable) {
              colorMatchOk = false
            }
          }
        }
        setExactColorMatchFound(colorMatchOk)
        setProducts(items)
      } catch {
        setProducts([])
      } finally {
        setLoadingProducts(false)
      }
    }
    fetchCategoryProducts()
  }, [selectedCategory, activeRoomId, project])

  const handleSelectProduct = (product: any) => {
    setCustomizingProduct(product)
    const existingInRoom = activeRoomItems.find((it: any) => it.product_id === product.id)
    
    const groups = variantGroups(product)
    let defaultColor = product.variants?.color?.[0] || ''
    if (project?.color_preferences?.length > 0 && product.variants?.color?.length > 0) {
      const bestMatch = getBestColorMatch(product.variants.color, project.color_preferences)
      defaultColor = bestMatch.color
    }

    // Start from what was saved for this product (if anything), else the
    // palette's best colour match and each group's first option.
    const saved: Record<string, string> = existingInRoom?.custom_attributes || {}
    const next: Record<string, string> = {}
    for (const { key, values } of groups) {
      const previous = saved[key]
      next[key] = previous && values.includes(previous)
        ? previous
        : key === 'color' && defaultColor ? defaultColor : values[0]
    }
    setCustomAttrs(next)
  }

  const handleSaveSelection = async (includeAddons: boolean = false, explicitAddonIds?: string[]) => {
    if (!customizingProduct || !activeRoomId) return
    setSavingItem(true)
    try {
      // Only options this product actually offers are saved.
      const customAttributes: Record<string, string> = {}
      for (const { key, values } of variantGroups(customizingProduct)) {
        const value = customAttrs[key]
        if (value && values.includes(value)) customAttributes[key] = value
      }

      const itemsToSave: any[] = [
        {
          product_id: customizingProduct.id,
          qty: 1,
          unit_price: customizingProduct.price,
          custom_attributes: customAttributes,
        }
      ]

      if (includeAddons && complementaryData?.recommended_items) {
        const targetIds = explicitAddonIds || selectedAddonIds
        const selectedAddons = complementaryData.recommended_items.filter((it: any) =>
          targetIds.includes(it.id)
        )
        for (const addon of selectedAddons) {
          itemsToSave.push({
            product_id: addon.id,
            qty: 1,
            unit_price: addon.price,
            custom_attributes: addon.default_attributes || {},
        })
      }
    }

      if (itemsToSave.length > 1) {
        await projectsAPI.addRoomItemBundle(projectId, activeRoomId, itemsToSave)
        toast.success(`Saved ${customizingProduct.name} + ${itemsToSave.length - 1} coordinated add-ons!`)
      } else {
        // Delete any previously saved item in the SAME category for this room to enforce 1 item per category
        const existingInCat = activeRoomItems.find((it: any) => matchCategory(selectedCategory, it.product))
        if (existingInCat && existingInCat.product_id !== customizingProduct.id) {
          try {
            await projectsAPI.removeRoomItem(projectId, activeRoomId, existingInCat.id)
          } catch (e) {
            console.error('Failed to remove previous item in category', e)
          }
        }

        await projectsAPI.addRoomItem(projectId, activeRoomId, itemsToSave[0])
        toast.success(`${customizingProduct.name} saved to ${getRoomLabelAndIcon(activeRoom.room_type, project?.bhk_type).label}!`)
      }

      const updatedProj = await loadProject()
      toast.success(`${customizingProduct.name} saved to ${getRoomLabelAndIcon(activeRoom.room_type, project?.bhk_type).label}!`)

      setCustomizingProduct(null)
      setUserEditingCategory(false)

      // Smooth scroll back to top of customizer selection container
      setTimeout(() => {
        document.getElementById('product-selection-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)

      if (updatedProj && activeRoom) {
        const mandatory = getRoomMandatoryCategories(activeRoom.room_type)
        const currentCatIdx = mandatory.findIndex((cat) => cat.id === selectedCategory)
        
        // Refresh active room completeness
        const refreshedActiveRoom = updatedProj.rooms?.find((r: any) => r.id === activeRoomId)
        const isRoomNowComplete = refreshedActiveRoom ? checkRoomCompleteness(refreshedActiveRoom).isComplete : false

        if (currentCatIdx !== -1 && currentCatIdx < mandatory.length - 1) {
          const nextCat = mandatory[currentCatIdx + 1]
          setSelectedCategory(nextCat.id)
        } else if (isRoomNowComplete) {
          // Room complete! Auto-progress to top incomplete room
          const incompleteRooms = (updatedProj.rooms || []).filter((r: any) => !checkRoomCompleteness(r).isComplete)
          if (incompleteRooms.length > 0) {
            const nextRoom = incompleteRooms[0]
            setActiveRoomId(nextRoom.id)
            const nextRoomMandatory = getRoomMandatoryCategories(nextRoom.room_type)
            const firstUncfg = nextRoomMandatory.find(
              (cat) => !(nextRoom.items || []).some((it: any) => matchCategory(cat.id, it.product))
            )
            setSelectedCategory(firstUncfg?.id || nextRoomMandatory[0]?.id || '')
          }
        }
      }
    } catch {
      toast.error('Failed to save product selection')
    } finally {
      setSavingItem(false)
    }
  }

  const handleSaveAll = async () => {
    const allIds = (complementaryData?.recommended_items || []).map((it: any) => it.id)
    setSelectedAddonIds(allIds)
    await handleSaveSelection(true, allIds)
  }

  const handleToggleMood = async (productId: string, mood: 'monochrome' | 'accent') => {
    setProductMood((prev) => ({ ...prev, [productId]: mood }))
    setLoadingInlinePreview(productId)
    try {
      const res = await recommendationsAPI.getComplementaryBundle(productId, projectId, activeRoomId || undefined, mood)
      setInlinePreviewData((prev) => ({ ...prev, [productId]: res.data }))
    } catch (e) {
      console.error('Failed to fetch complementary bundle with mood', e)
    } finally {
      setLoadingInlinePreview(null)
    }
  }

  const handleAddFullSetFromGrid = async (anchorProduct: any, pairings: any[]) => {
    if (!activeRoomId) return
    setSavingBundleId(anchorProduct.id)
    try {
      const bestColor = (project?.color_preferences?.length > 0 && anchorProduct.variants?.color?.length > 0)
        ? getBestColorMatch(anchorProduct.variants.color, project.color_preferences).color
        : anchorProduct.variants?.color?.[0] || ''

      const itemsToSave: any[] = [
        {
          product_id: anchorProduct.id,
          qty: 1,
          unit_price: anchorProduct.price,
          custom_attributes: {
            color: bestColor,
            ...(anchorProduct.variants?.wood_finish?.[0] ? { wood_finish: anchorProduct.variants.wood_finish[0] } : {}),
            ...(anchorProduct.variants?.fabric?.[0] ? { fabric: anchorProduct.variants.fabric[0] } : {}),
          },
        },
        ...pairings.map((it: any) => ({
          product_id: it.id,
          qty: 1,
          unit_price: it.price,
          custom_attributes: it.default_attributes || {},
        }))
      ]

      await projectsAPI.addRoomItemBundle(projectId, activeRoomId, itemsToSave)
      toast.success(`Added ${anchorProduct.name} + ${pairings.length} coordinated pieces to room!`)
      await loadProject()
    } catch (e) {
      console.error('Failed to add full set', e)
      toast.error('Failed to add full set')
    } finally {
      setSavingBundleId(null)
    }
  }

  // The uploaded plan is traced into rooms and drives the studio's 2D plan and
  // 3D model: upload → check the detected rooms → see the design.
  const handleFloorPlanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    const file = input.files?.[0]
    input.value = ''                      // picking the same file again still fires
    if (!file) return
    if (!/\.(jpe?g|png|webp)$/i.test(file.name)) {
      toast.error('Upload the plan as a JPG, PNG or WebP image (for a PDF, take a screenshot of the plan page).')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Floor plan must be 10 MB or smaller')
      return
    }
    setUploadingPlan(true)
    const toastId = toast.loading('Reading your floor plan…')
    try {
      const res = await planLayoutAPI.detect(projectId, file)
      setPlanInfo(res.data)
      const n = res.data.plan?.rooms.length || 0
      toast.success(n ? `Found ${n} spaces — check them against your plan` : 'Plan uploaded — mark the rooms on it', { id: toastId })
      router.push(`/plan-trace/${projectId}?next=${encodeURIComponent(`/visualize/${projectId}`)}`)
    } catch (err: any) {
      toast.error(apiErrorMessage(err, 'Could not upload the floor plan'), { id: toastId })
    } finally {
      setUploadingPlan(false)
    }
  }

  useEffect(() => {
    planLayoutAPI.get(projectId).then((r) => setPlanInfo(r.data)).catch(() => setPlanInfo(null))
  }, [projectId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#faf7f2] via-[#f5ede2] to-[#ece1d2] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#b85d3b] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-stone-600 font-bold text-sm">Loading workspace customizer...</p>
        </div>
      </div>
    )
  }

  const anyItemAdded = project?.rooms?.some((r: any) => r.items && r.items.length > 0)
  const allRoomsComplete = checkAllRoomsComplete()

  const initialBudget = project?.budget || 300000
  let totalCustomizedCost = 0
  project?.rooms?.forEach((room: any) => {
    (room.items || []).forEach((item: any) => {
      const price = item.unit_price || item.product?.price || 0
      const qty = item.qty || 1
      totalCustomizedCost += price * qty
    })
  })
  const remainingBudget = Math.max(0, initialBudget - totalCustomizedCost)


  const galleryImages = customizingProduct
    ? (customizingProduct.images?.length
        ? customizingProduct.images
        : (customizingProduct.variants?.images?.length
            ? customizingProduct.variants.images
            : (customizingProduct.thumbnail_url ? [customizingProduct.thumbnail_url] : [])))
    : []

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf7f2] via-[#f5ede2] to-[#ece1d2] text-stone-900 pb-20">
      <Navbar />

      {/* MAIN CONTAINER */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 space-y-6">
        
        {/* TOP ACTION BAR (Clean transparent layout with enlarged sub-boxes) */}
        <div className="flex flex-wrap items-center justify-between gap-4 w-full">
          {/* Minimal Back Arrow */}
          <button
            onClick={() => router.push(`/dashboard`)}
            className="p-3 bg-white hover:bg-stone-50 text-stone-800 border border-[#E8DFD1] rounded-2xl transition shadow-xs flex items-center justify-center hover:border-stone-400"
            title="Exit to Dashboard"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Centered Enlarged Budget & Variation Sub-Boxes */}
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="text-center px-6 py-2.5 sm:px-7 sm:py-3 bg-white rounded-2xl border-2 border-[#E8DFD1] shadow-sm">
              <span className="text-[10px] sm:text-xs font-bold text-stone-500 uppercase tracking-wider block">Remaining Budget</span>
              <span className="text-xl sm:text-2xl font-black text-stone-900 block leading-tight mt-0.5">
                ₹{remainingBudget.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="text-center px-6 py-2.5 sm:px-7 sm:py-3 bg-white rounded-2xl border-2 border-[#E8DFD1] shadow-sm">
              <span className="text-[10px] sm:text-xs font-bold text-stone-500 uppercase tracking-wider block">Variation (Spent)</span>
              <span className="text-xl sm:text-2xl font-black text-[#b85d3b] block leading-tight mt-0.5">
                ₹{totalCustomizedCost.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Proceed to AI Render */}
          <button
            onClick={() => router.push(`/visualize/${projectId}`)}
            className={clsx(
              'py-3 px-5 sm:px-6 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shadow-sm hover:shadow-md active:scale-[0.98]',
              anyItemAdded
                ? 'bg-[#b85d3b] hover:bg-[#a34f30] text-white shadow-[#b85d3b]/20'
                : 'bg-stone-200 text-stone-400 border border-stone-300 cursor-not-allowed'
            )}
            disabled={!anyItemAdded}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Proceed to AI Render</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* FULL-WIDTH ROOM HARMONIZATION BANNER (100% width across layout) */}
        {activeRoom && (() => {
          const activeRoomMandatoryCategories = getRoomMandatoryCategories(activeRoom.room_type)
          const completedMandatoryCategories = (activeRoomMandatoryCategories || []).filter((cat) =>
            activeRoomItems.some((it: any) => matchCategory(cat.id, it.product))
          )
          const roomHarmonizedPct = activeRoomMandatoryCategories.length > 0
            ? Math.round((completedMandatoryCategories.length / activeRoomMandatoryCategories.length) * 100)
            : 100

          return (
            <div className="w-full bg-gradient-to-r from-[#FAF6F0] via-[#F5EDE2] to-[#EFE4D6] border-2 border-[#E8DFD1] rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
              {/* Row 1: Percent + Room Name Harmonization + Category Pills */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3 shrink-0">
                  <div className={clsx(
                    "w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shadow-xs shrink-0 transition-colors",
                    roomHarmonizedPct === 100
                      ? "bg-emerald-600 text-white shadow-emerald-600/30"
                      : "bg-[#b85d3b] text-white shadow-[#b85d3b]/30"
                  )}>
                    {roomHarmonizedPct === 100 ? "✓" : `${roomHarmonizedPct}%`}
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-stone-900 whitespace-nowrap">
                    {getRoomLabelAndIcon(activeRoom.room_type, project?.bhk_type).label} Harmonization
                  </h3>
                </div>

                {/* Interactive Category Pills on the Right */}
                {activeRoomMandatoryCategories.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {activeRoomMandatoryCategories.map((cat) => {
                      const isConfigured = activeRoomItems.some((it: any) => matchCategory(cat.id, it.product))
                      const isCurrent = selectedCategory === cat.id
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(cat.id)
                            setUserEditingCategory(true)
                            setCustomizingProduct(null)
                          }}
                          className={clsx(
                            "text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 border",
                            isCurrent
                              ? "bg-[#b85d3b] text-white border-[#b85d3b] shadow-xs"
                              : isConfigured
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                              : "bg-white text-stone-700 border-stone-200 hover:border-stone-400"
                          )}
                        >
                          <span className={clsx(
                            "w-2 h-2 rounded-full",
                            isCurrent ? "bg-white" : isConfigured ? "bg-emerald-500" : "bg-stone-300"
                          )} />
                          <span>{cat.label}</span>
                          {isConfigured && !isCurrent && <span className="text-[10px] text-emerald-600 font-extrabold">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Row 2: Full-Width Progress Bar Just Below */}
              <div className="w-full bg-[#E8DFD1]/90 rounded-full h-2.5 overflow-hidden">
                <div
                  className={clsx(
                    "h-full transition-all duration-500 rounded-full",
                    roomHarmonizedPct === 100
                      ? "bg-gradient-to-r from-emerald-500 to-emerald-600"
                      : "bg-gradient-to-r from-[#b85d3b] via-[#c5a059] to-emerald-500"
                  )}
                  style={{ width: `${Math.max(roomHarmonizedPct, 5)}%` }}
                />
              </div>
            </div>
          )
        })()}

        {/* TWO-COLUMN ATELIER LAYOUT: LEFT ROOM SIDEBAR + RIGHT WORKSPACE */}
        <div className="grid lg:grid-cols-12 gap-6 items-start">

          {/* ── ELEVATED LEFT ROOM NAVIGATION SIDEBAR (3 cols) ── */}
          <div className="lg:col-span-3 space-y-3">
            <div className="bg-[#FAF6F0]/90 backdrop-blur-md border border-[#E8DFD1] rounded-3xl p-4 shadow-sm space-y-3 sticky top-24">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#E8DFD1]/70 px-1">
                <div className="flex items-center gap-1.5">
                  <Layout className="w-4 h-4 text-[#b85d3b]" />
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-700">
                    Room Spaces
                  </span>
                </div>
                <span className="text-[10px] font-bold text-[#b85d3b] bg-[#faeae3] px-2 py-0.5 rounded-full">
                  {getSortedRoomsList().filter((r: any) => checkRoomCompleteness(r).isComplete).length}/{getSortedRoomsList().length} Complete
                </span>
              </div>

              <div className="space-y-2">
                {getSortedRoomsList().map((room: any) => {
                  const check = checkRoomCompleteness(room)
                  const isActive = room.id === activeRoomId
                  const { label, icon } = getRoomLabelAndIcon(room.room_type, project?.bhk_type)
                  const mandatoryCats = getRoomMandatoryCategories(room.room_type)
                  const completedCount = getCompletedCategoriesCount(room)

                  return (
                    <button
                      key={room.id}
                      onClick={() => {
                        setActiveRoomId(room.id)
                        setCustomizingProduct(null)
                        setUserEditingCategory(false)
                      }}
                      className={clsx(
                        "w-full text-left p-3.5 rounded-2xl transition-all duration-200 flex items-center justify-between gap-3 group border",
                        isActive
                          ? "bg-white border-[#b85d3b] border-l-4 shadow-md ring-1 ring-[#b85d3b]/10"
                          : "bg-white/60 hover:bg-white border-[#E8DFD1] hover:border-[#b85d3b]/50 hover:shadow-xs"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={clsx(
                          "w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 transition-transform group-hover:scale-105",
                          isActive ? "bg-[#faeae3] text-[#b85d3b]" : "bg-stone-100 text-stone-600"
                        )}>
                          {icon}
                        </div>
                        <div className="min-w-0">
                          <div className={clsx(
                            "text-xs font-bold truncate transition-colors",
                            isActive ? "text-stone-900 font-extrabold" : "text-stone-700"
                          )}>
                            {label}
                          </div>
                          <div className="text-[10px] text-stone-400 font-medium">
                            {mandatoryCats.length} Essential Pieces
                          </div>
                        </div>
                      </div>

                      {/* Status indicator pill */}
                      <div className="shrink-0">
                        {check.isComplete ? (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5 shadow-2xs">
                            ✓ Done
                          </span>
                        ) : (
                          <span className={clsx(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-2xs",
                            isActive
                              ? "bg-[#faeae3] text-[#b85d3b] border-[#f4d1c3]"
                              : "bg-stone-100 text-stone-500 border-stone-200"
                          )}>
                            {completedCount}/{mandatoryCats.length}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── RIGHT WORKSPACE CONTAINER (9 cols) ── */}
          <div className="lg:col-span-9 space-y-6" id="product-selection-container">

          <AnimatePresence mode="wait">
            {allRoomsComplete && !userEditingCategory ? (
              <motion.div
                key="all-complete"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="bg-[#FAF6F0]/90 backdrop-blur-md border border-[#E8DFD1] rounded-3xl p-8 shadow-sm min-h-[400px] flex flex-col justify-between"
              >
                <div>
                  <div className="border-b border-[#E8DFD1] pb-4 mb-6">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Configuration Complete</span>
                    <h2 className="text-xl font-extrabold text-stone-900 mt-1">Ready for Visualization</h2>
                    <p className="text-stone-500 text-xs mt-0.5">All categories under all rooms have been successfully customized.</p>
                  </div>
                  
                  <div className="bg-white/80 p-6 rounded-2xl border border-[#E8DFD1] space-y-4 text-center my-6">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                      ✓
                    </div>
                    <div>
                      <p className="text-stone-900 text-sm font-extrabold">All design selections chosen!</p>
                      <p className="text-stone-500 text-xs mt-1">
                        Please proceed to the AI Render Studio to generate photorealistic 4-wall visual designs of your configured home.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <button
                    onClick={() => router.push(`/visualize/${projectId}`)}
                    className="py-3 px-8 bg-[#b85d3b] hover:bg-[#a34f30] text-white text-sm font-bold rounded-xl transition shadow-sm flex items-center gap-2 hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Proceed to AI Render</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ) : (
              // CHOOSE DESIGN / COLLECTION GRID
              <motion.div
                key="catalog"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="bg-[#FAF6F0]/90 backdrop-blur-md border border-[#E8DFD1] rounded-3xl p-6 shadow-sm min-h-[400px] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-[#E8DFD1] pb-3 mb-5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-stone-900 capitalize">
                        {getRoomMandatoryCategories(activeRoom?.room_type || '').find(c => c.id === selectedCategory)?.label || selectedCategory.replace(/_/g, ' ')} Collection
                      </h3>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 bg-white text-stone-600 rounded-full border border-[#E8DFD1]">
                        {(Array.isArray(products) ? products : []).length} available
                      </span>
                    </div>
                  </div>

                  {loadingProducts ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 py-8">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-32 rounded-2xl bg-white/60 border border-[#E8DFD1] animate-pulse" />
                      ))}
                    </div>
                  ) : (Array.isArray(products) ? products : []).length === 0 ? (
                    <div className="text-center py-20 text-stone-500 text-xs">
                      No products catalogued for this room style category yet.
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {(Array.isArray(products) ? products : []).map((p) => {
                        const isChosen = activeRoomItems.some((it: any) => it.product_id === p.id)
                        const isOutOfStock = p.is_available === false || p.is_in_stock === false || (p.available_qty !== undefined && p.available_qty <= 0)
                        const isLowStock = !isOutOfStock && p.available_qty !== undefined && p.available_qty > 0 && p.available_qty < 5
                        const isExpanded = inlinePreviewProductId === p.id
                        const inlinePairings = inlinePreviewData[p.id]?.recommended_items?.slice(0, 3) || []

                        return (
                          <div key={p.id} className="flex flex-col">
                            {/* Product Card */}
                            <div
                              onClick={() => {
                                if (isOutOfStock) {
                                  toast.error(`"${p.name}" is currently out of stock.`)
                                  return
                                }
                                handleSelectProduct(p)
                              }}
                              className={clsx(
                                'p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 group',
                                isChosen
                                  ? 'bg-white border-[#b85d3b] shadow-md ring-2 ring-[#b85d3b]/20'
                                  : isOutOfStock
                                  ? 'bg-stone-100/70 border-stone-200 opacity-70 cursor-not-allowed'
                                  : 'bg-white/80 hover:bg-white border-[#E8DFD1] hover:border-[#b85d3b] hover:shadow-md'
                              )}
                            >
                              <div className="flex items-center justify-between gap-3 w-full">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="relative shrink-0">
                                    <ProductImage
                                      src={p.thumbnail_url}
                                      fallbacks={p.images}
                                      alt={p.name}
                                      className={clsx(
                                        "w-14 h-14 object-cover rounded-xl border border-[#E8DFD1]",
                                        isOutOfStock && "grayscale opacity-50"
                                      )}
                                    />
                                    {isOutOfStock && (
                                      <span className="absolute inset-x-0 bottom-0 bg-rose-600/90 text-white text-[7px] font-black text-center py-0.5 rounded-b-xl uppercase tracking-wider">
                                        Out of Stock
                                      </span>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className={clsx(
                                      "text-xs font-extrabold truncate transition-colors",
                                      isOutOfStock ? "text-stone-400" : "text-stone-900 group-hover:text-[#b85d3b]"
                                    )}>
                                      {p.name}
                                    </h4>
                                    <div className={clsx(
                                      "text-xs font-black mt-0.5 flex flex-wrap items-center gap-1.5",
                                      isOutOfStock ? "text-stone-400" : "text-[#b85d3b]"
                                    )}>
                                      <span>₹{p.price.toLocaleString('en-IN')}</span>
                                      {isOutOfStock && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.2 text-rose-600 bg-rose-50 border border-rose-200 rounded-md">
                                          {p.unavailable_reason || 'Out of Stock'}
                                        </span>
                                      )}
                                      {isLowStock && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.2 text-amber-700 bg-amber-50 border border-amber-200 rounded-md">
                                          Only {p.available_qty} left!
                                        </span>
                                      )}
                                    </div>
                                    <span className={clsx(
                                      'inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border',
                                      p.availability_tier === 'local'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : p.availability_tier === 'nearby'
                                        ? 'bg-[#faeae3] text-[#b85d3b] border-[#f3d2c4]'
                                        : 'bg-stone-100 text-stone-600 border-[#E8DFD1]'
                                    )}>
                                      {p.availability_tier === 'local' ? '📍 Your Area' : p.availability_tier === 'nearby' ? '🏙️ Nearby' : '🌐 National'}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                  {/* Customize button — opens detail panel */}
                                  <button
                                    disabled={isOutOfStock}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (isOutOfStock) {
                                        toast.error(`"${p.name}" is currently out of stock.`)
                                        return
                                      }
                                      handleSelectProduct(p)
                                    }}
                                    className={clsx(
                                      'py-1.5 px-3 text-[10px] font-bold rounded-xl transition shrink-0',
                                      isChosen
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : isOutOfStock
                                        ? 'bg-stone-100 border border-stone-200 text-stone-400 cursor-not-allowed'
                                        : 'bg-white border border-[#b85d3b] text-[#b85d3b] hover:bg-[#b85d3b] hover:text-white'
                                    )}
                                  >
                                    {isChosen ? 'Configured ✓' : isOutOfStock ? 'Out of Stock' : 'Choose'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="text-stone-500 text-[10px] mt-6 flex items-center gap-1.5 bg-[#FAF6F0] p-3.5 rounded-2xl border border-[#E8DFD1]">
                  <Info className="w-4 h-4 text-[#c5a059]" />
                  <span>Choose any design structure to expose variant and custom styling options.</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>

      {/* PRODUCT CUSTOMIZATION OVER-CONTAINER MODAL */}
      <AnimatePresence>
        {customizingProduct && (
          <div
            className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 lg:p-10 overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setCustomizingProduct(null)
              }
            }}
          >
            <motion.div
              key="customizer-modal"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-[#FAF6F0] border-2 border-[#E8DFD1] rounded-3xl max-w-5xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8 shadow-2xl relative space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header: Title and Price at the Top */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E8DFD1] pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <button
                      type="button"
                      onClick={() => setCustomizingProduct(null)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#b85d3b] hover:text-[#a34f30] transition bg-white px-2.5 py-1 rounded-lg border border-[#E8DFD1]"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Back to Collection</span>
                    </button>
                    <span className="text-stone-300">/</span>
                    <span className="text-xs font-bold text-stone-500 capitalize">{customizingProduct.category?.replace(/_/g, ' ')}</span>
                  </div>
                  <h2 className="text-2xl font-black text-stone-900 tracking-tight">{customizingProduct.name}</h2>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-left sm:text-right shrink-0">
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Base Price</span>
                    <span className="text-2xl font-black text-[#b85d3b]">
                      ₹{customizingProduct.price.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomizingProduct(null)}
                    className="w-9 h-9 rounded-full bg-stone-200/60 hover:bg-stone-300 text-stone-600 flex items-center justify-center transition"
                    title="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

                {/* Studio Grid: Image & Variants on Left/Center, Specifications on Right */}
                <div className="grid md:grid-cols-12 gap-6 items-start">
                  
                  {/* Left Column (7 cols): Hero Image Studio + Variant Swatches directly below */}
                  <div className="md:col-span-7 space-y-5">
                    {/* Hero Image Studio with 3s auto-rotate carousel and pause on hover */}
                    <div
                      className="bg-white/80 border border-[#E8DFD1] p-4 rounded-3xl shadow-sm flex flex-col items-center"
                      onMouseEnter={() => setIsHoveringImage(true)}
                      onMouseLeave={() => setIsHoveringImage(false)}
                    >
                      <div className="relative w-full aspect-square sm:aspect-[4/3] rounded-2xl overflow-hidden bg-[#FAF6F0] border border-[#E8DFD1] flex items-center justify-center group">
                        {galleryImages.length > 0 ? (
                          galleryImages.map((imgUrl: string, idx: number) => {
                            const isActive = idx === activeImageIdx
                            return (
                              <div
                                key={imgUrl}
                                className={clsx(
                                  "absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out",
                                  isActive ? "opacity-100 z-10 pointer-events-auto" : "opacity-0 z-0 pointer-events-none"
                                )}
                              >
                                <ProductImage
                                  src={imgUrl}
                                  fallbacks={[customizingProduct.thumbnail_url]}
                                  alt={`${customizingProduct.name} - perspective ${idx + 1}`}
                                  eager
                                  iconClassName="w-12 h-12"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )
                          })
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center select-none">
                            <ImageIcon className="w-10 h-10 text-stone-400 mb-2" />
                            <h5 className="text-xs font-bold text-stone-500 uppercase tracking-wider">Primary Perspective View</h5>
                          </div>
                        )}

                        {galleryImages.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={() => setActiveImageIdx((prev) => (prev === 0 ? Math.max(0, galleryImages.length - 1) : prev - 1))}
                              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-stone-800 flex items-center justify-center opacity-80 hover:opacity-100 transition shadow-md border border-[#E8DFD1] z-20"
                              aria-label="Previous view"
                            >
                              <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveImageIdx((prev) => (prev >= galleryImages.length - 1 ? 0 : prev + 1))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-stone-800 flex items-center justify-center opacity-80 hover:opacity-100 transition shadow-md border border-[#E8DFD1] z-20"
                              aria-label="Next view"
                            >
                              <ChevronRight className="w-5 h-5" />
                            </button>
                          </>
                        )}
                      </div>

                      <p className="text-[10px] text-stone-400 mt-2 text-center">
                        Hover to pause perspective rotation. Front, side and top perspectives supported.
                      </p>

                      {/* Color Variants Shelf - Clickable Image Placeholders below Main Image */}
                      {colorVariants.length > 0 && (
                        <div className="w-full mt-4 pt-3.5 border-t border-[#E8DFD1]">
                          <div className="flex items-center justify-between mb-2.5 px-0.5">
                            <span className="text-[11px] font-extrabold text-stone-800 uppercase tracking-wider">
                              Color Finishes ({colorVariants.length})
                            </span>
                            <span className="text-[10px] text-stone-400 font-medium">Click variant to swap 3D perspectives</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2.5">
                            {colorVariants.map((variant: any) => {
                              const isSelected = variant.isSelected
                              const hex = getColorHex(variant.colorName)
                              return (
                                <button
                                  key={variant.product.id || variant.colorName}
                                  type="button"
                                  onClick={() => {
                                    setCustomizingProduct(variant.product)
                                    setActiveImageIdx(0)
                                    setAttr('color', variant.colorName)
                                  }}
                                  className={clsx(
                                    "group/v flex flex-col items-center p-2 rounded-2xl border text-center transition-all cursor-pointer relative",
                                    isSelected
                                      ? "bg-[#FAF6F0] border-[#b85d3b] ring-2 ring-[#b85d3b]/25 shadow-xs"
                                      : "bg-white border-[#E8DFD1] hover:border-stone-400 hover:shadow-2xs opacity-85 hover:opacity-100"
                                  )}
                                >
                                  <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-[#FAF6F0] border border-[#E8DFD1] mb-1.5">
                                    <ProductImage
                                      src={variant.thumbnail}
                                      alt={variant.colorName}
                                      className="w-full h-full object-cover group-hover/v:scale-105 transition duration-300"
                                    />
                                    {isSelected && (
                                      <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#b85d3b] text-white flex items-center justify-center shadow-xs">
                                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 max-w-full">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full border border-black/15 shrink-0 shadow-2xs"
                                      style={{ backgroundColor: hex }}
                                    />
                                    <span className={clsx(
                                      "text-[11px] font-bold truncate leading-tight",
                                      isSelected ? "text-[#b85d3b]" : "text-stone-800"
                                    )}>
                                      {variant.colorName}
                                    </span>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Right Column (5 cols): Specifications ("About this Product") */}
                  <div className="md:col-span-5 bg-white/80 border border-[#E8DFD1] p-6 rounded-3xl shadow-sm space-y-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 border-b border-[#E8DFD1] pb-3 mb-4">
                        <Info className="w-4 h-4 text-[#b85d3b]" />
                        <h3 className="text-xs font-extrabold text-stone-900 uppercase tracking-wider">
                          About this Product
                        </h3>
                      </div>

                      {(() => {
                        const productColors = Array.isArray(customizingProduct.variants?.color)
                          ? customizingProduct.variants.color
                          : (customizingProduct.variants?.color ? [customizingProduct.variants.color] : [])
                        
                        const catNorm = (customizingProduct.category || customizingProduct.subCategory || '').toLowerCase()
                        const isUpholsteredOrSoft = catNorm.includes('sofa') || catNorm.includes('chair') || catNorm.includes('bed') || catNorm.includes('rug') || catNorm.includes('stool') || catNorm.includes('lighting') || catNorm.includes('lamp') || catNorm.includes('cushion') || catNorm.includes('fabric') || catNorm.includes('curtain')
                        
                        const hasColor = productColors.length > 0 && isUpholsteredOrSoft
                        const defaultColor = hasColor ? (
                          (project?.color_preferences?.length > 0)
                            ? getBestColorMatch(productColors, project.color_preferences).color
                            : productColors[0]
                        ) : ''
                        const displayColor = customAttrs.color || defaultColor
                        const displayHex = displayColor ? getColorHex(displayColor) : '#e5e5e5'

                        return (
                          <div className="space-y-2 text-xs">
                            {hasColor && displayColor && (
                              <div className="flex items-center justify-between py-1.5">
                                <span className="text-stone-500 font-medium">Color</span>
                                <span className="text-stone-900 font-bold flex items-center gap-1.5">
                                  <span className="w-3.5 h-3.5 rounded-full border border-black/15 shadow-2xs inline-block shrink-0" style={{ backgroundColor: displayHex }} />
                                  <span>{displayColor}</span>
                                </span>
                              </div>
                            )}
                            <div className="flex items-center justify-between py-1.5">
                              <span className="text-stone-500 font-medium">Material</span>
                              <span className="text-stone-900 font-bold">{customizingProduct.primary_material || customizingProduct.primaryMaterial || 'Solid Wood'}</span>
                            </div>
                            <div className="flex items-center justify-between py-1.5">
                              <span className="text-stone-500 font-medium">Dimensions</span>
                              <span className="text-stone-900 font-bold">
                                {customizingProduct.width || 1200}w × {customizingProduct.height || 750}h × {customizingProduct.depth || 600}d mm
                              </span>
                            </div>
                            <div className="flex items-center justify-between py-1.5">
                              <span className="text-stone-500 font-medium">Weight</span>
                              <span className="text-stone-900 font-bold">{customizingProduct.weight || 15} kg</span>
                            </div>
                            <div className="flex items-center justify-between py-1.5">
                              <span className="text-stone-500 font-medium">Weight Capacity</span>
                              <span className="text-stone-900 font-bold">{customizingProduct.weight_capacity || customizingProduct.weightCapacity || 120} kg</span>
                            </div>
                            <div className="flex items-center justify-between py-1.5">
                              <span className="text-stone-500 font-medium">Style</span>
                              <span className="text-stone-900 font-bold">{customizingProduct.style || 'Modern'}</span>
                            </div>
                            <div className="flex items-center justify-between py-1.5">
                              <span className="text-stone-500 font-medium">Finish</span>
                              <span className="text-stone-900 font-bold">{customizingProduct.finish || 'Matte'}</span>
                            </div>
                            <div className="flex items-center justify-between py-1.5">
                              <span className="text-stone-500 font-medium">Mounting</span>
                              <span className="text-stone-900 font-bold">{customizingProduct.mounting_type || customizingProduct.mountingType || 'Floor Standing'}</span>
                            </div>
                            <div className="flex items-center justify-between py-1.5">
                              <span className="text-stone-500 font-medium">Assembly</span>
                              <span className="text-stone-900 font-bold">{customizingProduct.assembly_required || customizingProduct.assemblyRequired || 'Professional Installation Included'}</span>
                            </div>
                          </div>
                        )
                      })()}
                    </div>

                    {/* Direct Save Action in Right Panel */}
                    <div className="pt-4 border-t border-[#E8DFD1] space-y-2">
                      <button
                        type="button"
                        onClick={() => handleSaveSelection(false)}
                        disabled={savingItem}
                        className="w-full py-3.5 px-4 bg-[#b85d3b] hover:bg-[#a34f30] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition"
                      >
                        {savingItem && selectedAddonIds.length === 0 ? (
                          <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-amber-200" />
                            <span>Save {customizingProduct.name} (₹{customizingProduct.price.toLocaleString('en-IN')})</span>
                          </>
                        )}
                      </button>
                      <p className="text-[10px] text-stone-500 text-center">
                        Selected specifications are linked to your 2D plan and photorealistic render.
                      </p>
                    </div>
                  </div>

                </div>

                {/* ROW 2: FULL-WIDTH COMPLETE THE ROOM — AI CURATED PAIRINGS */}
                {(() => {
                  const allRecommended = complementaryData?.recommended_items || []
                  const totalRecommendedCount = allRecommended.length
                  const allAddonsCost = allRecommended.reduce((acc: number, it: any) => acc + (it.price || 0), 0)
                  const allBundlePrice = (customizingProduct?.price || 0) + allAddonsCost

                  const selectedAddonsList = allRecommended.filter((it: any) =>
                    selectedAddonIds.includes(it.id)
                  )
                  const selectedCount = selectedAddonsList.length
                  const selectedAddonsCost = selectedAddonsList.reduce((acc: number, it: any) => acc + (it.price || 0), 0)
                  const currentBundlePrice = (customizingProduct?.price || 0) + selectedAddonsCost

                  const isAllSelected = totalRecommendedCount > 0 && selectedCount === totalRecommendedCount
                  const isSomeSelected = selectedCount > 0 && selectedCount < totalRecommendedCount
                  const isNoneSelected = selectedCount === 0

                  return (
                    <div className="mt-6 space-y-4">
                      {loadingComplementary ? (
                        <div className="p-6 rounded-3xl bg-[#FAF6F0] border border-[#E8DFD1] animate-pulse space-y-3">
                          <div className="h-4 bg-stone-200 rounded w-1/4" />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="h-20 bg-stone-200 rounded-2xl" />
                            <div className="h-20 bg-stone-200 rounded-2xl" />
                          </div>
                        </div>
                      ) : complementaryData?.recommended_items && complementaryData.recommended_items.length > 0 ? (
                        <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#FAF6F0] to-[#F5EDE2] border border-[#E8DFD1] shadow-sm space-y-5">
                          {/* Panel Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E8DFD1] pb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-[#b85d3b]" />
                                <h4 className="text-sm font-extrabold text-stone-900">
                                  Complete the Room — AI Curated Pairings
                                </h4>
                              </div>
                              <p className="text-[11px] text-stone-500 mt-0.5">
                                Harmonized with your{' '}
                                <strong className="text-[#b85d3b]">{project?.interior_material_preference || 'wood'}</strong> &{' '}
                                <strong className="text-[#b85d3b]">{project?.style_vibe || 'Modern'}</strong> design. Capped within budget.
                              </p>
                            </div>
                          </div>

                          {/* 2 Cards Per Row Responsive Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {complementaryData.recommended_items.map((item: any) => {
                              const isSelected = selectedAddonIds.includes(item.id)
                              return (
                                <div
                                  key={item.id}
                                  onClick={() => {
                                    setSelectedAddonIds((prev) =>
                                      prev.includes(item.id)
                                        ? prev.filter((id) => id !== item.id)
                                        : [...prev, item.id]
                                    )
                                  }}
                                  className={clsx(
                                    'p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3',
                                    isSelected
                                      ? 'bg-white border-[#b85d3b] shadow-xs ring-1 ring-[#b85d3b]/20'
                                      : 'bg-white/80 border-[#E8DFD1] hover:border-stone-400 opacity-90 hover:opacity-100'
                                  )}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    {/* Custom Checkbox */}
                                    <div
                                      className={clsx(
                                        'w-5 h-5 rounded-lg flex items-center justify-center border transition-all shrink-0',
                                        isSelected
                                          ? 'bg-[#b85d3b] border-[#b85d3b] text-white'
                                          : 'border-stone-300 bg-white'
                                      )}
                                    >
                                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                    </div>

                                    {/* Product Thumbnail */}
                                    <img
                                      src={item.thumbnail_url}
                                      alt={item.name}
                                      className="w-12 h-12 rounded-xl object-cover border border-[#E8DFD1] shrink-0 bg-stone-50"
                                    />

                                    {/* Product Info */}
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-extrabold text-[#b85d3b] uppercase tracking-wide">
                                          {item.category_label}
                                        </span>
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#faeae3] text-[#b85d3b] border border-[#f3d2c4]">
                                          ✨ {item.match_pct}% Match
                                        </span>
                                      </div>
                                      <h5 className="text-xs font-bold text-stone-900 truncate mt-0.5">
                                        {item.name}
                                      </h5>

                                      {/* Explainability Tags */}
                                      <div className="flex flex-wrap gap-1.5 mt-1">
                                        {(item.reasons || []).map((reason: string, idx: number) => (
                                          <span
                                            key={idx}
                                            className="text-[9px] font-semibold text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded"
                                          >
                                            • {reason}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Price & Cap Details */}
                                  <div className="text-right shrink-0">
                                    <div className="text-xs font-extrabold text-stone-900">
                                      +₹{item.price.toLocaleString('en-IN')}
                                    </div>
                                    <div className="text-[9px] text-stone-500 font-semibold mt-0.5">
                                      Cap: ₹{item.category_cap.toLocaleString('en-IN')}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          {/* Dynamic Bundle Summary Box */}
                          <div className="p-4 bg-white rounded-2xl border border-[#E8DFD1] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="text-xs font-bold text-stone-900">
                              Bundle Total:{' '}
                              <span className="text-sm font-extrabold text-[#b85d3b]">
                                ₹{(isNoneSelected ? allBundlePrice : currentBundlePrice).toLocaleString('en-IN')}
                              </span>{' '}
                              <span className="text-[11px] text-stone-500 font-semibold">
                                ({customizingProduct.name} + {isNoneSelected ? totalRecommendedCount : selectedCount} add-ons{isNoneSelected ? ' if all selected' : ''})
                              </span>
                            </div>
                            <p className="text-[10px] text-stone-500 font-medium">
                              {isNoneSelected
                                ? `Tap items to customize bundle, or "Save All" to take complete set`
                                : `${selectedCount} of ${totalRecommendedCount} coordinated pieces selected`}
                            </p>
                          </div>

                          {/* Action Buttons: Dynamic States based on Selection */}
                          <div className="flex flex-col sm:flex-row items-stretch gap-3 pt-1">
                            {/* Primary Button */}
                            <button
                              type="button"
                              onClick={() => {
                                if (isNoneSelected) {
                                  handleSaveAll()
                                } else {
                                  handleSaveSelection(true)
                                }
                              }}
                              disabled={savingItem}
                              className="flex-1 py-3.5 px-4 bg-[#b85d3b] hover:bg-[#a34f30] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-sm"
                            >
                              {savingItem ? (
                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                                  <span className="text-left leading-tight">
                                    {isAllSelected || isNoneSelected
                                      ? `Save All & Continue (₹${allBundlePrice.toLocaleString('en-IN')})`
                                      : `Save & Continue with ${selectedCount} Selected Components (₹${currentBundlePrice.toLocaleString('en-IN')})`}
                                  </span>
                                </>
                              )}
                            </button>

                            {/* Secondary Button */}
                            <button
                              type="button"
                              onClick={() => handleSaveSelection(false)}
                              disabled={savingItem}
                              className="py-3.5 px-5 font-bold rounded-xl flex items-center justify-center gap-2 transition text-xs shrink-0 bg-white hover:bg-stone-50 text-stone-800 border border-[#E8DFD1]"
                            >
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                              <span className="text-left leading-tight">
                                Save {customizingProduct.name} Only (₹{customizingProduct.price.toLocaleString('en-IN')})
                              </span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Standalone Save button if no companion items */
                        <div className="flex justify-end pt-2">
                          <button
                            type="button"
                            onClick={() => handleSaveSelection(false)}
                            disabled={savingItem}
                            className="py-3 px-6 bg-[#b85d3b] hover:bg-[#a34f30] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition"
                          >
                            {savingItem ? (
                              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                              <>
                                <CheckCircle2 className="w-4 h-4 text-amber-200" />
                                <span>Save {customizingProduct.name} (₹{customizingProduct.price.toLocaleString('en-IN')})</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })()}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    {/* Floor Plan Blueprint Modal */}
      {showFloorPlanModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF6F0] border border-[#E8DFD1] rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8DFD1]">
              <div className="flex items-center gap-2">
                <Layout className="w-5 h-5 text-[#b85d3b]" />
                <h3 className="text-base font-extrabold text-stone-900">Home Floor Plan Blueprint</h3>
              </div>
              <button
                onClick={() => setShowFloorPlanModal(false)}
                className="w-8 h-8 rounded-full bg-stone-200/60 hover:bg-stone-300 text-stone-600 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {planInfo?.plan ? (
              <div className="space-y-3 bg-white/70 p-4 rounded-2xl border border-[#E8DFD1]">
                <div className={clsx('flex items-center gap-2 text-xs font-semibold',
                  planInfo.active ? 'text-emerald-700' : 'text-amber-700')}>
                  {planInfo.active ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />}
                  <span>
                    {planInfo.active
                      ? `Your plan drives the 2D & 3D design${planInfo.plan_bhk ? ` · ${planInfo.plan_bhk}` : ''}`
                      : planInfo.plan.status === 'inactive'
                        ? 'Standard layout in use — your plan is saved'
                        : 'Rooms not confirmed yet'}
                  </span>
                </div>
                <div className="aspect-[4/3] rounded-xl overflow-hidden border border-[#E8DFD1] bg-white">
                  <img src={planInfo.plan.image_url} alt="Your floor plan" className="w-full h-full object-contain" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(`/plan-trace/${projectId}?next=${encodeURIComponent(`/visualize/${projectId}`)}`)}
                    className="py-2.5 rounded-xl text-xs font-bold border border-[#E8DFD1] bg-white hover:bg-[#F3ECE1] text-stone-800 transition"
                  >
                    {planInfo.active ? 'Adjust rooms' : 'Check rooms'}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/visualize/${projectId}`)}
                    className="py-2.5 rounded-xl text-xs font-bold bg-[#b85d3b] hover:bg-[#a34f30] text-white transition"
                  >
                    View 2D & 3D
                  </button>
                </div>
              </div>
            ) : activeRoom?.custom_config?.floor_plan_url ? (
              <div className="space-y-3 bg-white/70 p-4 rounded-2xl border border-[#E8DFD1]">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                  <span>Custom Blueprint Active</span>
                </div>
                <div className="aspect-[4/3] rounded-xl overflow-hidden border border-[#E8DFD1] bg-white relative">
                  <img
                    src={activeRoom.custom_config.floor_plan_url}
                    alt="Floor Plan"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-2.5">
                    <a
                      href={activeRoom.custom_config.floor_plan_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-bold text-white bg-black/70 hover:bg-black px-2.5 py-1 rounded-lg border border-white/20 truncate"
                    >
                      View Full Size ↗
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-white/70 rounded-2xl border border-dashed border-[#E8DFD1] text-center">
                <FileText className="w-10 h-10 text-stone-400 mx-auto mb-2" />
                <div className="text-sm font-bold text-stone-900">Standard Architectural Layout Active</div>
                <p className="text-xs text-stone-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  Upload your custom floor plan blueprint to drive personalized 2D and 3D architectural rendering.
                </p>
              </div>
            )}

            <input
              ref={planInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFloorPlanUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => planInputRef.current?.click()}
              disabled={uploadingPlan}
              className={clsx(
                "w-full py-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border shadow-sm",
                uploadingPlan
                  ? "bg-stone-100 text-stone-400 border-[#E8DFD1] cursor-not-allowed"
                  : "bg-[#b85d3b] hover:bg-[#a34f30] text-white border-[#b85d3b]"
              )}
            >
              {uploadingPlan ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Reading your blueprint…</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>{planInfo?.plan ? 'Upload a Different Plan' : 'Upload Floor Plan Blueprint'}</span>
                </>
              )}
            </button>
            <p className="text-[10px] text-stone-500 text-center">
              JPG, PNG or WebP up to 10 MB. For a PDF, upload a screenshot of the plan page.
            </p>
          </div>
        </div>
      )}

    </div>
  )
}