'use client'

import { useEffect, useState } from 'react'
import { useVendorStore } from '@/stores/vendorStore'
import { Plus, Edit3, X, HelpCircle, Package, Layers } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function VendorProductsPage() {
  const { products, loadProducts, createProduct, updateProduct, loading } = useVendorStore()
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any | null>(null)

  // Form Fields
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Furniture')
  const [subcategory, setSubcategory] = useState('Sofas')
  const [sku, setSku] = useState('')
  const [description, setDescription] = useState('')
  const [basePrice, setBasePrice] = useState(15000)

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name || '')
      setCategory(editingProduct.category || '')
      setSubcategory(editingProduct.subcategory || '')
      setSku(editingProduct.sku || '')
      setDescription(editingProduct.description || '')
      setBasePrice(editingProduct.base_price || 0)
    } else {
      setName('')
      setCategory('Furniture')
      setSubcategory('Sofas')
      setSku(`PROD-${Math.floor(Math.random() * 900000 + 100000)}`)
      setDescription('')
      setBasePrice(15000)
    }
  }, [editingProduct, showModal])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !sku.trim()) {
      toast.error('Name and SKU are required')
      return
    }

    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, {
          name,
          category,
          subcategory,
          description,
          basePrice
        })
        toast.success('Product updated successfully! 🎉')
      } else {
        await createProduct({
          name,
          category,
          subcategory,
          sku,
          description,
          basePrice
        })
        toast.success('Product added to catalog! 🚀')
      }
      setShowModal(false)
      setEditingProduct(null)
    } catch (err: any) {
      toast.error(err.message || 'Operation failed')
    }
  }

  const formatINR = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Product Catalog</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage your registered items, pricing specs, and descriptions.</p>
        </div>
        <button
          onClick={() => {
            setEditingProduct(null)
            setShowModal(true)
          }}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-755 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition"
        >
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {loading && products.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-slate-100 rounded-2xl shadow-sm h-48 shimmer" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-100 rounded-2xl shadow-sm p-6 max-w-lg mx-auto">
          <div className="w-16 h-16 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
            <Package className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="font-extrabold text-slate-800 text-sm">No products in catalog</h3>
          <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
            Get started by registering your products. They will immediately become available in the coordinator catalog lists.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((p) => (
            <div key={p.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between hover:shadow transition card-hover">
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-base leading-tight truncate max-w-[180px]" title={p.name}>
                      {p.name}
                    </h3>
                    <span className="text-[10px] text-slate-400 font-bold block mt-1 font-mono">{p.sku}</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                    {p.category}
                  </span>
                </div>

                {p.description && <p className="text-xs text-slate-500 leading-relaxed font-medium line-clamp-2">{p.description}</p>}

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Base Price</span>
                    <span className="font-black text-slate-800 text-sm">{formatINR(p.base_price)}</span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Stock Level</span>
                    <span className={clsx(
                      'font-black text-sm block',
                      (p.inventory?.available_qty ?? 0) <= 2 ? 'text-rose-600' : 'text-slate-800'
                    )}>
                      {p.inventory?.available_qty ?? 0} units
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => {
                    setEditingProduct(p)
                    setShowModal(true)
                  }}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-200 hover:text-indigo-600 text-slate-650 font-bold rounded-lg text-[10px] flex items-center gap-1 transition shadow-sm"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Product
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Slide-over Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden relative z-10 p-6 sm:p-8 space-y-6">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {editingProduct ? 'Edit Catalog Product' : 'Add Catalog Product'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Define category and base rates for interior construction.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Product Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Premium Oak Bench"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none font-bold text-slate-700 focus:ring-1 focus:ring-indigo-500 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">SKU Code</label>
                  <input
                    type="text"
                    disabled={!!editingProduct}
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 font-mono font-bold text-slate-500 bg-slate-100 cursor-not-allowed outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 font-bold text-slate-750 bg-slate-50 outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option>Furniture</option>
                    <option>Lighting</option>
                    <option>Appliances</option>
                    <option>Decor</option>
                    <option>Flooring</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Subcategory</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sofas, Cabinets, Ceiling"
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none font-bold text-slate-700 focus:ring-1 focus:ring-indigo-500 bg-slate-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Base Price (INR)</label>
                  <input
                    type="number"
                    required
                    value={basePrice}
                    onChange={(e) => setBasePrice(Number(e.target.value))}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none font-bold text-slate-700 focus:ring-1 focus:ring-indigo-500 bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description / Specifications</label>
                <textarea
                  placeholder="Material specs, dimensions, thickness detail..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none font-medium text-slate-700 focus:ring-1 focus:ring-indigo-500 resize-none bg-slate-50"
                />
              </div>

              <div className="flex gap-2 justify-end border-t border-slate-100 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-650 hover:bg-indigo-750 text-white text-xs font-bold rounded-lg transition"
                >
                  {editingProduct ? 'Save Changes' : 'Register Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
