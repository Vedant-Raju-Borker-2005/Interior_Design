'use client'

import { useEffect, useState } from 'react'
import { useVendorStore } from '@/stores/vendorStore'
import { availabilityAPI } from '@/lib/api'
import {
  AlertTriangle,
  Plus,
  ArrowDown,
  ArrowUp,
  RefreshCw,
  Layers,
  History,
  Clipboard,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Package,
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function VendorInventoryPage() {
  const { inventory, products, loadInventory, loadProducts, adjustInventory, loading } = useVendorStore()

  // Form states
  const [selectedProductId, setSelectedProductId] = useState('')
  const [quantity, setQuantity] = useState(5)
  const [txnType, setTxnType] = useState('ADDED')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadInventory()
    loadProducts()
  }, [])

  useEffect(() => {
    if (products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].id)
    }
  }, [products])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProductId || quantity <= 0) {
      toast.error('Please select a product and enter a valid quantity')
      return
    }
    setSubmitting(true)
    try {
      await adjustInventory({
        productId: selectedProductId,
        quantity,
        type: txnType,
        notes: notes || `Manual stock ${txnType.toLowerCase()} via panel`,
      })
      toast.success('Stock adjusted successfully! 📦')
      setNotes('')
      await loadProducts()
    } catch (err: any) {
      toast.error(err.message || 'Failed to adjust stock')
    } finally {
      setSubmitting(false)
    }
  }

  const handleQuickAdd = async (productId: string, qty: number = 5) => {
    try {
      await adjustInventory({
        productId,
        quantity: qty,
        type: 'ADDED',
        notes: `Quick replenishment (+${qty} units)`,
      })
      toast.success(`Added ${qty} units to stock! 📦`)
      await loadProducts()
    } catch (err: any) {
      toast.error(err.message || 'Failed to add stock')
    }
  }

  const handleToggleAvailability = async (productId: string, currentAvailable: boolean, name: string) => {
    setTogglingId(productId)
    try {
      const makeAvailable = !currentAvailable
      let reason: string | undefined = undefined
      if (!makeAvailable) {
        reason = window.prompt(`Why is "${name}" unavailable? (e.g. Out of stock, factory maintenance)`) ?? 'Supplier Out of Stock'
      }
      await availabilityAPI.setVendorProduct(productId, {
        is_available: makeAvailable,
        reason,
      })
      toast.success(makeAvailable ? `${name} is live in marketplace! 🟢` : `${name} hidden from marketplace. 🔴`)
      await loadInventory()
      await loadProducts()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to toggle availability')
    } finally {
      setTogglingId(null)
    }
  }

  // Calculate inventory card summaries
  const totalAvailable = inventory?.inventory?.reduce((acc: number, item: any) => acc + item.availableQty, 0) ?? 0
  const totalReserved = inventory?.inventory?.reduce((acc: number, item: any) => acc + item.reservedQty, 0) ?? 0
  const totalIncoming = inventory?.inventory?.reduce((acc: number, item: any) => acc + item.incomingQty, 0) ?? 0

  // Combine inventory records with product details
  const inventoryItems = (inventory?.inventory || []).map((inv: any) => {
    const prod = products.find((p) => p.id === inv.productId)
    const isAvailable = prod?.isAvailable !== false && inv.availableQty > 0
    return {
      ...inv,
      product: prod,
      isAvailable,
      rawProductAvailable: prod?.isAvailable !== false,
      unavailableReason: prod?.unavailableReason || (inv.availableQty <= 0 ? 'Out of Stock' : null),
    }
  })

  const filteredItems = inventoryItems.filter((item: any) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (item.productName || '').toLowerCase().includes(q) ||
      (item.sku || '').toLowerCase().includes(q) ||
      (item.product?.category || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Inventory Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time warehouse stock ledger, reservation locking, and instant marketplace availability.
          </p>
        </div>
      </div>

      {/* Stock Levels KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Available Stock', value: totalAvailable, color: 'text-indigo-600 bg-white border-slate-100', desc: 'Active & available for fresh orders' },
          { label: 'Reserved Items', value: totalReserved, color: 'text-amber-600 bg-white border-slate-100', desc: 'Locked for active customer quotations' },
          { label: 'Incoming Sourcing', value: totalIncoming, color: 'text-slate-850 bg-white border-slate-100', desc: 'Pre-ordered from manufacturers' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm relative overflow-hidden">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">{card.label}</span>
            <span className={clsx('text-2.5xl font-black block', card.color)}>{card.value} units</span>
            <span className="text-[10px] text-slate-400 font-medium block mt-1">{card.desc}</span>
          </div>
        ))}
      </div>

      {/* Low stock alert callout */}
      {inventory?.lowStockAlerts && inventory.lowStockAlerts.length > 0 && (
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex gap-3 text-xs text-rose-900 leading-relaxed font-semibold">
          <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-extrabold block text-rose-950 mb-0.5">Low Stock Warnings:</span>
            The following products have dropped below the safety margin (5 units):{' '}
            <span className="underline">
              {inventory.lowStockAlerts.map((a: any) => `${a.productName} (${a.availableQty} left)`).join(', ')}
            </span>
          </div>
        </div>
      )}

      {/* Real-Time Warehouse Stock Ledger Table */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider flex items-center gap-1.5">
              <Package className="w-4 h-4 text-indigo-500" /> Warehouse Inventory Stock Ledger
            </h2>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Products with 0 stock or marked unavailable are automatically suppressed from the customer catalog.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by product name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 font-medium"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                <th className="py-2.5 px-3">Product / SKU</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-center">Available Stock</th>
                <th className="py-2.5 px-3 text-center">Reserved Stock</th>
                <th className="py-2.5 px-3 text-center">Marketplace Status</th>
                <th className="py-2.5 px-3 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredItems.map((item: any) => {
                const isOutOfStock = item.availableQty <= 0
                const isLowStock = item.availableQty > 0 && item.availableQty < 5
                const isSuppressed = !item.rawProductAvailable || isOutOfStock

                return (
                  <tr key={item.productId} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-3">
                      <div className="font-extrabold text-slate-800 text-xs">{item.productName}</div>
                      <span className="text-[10px] font-mono text-slate-400 font-semibold">{item.sku}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] font-bold text-slate-600 px-2 py-0.5 bg-slate-100 rounded-md">
                        {item.product?.subcategory || item.product?.category || 'Furniture'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <span
                          className={clsx(
                            'text-xs font-black px-2 py-0.5 rounded-full border',
                            isOutOfStock
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : isLowStock
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          )}
                        >
                          {item.availableQty} units
                        </span>
                        {isOutOfStock && <span className="text-[9px] font-bold text-rose-600 block">Out of Stock</span>}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="text-xs font-bold text-slate-600">
                        {item.reservedQty} units
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {isSuppressed ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3 h-3 text-rose-500" />
                          {item.unavailableReason || 'Suppressed'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          Marketplace Live
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleQuickAdd(item.productId, 5)}
                          className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                          title="Quickly add 5 units"
                        >
                          <Plus className="w-3 h-3" /> +5
                        </button>
                        <button
                          type="button"
                          disabled={togglingId === item.productId}
                          onClick={() => handleToggleAvailability(item.productId, item.rawProductAvailable, item.productName)}
                          className={clsx(
                            'px-2 py-1 border rounded-lg text-[10px] font-bold transition flex items-center gap-1',
                            item.rawProductAvailable
                              ? 'bg-white border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-200'
                              : 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                          )}
                          title={item.rawProductAvailable ? 'Hide from customer catalog' : 'Make live in customer catalog'}
                        >
                          {item.rawProductAvailable ? (
                            <>
                              <EyeOff className="w-3 h-3 text-slate-400" /> Hide
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3" /> Make Live
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProductId(item.productId)
                            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
                          }}
                          className="px-2 py-1 bg-white border border-slate-200 hover:border-indigo-300 text-slate-600 text-[10px] font-bold rounded-lg transition"
                        >
                          Adjust
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400 font-semibold text-xs">
                    No products matched your inventory search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Adjustment Log Form */}
        <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-6 self-start">
          <div>
            <h2 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider flex items-center gap-1.5">
              <Clipboard className="w-4 h-4 text-indigo-500" /> Log Stock Adjustment
            </h2>
            <p className="text-[10px] text-slate-400 mt-1">Submit manual warehouse updates for SKU catalog listings.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select Catalog Product</label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg p-2.5 font-bold text-slate-700 bg-white outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Quantity</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Action Type</label>
                <select
                  value={txnType}
                  onChange={(e) => setTxnType(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 font-bold text-slate-750 bg-white outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="ADDED">Add Stock</option>
                  <option value="RESERVED">Reserve Stock</option>
                  <option value="RELEASED">Release Reserved</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Transaction Notes</label>
              <textarea
                placeholder="Remarks e.g., Received batch from assembly line..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full text-xs border border-slate-200 rounded-lg p-2.5 outline-none font-medium text-slate-700 focus:ring-1 focus:ring-indigo-500 resize-none bg-slate-50"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-755 disabled:bg-indigo-400 text-white text-xs font-bold rounded-xl shadow-glow-indigo flex items-center justify-center gap-1.5 transition"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', submitting && 'animate-spin')} />
              {submitting ? 'Updating...' : 'Post Adjustment'}
            </button>
          </form>
        </div>

        {/* History log Timeline */}
        <div className="lg:col-span-2 bg-white border border-slate-100 p-6 rounded-2xl shadow-sm space-y-4">
          <h2 className="text-sm font-extrabold text-slate-850 uppercase tracking-wider border-b border-slate-50 pb-3 flex items-center gap-1.5">
            <History className="w-4 h-4 text-indigo-500" /> Sourcing Transactions History
          </h2>

          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {inventory?.transactions?.map((tx: any) => (
              <div key={tx.id} className="p-4 border border-slate-100 rounded-xl bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-semibold">
                <div className="space-y-1">
                  <div className="font-bold text-slate-800">{tx.productName}</div>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-medium">{tx.notes}</p>
                  <p className="text-[9px] text-slate-400 font-medium">Logged: {new Date(tx.createdAt).toLocaleString()}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={clsx(
                    'px-2.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider block w-fit ml-auto mb-1',
                    tx.type === 'ADDED' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                    tx.type === 'RESERVED' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                    'bg-slate-100 text-slate-600 border-slate-200'
                  )}>
                    {tx.type}
                  </span>
                  <span className="font-extrabold text-slate-800">{tx.quantity} units</span>
                </div>
              </div>
            ))}

            {(!inventory?.transactions || inventory.transactions.length === 0) && (
              <div className="text-center py-12 text-slate-400 font-semibold text-xs">
                No recent transaction logs available.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
