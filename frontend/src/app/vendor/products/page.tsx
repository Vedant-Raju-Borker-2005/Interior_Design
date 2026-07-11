'use client'

import { useEffect, useState } from 'react'
import { useVendorStore } from '@/stores/vendorStore'
import { vendorAPI } from '@/lib/api'
import { Plus, Edit3, X, Package, Trash2, Camera, Image as ImageIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'


// ── Category / Subcategory map ────────────────────────────────────────────────
const CATEGORIES = ['Furniture', 'Lighting', 'Appliances', 'Decor', 'Flooring', 'Kitchen Cabinets', 'Wardrobes', 'Curtains', 'Bathroom Fixtures']
const SUBCATEGORY_MAP: Record<string, string[]> = {
  Furniture: ['Sofas', 'Chairs', 'Recliners', 'Coffee Tables', 'Side Tables', 'Dining Tables', 'Beds', 'Bookshelves', 'Benches'],
  Lighting: ['Floor Lamps', 'Table Lamps', 'Ceiling Lights', 'Wall Lights', 'Chandeliers', 'LED Strips'],
  Appliances: ['Refrigerator', 'Washing Machine', 'AC', 'Microwave', 'Dishwasher'],
  Decor: ['Wall Art', 'Vases', 'Cushions', 'Rugs', 'Candles', 'Planters'],
  Flooring: ['Vinyl', 'Laminate', 'Marble', 'Hardwood', 'Tile'],
  'Kitchen Cabinets': ['Base Cabinets', 'Wall Cabinets', 'Modular Kitchen', 'Open Shelves'],
  Wardrobes: ['Sliding Door', 'Hinged Door', 'Walk-in', 'Corner Wardrobe'],
  Curtains: ['Blackout', 'Sheer', 'Eyelet', 'Pinch Pleat'],
  'Bathroom Fixtures': ['Shower Panel', 'Wash Basin', 'Bathtub', 'Vanity'],
}

// ── Smart spec config per subcategory ────────────────────────────────────────
type SpecKey = 'color' | 'fabric' | 'size' | 'texture' | 'wood_finish' | 'cushion_style'

interface SpecConfig {
  sections: SpecKey[]
  sizeLabel: string
  sizeOptions: string[]
  fabricLabel: string
  fabricOptions: string[]
  woodFinishOptions: string[]
  textureOptions: string[]
  cushionOptions: string[]
}

const DEFAULT_COLORS = ['White', 'Black', 'Grey', 'Beige', 'Brown', 'Navy Blue', 'Green', 'Yellow', 'Pink', 'Red', 'Walnut']
const ALL_FABRICS = ['Velvet', 'Linen', 'Cotton', 'Leather', 'Faux Leather', 'Microfiber', 'Polyester', 'Wool', 'Silk']
const ALL_WOOD = ['Oak', 'Walnut', 'Teak', 'Mahogany', 'Pine', 'Rosewood', 'Ash', 'Natural', 'Matte White', 'Matte Black']
const ALL_TEXTURE = ['Smooth', 'Matte', 'Glossy', 'Rough', 'Brushed', 'Embossed', 'Woven']
const ALL_CUSHION = ['Firm', 'Soft', 'Medium', 'High-back', 'Low-back', 'Tufted', 'No Cushion']

const SPEC_MAP: Record<string, SpecConfig> = {
  Sofas:           { sections: ['color','fabric','size','cushion_style'],      sizeLabel: 'Seater Size',    sizeOptions: ['1-Seater','2-Seater','3-Seater','L-Shape','U-Shape'], fabricLabel: 'Fabric', fabricOptions: ALL_FABRICS, woodFinishOptions: [], textureOptions: [], cushionOptions: ALL_CUSHION },
  Chairs:          { sections: ['color','fabric','cushion_style'],             sizeLabel: '',               sizeOptions: [], fabricLabel: 'Fabric', fabricOptions: ALL_FABRICS, woodFinishOptions: [], textureOptions: [], cushionOptions: ALL_CUSHION },
  Recliners:       { sections: ['color','fabric','cushion_style'],             sizeLabel: '',               sizeOptions: [], fabricLabel: 'Fabric', fabricOptions: ALL_FABRICS, woodFinishOptions: [], textureOptions: [], cushionOptions: ALL_CUSHION },
  'Coffee Tables': { sections: ['color','wood_finish','texture','size'],       sizeLabel: 'Table Size',     sizeOptions: ['Small','Medium','Large'], fabricLabel: '', fabricOptions: [], woodFinishOptions: ALL_WOOD, textureOptions: ALL_TEXTURE, cushionOptions: [] },
  'Side Tables':   { sections: ['color','wood_finish','texture'],              sizeLabel: '',               sizeOptions: [], fabricLabel: '', fabricOptions: [], woodFinishOptions: ALL_WOOD, textureOptions: ALL_TEXTURE, cushionOptions: [] },
  'Dining Tables': { sections: ['color','wood_finish','texture','size'],       sizeLabel: 'Seating',        sizeOptions: ['2-Seater','4-Seater','6-Seater','8-Seater','10-Seater'], fabricLabel: '', fabricOptions: [], woodFinishOptions: ALL_WOOD, textureOptions: ALL_TEXTURE, cushionOptions: [] },
  Beds:            { sections: ['color','wood_finish','size'],                 sizeLabel: 'Bed Size',       sizeOptions: ['Single','Double','Queen','King','Super King'], fabricLabel: '', fabricOptions: [], woodFinishOptions: ALL_WOOD, textureOptions: [], cushionOptions: [] },
  Bookshelves:     { sections: ['color','wood_finish','texture','size'],       sizeLabel: 'Size',           sizeOptions: ['Small','Medium','Large'], fabricLabel: '', fabricOptions: [], woodFinishOptions: ALL_WOOD, textureOptions: ALL_TEXTURE, cushionOptions: [] },
  Benches:         { sections: ['color','fabric','wood_finish'],               sizeLabel: '',               sizeOptions: [], fabricLabel: 'Upholstery', fabricOptions: ALL_FABRICS, woodFinishOptions: ALL_WOOD, textureOptions: [], cushionOptions: [] },
  'Floor Lamps':   { sections: ['color','texture'],                            sizeLabel: '',               sizeOptions: [], fabricLabel: '', fabricOptions: [], woodFinishOptions: [], textureOptions: ALL_TEXTURE, cushionOptions: [] },
  'Table Lamps':   { sections: ['color','texture'],                            sizeLabel: '',               sizeOptions: [], fabricLabel: '', fabricOptions: [], woodFinishOptions: [], textureOptions: ALL_TEXTURE, cushionOptions: [] },
  'Ceiling Lights':{ sections: ['color','size'],                               sizeLabel: 'Diameter',       sizeOptions: ['Small','Medium','Large','XL'], fabricLabel: '', fabricOptions: [], woodFinishOptions: [], textureOptions: [], cushionOptions: [] },
  Chandeliers:     { sections: ['color','size'],                               sizeLabel: 'Diameter',       sizeOptions: ['Small','Medium','Large','XL'], fabricLabel: '', fabricOptions: [], woodFinishOptions: [], textureOptions: [], cushionOptions: [] },
  Flooring:        { sections: ['color','texture','size'],                     sizeLabel: 'Plank Size',     sizeOptions: ['Small','Medium','Large'], fabricLabel: '', fabricOptions: [], woodFinishOptions: [], textureOptions: ALL_TEXTURE, cushionOptions: [] },
  Vinyl:           { sections: ['color','texture'],                            sizeLabel: '',               sizeOptions: [], fabricLabel: '', fabricOptions: [], woodFinishOptions: [], textureOptions: ALL_TEXTURE, cushionOptions: [] },
  Curtains:        { sections: ['color','fabric','size'],                      sizeLabel: 'Length',         sizeOptions: ['7ft','8ft','9ft','10ft','Custom'], fabricLabel: 'Fabric', fabricOptions: ALL_FABRICS, woodFinishOptions: [], textureOptions: [], cushionOptions: [] },
  Rugs:            { sections: ['color','texture','size'],                     sizeLabel: 'Rug Size',       sizeOptions: ["4'x6'","5'x8'","6'x9'","8'x10'","9'x12'","Custom"], fabricLabel: '', fabricOptions: [], woodFinishOptions: [], textureOptions: ALL_TEXTURE, cushionOptions: [] },
  Wardrobes:       { sections: ['color','wood_finish','size'],                 sizeLabel: 'Width',          sizeOptions: ['2-Door','3-Door','4-Door','Walk-in'], fabricLabel: '', fabricOptions: [], woodFinishOptions: ALL_WOOD, textureOptions: [], cushionOptions: [] },
}

function getSpecConfig(subcategory: string): SpecConfig {
  return SPEC_MAP[subcategory] ?? {
    sections: ['color'], sizeLabel: 'Size', sizeOptions: ['Small','Medium','Large'],
    fabricLabel: 'Fabric', fabricOptions: ALL_FABRICS, woodFinishOptions: ALL_WOOD,
    textureOptions: ALL_TEXTURE, cushionOptions: ALL_CUSHION,
  }
}

type ColorEntry = { name: string; qty: number }

export default function VendorProductsPage() {
  const { products, loadProducts, createProduct, updateProduct, deleteProduct, loading } = useVendorStore()
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any | null>(null)
  const [expandedCard, setExpandedCard] = useState<string | null>(null)

  // Product image state
  const [productImageFile, setProductImageFile] = useState<File | null>(null)
  const [productImagePreview, setProductImagePreview] = useState<string>('')
  const [uploadingImage, setUploadingImage] = useState(false)


  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this product? It will be removed from customer catalogs.')) {
      try {
        await deleteProduct(id)
        toast.success('Product deleted successfully! 🗑️')
      } catch (err: any) {
        toast.error(err.message || 'Failed to delete product')
      }
    }
  }


  // Basic fields
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Furniture')
  const [subcategory, setSubcategory] = useState('Sofas')
  const [sku, setSku] = useState('')
  const [description, setDescription] = useState('')
  const [basePrice, setBasePrice] = useState(15000)
  const [totalStock, setTotalStock] = useState(10)

  // Variants
  const [colors, setColors] = useState<string[]>([])
  const [fabricOptions, setFabricOptions] = useState<string[]>([])
  const [sizeOptions, setSizeOptions] = useState<string[]>([])
  const [textureOptions, setTextureOptions] = useState<string[]>([])
  const [woodFinishOptions, setWoodFinishOptions] = useState<string[]>([])
  const [cushionStyleOptions, setCushionStyleOptions] = useState<string[]>([])

  const spec = getSpecConfig(subcategory)

  useEffect(() => { loadProducts() }, [])

  useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name || '')
      setCategory(editingProduct.category || 'Furniture')
      setSubcategory(editingProduct.subcategory || 'Sofas')
      setSku(editingProduct.sku || '')
      setDescription(editingProduct.description || '')
      setBasePrice(editingProduct.basePrice || 0)
      setTotalStock(editingProduct.inventory?.availableQty ?? 10)
      const v = editingProduct.variants || {}
      setColors(v.color || [])
      setFabricOptions(v.fabric || [])
      setSizeOptions(v.size || [])
      setTextureOptions(v.texture || [])
      setWoodFinishOptions(v.wood_finish || [])
      setCushionStyleOptions(v.cushion_style || [])
      setProductImagePreview(editingProduct.images?.[0] || '')
      setProductImageFile(null)
    } else {
      resetForm()
    }
  }, [editingProduct, showModal])

  // Reset variant selections when subcategory changes
  useEffect(() => {
    setFabricOptions([])
    setSizeOptions([])
    setTextureOptions([])
    setWoodFinishOptions([])
    setCushionStyleOptions([])
  }, [subcategory])

  const resetForm = () => {
    setName(''); setCategory('Furniture'); setSubcategory('Sofas')
    setSku(`PROD-${Math.floor(Math.random() * 900000 + 100000)}`)
    setDescription(''); setBasePrice(15000); setTotalStock(10)
    setColors([])
    setFabricOptions([]); setSizeOptions([]); setTextureOptions([])
    setWoodFinishOptions([]); setCushionStyleOptions([])
    setProductImageFile(null); setProductImagePreview('')
  }

  const toggleTag = (list: string[], setList: (v: string[]) => void, val: string) =>
    setList(list.includes(val) ? list.filter(x => x !== val) : [...list, val])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !sku.trim()) { toast.error('Name and SKU are required'); return }
    const payload: any = {
      name, category, subcategory, sku, description, basePrice,
      availableQty: totalStock,
      variantOptions: {
        color: colors,
        fabric: fabricOptions, size: sizeOptions,
        texture: textureOptions, wood_finish: woodFinishOptions,
        cushion_style: cushionStyleOptions,
      },
      colorStock: {}, // No longer color-wise stock, send empty
    }
    try {
      let productId = editingProduct?.id
      if (editingProduct) {
        await updateProduct(editingProduct.id, payload)
        toast.success('Product updated! 🎉')
      } else {
        const res = await createProduct(payload)
        productId = res?.productId
        toast.success('Product added! 🚀')
      }

      // Upload product image if one was selected
      if (productImageFile && productId) {
        setUploadingImage(true)
        try {
          await vendorAPI.uploadProductImage(productId, productImageFile)
          toast.success('Product photo uploaded! 📸')
        } catch (uploadErr) {
          console.error("Photo upload error:", uploadErr)
          toast.error('Product details saved, but photo upload failed.')
        } finally {
          setUploadingImage(false)
        }
      }

      // Refresh product list
      await loadProducts()
      setShowModal(false)
      setEditingProduct(null)
    } catch (err: any) { toast.error(err.message || 'Failed') }
  }

  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Product Catalog</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage items, variants, and stock.</p>
        </div>
        <button onClick={() => { setEditingProduct(null); setShowModal(true) }}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {/* Cards */}
      {loading && products.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1,2,3].map(i => <div key={i} className="bg-white border border-slate-100 rounded-2xl h-48 animate-pulse" />)}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-100 rounded-2xl p-6 max-w-lg mx-auto">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-extrabold text-slate-800 text-sm">No products yet</h3>
          <p className="text-slate-400 text-xs mt-1">Add products with color, fabric & size options.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {products.map(p => {
            const v = p.variants || {}
            const totalQty = p.inventory?.availableQty ?? 0
            const isExp = expandedCard === p.id
            const displayImage = p.images?.[0] || ''
            return (
              <div key={p.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                {displayImage && (
                  <div className="relative w-full h-36 bg-slate-100 overflow-hidden flex-shrink-0">
                    <img
                      src={displayImage.startsWith('/') ? `http://localhost:8000${displayImage}` : displayImage}
                      alt={p.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  </div>
                )}
                <div className="p-4 space-y-2.5 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-slate-800 text-sm leading-tight truncate">{p.name}</h3>
                      <span className="text-[10px] text-slate-400 font-mono">{p.sku}</span>
                    </div>
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">{p.category}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                      <span className="text-[9px] text-slate-400 font-bold uppercase block">Price</span>
                      <span className="font-black text-slate-800 text-sm">{fmt(p.basePrice)}</span>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                      <span className="text-[9px] text-slate-400 font-bold uppercase block">Stock</span>
                      <span className={clsx('font-black text-sm', totalQty <= 2 ? 'text-rose-600' : 'text-slate-800')}>{totalQty} units</span>
                    </div>
                  </div>

                  {v.color?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {v.color.map((c: string) => <span key={c} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full text-[10px] font-bold">{c}</span>)}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {v.fabric?.map((f: string) => <span key={f} className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-full text-[10px] font-bold">{f}</span>)}
                    {v.size?.map((s: string) => <span key={s} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-bold">{s}</span>)}
                    {v.wood_finish?.map((w: string) => <span key={w} className="px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-100 rounded-full text-[10px] font-bold">{w}</span>)}
                  </div>


                </div>
                <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-100 flex justify-between items-center">
                  <button onClick={() => handleDelete(p.id)}
                    className="px-3 py-1.5 bg-white border border-red-200 hover:border-red-300 hover:text-red-650 text-red-500 font-bold rounded-lg text-[10px] flex items-center gap-1 transition shadow-sm">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                  <button onClick={() => { setEditingProduct(p); setShowModal(true) }}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-200 hover:text-indigo-600 text-slate-600 font-bold rounded-lg text-[10px] flex items-center gap-1 transition shadow-sm">
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 py-6 overflow-y-auto">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-100 relative z-10 p-6 space-y-4 my-4">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition"><X className="w-4 h-4 text-slate-500" /></button>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">{editingProduct ? 'Edit Product' : 'Add Product'}</h2>
              <p className="text-xs text-slate-400 mt-0.5">Specs shown below change based on the subcategory you pick.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Row 1 — Name + SKU */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Product Name *">
                  <input required placeholder="e.g. Oxford 3-Seater Sofa" value={name} onChange={e => setName(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50" />
                </Field>
                <Field label="SKU">
                  <input disabled={!!editingProduct} required value={sku} onChange={e => setSku(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 font-mono font-bold text-slate-500 bg-slate-100 cursor-not-allowed outline-none" />
                </Field>
              </div>

              {/* Row 2 — Category + Subcategory */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category">
                  <select value={category} onChange={e => { setCategory(e.target.value); setSubcategory(SUBCATEGORY_MAP[e.target.value]?.[0] || '') }}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 font-bold text-slate-700 bg-slate-50 outline-none focus:ring-1 focus:ring-indigo-500">
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Subcategory">
                  <select value={subcategory} onChange={e => setSubcategory(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 font-bold text-slate-700 bg-slate-50 outline-none focus:ring-1 focus:ring-indigo-500">
                    {(SUBCATEGORY_MAP[category] || [subcategory]).map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
              </div>

              {/* Row 3 — Price + Total Stock */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Base Price (INR) *">
                  <input type="number" required min={0} value={basePrice} onChange={e => setBasePrice(Number(e.target.value))}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50" />
                </Field>
                <Field label="Total Available Stock *">
                  <input type="number" required min={0} value={totalStock} onChange={e => setTotalStock(Number(e.target.value))}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50" />
                </Field>
              </div>

              {/* ── COLOR VARIANTS ── */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">🎨 Color Options</label>
                  <p className="text-[9px] text-slate-400">Click colors to select/deselect them</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DEFAULT_COLORS.map(c => {
                    const active = colors.includes(c)
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleTag(colors, setColors, c)}
                        className={clsx(
                          'px-2.5 py-1 rounded-lg text-[11px] font-bold border transition',
                          active
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                        )}
                      >
                        {c}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── SMART SPEC SECTIONS — shown in 2 columns ── */}
              <div className="grid grid-cols-2 gap-3">
                {spec.sections.includes('fabric') && spec.fabricOptions.length > 0 && (
                  <TagSection label={`🪡 ${spec.fabricLabel || 'Fabric'}`} options={spec.fabricOptions} selected={fabricOptions}
                    onToggle={v => toggleTag(fabricOptions, setFabricOptions, v)} />
                )}
                {spec.sections.includes('size') && spec.sizeOptions.length > 0 && (
                  <TagSection label={`📐 ${spec.sizeLabel || 'Size'}`} options={spec.sizeOptions} selected={sizeOptions}
                    onToggle={v => toggleTag(sizeOptions, setSizeOptions, v)} />
                )}
                {spec.sections.includes('cushion_style') && spec.cushionOptions.length > 0 && (
                  <TagSection label="🛋 Cushion Style" options={spec.cushionOptions} selected={cushionStyleOptions}
                    onToggle={v => toggleTag(cushionStyleOptions, setCushionStyleOptions, v)} />
                )}
                {spec.sections.includes('wood_finish') && spec.woodFinishOptions.length > 0 && (
                  <TagSection label="🪵 Wood Finish" options={spec.woodFinishOptions} selected={woodFinishOptions}
                    onToggle={v => toggleTag(woodFinishOptions, setWoodFinishOptions, v)} />
                )}
                {spec.sections.includes('texture') && spec.textureOptions.length > 0 && (
                  <TagSection label="🖐 Texture" options={spec.textureOptions} selected={textureOptions}
                    onToggle={v => toggleTag(textureOptions, setTextureOptions, v)} />
                )}
              </div>

              {/* Product Photo Upload Section */}
              <div className="border border-indigo-150 bg-indigo-50/20 rounded-2xl p-4 space-y-3">
                <label className="block text-[10px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-indigo-500" />
                  <span>Real Product Photo (Shown to Customers)</span>
                </label>
                <div className="flex items-center gap-4">
                  {productImagePreview ? (
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-indigo-200 bg-slate-50 flex-shrink-0">
                      <img
                        src={productImagePreview.startsWith('/') ? `http://localhost:8000${productImagePreview}` : productImagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => { setProductImageFile(null); setProductImagePreview('') }}
                        className="absolute top-1 right-1 bg-red-600 hover:bg-red-750 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-black shadow-md"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-xl border-2 border-dashed border-indigo-200 bg-white flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="w-6 h-6 text-indigo-300" />
                    </div>
                  )}

                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      id="product-image-file-input"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setProductImageFile(file)
                          setProductImagePreview(URL.createObjectURL(file))
                        }
                      }}
                    />
                    <label
                      htmlFor="product-image-file-input"
                      className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-bold rounded-xl transition shadow-sm"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      {productImagePreview ? 'Replace Photo' : 'Upload Photo'}
                    </label>
                    <p className="text-[10px] text-slate-450 mt-1 font-medium">
                      Select JPG, PNG or WebP image. This real photo will show up for customization.
                    </p>
                  </div>
                </div>
              </div>

              {/* Description */}
              <Field label="Description / Specs">
                <textarea placeholder="Dimensions, warranty, material grade..." value={description}
                  onChange={e => setDescription(e.target.value)} rows={2}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 font-medium text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 resize-none bg-slate-50" />
              </Field>

              {/* Submit */}
              <div className="flex gap-2 justify-end border-t border-slate-100 pt-3">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" disabled={loading}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl transition shadow-md flex items-center gap-2">
                  {loading ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving…</> : (editingProduct ? 'Save Changes' : 'Register Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function TagSection({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
      <label className="text-[10px] font-bold text-slate-500 uppercase block">{label}</label>
      <div className="flex flex-wrap gap-1">
        {options.map(opt => (
          <button key={opt} type="button" onClick={() => onToggle(opt)}
            className={clsx('px-2.5 py-1 rounded-lg text-[11px] font-bold border transition',
              selected.includes(opt) ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600')}>
            {opt}
          </button>
        ))}
      </div>
      {selected.length > 0 && <p className="text-[9px] text-indigo-500 font-bold">✓ {selected.join(', ')}</p>}
    </div>
  )
}
