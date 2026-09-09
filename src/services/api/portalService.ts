import axios, { AxiosError } from 'axios';
import { env } from '../../config/env';
import {
  ChatGroup,
  ChatUsersPayload,
  ChatContact,
  CustomerAgreement,
  CustomerDocument,
  CustomerJob,
  JobsApiPayload,
  ScheduleApiPayload,
  ScheduleEvent,
  FinancingApplication,
  FinancingApplicationsPayload,
  FinancingPlan,
  FinancingPlansPayload,
  ServiceRequestJob,
  ServiceRequestsListPayload,
} from '../../types/portal';
import type { JobDetailApiResponse } from '../../types/jobDetail';
import type { InvoiceDetailResponse, InvoicesListResponse } from '../../types/invoice';
import type { PhotoMediaListResponse } from '../../types/photoMedia';
import type { ChatMessageRecord, ChatMessagesResponse, ChatUsersResponse } from '../../types/chat';
import type {
  NotificationMarkReadResponse,
  NotificationsIndexResponse,
  PortalNotification,
} from '../../types/notifications';
import type { CustomerProfile, ProfileUpdatePayload, ProfileUpdateResponse } from '../../types/profile';
import type { DashboardPayload } from '../../types/dashboard';
import { normalizeJobDetailResponse } from '../../utils/jobDetailMapping';
import { httpClient } from './httpClient';
import { sessionStorage } from '../storage/sessionStorage';
import { postMultipartJson } from '../../utils/nativeFileUpload';

const getError = (error: unknown, fallback: string): Error => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; errors?: Record<string, string[]> } | string | undefined;
    const status = error.response?.status;
    if (data && typeof data === 'object' && data.errors && typeof data.errors === 'object') {
      const firstKey = Object.keys(data.errors)[0];
      const firstMsg = firstKey ? data.errors[firstKey]?.[0] : undefined;
      if (firstMsg) {
        return new Error(firstMsg);
      }
    }
    if (data && typeof data === 'object' && typeof data.message === 'string' && data.message.trim()) {
      return new Error(data.message);
    }
    if (status) {
      return new Error(`${fallback} (${status})`);
    }
    if (error.message) {
      return new Error(`${fallback}: ${error.message}`);
    }
  }
  if (error instanceof Error && error.message) {
    return error;
  }
  return new Error(fallback);
};

type WipeApiBody = {
  success?: boolean;
  error?: string | { message?: string; code?: string };
  message?: string;
};

const wipeErrorText = (data: WipeApiBody | string | undefined, fallback: string): string => {
  if (!data || typeof data === 'string') {
    return fallback;
  }
  const errorField = data.error;
  if (typeof errorField === 'string' && errorField.trim()) {
    return errorField;
  }
  if (errorField && typeof errorField === 'object' && typeof errorField.message === 'string') {
    return errorField.message;
  }
  if (typeof data.message === 'string' && data.message.trim()) {
    return data.message;
  }
  return fallback;
};

const canFallbackWipe = (status?: number): boolean =>
  status == null || status === 403 || status === 404 || status === 405 || status === 500 || status === 501;

const hideAllVisibleGroupMessages = async (groupId: number | string): Promise<void> => {
  const ids: string[] = [];
  let lastMessageId: number | undefined;
  for (let page = 0; page < 40; page += 1) {
    const response = await httpClient.get<ChatMessagesResponse>(
      env.mobileMessages.groupMessages(groupId),
      {
        params: {
          limit: 100,
          mark_read: 0,
          ...(lastMessageId ? { last_message_id: lastMessageId } : {}),
        },
      },
    );
    const batch = Array.isArray(response.data.messages) ? response.data.messages : [];
    if (batch.length === 0) {
      break;
    }
    batch.forEach((msg) => {
      if (msg?.id != null) {
        ids.push(String(msg.id));
      }
    });
    const oldestId = Number(batch[batch.length - 1]?.id);
    if (!Number.isFinite(oldestId) || batch.length < 100) {
      break;
    }
    lastMessageId = oldestId;
  }

  if (ids.length === 0) {
    await sessionStorage.markChatGroupWiped(groupId);
    return;
  }

  await sessionStorage.hideChatMessages(ids);
  await sessionStorage.markChatGroupWiped(groupId);

  for (const id of ids) {
    try {
      await httpClient.post(env.mobileMessages.hideMessage(id), { mode: 'me' });
    } catch {
      // Local hide already applied; keep going if the server hide route is missing.
    }
  }
};

const isMockDataMode = (): boolean => env.useMockData === true;

const mockJobs = (): JobsApiPayload => ({
  jobs: [
    {
      id: 'mock-1',
      jobs: 'Sample roof inspection',
      status: 'In Progress',
      description: 'Mock project while auth is offline.',
      customer_name: 'John Smith',
      customer_address: '12 Oaks Mall Rd, Novi, MI 48377, USA',
      customer_zip: '98101',
      customer_phone: '(206) 555-0199',
    },
    {
      id: 'mock-2',
      jobs: 'Gutter replacement — Pine St',
      status: 'Scheduled',
      description: 'Second mock job for schedule testing.',
      customer_name: 'Acme Property LLC',
      customer_address: '450 Pine St, Portland, OR 97201, USA',
      customer_zip: '97201',
      customer_phone: '(503) 555-0142',
    },
  ],
  suggestions: [],
});

let mockDocumentsList: CustomerDocument[] = [
  {
    id: 'mock-doc-1',
    original_name: 'Sample-insurance.pdf',
    file_type: 'application/pdf',
    file_size: 245760,
    created_at: new Date().toISOString(),
  },
];

const mockAgreements = (): CustomerAgreement[] => [
  {
    id: 'mock-agreement-1',
    title: 'Service agreement (sample)',
    signature_status: 'pending',
    created_at: new Date().toISOString(),
    content: '<p>This is <strong>mock</strong> agreement HTML for UI development.</p>',
  },
];

const initialMockScheduleEvents: ScheduleEvent[] = [
  {
    id: 'mock-ev-1',
    title: 'Site visit',
    type: 'Appointment',
    start_date_time: new Date(Date.now() + 86400000).toISOString(),
    end_date_time: new Date(Date.now() + 86400000 + 3600000).toISOString(),
    description: 'Mock scheduled event.',
  },
];

let mockScheduleEvents: ScheduleEvent[] = [...initialMockScheduleEvents];

const mockSchedule = (): ScheduleApiPayload => ({
  success: true,
  events: [...mockScheduleEvents],
  projects: [],
});

