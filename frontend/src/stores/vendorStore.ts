import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { vendorAPI } from '@/lib/api'

interface VendorState {
  profile: any | null
  documents: any | null
  dashboard: any | null
  products: any[]
  inventory: any | null
  assignments: any[]
  payouts: any | null
  notifications: any[]
  loading: boolean
  error: string | null

  loadOnboarding: () => Promise<void>
  registerVendor: (data: {
    businessName: string
    ownerName: string
    email: string
    phone?: string
    gstNumber?: string
    panNumber?: string
    warehouseAddress?: string
    serviceLocations: string[]
  }) => Promise<any>
  uploadDocuments: (formData: FormData) => Promise<any>
  loadDashboard: () => Promise<void>
  loadProducts: () => Promise<void>
  createProduct: (data: any) => Promise<any>
  updateProduct: (productId: string, data: any) => Promise<any>
  loadInventory: () => Promise<void>
  adjustInventory: (data: { productId: string; quantity: number; type: string; notes?: string }) => Promise<void>
  loadAssignments: () => Promise<void>
  updateAssignmentStatus: (assignmentId: string, status: string, remarks?: string) => Promise<void>
  addMilestone: (assignmentId: string, formData: FormData) => Promise<void>
  uploadProof: (assignmentId: string, formData: FormData) => Promise<void>
  loadPayouts: () => Promise<void>
  loadNotifications: () => Promise<void>
  markNotificationsRead: (notificationIds?: string[]) => Promise<void>
}

