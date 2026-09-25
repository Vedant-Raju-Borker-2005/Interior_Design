'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { projectsAPI, catalogAPI, recommendationsAPI, planLayoutAPI, apiErrorMessage, type PlanLayoutPayload } from '@/lib/api'
import Navbar from '@/components/Navbar'
import ProductImage from '@/components/ProductImage'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight, ArrowRight, CheckCircle2, ShoppingBag,
  Info, Sparkles, AlertCircle, Settings, Sliders, ChevronDown,
  ChevronLeft, Image as ImageIcon, Upload, Layout, FileText, Check, ShieldCheck
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

  useEffect(() => {
    setActiveImageIdx(0)
  }, [customizingProduct?.id])
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
        const initialSelected = (res.data?.recommended_items || [])
          .filter((it: any) => it.pre_selected)
          .map((it: any) => it.id)
        setSelectedAddonIds(initialSelected)
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

  const activeRoom = project?.rooms?.find((r: any) => r.id === activeRoomId) || project?.rooms?.[0]
  const activeRoomIdx = project?.rooms?.findIndex((r: any) => r.id === activeRoom?.id) ?? 0
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
    if (!project?.rooms || project.rooms.length === 0) return false
    return project.rooms.every((r: any) => checkRoomCompleteness(r).isComplete)
  }

  const getSortedRoomsList = () => {
    if (!project?.rooms) return []
    return [...project.rooms].sort((a: any, b: any) => {
      const aComp = checkRoomCompleteness(a).isComplete
      const bComp = checkRoomCompleteness(b).isComplete
      if (aComp === bComp) return 0
      return aComp ? 1 : -1
    })
  }

  useEffect(() => {
    if (project?.rooms?.length > 0 && !hasSetInitialRoom) {
      const firstIncomplete = project.rooms.find((r: any) => !checkRoomCompleteness(r).isComplete)
      if (firstIncomplete) {
        setActiveRoomId(firstIncomplete.id)
      } else {
        setActiveRoomId(project.rooms[0].id)
      }
      setHasSetInitialRoom(true)
    }
  }, [project, hasSetInitialRoom])

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
          project_id: projectId
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

  const handleSaveSelection = async (includeAddons: boolean = false) => {
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
        const selectedAddons = complementaryData.recommended_items.filter((it: any) =>
          selectedAddonIds.includes(it.id)
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
      <div className="min-h-screen bg-[#F7F8FF] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#4F46E5] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[#64748B] font-bold text-sm">Loading workspace customizer...</p>
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
    ? (customizingProduct.images || customizingProduct.variants?.images || [])
    : []

  return (
    <div className="min-h-screen bg-[#F7F8FF] text-[#172554] pb-20">
      <Navbar />

      {/* MAIN CONTAINER */}
      <div className="max-w-7xl mx-auto px-6 pt-24 space-y-6">
        
        {/* TOP BUTTONS BAR */}
        <div className="flex items-center justify-between w-full">
          <button
            onClick={() => router.push(`/dashboard`)}
            className="py-2.5 px-5 bg-white text-[#172554] border border-[#E5E7F2] hover:bg-slate-50 text-xs font-bold rounded-xl transition shadow-sm"
          >
            ← Exit to Dashboard
          </button>
          <button
            onClick={() => router.push(`/visualize/${projectId}`)}
            className={clsx(
              'py-2.5 px-6 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm hover:shadow-md active:scale-[0.98]',
              anyItemAdded
                ? 'bg-[#4F46E5] hover:bg-[#4338CA] text-white'
                : 'bg-slate-100 text-slate-400 border border-[#E5E7F2] cursor-not-allowed'
            )}
            disabled={!anyItemAdded}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Proceed to AI Render</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* WORKSPACE GRID */}
        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* LEFT PANEL: ROOM PROGRESS AND CATEGORIES (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            
            {/* Project Details Box */}
            <div className="bg-white border border-[#E5E7F2] rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <span className="font-extrabold text-[#172554] text-sm truncate">
                {project?.property_name}
              </span>
              <span className="bg-[#F5F3FF] border border-[#6366F1]/30 text-[#4F46E5] text-[10px] px-2.5 py-0.5 rounded-full font-extrabold uppercase">
                {project?.bhk_type}
              </span>
            </div>
          
          {/* Main Configuration Container */}
          <div className="bg-white border border-[#E5E7F2] rounded-3xl p-5 shadow-sm space-y-5">
            
            {/* Sidebar Tabs */}
            <div className="flex gap-2 p-1 bg-[#F7F8FF] rounded-2xl border border-[#E5E7F2]">
              <button
                type="button"
                onClick={() => setActiveSidebarTab('customizer')}
                className={clsx(
                  'flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                  activeSidebarTab === 'customizer'
                    ? 'bg-white text-[#4F46E5] border border-[#E5E7F2] shadow-sm'
                    : 'text-[#64748B] hover:text-[#172554]'
                )}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Customizer</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSidebarTab('floorplan')}
                className={clsx(
                  'flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                  activeSidebarTab === 'floorplan'
                    ? 'bg-white text-[#4F46E5] border border-[#E5E7F2] shadow-sm'
                    : 'text-[#64748B] hover:text-[#172554]'
                )}
              >
                <Layout className="w-3.5 h-3.5" />
                <span>Floor Plan</span>
              </button>
            </div>

            {/* TAB CONTENT: CUSTOMIZER */}
            {activeSidebarTab === 'customizer' && (
              <div className="space-y-3">
                {getSortedRoomsList().map((room: any) => {
                  const check = checkRoomCompleteness(room)
                  const isActive = room.id === activeRoomId
                  
                  return (
                    <div
                      key={room.id}
                      className={clsx(
                        'rounded-2xl border transition-all duration-200 overflow-hidden',
                        isActive
                          ? 'bg-[#F5F3FF] border-[#6366F1] shadow-sm'
                          : 'bg-white border-[#E5E7F2] hover:border-slate-300'
                      )}
                    >
                      {/* Accordion Room Header Button */}
                      <button
                        onClick={() => {
                          if (isActive) {
                            setActiveRoomId(null)
                          } else {
                            setActiveRoomId(room.id)
                          }
                          setCustomizingProduct(null)
                        }}
                        className="w-full text-left p-4 flex items-center justify-between transition-colors hover:bg-slate-50/50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{getRoomLabelAndIcon(room.room_type, project?.bhk_type).icon}</span>
                          <div>
                            <span className="font-extrabold text-[#172554] text-sm block">
                              {getRoomLabelAndIcon(room.room_type, project?.bhk_type).label}
                            </span>
                            <span className="text-[10px] text-[#64748B] block font-medium mt-0.5">
                              {room.items?.length || 0} items configured
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {check.isComplete ? (
                            <span className="text-[10px] bg-emerald-50 text-[#10B981] border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
                              Complete ✓
                            </span>
                          ) : (
                            <span className="text-[10px] bg-[#FFF8E7] text-[#F59E0B] border border-[#FDE68A] px-2.5 py-0.5 rounded-full font-bold">
                              {getCompletedCategoriesCount(room)}/{getRoomMandatoryCategories(room.room_type).length} Done
                            </span>
                          )}
                          <ChevronDown
                            className={clsx(
                              'w-4 h-4 text-[#64748B] transition-transform duration-200',
                              isActive && 'rotate-180 text-[#4F46E5]'
                            )}
                          />
                        </div>
                      </button>

                      {/* Expanded Accordion Body */}
                      {isActive && (
                        <div className="border-t border-[#E5E7F2] p-4 bg-white space-y-2">
                          <div className="space-y-1.5">
                            {getRoomMandatoryCategories(room.room_type).map((cat) => {
                              const savedItemInCat = room.items?.find(
                                (it: any) => matchCategory(cat.id, it.product)
                              )
                              const isSelected = selectedCategory === cat.id

                              return (
                                <button
                                  key={cat.id}
                                  onClick={() => {
                                    setSelectedCategory(cat.id)
                                    setCustomizingProduct(null)
                                    setUserEditingCategory(true)
                                  }}
                                  className={clsx(
                                    'w-full p-3.5 rounded-xl border transition-all text-left flex items-start justify-between gap-3',
                                    isSelected
                                      ? 'bg-[#F5F3FF] border-[#6366F1] text-[#4F46E5] font-extrabold shadow-sm'
                                      : savedItemInCat
                                        ? 'bg-white border-emerald-200 text-[#172554]'
                                        : 'bg-white border-[#E5E7F2] text-[#64748B] hover:text-[#172554] hover:border-slate-300'
                                  )}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-extrabold flex items-center gap-1.5">
                                      <span className="truncate">{cat.label}</span>
                                      {savedItemInCat && <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0" />}
                                    </div>
                                    <p className="text-[10px] text-[#64748B] font-normal mt-0.5 truncate leading-relaxed">
                                      {cat.desc}
                                    </p>
                                    {savedItemInCat && (
                                      <div className="text-[10px] text-[#4F46E5] font-bold mt-1 truncate">
                                        Chosen: {savedItemInCat.product?.name}
                                      </div>
                                    )}
                                  </div>
                                  <ChevronRight className="w-3.5 h-3.5 text-[#64748B] mt-1 flex-shrink-0" />
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* TAB CONTENT: FLOOR PLAN */}
            {activeSidebarTab === 'floorplan' && activeRoom && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[#172554] pb-2 border-b border-[#E5E7F2]">
                  <Layout className="w-4 h-4 text-[#4F46E5]" />
                  <h3 className="font-extrabold text-xs tracking-wider uppercase text-[#64748B]">
                    Home Floor Plan
                  </h3>
                </div>

                {planInfo?.plan ? (
                  <div className="space-y-3 bg-[#F7F8FF] p-3.5 rounded-2xl border border-[#E5E7F2]">
                    <div className={clsx('flex items-center gap-2 text-xs font-semibold',
                      planInfo.active ? 'text-[#10B981]' : 'text-[#F59E0B]')}>
                      {planInfo.active ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                      <span>
                        {planInfo.active
                          ? `Your plan drives the 2D & 3D design${planInfo.plan_bhk ? ` · ${planInfo.plan_bhk}` : ''}`
                          : planInfo.plan.status === 'inactive'
                            ? 'Standard layout in use — your plan is saved'
                            : 'Rooms not confirmed yet'}
                      </span>
                    </div>
                    <div className="aspect-[4/3] rounded-xl overflow-hidden border border-[#E5E7F2] bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={planInfo.plan.image_url} alt="Your floor plan" className="w-full h-full object-contain" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button"
                        onClick={() => router.push(`/plan-trace/${projectId}?next=${encodeURIComponent(`/visualize/${projectId}`)}`)}
                        className="py-2 rounded-xl text-[11px] font-bold border border-[#E5E7F2] bg-white hover:bg-slate-50 text-[#172554]">
                        {planInfo.active ? 'Adjust rooms' : 'Check rooms'}
                      </button>
                      <button type="button" onClick={() => router.push(`/visualize/${projectId}`)}
                        className="py-2 rounded-xl text-[11px] font-bold bg-[#172554] hover:bg-[#0f1a3d] text-white">
                        View 2D & 3D
                      </button>
                    </div>
                  </div>
                ) : activeRoom.custom_config?.floor_plan_url ? (
                  <div className="space-y-3 bg-[#F7F8FF] p-3.5 rounded-2xl border border-[#E5E7F2]">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#10B981]">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      <span>Custom Blueprint Active</span>
                    </div>

                    <div className="aspect-[4/3] rounded-xl overflow-hidden border border-[#E5E7F2] bg-white relative">
                      <img
                        src={activeRoom.custom_config.floor_plan_url}
                        alt="Floor Plan"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent flex items-end p-2.5">
                        <a
                          href={activeRoom.custom_config.floor_plan_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-bold text-white bg-slate-900/80 hover:bg-slate-900 px-2 py-1 rounded border border-white/20 truncate max-w-full"
                        >
                          View Full Size ↗
                        </a>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 bg-[#F7F8FF] rounded-2xl border border-dashed border-[#E5E7F2] text-center">
                    <FileText className="w-8 h-8 text-[#64748B] mx-auto mb-2" />
                    <div className="text-xs font-bold text-[#172554]">Using Default Rooms Layout</div>
                    <p className="text-[10px] text-[#64748B] mt-1 max-w-[220px] mx-auto leading-normal">
                      Upload your plan and your 2D plan and 3D model will be built from its rooms.
                    </p>
                  </div>
                )}

                {/* A real button driving a hidden input: the whole button is clickable,
                    keyboard-accessible, and the busy state blocks double uploads. */}
                <input
                  ref={planInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFloorPlanUpload}
                  id="sidebar-floorplan-file"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => planInputRef.current?.click()}
                  className={clsx(
                    "w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border shadow-sm duration-200",
                    uploadingPlan
                      ? "bg-slate-100 text-[#64748B] border-[#E5E7F2] cursor-not-allowed"
                      : "bg-[#4F46E5] hover:bg-[#4338CA] text-white border-[#4F46E5]"
                  )}
                  disabled={uploadingPlan}
                >
                  {uploadingPlan ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-[#64748B] border-t-white rounded-full animate-spin" />
                      <span>Reading your plan…</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>{planInfo?.plan ? 'Upload a Different Plan' : 'Upload Your Floor Plan'}</span>
                    </>
                  )}
                </button>
                <p className="text-[10px] text-[#64748B] text-center leading-normal">
                  JPG, PNG or WebP up to 10 MB. For a PDF, upload a screenshot of the plan page.
                </p>
              </div>
            )}
          </div>

        </div>


        {/* RIGHT AREA: PRODUCT DESIGN SELECTION AND CUSTOMIZER (8 cols) */}
        <div className="lg:col-span-8 space-y-6" id="product-selection-container">
          
          {/* Budget & Variation Tracking Box */}
          <div className="bg-white border border-[#E5E7F2] rounded-3xl p-4 shadow-sm grid grid-cols-2 gap-4">
            <div className="bg-[#F7F8FF] border border-[#E5E7F2] rounded-2xl p-4 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Remaining Budget</span>
              <span className="text-xl font-black text-[#172554] mt-1 block">
                ₹{remainingBudget.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="bg-[#F7F8FF] border border-[#E5E7F2] rounded-2xl p-4 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Variation (Spent)</span>
              <span className="text-xl font-black text-[#4F46E5] mt-1 block">
                ₹{totalCustomizedCost.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Room Completeness & Harmonization Indicator */}
          {activeRoom && (() => {
            const activeRoomMandatoryCategories = getRoomMandatoryCategories(activeRoom.room_type)
            const completedMandatoryCategories = (activeRoomMandatoryCategories || []).filter((cat) =>
              activeRoomItems.some((it: any) => matchCategory(cat.id, it.product))
            )
            const isBalcony = activeRoom.room_type === 'balcony'
            const roomHarmonizedPct = isBalcony
              ? 100
              : activeRoomMandatoryCategories.length > 0
              ? Math.round((completedMandatoryCategories.length / activeRoomMandatoryCategories.length) * 100)
              : 100

            return (
              <div className="bg-gradient-to-r from-[#F8FAFC] via-[#EEF2FF] to-[#F0FDF4] border border-[#C7D2FE] rounded-3xl p-5 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={clsx(
                      "w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shadow-xs shrink-0 transition-colors",
                      roomHarmonizedPct === 100
                        ? "bg-emerald-500 text-white"
                        : "bg-[#4F46E5] text-white"
                    )}>
                      {roomHarmonizedPct === 100 ? "✓" : `${roomHarmonizedPct}%`}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-extrabold text-[#172554]">
                          {getRoomLabelAndIcon(activeRoom.room_type, project?.bhk_type).icon} {getRoomLabelAndIcon(activeRoom.room_type, project?.bhk_type).label} Harmonization
                        </h3>
                        <span className={clsx(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                          roomHarmonizedPct === 100
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : roomHarmonizedPct >= 50
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        )}>
                          {roomHarmonizedPct === 100
                            ? "✨ 100% Harmonized"
                            : `${completedMandatoryCategories.length}/${activeRoomMandatoryCategories.length} Elements Coordinated`}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        {roomHarmonizedPct === 100
                          ? "All anchor furniture and coordinated pairings selected for this room."
                          : "Coordinate core pieces and recommended pairings to balance design harmony."}
                      </p>
                    </div>
                  </div>

                  {roomHarmonizedPct === 100 && (
                    <button
                      onClick={() => router.push(`/visualize/${projectId}`)}
                      className="self-start sm:self-auto py-2 px-4 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 shrink-0 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Render 3D View →</span>
                    </button>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                  <div
                    className={clsx(
                      "h-full transition-all duration-500 rounded-full",
                      roomHarmonizedPct === 100
                        ? "bg-gradient-to-r from-emerald-400 to-emerald-600"
                        : "bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400"
                    )}
                    style={{ width: `${Math.max(roomHarmonizedPct, 5)}%` }}
                  />
                </div>

                {/* Interactive Category Chips */}
                {!isBalcony && activeRoomMandatoryCategories.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
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
                            "text-[10px] font-bold px-2.5 py-1 rounded-xl transition-all flex items-center gap-1.5 border",
                            isCurrent
                              ? "ring-2 ring-indigo-500 ring-offset-1 bg-white text-indigo-700 border-indigo-300 shadow-xs"
                              : isConfigured
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                          )}
                        >
                          <span className={isConfigured ? "text-emerald-600 font-extrabold" : "text-slate-400"}>
                            {isConfigured ? "✓" : "○"}
                          </span>
                          <span>{cat.label}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}

          <AnimatePresence mode="wait">
            {allRoomsComplete && !userEditingCategory ? (
              <motion.div
                key="all-complete"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="bg-white border border-[#E5E7F2] rounded-3xl p-8 shadow-sm min-h-[400px] flex flex-col justify-between"
              >
                <div>
                  <div className="border-b border-[#E5E7F2] pb-4 mb-6">
                    <span className="text-[10px] font-bold text-[#10B981] uppercase tracking-widest">Configuration Complete</span>
                    <h2 className="text-xl font-extrabold text-[#172554] mt-1">Ready for Visualization</h2>
                    <p className="text-[#64748B] text-xs mt-0.5">All categories under all rooms have been successfully customized.</p>
                  </div>
                  
                  <div className="bg-[#F7F8FF] p-6 rounded-2xl border border-[#E5E7F2] space-y-4 text-center my-6">
                    <div className="w-12 h-12 bg-emerald-50 text-[#10B981] border border-emerald-200 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                      ✓
                    </div>
                    <div>
                      <p className="text-[#172554] text-sm font-extrabold">All design selections chosen!</p>
                      <p className="text-[#64748B] text-xs mt-1">
                        Please proceed to the AI Render Studio to generate photorealistic 4-wall visual designs of your configured home.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <button
                    onClick={() => router.push(`/visualize/${projectId}`)}
                    className="py-3 px-8 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-sm font-bold rounded-xl transition shadow-sm flex items-center gap-2 hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Proceed to AI Render</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ) : !customizingProduct ? (
              // CHOOSE DESIGN
              <motion.div
                key="catalog"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="bg-white border border-[#E5E7F2] rounded-3xl p-6 shadow-sm min-h-[400px] flex flex-col justify-between"
              >
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E5E7F2] pb-4 mb-5 gap-3">
                    <div>
                      <h2 className="text-xl font-extrabold text-[#172554]">Choose Design Category Product</h2>
                      <p className="text-[#64748B] text-xs mt-0.5">Select a base design layout for your active room category.</p>
                    </div>

                    {/* Preference Legend Card */}
                    <div className="bg-[#F7F8FF] border border-[#E5E7F2] rounded-2xl px-3.5 py-2 flex flex-wrap items-center gap-3.5 text-[10px] font-bold text-slate-700 self-start sm:self-auto shadow-2xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shadow-sm shrink-0" />
                        <span>Not within Material & Fabric Preference</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block shadow-sm shrink-0" />
                        <span>Not within Color Preference</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shadow-sm shrink-0" />
                        <span>Exceeds Budget Cap</span>
                      </div>
                    </div>
                  </div>

                  {!exactColorMatchFound && !loadingProducts && products.length > 0 && (
                    <div className="mb-4 p-3 bg-[#FFF8E7] border border-[#FDE68A] rounded-2xl flex items-center gap-2 text-[11px] font-semibold text-[#F59E0B]">
                      <Sparkles className="w-4 h-4 flex-shrink-0 text-[#F59E0B]" />
                      <span>The selected color is currently unavailable for this product category. Showing closest available shades instead.</span>
                    </div>
                  )}

                  {loadingProducts ? (
                    <div className="grid md:grid-cols-2 gap-4 py-8">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-28 rounded-2xl bg-slate-50 border border-[#E5E7F2] animate-pulse" />
                      ))}
                    </div>
                  ) : (Array.isArray(products) ? products : []).length === 0 ? (
                    <div className="text-center py-20 text-[#64748B] text-xs">
                      No products catalogued for this room style category yet.
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                      {(Array.isArray(products) ? products : []).map((p) => {
                        const isChosen = activeRoomItems.some((it: any) => it.product_id === p.id)
                        const hasMaterialMismatch = p.is_material_match === false || p.is_fabric_match === false
                        const hasColorMismatch = p.is_color_match === false
                        const hasPriceMismatch = p.is_price_match === false
                        const isExpanded = inlinePreviewProductId === p.id
                        const inlinePairings = inlinePreviewData[p.id]?.recommended_items?.slice(0, 3) || []

                        return (
                          <div key={p.id} className="flex flex-col">
                            {/* Product Card */}
                            <div
                              onClick={() => {
                                // Toggle inline preview
                                if (inlinePreviewProductId === p.id) {
                                  setInlinePreviewProductId(null)
                                  return
                                }
                                setInlinePreviewProductId(p.id)
                                // Fetch if not cached
                                if (!inlinePreviewData[p.id]) {
                                  setLoadingInlinePreview(p.id)
                                  const currentMood = productMood[p.id] || 'monochrome'
                                  recommendationsAPI.getComplementaryBundle(p.id, projectId, activeRoomId || undefined, currentMood)
                                    .then((res) => {
                                      setInlinePreviewData((prev) => ({ ...prev, [p.id]: res.data }))
                                    })
                                    .catch(() => {
                                      setInlinePreviewData((prev) => ({ ...prev, [p.id]: null }))
                                    })
                                    .finally(() => setLoadingInlinePreview(null))
                                }
                              }}
                              className={clsx(
                                'p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 group',
                                isChosen
                                  ? 'bg-[#F5F3FF] border-[#6366F1] shadow-sm'
                                  : isExpanded
                                  ? 'bg-white border-[#6366F1] shadow-sm'
                                  : 'bg-white border-[#E5E7F2] hover:border-[#6366F1] hover:shadow-sm'
                              )}
                            >
                              <div className="flex items-center justify-between gap-4 w-full">
                                <div className="flex items-center gap-3.5 min-w-0">
                                  <ProductImage
                                    src={p.thumbnail_url}
                                    fallbacks={p.images}
                                    alt={p.name}
                                    className="w-14 h-14 object-cover rounded-xl flex-shrink-0 border border-[#E5E7F2]"
                                  />
                                  <div className="min-w-0">
                                    <h4 className="text-xs font-extrabold text-[#172554] group-hover:text-[#4F46E5] transition-colors truncate">
                                      {p.name}
                                    </h4>
                                    <div className="text-xs font-extrabold text-[#4F46E5] mt-0.5">
                                      ₹{p.price.toLocaleString('en-IN')}
                                    </div>
                                    <span className={clsx(
                                      'inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                                      p.availability_tier === 'local'
                                        ? 'bg-emerald-50 text-[#10B981] border border-emerald-200'
                                        : p.availability_tier === 'nearby'
                                        ? 'bg-[#FFF8E7] text-[#F59E0B] border border-[#FDE68A]'
                                        : 'bg-slate-100 text-[#64748B] border border-[#E5E7F2]'
                                    )}>
                                      {p.availability_tier === 'local' ? '📍 Your Area' : p.availability_tier === 'nearby' ? '🏙️ Nearby' : '🌐 National'}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                  {/* Customize button — opens detail panel */}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleSelectProduct(p) }}
                                    className={clsx(
                                      'py-1.5 px-3 text-[10px] font-bold rounded-xl transition shrink-0',
                                      isChosen
                                        ? 'bg-[#10B981] text-white'
                                        : 'bg-white border border-[#4F46E5] text-[#4F46E5] hover:bg-[#4F46E5] hover:text-white'
                                    )}
                                  >
                                    {isChosen ? 'Configured ✓' : 'Choose'}
                                  </button>
                                  {/* Toggle inline pairing preview */}
                                  <span className="text-[9px] text-[#64748B] font-semibold">
                                    {isExpanded ? '▲ hide pairs' : '✨ see pairs'}
                                  </span>
                                </div>
                              </div>

                              {/* Indicator Dots */}
                              {(hasMaterialMismatch || hasColorMismatch || hasPriceMismatch) && (
                                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                                  {hasMaterialMismatch && (
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shadow-sm" title="Not within material/fabric preference" />
                                  )}
                                  {hasColorMismatch && (
                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block shadow-sm" title="Not within color preference" />
                                  )}
                                  {hasPriceMismatch && (
                                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shadow-sm" title="Exceeds budget cap" />
                                  )}
                                </div>
                              )}
                            </div>

                            {/* ── Inline AI Pairings Strip ── */}
                            {isExpanded && (
                              <div className="mt-1 p-3.5 bg-gradient-to-br from-[#F8FAFC] to-[#EEF2FF] border border-[#C7D2FE] rounded-2xl space-y-2.5 shadow-2xs">
                                {/* Strip Header with Mood Toggle */}
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-2">
                                  <div className="flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-[#4F46E5]" />
                                    <span className="text-[10px] font-extrabold text-[#172554]">Pairs Well With</span>
                                  </div>

                                  {/* Style Mood Toggle */}
                                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-indigo-100 shadow-2xs">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleToggleMood(p.id, 'monochrome')
                                      }}
                                      className={clsx(
                                        "px-2 py-0.5 rounded-md text-[9px] font-bold transition flex items-center gap-1",
                                        (productMood[p.id] || 'monochrome') === 'monochrome'
                                          ? "bg-[#4F46E5] text-white shadow-2xs"
                                          : "text-slate-600 hover:text-[#4F46E5]"
                                      )}
                                      title="Match Tone: exact harmonized tones and same family finishes"
                                    >
                                      <span>🎨 Match Tone</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleToggleMood(p.id, 'accent')
                                      }}
                                      className={clsx(
                                        "px-2 py-0.5 rounded-md text-[9px] font-bold transition flex items-center gap-1",
                                        productMood[p.id] === 'accent'
                                          ? "bg-purple-600 text-white shadow-2xs"
                                          : "text-slate-600 hover:text-purple-600"
                                      )}
                                      title="Designer Accent: contrasting accents and warm complementary pop"
                                    >
                                      <span>✨ Designer Accent</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Spatial Clearance & Flow Badge */}
                                {inlinePreviewData[p.id]?.spatial_feasibility && (
                                  <div className="flex items-center gap-1.5 text-[9px] font-semibold text-emerald-700 bg-emerald-50/80 px-2.5 py-1 rounded-xl border border-emerald-200">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>{inlinePreviewData[p.id].spatial_feasibility.label || 'Optimal Spatial Clearance'}</span>
                                    <span className="text-[8px] text-emerald-600 font-bold ml-auto">
                                      ({inlinePreviewData[p.id].spatial_feasibility.footprint_ratio_pct}% footprint)
                                    </span>
                                  </div>
                                )}

                                {loadingInlinePreview === p.id ? (
                                  <div className="flex gap-2 overflow-x-auto pb-1">
                                    {[1, 2, 3].map((i) => (
                                      <div key={i} className="w-32 h-20 rounded-xl bg-slate-200 animate-pulse shrink-0" />
                                    ))}
                                  </div>
                                ) : inlinePairings.length > 0 ? (
                                  <>
                                    <div className="flex gap-2 overflow-x-auto pb-1">
                                      {inlinePairings.map((item: any) => (
                                        <div
                                          key={item.id}
                                          className="shrink-0 w-32 bg-white border border-slate-200 rounded-xl p-2 flex flex-col gap-1 shadow-sm"
                                        >
                                          <img
                                            src={item.thumbnail_url}
                                            alt={item.name}
                                            className="w-full h-14 object-cover rounded-lg bg-slate-50"
                                          />
                                          <span className="text-[9px] font-extrabold text-[#4F46E5] uppercase tracking-wide truncate">{item.category_label}</span>
                                          <span className="text-[9px] font-bold text-[#172554] leading-tight truncate">{item.name}</span>
                                          {item.reasons && item.reasons[0] && (
                                            <span className="text-[8px] font-medium text-[#4F46E5] bg-[#EEF2FF] px-1 py-0.5 rounded truncate" title={item.reasons[0]}>
                                              {item.reasons[0]}
                                            </span>
                                          )}
                                          <span className="text-[9px] font-bold text-emerald-600 mt-auto">+₹{item.price.toLocaleString('en-IN')}</span>
                                        </div>
                                      ))}
                                      <div
                                        className="shrink-0 w-28 bg-white border border-dashed border-[#C7D2FE] rounded-xl p-2 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-[#EEF2FF] transition"
                                        onClick={(e) => { e.stopPropagation(); handleSelectProduct(p) }}
                                      >
                                        <Sparkles className="w-4 h-4 text-[#4F46E5]" />
                                        <span className="text-[9px] font-bold text-[#4F46E5] text-center leading-tight">See all &amp; customise</span>
                                      </div>
                                    </div>

                                    {/* Strip Footer with 1-Click Add Full Set */}
                                    <div className="flex flex-wrap items-center justify-between pt-2 border-t border-indigo-100 gap-2">
                                      <div className="text-[10px] text-slate-600">
                                        <span className="font-medium">Set Total: </span>
                                        <span className="font-black text-[#172554]">
                                          ₹{(p.price + inlinePairings.reduce((sum: number, it: any) => sum + (it.price || 0), 0)).toLocaleString('en-IN')}
                                        </span>
                                        <span className="text-[9px] text-[#4F46E5] font-bold ml-1">
                                          ({inlinePairings.length + 1} pieces)
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); handleSelectProduct(p) }}
                                          className="text-[9px] font-bold text-[#4F46E5] hover:underline"
                                        >
                                          Customize Options →
                                        </button>

                                        <button
                                          type="button"
                                          disabled={savingBundleId === p.id}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleAddFullSetFromGrid(p, inlinePairings)
                                          }}
                                          className="py-1 px-3 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[10px] font-extrabold rounded-xl transition shadow-xs flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                                        >
                                          {savingBundleId === p.id ? (
                                            <>
                                              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                              <span>Adding Set...</span>
                                            </>
                                          ) : (
                                            <>
                                              <Sparkles className="w-3 h-3 text-amber-300" />
                                              <span>Add Full Set (+₹{inlinePairings.reduce((sum: number, it: any) => sum + (it.price || 0), 0).toLocaleString('en-IN')})</span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <p className="text-[9px] text-[#64748B] font-semibold py-2 text-center">No pairings available yet</p>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="text-[#64748B] text-[10px] mt-6 flex items-center gap-1.5 bg-[#F7F8FF] p-3.5 rounded-2xl border border-[#E5E7F2]">
                  <Info className="w-4 h-4 text-[#3B82F6]" />
                  <span>Choose any design structure to expose variant and custom styling options.</span>
                </div>
              </motion.div>
            ) : (
              // STEP 4: CUSTOMIZE ATTRIBUTES
              <motion.div
                key="customizer"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="bg-white border border-[#E5E7F2] rounded-3xl p-6 shadow-sm"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#E5E7F2] pb-4 mb-5">
                  <div>
                    <span className="text-[10px] font-bold text-[#4F46E5] uppercase tracking-widest">Step 4</span>
                    <h2 className="text-xl font-extrabold text-[#172554] mt-1">Customize Product</h2>
                    <p className="text-[#64748B] text-xs mt-0.5">Customize variant attributes for {customizingProduct.name}</p>
                  </div>
                  <button
                    onClick={() => setCustomizingProduct(null)}
                    className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-[#172554] text-xs font-bold rounded-lg transition"
                  >
                    Go Back
                  </button>
                </div>

                <div className="grid md:grid-cols-12 gap-6">
                  {/* Left Column: Product Info Card */}
                  <div className="md:col-span-5 bg-[#F7F8FF] border border-[#E5E7F2] p-4 rounded-2xl flex flex-col justify-between">
                    <div>
                      <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-3 group bg-white border border-[#E5E7F2] flex items-center justify-center">
                        {galleryImages[activeImageIdx] ? (
                          <ProductImage
                            src={galleryImages[activeImageIdx]}
                            fallbacks={[customizingProduct.thumbnail_url]}
                            alt={customizingProduct.name}
                            eager
                            iconClassName="w-10 h-10"
                            className="w-full h-full object-cover transition-all duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-50 select-none">
                            <ImageIcon className="w-8 h-8 text-[#64748B] mb-2" />
                            <h5 className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Optional View Not Uploaded</h5>
                            <p className="text-[9px] text-[#64748B] mt-1 max-w-xs leading-relaxed">
                              The vendor has provided primary perspective for this component.
                            </p>
                          </div>
                        )}
                        
                        <button
                          type="button"
                          onClick={() => setActiveImageIdx((prev) => (prev === 0 ? 2 : prev - 1))}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-[#172554] flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-sm border border-[#E5E7F2]"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveImageIdx((prev) => (prev === 2 ? 0 : prev + 1))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-[#172554] flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-sm border border-[#E5E7F2]"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Thumbnails */}
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
                                isActive ? "border-[#6366F1] bg-[#F5F3FF] shadow-sm" : "border-[#E5E7F2] bg-white hover:bg-slate-50"
                              )}
                            >
                              {imgUrl ? (
                                <ProductImage
                                  src={imgUrl}
                                  alt={`Thumb ${idx}`}
                                  iconClassName="w-3.5 h-3.5"
                                  className="w-full h-full object-cover rounded"
                                />
                              ) : (
                                <div className="flex flex-col items-center justify-center">
                                  <ImageIcon className="w-3.5 h-3.5 text-[#64748B] mb-0.5" />
                                  <span className="text-[7px] text-[#64748B] font-bold uppercase tracking-wider">{label} N/A</span>
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>

                      <h4 className="text-sm font-extrabold text-[#172554]">{customizingProduct.name}</h4>
                      <p className="text-[10px] text-[#64748B] mt-1 leading-relaxed">
                        Design variant elements will overlay inside the visual rendering engine.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-[#E5E7F2] flex items-center justify-between">
                      <span className="text-[#64748B] text-xs font-semibold">Base Price:</span>
                      <span className="text-base font-extrabold text-[#4F46E5]">
                        ₹{customizingProduct.price.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Custom Attribute Selectors */}
                  <div className="md:col-span-7 space-y-5">
                    <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-[#4F46E5]" />
                      <span>Available Variants</span>
                    </h3>

                    {variantGroups(customizingProduct).length === 0 && (
                      <p className="text-xs text-[#64748B]">This product comes in a single variant.</p>
                    )}

                    {/* Every option group the vendor defined, in a stable order */}
                    {variantGroups(customizingProduct).map(({ key, label, values }) => {
                      const bestColour = key === 'color'
                        ? getBestColorMatch(values, project?.color_preferences || []).color
                        : ''
                      return (
                        <div key={key} className="space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <span className="text-[10px] font-bold text-[#64748B] uppercase block">{label}</span>
                            {key === 'color' && project?.color_preferences?.length > 0 && (
                              <span className="text-[9px] text-[#64748B]">
                                🎨 Selected Palette: <strong className="text-[#4F46E5]">{project.color_preferences.join(', ')}</strong>
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {values.map((val) => {
                              const isSelected = customAttrs[key] === val
                              const isBestMatch = key === 'color' && bestColour === val && (project?.color_preferences?.length || 0) > 0
                              return (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => setAttr(key, val)}
                                  className={clsx(
                                    'px-3 py-1.5 rounded-xl text-xs transition border font-semibold flex items-center gap-1.5',
                                    isSelected
                                      ? 'bg-[#F5F3FF] border-[#6366F1] text-[#4F46E5]'
                                      : 'bg-white border-[#E5E7F2] text-[#64748B] hover:border-slate-300'
                                  )}
                                >
                                  {key === 'color' && (
                                    <i className="w-3 h-3 rounded-full border border-black/10" style={{ background: getColorHex(val) }} />
                                  )}
                                  {isBestMatch && <span>⭐</span>}
                                  {val}
                                  {isBestMatch && <span className="text-[9px] opacity-75 font-normal ml-0.5">(Best Match)</span>}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}

                    {variantGroups(customizingProduct).length > 0 && (
                      <p className="text-[10px] text-[#64748B] leading-relaxed">
                        Your choices are shown on this piece in the 2D plan and 3D model, and used for AI renders.
                      </p>
                    )}

                    {/* COMPLEMENTARY ADD-ONS SMART PANEL */}
                    {(() => {
                      const selectedAddonsList = (complementaryData?.recommended_items || []).filter((it: any) =>
                        selectedAddonIds.includes(it.id)
                      )
                      const selectedAddonsCost = selectedAddonsList.reduce((acc: number, it: any) => acc + (it.price || 0), 0)
                      const totalBundlePrice = (customizingProduct?.price || 0) + selectedAddonsCost
                      const roomBudget = complementaryData?.room_budget || 100000
                      const remainingRoomAfterBundle = Math.max(0, roomBudget - totalBundlePrice)

                      return (
                        <div className="space-y-4 pt-2">
                          {loadingComplementary ? (
                            <div className="p-4 rounded-2xl bg-[#F7F8FF] border border-[#E5E7F2] animate-pulse space-y-3">
                              <div className="h-4 bg-slate-200 rounded w-1/3" />
                              <div className="h-16 bg-slate-200 rounded-xl" />
                            </div>
                          ) : complementaryData?.recommended_items && complementaryData.recommended_items.length > 0 ? (
                            <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-[#F8FAFC] to-[#EEF2FF] border border-[#C7D2FE] shadow-sm space-y-4">
                              {/* Panel Header */}
                              <div className="flex items-start justify-between gap-3 border-b border-indigo-100 pb-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-[#4F46E5]" />
                                    <h4 className="text-sm font-extrabold text-[#172554]">
                                      Complete the Room — AI Curated Pairings
                                    </h4>
                                  </div>
                                  <p className="text-[11px] text-[#64748B] mt-0.5">
                                    Harmonized with your{' '}
                                    <strong className="text-[#4F46E5]">{project?.interior_material_preference || 'wood'}</strong> &{' '}
                                    <strong className="text-[#4F46E5]">{project?.style_vibe || 'Modern'}</strong> design. Capped within budget.
                                  </p>
                                </div>
                                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-[10px] font-extrabold text-emerald-700 shrink-0">
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Budget Protected ({Math.round((totalBundlePrice / roomBudget) * 100)}% of Room)</span>
                                </span>
                              </div>

                              {/* Recommended Companion List */}
                              <div className="space-y-2">
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
                                        'p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3',
                                        isSelected
                                          ? 'bg-white border-[#6366F1] shadow-xs'
                                          : 'bg-white/70 border-slate-200 hover:border-slate-300 opacity-80 hover:opacity-100'
                                      )}
                                    >
                                      <div className="flex items-center gap-3 min-w-0">
                                        {/* Custom Checkbox */}
                                        <div
                                          className={clsx(
                                            'w-5 h-5 rounded-lg flex items-center justify-center border transition-all shrink-0',
                                            isSelected
                                              ? 'bg-[#4F46E5] border-[#4F46E5] text-white'
                                              : 'border-slate-300 bg-white'
                                          )}
                                        >
                                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                        </div>

                                        {/* Product Thumbnail */}
                                        <img
                                          src={item.thumbnail_url}
                                          alt={item.name}
                                          className="w-12 h-12 rounded-xl object-cover border border-slate-100 shrink-0 bg-slate-50"
                                        />

                                        {/* Product Info */}
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-extrabold text-[#4F46E5] uppercase tracking-wide">
                                              {item.category_label}
                                            </span>
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                              ✨ {item.match_pct}% Match
                                            </span>
                                          </div>
                                          <h5 className="text-xs font-bold text-[#172554] truncate mt-0.5">
                                            {item.name}
                                          </h5>

                                          {/* Explainability Tags */}
                                          <div className="flex flex-wrap gap-1.5 mt-1">
                                            {(item.reasons || []).map((reason: string, idx: number) => (
                                              <span
                                                key={idx}
                                                className="text-[9px] font-semibold text-[#64748B] bg-slate-100 px-1.5 py-0.5 rounded"
                                              >
                                                • {reason}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Price & Cap Details */}
                                      <div className="text-right shrink-0">
                                        <div className="text-xs font-extrabold text-[#172554]">
                                          +₹{item.price.toLocaleString('en-IN')}
                                        </div>
                                        <div className="text-[9px] text-slate-500 font-semibold mt-0.5">
                                          Cap: ₹{item.category_cap.toLocaleString('en-IN')}
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>

                              {/* Dynamic Bundle Summary Box */}
                              <div className="p-3.5 bg-white rounded-2xl border border-indigo-100 shadow-2xs">
                                <div className="text-xs font-bold text-[#172554]">
                                  Bundle Total:{' '}
                                  <span className="text-sm font-extrabold text-[#4F46E5]">
                                    ₹{totalBundlePrice.toLocaleString('en-IN')}
                                  </span>{' '}
                                  <span className="text-[11px] text-[#64748B] font-semibold">
                                    ({customizingProduct.name} + {selectedAddonsList.length} add-ons)
                                  </span>
                                </div>
                                <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>₹{remainingRoomAfterBundle.toLocaleString('en-IN')} buffer remaining (Within Budget)</span>
                                </p>
                              </div>
                            </div>
                          ) : null}

                          {/* Action Buttons */}
                          <div className="flex items-stretch gap-2 pt-2">
                            {selectedAddonsList.length > 0 && (
                              <button
                                type="button"
                                onClick={() => handleSaveSelection(true)}
                                disabled={savingItem}
                                className="flex-1 py-3 px-4 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-sm"
                              >
                                {savingItem ? (
                                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                  <>
                                    <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                                    <span className="text-left leading-tight">
                                      Save {customizingProduct.name} + {selectedAddonsList.length} Items<br />
                                      <span className="font-extrabold">₹{totalBundlePrice.toLocaleString('en-IN')}</span>
                                    </span>
                                  </>
                                )}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleSaveSelection(false)}
                              disabled={savingItem}
                              className={clsx(
                                'py-3 px-4 font-bold rounded-xl flex items-center justify-center gap-2 transition text-xs shrink-0',
                                selectedAddonsList.length > 0
                                  ? 'bg-slate-100 hover:bg-slate-200 text-[#172554] border border-[#E5E7F2]'
                                  : 'flex-1 bg-[#4F46E5] hover:bg-[#4338CA] text-white shadow-sm text-sm'
                              )}
                            >
                              {savingItem && selectedAddonsList.length === 0 ? (
                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                  <span className="text-left leading-tight">
                                    Save {customizingProduct.name} Only<br />
                                    <span className="font-extrabold">₹{customizingProduct.price.toLocaleString('en-IN')}</span>
                                  </span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* About this Product */}
                <div className="border-t border-[#E5E7F2] pt-5 mt-6 space-y-4">
                  <h3 className="text-sm font-extrabold text-[#172554] uppercase tracking-wider">About this Product</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-xs">
                    
                    {/* Left Column */}
                    <div className="space-y-1">
                      <div className="grid grid-cols-3 py-1.5 border-b border-[#E5E7F2]">
                        <span className="col-span-1 text-[#64748B] font-semibold">Material</span>
                        <span className="col-span-2 text-[#172554] font-bold pl-2">{customizingProduct.primary_material || customizingProduct.primaryMaterial || 'Solid Wood'}</span>
                      </div>
                      <div className="grid grid-cols-3 py-1.5 border-b border-[#E5E7F2]">
                        <span className="col-span-1 text-[#64748B] font-semibold">Dimensions</span>
                        <span className="col-span-2 text-[#172554] font-bold pl-2">
                          {customizingProduct.width || 1200}w × {customizingProduct.height || 750}h × {customizingProduct.depth || 600}d mm
                        </span>
                      </div>
                      <div className="grid grid-cols-3 py-1.5 border-b border-[#E5E7F2]">
                        <span className="col-span-1 text-[#64748B] font-semibold">Weight</span>
                        <span className="col-span-2 text-[#172554] font-bold pl-2">{customizingProduct.weight || 15} kg</span>
                      </div>
                      <div className="grid grid-cols-3 py-1.5 border-b border-[#E5E7F2]">
                        <span className="col-span-1 text-[#64748B] font-semibold">Capacity</span>
                        <span className="col-span-2 text-[#172554] font-bold pl-2">{customizingProduct.weight_capacity || customizingProduct.weightCapacity || 120} kg</span>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-1">
                      <div className="grid grid-cols-3 py-1.5 border-b border-[#E5E7F2]">
                        <span className="col-span-1 text-[#64748B] font-semibold">Style</span>
                        <span className="col-span-2 text-[#172554] font-bold pl-2">{customizingProduct.style || 'Modern'}</span>
                      </div>
                      <div className="grid grid-cols-3 py-1.5 border-b border-[#E5E7F2]">
                        <span className="col-span-1 text-[#64748B] font-semibold">Finish</span>
                        <span className="col-span-2 text-[#172554] font-bold pl-2">{customizingProduct.finish || 'Matte'}</span>
                      </div>
                      <div className="grid grid-cols-3 py-1.5 border-b border-[#E5E7F2]">
                        <span className="col-span-1 text-[#64748B] font-semibold">Mounting</span>
                        <span className="col-span-2 text-[#172554] font-bold pl-2">{customizingProduct.mounting_type || customizingProduct.mountingType || 'Floor Standing'}</span>
                      </div>
                      <div className="grid grid-cols-3 py-1.5 border-b border-[#E5E7F2]">
                        <span className="col-span-1 text-[#64748B] font-semibold">Assembly</span>
                        <span className="col-span-2 text-[#172554] font-bold pl-2">{customizingProduct.assembly_required || customizingProduct.assemblyRequired || 'No'}</span>
                      </div>
                    </div>

                  </div>
                </div>

              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
    </div>
  )
}

/* [FEATURE: 1-CLICK BUNDLE & ROOM HARMONIZATION COMMITTED] */
