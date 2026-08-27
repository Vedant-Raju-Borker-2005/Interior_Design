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
  projectDetail: any | null
  customerDetail: any | null
  vendorDetail: any[]
  tasks: any[]
  checklists: any[]
  siteVisits: any[]
  comms: any[]
  documents: any[]
  analytics: any | null
  comments: Record<string, any[]> // threaded by issueId
  assignmentHistory: any[]
  trackingHistory: Record<string, any[]> // threaded by trackingId
  projects: any[]
  teamDirectory: any[]
  teamDirectoryError: string | null
  isLoading: boolean
  error: string | null

  fetchProjects: () => Promise<void>
  fetchTeamDirectory: () => Promise<void>
  fetchMembers: (projectId: string) => Promise<void>
  assignMember: (projectId: string, userId: string, role: string) => Promise<void>
  removeMember: (projectId: string, userId: string, role: string) => Promise<void>
  fetchAssignmentHistory: (projectId: string) => Promise<void>
  assignItemTechnician: (projectId: string, itemId: string, technicianId: string) => Promise<void>
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
    data: FormData
  ) => Promise<void>
  fetchDashboard: () => Promise<void>
  fetchTracking: (projectId: string) => Promise<void>
  updateTracking: (projectId: string, trackingId: string, status: string, remarks?: string) => Promise<void>
  fetchTrackingHistory: (projectId: string, trackingId: string) => Promise<void>
  fetchTasks: (projectId: string) => Promise<void>
  createTask: (projectId: string, data: any) => Promise<void>
  updateTask: (projectId: string, taskId: string, data: any) => Promise<void>
  deleteTask: (projectId: string, taskId: string) => Promise<void>
  fetchChecklists: (projectId: string) => Promise<void>
  createChecklist: (projectId: string, data: any) => Promise<void>
  toggleChecklistItem: (projectId: string, itemId: string, isCompleted: boolean) => Promise<void>
  fetchSiteVisits: (projectId: string) => Promise<void>
  scheduleSiteVisit: (projectId: string, data: any) => Promise<void>
  updateSiteVisit: (projectId: string, visitId: string, data: any) => Promise<void>
  fetchComms: (projectId: string) => Promise<void>
  createComm: (projectId: string, data: any) => Promise<void>
  fetchDocuments: (projectId: string) => Promise<void>
  uploadDocument: (projectId: string, title: string, type: string, file: File) => Promise<void>
  deleteDocument: (projectId: string, documentId: string) => Promise<void>
  fetchAnalytics: (projectId: string) => Promise<void>
  fetchIssueComments: (issueId: string) => Promise<void>
  createIssueComment: (issueId: string, comment: string) => Promise<void>
  escalateIssue: (issueId: string) => Promise<void>
  resolveIssue: (issueId: string, resolution: string) => Promise<void>
  clearError: () => void
}

