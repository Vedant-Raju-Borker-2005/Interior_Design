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
  signup: (data: { name?: string; email?: string; phone?: string; city?: string; furnishing_preference?: string; role?: string }) =>
    axiosInstance.post('/api/v1/auth/signup', data),
  
  login: (data: { email?: string; phone?: string; role?: string }) =>
    axiosInstance.post('/api/v1/auth/login', data),
  
  verifyOtp: (data: { email?: string; phone?: string; otp: string; role?: string }) =>
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
  delete: (projectId: string) =>
    axiosInstance.delete(`/api/v1/customer/projects/${projectId}`),  
  downloadFloorPlan: (projectId: string) =>
    `${API_BASE_URL}/api/v1/projects/${projectId}/floor-plan/download?token=${typeof window !== 'undefined' ? localStorage.getItem('access_token') : ''}`,

  
  create: (data: {
    bhk_type: string;
    property_name: string;
    city: string;
    budget: number;
    package_id?: string;
    material_preference?: string;
    interior_material_preference?: string;
    fabric_preference?: string;
    style_tags?: string[];
    furnishing_type?: string;
    pincode?: string;
    floor_plan_type?: string;
    floor_plan_name?: string;
    color_preferences?: string[];
    status?: string;
  }) =>
    axiosInstance.post('/api/v1/projects', data),

  uploadFloorPlan: (projectId: string, arg2?: File | FormData | string | null, arg3?: FormData | File) => {
    let roomId: string | null = null
    let fileObj: File | FormData | null = null

    if (arg2 instanceof File || arg2 instanceof FormData) {
      fileObj = arg2
    } else if (typeof arg2 === 'string') {
      roomId = arg2
      if (arg3 instanceof File || arg3 instanceof FormData) {
        fileObj = arg3
      }
    }

    const formData = fileObj instanceof FormData ? fileObj : new FormData()
    if (fileObj && !(fileObj instanceof FormData)) {
      formData.append('file', fileObj)
    }

    const url = roomId 
      ? `/api/v1/projects/${projectId}/floor-plan?room_id=${roomId}`
      : `/api/v1/projects/${projectId}/floor-plan`

    return axiosInstance.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },


  
  get: (id: string) =>
    axiosInstance.get(`/api/v1/projects/${id}`),
  
  update: (id: string, data: Partial<{ title: string; bhk: string; bhk_type: string; city: string; budget: number; budget_min: number; budget_max: number; package_id: string; property_name: string; status: string; floor_plan_url: string; material_preference: string; interior_material_preference: string; fabric_preference: string; furnishing_type: string; pincode: string; style_tags: string[]; color_preferences: string[] }>) =>
    axiosInstance.put(`/api/v1/projects/${id}`, data),


  updateRoom: (projectId: string, roomId: string, data: { style_preference?: string; color_palette?: string[]; length_ft?: number; width_ft?: number; height_ft?: number }) =>
    axiosInstance.put(`/api/v1/projects/${projectId}/rooms/${roomId}`, data),

  addRoomItem: (projectId: string, roomId: string, data: {
    product_id: string;
    qty: number;
    unit_price?: number;
    custom_attributes?: any;
    custom_color?: string;
    custom_material?: string;
    custom_size?: string;
    custom_fabric?: string;
    custom_wood_finish?: string;
    custom_texture?: string;
    custom_cushion_style?: string;
  }) =>
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
  
  products: (params: { room_type?: string; category?: string; style?: string; limit?: number; skip?: number; pincode?: string; project_id?: string }) =>
    axiosInstance.get('/api/v1/catalog/products', { params }),

  getProducts: (params?: any) =>
    axiosInstance.get('/api/v1/catalog/products', { params }),

  productsByRoom: (roomType: string) =>
    axiosInstance.get(`/api/v1/catalog/products?room_type=${roomType}`),
  
  product: (id: string) =>
    axiosInstance.get(`/api/v1/catalog/products/${id}`),

  colors: (params?: { style?: string; grouped?: boolean }) =>
    axiosInstance.get('/api/v1/catalog/colors', { params }),

  materials: () =>
    axiosInstance.get('/api/v1/catalog/materials'),
}