const mockServiceRequests = (): ServiceRequestsListPayload => ({
  success: true,
  jobs: [
    {
      id: 'mock-sr-1',
      request_type: 'Repair',
      description: 'Leak in the guest room ceiling.',
      status: 'Pending',
      startDate: '06 May 2026, 10:15 AM',
    },
    {
      id: 'mock-sr-2',
      request_type: 'Inspection',
      description: 'Annual roof check-up.',
      status: 'Scheduled',
      startDate: '10 May 2026, 09:00 AM',
    },
  ],
  totalRows: 2,
});

const mockFinancingPlans = (): FinancingPlan[] => [
  { id: 1, name: '12-Month Plan', term_months: 12, interest_rate: 0 },
  { id: 2, name: '24-Month Plan', term_months: 24, interest_rate: 3.99 },
  { id: 3, name: '36-Month Plan', term_months: 36, interest_rate: 5.99 },
];

const mockFinancingApplications = (): FinancingApplication[] => [
  {
    id: 'mock-fin-1',
    requested_amount: 12500,
    plan_display: '24-Month Plan',
    project_type: 'roofing',
    project_address: '789 El Camino Real, Burlingame, CA',
    status: 'pending',
    application_date: '2026-05-05',
  },
];

const mockChatUsers = (): ChatUsersPayload => ({
  admins: [
    {
      id: 0,
      name: 'HarbourShield Admin',
      email: 'admin@example.com',
      last_message_preview: 'Your inspection is scheduled for tomorrow.',
      last_message_time: new Date(Date.now() - 3600000).toISOString(),
      last_message_is_mine: false,
    },
  ],
  peers: [],
  client: { id: 1, name: 'You (mock)', email: 'client@example.com' },
});

const mockNotifications = (): NotificationsIndexResponse => ({
  success: true,
  notifications: [
    {
      id: 'mock-1',
      title: 'Service Request',
      message: 'Your service request was updated.',
      type: 'info',
      read: false,
      created_at: new Date().toISOString(),
      notification_type: 'service_request',
      navigation: { name: '/customer/service-requests', params: {} },
    },
    {
      id: 'mock-2',
      title: 'Schedule Event',
      message: 'A new event was added to your schedule.',
      type: 'info',
      read: true,
      created_at: new Date(Date.now() - 3600000).toISOString(),
      notification_type: 'schedule_event',
      navigation: { name: '/customer/schedule', params: {} },
    },
  ],
  total_count: 2,
  unread_count: 1,
});

const mockChatGroups = (): ChatGroup[] => [
  {
    id: 'mock-g1',
    name: 'Project discussion',
    title: 'Project discussion',
    last_message_preview: 'Photo',
    last_message: 'Photo',
    last_message_time: new Date().toISOString(),
    last_message_sender: 'HarbourShield Admin',
    last_message_is_mine: false,
    members: [
      { id: 1, username: 'You', email: 'client@example.com', user_type: 'customer' },
      { id: 0, username: 'HarbourShield Admin', email: 'admin@example.com', user_type: 'admin' },
    ],
  },
];

const MOBILE_JOBS_PATH = env.mobileJobs.list;

