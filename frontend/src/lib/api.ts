import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

// Add token to requests if available
axiosInstance.interceptors.request.use(
  (config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Handle 401 responses
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token')
        // Optional: redirect to login or emit logout event
      }
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authAPI = {
  signup: (data: { name?: string; email?: string; phone?: string; role?: string; city?: string; furnishing_preference?: string }) =>
    axiosInstance.post('/api/v1/auth/signup', data),
  
  login: (data: { email?: string; phone?: string; role?: string }) =>
    axiosInstance.post('/api/v1/auth/login', data),
  
  verifyOtp: (data: { email?: string; phone?: string; otp: string }) =>
    axiosInstance.post('/api/v1/auth/verify-otp', data),
  
  me: () =>
    axiosInstance.get('/api/v1/auth/me'),

  updateProfile: (data: { name?: string; city?: string; style_tags?: string[]; budget_min?: number; budget_max?: number }) =>
    axiosInstance.put('/api/v1/auth/me', data),
}

// Projects API
export const projectsAPI = {
  list: () =>
    axiosInstance.get('/api/v1/projects'),
  
  create: (data: { 
    bhk_type: string; 
    property_name: string; 
    city: string; 
    budget: number;
    material_preference?: string;
    furnishing_type?: string;
    pincode?: string;
    floor_plan_type?: string;
    floor_plan_name?: string;
  }) =>
    axiosInstance.post('/api/v1/projects', data),
  
  get: (id: string) =>
    axiosInstance.get(`/api/v1/projects/${id}`),
  
  update: (id: string, data: Partial<{ title: string; bhk: string; budget_min: number; budget_max: number; package_id: string }>) =>
    axiosInstance.put(`/api/v1/projects/${id}`, data),
  
  delete: (id: string) =>
    axiosInstance.delete(`/api/v1/projects/${id}`),

  updateRoom: (projectId: string, roomId: string, data: { style_preference?: string; color_palette?: string[]; length_ft?: number; width_ft?: number; height_ft?: number }) =>
    axiosInstance.put(`/api/v1/projects/${projectId}/rooms/${roomId}`, data),

  addRoomItem: (projectId: string, roomId: string, data: { product_id: string; qty: number; custom_color?: string; custom_material?: string }) =>
    axiosInstance.post(`/api/v1/projects/${projectId}/rooms/${roomId}/items`, data),

  removeRoomItem: (projectId: string, roomId: string, itemId: string) =>
    axiosInstance.delete(`/api/v1/projects/${projectId}/rooms/${roomId}/items/${itemId}`),

  addRoom: (projectId: string, data: { room_type: string; length_ft?: number; width_ft?: number; height_ft?: number }) =>
    axiosInstance.post(`/api/v1/projects/${projectId}/rooms`, data),

  deleteRoom: (projectId: string, roomId: string) =>
    axiosInstance.delete(`/api/v1/projects/${projectId}/rooms/${roomId}`),
}

// Catalog API
export const catalogAPI = {
  packages: (params?: { bhk?: string; tier?: string; budget?: number; style?: string }) =>
    axiosInstance.get('/api/v1/catalog/packages', { params }),
  
  products: (params?: { room_type?: string; category?: string; style?: string; max_price?: number; limit?: number; skip?: number }) =>
    axiosInstance.get('/api/v1/catalog/products', { params }),

  productsByRoom: (roomType: string) =>
    axiosInstance.get(`/api/v1/catalog/products?room_type=${roomType}`),
  
  product: (id: string) =>
    axiosInstance.get(`/api/v1/catalog/products/${id}`),
}

// AI Rendering API
export const aiAPI = {
  render: (data: { room_id: string; mode?: string; style?: string; color_palette?: string[]; products?: any[] }) =>
    axiosInstance.post('/api/v1/ai/render', data),
  
  renderStatus: (jobId: string) =>
    axiosInstance.get(`/api/v1/ai/render/${jobId}`),

  roomRenders: (roomId: string) =>
    axiosInstance.get(`/api/v1/ai/renders/${roomId}`),

  // Legacy mappings
  renderProject: (projectId: string, data: { style: string }) =>
    axiosInstance.post(`/api/v1/ai/render/${projectId}`, data),
  
  getRenderStatus: (projectId: string) =>
    axiosInstance.get(`/api/v1/ai/render/${projectId}/status`),
}

// Quotations API
export const quotationsAPI = {
  generate: (projectId: string) =>
    axiosInstance.post(`/api/v1/quotations/${projectId}/generate`),
  
  get: (projectId: string) =>
    axiosInstance.get(`/api/v1/quotations/${projectId}`),
  
  download: (projectId: string) =>
    `${API_BASE_URL}/api/v1/quotations/${projectId}/download?token=${typeof window !== 'undefined' ? localStorage.getItem('access_token') : ''}`,
}

// Vendors API
export const vendorsAPI = {
  list: () =>
    axiosInstance.get('/api/v1/vendors'),
  
  byPincode: (pincode: string) =>
    axiosInstance.get(`/api/v1/vendors?pincode=${pincode}`),
}

// Recommendations API
export const recommendationsAPI = {
  packages: (params: { bhk: string; budget: number; style_tags?: string }) =>
    axiosInstance.get('/api/v1/recommendations/packages', { params }),

  getPackages: (bhk: string, budget_max: number, style?: string) =>
    axiosInstance.get('/api/v1/recommendations/packages', {
      params: { bhk, budget: budget_max, style_tags: style },
    }),
  
  getProducts: (roomType: string, style?: string, budget?: number) =>
    axiosInstance.get('/api/v1/recommendations/products', {
      params: { room_type: roomType, style_tags: style, budget },
    }),
}

// Tracking API
export const trackingAPI = {
  getMilestones: (projectId: string) =>
    axiosInstance.get(`/api/v1/tracking/${projectId}/milestones`),
  
  updateMilestone: (projectId: string, milestoneId: string, data: { status: string; photo_url?: string }) =>
    axiosInstance.put(`/api/v1/tracking/${projectId}/milestones/${milestoneId}`, data),
}

// Inquiry API
export const inquiryAPI = {
  submit: (data: { 
    name: string; 
    email: string | null; 
    phone: string | null; 
    message?: string;
    city?: string;
    bhk_type?: string;
    project_id?: string;
    quotation_id?: string;
    source?: string;
  }) =>
    axiosInstance.post('/api/v1/inquiry/submit', data),
}

// Admin API
export const adminAPI = {
  stats: () =>
    axiosInstance.get('/api/v1/admin/stats'),
  
  projects: () =>
    axiosInstance.get('/api/v1/admin/projects'),
  
  updateProjectStatus: (projectId: string, status: string) =>
    axiosInstance.put(`/api/v1/admin/projects/${projectId}/status`, { status }),
  
  users: () =>
    axiosInstance.get('/api/v1/admin/users'),
  
  inquiries: () =>
    axiosInstance.get('/api/v1/admin/inquiries'),
  
  updateInquiry: (inquiryId: string, data: { status: string }) =>
    axiosInstance.put(`/api/v1/admin/inquiries/${inquiryId}`, data),
}

// Customer Module API
export const customerAPI = {
  getFloorplans: (projectId: string) =>
    axiosInstance.get(`/api/v1/customer/projects/${projectId}/floorplans`),
  uploadFloorplan: (projectId: string, formData: FormData) =>
    axiosInstance.post(`/api/v1/customer/projects/${projectId}/floorplans`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  deleteFloorplan: (projectId: string, floorplanId: string) =>
    axiosInstance.delete(`/api/v1/customer/projects/${projectId}/floorplans/${floorplanId}`),

  getRevisions: (projectId: string) =>
    axiosInstance.get(`/api/v1/customer/projects/${projectId}/quotations/revisions`),
  requestRevision: (projectId: string, notes: string) => {
    const fd = new FormData()
    fd.append('customer_notes', notes)
    return axiosInstance.post(`/api/v1/customer/projects/${projectId}/quotations/revisions`, fd)
  },
  updateQuotationStatus: (projectId: string, quotationId: string, status: string) => {
    const fd = new FormData()
    fd.append('status', status)
    return axiosInstance.put(`/api/v1/customer/projects/${projectId}/quotations/${quotationId}/status`, fd)
  },

  getActivity: () =>
    axiosInstance.get('/api/v1/customer/activity'),

  getTracking: (projectId: string) =>
    axiosInstance.get(`/api/v1/customer/projects/${projectId}/tracking`),
  updateTracking: (projectId: string, trackingId: string, status: string, remarks?: string, actualDate?: string) => {
    const fd = new FormData()
    fd.append('status', status)
    if (remarks) fd.append('remarks', remarks)
    if (actualDate) fd.append('actual_date', actualDate)
    return axiosInstance.put(`/api/v1/customer/projects/${projectId}/tracking/${trackingId}`, fd)
  },

  getPhotos: (projectId: string) =>
    axiosInstance.get(`/api/v1/customer/projects/${projectId}/photos`),
  uploadPhoto: (projectId: string, formData: FormData) =>
    axiosInstance.post(`/api/v1/customer/projects/${projectId}/photos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  getIssues: (projectId: string) =>
    axiosInstance.get(`/api/v1/customer/projects/${projectId}/issues`),
  createIssue: (projectId: string, type: string, priority: string, description: string, itemId?: string) => {
    const fd = new FormData()
    fd.append('type', type)
    fd.append('priority', priority)
    fd.append('description', description)
    if (itemId) fd.append('item_id', itemId)
    return axiosInstance.post(`/api/v1/customer/projects/${projectId}/issues`, fd)
  },

  getTickets: () =>
    axiosInstance.get('/api/v1/customer/support/tickets'),
  createTicket: (projectId: string, subject: string, description: string) => {
    const fd = new FormData()
    fd.append('project_id', projectId)
    fd.append('subject', subject)
    fd.append('description', description)
    return axiosInstance.post('/api/v1/customer/support/tickets', fd)
  },

  getServices: () =>
    axiosInstance.get('/api/v1/customer/services'),
  createServiceRequest: (serviceType: string, requirements: string) => {
    const fd = new FormData()
    fd.append('service_type', serviceType)
    fd.append('requirements', requirements)
    return axiosInstance.post('/api/v1/customer/services', fd)
  },

  getNotifications: () =>
    axiosInstance.get('/api/v1/customer/notifications'),
  markNotificationRead: (notificationId: string) =>
    axiosInstance.patch(`/api/v1/customer/notifications/${notificationId}`),
  markAllNotificationsRead: () =>
    axiosInstance.post('/api/v1/customer/notifications/mark-all-read'),

  getStats: () =>
    axiosInstance.get('/api/v1/customer/stats'),
  getInquiries: () =>
    axiosInstance.get('/api/v1/customer/inquiries'),
  closeInquiry: (inquiryId: string) =>
    axiosInstance.put(`/api/v1/customer/inquiries/${inquiryId}/close`),
  getProjectPayments: (projectId: string) =>
    axiosInstance.get(`/api/v1/customer/projects/${projectId}/payments`),
  makeMilestonePayment: (projectId: string, milestoneName: string, amount: number) =>
    axiosInstance.post(`/api/v1/customer/projects/${projectId}/payments`, { milestoneName, amount }),
}

// Project Team API
export const teamAPI = {
  getMembers: (projectId: string) =>
    axiosInstance.get(`/api/v1/team/projects/${projectId}/team`),
  assignMember: (projectId: string, userId: string, role: string) =>
    axiosInstance.post(`/api/v1/team/projects/${projectId}/assign`, { userId, role }),
  getProgress: (projectId: string) =>
    axiosInstance.get(`/api/v1/team/projects/${projectId}/progress`),
  updateProgress: (projectId: string, progress: number, reason?: string) =>
    axiosInstance.post(`/api/v1/team/projects/${projectId}/progress`, { progress, reason }),
  getIssues: (projectId: string) =>
    axiosInstance.get(`/api/v1/team/projects/${projectId}/issues`),
  createIssue: (projectId: string, data: { type: string; priority: string; description: string; itemId?: string }) =>
    axiosInstance.post(`/api/v1/team/projects/${projectId}/issues`, data),
  getPhotos: (projectId: string) =>
    axiosInstance.get(`/api/v1/team/projects/${projectId}/photos`),
  uploadPhoto: (projectId: string, data: { roomName?: string; category: string; imageUrl: string }) =>
    axiosInstance.post(`/api/v1/team/projects/${projectId}/photos`, data),
  getDashboard: () =>
    axiosInstance.get('/api/v1/team/team/dashboard'),
  getTracking: (projectId: string) =>
    axiosInstance.get(`/api/v1/team/projects/${projectId}/tracking`),
  updateTracking: (projectId: string, trackingId: string, status: string, remarks?: string) =>
    axiosInstance.put(`/api/v1/team/projects/${projectId}/tracking/${trackingId}`, { status, remarks }),
}

// Vendor Module API
export const vendorAPI = {
  getOnboarding: () =>
    axiosInstance.get('/api/v1/vendor/onboarding'),
  register: (data: { businessName: string; ownerName: string; email: string; phone?: string; gstNumber?: string; panNumber?: string; warehouseAddress?: string; serviceLocations: string[] }) =>
    axiosInstance.post('/api/v1/vendor/onboarding', data),
  uploadDocuments: (formData: FormData) =>
    axiosInstance.put('/api/v1/vendor/onboarding', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  
  getDashboard: () =>
    axiosInstance.get('/api/v1/vendor/dashboard'),

  getProducts: () =>
    axiosInstance.get('/api/v1/vendor/products'),
  createProduct: (data: { name: string; category: string; subcategory: string; sku: string; description?: string; basePrice: number; images?: string[]; variants?: any[] }) =>
    axiosInstance.post('/api/v1/vendor/products', data),
  updateProduct: (productId: string, data: { name?: string; category?: string; subcategory?: string; description?: string; basePrice?: number; images?: string[]; availableQty?: number }) =>
    axiosInstance.put(`/api/v1/vendor/products/${productId}`, data),

  getInventory: () =>
    axiosInstance.get('/api/v1/vendor/inventory'),
  adjustInventory: (data: { productId: string; quantity: number; type: string; notes?: string }) =>
    axiosInstance.post('/api/v1/vendor/inventory', data),

  getAssignments: () =>
    axiosInstance.get('/api/v1/vendor/assignments'),
  updateAssignment: (assignmentId: string, status: string, remarks?: string) =>
    axiosInstance.patch(`/api/v1/vendor/assignments/${assignmentId}`, { status, remarks }),
  addMilestone: (assignmentId: string, formData: FormData) =>
    axiosInstance.post(`/api/v1/vendor/assignments/${assignmentId}/milestones`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  uploadProof: (assignmentId: string, formData: FormData) =>
    axiosInstance.post(`/api/v1/vendor/assignments/${assignmentId}/proof`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  getPayouts: () =>
    axiosInstance.get('/api/v1/vendor/payouts'),

  getNotifications: () =>
    axiosInstance.get('/api/v1/vendor/notifications'),
  markNotificationsRead: (notificationIds?: string[]) =>
    axiosInstance.patch('/api/v1/vendor/notifications', { notificationIds }),
}

export default axiosInstance