export const useVendorStore = create<VendorState>()(
  persist(
    (set, get) => ({
      profile: null,
      documents: null,
      dashboard: null,
      products: [],
      inventory: null,
      assignments: [],
      payouts: null,
      notifications: [],
      loading: false,
      error: null,

      loadOnboarding: async () => {
        set({ loading: true, error: null })
        try {
          const res = await vendorAPI.getOnboarding()
          set({ profile: res.data.vendor, documents: res.data.documents, loading: false })
        } catch (err: any) {
          set({ loading: false, error: err.response?.data?.detail || 'Failed to load onboarding status' })
        }
      },

      registerVendor: async (data) => {
        set({ loading: true, error: null })
        try {
          const res = await vendorAPI.register(data)
          set({ profile: res.data, loading: false })
          return res.data
        } catch (err: any) {
          const errorMsg = err.response?.data?.detail || 'Registration failed'
          set({ loading: false, error: errorMsg })
          throw new Error(errorMsg)
        }
      },

      uploadDocuments: async (formData) => {
        set({ loading: true, error: null })
        try {
          const res = await vendorAPI.uploadDocuments(formData)
          set({ profile: { ...get().profile, status: res.data.status }, loading: false })
          await get().loadOnboarding()
          return res.data
        } catch (err: any) {
          const errorMsg = err.response?.data?.detail || 'KYC Upload failed'
          set({ loading: false, error: errorMsg })
          throw new Error(errorMsg)
        }
      },

      loadDashboard: async () => {
        set({ loading: true, error: null })
        try {
          const res = await vendorAPI.getDashboard()
          set({
            dashboard: res.data,
            profile: res.data.vendor,
            notifications: res.data.notifications,
            loading: false
          })
        } catch (err: any) {
          set({ loading: false, error: err.response?.data?.detail || 'Failed to load dashboard' })
        }
      },

      loadProducts: async () => {
        set({ loading: true, error: null })
        try {
          const res = await vendorAPI.getProducts()
          set({ products: res.data, loading: false })
        } catch (err: any) {
          set({ loading: false, error: err.response?.data?.detail || 'Failed to load products' })
        }
      },

      createProduct: async (data) => {
        set({ loading: true, error: null })
        try {
          const res = await vendorAPI.createProduct(data)
          await get().loadProducts()
          set({ loading: false })
          return res.data
        } catch (err: any) {
          const errorMsg = err.response?.data?.detail || 'Failed to create product'
          set({ loading: false, error: errorMsg })
          throw new Error(errorMsg)
        }
      },

      updateProduct: async (productId, data) => {
        set({ loading: true, error: null })
        try {
          const res = await vendorAPI.updateProduct(productId, data)
          await get().loadProducts()
          set({ loading: false })
          return res.data
        } catch (err: any) {
          const errorMsg = err.response?.data?.detail || 'Failed to update product'
          set({ loading: false, error: errorMsg })
          throw new Error(errorMsg)
        }
      },

      loadInventory: async () => {
        set({ loading: true, error: null })
        try {
          const res = await vendorAPI.getInventory()
          set({ inventory: res.data, loading: false })
        } catch (err: any) {
          set({ loading: false, error: err.response?.data?.detail || 'Failed to load inventory' })
        }
      },

      adjustInventory: async (data) => {
        set({ loading: true, error: null })
        try {
          await vendorAPI.adjustInventory(data)
          await get().loadInventory()
          set({ loading: false })
        } catch (err: any) {
          const errorMsg = err.response?.data?.detail || 'Failed to adjust stock'
          set({ loading: false, error: errorMsg })
          throw new Error(errorMsg)
        }
      },

      loadAssignments: async () => {
        set({ loading: true, error: null })
        try {
          const res = await vendorAPI.getAssignments()
          set({ assignments: res.data, loading: false })
        } catch (err: any) {
          set({ loading: false, error: err.response?.data?.detail || 'Failed to load assignments' })
        }
      },

      updateAssignmentStatus: async (assignmentId, status, remarks) => {
        set({ loading: true, error: null })
        try {
          await vendorAPI.updateAssignment(assignmentId, status, remarks)
          await get().loadAssignments()
          set({ loading: false })
        } catch (err: any) {
          const errorMsg = err.response?.data?.detail || 'Failed to update assignment status'
          set({ loading: false, error: errorMsg })
          throw new Error(errorMsg)
        }
      },

      addMilestone: async (assignmentId, formData) => {
        set({ loading: true, error: null })
        try {
          await vendorAPI.addMilestone(assignmentId, formData)
          await get().loadAssignments()
          set({ loading: false })
        } catch (err: any) {
          const errorMsg = err.response?.data?.detail || 'Failed to log fabrication progress'
          set({ loading: false, error: errorMsg })
          throw new Error(errorMsg)
        }
      },

      uploadProof: async (assignmentId, formData) => {
        set({ loading: true, error: null })
        try {
          await vendorAPI.uploadProof(assignmentId, formData)
          await get().loadAssignments()
          set({ loading: false })
        } catch (err: any) {
          const errorMsg = err.response?.data?.detail || 'Failed to upload proof image'
          set({ loading: false, error: errorMsg })
          throw new Error(errorMsg)
        }
      },

      loadPayouts: async () => {
        set({ loading: true, error: null })
        try {
          const res = await vendorAPI.getPayouts()
          set({ payouts: res.data, loading: false })
        } catch (err: any) {
          set({ loading: false, error: err.response?.data?.detail || 'Failed to load payouts' })
        }
      },

      loadNotifications: async () => {
        set({ loading: true, error: null })
        try {
          const res = await vendorAPI.getNotifications()
          set({ notifications: res.data, loading: false })
        } catch (err: any) {
          set({ loading: false, error: err.response?.data?.detail || 'Failed to load notifications' })
        }
      },

      markNotificationsRead: async (notificationIds) => {
        try {
          await vendorAPI.markNotificationsRead(notificationIds)
          const updated = get().notifications.map(n => 
            !notificationIds || notificationIds.includes(n.id) ? { ...n, isRead: true } : n
          )
          set({ notifications: updated })
        } catch (err: any) {
          console.error('Mark read failed:', err)
        }
      },
    }),
    {
      name: 'vendor-store',
      partialize: (s) => ({ profile: s.profile, documents: s.documents }),
    }
  )
)