// AI Rendering API
export const aiAPI = {
  render: (data: { room_id: string; mode?: string; style?: string; color_palette?: string[]; products?: any[]; layout_prompt?: string; base_image_url?: string; base_image_data?: string; base_image_mime?: string }) =>
    axiosInstance.post('/api/v1/ai/render', data),
  
  renderStatus: (jobId: string) =>
    axiosInstance.get(`/api/v1/ai/render/${jobId}`),

  roomRenders: (roomId: string) =>
    axiosInstance.get(`/api/v1/ai/renders/${roomId}`),

  renderPdf: (projectId: string) =>
    `${API_BASE_URL}/api/v1/ai/render-pdf/${projectId}`,

  // IDS Backend-AI Integration
  design: (data: {
    city?: string
    bhk?: string
    scope?: string
    budget?: string
    quality?: string
    timeline?: string
    style?: string
    wood?: string
    fabric?: string
    colors?: string[]
    solve?: boolean
  }) =>
    axiosInstance.post('/api/v1/ai/design', data),

  designOptions: () =>
    axiosInstance.get('/api/v1/ai/design/options'),

  health: () =>
    axiosInstance.get('/api/v1/ai/health'),

  getInteractiveViewerUrl: (projectId?: string) =>
    projectId
      ? `${API_BASE_URL}/api/v1/ai/interactive-viewer/${projectId}`
      : `${API_BASE_URL}/api/v1/ai/interactive-viewer`,

  getAiStudioUrl: () =>
    `${API_BASE_URL}/static/ai-viewer/index.html`,

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
  packages: (params: { bhk: string; budget: number; style_tags?: string; project_id?: string }) =>
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
    axiosInstance.get(`/api/v1/tracking/${projectId}`),
  
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

  // Customer Management
  getCustomers: (params?: { search?: string; status?: string; page?: number; limit?: number }) =>
    axiosInstance.get('/api/v1/admin/customers', { params }),
  getCustomerDetail: (id: string) =>
    axiosInstance.get(`/api/v1/admin/customers/${id}`),
  updateCustomerProfile: (id: string, data: any) =>
    axiosInstance.put(`/api/v1/admin/customers/${id}`, data),
  suspendCustomer: (id: string) =>
    axiosInstance.post(`/api/v1/admin/customers/${id}/suspend`),
  reactivateCustomer: (id: string) =>
    axiosInstance.post(`/api/v1/admin/customers/${id}/reactivate`),

  // Enterprise Management
  getEnterprises: (params?: { search?: string; status?: string; page?: number; limit?: number }) =>
    axiosInstance.get('/api/v1/admin/enterprises', { params }),

  // Vendor Management
  getVendors: (params?: { status?: string }) =>
    axiosInstance.get('/api/v1/admin/vendors', { params }),
  approveVendor: (id: string) =>
    axiosInstance.post(`/api/v1/admin/vendors/${id}/approve`),
  rejectVendor: (id: string, data: { rejection_reason?: string }) =>
    axiosInstance.post(`/api/v1/admin/vendors/${id}/reject`, data),
  requestVendorDocs: (id: string) =>
    axiosInstance.post(`/api/v1/admin/vendors/${id}/request-docs`),
  suspendVendor: (id: string) =>
    axiosInstance.post(`/api/v1/admin/vendors/${id}/suspend`),
  reactivateVendor: (id: string) =>
    axiosInstance.post(`/api/v1/admin/vendors/${id}/reactivate`),
  getVendorPerformance: (id: string) =>
    axiosInstance.get(`/api/v1/admin/vendors/${id}/performance`),

  // Team Approvals
  getTeamApprovals: () =>
    axiosInstance.get('/api/v1/admin/team-approvals'),
  approveTeamMember: (id: string) =>
    axiosInstance.post(`/api/v1/admin/team-approvals/${id}/approve`),
  rejectTeamMember: (id: string) =>
    axiosInstance.post(`/api/v1/admin/team-approvals/${id}/reject`),

  // Quotation Management
  getQuotations: () =>
    axiosInstance.get('/api/v1/admin/quotations'),
  createQuotation: (data: any) =>
    axiosInstance.post('/api/v1/admin/quotations', data),
  editQuotation: (id: string, data: any) =>
    axiosInstance.put(`/api/v1/admin/quotations/${id}`, data),
  approveQuotation: (id: string) =>
    axiosInstance.post(`/api/v1/admin/quotations/${id}/approve`),
  rejectQuotation: (id: string) =>
    axiosInstance.post(`/api/v1/admin/quotations/${id}/reject`),
  expireQuotation: (id: string) =>
    axiosInstance.post(`/api/v1/admin/quotations/${id}/expire`),
  convertQuotation: (id: string) =>
    axiosInstance.post(`/api/v1/admin/quotations/${id}/convert`),
  getQuotationHistory: (id: string) =>
    axiosInstance.get(`/api/v1/admin/quotations/${id}/history`),

  // Project Control Center
  createProject: (data: any) =>
    axiosInstance.post('/api/v1/admin/projects', data),
  editProject: (id: string, data: any) =>
    axiosInstance.put(`/api/v1/admin/projects/${id}`, data),
  closeProject: (id: string) =>
    axiosInstance.post(`/api/v1/admin/projects/${id}/close`),
  cancelProject: (id: string) =>
    axiosInstance.post(`/api/v1/admin/projects/${id}/cancel`),
  assignProjectResource: (id: string, data: { assignee_id: string; role: string; target_item_id?: string }) =>
    axiosInstance.post(`/api/v1/admin/projects/${id}/assign`, data),

  // Master Data
  getMasterProducts: (category?: string) =>
    axiosInstance.get('/api/v1/admin/master/products', { params: { category } }),
  createMasterProduct: (data: any) =>
    axiosInstance.post('/api/v1/admin/master/products', data),
  editMasterProduct: (id: string, data: any) =>
    axiosInstance.put(`/api/v1/admin/master/products/${id}`, data),
  deleteMasterProduct: (id: string) =>
    axiosInstance.delete(`/api/v1/admin/master/products/${id}`),
  importCatalog: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return axiosInstance.post('/api/v1/admin/master/import', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  exportCatalogUrl: () =>
    `${API_BASE_URL}/api/v1/admin/master/export`,

  // Package Configuration
  getPackageConfigs: () =>
    axiosInstance.get('/api/v1/admin/packages/configurations'),
  createPackageConfig: (data: any) =>
    axiosInstance.post('/api/v1/admin/packages/configurations', data),
  editPackageConfig: (id: string, data: any) =>
    axiosInstance.put(`/api/v1/admin/packages/configurations/${id}`, data),
  deletePackageConfig: (id: string) =>
    axiosInstance.delete(`/api/v1/admin/packages/configurations/${id}`),

  // Pricing Rules
  getPricingRules: () =>
    axiosInstance.get('/api/v1/admin/pricing/rules'),
  createPricingRule: (data: any) =>
    axiosInstance.post('/api/v1/admin/pricing/rules', data),
  editPricingRule: (id: string, data: any) =>
    axiosInstance.put(`/api/v1/admin/pricing/rules/${id}`, data),
  deletePricingRule: (id: string) =>
    axiosInstance.delete(`/api/v1/admin/pricing/rules/${id}`),

  // Roles & Permissions
  assignAdminRole: (data: { user_id: string; role_name: string }) =>
    axiosInstance.post('/api/v1/admin/roles-permissions/assign', data),
  revokeAdminRole: (userId: string) =>
    axiosInstance.post(`/api/v1/admin/roles-permissions/revoke?user_id=${userId}`),

  // Documents Center
  getVaultDocuments: (search?: string, docType?: string) =>
    axiosInstance.get('/api/v1/admin/documents', { params: { search, doc_type: docType } }),
  uploadVaultDocument: (title: string, docType: string, projectId: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return axiosInstance.post(`/api/v1/admin/documents?title=${encodeURIComponent(title)}&doc_type=${docType}&project_id=${projectId}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  deleteVaultDocument: (id: string) =>
    axiosInstance.delete(`/api/v1/admin/documents/${id}`),

  // System Settings
  getSystemSettings: () =>
    axiosInstance.get('/api/v1/admin/settings'),
  updateSystemSetting: (data: { key: string; value: string; category: string }) =>
    axiosInstance.put('/api/v1/admin/settings', data),

  // Audit Logs & Reports
  getAuditLogs: () =>
    axiosInstance.get('/api/v1/admin/audit-logs'),
  getReportUrl: (category: string) =>
    `${API_BASE_URL}/api/v1/admin/reports?category=${category}&token=${typeof window !== 'undefined' ? localStorage.getItem('access_token') : ''}`,
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
  getTrackingHistory: (projectId: string, trackingId: string) =>
    axiosInstance.get(`/api/v1/customer/projects/${projectId}/tracking/${trackingId}/history`),
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
  createIssue: (projectId: string, type: string, priority: string, description: string, itemId?: string, dateEncountered?: string, files?: File[]) => {
    const fd = new FormData()
    fd.append('type', type)
    fd.append('priority', priority)
    fd.append('description', description)
    if (itemId) fd.append('item_id', itemId)
    if (dateEncountered) fd.append('date_encountered', dateEncountered)
    if (files) {
      files.forEach((f) => fd.append('files', f))
    }
    return axiosInstance.post(`/api/v1/customer/projects/${projectId}/issues`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  updateIssue: (projectId: string, issueId: string, type: string, priority: string, description: string, dateEncountered?: string, files?: File[]) => {
    const fd = new FormData()
    fd.append('type', type)
    fd.append('priority', priority)
    fd.append('description', description)
    if (dateEncountered) fd.append('date_encountered', dateEncountered)
    if (files) {
      files.forEach((f) => fd.append('files', f))
    }
    return axiosInstance.put(`/api/v1/customer/projects/${projectId}/issues/${issueId}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
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
  deleteNotification: (notificationId: string) =>
    axiosInstance.delete(`/api/v1/customer/notifications/${notificationId}`),

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
  getDirectory: () =>
    axiosInstance.get('/api/v1/team/team/directory'),
  getMembers: (projectId: string) =>
    axiosInstance.get(`/api/v1/team/projects/${projectId}/team`),
  assignMember: (projectId: string, userId: string, role: string) =>
    axiosInstance.post(`/api/v1/team/projects/${projectId}/assign`, { userId, role }),
  removeMember: (projectId: string, userId: string, role: string) =>
    axiosInstance.post(`/api/v1/team/projects/${projectId}/remove-assignment`, { userId, role }),
  getAssignmentHistory: (projectId: string) =>
    axiosInstance.get(`/api/v1/team/projects/${projectId}/assignments/history`),
  assignItemTechnician: (projectId: string, itemId: string, technicianId: string) =>
    axiosInstance.post(`/api/v1/team/projects/${projectId}/assign-item`, { itemId, technicianId }),
  getProgress: (projectId: string) =>
    axiosInstance.get(`/api/v1/team/projects/${projectId}/progress`),
  updateProgress: (projectId: string, progress: number, reason?: string) =>
    axiosInstance.post(`/api/v1/team/projects/${projectId}/progress`, { progress, reason }),
  getIssues: (projectId: string) =>
    axiosInstance.get(`/api/v1/team/projects/${projectId}/issues`),
  createIssue: (projectId: string, data: { type: string; priority: string; description: string; itemId?: string }) =>
    axiosInstance.post(`/api/v1/team/projects/${projectId}/issues`, data),
  getIssueComments: (issueId: string) =>
    axiosInstance.get(`/api/v1/team/issues/${issueId}/comments`),
  createIssueComment: (issueId: string, comment: string) =>
    axiosInstance.post(`/api/v1/team/issues/${issueId}/comments`, { comment }),
  escalateIssue: (issueId: string) =>
    axiosInstance.post(`/api/v1/team/issues/${issueId}/escalate`),
  resolveIssue: (issueId: string, resolution: string) =>
    axiosInstance.post(`/api/v1/team/issues/${issueId}/resolve`, { resolution }),
  getPhotos: (projectId: string) =>
    axiosInstance.get(`/api/v1/team/projects/${projectId}/photos`),
  uploadPhoto: (projectId: string, data: FormData) =>
    axiosInstance.post(`/api/v1/team/projects/${projectId}/photos`, data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  getProjects: () =>
    axiosInstance.get('/api/v1/team/team/projects'),
  getDashboard: () =>
    axiosInstance.get('/api/v1/team/team/dashboard'),
  getTracking: (projectId: string) =>
    axiosInstance.get(`/api/v1/team/projects/${projectId}/tracking`),
  updateTracking: (projectId: string, trackingId: string, status: string, remarks?: string) =>
    axiosInstance.put(`/api/v1/team/projects/${projectId}/tracking/${trackingId}`, { status, remarks }),
  getTrackingHistory: (projectId: string, trackingId: string) =>
    axiosInstance.get(`/api/v1/team/projects/${projectId}/tracking/${trackingId}/history`),
  getTasks: (projectId: string) =>
    axiosInstance.get(`/api/v1/team/projects/${projectId}/tasks`),
  createTask: (projectId: string, data: { title: string; description?: string; dueDate: string; priority?: string; assignedTo?: string }) =>
    axiosInstance.post(`/api/v1/team/projects/${projectId}/tasks`, data),
  updateTask: (projectId: string, taskId: string, data: any) =>
    axiosInstance.put(`/api/v1/team/projects/${projectId}/tasks/${taskId}`, data),
  deleteTask: (projectId: string, taskId: string) =>
    axiosInstance.delete(`/api/v1/team/projects/${projectId}/tasks/${taskId}`),
  getChecklists: (projectId: string) =>
    axiosInstance.get(`/api/v1/team/projects/${projectId}/checklist`),
  createChecklist: (projectId: string, data: { checklistType: string; items: { title: string; isCompleted: boolean }[] }) =>
    axiosInstance.post(`/api/v1/team/projects/${projectId}/checklist`, data),
  toggleChecklistItem: (projectId: string, itemId: string, isCompleted: boolean) =>
    axiosInstance.put(`/api/v1/team/projects/${projectId}/checklist/item/${itemId}`, { isCompleted }),
  getSiteVisits: (projectId: string) =>
    axiosInstance.get(`/api/v1/team/projects/${projectId}/site-visits`),
  scheduleSiteVisit: (projectId: string, data: { visitDate: string; assignedTo?: string; notes?: string }) =>
    axiosInstance.post(`/api/v1/team/projects/${projectId}/site-visits`, data),
  updateSiteVisit: (projectId: string, visitId: string, data: any) =>
    axiosInstance.put(`/api/v1/team/projects/${projectId}/site-visits/${visitId}`, data),
  getComms: (projectId: string) =>
    axiosInstance.get(`/api/v1/team/projects/${projectId}/comms`),
  createComm: (projectId: string, data: { type: string; notes: string }) =>
    axiosInstance.post(`/api/v1/team/projects/${projectId}/comms`, data),
  getDocuments: (projectId: string) =>
    axiosInstance.get(`/api/v1/team/projects/${projectId}/documents`),
  uploadDocument: (projectId: string, title: string, type: string, file: File) => {
    const fd = new FormData()
    fd.append('title', title)
    fd.append('type', type)
    fd.append('file', file)
    return axiosInstance.post(`/api/v1/team/projects/${projectId}/documents`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  deleteDocument: (projectId: string, documentId: string) =>
    axiosInstance.delete(`/api/v1/team/projects/${projectId}/documents/${documentId}`),
  getAnalytics: (projectId: string) =>
    axiosInstance.get(`/api/v1/team/projects/${projectId}/analytics`),
}

// Vendor Module API
export const vendorAPI = {
  getOnboarding: () =>
    axiosInstance.get('/api/v1/vendor/onboarding'),
  register: (data: { businessName: string; ownerName: string; email: string; phone?: string; gstNumber?: string; panNumber?: string; warehouseAddress?: string; serviceLocations: string[]; categories?: string[] }) =>
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
  deleteProduct: (productId: string) =>
    axiosInstance.delete(`/api/v1/vendor/products/${productId}`),
  uploadProductImage: (productId: string, file: File, viewIndex: number = 0) => {
    const fd = new FormData()
    fd.append('file', file)
    return axiosInstance.post(`/api/v1/vendor/products/${productId}/image?view_index=${viewIndex}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },


  getInventory: () =>
    axiosInstance.get('/api/v1/vendor/inventory'),
  adjustInventory: (data: { productId: string; quantity: number; type: string; notes?: string }) =>
    axiosInstance.post('/api/v1/vendor/inventory', data),

  getAssignments: () =>
    axiosInstance.get('/api/v1/vendor/assignments'),
  updateAssignment: (assignmentId: string, status: string, remarks?: string) =>
    axiosInstance.patch(`/api/v1/vendor/assignments/${assignmentId}`, { status, remarks }),
  updateShipment: (assignmentId: string, data: { courier: string; vehicle_details?: string; tracking_number: string; dispatch_date?: string; expected_arrival?: string; shipment_status: string }) =>
    axiosInstance.put(`/api/v1/vendor/assignments/${assignmentId}/shipment`, data),
  updateMilestone: (assignmentId: string, milestoneName: string, status: string) =>
    axiosInstance.put(`/api/v1/vendor/assignments/${assignmentId}/milestones`, { milestone_name: milestoneName, status }),
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
  getIssues: () =>
    axiosInstance.get('/api/v1/vendor/issues'),
}

// Enterprise and B2B2C API
export const enterpriseAPI = {
  createProject: (data: any) => axiosInstance.post('/api/v1/enterprise/projects', data),
  listProjects: () => axiosInstance.get('/api/v1/enterprise/projects'),
  getProject: (id: string) => axiosInstance.get(`/api/v1/enterprise/projects/${id}`),
  deleteProject: (id: string) => axiosInstance.delete(`/api/v1/enterprise/projects/${id}`),
  configureUnitMix: (id: string, data: { bhk_mix: Record<string, number> }) =>
    axiosInstance.post(`/api/v1/enterprise/projects/${id}/unit-mix`, data),
  listFlats: (id: string) => axiosInstance.get(`/api/v1/enterprise/projects/${id}/flats`),
  uploadFloorPlan: (id: string, layoutName: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('layout_name', layoutName)
    return axiosInstance.post(`/api/v1/enterprise/projects/${id}/floor-plans`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  listFloorPlans: (id: string) => axiosInstance.get(`/api/v1/enterprise/projects/${id}/floor-plans`),
  updateFlat: (flatId: string, data: any) => axiosInstance.put(`/api/v1/enterprise/flats/${flatId}`, data),
  assignCustomer: (flatId: string, data: { name: string; phone?: string; email?: string }) =>
    axiosInstance.post(`/api/v1/enterprise/flats/${flatId}/assign`, data),
  inviteCustomer: (flatId: string) => axiosInstance.post(`/api/v1/enterprise/flats/${flatId}/invite`),
  revokeInvitation: (flatId: string) => axiosInstance.post(`/api/v1/enterprise/flats/${flatId}/revoke-invite`),
  validateInvitation: (token: string) => axiosInstance.get(`/api/v1/enterprise/invitations/validate?token=${token}`),
  acceptInvitation: (token: string) => axiosInstance.post('/api/v1/enterprise/invitations/accept', { token }),
  updateOnboarding: (projectId: string, data: any) =>
    axiosInstance.put(`/api/v1/enterprise/projects/${projectId}/onboarding`, data),
  getActivity: () => axiosInstance.get('/api/v1/enterprise/activity'),
}

// Customer extras
export const customerExtrasAPI = {
  getProofPhotos: (projectId: string) =>
    axiosInstance.get(`/api/v1/customer/projects/${projectId}/proof-photos`),
}

// ════════════════════════════════════════════════════════════════════════════
// Stakeholder feedback (Sept 2026 review)
// ════════════════════════════════════════════════════════════════════════════

export type BillingDetails = {
  gst_number?: string | null
  company_name?: string | null
  pan_number?: string | null
  billing_address?: string | null
  billing_city?: string | null
  billing_state?: string | null
  billing_pincode?: string | null
}

// 1.3 — customer GST & billing profile
export const billingAPI = {
  get: () => axiosInstance.get('/api/v1/auth/me'),
  update: (data: BillingDetails) => axiosInstance.put('/api/v1/auth/me', data),
}

// 1.5 / 1.9 / 1.10 — admin quotation lifecycle
export const quotationAdminAPI = {
  search: (params?: { q?: string; status?: string; limit?: number }) =>
    axiosInstance.get('/api/v1/quotation-admin/search', { params }),
  paymentModes: () => axiosInstance.get('/api/v1/quotation-admin/payment-modes'),
  markPaid: (quotationId: string, data: { payment_mode: string; payment_reference?: string; amount?: number; notes?: string }) =>
    axiosInstance.post(`/api/v1/quotation-admin/${quotationId}/mark-paid`, data),
  convertToProject: (quotationId: string, data: { property_name?: string; note?: string } = {}) =>
    axiosInstance.post(`/api/v1/quotation-admin/${quotationId}/convert-to-project`, data),
}

// 4.2-4.5 approval queue & supplier allocation · 2.1-2.4 B2B pricing
export const approvalsAPI = {
  queue: (params?: { status?: string; include_drafts?: boolean }) =>
    axiosInstance.get('/api/v1/approvals/queue', { params }),
  approve: (projectId: string, note?: string) =>
    axiosInstance.post(`/api/v1/approvals/projects/${projectId}/approve`, { note }),
  reject: (projectId: string, reason: string) =>
    axiosInstance.post(`/api/v1/approvals/projects/${projectId}/reject`, { reason }),
  allocate: (projectId: string, vendorId: string, note?: string) =>
    axiosInstance.post(`/api/v1/approvals/projects/${projectId}/allocate`, { vendor_id: vendorId, note }),
  history: (projectId: string) =>
    axiosInstance.get(`/api/v1/approvals/projects/${projectId}/history`),
  pricing: (projectId: string) =>
    axiosInstance.get(`/api/v1/approvals/projects/${projectId}/pricing`),
  setDiscount: (projectId: string, data: { discount_type: string; discount_value: number; note?: string }) =>
    axiosInstance.post(`/api/v1/approvals/projects/${projectId}/discount`, data),
  clearDiscount: (projectId: string) =>
    axiosInstance.delete(`/api/v1/approvals/projects/${projectId}/discount`),
}

// 3.1-3.5 separate vendor and technician tracks, photos on the item
export const itemTrackingAPI = {
  statuses: (role: 'vendor' | 'technician') =>
    axiosInstance.get('/api/v1/item-tracking/statuses', { params: { role } }),
  list: (projectId: string, role?: 'vendor' | 'technician') =>
    axiosInstance.get(`/api/v1/item-tracking/project/${projectId}`, { params: role ? { role } : {} }),
  create: (data: { project_id: string; room_name: string; item_name: string; product_id?: string; expected_date?: string }) =>
    axiosInstance.post('/api/v1/item-tracking', data),
  setVendorStatus: (itemId: string, data: { vendor_status: string; remarks?: string; expected_date?: string }) =>
    axiosInstance.patch(`/api/v1/item-tracking/${itemId}/vendor-status`, data),
  setTechnicianStatus: (itemId: string, data: { technician_status: string; remarks?: string }) =>
    axiosInstance.patch(`/api/v1/item-tracking/${itemId}/technician-status`, data),
  uploadPhoto: (itemId: string, file: File, opts: { caption?: string; stage?: string } = {}) => {
    const form = new FormData()
    form.append('file', file)
    return axiosInstance.post(`/api/v1/item-tracking/${itemId}/photos`, form, {
      params: opts,
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  deletePhoto: (itemId: string, url: string) =>
    axiosInstance.delete(`/api/v1/item-tracking/${itemId}/photos`, { params: { url } }),
}

// 4.1 supplier availability switch
export const availabilityAPI = {
  setCatalogProduct: (productId: string, data: { is_available: boolean; reason?: string }) =>
    axiosInstance.patch(`/api/v1/vendor/products/${productId}/availability`, data),
  setVendorProduct: (productId: string, data: { is_available: boolean; reason?: string }) =>
    axiosInstance.patch(`/api/v1/vendor/my-products/${productId}/availability`, data),
  overview: (only?: 'available' | 'unavailable') =>
    axiosInstance.get('/api/v1/vendor/availability', { params: only ? { only } : {} }),
}

// 5.1-5.8 special services: consultants, leads, commission
export const specialServicesAPI = {
  types: () => axiosInstance.get('/api/v1/special-services/types'),
  consultants: (params?: { service_type?: string; status?: string; q?: string }) =>
    axiosInstance.get('/api/v1/special-services/consultants', { params }),
  createConsultant: (data: any) => axiosInstance.post('/api/v1/special-services/consultants', data),
  updateConsultant: (id: string, data: any) => axiosInstance.put(`/api/v1/special-services/consultants/${id}`, data),
  leads: (params?: { status?: string; service_type?: string; consultant_id?: string }) =>
    axiosInstance.get('/api/v1/special-services/leads', { params }),
  createLead: (data: {
    service_type: string; requirements?: string; project_id?: string; city?: string
    customer_name?: string; customer_phone?: string; customer_email?: string; service_value?: number
  }) => axiosInstance.post('/api/v1/special-services/leads', data),
  assign: (leadId: string, consultantId: string, note?: string) =>
    axiosInstance.post(`/api/v1/special-services/leads/${leadId}/assign`, { consultant_id: consultantId, note }),
  updateStatus: (leadId: string, data: { status: string; note?: string; service_value?: number }) =>
    axiosInstance.patch(`/api/v1/special-services/leads/${leadId}/status`, data),
  updatePayout: (leadId: string, payout_status: 'PENDING' | 'PAID') =>
    axiosInstance.patch(`/api/v1/special-services/leads/${leadId}/payout`, { payout_status }),
  earnings: (consultantId?: string) =>
    axiosInstance.get('/api/v1/special-services/earnings', { params: consultantId ? { consultant_id: consultantId } : {} }),
  previewCommission: (service_value: number, commission_rate: number) =>
    axiosInstance.get('/api/v1/special-services/quote', { params: { service_value, commission_rate } }),
  // 1.12 — pre-checkout special services & confirmations
  getCheckout: (projectId: string) => axiosInstance.get(`/api/v1/special-services/checkout/${projectId}`),
  saveCheckout: (projectId: string, data: {
    services: { service_type: string; requirements?: string }[]
    confirmations: Record<string, boolean>
    site_access_from?: string
    notes?: string
  }) => axiosInstance.post(`/api/v1/special-services/checkout/${projectId}`, data),
}

// 1.1 plan-specific rendering · 1.7 free tier · 1.8 paid batch
export const premiumRenderAPI = {
  entitlement: (projectId: string) => axiosInstance.get(`/api/v1/ai/render-entitlement/${projectId}`),
  queueBatch: (projectId: string, data: { count: number; style?: string; rooms?: string[]; notes?: string }) =>
    axiosInstance.post(`/api/v1/ai/premium-render/${projectId}`, data),
  batch: (batchId: string) => axiosInstance.get(`/api/v1/ai/premium-render/batch/${batchId}`),
  uploadFloorPlan: (projectId: string, file: File, roomId?: string) => {
    const form = new FormData()
    form.append('file', file)
    return axiosInstance.post(`/api/v1/ai/floor-plan/${projectId}`, form, {
      params: roomId ? { room_id: roomId } : {},
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  clearFloorPlan: (projectId: string) => axiosInstance.delete(`/api/v1/ai/floor-plan/${projectId}`),
  viewerBrief: (projectId: string) => axiosInstance.get(`/api/v1/ai/viewer-brief/${projectId}`),
}

// Full-page design studio: edit the design, keep 2D/3D in step, GLB export
export type DesignValues = {
  bhk_type: string
  style: string | null
  budget: number | null
  quality: string | null
  wood: string | null
  fabric: string | null
  colors: string[]
  city: string | null
  timeline: string | null
  scope: string | null
}

export const designStudioAPI = {
  get: (projectId: string) => axiosInstance.get(`/api/v1/ai/design-brief/${projectId}`),
  update: (projectId: string, values: Partial<DesignValues>) =>
    axiosInstance.put(`/api/v1/ai/design-brief/${projectId}`, values),
  uploadGlb: (projectId: string, blob: Blob) => {
    const form = new FormData()
    form.append('file', blob, 'model.glb')
    return axiosInstance.post(`/api/v1/ai/scene-glb/${projectId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  downloadGlb: (projectId: string) =>
    axiosInstance.get(`/api/v1/ai/scene-glb/${projectId}`, { responseType: 'blob' }),
}

// Uploaded floor plan → traced rooms → the studio's 2D plan and 3D model
export type PlanBox = [number, number, number, number]   // x0, y0, x1, y1 as fractions of the image
export interface PlanRoom { id?: string; label: string; room_type: string; box: PlanBox }
export interface PlanLayout {
  status: 'draft' | 'active' | 'inactive'
  image_url: string
  image_w: number
  image_h: number
  rooms: PlanRoom[]
  plan_width_m: number
  plan_depth_m?: number | null        // set when the uploaded image is stretched
  // A brochure sheet showing several flats: the one being read, and the rest.
  panels?: { box: [number, number, number, number]; source: string }[] | null
  panel?: number | null
  sheet_url?: string | null
  method?: 'heuristic' | 'gemini'
  notes?: string[]
  summary?: { bhk: string; rooms: number; objects: number; area_sqft: number; skipped_items?: string[] }
}
export interface PlanLayoutPayload {
  project_id: string
  project_bhk: string
  bhk_locked: string | null
  plan: PlanLayout | null
  plan_bhk: string | null
  active: boolean
  room_types: { value: string; label: string }[]
  gemini: boolean
}

export const planLayoutAPI = {
  get: (projectId: string) =>
    axiosInstance.get<PlanLayoutPayload>(`/api/v1/ai/plan-layout/${projectId}`),
  // Room detection can take a few seconds (longer with Gemini vision).
  detect: (projectId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return axiosInstance.post<PlanLayoutPayload>(`/api/v1/ai/plan-layout/${projectId}/detect`, form, { timeout: 90000 })
  },
  // `panel` picks another flat when the upload was a sheet of several.
  redetect: (projectId: string, panel?: number) =>
    axiosInstance.post<PlanLayoutPayload>(
      `/api/v1/ai/plan-layout/${projectId}/redetect${panel === undefined ? '' : `?panel=${panel}`}`,
      null, { timeout: 90000 }),
  save: (projectId: string, body: { rooms: PlanRoom[]; plan_width_m: number; plan_depth_m?: number; activate?: boolean; sync_bhk?: boolean }) =>
    axiosInstance.put<PlanLayoutPayload>(`/api/v1/ai/plan-layout/${projectId}`, body, { timeout: 60000 }),
  disable: (projectId: string) =>
    axiosInstance.delete<PlanLayoutPayload>(`/api/v1/ai/plan-layout/${projectId}`),
}

/** A readable message from an API error, including FastAPI validation lists. */
export const apiErrorMessage = (err: any, fallback: string): string => {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length) return detail.map((d: any) => d?.msg || String(d)).join('; ')
  if (err?.code === 'ECONNABORTED') return 'The server took too long to respond — please try again.'
  if (err && !err.response) return 'Could not reach the server — is the backend running?'
  return fallback
}

export default axiosInstance


