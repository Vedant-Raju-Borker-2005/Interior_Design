import { create } from 'zustand'
import { teamAPI } from '@/lib/api'

export interface TeamMember {
  id: string
  role: 'MANAGER' | 'COORDINATOR' | 'TECHNICIAN'
  status: 'ACTIVE' | 'ON_LEAVE' | 'REMOVED'
  user: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  }
}

export interface ExecutionIssue {
  id: string
  projectId: string
  itemId?: string | null
  type:
    | 'VENDOR_DELAY'
    | 'DAMAGED_PRODUCT'
    | 'WRONG_PRODUCT'
    | 'MISSING_ITEM'
    | 'INSTALLATION_PROBLEM'
    | 'CUSTOMER_COMPLAINT'
    | 'OTHER'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'ESCALATED' | 'RESOLVED' | 'CLOSED'
  description: string
  resolution?: string | null
  resolvedAt?: string | null
  createdBy: {
    id: string
    name: string
    email: string
  }
}

export interface ExecutionPhoto {
  id: string
  projectId: string
  roomName?: string | null
  category:
    | 'SITE_VISIT'
    | 'PRODUCTION_CHECK'
    | 'DELIVERY'
    | 'INSTALLATION'
    | 'FINAL_HANDOVER'
  imageUrl: string
  uploadedBy: string
  createdAt: string
}

interface ProjectTeamState {
  members: TeamMember[]
  progress: number
  issues: ExecutionIssue[]
  photos: ExecutionPhoto[]
  dashboard: any | null
  tracking: any[]
  isLoading: boolean
  error: string | null

  fetchMembers: (projectId: string) => Promise<void>
  assignMember: (projectId: string, userId: string, role: string) => Promise<void>
  fetchProgress: (projectId: string) => Promise<void>
  updateProgress: (projectId: string, progress: number, reason?: string) => Promise<void>
  fetchIssues: (projectId: string) => Promise<void>
  createIssue: (
    projectId: string,
    data: { type: string; priority: string; description: string; itemId?: string }
  ) => Promise<void>
  fetchPhotos: (projectId: string) => Promise<void>
  uploadPhoto: (
    projectId: string,
    data: { roomName?: string; category: string; imageUrl: string }
  ) => Promise<void>
  fetchDashboard: () => Promise<void>
  fetchTracking: (projectId: string) => Promise<void>
  updateTracking: (projectId: string, trackingId: string, status: string, remarks?: string) => Promise<void>
  clearError: () => void
}

export const useProjectTeamStore = create<ProjectTeamState>((set, get) => ({
  members: [],
  progress: 0,
  issues: [],
  photos: [],
  dashboard: null,
  tracking: [],
  isLoading: false,
  error: null,

  fetchMembers: async (projectId) => {
    set({ isLoading: true })
    try {
      const res = await teamAPI.getMembers(projectId)
      set({ members: res.data, isLoading: false })
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Failed to load team', isLoading: false })
    }
  },

  assignMember: async (projectId, userId, role) => {
    set({ isLoading: true })
    try {
      const res = await teamAPI.assignMember(projectId, userId, role)
      set((state) => ({
        members: [...state.members.filter((m) => m.user.id !== userId), res.data],
        isLoading: false,
      }))
    } catch (e: any) {
      const errorMsg = e.response?.data?.detail || 'Assignment failed'
      set({ error: errorMsg, isLoading: false })
      throw new Error(errorMsg)
    }
  },

  fetchProgress: async (projectId) => {
    try {
      const res = await teamAPI.getProgress(projectId)
      set({ progress: res.data.progress })
    } catch (e) {}
  },

  updateProgress: async (projectId, progress, reason) => {
    try {
      await teamAPI.updateProgress(projectId, progress, reason)
      set({ progress })
    } catch (e) {}
  },

  fetchIssues: async (projectId) => {
    try {
      const res = await teamAPI.getIssues(projectId)
      set({ issues: res.data })
    } catch (e) {}
  },

  createIssue: async (projectId, data) => {
    try {
      const res = await teamAPI.createIssue(projectId, data)
      set((state) => ({ issues: [res.data, ...state.issues] }))
    } catch (e: any) {
      const errorMsg = e.response?.data?.detail || 'Failed to log issue'
      set({ error: errorMsg })
      throw new Error(errorMsg)
    }
  },

  fetchPhotos: async (projectId) => {
    try {
      const res = await teamAPI.getPhotos(projectId)
      set({ photos: res.data })
    } catch (e) {}
  },

  uploadPhoto: async (projectId, data) => {
    try {
      const res = await teamAPI.uploadPhoto(projectId, data)
      set((state) => ({ photos: [res.data, ...state.photos] }))
    } catch (e: any) {
      const errorMsg = e.response?.data?.detail || 'Failed to upload photo'
      set({ error: errorMsg })
      throw new Error(errorMsg)
    }
  },

  fetchDashboard: async () => {
    set({ isLoading: true })
    try {
      const res = await teamAPI.getDashboard()
      set({ dashboard: res.data, isLoading: false })
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Failed to load dashboard', isLoading: false })
    }
  },

  fetchTracking: async (projectId) => {
    set({ isLoading: true })
    try {
      const res = await teamAPI.getTracking(projectId)
      set({ tracking: res.data, isLoading: false })
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Failed to load tracking items', isLoading: false })
    }
  },

  updateTracking: async (projectId, trackingId, status, remarks) => {
    set({ isLoading: true })
    try {
      const res = await teamAPI.updateTracking(projectId, trackingId, status, remarks)
      set((state) => ({
        tracking: state.tracking.map((t) => (t.id === trackingId ? res.data : t)),
        isLoading: false,
      }))
      await get().fetchProgress(projectId)
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Failed to update tracking item', isLoading: false })
      throw e
    }
  },

  clearError: () => set({ error: null }),
}))
