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

export default axiosInstance