/** Resolved GET URL for projects (baseURL + path). */
export function getMobileJobsUrl(): string {
  const base = (httpClient.defaults.baseURL || env.apiBaseUrl).replace(/\/$/, '');
  const path = MOBILE_JOBS_PATH.replace(/^\//, '');
  return `${base}/${path}`;
}

export type GetJobsOptions = {
  mapWidth?: number;
  mapHeight?: number;
};

export const portalService = {
  async getJobs(options?: GetJobsOptions): Promise<JobsApiPayload> {
    // Jobs always hit the API when using real mobile auth (other modules may still mock).
    if (env.useMockAuth) {
      const payload = mockJobs();
      if (__DEV__) {
        console.log('[Projects API] mock mode (useMockAuth / useMockData) — no HTTP request', {
          jobsCount: payload.jobs.length,
        });
      }
      return payload;
    }

    const fullUrl = getMobileJobsUrl();

    try {
      if (__DEV__) {
        console.log('[Projects API] GET', fullUrl);
      }

      const response = await httpClient.get<{
        success?: boolean;
        message?: string;
        google_maps_api_key?: string;
        jobs?: CustomerJob[];
        suggestions?: unknown[];
      }>(MOBILE_JOBS_PATH, {
        params: {
          map_width: options?.mapWidth ?? 640,
          map_height: options?.mapHeight ?? 410,
        },
      });

      if (__DEV__) {
        console.log('[Projects API] response', {
          fullUrl,
          httpStatus: response.status,
          data: response.data,
        });
      }

      if (response.data.success === false) {
        throw new Error(response.data.message || 'Unable to load projects.');
      }

      const payload = {
        jobs: response.data.jobs || [],
        suggestions: response.data.suggestions || [],
        google_maps_api_key: response.data.google_maps_api_key,
      };

      if (__DEV__) {
        console.log('[Projects API] parsed jobs', {
          count: payload.jobs.length,
          jobs: payload.jobs,
        });
      }

      return payload;
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      if (__DEV__) {
        console.log('[Projects API] error', {
          fullUrl,
          message: axiosError.message,
          httpStatus: axiosError.response?.status,
          data: axiosError.response?.data,
        });
      }
      throw getError(error, 'Unable to load projects.');
    }
  },

  async getJobById(jobId: string | number): Promise<JobDetailApiResponse> {
    if (env.useMockAuth) {
      return {
        success: true,
        job: {
          id: jobId,
          title: 'Roof Damage Repair',
          description: 'Mock job detail while auth is offline.',
          status: 'In Progress',
          lead_address: '12 Oaks Mall Rd, Novi, MI 48377, USA',
          updated_at: '2 days ago',
        },
        proposals: [
          {
            id: 'mock-p1',
            status: 'SENT',
            signature_status: 'PENDING',
            updated_at: 'Last updated at 2 days ago',
          },
        ],
        inspection_reports: [],
        schedules: [],
        invoices: [],
        work_orders: [],
        material_orders: [],
        material_order_docs: [],
      };
    }

    const path = env.mobileJobs.detail(jobId);

    try {
      const response = await httpClient.get<JobDetailApiResponse>(path);

      if (response.data.success === false) {
        throw new Error(response.data.message || 'Unable to load project details.');
      }

      return normalizeJobDetailResponse(response.data);
    } catch (error) {
      throw getError(error, 'Unable to load project details.');
    }
  },

  async getInvoices(): Promise<InvoicesListResponse> {
    if (env.useMockAuth) {
      return {
        success: true,
        invoice: [
          {
            id: 2034,
            invoice_number: 'INV-2034',
            title: 'Roof Replacement - Phase 1',
            due_label: 'Due May 16, 2026',
            amount_formatted: '$2,480.00',
            display_status: 'Due Soon',
          },
          {
            id: 2031,
            invoice_number: 'INV-2031',
            title: 'Gutter Repair Final Bill',
            due_label: 'Due Apr 30, 2026',
            amount_formatted: '$860.00',
            display_status: 'Overdue',
          },
        ],
        totalRows: 2,
        summary: {
          open_balance: 3340,
          open_balance_formatted: '$3,340.00',
          total_count: 2,
        },
      };
    }

    try {
      const response = await httpClient.get<InvoicesListResponse>(env.mobileInvoices.list);

      if (response.data.success === false) {
        throw new Error(response.data.message || 'Unable to load invoices.');
      }

      return {
        ...response.data,
        invoice: Array.isArray(response.data.invoice) ? response.data.invoice : [],
      };
    } catch (error) {
      throw getError(error, 'Unable to load invoices.');
    }
  },

  async getInvoiceById(invoiceId: string | number): Promise<InvoiceDetailResponse> {
    if (env.useMockAuth) {
      return {
        success: true,
        Invoice: { id: invoiceId, amount: 2480, status: 'active' },
        items: [],
      };
    }

    try {
      const response = await httpClient.get<InvoiceDetailResponse>(
        env.mobileInvoices.detail(invoiceId),
      );

      if (response.data.success === false) {
        throw new Error(response.data.message || 'Unable to load invoice.');
      }

      return response.data;
    } catch (error) {
      throw getError(error, 'Unable to load invoice.');
    }
  },

  async getDocuments(folderId?: number | string | null): Promise<CustomerDocument[]> {
    if (env.useMockAuth) {
      return [...mockDocumentsList];
    }
    try {
      const params: Record<string, string> = {};
      if (folderId !== undefined) {
        params.folder_id = folderId === null ? 'null' : String(folderId);
      }
      const response = await httpClient.get<{
        success?: boolean;
        status?: string;
        files?: CustomerDocument[];
        message?: string;
      }>(env.mobileDocuments.list, { params });
      const ok =
        response.data.success === true ||
        response.data.status === 'success';
      if (ok && Array.isArray(response.data.files)) {
        return response.data.files;
      }
      return [];
    } catch (error) {
      throw getError(error, 'Unable to load documents.');
    }
  },

  async uploadDocument(payload: {
    uri: string;
    name: string;
    type: string | null;
    size: number | null;
    folderId?: number | string | null;
    jobId?: string | number;
  }): Promise<{ success: boolean; message?: string; document?: CustomerDocument }> {
    if (env.useMockAuth) {
      const doc: CustomerDocument = {
        id: `mock-doc-${Date.now()}`,
        original_name: payload.name || 'upload.bin',
        file_type: payload.type || 'application/octet-stream',
        file_size: payload.size ?? 0,
        created_at: new Date().toISOString(),
      };
      mockDocumentsList = [doc, ...mockDocumentsList];
      return { success: true, document: doc };
    }
    try {
      const formData = new FormData();
      formData.append('files[]', {
        uri: payload.uri,
        name: payload.name || 'upload',
        type: payload.type || 'application/octet-stream',
      } as unknown as Blob);
      formData.append('job_id', String(payload.jobId ?? '1'));
      if (payload.folderId !== undefined && payload.folderId !== null) {
        formData.append('folder_id', String(payload.folderId));
      }
      const response = await httpClient.post<{
        success?: boolean;
        status?: string;
        message?: string;
        files?: CustomerDocument[];
      }>(env.mobileDocuments.upload, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const ok =
        response.data.success === true ||
        response.data.status === 'success';
      if (!ok) {
        return { success: false, message: response.data.message || 'Upload failed.' };
      }
      const doc = Array.isArray(response.data.files) ? response.data.files[0] : undefined;
      if (doc && typeof doc === 'object' && 'id' in doc) {
        return { success: true, document: doc as CustomerDocument };
      }
      return { success: true, message: response.data.message };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw getError(error, 'Unable to upload document.');
    }
  },

  async getAgreements(): Promise<CustomerAgreement[]> {
    if (env.useMockAuth) {
      return mockAgreements();
    }
    try {
      const response = await httpClient.get<
        CustomerAgreement[] | { success?: boolean; agreements?: CustomerAgreement[]; message?: string }
      >(env.mobileAgreements.list);
      const data = response.data;
      if (Array.isArray(data)) {
        return data;
      }
      if (Array.isArray(data.agreements)) {
        return data.agreements;
      }
      if (data.success === false) {
        throw new Error(data.message || 'Unable to load agreements.');
      }
      return [];
    } catch (error) {
      throw getError(error, 'Unable to load agreements.');
    }
  },

  async getAgreementDetail(agreementId: string): Promise<CustomerAgreement | null> {
    if (env.useMockAuth) {
      const found = mockAgreements().find(a => String(a.id) === String(agreementId));
      return found || null;
    }
    try {
      const response = await httpClient.get<CustomerAgreement & { success?: boolean; message?: string }>(
        env.mobileAgreements.detail(agreementId),
      );
      if (response.data.success === false) {
        throw new Error(response.data.message || 'Unable to load agreement.');
      }
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        return null;
      }
      throw getError(error, 'Unable to load agreement.');
    }
  },

  async signAgreement(
    agreementId: string,
    payload: { signature_name: string; signature_image: string },
  ): Promise<CustomerAgreement> {
    if (env.useMockAuth) {
      return {
        ...mockAgreements()[0],
        id: agreementId,
        signature_status: 'signed',
        status: 'signed',
        signature_name: payload.signature_name,
        signature_date: new Date().toISOString(),
      };
    }
    try {
      const response = await httpClient.post<CustomerAgreement & { success?: boolean; message?: string }>(
        env.mobileAgreements.sign(agreementId),
        payload,
      );
      if (response.data.success === false) {
        throw new Error(response.data.message || 'Unable to sign agreement.');
      }
      return response.data;
    } catch (error) {
      throw getError(error, 'Unable to sign agreement.');
    }
  },

  async getPhotoMedia(projectId?: number | string | null): Promise<PhotoMediaListResponse> {
    if (env.useMockAuth) {
      return {
        success: true,
        before_pictures: [
          {
            id: 'mock-b1',
            project_id: 'mock-1',
            original_name: 'before.jpg',
            url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=900&q=80',
            display_url:
              'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=900&q=80',
          },
        ],
        after_pictures: [
          {
            id: 'mock-a1',
            project_id: 'mock-1',
            original_name: 'after.jpg',
            url: 'https://images.unsplash.com/photo-1591825729269-caeb344f6df2?auto=format&fit=crop&w=900&q=80',
            display_url:
              'https://images.unsplash.com/photo-1591825729269-caeb344f6df2?auto=format&fit=crop&w=900&q=80',
          },
        ],
      };
    }
    try {
      const params: Record<string, string> = {};
      if (projectId != null && projectId !== '' && projectId !== 'all') {
        params.project_id = String(projectId);
      }
      const response = await httpClient.get<PhotoMediaListResponse>(env.mobilePhotos.list, { params });
      if (response.data.success === false) {
        throw new Error(response.data.message || 'Unable to load photos.');
      }
      return {
        success: true,
        before_pictures: response.data.before_pictures ?? [],
        after_pictures: response.data.after_pictures ?? [],
      };
    } catch (error) {
      throw getError(error, 'Unable to load photos.');
    }
  },

  async uploadPhotoMedia(payload: {
    uri: string;
    name: string;
    type: string | null;
    jobId: string | number;
    pictureType: 'before_pictures' | 'after_pictures';
  }): Promise<{
    success: boolean;
    message?: string;
    files?: Array<{
      url?: string;
      original_name?: string;
      file_size?: number;
      file_type?: string;
    }>;
  }> {
    if (env.useMockAuth) {
      return { success: true, files: [{ url: payload.uri, original_name: payload.name }] };
    }
    try {
      const formData = new FormData();
      formData.append('job_id', String(payload.jobId));
      formData.append('type', payload.pictureType);
      formData.append('files[]', {
        uri: payload.uri,
        name: payload.name || 'photo.jpg',
        type: payload.type || 'image/jpeg',
      } as unknown as Blob);

      const uploadOrigin = env.stormBuddiUploadOrigin.replace(/\/+$/, '');

      const uploadRes = await axios.post<{
        status?: string;
        message?: string;
        files?: Array<{
          url?: string;
          original_name?: string;
          file_size?: number;
          file_type?: string;
        }>;
      }>(env.stormBuddiFileUploadUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Origin: uploadOrigin,
          Referer: `${uploadOrigin}/`,
        },
        timeout: 120000,
      });

      if (uploadRes.data?.status !== 'success') {
        return { success: false, message: uploadRes.data?.message || 'Upload failed.' };
      }

      const uploadedFiles = uploadRes.data.files ?? [];
      if (uploadedFiles.length === 0) {
        return { success: false, message: 'Upload succeeded but no files were returned.' };
      }

      return {
        success: true,
        message: uploadRes.data.message || 'Photos uploaded successfully.',
        files: uploadedFiles,
      };
    } catch (error) {
      throw getError(error, 'Unable to upload photo.');
    }
  },

  async getSchedule(): Promise<ScheduleApiPayload> {
    if (env.useMockAuth) {
      return mockSchedule();
    }
    try {
      const response = await httpClient.get<ScheduleApiPayload>(env.mobileSchedule.list);
      if (response.data.success === false) {
        throw new Error(response.data.message || 'Unable to load schedule.');
      }
      const events = (response.data.events ?? []).map((event) => ({
        ...event,
        startDateTime: event.startDateTime ?? event.start_date_time,
        endDateTime: event.endDateTime ?? event.end_date_time,
      }));
      return {
        success: true,
        events,
        projects: response.data.projects ?? [],
        message: response.data.message,
      };
    } catch (error) {
      throw getError(error, 'Unable to load schedule.');
    }
  },

  async createScheduleEvent(body: Record<string, unknown>): Promise<{ success: boolean; message?: string }> {
    if (env.useMockAuth) {
      const start = typeof body.start_date_time === 'string' ? body.start_date_time : new Date().toISOString();
      const end =
        typeof body.end_date_time === 'string'
          ? body.end_date_time
          : new Date(new Date(start).getTime() + 3600000).toISOString();
      mockScheduleEvents = [
        ...mockScheduleEvents,
        {
          id: `mock-ev-${Date.now()}`,
          title: String(body.title ?? 'Event'),
          type: typeof body.type === 'string' ? body.type : undefined,
          status: typeof body.status === 'string' ? body.status : undefined,
          start_date_time: start,
          end_date_time: end,
        },
      ];
      return { success: true };
    }

    const payload: Record<string, unknown> = { ...body, priority: body.priority ?? 'Medium' };
    if (payload.project_id == null && payload.job_id != null) {
      payload.project_id = payload.job_id;
    }

    try {
      const response = await httpClient.post<{ success: boolean; message?: string }>(
        env.mobileSchedule.create,
        payload,
      );
      return response.data;
    } catch (error) {
      throw getError(error, 'Unable to create schedule event.');
    }
  },

  async getServiceRequests(): Promise<ServiceRequestsListPayload> {
    if (env.useMockAuth) {
      return mockServiceRequests();
    }
    try {
      const response = await httpClient.get<ServiceRequestsListPayload>(env.mobileServiceRequests.list);
      if (response.data.success === false) {
        throw new Error(response.data.message || 'Unable to load service requests.');
      }
      return {
        success: true,
        jobs: response.data.jobs ?? [],
        totalRows: response.data.totalRows,
        message: response.data.message,
      };
    } catch (error) {
      throw getError(error, 'Unable to load service requests.');
    }
  },

  async createServiceRequest(payload: {
    request_type: string;
    description: string;
    attachments?: Array<{ uri: string; name: string; type: string | null }>;
  }): Promise<{ success: boolean; message?: string; lead?: ServiceRequestJob }> {
    if (env.useMockAuth) {
      return {
        success: true,
        lead: {
          id: `mock-sr-${Date.now()}`,
          request_type: payload.request_type,
          description: payload.description,
          status: 'Pending',
          startDate: new Date().toLocaleString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          }),
        },
      };
    }

    try {
      const formData = new FormData();
      formData.append('request_type', payload.request_type);
      formData.append('description', payload.description);
      formData.append('status', 'Pending');

      for (const file of payload.attachments ?? []) {
        formData.append('attachments[]', {
          uri: file.uri,
          name: file.name || 'attachment',
          type: file.type || 'application/octet-stream',
        } as unknown as Blob);
      }

      const response = await httpClient.post<{
        success?: boolean;
        message?: string;
        lead?: ServiceRequestJob;
      }>(env.mobileServiceRequests.create, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      return {
        success: response.data.success === true,
        message: response.data.message,
        lead: response.data.lead,
      };
    } catch (error) {
      throw getError(error, 'Unable to submit service request.');
    }
  },

  async getFinancingApplications(): Promise<FinancingApplication[]> {
    if (env.useMockAuth) {
      return mockFinancingApplications();
    }
    try {
      const response = await httpClient.get<FinancingApplicationsPayload>(env.mobileFinancing.applications);
      if (response.data.success === false) {
        throw new Error(response.data.message || 'Unable to load financing applications.');
      }
      return response.data.data ?? [];
    } catch (error) {
      throw getError(error, 'Unable to load financing applications.');
    }
  },

  async getFinancingPlans(): Promise<FinancingPlan[]> {
    if (env.useMockAuth) {
      return mockFinancingPlans();
    }
    try {
      const response = await httpClient.get<FinancingPlansPayload>(env.mobileFinancing.plans);
      if (response.data.success === false) {
        throw new Error(response.data.message || 'Unable to load financing plans.');
      }
      return response.data.data ?? [];
    } catch (error) {
      throw getError(error, 'Unable to load financing plans.');
    }
  },

  async createFinancingApplication(payload: {
    amount: number;
    plan_id: number | string;
    project_type: string;
    project_id: number | string;
    notes?: string;
  }): Promise<{ success: boolean; message?: string; data?: FinancingApplication }> {
    if (env.useMockAuth) {
      return {
        success: true,
        data: {
          id: `mock-fin-${Date.now()}`,
          requested_amount: payload.amount,
          plan_display: 'Mock Plan',
          project_type: payload.project_type,
          status: 'pending',
          application_date: new Date().toISOString().slice(0, 10),
        },
      };
    }

    try {
      const response = await httpClient.post<{
        success?: boolean;
        message?: string;
        data?: FinancingApplication;
      }>(env.mobileFinancing.createApplication, {
        amount: payload.amount,
        plan_id: payload.plan_id,
        project_type: payload.project_type,
        project_id: payload.project_id,
        project_address: payload.project_id,
        notes: payload.notes ?? '',
      });

      return {
        success: response.data.success === true,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (error) {
      throw getError(error, 'Unable to submit financing request.');
    }
  },

  async getChatUsers(): Promise<ChatUsersPayload> {
    if (env.useMockAuth) {
      return mockChatUsers();
    }
    try {
      const response = await httpClient.get<ChatUsersResponse & { peers?: ChatContact[] }>(
        env.mobileMessages.users,
      );
      return {
        ...response.data,
        peers: Array.isArray(response.data.peers) ? response.data.peers : [],
      };
    } catch (error) {
      throw getError(error, 'Unable to load messages contacts.');
    }
  },

  async startPeerConversation(email: string): Promise<{
    status: 'ready' | 'invited';
    peer?: ChatContact;
    message?: string;
    emailSent?: boolean;
  }> {
    if (env.useMockAuth) {
      return {
        status: 'ready',
        peer: {
          id: Date.now(),
          name: email.split('@')[0] || 'Peer',
          email,
          user_type: 'customer',
        },
        message: 'Conversation ready (mock).',
      };
    }
    try {
      const response = await httpClient.post<{
        success?: boolean;
        status?: 'ready' | 'invited';
        peer?: ChatContact;
        message?: string;
        error?: string;
        email_sent?: boolean;
      }>(env.mobileMessages.startPeerConversation, { email: email.trim().toLowerCase() });

      if (response.data.success !== true) {
        throw new Error(response.data.error || 'Unable to start conversation.');
      }

      return {
        status: response.data.status === 'invited' ? 'invited' : 'ready',
        peer: response.data.peer,
        message: response.data.message,
        emailSent: response.data.email_sent,
      };
    } catch (error) {
      if (error instanceof Error && !(error as AxiosError).isAxiosError) {
        throw error;
      }
      const axiosError = error as AxiosError<{ error?: string; message?: string }>;
      throw new Error(
        axiosError.response?.data?.error ||
          axiosError.response?.data?.message ||
          'Unable to start conversation.',
      );
    }
  },

  async getChatGroups(): Promise<ChatGroup[]> {
    if (env.useMockAuth) {
      return mockChatGroups();
    }
    try {
      const response = await httpClient.get<ChatGroup[] | { data?: ChatGroup[] }>(env.mobileMessages.groups);
      const data = response.data;
      if (Array.isArray(data)) {
        return data;
      }
      return [];
    } catch (error) {
      throw getError(error, 'Unable to load chat groups.');
    }
  },

  async createChatGroup(payload: {
    name?: string;
    inviteEmails?: string[];
  }): Promise<{ group: ChatGroup; emailsFailed: string[] }> {
    if (env.useMockAuth) {
      return {
        group: {
          id: `mock-g-${Date.now()}`,
          name: payload.name || 'Meeting Room',
          title: payload.name || 'Meeting Room',
          members: [],
        },
        emailsFailed: [],
      };
    }
    try {
      const formData = new FormData();
      if (payload.name?.trim()) {
        formData.append('name', payload.name.trim());
      }
      for (const email of payload.inviteEmails ?? []) {
        formData.append('invite_emails[]', email);
      }
      const response = await httpClient.post<{
        success?: boolean;
        error?: string;
        group?: ChatGroup;
        emails_failed?: string[];
      }>(env.mobileMessages.createGroup, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (response.data.success !== true || !response.data.group) {
        throw new Error(response.data.error || 'Unable to create meeting room.');
      }
      return {
        group: response.data.group,
        emailsFailed: response.data.emails_failed ?? [],
      };
    } catch (error) {
      if (error instanceof Error && !(error as AxiosError).isAxiosError) {
        throw error;
      }
      const axiosError = error as AxiosError<{ error?: string; message?: string }>;
      const serverError = axiosError.response?.data?.error;
      if (serverError) {
        throw new Error(serverError);
      }
      throw getError(error, 'Unable to create meeting room.');
    }
  },

  async acceptMeetingRoomInvitation(token: string): Promise<{
    group: ChatGroup;
    currentUserId: string;
    message?: string;
  }> {
    try {
      const response = await httpClient.post<{
        success?: boolean;
        error?: string;
        message?: string;
        group?: ChatGroup;
        current_user_id?: number | string;
      }>(env.mobileMessages.acceptInvitation(token));
      if (response.data.success !== true || !response.data.group || response.data.current_user_id == null) {
        throw new Error(response.data.error || 'Unable to accept meeting-room invitation.');
      }
      return {
        group: response.data.group,
        currentUserId: String(response.data.current_user_id),
        message: response.data.message,
      };
    } catch (error) {
      if (error instanceof Error && !(error as AxiosError).isAxiosError) {
        throw error;
      }
      const axiosError = error as AxiosError<{ error?: string; message?: string }>;
      throw new Error(
        axiosError.response?.data?.error ||
          axiosError.response?.data?.message ||
          'Unable to accept meeting-room invitation.',
      );
    }
  },

  async getDirectMessages(
    peerUserId: number | string,
    limit = 50,
    options?: { markRead?: boolean },
  ): Promise<ChatMessageRecord[]> {
    if (env.useMockAuth) {
      return [];
    }
    try {
      const response = await httpClient.get<ChatMessagesResponse>(
        env.mobileMessages.directMessages(peerUserId),
        {
          params: {
            limit,
            ...(options?.markRead === false ? { mark_read: 0 } : {}),
          },
        },
      );
      return response.data.messages ?? [];
    } catch (error) {
      throw getError(error, 'Unable to load messages.');
    }
  },

  async sendDirectMessage(receiverId: number | string, message: string): Promise<ChatMessageRecord> {
    if (env.useMockAuth) {
      return {
        id: `mock-${String(Date.now())}`,
        sender_id: 1,
        receiver_id: receiverId,
        message,
        created_at: new Date().toISOString(),
      };
    }
    try {
      const response = await httpClient.post<ChatMessageRecord>(env.mobileMessages.sendDirect, {
        receiver_id: receiverId,
        message,
      });
      return response.data;
    } catch (error) {
      throw getError(error, 'Unable to send message.');
    }
  },

  async markDirectRead(peerUserId: number | string): Promise<void> {
    if (env.useMockAuth) {
      return;
    }
    try {
      await httpClient.post(env.mobileMessages.markDirectRead(peerUserId));
    } catch {
      // Non-blocking; fetchMessages also marks read server-side.
    }
  },

  async getGroupMessages(
    groupId: number | string,
    limit = 50,
    options?: { markRead?: boolean; lastMessageId?: number | string },
  ): Promise<ChatMessageRecord[]> {
    if (env.useMockAuth) {
      return [];
    }
    try {
      const response = await httpClient.get<ChatMessagesResponse>(
        env.mobileMessages.groupMessages(groupId),
        {
          params: {
            limit,
            ...(options?.markRead === false ? { mark_read: 0 } : {}),
            ...(options?.lastMessageId != null ? { last_message_id: options.lastMessageId } : {}),
          },
        },
      );
      return response.data.messages ?? [];
    } catch (error) {
      throw getError(error, 'Unable to load group messages.');
    }
  },

  async sendGroupMessage(groupId: number | string, message: string): Promise<ChatMessageRecord> {
    if (env.useMockAuth) {
      return {
        id: `mock-${String(Date.now())}`,
        sender_id: 1,
        group_id: groupId,
        message,
        created_at: new Date().toISOString(),
      };
    }
    try {
      const response = await httpClient.post<ChatMessageRecord>(env.mobileMessages.sendGroup, {
        group_id: groupId,
        message,
      });
      return response.data;
    } catch (error) {
      throw getError(error, 'Unable to send message.');
    }
  },

  async uploadChatAttachment(payload: {
    uri: string;
    name: string;
    type: string | null;
    attachmentType: 'photo' | 'document';
    receiverId?: number | string;
    groupId?: number | string;
  }): Promise<ChatMessageRecord> {
    if (env.useMockAuth) {
      return {
        id: `mock-${String(Date.now())}`,
        sender_id: 1,
        receiver_id: payload.receiverId,
        group_id: payload.groupId,
        message: `[${payload.attachmentType.toUpperCase()}] ${payload.name}`,
        created_at: new Date().toISOString(),
        file_url: payload.uri,
        file_type: payload.attachmentType,
      };
    }

    if (!payload.receiverId && !payload.groupId) {
      throw new Error('Select a conversation before uploading a file.');
    }

    try {
      const formData = new FormData();
      formData.append('file', {
        uri: payload.uri,
        name: payload.name || 'attachment',
        type: payload.type || 'application/octet-stream',
      } as unknown as Blob);
      formData.append('type', payload.attachmentType);

      if (payload.groupId) {
        formData.append('group_id', String(payload.groupId));
      } else if (payload.receiverId) {
        formData.append('receiver_id', String(payload.receiverId));
      }

      const response = await httpClient.post<ChatMessageRecord>(env.mobileMessages.upload, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      return response.data;
    } catch (error) {
      throw getError(error, 'Unable to upload attachment.');
    }
  },

  async markGroupRead(groupId: number | string): Promise<void> {
    if (env.useMockAuth) {
      return;
    }
    try {
      await httpClient.post(env.mobileMessages.markGroupRead(groupId));
    } catch {
      // Non-blocking
    }
  },

  async deleteChatGroup(groupId: number | string): Promise<string> {
    if (env.useMockAuth) {
      return 'Meeting room deleted.';
    }
    try {
      const response = await httpClient.post<{ success?: boolean; error?: string; message?: string }>(
        env.mobileMessages.deleteGroup(groupId),
      );
      if (response.data.success !== true) {
        throw new Error(response.data.error || 'Unable to delete meeting room.');
      }
      return response.data.message || 'Meeting room deleted.';
    } catch (error) {
      if (error instanceof Error && !(error as AxiosError).isAxiosError) {
        throw error;
      }
      const axiosError = error as AxiosError<{ error?: string; message?: string }>;
      const data = axiosError.response?.data;
      const serverError = typeof data?.error === 'string' ? data.error : data?.message;
      throw new Error(serverError || 'Unable to delete meeting room.');
    }
  },

  async wipeChatGroup(groupId: number | string): Promise<string> {
    if (env.useMockAuth) {
      return 'Meeting room wiped.';
    }

    const postWipe = async (path: string): Promise<string> => {
      const response = await httpClient.post<WipeApiBody | string>(path, {});
      const data = response.data;
      if (typeof data === 'string') {
        throw Object.assign(new Error('Unable to wipe meeting room.'), { wipeStatus: 404 });
      }
      if (data && data.success === false) {
        throw Object.assign(new Error(wipeErrorText(data, 'Unable to wipe meeting room.')), {
          wipeStatus: response.status,
        });
      }
      return (typeof data?.message === 'string' && data.message) || 'Meeting room wiped.';
    };

    try {
      const message = await postWipe(env.mobileMessages.wipeGroup(groupId));
      await sessionStorage.markChatGroupWiped(groupId);
      return message;
    } catch (mobileError) {
      const axiosError = mobileError as AxiosError<WipeApiBody | string> & { wipeStatus?: number };
      const status = axiosError.response?.status ?? axiosError.wipeStatus;
      if (status === 401) {
        throw new Error('Your session expired. Sign in again and retry wipe.');
      }

      try {
        const webMessage = await postWipe(`chat/groups/${groupId}/wipe`);
        await sessionStorage.markChatGroupWiped(groupId);
        return webMessage;
      } catch (webError) {
        const webAxios = webError as AxiosError<WipeApiBody | string> & { wipeStatus?: number };
        const webStatus = webAxios.response?.status ?? webAxios.wipeStatus;
        const fallbackStatus = canFallbackWipe(status) ? status : webStatus;
        if (!canFallbackWipe(status) && !canFallbackWipe(webStatus)) {
          throw new Error(
            wipeErrorText(axiosError.response?.data, 'Unable to wipe meeting room.') +
              (status ? ` (${status})` : ''),
          );
        }

        try {
          await hideAllVisibleGroupMessages(groupId);
          return 'Meeting room wiped.';
        } catch {
          throw new Error(
            wipeErrorText(axiosError.response?.data, 'Unable to wipe meeting room.') +
              (fallbackStatus ? ` (${fallbackStatus})` : ''),
          );
        }
      }
    }
  },

  async leaveChatGroup(groupId: number | string): Promise<string> {
    if (env.useMockAuth) {
      return 'You left the meeting room.';
    }
    try {
      const response = await httpClient.post<{ success?: boolean; error?: string; message?: string }>(
        env.mobileMessages.leaveGroup(groupId),
      );
      if (response.data.success !== true) {
        throw new Error(response.data.error || 'Unable to leave meeting room.');
      }
      return response.data.message || 'You left the meeting room.';
    } catch (error) {
      if (error instanceof Error && !(error as AxiosError).isAxiosError) {
        throw error;
      }
      const axiosError = error as AxiosError<{ error?: string; message?: string }>;
      throw new Error(
        axiosError.response?.data?.error ||
          axiosError.response?.data?.message ||
          'Unable to leave meeting room.',
      );
    }
  },

  async hideMessageForMe(messageId: number | string): Promise<string> {
    if (env.useMockAuth) {
      return 'Message deleted for you.';
    }
    try {
      const response = await httpClient.post<{
        success?: boolean;
        error?: string | { message?: string };
        message?: string;
      }>(env.mobileMessages.hideMessage(messageId), { mode: 'me' });
      if (response.data.success !== true) {
        const err = response.data.error;
        const errMsg =
          typeof err === 'string' ? err : err?.message || 'Unable to delete message.';
        throw new Error(errMsg);
      }
      return response.data.message || 'Message deleted for you.';
    } catch (error) {
      if (error instanceof Error && !(error as AxiosError).isAxiosError) {
        throw error;
      }
      const axiosError = error as AxiosError<{
        error?: string | { message?: string };
        message?: string;
      }>;
      const err = axiosError.response?.data?.error;
      const errMsg = typeof err === 'string' ? err : err?.message;
      throw new Error(errMsg || axiosError.response?.data?.message || 'Unable to delete message.');
    }
  },

  async getNotifications(): Promise<NotificationsIndexResponse> {
    if (isMockDataMode() || env.useMockAuth) {
      return mockNotifications();
    }
    try {
      const response = await httpClient.get<NotificationsIndexResponse>(env.mobileNotifications.list);
      const data = response.data;
      const rows = Array.isArray(data.notifications) ? data.notifications : [];
      const notifications: PortalNotification[] = rows.map((row) => {
        const record = row as Record<string, unknown>;
        return {
          id: record.id as number | string,
          title: String(record.title ?? 'Notification'),
          message: String(record.message ?? record.notification ?? ''),
          type: (record.type as PortalNotification['type']) ?? 'info',
          read: Boolean(record.read),
          created_at: String(record.created_at ?? ''),
          notification_type:
            typeof record.notification_type === 'string' ? record.notification_type : undefined,
          navigation:
            record.navigation && typeof record.navigation === 'object'
              ? (record.navigation as PortalNotification['navigation'])
              : null,
        };
      });
      return {
        success: data.success === true,
        notifications,
        total_count: Number(data.total_count ?? notifications.length),
        unread_count: Number(data.unread_count ?? notifications.filter((n) => !n.read).length),
        message: data.message,
      };
    } catch (error) {
      throw getError(error, 'Unable to load notifications.');
    }
  },

  async getNotificationsUnreadCount(): Promise<number> {
    if (isMockDataMode() || env.useMockAuth) {
      return mockNotifications().unread_count;
    }
    try {
      const response = await httpClient.get<{ success?: boolean; unread_count?: number }>(
        env.mobileNotifications.unreadCount,
      );
      return Number(response.data.unread_count ?? 0) || 0;
    } catch {
      return 0;
    }
  },

  async markNotificationRead(
    id: number | string,
  ): Promise<NotificationMarkReadResponse['navigation']> {
    if (isMockDataMode() || env.useMockAuth) {
      return null;
    }
    try {
      const response = await httpClient.put<NotificationMarkReadResponse>(
        env.mobileNotifications.markRead(id),
      );
      return response.data.navigation ?? null;
    } catch (error) {
      throw getError(error, 'Unable to update notification.');
    }
  },

  async markAllNotificationsRead(): Promise<void> {
    if (isMockDataMode() || env.useMockAuth) {
      return;
    }
    try {
      await httpClient.put(env.mobileNotifications.markAllRead);
    } catch (error) {
      throw getError(error, 'Unable to mark notifications as read.');
    }
  },

  async markNotificationsReadOnOpen(): Promise<void> {
    if (isMockDataMode() || env.useMockAuth) {
      return;
    }
    try {
      await httpClient.put(env.mobileNotifications.markReadOnOpen);
    } catch {
      // Non-blocking — same as web when this fails silently in some paths
    }
  },

  async getDashboard(): Promise<DashboardPayload> {
    if (env.useMockAuth) {
      return {
        success: true,
        kpis: { total_jobs: 3, future_schedules: 0, requested_services: 2 },
        map: { latitude: 38.9072, longitude: -77.0369, address: 'Washington, DC, USA' },
        hail_table: [
          {
            date_key: '2025-05-31',
            at_location: '0.50"',
            one_mi: '0.50"',
            three_mi: '0.50"',
            ten_mi: '0.50"',
          },
        ],
      };
    }
    try {
      const response = await httpClient.get<DashboardPayload>(env.mobileDashboard.index);
      return response.data;
    } catch (error) {
      throw getError(error, 'Unable to load dashboard.');
    }
  },

  async getProfile(): Promise<CustomerProfile> {
    if (env.useMockAuth) {
      return {
        id: 1,
        name: 'Jane Smith',
        email: 'jane@client.com',
        phone: '555-4002-20342',
        subscriptions_plan: '2',
        address: '2021 K St NW, Washington, DC 20006, USA',
        Owner_Full_Name: 'Jane S',
        OwnershipType: 'Homeowner',
        MailingAddress: '2021 K St NW, Washington, DC 20006, USA',
        OwnerOccupied: 'Yes',
        PropertyType: 'Residential',
      };
    }
    try {
      const response = await httpClient.get<CustomerProfile>(env.mobileProfile.show);
      return response.data;
    } catch (error) {
      throw getError(error, 'Unable to load profile.');
    }
  },

  async updateProfile(
    payload: ProfileUpdatePayload,
    options?: {
      driverLicense?: { uri: string; name: string; type: string | null };
    },
  ): Promise<ProfileUpdateResponse> {
    if (env.useMockAuth) {
      return { success: true, message: 'Profile updated (mock).' };
    }

    try {
      if (options?.driverLicense) {
        const formData = new FormData();
        for (const [key, value] of Object.entries(payload)) {
          if (value !== undefined && value !== null && String(value) !== '') {
            formData.append(key, String(value));
          }
        }
        formData.append('driver_license_photo', {
          uri: options.driverLicense.uri,
          name: options.driverLicense.name || 'driver-license.jpg',
          type: options.driverLicense.type || 'image/jpeg',
        } as unknown as Blob);
        formData.append('_method', 'PUT');

        const response = await httpClient.post<ProfileUpdateResponse>(env.mobileProfile.update, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120000,
        });
        return response.data;
      }

      const response = await httpClient.put<ProfileUpdateResponse>(env.mobileProfile.update, payload);
      return response.data;
    } catch (error) {
      throw getError(error, 'Unable to update profile.');
    }
  },

  async uploadProfileCarPhoto(payload: {
    clientId: number | string;
    uri: string;
    name: string;
    type: string | null;
  }): Promise<{ picturePath: string; pictureUrl: string }> {
    if (env.useMockAuth) {
      return { picturePath: 'client_pictures/mock.jpg', pictureUrl: payload.uri };
    }

    try {
      const formData = new FormData();
      formData.append('Picture', {
        uri: payload.uri,
        name: payload.name || 'car-photo.jpg',
        type: payload.type || 'image/jpeg',
      } as unknown as Blob);
      formData.append('client_id', String(payload.clientId));

      const uploadOrigin = env.stormBuddiUploadOrigin.replace(/\/+$/, '');
      const response = await axios.post<{
        picture?: string;
        car_photos?: string | string[];
      }>(env.stormBuddiClientFilesUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Origin: uploadOrigin,
          Referer: `${uploadOrigin}/`,
        },
        timeout: 120000,
      });

      const picturePath =
        response.data.picture ||
        (Array.isArray(response.data.car_photos) ? response.data.car_photos[0] : response.data.car_photos) ||
        '';

      if (!picturePath) {
        throw new Error('Upload succeeded but no file path was returned.');
      }

      const base = env.stormBuddiApiOrigin.replace(/\/+$/, '');
      const pictureUrl = `${base}/${String(picturePath).replace(/^\//, '')}`;

      return { picturePath: String(picturePath), pictureUrl };
    } catch (error) {
      throw getError(error, 'Unable to upload car photo.');
    }
  },

  async uploadProfileAvatar(payload: {
    uri: string;
    name: string;
    type: string | null;
  }): Promise<{ avatar: string; avatar_url: string | null }> {
    if (env.useMockAuth) {
      return { avatar: payload.name, avatar_url: payload.uri };
    }

    let uri = payload.uri;
    if (uri.startsWith('/') && !uri.startsWith('file://') && !uri.startsWith('content://')) {
      uri = `file://${uri}`;
    }

    let type = (payload.type || 'image/jpeg').toLowerCase();
    if (type === 'image/jpg') {
      type = 'image/jpeg';
    }

    let name = payload.name || `avatar-${Date.now()}.jpg`;
    if (!/\.(jpe?g|png|gif|webp)$/i.test(name)) {
      name = `${name.replace(/\.[^.]+$/, '')}.jpg`;
      type = 'image/jpeg';
    }

    const readAvatar = (data: Record<string, unknown>): { avatar: string; avatar_url: string | null } => {
      const nested =
        data.data && typeof data.data === 'object' ? (data.data as Record<string, unknown>) : undefined;
      const avatar = String(nested?.avatar ?? data.avatar ?? '');
      const avatarUrlRaw = nested?.avatar_url ?? data.avatar_url;
      const avatarUrl = typeof avatarUrlRaw === 'string' && avatarUrlRaw ? avatarUrlRaw : null;
      if (!avatar && !avatarUrl) {
        throw new Error('Unable to update profile photo.');
      }
      return { avatar: avatar || payload.name, avatar_url: avatarUrl };
    };

    const urls = [
      `${env.apiBaseUrl.replace(/\/+$/, '')}/${env.mobileProfile.avatar}`,
      `${env.apiBaseUrl.replace(/\/+$/, '')}/${env.mobileProfile.update}`,
    ];

    try {
      let lastError: unknown;
      for (const url of urls) {
        try {
          const json = await postMultipartJson(url, {
            fieldName: 'avatar',
            uri,
            fileName: name,
            mime: type,
          });
          if (json.success === false) {
            throw new Error(
              typeof json.message === 'string' ? json.message : 'Unable to update profile photo.',
            );
          }
          return readAvatar(json);
        } catch (error) {
          lastError = error;
          const message = error instanceof Error ? error.message : '';
          const isMissing = /\(404\)|\(405\)|Upload failed \(404\)|Upload failed \(405\)/.test(message);
          if (!isMissing) {
            throw error;
          }
        }
      }
      throw lastError instanceof Error ? lastError : new Error('Unable to update profile photo.');
    } catch (error) {
      throw getError(error, 'Unable to update profile photo.');
    }
  },
};
