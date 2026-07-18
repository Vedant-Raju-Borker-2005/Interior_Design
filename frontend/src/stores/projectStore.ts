import { create } from 'zustand'

interface Room {
  id: string
  room_type: string
  length_ft: number
  width_ft: number
  height_ft: number
  style_preference?: string
  color_palette?: string[]
  items?: any[]
}

interface Project {
  id: string
  bhk_type: string
  property_name: string
  city: string
  budget: number
  status: string
  package_id?: string
  rooms?: Room[]
}

interface ProjectState {
  currentProject: Project | null
  onboarding: {
    bhk?: string
    style_tags?: string[]
    color_preferences?: string[]
    budget?: number
    timeline?: string
    city?: string
    property_name?: string
  }
  selectedPackageId?: string
  activeRoomId?: string

  setOnboarding: (data: Partial<ProjectState['onboarding']>) => void
  setCurrentProject: (p: Project) => void
  setSelectedPackage: (id: string) => void
  setActiveRoom: (id: string) => void
  updateRoom: (roomId: string, data: Partial<Room>) => void
  clearProject: () => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  currentProject: null,
  onboarding: {},
  selectedPackageId: undefined,
  activeRoomId: undefined,

  setOnboarding: (data) =>
    set((s) => ({ onboarding: { ...s.onboarding, ...data } })),

  setCurrentProject: (p) => set({ currentProject: p }),

  setSelectedPackage: (id) => set({ selectedPackageId: id }),

  setActiveRoom: (id) => set({ activeRoomId: id }),

  updateRoom: (roomId, data) =>
    set((s) => ({
      currentProject: s.currentProject
        ? {
            ...s.currentProject,
            rooms: s.currentProject.rooms?.map((r) =>
              r.id === roomId ? { ...r, ...data } : r
            ),
          }
        : null,
    })),

  clearProject: () =>
    set({
      currentProject: null,
      onboarding: {},
      selectedPackageId: undefined,
      activeRoomId: undefined,
    }),
}))
