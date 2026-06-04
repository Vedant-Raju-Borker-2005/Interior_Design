import { create } from 'zustand'
import { customerAPI } from '@/lib/api'

interface CustomerState {
  floorplans: any[]
  revisions: any[]
  activity: any[]
  tracking: any[]
  photos: any[]
  issues: any[]
  tickets: any[]
  services: any[]
  notifications: any[]
  stats: { totalInquiries: number; totalQuotations: number; activeProjects: number; totalPayments: number } | null
  inquiries: any[]
  projectPayments: any | null
  isLoading: boolean
  error: string | null

  fetchFloorplans: (projectId: string) => Promise<void>
  uploadFloorplan: (projectId: string, file: File) => Promise<void>
  deleteFloorplan: (projectId: string, floorplanId: string) => Promise<void>
  
  fetchRevisions: (projectId: string) => Promise<void>
  requestRevision: (projectId: string, notes: string) => Promise<void>
  updateQuotationStatus: (projectId: string, quotationId: string, status: string) => Promise<any>
  
  fetchActivity: () => Promise<void>
  
  fetchTracking: (projectId: string) => Promise<void>
  updateTracking: (projectId: string, trackingId: string, status: string, remarks?: string, actualDate?: string) => Promise<void>
  
  fetchPhotos: (projectId: string) => Promise<void>
  uploadPhoto: (projectId: string, roomName: string, caption?: string, file?: File) => Promise<void>
  
  fetchIssues: (projectId: string) => Promise<void>
  createIssue: (projectId: string, data: { type: string; priority: string; description: string; itemId?: string }) => Promise<void>
  
  fetchTickets: () => Promise<void>
  createTicket: (projectId: string, subject: string, description: string) => Promise<void>
  
  fetchServices: () => Promise<void>
  createServiceRequest: (serviceType: string, requirements: string) => Promise<void>
  
  fetchNotifications: () => Promise<void>
  markNotificationRead: (notificationId: string) => Promise<void>
  markAllNotificationsRead: () => Promise<void>
  fetchStats: () => Promise<void>
  fetchInquiries: () => Promise<void>
  closeInquiry: (inquiryId: string) => Promise<void>
  fetchProjectPayments: (projectId: string) => Promise<void>
  payMilestone: (projectId: string, milestoneName: string, amount: number) => Promise<void>
  clearError: () => void
}

