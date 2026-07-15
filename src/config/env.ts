const API_ORIGIN = 'https://app.harborshield360.com';
const STORMBUDDI_ORIGIN = 'https://app.stormbuddi.com';

export const env = {
  apiOrigin: API_ORIGIN,
  apiBaseUrl: `${API_ORIGIN}/api`,
  stormBuddiApiOrigin: STORMBUDDI_ORIGIN,
  /** Same endpoint as web photo-media.vue (`MIX_STORMBUDDI_URL` + path). */
  stormBuddiFileUploadUrl: `${STORMBUDDI_ORIGIN}/api/external/file-upload/fileupload`,
  /** Same endpoint as web messages.vue chat attachments. */
  stormBuddiChatAttachmentUrl: `${STORMBUDDI_ORIGIN}/api/external/chat-attachment`,
  /** profile.vue car photo upload */
  stormBuddiClientFilesUrl: `${STORMBUDDI_ORIGIN}/api/client-files`,
  /** StormBuddi external upload requires Origin (browser sends portal host automatically). */
  stormBuddiUploadOrigin: API_ORIGIN,
  /** Public portal base for proposal/contract links (same host as web `/p/{id}`). */
  portalPublicUrl: API_ORIGIN,

  mobileAuth: {
    login: 'mobile/auth/login',
    register: 'mobile/auth/register',
    resendVerification: 'mobile/auth/resend-verification',
    me: 'mobile/auth/me',
    logout: 'mobile/auth/logout',
    deleteAccount: 'mobile/auth/account',
    forgotPassword: 'mobile/auth/forgot-password',
    setupPassword: 'mobile/auth/setup-password',
  },

  mobileJobs: {
    list: 'mobile/jobs',
    detail: (id: number | string) => `mobile/jobs/${id}`,
  },

  mobileInvoices: {
    list: 'mobile/invoices',
    detail: (id: number | string) => `mobile/invoices/${id}`,
  },

  mobileDocuments: {
    list: 'mobile/documents',
    upload: 'mobile/documents',
    delete: (id: number | string) => `mobile/documents/${id}`,
    download: (id: number | string) => `mobile/documents/${id}/download`,
  },

  mobileAgreements: {
    list: 'mobile/agreements',
    detail: (id: number | string) => `mobile/agreements/${id}`,
    sign: (id: number | string) => `mobile/agreements/${id}/sign`,
  },

  /** Public agreement view/sign page (web `/a/:id`). */
  agreementPublicUrl: (id: number | string) => `${API_ORIGIN}/a/${id}`,

  mobilePhotos: {
    list: 'mobile/photos',
  },

  mobileSchedule: {
    list: 'mobile/schedule',
    create: 'mobile/schedule',
  },

  mobileServiceRequests: {
    list: 'mobile/service-requests',
    create: 'mobile/service-requests',
  },

  mobileFinancing: {
    applications: 'mobile/financing/applications',
    createApplication: 'mobile/financing/applications',
    plans: 'mobile/financing/plans',
  },

  mobileProfile: {
    show: 'mobile/profile',
    update: 'mobile/profile',
  },

  mobileDashboard: {
    index: 'mobile/dashboard',
  },

  mobileMessages: {
    users: 'mobile/messages/users',
    groups: 'mobile/messages/groups',
    directMessages: (userId: number | string) => `mobile/messages/direct/${userId}`,
    sendDirect: 'mobile/messages/direct',
    markDirectRead: (userId: number | string) => `mobile/messages/direct/${userId}/read`,
    groupMessages: (groupId: number | string) => `mobile/messages/groups/${groupId}/messages`,
    sendGroup: 'mobile/messages/groups/send',
    markGroupRead: (groupId: number | string) => `mobile/messages/groups/${groupId}/read`,
    upload: 'mobile/messages/upload',
  },

  mobileNotifications: {
    list: 'mobile/notifications',
    unreadCount: 'mobile/notifications/unread-count',
    markRead: (id: number | string) => `mobile/notifications/${id}/read`,
    markAllRead: 'mobile/notifications/mark-all-read',
    markReadOnOpen: 'mobile/notifications/mark-read-on-open',
  },

  requestTimeoutMs: 15000,

  /** Same key as web `MIX_GOOGLE_MAPS_API_KEY` (Static Maps / satellite). */
  googleMapsApiKey: '',

  /** Set true to skip HTTP login (UI-only). */
  useMockAuth: false,

  /**
   * When true, customer + portal modules return in-app mock data (no HTTP).
   * Set false when APIs should hit the server (requires valid auth).
   */
  useMockData: true,
};