export const useProjectTeamStore = create<ProjectTeamState>((set, get) => ({
  members: [],
  progress: 0,
  issues: [],
  photos: [],
  dashboard: null,
  tracking: [],
  projectDetail: null,
  customerDetail: null,
  vendorDetail: [],
  tasks: [],
  checklists: [],
  siteVisits: [],
  comms: [],
  documents: [],
  analytics: null,
  comments: {},
  assignmentHistory: [],
  trackingHistory: {},
  projects: [],
  teamDirectory: [],
  teamDirectoryError: null,
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

  removeMember: async (projectId, userId, role) => {
    set({ isLoading: true })
    try {
      await teamAPI.removeMember(projectId, userId, role)
      set((state) => ({
        members: state.members.filter((m) => !(m.user.id === userId && m.role === role)),
        isLoading: false
      }))
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Failed to remove member', isLoading: false })
    }
  },

  fetchAssignmentHistory: async (projectId) => {
    try {
      const res = await teamAPI.getAssignmentHistory(projectId)
      set({ assignmentHistory: res.data })
    } catch (e) {}
  },

  assignItemTechnician: async (projectId, itemId, technicianId) => {
    try {
      await teamAPI.assignItemTechnician(projectId, itemId, technicianId)
    } catch (e: any) {
      throw new Error(e.response?.data?.detail || 'Item assignment failed')
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

  fetchProjects: async () => {
    set({ isLoading: true })
    try {
      const res = await teamAPI.getProjects()
      set({ projects: res.data, isLoading: false })
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Failed to load projects list', isLoading: false })
    }
  },

  fetchTeamDirectory: async () => {
    try {
      const res = await teamAPI.getDirectory()
      console.log('[TeamDirectory] API response:', res.data)
      set({ teamDirectory: res.data, teamDirectoryError: null })
    } catch (e: any) {
      const errMsg = e.response?.data?.detail || e.message || 'Failed to load team directory'
      console.error('[TeamDirectory] Error:', errMsg, e.response?.status)
      // Use separate state so it doesn't pollute the global error banner
      set({ teamDirectoryError: errMsg })
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
      if (res.data && typeof res.data === 'object' && 'trackings' in res.data) {
        set({
          tracking: res.data.trackings,
          projectDetail: res.data.project,
          customerDetail: res.data.customer,
          vendorDetail: res.data.vendors,
          isLoading: false
        })
      } else {
        set({ tracking: res.data, isLoading: false })
      }
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

  fetchTrackingHistory: async (projectId, trackingId) => {
    try {
      const res = await teamAPI.getTrackingHistory(projectId, trackingId)
      set((state) => ({
        trackingHistory: {
          ...state.trackingHistory,
          [trackingId]: res.data
        }
      }))
    } catch (e) {}
  },

  fetchTasks: async (projectId) => {
    try {
      const res = await teamAPI.getTasks(projectId)
      set({ tasks: res.data })
    } catch (e) {}
  },

  createTask: async (projectId, data) => {
    try {
      await teamAPI.createTask(projectId, data)
      await get().fetchTasks(projectId)
    } catch (e: any) {
      throw new Error(e.response?.data?.detail || 'Failed to create task')
    }
  },

  updateTask: async (projectId, taskId, data) => {
    try {
      await teamAPI.updateTask(projectId, taskId, data)
      await get().fetchTasks(projectId)
    } catch (e: any) {
      throw new Error(e.response?.data?.detail || 'Failed to update task')
    }
  },

  deleteTask: async (projectId, taskId) => {
    try {
      await teamAPI.deleteTask(projectId, taskId)
      await get().fetchTasks(projectId)
    } catch (e: any) {
      throw new Error(e.response?.data?.detail || 'Failed to delete task')
    }
  },

  fetchChecklists: async (projectId) => {
    try {
      const res = await teamAPI.getChecklists(projectId)
      set({ checklists: res.data })
    } catch (e) {}
  },

  createChecklist: async (projectId, data) => {
    try {
      await teamAPI.createChecklist(projectId, data)
      await get().fetchChecklists(projectId)
    } catch (e: any) {
      throw new Error(e.response?.data?.detail || 'Failed to create checklist')
    }
  },

  toggleChecklistItem: async (projectId, itemId, isCompleted) => {
    try {
      await teamAPI.toggleChecklistItem(projectId, itemId, isCompleted)
      await get().fetchChecklists(projectId)
    } catch (e) {}
  },

  fetchSiteVisits: async (projectId) => {
    try {
      const res = await teamAPI.getSiteVisits(projectId)
      set({ siteVisits: res.data })
    } catch (e) {}
  },

  scheduleSiteVisit: async (projectId, data) => {
    try {
      await teamAPI.scheduleSiteVisit(projectId, data)
      await get().fetchSiteVisits(projectId)
    } catch (e: any) {
      throw new Error(e.response?.data?.detail || 'Failed to schedule site visit')
    }
  },

  updateSiteVisit: async (projectId, visitId, data) => {
    try {
      await teamAPI.updateSiteVisit(projectId, visitId, data)
      await get().fetchSiteVisits(projectId)
    } catch (e: any) {
      throw new Error(e.response?.data?.detail || 'Failed to update site visit')
    }
  },

  fetchComms: async (projectId) => {
    try {
      const res = await teamAPI.getComms(projectId)
      set({ comms: res.data })
    } catch (e) {}
  },

  createComm: async (projectId, data) => {
    try {
      await teamAPI.createComm(projectId, data)
      await get().fetchComms(projectId)
    } catch (e: any) {
      throw new Error(e.response?.data?.detail || 'Failed to log communication')
    }
  },

  fetchDocuments: async (projectId) => {
    try {
      const res = await teamAPI.getDocuments(projectId)
      set({ documents: res.data })
    } catch (e) {}
  },

  uploadDocument: async (projectId, title, type, file) => {
    try {
      await teamAPI.uploadDocument(projectId, title, type, file)
      await get().fetchDocuments(projectId)
    } catch (e: any) {
      throw new Error(e.response?.data?.detail || 'Failed to upload document')
    }
  },

  deleteDocument: async (projectId, documentId) => {
    try {
      await teamAPI.deleteDocument(projectId, documentId)
      await get().fetchDocuments(projectId)
    } catch (e: any) {
      throw new Error(e.response?.data?.detail || 'Failed to delete document')
    }
  },

  fetchAnalytics: async (projectId) => {
    try {
      const res = await teamAPI.getAnalytics(projectId)
      set({ analytics: res.data })
    } catch (e) {}
  },

  fetchIssueComments: async (issueId) => {
    try {
      const res = await teamAPI.getIssueComments(issueId)
      set((state) => ({
        comments: {
          ...state.comments,
          [issueId]: res.data
        }
      }))
    } catch (e) {}
  },

  createIssueComment: async (issueId, comment) => {
    try {
      await teamAPI.createIssueComment(issueId, comment)
      await get().fetchIssueComments(issueId)
    } catch (e: any) {
      throw new Error(e.response?.data?.detail || 'Failed to post comment')
    }
  },

  escalateIssue: async (issueId) => {
    try {
      await teamAPI.escalateIssue(issueId)
    } catch (e: any) {
      throw new Error(e.response?.data?.detail || 'Failed to escalate issue')
    }
  },

  resolveIssue: async (issueId, resolution) => {
    try {
      await teamAPI.resolveIssue(issueId, resolution)
    } catch (e: any) {
      throw new Error(e.response?.data?.detail || 'Failed to resolve issue')
    }
  },

  clearError: () => set({ error: null }),
}))