export const useCustomerStore = create<CustomerState>((set, get) => ({
  floorplans: [],
  revisions: [],
  activity: [],
  tracking: [],
  photos: [],
  issues: [],
  tickets: [],
  services: [],
  notifications: [],
  stats: null,
  inquiries: [],
  projectPayments: null,
  isLoading: false,
  error: null,

  fetchFloorplans: async (projectId) => {
    set({ isLoading: true, error: null })
    try {
      const res = await customerAPI.getFloorplans(projectId)
      set({ floorplans: res.data, isLoading: false })
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Failed to load floor plans', isLoading: false })
    }
  },

  uploadFloorplan: async (projectId, file) => {
    set({ isLoading: true, error: null })
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await customerAPI.uploadFloorplan(projectId, fd)
      set((s) => ({ floorplans: [...s.floorplans, res.data], isLoading: false }))
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Failed to upload floor plan', isLoading: false })
      throw e
    }
  },

  deleteFloorplan: async (projectId, floorplanId) => {
    set({ isLoading: true, error: null })
    try {
      await customerAPI.deleteFloorplan(projectId, floorplanId)
      set((s) => ({
        floorplans: s.floorplans.filter((f) => f.id !== floorplanId),
        isLoading: false,
      }))
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Failed to delete floor plan', isLoading: false })
    }
  },

  fetchRevisions: async (projectId) => {
    set({ isLoading: true, error: null })
    try {
      const res = await customerAPI.getRevisions(projectId)
      set({ revisions: res.data, isLoading: false })
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Failed to load revisions', isLoading: false })
    }
  },

  requestRevision: async (projectId, notes) => {
    set({ isLoading: true, error: null })
    try {
      const res = await customerAPI.requestRevision(projectId, notes)
      set((s) => ({ revisions: [res.data, ...s.revisions], isLoading: false }))
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Failed to request revision', isLoading: false })
      throw e
    }
  },

  updateQuotationStatus: async (projectId, quotationId, status) => {
    set({ isLoading: true, error: null })
    try {
      const res = await customerAPI.updateQuotationStatus(projectId, quotationId, status)
      set({ isLoading: false })
      return res.data
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Failed to update quote status', isLoading: false })
      throw e
    }
  },

  fetchActivity: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await customerAPI.getActivity()
      set({ activity: res.data, isLoading: false })
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Failed to load activity logs', isLoading: false })
    }
  },

  fetchTracking: async (projectId) => {
    set({ isLoading: true, error: null })
    try {
      const res = await customerAPI.getTracking(projectId)
      set({ tracking: res.data, isLoading: false })
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Failed to load project tracking details', isLoading: false })
    }
  },

  updateTracking: async (projectId, trackingId, status, remarks, actualDate) => {
    set({ isLoading: true, error: null })
    try {
      const res = await customerAPI.updateTracking(projectId, trackingId, status, remarks, actualDate)
      set((s) => ({
        tracking: s.tracking.map((t) => (t.id === trackingId ? res.data : t)),
        isLoading: false,
      }))
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Failed to update item tracking', isLoading: false })
    }
  },

  fetchPhotos: async (projectId) => {
    set({ isLoading: true, error: null })
    try {
      const res = await customerAPI.getPhotos(projectId)
      set({ photos: res.data, isLoading: false })
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Failed to load project photos', isLoading: false })
    }
  },

  uploadPhoto: async (projectId, roomName, caption, file) => {
    set({ isLoading: true, error: null })
    try {
      const fd = new FormData()
      fd.append('room_name', roomName)
      if (caption) fd.append('caption', caption)
      if (file) fd.append('file', file)
      const res = await customerAPI.uploadPhoto(projectId, fd)
      set((s) => ({ photos: [res.data, ...s.photos], isLoading: false }))
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Failed to upload photo', isLoading: false })
      throw e
    }
  },

  fetchIssues: async (projectId) => {
    set({ isLoading: true, error: null })
    try {
      const res = await customerAPI.getIssues(projectId)
      set({ issues: res.data, isLoading: false })
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Failed to load issues', isLoading: false })
    }
  },

  createIssue: async (projectId, data) => {
    set({ isLoading: true, error: null })
    try {
      const res = await customerAPI.createIssue(projectId, data.type, data.priority, data.description, data.itemId)
      set((s) => ({ issues: [res.data, ...s.issues], isLoading: false }))
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Failed to create issue', isLoading: false })
      throw e
    }
  },

  fetchTickets: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await customerAPI.getTickets()
      set({ tickets: res.data, isLoading: false })
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Failed to load support tickets', isLoading: false })
    }
  },

  createTicket: async (projectId, subject, description) => {
    set({ isLoading: true, error: null })
    try {
      const res = await customerAPI.createTicket(projectId, subject, description)
      set((s) => ({ tickets: [res.data, ...s.tickets], isLoading: false }))
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Failed to submit support ticket', isLoading: false })
      throw e
    }
  },

  fetchServices: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await customerAPI.getServices()
      set({ services: res.data, isLoading: false })
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Failed to load service requests', isLoading: false })
    }
  },

  createServiceRequest: async (serviceType, requirements) => {
    set({ isLoading: true, error: null })
    try {
      const res = await customerAPI.createServiceRequest(serviceType, requirements)
      set((s) => ({ services: [res.data, ...s.services], isLoading: false }))
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Failed to create service request', isLoading: false })
      throw e
    }
  },

  fetchNotifications: async () => {
    try {
      const res = await customerAPI.getNotifications()
      set({ notifications: res.data })
    } catch (e: any) {}
  },

  markNotificationRead: async (notificationId) => {
    try {
      await customerAPI.markNotificationRead(notificationId)
      set((s) => ({
        notifications: s.notifications.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      }))
    } catch (e: any) {}
  },

  markAllNotificationsRead: async () => {
    try {
      await customerAPI.markAllNotificationsRead()
      set((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, read: true })),
      }))
    } catch (e: any) {}
  },

  fetchStats: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await customerAPI.getStats()
      set({ stats: res.data, isLoading: false })
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Failed to load stats', isLoading: false })
    }
  },

  fetchInquiries: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await customerAPI.getInquiries()
      set({ inquiries: res.data, isLoading: false })
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Failed to load inquiries', isLoading: false })
    }
  },

  closeInquiry: async (inquiryId) => {
    set({ isLoading: true, error: null })
    try {
      await customerAPI.closeInquiry(inquiryId)
      set((s) => ({
        inquiries: s.inquiries.map((i) => i.id === inquiryId ? { ...i, status: 'closed' } : i),
        isLoading: false
      }))
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Failed to close inquiry', isLoading: false })
      throw e
    }
  },

  fetchProjectPayments: async (projectId) => {
    set({ isLoading: true, error: null })
    try {
      const res = await customerAPI.getProjectPayments(projectId)
      set({ projectPayments: res.data, isLoading: false })
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Failed to load payments', isLoading: false })
    }
  },

  payMilestone: async (projectId, milestoneName, amount) => {
    set({ isLoading: true, error: null })
    try {
      await customerAPI.makeMilestonePayment(projectId, milestoneName, amount)
      await get().fetchProjectPayments(projectId)
      set({ isLoading: false })
    } catch (e: any) {
      const errorMsg = e.response?.data?.detail || 'Payment failed'
      set({ error: errorMsg, isLoading: false })
      throw new Error(errorMsg)
    }
  },

  clearError: () => set({ error: null }),
}))
